import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from apps.api.services.compatible import ProviderConfig, CompatibleProvider
from apps.api.services.semantic import ProviderError
from apps.api.desktop_app import create_desktop_app, ConnectionTest


class CompatibleTests(unittest.TestCase):
    def test_cloud_request_stays_on_selected_provider_and_key_not_in_payload(self):
        def handler(request):
            self.assertEqual(request.url.host,'generativelanguage.googleapis.com')
            self.assertEqual(request.headers['authorization'],'Bearer fake-secret')
            self.assertNotIn('fake-secret',request.content.decode())
            return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':'{"ok":true}'}}]})
        cfg=ProviderConfig(provider='gemini',model='fixture',apiKey='fake-secret')
        self.assertTrue(CompatibleProvider(cfg,transport=httpx.MockTransport(handler)).generate_structured({},ConnectionTest,'JSON').ok)

    def test_ollama_is_local_without_key(self):
        def handler(request):
            self.assertEqual(request.url.host,'127.0.0.1');self.assertNotIn('authorization',request.headers)
            return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':'{"ok":true}'}}]})
        cfg=ProviderConfig(provider='ollama',model='fixture')
        self.assertTrue(CompatibleProvider(cfg,transport=httpx.MockTransport(handler)).generate_structured({},ConnectionTest,'JSON').ok)
        for url in ['https://evil.example/v1','http://localhost:11434/v1?key=fake','http://user:secret@localhost:11434/v1']:
            with self.assertRaises(ValueError):ProviderConfig(provider='ollama',model='fixture',baseUrl=url)

    def test_errors_redact_provider_bodies(self):
        for status,expected in [(401,'provider_access_denied'),(429,'provider_rate_limited'),(404,'provider_model_not_found'),(302,'provider_request_rejected')]:
            cfg=ProviderConfig(provider='deepseek',model='fixture',apiKey='fake-secret')
            client=CompatibleProvider(cfg,transport=httpx.MockTransport(lambda _:httpx.Response(status,text='private upstream secret')))
            with self.assertRaisesRegex(ProviderError,'^'+expected+'$'):client.generate_structured({},ConnectionTest,'JSON')


class DesktopBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();root=Path(self.temp.name)
        (root/'index.html').write_text('<html><script>console.log("fixture")</script><body>Desktop fixture</body></html>')
        self.env=patch.dict('os.environ',{'SOCIALLENS_JOB_DB':str(root/'data/jobs.db')});self.env.start()
        self.runtime=patch('apps.api.services.compatible._runtime',None);self.runtime.start()
        self.app=create_desktop_app(root,'x'*64,'fixture-instance')
        self.client=TestClient(self.app);self.client.__enter__()
        self.headers={'X-CadenceLab-Token':'x'*64}

    def tearDown(self):
        self.client.__exit__(None,None,None);self.runtime.stop();self.env.stop();self.temp.cleanup()

    def test_auth_required_for_static_and_api(self):
        for url in ['/','/internal/health','/api/v1/reports/jobs']:
            self.assertEqual(self.client.get(url).status_code,403)
        html=self.client.get('/',headers=self.headers)
        self.assertEqual(html.status_code,200);self.assertIn('sha256-',html.headers['content-security-policy'])
        self.assertEqual(self.client.get('/internal/health',headers=self.headers).json()['instance'],'fixture-instance')
        self.assertEqual(self.client.get('/',headers={**self.headers,'Origin':'https://evil.example'}).status_code,403)

    def test_authorized_report_and_video_routers_are_mounted(self):
        from test_reports import fixture
        response=self.client.post('/api/v1/reports/jobs',headers=self.headers,json=fixture())
        self.assertEqual(response.status_code,202)
        video=self.client.get('/api/v1/videos/jobs/missing',headers=self.headers)
        self.assertEqual(video.status_code,404)
        self.assertIn('video',video.json()['detail'])

    def test_settings_validation_never_echoes_key(self):
        response=self.client.put('/internal/provider',headers=self.headers,json={'provider':'evil','apiKey':'fake-secret'})
        self.assertEqual(response.status_code,422);self.assertNotIn('fake-secret',response.text)
        result=self.client.put('/internal/provider',headers=self.headers,json={'provider':'gemini','model':'fixture','apiKey':'fake-secret'})
        self.assertEqual(result.status_code,200);self.assertNotIn('fake-secret',result.text)

    def test_connection_test_uses_supplied_config_without_saving(self):
        with patch('apps.api.desktop_app.CompatibleProvider.generate_structured',return_value=ConnectionTest(ok=True)):
            response=self.client.post('/internal/provider/test',headers=self.headers,json={'provider':'ollama','model':'fixture'})
        self.assertTrue(response.json()['ok'])
        from apps.api.services.compatible import runtime_config
        self.assertIsNone(runtime_config())


if __name__=='__main__':unittest.main()
