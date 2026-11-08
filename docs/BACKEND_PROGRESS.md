> 08/11/2026: đã sửa luồng nhập link không còn điều hướng sang fixture, thêm source-bound jobs, viewer dùng kết quả thật và đồng hồ có resume. Thu thập link công khai là best-effort; lượt thử profile TikTok chưa thành công và đã báo lỗi rõ, không dùng mẫu thay thế. Xem [SOURCE_REPORTS_2026-11-08.md](SOURCE_REPORTS_2026-11-08.md).

> Đã bổ sung đọc video upload ngày 07/11/2026: FFmpeg → tín hiệu hình/âm → ASR local → Codex đánh giá lời nói → CFI. Đã kiểm chứng clip giọng máy 26 giây, 61 từ, 52 mốc. Xem [VIDEO_PIPELINE.md](VIDEO_PIPELINE.md). Chưa đọc ý nghĩa hình ảnh/chữ trong khung hình hoặc tự tải từ link mạng xã hội.

> Mốc mới 07/11/2026: đã nối Codex local qua app-server và chạy một job AI thật thành công (26.4 giây, dữ liệu mẫu). Xem [CODEX_LOCAL_WORKFLOW.md](CODEX_LOCAL_WORKFLOW.md). Các ghi chú GitHub chưa chạy được phía dưới là tình trạng adapter GitHub riêng.

> Cập nhật 07/11/2026: đã bổ sung pipeline báo cáo ba phần, adapter GitHub Models có kiểm tra schema/trích dẫn, nhập CSV, danh sách/hủy job và heartbeat. Xem [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) để lấy contract hiện tại và giới hạn. GitHub Models chưa trả kết quả inference hợp lệ khi gọi thật; phần AI chưa được xác nhận chạy live. Nội dung dưới đây là mốc local 04/11 để đối chiếu.

# Backend SocialLens Pro — cập nhật 04/11/2026

Đã triển khai luồng báo cáo chạy local với dữ liệu do caller cung cấp, dựa trên các nhu cầu chức năng quan sát từ đối thủ. Chưa phải SaaS production hoàn chỉnh. Không sao chép mã đối thủ vào implementation.

## Những phần hoạt động

- Nhận dữ liệu chuẩn hóa cho TikTok, Facebook, Instagram, YouTube, với post URL, ngày đăng, thời điểm đo, định dạng, độ dài và metric.
- Bốn loại report: `channel`, `single_video`, `comparison`, `merge`. Single video cần các bài cùng kênh làm bối cảnh so sánh. Comparison và merge giữ riêng metric theo kênh/nền tảng.
- Tổng số liệu có ghi số bài thiếu metric. Không biến giá trị chưa biết thành 0; engagement chỉ tính khi đủ likes/comments/shares và views > 0.
- Cờ video kém hiệu quả: views < 0.5 × trung vị ít nhất 5 bài khác cùng kênh, format, bucket độ dài, bucket tuổi bài; thời điểm chụp metric cách nhau tối đa 24 giờ. Đây là heuristic mô tả, không là kết luận nguyên nhân flop. Buckets tuổi: <24h, 1–3d, 3–7d, 7–30d, >=30d; độ dài: <30s, 30–60s, 60–180s, >=180s. Cần đánh giá độ nhạy/ngách trước khi dùng để quyết định ngân sách.
- Job lưu trong SQLite, worker local chạy trong lifespan FastAPI; trạng thái queued/running/completed/failed. Request có thể gửi `Idempotency-Key`; dùng lại key với payload khác trả 409. Tranh chấp cùng key được serialize bằng transaction.
- Worker claim job bằng transaction, có lease 300 giây và tối đa 3 lần phục hồi khi lease hết sau process crash. Kết quả của worker cũ không ghi đè lần chạy mới (attempt fencing). Chưa có heartbeat cho tác vụ dài; chỉ dùng adapter này cho phép tính local có thời lượng ngắn.
- API tiến độ/SSE, kết quả JSON có schema version và nguồn. SSE gửi trạng thái hiện tại, kết thúc ở completed/failed; sau 60 giây yêu cầu reconnect. Không có lịch sử replay sự kiện.
- Khung 8 module báo cáo: phần hoạt động đăng bài có thống kê; phần cần suy luận ngữ nghĩa/transcript/ads trả trạng thái `requires_semantic_analysis` và dữ liệu thiếu, không sinh nhận xét giả.

## Cách chạy và kết nối frontend

Từ root:

```sh
uv sync --locked --group dev
uv run uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

Dữ liệu job mặc định: `.sociallens/jobs.sqlite3` (gitignored); đổi bằng `SOCIALLENS_JOB_DB`. Chỉ chạy local: các route chưa có authentication hoặc tenant isolation, không public server ra Internet.

```sh
curl -X POST http://127.0.0.1:8000/api/v1/reports/jobs \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-local-1' \
  --data-binary @docs/examples/channel-input.synthetic.json
```

Response 202 chứa `status_url`, `events_url`, `result_url`. Frontend poll status hoặc mở EventSource vào events_url, rồi GET result_url khi completed. Unknown job: 404; result chưa hoàn thành: 409; invalid payload: 422. Không truyền `user_id` trong payload local này; bản production cần lấy chủ sở hữu từ phiên xác thực server.

Input mẫu và kết quả tổng hợp được đánh dấu `.synthetic.json` trong `docs/examples/`. Đây là fixture kiểm tra, không phải dữ liệu TikTok thực. Thay `kind` bằng single_video + target_post_id để phân tích một video; comparison/merge cần 2–10 kênh. Schema cụ thể xem OpenAPI `/docs`.

## Kiểm thử

`uv run python -m unittest discover -s tests -v`.

Bộ mới kiểm tra: cohort hợp lệ/khác tuổi/khác độ dài/khác thời điểm đo, metric thiếu, schema và duplicate, cả bốn kiểu report; job thật qua TestClient, SSE, serialization xuống DB, idempotency đồng thời, lỗi worker, và phục hồi job hết lease sau restart. Bộ engine trước đó được chạy cùng. Log ở `docs/research/report-pipeline-tests.txt`. Đây là kiểm thử chức năng local bằng dữ liệu tổng hợp, không phải benchmark người dùng thật hoặc load test.

## Phần còn phải triển khai theo plan

1. Collector được phép sử dụng cho từng nền tảng, lưu snapshot lịch sử/provenance; hiện chưa có luồng nhập URL rồi tự thu dữ liệu.
2. Media extraction để cung cấp tín hiệu thật cho CFI; embedding pipeline cho content gaps. Không giả định trường còn thiếu có thể suy ra từ URL.
3. Structured LLM provider/schema/evidence validator và đánh giá chất lượng tám module. Hiện không gọi AI bên ngoài hoặc sử dụng API key.
4. Supabase/Postgres/pgvector và Celery/Redis cho phân phối worker, retry/backoff, cancel, quota và job dài. SQLite/thread hiện là adapter local, không thay cho kiến trúc production.
5. Authentication, tenant isolation, giới hạn chi phí/quyền gói, billing/webhook idempotency, export và quan sát vận hành; frontend do Antigravity phụ trách.

Chưa có cơ sở tuyên bố bản này chính xác hơn hoặc nhanh hơn đối thủ. Những điểm đã cải thiện có thể kiểm tra hiện tại là contract rõ ràng, báo thiếu dữ liệu, baseline tương đối, job bền vững, idempotency và nguồn đi kèm báo cáo.
