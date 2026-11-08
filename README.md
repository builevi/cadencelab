# CadenceLab

**Chẩn đoán nội dung mạng xã hội có dẫn chứng — bản Web tự host và ứng dụng Desktop.**

CadenceLab giúp người làm nội dung tìm đoạn video cần chỉnh nhịp, đối chiếu hiệu quả bài đăng với nhóm tương đồng và tạo hồ sơ chiến lược có trích dẫn kiểm tra được. Mục tiêu là biến dữ liệu đầu vào thành quyết định biên tập có thể kiểm chứng, không hứa đoán chính xác video viral hay khẳng định shadowban.

## Hai cách sử dụng

- **Desktop (macOS / Windows)**: tải bộ cài đúng hệ điều hành từ [GitHub Releases](https://github.com/builevi/cadencelab/releases). Dữ liệu lưu trên máy, tự cấu hình AI trong Cài đặt. Mục Cập nhật phần mềm kiểm tra bản mới trên Releases. Chỉ các nền tảng có asset thực tế mới tải được.
- **Web tự host**: Next.js frontend + FastAPI backend. Cloudflare Tunnel trỏ về laptop chỉ hoạt động khi laptop/server đó đang chạy. Đưa source lên GitHub không thay thế hosting backend. Xem [triển khai Web](docs/WEB_HOSTING.md).

## Điểm khác biệt trong cách xử lý

Đây là các lựa chọn kỹ thuật của dự án, không phải tuyên bố mọi SaaS khác đều thiếu hoặc thuật toán đã được chứng minh tốt hơn đối thủ.

| Thành phần | Cách làm | Giá trị và giới hạn |
|---|---|---|
| CFI từng 0.5 giây | Kết hợp chuyển động, biến thiên âm thanh và mật độ thông tin lời nói; xét đoạn hook riêng | Chỉ mốc cần xem lại, không suy ra tỷ lệ giữ chân thực tế |
| Cohort Leave-One-Out | Loại bài đang xét khỏi baseline, so bài cùng định dạng và tuổi | Giảm việc một bài tự nâng mốc so sánh; thiếu cohort thì báo thiếu |
| SEIR-F | RK4 bảo toàn dân số, fitting robust trên chuỗi daily active spreaders | Kịch bản có điều kiện, không đổi view thành người lan truyền hoặc xác suất viral |
| Khoảng trống nội dung | Cosine retrieval có nguồn cho nhu cầu, ngưỡng phủ 0.80 | Heuristic xếp ưu tiên trong corpus đã nhập, không tự dựng nhu cầu |
| Báo cáo AI | Schema chặt, kiểm tra quote khớp bài nguồn | Không cho văn bản AI tự trở thành bằng chứng |
| Dữ liệu thiếu | Giữ missing, kiểm tra đầu vào và trả lỗi rõ | Không thay link lỗi bằng báo cáo demo |

[Hướng dẫn Desktop](docs/DESKTOP_APP.md) · [Phát hành và cập nhật](docs/RELEASING.md) · [Kế hoạch](docs/PLAN.md)

## Chạy từ mã nguồn

```sh
git clone https://github.com/builevi/cadencelab.git
cd cadencelab
uv sync --locked --extra media --group dev
uv run --extra media python scripts/prepare_video_models.py
uv run --extra media uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

Terminal khác:

```sh
npm --prefix apps/web ci
npm --prefix apps/web run build
npm --prefix apps/web start
```

Mở http://localhost:3000. Không commit `.env.local`, API key, database báo cáo hay tài khoản Codex. Phần Google đăng nhập trên frontend hiện tại chưa thay thế xác thực và phân quyền API trên server; không triển khai multi-tenant công khai trước khi hoàn thiện lớp này.

## Tình trạng

Bản thử nghiệm. Video file tối đa 60 giây / 25 MiB; ASR và tín hiệu local; chưa OCR/hiểu ngữ nghĩa hình ảnh. Thu thập TikTok công khai có thể bị nền tảng chặn. Codex local cần cài CLI và đăng nhập riêng, vẫn cần Internet; Ollama cần cài dịch vụ/model trước. Các nhà cung cấp cloud cần key/hạn mức riêng. Chưa đo predictive accuracy trên kết quả khán giả ngoài thực tế. Bộ cài hiện chưa có chứng thực phát hành của Apple/Microsoft.

## Chi tiết kỹ thuật và hợp đồng API

Experimental content diagnostics and conditional trend modeling. The engines do
not yet have validated predictive accuracy on real audience outcomes.

## Run

Requires Python 3.12+ and uv. Run from the repository root:

```sh
uv sync --locked --extra media --group dev
uv run uvicorn apps.api.main:app --reload --port 8000
```

Open [interactive API docs](http://localhost:8000/docs). Running
`uv run --project ../.. uvicorn main:app --reload --port 8000` from `apps/api`
is also supported.

```sh
uv run python -m unittest discover -s tests -v
uv run python docs/research/check_algorithms.py
```

## Implemented engines

- `packages/algo_core/cfi.py`: normalized video-feature pacing diagnostics,
  derivatives per second, independent hook/risk labels. No predicted completion
  percentage until an outcome model has been trained and calibrated.
- `packages/algo_core/seir_f.py`: population-conserving SEIR-F scenarios and
  conditional fitting to consecutive daily **active-spreader** counts. Fitting
  beta and initial exposure holds the other parameters fixed; uncertainty and
  real-world accuracy remain uncalibrated.
- `packages/algo_core/content_gaps.py`: cosine retrieval against the supplied
  corpus, ranked using documented demand evidence. This is semantic gap ranking,
  not persistent homology. Evidence URLs are retained, not fetched or verified.
- `packages/algo-core/`: legacy path shims; new code imports `packages.algo_core`.

## API contracts

| POST endpoint | Input | Output |
|---|---|---|
| `/api/v1/cfi/analyze` | JSON: `visual_motion`, `acoustic_flux`, `semantic_density`, optional `time_step` | Pacing diagnostics; no retention forecast |
| `/api/v1/cfi/simulate?video_seconds=15` | Query parameter | Explicitly labeled synthetic demo |
| `/api/v1/trend/forecast` | JSON: `trend_keyword`, `daily_active_spreaders`, optional `days`, `population_size` | Conditional fitted scenario and in-sample fit diagnostics |
| `/api/v1/trend/simulate?days=21` | Query parameter | Explicit scenario with default assumptions |
| `/api/v1/whitespaces/discover` | JSON: `embeddings`, `cluster_labels`, `embedding_model`, `unanswered_queries` | Evidence-backed semantic candidates within the supplied corpus |

CFI features must be finite in [0,1], same length, and extracted with consistent
normalization across videos. One slice is supported. `time_step` is in seconds;
0–3 seconds (excluding 3) are tagged HOOK, independently of diagnostic zone.
`BOREDOM_VALLEY` is a legacy name for **low measured stimulus**, not observed boredom.

Trend input requires 7–365 consecutive observations of daily active spreaders,
starting above zero. This is not cumulative views or daily view counts. `day=1`
means one day after the last observation (or scenario initial state). All priors
and initial-state assumptions are returned. A keyword labels the supplied series;
it does not trigger collection. The API caps future forecasts at 90 days.
`active_virality` is active spreaders / fixed population; `audience_fatigue` is
accumulated active-spreader-days / population, not a probability or measured psychology.

Each demand query contains `query`, `embedding`, positive integer `demand_count`,
and 1–20 `source_urls`. Query and corpus vectors must use the same model/version.
Repeated identical normalized questions use the maximum count, not a sum, to avoid
inflating demand; caller must deduplicate users across different questions.
Questions with nearest cosine similarity >= 0.8 are treated as covered by this
retrieval heuristic. Other candidates score:

```text
(demand_count / (demand_count + 20)) × (1 − max(0, nearest_cosine_similarity))
```

This score is a prioritization heuristic, not success probability. Review nearby
posts to confirm that they actually answer the question. Empty demand returns an
empty list with `missing_demand_data`. Missing corpus is rejected. No 3D coordinates
are fabricated. Payloads are bounded: 2,000 corpus rows, 1,536 dimensions, 200 queries;
CFI allows at most 7,200 slices. Validation failures return HTTP 422.

## Migration from the initial demo

- Canonical Python package changed from `algo-core` to `algo_core` to fix imports.
- `/trend/forecast` now requires a JSON observation series; use `/trend/simulate`
  for the previous scenario-only behavior.
- `/whitespaces/discover` now requires real supplied inputs; it no longer invents
  competitor vectors or audience demand.
- `predicted_completion_rate` is `null`; grades describe pacing only. Hook is a
  separate `stage` field. `critical_drop_points` stays empty; use `review_points`.
  Unvalidated sawtooth targets were removed.
- No cross-origin browser access is enabled by default; add explicit allowed
  frontend origins when a frontend exists. API currently has no authentication
  or collection pipeline and should be run locally.

The original planning documents describe aspirations, not implemented guarantees.
See [initial review](docs/research/ALGORITHM_FEASIBILITY_REVIEW_2026-10-31.md),
[optimization notes](docs/research/OPTIMIZATION_2026-10-31.md), and
[original source snapshot](docs/research/baseline_source_2026-10-31.tar.gz).

## Report pipeline (local, 2026-11-04)

A durable local report pipeline is available at `POST /api/v1/reports/jobs`.
It accepts supplied snapshots for channel, single-video, comparison and merge
reports. Responses include job status, SSE and result URLs. Relative performance
uses leave-one-out peer cohorts; missing evidence remains explicit. SQLite jobs
survive restarts and expired leases can be recovered. This local adapter has no
tenant authentication and must not be exposed publicly.

See [backend progress and integration](docs/BACKEND_PROGRESS.md) and
[synthetic request](docs/examples/channel-input.synthetic.json). Automatic social
collection, semantic provider integration and production Celery/Postgres are
still pending; the report does not invent these results.

Backend integration update (2026-11-07): [API contracts, CSV import, structured semantic pipeline, jobs and provider verification](docs/BACKEND_INTEGRATION.md). GitHub Models did not return valid live inference JSON; quantitative reports remain functional.

Local AI workflow is now available through the logged-in Codex app-server: [setup, provider routing and real smoke-test evidence](docs/CODEX_LOCAL_WORKFLOW.md). Semantic mode uses Codex local by default; statistics-only requests remain unchanged.

Uploaded video analysis: [setup, supported files, methods and verified limits](docs/VIDEO_PIPELINE.md). The UI now accepts MP4/MOV/WebM files; spoken content uses local ASR and Codex. Visual semantics/OCR and automatic downloads from social links remain pending.

Link submission and measured report timer: [source-bound jobs, real-result viewer and live collection limitations](docs/SOURCE_REPORTS_2026-11-08.md). Enter no longer substitutes the LumiDerm sample when a supplied link cannot be read.
