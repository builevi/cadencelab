"""Fetch official builder assets through GitHub's API and verify pinned checksums."""
from pathlib import Path
import hashlib
import json
import tarfile
import urllib.request
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[2]
items=[('icons@1.2.3','icons-bundle.tar.gz','4e5bb546c9d3ab0c2bbacc22857467bf415f742a34c2be9dd138779d2fc066f9')]
for tag,name,expected in items:
    request=urllib.request.Request('https://api.github.com/repos/electron-userland/electron-builder-binaries/releases/tags/'+quote(tag,safe=''),headers={'User-Agent':'CadenceLab-build'})
    with urllib.request.urlopen(request,timeout=30) as response:release=json.load(response)
    asset=next(a for a in release['assets'] if a['name']==name)
    request=urllib.request.Request(asset['url'],headers={'Accept':'application/octet-stream','User-Agent':'CadenceLab-build'})
    directory=ROOT/'build/toolsets'/tag.replace('@','-');directory.mkdir(parents=True,exist_ok=True)
    archive=directory/name
    with urllib.request.urlopen(request,timeout=120) as response,archive.open('wb') as output:
        while chunk:=response.read(1024*1024):output.write(chunk)
    with archive.open('rb') as stream:actual=hashlib.file_digest(stream,'sha256').hexdigest()
    if actual!=expected:raise SystemExit('Official builder asset checksum mismatch')
    with tarfile.open(archive) as tar:tar.extractall(directory,filter='data')
    print('Verified toolset:',tag)
