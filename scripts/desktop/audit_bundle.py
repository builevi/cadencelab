"""Check deliverable contents without printing project secret values."""
from pathlib import Path
import hashlib
import json
ROOT=Path(__file__).resolve().parents[2]
app=ROOT/'release/mac-arm64/CadenceLab.app'
secrets=[]
for name in ['.env','.env.local']:
    path=ROOT/name
    if path.is_file():
        for line in path.read_text().splitlines():
            if '=' in line:
                key,value=line.split('=',1)
                value=value.strip().strip('\"\'')
                if any(label in key.upper() for label in ['KEY','TOKEN','SECRET']) and len(value)>12:secrets.append(value.encode())
forbidden=[];found=[];files=0
for path in app.rglob('*'):
    if path.is_symlink() or not path.is_file():continue
    files+=1
    if path.suffix in ['.zip','.gz','.tar'] and path.relative_to(app).as_posix()!='Contents/Resources/backend/_internal/base_library.zip':
        raise SystemExit('Distribution audit failed: unexpected nested archive')
    if path.name in ['.env','.env.local','auth.json','ai-settings.json','jobs.sqlite3'] or path.suffix in ['.sqlite3','.db']:forbidden.append(str(path.relative_to(app)))
    if secrets:
        overlap=max(map(len,secrets))-1
        tail=b''
        with path.open('rb') as stream:
            while data:=stream.read(4*1024*1024):
                block=tail+data
                if any(secret in block for secret in secrets):found.append(str(path.relative_to(app)));break
                tail=block[-overlap:]
if forbidden or found:raise SystemExit('Distribution audit failed: unexpected private configuration/content')
version=json.loads((ROOT/'apps/desktop/package.json').read_text())['version']
dmg=ROOT/f'release/CadenceLab-{version}-mac-arm64.dmg'
with dmg.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
result={'app_files_checked':files,'private_config_files':0,'project_secret_matches':0,'dmg_bytes':dmg.stat().st_size,'dmg_sha256':digest}
(ROOT/'docs/research/desktop-distribution-audit.json').write_text(json.dumps(result,indent=2))
(dmg.with_suffix('.dmg.sha256')).write_text(digest+'  '+dmg.name+'\n')
print(json.dumps(result))
