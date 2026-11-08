import copy
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.services.reports import ReportRequest, build_report
from apps.api.services.jobs import JobService, JobConflict


def fixture():
    return {'kind':'channel','channels':[{'id':'test','name':'Fixture Channel','platform':'tiktok',
        'url':'https://example.com/channel','posts':[{'id':str(i),'url':f'https://example.com/post/{i}',
        'published_at':f'2026-01-{i+1:02d}T00:00:00Z','observed_at':'2026-03-01T00:00:00Z',
        'format':'short_video','duration_seconds':40,'views':100 if i==0 else 1000,
        'likes':10,'comments':2,'shares':1} for i in range(7)]}]}


class ReportTests(unittest.TestCase):
    def test_relative_performance_and_evidence(self):
        result=build_report(ReportRequest.model_validate(fixture()))
        target=result['channels'][0]['performance'][0]
        self.assertEqual(target['status'],'below_peer_baseline')
        self.assertEqual(target['relative_views'],.1)
        self.assertEqual(target['peer_count'],6)
        self.assertEqual(len(result['channels'][0]['source_urls']),7)

    def test_missing_metrics_are_not_zero(self):
        data=fixture()
        for p in data['channels'][0]['posts']:p['views']=None
        r=build_report(ReportRequest.model_validate(data))['channels'][0]
        self.assertIsNone(r['totals']['views']['known_total'])
        self.assertTrue(all(p['status']=='insufficient_data' for p in r['performance']))
        self.assertTrue(all(p['engagement_per_view'] is None for p in r['performance']))

    def test_age_and_duration_and_capture_mismatch_excluded(self):
        for field,value in [('duration_seconds',200),('published_at','2026-02-28T23:00:00Z'),
                             ('observed_at','2026-04-01T00:00:00Z')]:
            data=fixture();data['channels'][0]['posts'][0][field]=value
            r=build_report(ReportRequest.model_validate(data))['channels'][0]['performance'][0 if field!='published_at' else -1]
            self.assertEqual(r['status'],'insufficient_data')

    def test_single_video_uses_context(self):
        data=fixture();data.update(kind='single_video',target_post_id='0')
        r=build_report(ReportRequest.model_validate(data))
        self.assertEqual(r['target_performance']['relative_views'],.1)

    def test_comparison_and_merge_keep_channels_separate(self):
        data=fixture();other=copy.deepcopy(data['channels'][0]);other['id']='other';other['platform']='youtube'
        data['channels'].append(other)
        for kind in ['comparison','merge']:
            data['kind']=kind
            result=build_report(ReportRequest.model_validate(data))
            self.assertEqual(len(result['channels']),2)
            self.assertIn(kind,result)
            if kind=='merge':self.assertTrue(result['merge']['metrics_kept_separate_by_channel'])

    def test_invalid_scope_dates_and_duplicate_rejected(self):
        for change in ['duplicate','future_publication','missing_duration','single_missing_target','unknown_field']:
            data=fixture();post=data['channels'][0]['posts'][0]
            if change=='duplicate':data['channels'][0]['posts'].append(copy.deepcopy(post))
            elif change=='future_publication':post['published_at']='2027-01-01T00:00:00Z'
            elif change=='missing_duration':post.pop('duration_seconds')
            elif change=='single_missing_target':data['kind']='single_video'
            else:post['viral_probability']=.9
            with self.subTest(change=change),self.assertRaises(ValueError):ReportRequest.model_validate(data)


class JobsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.patch=patch.dict(os.environ,{'SOCIALLENS_JOB_DB':str(Path(self.temp.name)/'jobs.db')})
        self.patch.start()
        self.client=TestClient(app);self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None);self.patch.stop();self.temp.cleanup()

    def wait(self,id):
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            job=self.client.get('/api/v1/reports/jobs/'+id).json()
            if job['state'] in ['completed','failed']:return job
            time.sleep(.01)
        self.fail('Job did not finish')

    def test_job_result_sse_and_persistence(self):
        r=self.client.post('/api/v1/reports/jobs',json=fixture(),headers={'Idempotency-Key':'same'})
        self.assertEqual(r.status_code,202);id=r.json()['id']
        self.assertEqual(self.wait(id)['state'],'completed')
        result=self.client.get(r.json()['result_url'])
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['channels'][0]['performance'][0]['status'],'below_peer_baseline')
        event=self.client.get(r.json()['events_url'])
        self.assertIn('event: progress',event.text)
        self.assertIn('"completed"',event.text)
        # New SQLite connection sees a fully serialized durable result.
        with app.state.jobs.connect() as db:
            self.assertIsNotNone(db.execute('SELECT result FROM jobs WHERE id=?',(id,)).fetchone()[0])
        repeat=self.client.post('/api/v1/reports/jobs',json=fixture(),headers={'Idempotency-Key':'same'})
        self.assertEqual(repeat.json()['id'],id)
        modified=fixture();modified['channels'][0]['name']='Different'
        self.assertEqual(self.client.post('/api/v1/reports/jobs',json=modified,headers={'Idempotency-Key':'same'}).status_code,409)

    def test_semantic_job_preserves_statistics_on_provider_failure(self):
        from apps.api.services.semantic import ProviderError
        data=fixture();data['analysis_mode']='semantic'
        for p in data['channels'][0]['posts']:p['caption']='A documented fixture caption for provider failure test.'
        with patch('apps.api.services.codex_local.CodexLocal.generate',side_effect=ProviderError('provider_invalid_output')):
            response=self.client.post('/api/v1/reports/jobs',json=data)
            self.assertEqual(self.wait(response.json()['id'])['state'],'completed')
        result=self.client.get(response.json()['result_url']).json()
        self.assertEqual(result['semantic_status'],'unavailable')
        self.assertEqual(result['channels'][0]['totals']['views']['known_total'],6100)
        self.assertEqual(len(result['report_parts']['report_part_2']['qualitative_analysis'][0]['modules']),8)

    def test_csv_job_list_and_cancel_routes(self):
        import csv,io
        post=fixture()['channels'][0]['posts'][0]
        text=io.StringIO();writer=csv.DictWriter(text,fieldnames=list(post))
        writer.writeheader();writer.writerow(post)
        response=self.client.post('/api/v1/reports/imports/csv',json={
            'channel_id':'import','channel_name':'Imported','platform':'tiktok',
            'channel_url':'https://example.com/channel','csv_text':text.getvalue()})
        self.assertEqual(response.status_code,202)
        id=response.json()['id']
        self.assertEqual(self.client.get('/api/v1/reports/jobs?limit=1').json()['items'][0]['id'],id)
        cancel=self.client.post('/api/v1/reports/jobs/'+id+'/cancel')
        self.assertIn(cancel.json()['state'],['cancelled','completed'])
        self.assertEqual(self.client.post('/api/v1/reports/jobs/missing/cancel').status_code,404)
        self.assertEqual(self.client.get('/api/v1/reports/jobs?limit=101').status_code,422)

    def test_concurrent_idempotency(self):
        service=app.state.jobs;request=ReportRequest.model_validate(fixture())
        with ThreadPoolExecutor(max_workers=8) as pool:
            jobs=list(pool.map(lambda _:service.submit(request,'parallel'),range(8)))
        self.assertEqual(len({j['id'] for j in jobs}),1)

    def test_missing_job_and_invalid_inputs(self):
        for suffix in ['', '/result','/events']:
            self.assertEqual(self.client.get('/api/v1/reports/jobs/missing'+suffix).status_code,404)
        self.assertEqual(self.client.post('/api/v1/reports/jobs',json={}).status_code,422)
        self.assertEqual(self.client.post('/api/v1/reports/jobs',json=fixture(),headers={'Idempotency-Key':' '}).status_code,422)

    def test_failed_job_is_visible(self):
        with patch('apps.api.services.jobs.build_report',side_effect=ValueError('synthetic test failure')):
            r=self.client.post('/api/v1/reports/jobs',json=fixture())
            state=self.wait(r.json()['id'])
        self.assertEqual(state['state'],'failed')
        self.assertEqual(state['error'],'report_computation_failed')
        self.assertEqual(self.client.get(r.json()['result_url']).status_code,409)

    def test_restart_recovers_expired_running_job(self):
        old=app.state.jobs
        old.close()
        job=old.submit(ReportRequest.model_validate(fixture()),'recovery')
        with old.connect() as db:
            db.execute("UPDATE jobs SET state='running',attempts=1,lease_until=0 WHERE id=?",(job['id'],))
        new=JobService(old.path)
        try:
            deadline=time.monotonic()+5
            while time.monotonic()<deadline and new.get(job['id'])['state']!='completed':time.sleep(.01)
            self.assertEqual(new.get(job['id'])['state'],'completed')
            self.assertEqual(new.get(job['id'])['attempts'],2)
            self.assertEqual(new.get(job['id'],result=True)['schema_version'],'1.0')
        finally:
            new.close()


if __name__=='__main__':unittest.main()
