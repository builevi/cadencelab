import copy
import json
import unittest
from unittest.mock import patch
import httpx
from test_reports import fixture
from apps.api.services.reports import ReportRequest
from apps.api.services.semantic import (GitHubModels, ProviderError, MODULES, ModuleBatch,
    analyze_channel, validate_batch, prepare_posts)
from apps.api.services.pipeline import run_pipeline
from apps.api.services.jobs import JobService
import tempfile
from pathlib import Path

QUOTE='Giải thích cách đọc thành phần và chọn sản phẩm phù hợp.'


def sample_request():
    data=fixture()
    data.update(analysis_mode='semantic',language='vi')
    for p in data['channels'][0]['posts']:p['caption']=QUOTE
    return ReportRequest.model_validate(data)


def batch(ids):
    return {'modules':[{'id':id,'status':'insufficient_evidence','summary':'',
                        'findings':[],'missing':['more evidence needed']} for id in ids]}


class FakeProvider:
    model='fixture-only'
    def generate(self,payload):
        return ModuleBatch.model_validate(batch(payload['module_ids']))


class SemanticTests(unittest.TestCase):
    def test_successful_three_part_pipeline_and_progress(self):
        progress=[]
        result=run_pipeline(sample_request(),progress.append,FakeProvider())
        self.assertEqual(set(result['report_parts']),{'report_part_1','report_part_2','report_part_3'})
        self.assertEqual(result['semantic_status'],'completed')
        self.assertEqual(len(result['channels'][0]['semantic_analysis']['modules']),8)
        self.assertEqual(progress,sorted(progress))
        self.assertEqual(progress[-1],95)
        self.assertEqual(len(result['report_parts']['report_part_3']['evaluations'][0]['below_baseline_posts']),1)

    def test_statistics_mode_never_calls_provider(self):
        request=sample_request().model_copy(update={'analysis_mode':'statistics'})
        with patch.object(FakeProvider,'generate',side_effect=AssertionError('unexpected AI request')):
            self.assertEqual(run_pipeline(request,provider=FakeProvider())['semantic_status'],'not_requested')

    def test_no_text_does_not_spend_provider_request(self):
        request=ReportRequest.model_validate(fixture())
        with patch.object(FakeProvider,'generate',side_effect=AssertionError('unexpected AI request')):
            result=analyze_channel(request.channels[0],'vi',FakeProvider())
        self.assertEqual(result['provider'],'not_called')

    def test_partial_failure_preserves_other_modules(self):
        class Partial(FakeProvider):
            def generate(self,payload):
                if payload['module_ids'][0]==MODULES[0]:raise ProviderError('provider_rate_limited')
                return super().generate(payload)
        result=run_pipeline(sample_request(),provider=Partial())
        self.assertEqual(result['semantic_status'],'partial')
        self.assertEqual(result['channels'][0]['totals']['views']['known_total'],6100)

    def test_exact_evidence_is_checked_and_schema_forbids_invented_fields(self):
        data=batch(['brand_positioning'])
        m=data['modules'][0];m.update(status='analyzed',summary='A tentative interpretation',findings=[
            {'text':'Caption explains product ingredients','evidence':[{'post_id':'0','field':'caption','quote':QUOTE}]}])
        posts=prepare_posts(sample_request().channels[0])
        self.assertEqual(validate_batch(ModuleBatch.model_validate(data),['brand_positioning'],posts)[0]['status'],'analyzed')
        for field,value in [('quote','fabricated quote'),('post_id','nonexistent')]:
            bad=copy.deepcopy(data);bad['modules'][0]['findings'][0]['evidence'][0][field]=value
            with self.assertRaises(ProviderError):validate_batch(ModuleBatch.model_validate(bad),['brand_positioning'],posts)
        m['secret_score']=42
        with self.assertRaises(ValueError):ModuleBatch.model_validate(data)

    def test_duplicate_module_and_wrong_evidence_type_rejected(self):
        with self.assertRaises(ProviderError):validate_batch(ModuleBatch.model_validate(batch(['brand_positioning'])),['tone_of_voice'],[])
        data=batch(['transcript_analysis'])
        data['modules'][0].update(status='analyzed',findings=[{'text':'Claim','evidence':[
            {'post_id':'0','field':'caption','quote':QUOTE}]}])
        with self.assertRaises(ProviderError):validate_batch(ModuleBatch.model_validate(data),['transcript_analysis'],prepare_posts(sample_request().channels[0]))

    def test_payload_is_bounded_and_order_is_deterministic(self):
        data=fixture();posts=data['channels'][0]['posts']
        data['channels'][0]['posts']=[dict(posts[0],id=str(i),caption='x'*10000,transcript='y'*30000) for i in range(40)]
        prepared=prepare_posts(ReportRequest.model_validate(data).channels[0])
        self.assertLessEqual(len(prepared),20)
        self.assertLessEqual(sum(len(p[k]) for p in prepared for k in ['caption','transcript','comment','ad_text']),18000)

    def test_provider_success_and_no_token_leaked_to_body(self):
        def handler(request):
            self.assertEqual(request.url.host,'models.github.ai')
            self.assertEqual(request.headers['Authorization'],'Bearer fake-secret')
            self.assertNotIn('fake-secret',request.content.decode())
            return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(batch(MODULES[:3]))}}]})
        provider=GitHubModels('fake-secret',transport=httpx.MockTransport(handler))
        self.assertEqual(len(provider.generate({}).modules),3)

    def test_invalid_response_and_auth_errors_are_sanitized(self):
        for response,code in [(httpx.Response(200,text='OK'),'provider_invalid_output'),
            (httpx.Response(401,text='secret in upstream error'),'provider_access_denied'),
            (httpx.Response(302,headers={'Location':'https://untrusted.example'}),'provider_request_rejected'),
            (httpx.Response(200,json={'choices':[{'finish_reason':'length','message':{'content':'{}'}}]}),'provider_incomplete_output')]:
            with self.subTest(code=code):
                provider=GitHubModels('fake-secret',transport=httpx.MockTransport(lambda _:response))
                with self.assertRaisesRegex(ProviderError,code):provider.generate({})

    def test_bounded_rate_limit_retry_and_timeout(self):
        calls=[]
        def handler(request):
            calls.append(1)
            return httpx.Response(429,headers={'Retry-After':'9999'},text='private detail')
        with patch('apps.api.services.semantic.time.sleep') as sleep:
            with self.assertRaisesRegex(ProviderError,'provider_rate_limited'):
                GitHubModels('fake',transport=httpx.MockTransport(handler)).generate({})
            self.assertEqual(len(calls),3)
            self.assertEqual([c.args[0] for c in sleep.call_args_list],[5,5])

    def test_cancel_fences_running_worker_and_pagination(self):
        with tempfile.TemporaryDirectory() as temp:
            jobs=JobService(Path(temp)/'jobs.db',start_worker=False)
            try:
                job=jobs.submit(ReportRequest.model_validate(fixture()))
                row=jobs.claim()
                jobs.cancel(job['id'])
                jobs.update_progress(row,95)
                self.assertEqual(jobs.get(job['id'])['state'],'cancelled')
                self.assertEqual(jobs.list_jobs(1,0)[0]['id'],job['id'])
                self.assertEqual(jobs.list_jobs(1,1),[])
                self.assertIsNone(jobs.get(job['id'],result=True))
            finally:jobs.close()


if __name__=='__main__':unittest.main()
