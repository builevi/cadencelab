# Codex local AI workflow — 07/11/2026

Implemented for local development using the installed `codex app-server --stdio` JSON-RPC protocol and its existing ChatGPT login. This does not turn the current desktop chat into an API and does not require extracting or copying OAuth credentials. App-server remains experimental; this is not the production inference architecture.

Official protocol reference: https://learn.chatgpt.com/docs/app-server

## Running

```sh
codex login status
uv sync --locked --extra media --group dev
SOCIALLENS_AI_PROVIDER=codex_local uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

`codex_local` is also the temporary default when `SOCIALLENS_AI_PROVIDER` is unset. This selector is read from the process environment, not `.env.local`. No global Codex configuration was changed. Preserve the existing user login; if it expires, run `codex login` normally.

All current structured text inference goes through `services/providers.py`. Available modes:

| Value | Behavior |
| --- | --- |
| `codex_local` | Route directly to local Codex; skips GitHub Models |
| `github_models` | Use the prior GitHub adapter only |
| `github_then_codex` | On a GitHub request/schema/evidence failure, try Codex local and record fallback reason |

Default report `analysis_mode` remains `statistics` for compatibility. Set `analysis_mode: "semantic"` to invoke AI. Existing `language: "vi"` or `"en"` applies. This report route does not perform media extraction. A separate uploaded-video route now supports local transcription and transcript-scoped CFI: see VIDEO_PIPELINE.md. Embeddings and editorial remix remain pending.

## Data flow

1. POST `/api/v1/reports/jobs` persists the normalized request with the existing idempotency key handling.
2. Local SQLite report worker claims the job and maintains its lease heartbeat.
3. Python computes quantitative statistics and relative-view cohorts.
4. For semantic mode, provider selector routes all eight modules in one structured request per channel to Codex local. Up to 20 source posts / 18,000 text characters, with single-video target prioritized.
5. A process-wide slot permits one local Codex inference at a time; other callers wait up to 180 seconds. This is not a cross-process/distributed lock: run one API worker for this development adapter.
6. The adapter starts an isolated ephemeral thread through initialize → thread/start → turn/start. It uses a temporary working directory, read-only sandbox, disabled shell/app/plugin/browser/MCP surfaces and never automatically grants interaction requests. Provider credentials are excluded from child environment. No source text is interpolated into a shell command.
7. Structured output must match `ModuleBatch`; exact source quotes/post IDs and transcript/ad evidence types are checked again before publication.
8. Result retains measured statistics even if AI is unavailable. Response contains actual provider/model, module statuses and fallback reason if applicable. SSE and polling retrieve the same durable job.

Per-inference timeout is 180 seconds, plus up to 180 seconds waiting for the process-wide slot. Multi-channel jobs can exceed these times in total. Poll until terminal status or use SSE, reconnecting at its 60-second boundary; a three-second frontend polling window is insufficient. Individual channels are processed sequentially.

Cancellation currently prevents the worker publishing a later result; it does not guarantee aborting an already-started Codex turn. Crash recovery can re-run an inference, consuming usage again. The existing job key deduplicates submissions, not external provider calls after a crash.

The local machine must remain awake, logged in and have available Codex usage. Child stdout/protocol text is kept in memory for validation, stderr is suppressed; no credentials or provider error bodies are written to logs. Temporary cwd is removed. Ephemeral threads are requested, but this is not a promise of zero provider-side retention. Existing account/workspace requirements still apply. Only use this unauthenticated backend on loopback for development.

## Verified real run

Executed `uv run python scripts/smoke_codex_local.py` through the actual SQLite worker and actual logged-in Codex app-server. Fixture captions are synthetic, not collected TikTok data.

- Elapsed: 26.4 seconds.
- Job and semantic status: completed.
- Provider: codex_local. Reported model: gpt-6.1-sol (inherited from existing Codex configuration; no model override).
- Eight modules: six analyzed, transcript_analysis and ad_strategy correctly returned insufficient_evidence for empty source fields.
- Schema and exact evidence validation passed before the result was persisted.

Artifacts: `docs/research/codex-local-live-check.json`, `docs/research/codex-local-report.synthetic.json`. This is one functional verification, not a benchmark or validation of the marketing interpretations.

Automated regression log: `docs/research/codex-local-tests-2026-11-07.txt`. Includes fake transport, timeout/disconnect, explicit refusal of interactive requests, early event preservation, queue lock/release, provider selection, fallback on failed schema/source evidence, report/CSV/SSE and quantitative algorithm regressions. Tests do not silently invoke real Codex.

The manual smoke script invokes real inference when explicitly run. Do not run it automatically in CI.
