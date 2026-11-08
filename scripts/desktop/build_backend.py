"""Reproducible native backend build; invoke on the target OS/architecture."""
from pathlib import Path
import os
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--name','cadencelab-backend',
    '--distpath',str(ROOT/'build/desktop'),'--workpath',str(ROOT/'build/pyinstaller'),
    '--specpath',str(ROOT/'build'),'--paths',str(ROOT),'--noupx',
    '--hidden-import','uvicorn.logging','--hidden-import','uvicorn.loops.asyncio',
    '--hidden-import','uvicorn.protocols.http.h11_impl','--hidden-import','uvicorn.lifespan.on']
for module in ['imageio_ffmpeg','faster_whisper','ctranslate2','onnxruntime','yt_dlp']:
    command+=['--collect-all',module]
command+=[str(ROOT/'scripts/desktop/backend_entry.py')]
env={**os.environ,'PYINSTALLER_CONFIG_DIR':str(ROOT/'build/pyinstaller-cache')}
subprocess.run(command,cwd=ROOT,env=env,check=True)
