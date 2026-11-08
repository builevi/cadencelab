"""Launch the packaged app with an isolated profile and verify its own startup proof."""
from pathlib import Path
import json,os,subprocess,tempfile,sys
ROOT=Path(__file__).resolve().parents[2]
executable=ROOT/('release/win-unpacked/CadenceLab.exe' if sys.platform=='win32' else 'release/mac-arm64/CadenceLab.app/Contents/MacOS/CadenceLab')
with tempfile.TemporaryDirectory(prefix='cadencelab-app-smoke-') as directory:
 result=subprocess.run([str(executable)],env={**os.environ,'CADENCELAB_USER_DATA':directory,'CADENCELAB_SMOKE':'1'},timeout=120)
 assert result.returncode==0,'Packaged app failed'
 proof=json.loads((Path(directory)/'smoke-result.json').read_text())
 assert proof['packaged'] and proof['backendReady'] and 'CadenceLab' in proof['uiTitle']
 print(json.dumps(proof))
