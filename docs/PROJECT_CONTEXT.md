# CadenceLab (trước đây: SocialLens Pro) - Toàn bộ Bối cảnh Dự án & Lịch sử Đàm luận

> **Tên thương hiệu chính thức (cập nhật 07/11/2026):** **CadenceLab** — Nhấn mạnh thuật toán nhịp độ (`Cadence` / `CFI 0.5s`) và phòng thí nghiệm giải phẫu chiến lược nội dung (`Lab`).
> **Mục đích file này:** Lưu trữ toàn bộ ngữ cảnh sản phẩm, kết quả kiểm chứng kỹ thuật đối thủ (`sociallens.co.in`), trạng thái tối ưu thuật toán (`packages/algo_core`) và các quyết định kiến trúc. Khi mở dự án trong Antigravity hoặc bất kỳ AI Agent nào, đọc file này cùng [`docs/PLAN.md`](PLAN.md) và [`docs/research/OPTIMIZATION_2026-10-31.md`](research/OPTIMIZATION_2026-10-31.md) để nắm trọn vẹn dự án.

---

## 1. Phân tích & Kiểm chứng Thực tế Đối thủ (`https://sociallens.co.in/`)

Qua kiểm tra trực tiếp mã HTML và bundle JavaScript công khai (`/assets/index-B6sriIMl.js`) của `sociallens.co.in` ngày 03/11/2026, kiến trúc và cơ chế hoạt động thực tế của đối thủ đã được xác minh như sau:

### 1.1. Hạ tầng Kỹ thuật (Verified Stack)
* **Frontend:** Khởi tạo từ **Lovable** (`project_id: lovp_79pbfp611n8ts8cqh8va9gkqwy`), sử dụng React + Vite + Tailwind + Shadcn/ui.
* **Database & BaaS:** **Supabase** (`https://agmvryfcqpjrlptftmvc.supabase.co`), truy vấn trực tiếp từ trình duyệt vào các bảng `reports`, `single_reports`, `comp_reports`, `merge_reports`, `demo_reports`, `jobs`, `single_jobs`, `comp_jobs`, `merge_jobs`, `users`, `transactions`, `commissions`, `affiliate_payouts`.
* **Thanh toán:** Tạo mã VietQR qua **SePay** (`https://qr.sepay.vn/img?...`).
* **Xử lý Backend:** 100% các tác vụ phân tích, tải báo cáo, chia sẻ và rút tiền đều gọi qua Supabase Edge Function `n8n-proxy` trỏ tới **21 webhook của n8n** (`https://n8n.sociallens.co.in/webhook/...`), bao gồm:
  - Phân tích kênh: `tiktok_npvq`, `trialv2`, `tttimerange_npvq`, `tiktokhashtag_npvq`, `fb_npvq`, `facebook_trialv2`, `fbtimerange_npvq`, `fb_group_npvq`, `instagram_npvq`, `youtube_npvq`.
  - Phân tích 1 bài/video lẻ: `singletiktok_npvq`, `singletiktok_trial`, `singlefb_npvq`, `singleig_npvq` (truyền `{ user_id, url, model }` từ client).
  - So sánh đối thủ & Gộp đa kênh: `compt_npvq`, `crossmerge_npvq`.
  - Xuất báo cáo (Doc/PDF) & Tiện ích: `download_npvq`, `single_download`, `comp_download_npvq`, `merge_download_npvq`, `eng_download_npvq`, `single_share`, `payout_npvq`, `sociallens-feedback`.

### 1.2. Bản chất "Thuật toán" & Cấu trúc Báo cáo của Đối thủ
Báo cáo của `sociallens.co.in` được chia làm 3 cột JSON (`report_part_1`, `report_part_2`, `report_part_3`), kết hợp **~20% thống kê số học cơ bản** và **~80% LLM Structured Output (chia theo Role/Prompt)**:
1. **`report_part_1` & `quantitative_synthesis` (Thống kê mô tả cơ bản):**
   - Cộng tổng và chia trung bình: `reactions`, `comments`, `shares`, `views`, `save`, `download`.
   - Gom nhóm theo thời gian đăng (`perf_by_weekday`, `perf_by_day`, `perf_by_month`, `perf_by_quarter`, `perf_by_year`), tỷ lệ định dạng (`format_mix`), tần suất đăng (`posting_frequency`), danh sách quảng cáo từ Facebook Ads Library (`ad_archive_id`, `cta_mix`).
   - Với video lẻ: tính `ER` (Engagement Rate), `value_score` (`%`), `viral_score` (`%`), kèm danh sách bình luận (`comment`) và lời thoại (`audio_des` - transcript).
2. **`report_part_2` — `qualitative_analysis` (100% văn bản do LLM sinh theo JSON Schema):**
   - **Với Kênh (`reports`):** Chia thành 8 mục Accordion:
     - `01. Định vị Thương hiệu` (`brand_positioning`)
     - `02. Giọng nói Thương hiệu` (`tone_of_voice`)
     - `03. Khách hàng Mục tiêu` (`target_audience_clues`)
     - `04. Hoạt động & Xu hướng` (`posting_and_trends`: `activity_and_habits`, `growth_trends`)
     - `05. Tuyến Nội dung` (`content_pillars`: LLM đọc caption rồi gom nhóm bài viết, nêu `purpose`, `description`, `performance`, `list`)
     - `06. Công thức Nội dung Text` (`content_structure_analysis`)
     - `07. Công thức Reel` (Tên biến thực tế trong code là `transcript_analysis`: LLM chỉ đọc văn bản lời thoại rồi rút ra 3 mảng chữ `hooks`, `story_structures`, `ctas`)
     - `08. Hoạt động Quảng cáo` (`ad_strategy`: `campaign_objectives`, `creative_analysis`, `ad_angles`)
   - **Với 1 Video lẻ (`single_reports`):** `core_message`, `target_audience`, cấu trúc `hook` / `body` / `cta` (`mechanics`, `psychology`, `structure`, `triggers`) và `audience_reaction` (`sentiment`, `key_topics`).
3. **`report_part_3` (Đánh giá & Gợi ý ý tưởng bởi LLM):**
   - Chấm `{ strengths, weaknesses, actions }` cho 3 mảng: `pillar_eval` (Tuyến nội dung), `formula_eval` (Công thức nội dung), `funnel_eval` (Phễu Marketing).
   - Sinh danh sách ý tưởng mới: `video_ideas` (`[{ title, concept, reason }]`).

### 1.3. Điểm mạnh cần học hỏi & Điểm nghẽn để vượt qua
* **Điểm mạnh của đối thủ (Product Packaging):** Cấu trúc JSON 8 mục và khung đánh giá `Điểm mạnh / Điểm yếu / Hành động` rất trực quan, sát nhu cầu làm báo cáo của Marketer và Agency; có tính năng quét Facebook Ads Library và xuất file `.doc` / `.pdf` song ngữ.
* **Điểm nghẽn kỹ thuật của đối thủ:**
  - Chạy qua chuỗi node `n8n` tuần tự khiến thời gian chờ rất lâu (Frontend phải hardcode ước tính `45 giây/bài` cho TikTok, `40 giây/bài` cho IG/FB Group, `30 giây/bài` cho FB Page).
  - Mục *"07. Công thức Reel"* thực chất chỉ là `transcript_analysis` (đọc chữ lời thoại), hoàn toàn không đo lường tín hiệu hình ảnh (nhịp cắt, chuyển động khung hình) hay âm thanh (nhịp âm lượng, khoảng lặng) theo từng giây.
  - Không có mô hình định lượng khớp chuỗi thời gian lan truyền và không có công cụ đối chiếu câu hỏi nhu cầu của khán giả với độ phủ nội dung hiện tại bằng vector similarity.

---

## 2. Phân công Vai trò (Team Roles)
* **Antigravity (Lead Frontend, Product Packaging & UI/UX):**
  - Chịu trách nhiệm toàn bộ `apps/web/` (Next.js 15 App Router, Tailwind CSS, Shadcn/ui).
  - Áp dụng quy chuẩn thiết kế **Hallmark (Anti-AI-Slop)**: sử dụng 100% Design Tokens (`:root`), cấm tuyệt đối các mẫu giao diện AI rập khuôn (gradient tím-xanh, card-in-card, số liệu ảo), kiểm duyệt bằng `sloplint.mjs`.
  - Xây dựng trọn vẹn bộ Báo cáo Chiến lược 8 phần (Channel / Single Video / Competitor / Cross-channel Merge) kết hợp trực quan hóa 3 Engine định lượng: Timeline chẩn đoán nhịp dựng CFI, Đồ thị khớp chuỗi lan truyền SEIR-F, và Bảng xếp hạng khoảng trống nội dung có dẫn chứng (Demand-Backed Content Gaps).
* **Codex (Lead Backend, Data Pipeline & Algorithmic Engines):**
  - Chịu trách nhiệm toàn bộ `apps/api/` (FastAPI Python 3.12, Celery, Redis) và `packages/algo_core/`.
  - Xây dựng Async Scraper & Structured LLM Pipeline (song song hóa các prompt phân tích 8 phần bằng Pydantic Schema, thay thế hoàn toàn n8n).
  - Phát triển, kiểm thử và duy trì 3 module thuật toán lõi: [`cfi.py`](../packages/algo_core/cfi.py), [`seir_f.py`](../packages/algo_core/seir_f.py), [`content_gaps.py`](../packages/algo_core/content_gaps.py).

---

## 3. Bộ 3 Engine Định lượng (`packages/algo_core`) — Trạng thái sau Tối ưu 31/10/2026

> Chi tiết kiểm chứng toán học và giới hạn thực nghiệm được ghi nhận tại [`docs/research/OPTIMIZATION_2026-10-31.md`](research/OPTIMIZATION_2026-10-31.md) (26/26 bài test tự động đạt chuẩn).

1. **CFI Pacing Diagnostics ([`packages/algo_core/cfi.py`](../packages/algo_core/cfi.py)):**
   - *Bản chất:* Chẩn đoán nhịp dựng video theo từng lát cắt $\Delta t = 0.5\text{s}$ từ 3 tín hiệu chuẩn hóa $[0, 1]$: biến thiên hình ảnh (`visual_motion`), biến thiên âm thanh (`acoustic_flux`), và mật độ ngữ nghĩa (`semantic_density`).
   - *Đặc tính kỹ thuật:* Đạo hàm tính theo giây (`np.gradient(x, time_step)`); bảo vệ các video talking-head (khung hình tĩnh nhưng giàu ngữ nghĩa) khỏi bị phạt nhầm; tách biệt nhãn giai đoạn `stage` (`HOOK` $0-3\text{s}$ vs `BODY`) và nhãn chẩn đoán `zone` (`FLOW`, `BOREDOM_VALLEY`, `OVERLOAD`); gộp các lát cắt liên tiếp thành episode trong `review_points`. Không tự bịa tỷ lệ xem hết (`predicted_completion_rate = None`, `not_calibrated`) khi chưa có mô hình huấn luyện trên retention thực tế.
2. **SEIR-F Conditional Trend Modeling ([`packages/algo_core/seir_f.py`](../packages/algo_core/seir_f.py)):**
   - *Bản chất:* Mô hình phương trình vi phân lan truyền nội dung bảo toàn quy mô dân số $N = S + E + I + R$ kèm biến tích lũy hoạt động $F$.
   - *Đặc tính kỹ thuật:* Hỗ trợ cả chạy kịch bản mô phỏng (`forecast_trend_trajectory`) và **khớp tham số có điều kiện từ dữ liệu thực** (`forecast_from_observations`) trên chuỗi 7–365 ngày quan sát số người đang lan truyền (`daily_active_spreaders`) bằng `scipy.optimize.least_squares` (`soft_l1` loss trên miền $\ln(1+I)$). Trả về tốc độ lây truyền $\beta$, phơi nhiễm ban đầu $E_0$, sai số `training_mae`, `training_log_rmse` và phân pha tức thời (`INACTIVE`, `SURGING`, `PLATEAU`, `DECLINING`) bất biến với độ dài cửa sổ dự báo.
3. **Demand-Backed Semantic Content Gaps ([`packages/algo_core/content_gaps.py`](../packages/algo_core/content_gaps.py)):**
   - *Bản chất:* Truy xuất và xếp hạng khoảng trống nội dung bằng Cosine Similarity trên vector chuẩn hóa L2 giữa danh sách câu hỏi thực tế của khán giả (`unanswered_queries`) và kho bài đăng đã khảo sát (`embeddings`, `cluster_labels`).
   - *Đặc tính kỹ thuật:* Bắt buộc mỗi câu hỏi phải kèm số lượng tín hiệu nhu cầu (`demand_count >= 1`) và URL dẫn chứng (`source_urls`); tự động khử trùng lặp câu hỏi (lấy `max(demand_count)` thay vì cộng dồn); loại bỏ các câu hỏi đã được phủ ($\text{nearest\_similarity} \ge 0.8$) và chấm điểm ưu tiên theo công thức:
     $$\text{Score} = \frac{\text{demand\_count}}{\text{demand\_count} + 20} \times \bigl(1 - \max(0, \text{nearest\_similarity})\bigr)$$

---

## 4. Cấu trúc Dự án Hiện tại
* [`apps/web/`](../apps/web): Thư mục giao diện Next.js 15 (sẵn sàng khởi tạo với quy chuẩn Hallmark).
* [`apps/api/main.py`](../apps/api/main.py): FastAPI `v0.2.0` tích hợp kiểm tra dữ liệu đầu vào nghiêm ngặt (`StrictRequest`, trả về HTTP 422 khi sai định dạng) với 5 endpoint phân tách rõ dữ liệu thực và mô phỏng:
  - `POST /api/v1/cfi/analyze` & `POST /api/v1/cfi/simulate`
  - `POST /api/v1/trend/forecast` & `POST /api/v1/trend/simulate`
  - `POST /api/v1/whitespaces/discover`
* [`packages/algo_core/`](../packages/algo_core): Thư viện thuật toán chuẩn hóa (`cfi.py`, `seir_f.py`, `content_gaps.py`, kèm shim tương thích ngược ở `packages/algo-core/`).
* [`tests/test_algorithms.py`](../tests/test_algorithms.py): Bộ 26 unit & API integration tests.
* [`docs/`](.): Chứa [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`PLAN.md`](PLAN.md) và thư mục nghiên cứu/kiểm chứng [`docs/research/`](research).
