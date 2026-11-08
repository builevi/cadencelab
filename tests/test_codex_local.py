import copy
import io
import json
import queue
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from apps.api.services.codex_local import AppServerClient, CodexLocal, _LOCAL_SLOT
from apps.api.services.providers import FallbackProvider, configured_provider
from apps.api.services.semantic import ModuleBatch, ProviderError, MODULES, validate_batch
from test_semantic_pipeline import batch, sample_request, FakeProvider
from apps.api.services.pipeline import run_pipeline


class FakeClient:
    instances=[]
    model='fixture-local-model'
    def __init__(self,*args):self.closed=False;self.__class__.instances.append(self)
    def infer(self,payload,cwd):
        assert Path(cwd).is_dir()
        return ModuleBatch.model_validate(batch(payload['module_ids']))
    def close(self):self.closed=True


class FakeProcess:
    def __init__(self):self.stdin=io.StringIO()


class CodexTests(unittest.TestCase):
    def test_local_provider_closes_client_and_releases_slot(self):
        provider=CodexLocal('/test/codex',client_factory=FakeClient)
        result=run_pipeline(sample_request(),provider=provider)
        ai=result['channels'][0]['semantic_analysis']
        self.assertEqual(ai['provider'],'codex_local')
        self.assertEqual(ai['model'],'fixture-local-model')
        self.assertEqual(len(ai['modules']),8)
        self.assertTrue(FakeClient.instances[-1].closed)
        self.assertTrue(_LOCAL_SLOT.acquire(blocking=False));_LOCAL_SLOT.release()

    def test_failure_releases_slot(self):
        class Failed(FakeClient):
            def infer(self,*args):raise ProviderError('codex_timeout')
        with self.assertRaisesRegex(ProviderError,'codex_timeout'):
            CodexLocal('/test/codex',client_factory=Failed).generate({})
        self.assertTrue(FakeClient.instances[-1].closed)
        self.assertTrue(_LOCAL_SLOT.acquire(blocking=False));_LOCAL_SLOT.release()

    def test_queue_slot_has_bounded_wait(self):
        _LOCAL_SLOT.acquire()
        try:
            with self.assertRaisesRegex(ProviderError,'codex_busy'):
                CodexLocal('/test/codex',timeout=.01).generate({})
        finally:_LOCAL_SLOT.release()

    def test_provider_selection(self):
        with patch.dict('os.environ',{'SOCIALLENS_AI_PROVIDER':'codex_local'}):
            self.assertIsInstance(configured_provider(),CodexLocal)
        with patch.dict('os.environ',{'SOCIALLENS_AI_PROVIDER':'invalid'}):
            with self.assertRaisesRegex(ProviderError,'unknown_ai_provider'):configured_provider()

    def test_fallback_for_upstream_failure_and_bad_evidence(self):
        payload={'module_ids':['brand_positioning'],'posts':[{'post_id':'0','caption':'actual source'}]}
        class Bad(FakeProvider):
            def generate(self,payload):raise ProviderError('provider_invalid_output')
        primary=Bad()
        provider=FallbackProvider(primary,FakeProvider())
        result=provider.generate(payload)
        self.assertEqual(provider.used_provider,'codex_local')
        self.assertEqual(provider.fallback_reason,'provider_invalid_output')
        validate_batch(result,payload['module_ids'],payload['posts'])
        class Fabricated(FakeProvider):
            def generate(self,payload):
                result=batch(payload['module_ids']);result['modules'][0].update(status='analyzed',findings=[
                    {'text':'Claim','evidence':[{'post_id':'0','field':'caption','quote':'invented evidence'}]}])
                return ModuleBatch.model_validate(result)
        provider=FallbackProvider(Fabricated(),FakeProvider());provider.generate(payload)
        self.assertEqual(provider.fallback_reason,'provider_evidence_mismatch')

    def client(self):
        c=AppServerClient(timeout=.02);c.process=FakeProcess();c.deadline=time.monotonic()+.02
        return c

    def test_disconnect_timeout_and_interactive_request(self):
        c=self.client();c.incoming.put(None)
        with self.assertRaisesRegex(ProviderError,'codex_disconnected'):c.receive()
        c=self.client()
        with self.assertRaisesRegex(ProviderError,'codex_timeout'):c.receive()
        c=self.client();c.incoming.put({'id':99,'method':'item/commandExecution/requestApproval'})
        with self.assertRaisesRegex(ProviderError,'codex_interaction_required'):c.receive()
        self.assertEqual(json.loads(c.process.stdin.getvalue())['error']['code'],-32601)

    def test_rpc_does_not_drop_early_events(self):
        c=self.client();event={'method':'item/completed','params':{'item':{'type':'agentMessage','text':'{}'}}}
        c.incoming.put(event);c.incoming.put({'id':1,'result':{'ok':True}})
        self.assertTrue(c.call('test',{})['ok'])
        self.assertEqual(c.receive(),event)

    def test_rpc_errors_do_not_expose_upstream_messages(self):
        c=self.client();c.incoming.put({'id':1,'error':{'message':'private upstream detail'}})
        with self.assertRaisesRegex(ProviderError,'^codex_rpc_error$'):c.call('test',{})

    def test_readonly_protocol_and_structured_result(self):
        class Transport(AppServerClient):
            def start(self,cwd):self.calls=[]
            def call(self,method,params):
                self.calls.append((method,params))
                if method=='thread/start':return {'thread':{'id':'test-thread'},'model':'fixture'}
                return {}
            def send(self,message):pass
            def receive(self,**kwargs):return self.notifications.pop(0)
        client=Transport()
        client.notifications=[{'method':'item/completed','params':{'item':{'type':'agentMessage','text':json.dumps(batch(MODULES))}}},
            {'method':'turn/completed','params':{'turn':{'status':'completed'}}}]
        self.assertEqual(len(client.infer({},'/private/tmp').modules),8)
        params=dict(client.calls)['thread/start']
        self.assertTrue(params['ephemeral']);self.assertEqual(params['sandbox'],'read-only')
        self.assertEqual(dict(client.calls)['turn/start']['sandboxPolicy']['networkAccess'],False)


if __name__=='__main__':unittest.main()
