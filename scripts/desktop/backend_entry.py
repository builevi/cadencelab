"""PyInstaller entry point. Data and configuration are never written to the bundle."""
from pathlib import Path
import json
import os
import socket
import sys

ROOT=Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:sys.path.insert(0,str(ROOT))


def main():
    if len(sys.argv)>1 and sys.argv[1]=='--metadata-worker':
        import yt_dlp
        yt_dlp.main(sys.argv[2:])
        return
    frontend=Path(os.environ['CADENCELAB_FRONTEND'])
    data=Path(os.environ['CADENCELAB_DATA_DIR'])
    data.mkdir(parents=True,exist_ok=True)
    os.environ['SOCIALLENS_JOB_DB']=str(data/'jobs.sqlite3')
    from apps.api.desktop_app import create_desktop_app
    import uvicorn
    app=create_desktop_app(frontend,os.environ['SOCIALLENS_DESKTOP_TOKEN'],os.environ['CADENCELAB_INSTANCE'])
    with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as sock:
        sock.bind(('127.0.0.1',0));sock.listen(128)
        print(json.dumps({'event':'ready','port':sock.getsockname()[1]}),flush=True)
        config=uvicorn.Config(app,host='127.0.0.1',loop='asyncio',http='h11',ws='none',lifespan='on',
            log_level='warning',access_log=False,timeout_graceful_shutdown=8)
        uvicorn.Server(config).run(sockets=[sock])


if __name__=='__main__':main()
