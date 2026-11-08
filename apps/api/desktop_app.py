"""Private desktop-only HTTP application; secrets live in Electron's encrypted store."""
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .main import app as core_app, lifespan
from .report_routes import router as report_router
from .video_routes import router as video_router
from .services.compatible import ProviderConfig, set_runtime_config, CompatibleProvider
from .services.codex_local import CodexLocal
from .services.reports import Model
from .services.semantic import ProviderError

ERRORS={'provider_access_denied':'API key không hợp lệ hoặc chưa có quyền dùng model.',
        'provider_rate_limited':'Nhà cung cấp đang giới hạn lượt gọi hoặc tài khoản hết hạn mức.',
        'provider_model_not_found':'Không tìm thấy model. Kiểm tra tên model hoặc tải model vào Ollama.',
        'provider_unreachable':'Không kết nối được. Kiểm tra Internet hoặc Ollama đang chạy.',
        'codex_not_installed':'Chưa tìm thấy Codex CLI. Cài và đăng nhập Codex hoặc chọn provider khác.',
        'codex_timeout':'Codex phản hồi quá lâu. Kiểm tra đăng nhập và hạn mức.',
        'codex_rpc_error':'Codex chưa nhận được yêu cầu. Kiểm tra phiên đăng nhập và quyền model.'}


class ConnectionTest(Model):ok:bool


def create_desktop_app(frontend,token,instance='desktop'):
    if len(token)<32:raise ValueError('Desktop token must be unpredictable')
    html=(Path(frontend)/'index.html').read_text(encoding='utf-8')
    hashes=["'sha256-"+__import__('base64').b64encode(hashlib.sha256(code.encode()).digest()).decode()+"'"
            for code in re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)]
    csp="default-src 'self'; script-src 'self' "+' '.join(hashes)+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    app=FastAPI(title='CadenceLab Desktop',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)
    for route in core_app.routes:
        if getattr(route,'path','').startswith('/api/'):
            app.router.routes.append(route)

    app.include_router(report_router)
    app.include_router(video_router)

    @app.middleware('http')
    async def private_local(request,call_next):
        supplied=request.headers.get('x-cadencelab-token','')
        if not hmac.compare_digest(supplied,token):return JSONResponse({'detail':'Desktop access required'},status_code=403)
        origin=request.headers.get('origin')
        if origin and origin!=str(request.base_url).rstrip('/'):
            return JSONResponse({'detail':'Origin denied'},status_code=403)
        response=await call_next(request)
        response.headers['Content-Security-Policy']=csp
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Referrer-Policy']='no-referrer'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request,exc):
        return JSONResponse({'detail':'Cấu hình chưa hợp lệ. Kiểm tra provider, tên model và API key.'},status_code=422)

    @app.get('/internal/health')
    def health():return {'ok':True,'instance':instance,'version':'0.3.0'}

    @app.put('/internal/provider')
    def configure(body:ProviderConfig):
        set_runtime_config(body)
        return {'ok':True,'provider':body.provider,'model':body.model}

    @app.post('/internal/provider/test')
    def test_provider(body:ProviderConfig):
        provider=CodexLocal() if body.provider=='codex_local' else CompatibleProvider(body)
        try:
            result=provider.generate_structured({'request':'Connection check: return {"ok":true}.'},ConnectionTest,
                'You are testing a connection. Return the JSON object {"ok":true}, no tools.')
            if not result.ok:raise ProviderError('provider_invalid_output')
        except ProviderError as exc:
            return JSONResponse({'ok':False,'message':ERRORS.get(str(exc),'Model chưa trả được JSON hợp lệ. Kiểm tra tên model và khả năng JSON mode.')},status_code=422)
        return {'ok':True,'message':'Kết nối thành công; model đã trả JSON hợp lệ.','provider':body.provider,'model':getattr(provider,'model',body.model)}

    app.mount('/',StaticFiles(directory=frontend,html=True),name='desktop-ui')
    return app
