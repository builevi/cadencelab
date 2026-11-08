"""Exercise upload→real FFmpeg→real local ASR→real Codex→persisted CFI.
Uses a generated test pattern and synthetic speech, not a real creator video.
"""
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.services.video import ffmpeg


def main():
    fixture=Path('/private/tmp/sociallens-video-speech.mp4')
    subprocess.run([ffmpeg(),'-y','-hide_banner','-loglevel','error','-f','lavfi','-i',
        'testsrc=size=320x180:rate=12','-i','/private/tmp/sociallens-video-voice.aiff','-shortest',
        '-t','59','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',str(fixture)],check=True)
    started=time.monotonic()
    with tempfile.TemporaryDirectory(prefix='sl-video-api-') as directory, patch.dict('os.environ',{
        'SOCIALLENS_JOB_DB':str(Path(directory)/'jobs.db')}),TestClient(app) as client:
        with fixture.open('rb') as file:
            r=client.post('/api/v1/videos/jobs',files={'file':('synthetic-speech.mp4',file,'video/mp4')},data={'language':'en'})
        if r.status_code!=202:raise RuntimeError('Video upload rejected')
        urls=r.json();deadline=time.monotonic()+260
        while time.monotonic()<deadline:
            state=client.get(urls['status_url']).json()
            if state['state'] in ('completed','failed'):break
            time.sleep(.5)
        result=client.get(urls['result_url']).json() if state['state']=='completed' else {}
        summary={'fixture':'generated test pattern + synthesized English speech',
            'elapsed_seconds':round(time.monotonic()-started,2),'job_state':state['state'],
            'processing_status':result.get('processing_status'),'duration_seconds':result.get('duration_seconds'),
            'transcript_status':result.get('transcript',{}).get('status'),
            'recognized_words':len(result.get('transcript',{}).get('words',[])),
            'semantic_status':result.get('semantic_analysis',{}).get('status'),
            'semantic_error':result.get('semantic_analysis',{}).get('error'),
            'cfi_slices':len((result.get('cfi') or {}).get('timeline_slices',[])),
            'original_removed':not list(app.state.video_jobs.uploads.glob('*.bin'))}
        (ROOT/'docs/research/video-upload-live-check.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
        if result:(ROOT/'docs/research/video-upload-result.synthetic.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps(summary,ensure_ascii=False))
        return 0 if result.get('cfi') else 1


if __name__=='__main__':raise SystemExit(main())
