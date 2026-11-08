# Link submission and measured report timer — 08/11/2026

## Fixed regression

Landing form previously ignored `channelInput` and only navigated to DossierWorkspace. That workspace always rendered SAMPLE_CHANNEL_REPORT / SAMPLE_SINGLE_VIDEO. Entering a TikTok link therefore looked like a successful analysis but showed LumiDerm fixture content.

Landing Enter and the submit button now create a source-bound report request. Source reports use a separate viewer and never fall back to demo objects. The existing sample viewer has an explicit sample banner and is accessible through a separate “Xem báo cáo mẫu” action. Landing input starts empty rather than with a fictional TikTok account.

## Backend contract

`POST /api/v1/reports/from-url` with optional `Idempotency-Key`:

```json
{
  "source_url":"https://www.tiktok.com/@account",
  "analysis_mode":"semantic",
  "language":"vi",
  "post_limit":12
}
```

Supports canonical public TikTok channel/video URLs, vm/vt short URLs via validated redirects, YouTube video/Shorts/handle URLs. HTTPS only; no credentials, arbitrary ports, local paths, arbitrary hosts or generic extractor fallback. Unsupported URL returns 422. Existing report-job status/result/cancel endpoints are reused. Job metadata includes canonical `source_url` for source submissions. `created` and terminal `updated` are used for the elapsed clock.

The current collector is best-effort public yt-dlp metadata with no browser cookies, no login, no downloads, no user configuration or external execution hooks. At most 20 posts, 55-second subprocess timeout, 10-second per-request network timeout and no retries. Collection output is captured in temporary files and capped at 8 MB on read. This is not a public-upload/security sandbox or a guaranteed TikTok data provider.

If source returns another video/channel, invalid data or no usable posts, the job fails with a clear message and no result. Unknown metrics remain null. Publication timestamp/duration are required for current cohort logic; rows lacking either are skipped. If only an upload date is available it is represented at UTC midnight; this is a date-granularity assumption, not a known precise posting time. Snapshot is limited to returned posts and cannot claim to represent the entire channel or unique viewers. No transcripts, ads, comments text or CFI scores are inferred from a URL.

Successful results have `data_source: collected_public_snapshot`, source provenance, original post URLs and the existing quantitative/semantic report parts. Frontend verifies the job source and result source before displaying any report. Unknown metrics appear as missing instead of zero. The new viewer consumes actual channel totals/performance and evidence-backed AI modules; it does not reuse the fixture's followers, ads, weekdays or video ideas.

## Timer and recovery

The clock updates at 0.1-second display resolution, anchored to actual job creation and monotonic browser elapsed time while active. Terminal durations use server update timestamps. Five server-driven workflow stages show link validation, collection, quantitative synthesis, semantic analysis and completion. No fabricated countdown, percent animation or promised ETA.

Source URL, idempotency request key and job ID are recorded in the page query for reload/reconnect. Duplicate submission with the same key does not create another job. If polling disconnects, UI says the job may still be running and offers reconnect rather than treating it as successful. Cancellation and a separate demo action are available. Reduced-motion preferences disable the pulse animation; clock announcements are not repeated to screen readers every tenth of a second.

## Verification and actual availability

- 82 Python regression/integration tests passed, including source validation, exact target identity, missing metrics, failed collector, source-bound success, idempotency and no sample fallback. Source success uses controlled fixtures, not claimed live TikTok records.
- Frontend type check and production build passed. Clock formatting/stage/source-normalization helper checks: 10 assertions passed.
- Browser Enter was tested on the actual rebuilt local app with `https://www.tiktok.com/@tiktok`. It created a source job, displayed the measured clock and collection stage, then a clear collection failure. Refresh retained the job and stopped duration. No LumiDerm report appeared.
- Live yt-dlp attempt for that profile failed to extract a secondary user ID. This does not prove the account is private or definitively identify a platform restriction. No live public-profile success is claimed. Reliable platform collection may need a permitted provider/integration; this fix prevents misleading reports while collection remains unavailable.
- Screenshot: `/private/tmp/cadencelab-source-progress.jpg` shows the actual failed-collection state and recorded duration, not a completed TikTok report.

## Running app update

The web server was serving an old production build, not a dev hot-reload server. A production build was created and only the verified CadenceLab Next server in `apps/web` on port 3000 was restarted. Backend reload process remains on port 8000. No Cloudflare worker deployment or global Codex configuration change was performed.

Run `uv sync --locked --extra media --group dev` for the newly locked yt-dlp dependency. Normal development/start instructions otherwise apply.

Primary collector documentation: https://github.com/yt-dlp/yt-dlp.
