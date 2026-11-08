"""Build static UI in an isolated staging directory, preserving the running web build."""
from pathlib import Path
import os
import shutil
import subprocess
ROOT=Path(__file__).resolve().parents[2]
web=ROOT/'apps/web'
stage=ROOT/'build/desktop/web-stage'
if stage.exists():shutil.rmtree(stage)
stage.mkdir(parents=True)
for name in ['package.json','package-lock.json','next.config.mjs','tsconfig.json','next-env.d.ts']:
    shutil.copy2(web/name,stage/name)
for name in ['src','public']:
    shutil.copytree(web/name,stage/name,ignore=shutil.ignore_patterns('downloads') if name=='public' else None)
if os.name=='nt':
    subprocess.run(['cmd','/c','mklink','/J',str(stage/'node_modules'),str(web/'node_modules')],check=True)
else:(stage/'node_modules').symlink_to(web/'node_modules',target_is_directory=True)
env={**os.environ,'CADENCELAB_DESKTOP_EXPORT':'1'}
subprocess.run(['node',str(web/'node_modules/next/dist/bin/next'),'build'],cwd=stage,env=env,check=True)
source=stage/'.next-desktop'
assert (source/'index.html').is_file()
target=ROOT/'build/desktop/frontend'
if target.exists():shutil.rmtree(target)
shutil.copytree(source,target)
print('Desktop frontend staged without touching the active web output.')
