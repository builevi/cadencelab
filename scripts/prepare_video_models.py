"""Explicit one-time download of the public multilingual local ASR model."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
from faster_whisper.utils import download_model
path=ROOT/'.sociallens/models/faster-whisper-tiny'
path.parent.mkdir(parents=True,exist_ok=True)
download_model('tiny',output_dir=str(path))
print('Local ASR model prepared:',path.name)
