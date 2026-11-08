from datetime import datetime,timezone
import json
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.services.sources import SourceRequest, SourceError, source_identity, normalize_metadata, fetch_metadata

VID='6748451240264420610'
URL='https://www.tiktok.com/@source_fixture/video/'+VID
NOW=datetime(2026,11,8,tzinfo=timezone.utc)


def item(id=VID,owner='source_fixture'):
    return {'id':id,'uploader':owner,'uploader_id':'numeric-owner-id','channel':'Source Fixture',
            'timestamp':1767225600,'duration':18,'view_count':4321,'like_count':None,
            'comment_count':21,'description':'Actual fixture source caption.'}


class SourceTests(unittest.TestCase):
    def test_only_supported_https_platform_urls(self):
        for url in ['http://www.tiktok.com/@x','https://evil.example/@x','https://www.tiktok.com.evil.test/@x',
                    'https://user:pass@www.tiktok.com/@x','https://www.tiktok.com:8080/@x',
                    'https://127.0.0.1/@x','file:///etc/passwd','https://www.youtube.com/watch?v=bad']:
            with self.subTest(url=url),self.assertRaises(ValueError):SourceRequest(source_url=url)
        self.assertEqual(SourceRequest(source_url=URL+'?tracking=x#frag').source_url,URL)
        self.assertEqual(source_identity('https://youtu.be/BaW_jenozKc')['platform'],'youtube')
        self.assertTrue(source_identity('https://vt.tiktok.com/AbC123/')['short'])

    def test_real_fields_are_preserved_unknown_metrics_not_zero(self):
        request=SourceRequest(source_url=URL,analysis_mode='statistics')
        body,provenance=normalize_metadata(item(),source_identity(URL),request,NOW)
        self.assertEqual(body.kind,'single_video');self.assertEqual(body.target_post_id,VID)
        post=body.channels[0].posts[0]
        self.assertEqual(post.views,4321);self.assertIsNone(post.likes);self.assertIsNone(post.shares)
        self.assertEqual(provenance['requested_url'],URL)
        self.assertNotIn('LumiDerm',body.model_dump_json())

    def test_wrong_video_or_channel_rejected(self):
        with self.assertRaises(SourceError):
            normalize_metadata(item('6748451240264420611'),source_identity(URL),SourceRequest(source_url=URL),NOW)
        url='https://www.tiktok.com/@source_fixture'
        with self.assertRaises(SourceError):
            normalize_metadata({'entries':[item(owner='other_creator')]},source_identity(url),SourceRequest(source_url=url),NOW)

    def test_missing_duration_date_empty_and_duplicate_handling(self):
        url='https://www.tiktok.com/@source_fixture';request=SourceRequest(source_url=url,post_limit=2)
        bad=item();bad.pop('duration')
        with self.assertRaises(SourceError):normalize_metadata({'entries':[bad]},source_identity(url),request,NOW)
        data,source=normalize_metadata({'entries':[item(),item()]},source_identity(url),request,NOW)
        self.assertEqual(len(data.channels[0].posts),1)
        with self.assertRaises(SourceError):normalize_metadata({'entries':[]},source_identity(url),request,NOW)

    def test_collector_network_failures_are_safe_and_bounded(self):
        identity=source_identity(URL)
        with patch('apps.api.services.sources.subprocess.run',return_value=SimpleNamespace(returncode=1)) as run:
            with self.assertRaises(SourceError):fetch_metadata(identity,12)
            args=run.call_args.args[0]
            self.assertIn('--skip-download',args);self.assertIn('--ignore-config',args)
            self.assertNotIn('--cookies-from-browser',args);self.assertEqual(run.call_args.kwargs['timeout'],55)
        with patch('apps.api.services.sources.subprocess.run',side_effect=subprocess.TimeoutExpired('safe',55)):
            with self.assertRaisesRegex(SourceError,'phản hồi quá lâu'):fetch_metadata(identity,12)


class SourceAPITests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict('os.environ',{'SOCIALLENS_JOB_DB':str(Path(self.temp.name)/'source.db')});self.env.start()
        self.client=TestClient(app);self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None);self.env.stop();self.temp.cleanup()

    def wait(self,id):
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            job=self.client.get('/api/v1/reports/jobs/'+id).json()
            if job['state'] in ('completed','failed'):return job
            time.sleep(.01)
        self.fail('Source job did not finish')

    def test_enter_contract_source_job_result_and_idempotency(self):
        data={'source_url':URL,'analysis_mode':'statistics'}
        with patch('apps.api.services.jobs.fetch_metadata',return_value=item()):
            first=self.client.post('/api/v1/reports/from-url',json=data,headers={'Idempotency-Key':'enter'})
            self.assertEqual(first.status_code,202);id=first.json()['id']
            state=self.wait(id)
            self.assertEqual(state['state'],'completed');self.assertEqual(state['source_url'],URL)
            self.assertLessEqual(state['created'],state['updated'])
            report=self.client.get(first.json()['result_url']).json()
            self.assertEqual(report['source']['requested_url'],URL)
            self.assertEqual(report['data_source'],'collected_public_snapshot')
            self.assertEqual(report['channels'][0]['totals']['views']['known_total'],4321)
            self.assertNotIn('lumiderm',json.dumps(report).lower())
            again=self.client.post('/api/v1/reports/from-url',json=data,headers={'Idempotency-Key':'enter'})
            self.assertEqual(again.json()['id'],id)
            data['source_url']='https://www.tiktok.com/@different'
            self.assertEqual(self.client.post('/api/v1/reports/from-url',json=data,headers={'Idempotency-Key':'enter'}).status_code,409)

    def test_collection_failure_never_returns_fixture(self):
        with patch('apps.api.services.jobs.fetch_metadata',side_effect=SourceError('Nguồn không cho đọc dữ liệu.')):
            response=self.client.post('/api/v1/reports/from-url',json={'source_url':URL})
            state=self.wait(response.json()['id'])
        self.assertEqual(state['state'],'failed')
        self.assertEqual(state['error'],'Nguồn không cho đọc dữ liệu.')
        self.assertEqual(self.client.get(response.json()['result_url']).status_code,409)

    def test_bad_url_and_empty_key_rejected(self):
        self.assertEqual(self.client.post('/api/v1/reports/from-url',json={'source_url':'https://localhost/'}).status_code,422)
        self.assertEqual(self.client.post('/api/v1/reports/from-url',json={'source_url':URL},headers={'Idempotency-Key':' '}).status_code,422)


if __name__=='__main__':unittest.main()
