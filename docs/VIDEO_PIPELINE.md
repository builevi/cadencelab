# Uploaded video pipeline — 07/11/2026

Previous blocker was missing implementation: CFI accepted precomputed arrays only. This milestone adds actual local decoding, audio/video signals, local speech recognition, transcript-based semantic estimation, upload jobs and UI.

## Run

```sh
uv sync --locked --extra media --group dev
uv run python scripts/prepare_video_models.py
uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

The one-time preparation downloads the public multilingual faster-whisper tiny model into ignored `.sociallens/models/faster-whisper-tiny`. It has been downloaded on this machine. Subsequent analysis uses local files only and does not auto-download a model during a request. CPU/int8 inference, two ASR threads. Audio stays on this machine; the recognized text is sent to logged-in Codex for semantic ratings. No audio API key is required. Without optional `media` dependencies or model files, measured AV signals remain available with an explicit missing-ASR status and no composite CFI.

## UI / API

Open `http://localhost:3000/?tab=cfi`, use **Đọc video của anh**, select MP4/MOV/WebM and click **Phân tích video**. Optional language is auto/vi/en. No feature arrays required. Results identify uploaded-video origin separately from built-in synthetic presets. The transcript can be opened for review.

`POST /api/v1/videos/jobs` is multipart form with `file` and optional `language`. It returns 202 and relative status/result/events URLs. GET the result after completed. Status/progress and cancel endpoints mirror report-job conventions. Video jobs use a separate SQLite database next to the report database (`jobs.videos.sqlite3`) and a single local worker with lease heartbeat. Existing report/engine endpoints are preserved.

Limits: 25 MiB per file, approximately 60 seconds at the 4 fps sampling resolution, up to 20 stored active uploads. The Next development proxy body limit is 32 MB to allow multipart overhead. No platform URL or caller-supplied local path is accepted. FFmpeg demuxers are restricted to MOV/MP4 and Matroska/WebM with file/pipe protocols; decoder errors are not reflected with original filenames or raw command output. This is still a local, unauthenticated development service, not a hardened public upload service or resource-isolated media worker. Multipart parsing occurs before handler-level size validation; enforce gateway limits before public deployment.

Originals have server-generated filenames, mode 600, and are removed after success/failure or logical cancellation. Transcripts, derived signals and analysis are retained in the local job database. Crash recovery may repeat inference. A process crash during upload before job creation can leave an orphan; no periodic orphan sweeper is implemented yet. Cancellation prevents result publication but does not guarantee interrupting in-flight FFmpeg/ASR/Codex work.

## Feature protocol and honest scope

- Decode at 4 fps to 96×54 grayscale; group into 0.5-second windows. Visual signal is mean absolute pixel difference / 40, clipped to [0,1]. This detects image changes, including motion and lighting; it is not an optical-flow or video-quality measurement.
- Decode audio to mono 16 kHz float samples. Audio signal is positive spectral flux of unit-L2 magnitude spectra (512-sample Hann window, 256-sample hop), scaled by a fixed 1.5 and averaged into 0.5-second windows. No per-video min-max normalization. Absence of an audio track is represented explicitly and has measured audio activity 0.
- faster-whisper tiny returns approximate words, timestamps and probabilities. VAD and ASR can miss quiet/overlapping speech, music, accents or hallucinate words. User should verify the transcript; multilingual support is not proof of Vietnamese accuracy. Smoke verification below uses English synthetic speech only.
- Assign each recognized word to the 0.5-second window containing its midpoint. Codex estimates spoken information density using fixed verbal anchors, with exact ASR-text quotes checked for every nonempty window. Empty spoken windows have 0 spoken density. This DOES NOT mean they have no visual information.
- The existing CFI engine runs only when supported transcript-based ratings are available. Raw AV features are kept even when speech/semantic evidence is absent or invalid. A silent visual storytelling clip is returned as partial, without invented semantic values or composite CFI.

These fixed scales and model ratings are explicit heuristic choices, not trained/calibrated mappings. The resulting CFI is conditional on spoken transcript scope. Do not compare it to ground-truth retention, infer a weak hook/distribution restriction from it, or treat its grade as predicted virality. OCR, visual meaning, scene understanding, optical flow, and retention calibration remain pending.

## Real verification

`uv run python scripts/smoke_video_upload.py` tested actual multipart upload through FastAPI TestClient, queued worker, FFmpeg, local ASR, real Codex app-server and persisted result. Fixture is a generated test pattern with macOS synthesized English speech, not a creator's real video.

Observed: 26-second clip, 61 recognized words, 52 CFI slices, completed semantic estimation, original removed. Total 24.22 seconds in this one run. This is not a performance benchmark or real-world accuracy evaluation. Evidence: `docs/research/video-upload-live-check.json`, `docs/research/video-upload-result.synthetic.json`.

Automated suite: 74 tests passed, including actual encoded media decoding, no-audio video, corrupt media, length limit, missing ASR, forged semantic quotes, upload size/empty files, cleanup/cancel and regression tests. Frontend TypeScript check passed. Browser verified the new upload UI, but automated file selection was blocked by the Chrome extension's file-URL permission; the browser submit→result path has not yet been independently verified. Backend multipart→result was verified separately as described above.

The manual smoke script expects `/private/tmp/sociallens-video-voice.aiff`, generated by a local speech synthesizer. It invokes real Codex usage when explicitly run; do not put it in CI.

Sources: https://github.com/SYSTRAN/faster-whisper and https://github.com/imageio/imageio-ffmpeg.
