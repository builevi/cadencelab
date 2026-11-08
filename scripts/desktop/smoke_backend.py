"""Verify the frozen backend, including its private HTTP boundary and local media stack."""
from pathlib import Path
import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
import httpx
ROOT=Path(__file__).resolve().parents[2]


def main():
    binary=ROOT/'build/desktop/cadencelab-backend/cadencelab-backend'
    if len(sys.argv)>1:binary=Path(sys.argv[1])
    token=secrets.token_hex(32)
    with tempfile.TemporaryDirectory(prefix='cadencelab-frozen-') as directory:
        env={**os.environ,'CADENCELAB_FRONTEND':str(ROOT/'build/desktop/frontend'),'CADENCELAB_DATA_DIR':directory,
             'SOCIALLENS_MODELS_DIR':str(ROOT/'.sociallens/models'),'SOCIALLENS_DESKTOP_TOKEN':token,'CADENCELAB_INSTANCE':'frozen-smoke'}
        log=Path(directory)/'backend.log'
        with log.open('w') as errors:
            process=subprocess.Popen([str(binary)],env=env,stdout=subprocess.PIPE,stderr=errors,text=True)
            try:
                ready=json.loads(process.stdout.readline());origin='http://127.0.0.1:'+str(ready['port'])
                with httpx.Client(timeout=15,headers={'X-CadenceLab-Token':token},trust_env=False) as client:
                    for _ in range(100):
                        try:
                            if client.get(origin+'/internal/health').status_code==200:break
                        except httpx.RequestError:pass
                        time.sleep(.1)
                    assert httpx.get(origin+'/internal/health',trust_env=False).status_code==403
                    page=client.get(origin+'/');assert page.status_code==200
                    assert 'sha256-' in page.headers['content-security-policy']
                    assert client.get(origin+'/',headers={'Origin':'https://evil.example'}).status_code==403
                    source=json.loads((ROOT/'docs/examples/channel-input.synthetic.json').read_text())
                    response=client.post(origin+'/api/v1/reports/jobs',json=source);assert response.status_code==202,(response.status_code,response.text[:500])
                    for _ in range(100):
                        job=client.get(origin+response.json()['status_url']).json()
                        if job['state'] in ('completed','failed'):break
                        time.sleep(.1)
                    assert job['state']=='completed'
                    report=client.get(origin+response.json()['result_url']).json();assert report['channels']
                    # Real media decode + ASR on a synthetic clip, without a real AI call.
                    configure=client.put(origin+'/internal/provider',json={'provider':'ollama','model':'not-running-fixture','baseUrl':'http://127.0.0.1:1/v1'})
                    assert configure.status_code==200
                    fixture=Path('/private/tmp/sociallens-video-speech.mp4')
                    media_status=None
                    if fixture.is_file():
                        with fixture.open('rb') as file:upload=client.post(origin+'/api/v1/videos/jobs',files={'file':('fixture.mp4',file,'video/mp4')},data={'language':'en'})
                        assert upload.status_code==202
                        for _ in range(240):
                            video_job=client.get(origin+upload.json()['status_url']).json()
                            if video_job['state'] in ('completed','failed'):break
                            time.sleep(.25)
                        assert video_job['state']=='completed',video_job
                        video=client.get(origin+upload.json()['result_url']).json()
                        assert video['transcript']['status']=='transcribed',video['transcript']['status']
                        assert len(video['features']['visual_motion'])>0
                        assert video['cfi'] is None  # deliberate unavailable Ollama, no fabricated semantics
                        media_status={'words':len(video['transcript']['words']),'slices':len(video['features']['visual_motion']),'semantic_status':video['semantic_analysis']['status']}
                    result={'frozen_backend':True,'auth_boundary':True,'static_frontend':True,'report_job':'completed','media':media_status}
                    out=ROOT/'docs/research/desktop-frozen-smoke.json';out.write_text(json.dumps(result,indent=2));print(json.dumps(result))
            except Exception:
                errors.flush();print(log.read_text()[-4000:],file=sys.stderr);raise
            finally:
                process.terminate()
                try:process.wait(timeout=12)
                except subprocess.TimeoutExpired:process.kill();process.wait()


if __name__=='__main__':main()
