"""One real synthetic report through the local worker; no secrets in output."""
from pathlib import Path
import json
import sys
import tempfile
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from apps.api.services.jobs import JobService
from apps.api.services.reports import ReportRequest


def main():
    data=json.loads((ROOT/'docs/examples/channel-input.synthetic.json').read_text())
    data.update(analysis_mode='semantic',language='vi')
    for p in data['channels'][0]['posts']:
        p['caption']='Hướng dẫn đọc bảng thành phần để lựa chọn kem dưỡng phù hợp với da dầu. Lưu lại ba bước kiểm tra trước khi mua.'
    started=time.monotonic()
    with tempfile.TemporaryDirectory(prefix='sociallens-smoke-') as folder:
        service=JobService(Path(folder)/'jobs.sqlite3')
        try:
            job=service.submit(ReportRequest.model_validate(data))
            deadline=time.monotonic()+210
            while time.monotonic()<deadline:
                state=service.get(job['id'])
                if state['state'] in ('completed','failed'):break
                time.sleep(.5)
            report=service.get(job['id'],result=True)
            summary={'fixture':'synthetic captions, not TikTok collection','elapsed_seconds':round(time.monotonic()-started,2),
                     'job_state':state['state'],'semantic_status':report.get('semantic_status') if report else None}
            if report:
                ai=report['channels'][0].get('semantic_analysis',{})
                summary.update(provider=ai.get('provider'),model=ai.get('model'),modules=[
                    {'id':m['id'],'status':m['status'],'error':m.get('error')} for m in ai.get('modules',[])])
                (ROOT/'docs/research/codex-local-report.synthetic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
            (ROOT/'docs/research/codex-local-live-check.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
            print(json.dumps(summary,ensure_ascii=False))
            if not report or report.get('semantic_status') not in ('completed','partial'):return 1
            return 0
        finally:service.close()


if __name__=='__main__':raise SystemExit(main())
