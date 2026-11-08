# Backend integration — 07/11/2026

> Updated: semantic requests now default to the verified local Codex provider. See [CODEX_LOCAL_WORKFLOW.md](CODEX_LOCAL_WORKFLOW.md) for routing, running and the real smoke-test result. The GitHub section below documents the optional legacy provider only.

FastAPI local adapter. Run from repository root:

```sh
uv sync --locked --group dev
uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

Frontend rewrite currently targets port 8000. Frontend connection fix is preserved.
No authentication or tenant isolation yet; bind to loopback for development.

## Report creation and results

`POST /api/v1/reports/jobs`, optional `Idempotency-Key` header. Existing requests remain valid and use `analysis_mode: "statistics"` by default. To request AI modules add:

```json
{"analysis_mode":"semantic","language":"vi"}
```

These fields augment the existing `kind`, `channels`, and optional `target_post_id` payload; the fragment above is not a complete request. `language` is `vi` or `en` and controls generated AI prose. Machine statuses/methodology remain stable English; this is not yet bilingual export rendering.

Each post can additionally include:

```json
{
  "transcript":"Actual supplied transcript, if available",
  "ad_text":"Actual ad creative text, only if evidenced",
  "audience_comments":[{"text":"Original comment text","url":"https://example.com/comment/1"}]
}
```

Do not infer transcripts, comments, ad status or unavailable metrics from a post URL. Text across the report is capped at 2 million characters. Existing platform/date/cohort validation still applies.

Creation returns 202 and relative `status_url`, `events_url`, `result_url`. GET result continues returning the report object directly. Existing `channels[].performance` stays available. New additive fields:

- `analysis_mode`, `language`, `semantic_status`: `not_requested`, `completed`, `partial`, `unavailable`. `completed` means module requests were handled; modules may individually have insufficient evidence.
- `channels[].semantic_analysis`: provider/model, sample size and strategy, eight modules. Module statuses: `analyzed`, `insufficient_evidence`, `unavailable`. Findings have `text` and evidence `post_id`, `field`, `quote`.
- `report_parts.report_part_1.quantitative_synthesis`: per-channel totals, measured periods, UTC posting distribution, cohort performance.
- `report_parts.report_part_2.qualitative_analysis`: per-channel modules. Statistics-only reports retain `requires_semantic_analysis` placeholders.
- `report_parts.report_part_3.evaluations`: low-baseline post URLs/ratios, suggested evidence collection, count of insufficient baselines. `video_ideas` is currently empty with `requires_editorial_generation`; remix generation is pending.

AI module IDs: brand_positioning, tone_of_voice, target_audience_clues, posting_and_trends, content_pillars, content_structure_analysis, transcript_analysis, ad_strategy.

LLM evidence validator requires exact quotes present in the bounded source sample and known post IDs, checks module coverage and schema, and restricts transcript/ad claims to matching source fields. It validates source linkage, not the truth or causal validity of the interpretation; review generated prose before relying on it. Captions/comments/transcripts are treated as untrusted input. Quantitative scores stay deterministic.

## Import real snapshots

`POST /api/v1/reports/imports/csv` accepts JSON, without multipart upload:

```json
{
  "channel_id":"channel-1",
  "channel_name":"Example channel",
  "platform":"tiktok",
  "channel_url":"https://www.tiktok.com/@example",
  "analysis_mode":"statistics",
  "language":"vi",
  "csv_text":"id,url,published_at,observed_at,format,duration_seconds,views\np1,https://example.com/p1,2026-01-01T00:00:00Z,2026-02-01T00:00:00Z,short_video,30,100\n"
}
```

This is a synthetic illustration. Use actual source exports normalized to these headers. Required columns: id,url,published_at,observed_at,format. Optional: duration_seconds,views,likes,comments,shares,caption,transcript,ad_text. Video rows require duration_seconds. Unknown metrics must be blank, never filled with zero. Dates require explicit timezone. UTF-8 BOM, commas/newlines in quoted fields work. Up to 1000 rows; duplicate IDs, mismatched columns, invalid dates, non-integer/negative metrics rejected with 422. CSV import creates a job with the same result/SSE contract. This is not a native-format TikTok export mapper or automated collector.

## Jobs and recovery

- `GET /api/v1/reports/jobs?limit=50&offset=0`: newest jobs, max 100.
- `POST /api/v1/reports/jobs/{id}/cancel`: logical cancellation for queued/running jobs, idempotent. Completed/failed jobs retain their result/status. Unknown IDs return 404.
- SSE ends at completed/failed/cancelled. Reconnect after 60 seconds to retrieve current durable state.
- Worker progress updates at deterministic/semantic/final assembly stages. Lease heartbeat every 20 seconds; 300-second lease, up to three crash recovery attempts, fenced writes.
- Cancellation prevents publishing a later result; it cannot abort in-flight external requests or guarantee zero further upstream token use.

## GitHub Models provider

Environment variables override the ignored root `.env.local` file. The supplied credential was saved only in that file with mode 600. Do not copy it into frontend bundles, source, diagnostics or shared artifacts. `.env.example` contains no secret.

Adapter uses fixed HTTPS `models.github.ai/inference/chat/completions`, no redirects, 45-second request timeout, three attempts for transport/429/5xx errors with capped backoff. AI is opt-in per report. A report makes three grouped calls per channel with concurrency two, up to 20 source posts / 18,000 source text characters; single-video requests prioritize the target. Partial module failures preserve quantitative results. Model output token cap is 3000 per call. Source data is sent to the provider when semantic mode is selected; use permitted input data.

**Live verification 07/11/2026:** catalog and inference endpoint each returned HTTP 200, Content-Type text/plain, body `OK`, not catalog or completion JSON. No actual generated result received. Official GitHub documentation says the service was retired on 30/07/2026: https://docs.github.com/en/github-models. Consequently this adapter is implemented/tested with mocks but not validated for live inference. It fails visibly as `provider_invalid_output` rather than fabricating insights. The HTTP result does not validate token permissions.

## Remaining plan dependencies

Automatic platform collectors and snapshot storage; video/audio feature extraction; embeddings and question extraction; editorial remix generation; PDF/DOCX export; Postgres/Supabase + Redis/Celery distributed workers; authentication/tenant isolation/quotas; payment webhooks. Current SQLite adapter is a local milestone, not a completed production SaaS. Live text inference is now verified through Codex local; GitHub Models remains optional and unverified.

## Verification

`uv run python -m unittest discover -s tests -v`. Regression and integration log: `docs/research/backend-pipeline-tests-2026-11-07.txt`. Tests use synthetic input and mocked AI/network responses; they establish functional behavior, not marketing insight accuracy or production load capacity.
