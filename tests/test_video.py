import json
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
import numpy as np
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.services.video import (decode,ffmpeg,extract_signals,meaning_from_words,MeaningResult,
    analyze_video,VideoError,transcribe)
from apps.api.video_routes import VideoTask


class MeaningProvider:
    model='fixture'
    def generate_structured(self,payload,*args):
        return MeaningResult(windows=[{'index':w['index'],'density':.6,'quote':w['text']} for w in payload['windows']])


class VideoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.path=Path(cls.temp.name)/'fixture.mp4'
        subprocess.run([ffmpeg(),'-y','-hide_banner','-loglevel','error','-f','lavfi','-i',
            'testsrc=size=160x90:rate=12','-f','lavfi','-i','sine=frequency=440:sample_rate=16000',
            '-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',str(cls.path)],check=True)

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_decode_actual_file_fixed_shapes_and_signals(self):
        frames,audio,duration=decode(self.path)
        self.assertEqual(frames.shape,(8,54,96))
        self.assertEqual(duration,2)
        self.assertGreater(len(audio),30000)
        visual,acoustic=extract_signals(frames,audio,duration)
        self.assertEqual(len(visual),4);self.assertEqual(len(acoustic),4)
        self.assertTrue(all(0<=v<=1 for v in visual+acoustic))

    def test_static_vs_visual_changes_and_silent_audio(self):
        static=np.zeros((8,54,96),dtype=np.uint8)
        changing=static.copy();changing[1::2]=255
        quiet=np.zeros(32000)
        v,a=extract_signals(static,quiet,2)
        self.assertEqual(v,[0]*4);self.assertEqual(a,[0]*4)
        v2,_=extract_signals(changing,quiet,2)
        self.assertTrue(all(x>0 for x in v2))

    def test_no_audio_stream_is_missing_not_decode_error(self):
        path=Path(self.temp.name)/'silent.mp4'
        subprocess.run([ffmpeg(),'-y','-hide_banner','-loglevel','error','-f','lavfi','-i',
                        'color=black:size=96x54:rate=4','-t','1','-c:v','libx264',str(path)],check=True)
        frames,audio,duration=decode(path)
        self.assertEqual(len(audio),0)
        self.assertEqual(transcribe(audio,Path(self.temp.name))['status'],'no_audio')

    def test_invalid_media_rejected(self):
        path=Path(self.temp.name)/'broken.bin';path.write_text('not a video')
        with self.assertRaises(VideoError):decode(path)

    def test_long_video_rejected(self):
        path=Path(self.temp.name)/'long.mp4'
        subprocess.run([ffmpeg(),'-y','-hide_banner','-loglevel','error','-f','lavfi','-i',
                        'color=black:size=96x54:rate=4','-t','61','-c:v','libx264',str(path)],check=True)
        with self.assertRaisesRegex(VideoError,'60 giây'):decode(path)

    def test_semantic_missing_and_fabricated_quotes(self):
        self.assertIsNone(meaning_from_words([],4,MeaningProvider())[0])
        words=[{'start':0,'end':.2,'text':'A concrete instruction'}]
        values,meta=meaning_from_words(words,4,MeaningProvider())
        self.assertEqual(values,[.6,0,0,0])
        self.assertEqual(meta['scope'],'spoken_transcript_only')
        class Bad(MeaningProvider):
            def generate_structured(self,payload,*args):
                return MeaningResult(windows=[{'index':0,'density':.8,'quote':'Invented words'}])
        self.assertEqual(meaning_from_words(words,4,Bad())[1]['error'],'semantic_quote_mismatch')

    def test_pipeline_missing_asr_has_no_fake_cfi(self):
        with patch('apps.api.services.video.transcribe',return_value={'status':'no_speech_detected','words':[]}):
            result=analyze_video(self.path,Path(self.temp.name),provider=MeaningProvider())
        self.assertIsNone(result['cfi'])
        self.assertEqual(result['processing_status'],'partial')
        self.assertEqual(len(result['features']['visual_motion']),4)

    def test_pipeline_real_decode_with_fixture_asr_and_semantics(self):
        with patch('apps.api.services.video.transcribe',return_value={'status':'transcribed','words':[
            {'start':0,'end':.2,'text':'Actual fixture transcript'}]}):
            result=analyze_video(self.path,Path(self.temp.name),provider=MeaningProvider())
        self.assertEqual(result['processing_status'],'completed')
        self.assertEqual(len(result['cfi']['timeline_slices']),4)
        json.dumps(result,allow_nan=False)


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict('os.environ',{'SOCIALLENS_JOB_DB':str(Path(self.temp.name)/'test.db')});self.env.start()
        self.client=TestClient(app);self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None);self.env.stop();self.temp.cleanup()

    def wait(self,id):
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            state=self.client.get('/api/v1/videos/jobs/'+id).json()
            if state['state'] in ('completed','failed'):return state
            time.sleep(.02)
        self.fail('Video job did not finish')

    def test_invalid_uploaded_file_fails_safely_and_is_removed(self):
        r=self.client.post('/api/v1/videos/jobs',files={'file':('private-name.mp4',b'invalid','video/mp4')})
        self.assertEqual(r.status_code,202)
        job=self.wait(r.json()['id'])
        self.assertEqual(job['state'],'failed')
        self.assertNotIn('private-name',job['error'])
        self.assertEqual(list(app.state.video_jobs.uploads.glob('*.bin')),[])
        self.assertEqual(self.client.get(r.json()['result_url']).status_code,409)
        self.assertIn('event: progress',self.client.get(r.json()['events_url']).text)

    def test_empty_oversized_and_bad_language_upload(self):
        self.assertEqual(self.client.post('/api/v1/videos/jobs',files={'file':('a.mp4',b'')}).status_code,422)
        with patch('apps.api.video_routes.MAX_BYTES',16):
            self.assertEqual(self.client.post('/api/v1/videos/jobs',files={'file':('a.mp4',b'x'*17)}).status_code,413)
        self.assertEqual(list(app.state.video_jobs.uploads.glob('*.bin')),[])
        self.assertEqual(self.client.post('/api/v1/videos/jobs',files={'file':('a.mp4',b'x')},data={'language':'bad'}).status_code,422)

    def test_cancel_queued_upload_removes_file_and_unknown_routes(self):
        service=app.state.video_jobs;service.close()
        id='a'*32;(service.uploads/(id+'.bin')).write_bytes(b'fixture')
        job=service.submit(VideoTask(upload_id=id))
        self.assertEqual(self.client.post('/api/v1/videos/jobs/'+job['id']+'/cancel').json()['state'],'cancelled')
        self.assertFalse((service.uploads/(id+'.bin')).exists())
        for suffix in ['', '/result','/events']:
            self.assertEqual(self.client.get('/api/v1/videos/jobs/missing'+suffix).status_code,404)


if __name__=='__main__':unittest.main()
