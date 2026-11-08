"""User-selected compatible text providers. No embedded keys, no silent cloud fallback."""
import json
from threading import Lock
from typing import Literal
from urllib.parse import urlsplit
import httpx
from pydantic import Field, SecretStr, model_validator
from .reports import Model
from .semantic import ModuleBatch, ProviderError, SYSTEM

ENDPOINTS={
    'openai':'https://api.openai.com/v1/chat/completions',
    'gemini':'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    'deepseek':'https://api.deepseek.com/chat/completions',
    'groq':'https://api.groq.com/openai/v1/chat/completions',
}


class ProviderConfig(Model):
    provider: Literal['codex_local','openai','gemini','deepseek','groq','ollama']='codex_local'
    model: str = Field(default='',max_length=200)
    apiKey: SecretStr = Field(default=SecretStr(''),max_length=4096)
    baseUrl: str = Field(default='http://127.0.0.1:11434/v1',max_length=500)

    @model_validator(mode='after')
    def validate_config(self):
        if self.provider!='codex_local' and not self.model.strip():raise ValueError('Nhập tên model muốn dùng.')
        if self.provider in ENDPOINTS and not self.apiKey.get_secret_value().strip():raise ValueError('Nhập API key của nhà cung cấp đã chọn.')
        if self.provider=='ollama':
            try:u=urlsplit(self.baseUrl);port=u.port
            except ValueError:raise ValueError('Địa chỉ Ollama không hợp lệ.') from None
            if u.scheme!='http' or u.hostname not in ('localhost','127.0.0.1','::1') or u.username or u.password or u.query or u.fragment or port is None or u.path.rstrip('/')!='/v1':
                raise ValueError('Ollama chỉ kết nối tới máy này, dạng http://127.0.0.1:11434/v1.')
        return self


_lock=Lock()
_runtime=None


def set_runtime_config(config):
    global _runtime
    with _lock:_runtime=config.model_copy(deep=True)


def runtime_config():
    with _lock:return _runtime.model_copy(deep=True) if _runtime else None


class CompatibleProvider:
    full_batch=True
    def __init__(self,config,transport=None):
        self.config=config
        self.name=config.provider
        self.model=config.model
        self.transport=transport

    def generate(self,payload):return self.generate_structured(payload,ModuleBatch,SYSTEM)

    def generate_structured(self,payload,response_model,instructions):
        endpoint=(self.config.baseUrl.rstrip('/')+'/chat/completions' if self.name=='ollama' else ENDPOINTS[self.name])
        headers={'Content-Type':'application/json'}
        if self.name!='ollama':headers['Authorization']='Bearer '+self.config.apiKey.get_secret_value()
        body={'model':self.model,'stream':False,'max_tokens':4096,'response_format':{'type':'json_object'},
              'messages':[{'role':'system','content':instructions+' Return JSON only, matching the supplied output schema.'},
                          {'role':'user','content':json.dumps({'data':payload,'output_schema':response_model.model_json_schema()},ensure_ascii=False)}]}
        try:
            # Disable environment HTTP proxies for loopback requests.
            with httpx.Client(timeout=180,transport=self.transport,follow_redirects=False,trust_env=self.name!='ollama') as client:
                response=client.post(endpoint,headers=headers,json=body)
        except httpx.RequestError:raise ProviderError('provider_unreachable') from None
        if response.status_code in (401,403):raise ProviderError('provider_access_denied')
        if response.status_code==429:raise ProviderError('provider_rate_limited')
        if response.status_code==404:raise ProviderError('provider_model_not_found')
        if response.status_code!=200:raise ProviderError('provider_request_rejected')
        try:
            choice=response.json()['choices'][0]
            if choice.get('finish_reason')!='stop':raise ProviderError('provider_incomplete_output')
            return response_model.model_validate_json(choice['message']['content'])
        except (ValueError,TypeError,KeyError,IndexError):raise ProviderError('provider_invalid_output') from None
