# Đánh giá thuật toán SocialLens Pro và khả năng ứng dụng thực tế

> Báo cáo lịch sử của bản trước tối ưu. Mã hiện tại đã được cập nhật theo `OPTIMIZATION_2026-10-31.md`. File `algorithm_probe_results.json` giữ nguyên bằng chứng ban đầu; `check_algorithms.py` hiện kiểm tra bản mới và xuất `optimized_probe_results.json`. Mã gốc được lưu trong `baseline_source_2026-10-31.tar.gz`.

Ngày kiểm tra: 31/10/2026. Phạm vi: toàn bộ 7 file ban đầu trong checkout này, nghiên cứu nguồn gốc và chạy probe trên mã Python hiện có. Không đánh giá một hệ thống đã triển khai hoặc dữ liệu chưa nằm trong thư mục này.

## 1. Kết luận để quyết định sản phẩm

**Ý tưởng sản phẩm có thể triển khai, nhưng ba engine hiện tại chưa đủ cơ sở để cung cấp dự đoán thực tế cho khách hàng.** CFI là công thức heuristic chưa được học hoặc hiệu chuẩn bằng retention thật; SEIR-F là mô phỏng động lực học chưa gắn lịch sử trend; TDA hiện là khoảng cách giữa tâm cụm, chưa thực hiện persistent homology. Tên gọi và mô tả trong README/PLAN đang mạnh hơn chức năng thực tế.

| Thành phần | Mã hiện có thực sự làm gì? | Ứng dụng phù hợp | Quyết định đề xuất |
|---|---|---|---|
| CFI | Cộng trọng số biến thiên hình/âm thanh và ngữ nghĩa, trừ penalty, qua sigmoid | Đánh dấu đoạn ít thay đổi để biên tập viên xem lại | Giữ hướng phân tích video; chưa cung cấp xác suất xem hết |
| SEIR-F | Giải ODE với tham số và trạng thái đầu cố định | Khám phá các kịch bản lan truyền giả định | Giữ như mô hình nghiên cứu; chưa dùng để quyết định thời điểm đăng hoặc ngân sách |
| TDA | Đo khoảng cách Euclid giữa tâm cụm; đề xuất giao điểm chủ đề | Sinh giả thuyết nội dung để kiểm tra | Làm demand–supply gap trước; chỉ thêm TDA nếu chứng minh có ích |

Không tìm thấy dataset, nhãn retention, benchmark, mô hình đã huấn luyện, scraper hoạt động, dependency manifest hoặc frontend trong các file hiện có. Các thư mục được mô tả trong tài liệu không phải bằng chứng các chức năng ấy đã triển khai. Không có cơ sở trong checkout này để xác nhận mức độ độc quyền hoặc tính mới học thuật của ba tên thuật toán.

## 2. CFI: phân tích nhịp dựng khả thi, dự đoán retention chưa được chứng minh

**Bằng chứng mã:** `packages/algo-core/cfi.py:63–84, 87–98, 119–141`; dữ liệu demo được sinh ngẫu nhiên tại `apps/api/main.py:50–58`.

Các feature về chuyển động, âm thanh, lời nói và chữ trên video có thể phục vụ việc phát hiện khoảng lặng, nhịp cắt hoặc mật độ nội dung. Tuy nhiên, mức biến thiên lớn không tự động đồng nghĩa với người xem hài lòng hay xem lâu. YouTube mô tả hệ thống xét hành vi lựa chọn, thời lượng xem, mức hài lòng và cá nhân hóa; không xác nhận một nhịp dựng hoặc dạng sóng răng cưa tối ưu chung. Đây là lý do không thể suy từ motion/audio sang retention bằng một hệ số duy nhất. [Nguồn 1, 2]

Các lỗi và giới hạn đã xác định:

1. **Nhánh cảnh báo nhàm chán không thể đạt tới với đầu vào chuẩn hóa [0,1] và cấu hình mặc định.** Khi đó penalty ≤ 1, các số hạng còn lại không âm, nên raw ≥ −0.4; sigmoid(3 × raw) ≥ 0.231475. Ngưỡng nhàm chán là 0.20. Do vậy `boredom_valleys_count` luôn bằng 0 trong miền này và hạng F không thể xuất hiện.
2. **Probe đầu vào 30 lát cắt toàn 0:** hạng B, dự đoán xem hết 18.9%, không có điểm rơi. Đây là lỗi logic phân loại; không phải số đo hành vi người xem.
3. **`predicted_completion_rate = mean(scores) × 82`.** Không có quá trình fit, nhãn mục tiêu hoặc lý do thực nghiệm cho hệ số 82. Kết quả bị chặn trên bởi 82%; không phải xác suất đã hiệu chuẩn.
4. **Đạo hàm không chia theo `time_step`.** `np.gradient(series)` tính theo khoảng cách chỉ số; đổi `time_step` chỉ đổi timestamp, không đổi score. Công thức được mô tả là đạo hàm theo giây nhưng code chưa làm như vậy.
5. **HOOK che các nhánh cảnh báo trong 0–3 giây:** zone được gán HOOK trước khi xét overload/boredom. Nhãn giai đoạn và nhãn rủi ro nên là hai trường riêng.
6. Dãy rỗng hoặc một phần tử gây `ValueError`; chưa kiểm tra cùng độ dài, finite, miền giá trị. Pipeline OpenCV/audio/transcript để tạo các feature thật chưa có trong checkout.

**Ứng dụng trước mắt:** timeline các dấu hiệu đo được như cảnh đứng yên, khoảng lặng, tốc độ nói/chữ. Gợi ý nên là “đoạn cần xem lại”, kèm feature và timestamp; chưa gọi là “điểm chắc chắn rớt người xem”. Video nói chuyện ít chuyển động vẫn có thể hấp dẫn nếu nội dung phù hợp.

**Nếu phát triển dự báo:** thu dữ liệu video và analytics được chủ kênh cho phép; định nghĩa rõ xem hết, watch time, hoặc retention tại mốc; thêm độ dài, thể loại, ngôn ngữ, nền tảng và bối cảnh kênh. So sánh baseline theo kênh/độ dài với mô hình có feature đa phương thức. Tách tập kiểm tra theo thời gian và kênh, tránh các bản reupload nằm ở cả train/test. Đánh giá sai số và calibration, không chỉ tương quan. Muốn khẳng định chỉnh video giúp tăng retention cần thử nghiệm có đối chứng; mô hình dự báo tốt chưa chứng minh quan hệ nhân quả.

**Nút thắt dữ liệu:** YouTube Analytics có báo cáo retention và yêu cầu quyền chủ kênh. Vì vậy không thể mặc định lấy retention thật của mọi đối thủ từ một URL công khai. Độ phân giải nhãn cũng phải kiểm tra; slicing feature 0.5 giây không tạo ra ground truth 0.5 giây. Audience watch ratio có thể vượt 1 do xem lại, nên không được coi mọi giá trị là xác suất sống sót và clip tùy tiện. Các nền tảng khác cần kiểm tra quyền và metric riêng trước khi cam kết hỗ trợ. [Nguồn 3, 4]

## 3. SEIR-F: có nền tảng mô hình hóa lan truyền, thiếu bước biến thành dự báo

**Bằng chứng mã:** `packages/algo-core/seir_f.py:36–59, 69–98`; API `apps/api/main.py:69–78`.

Nghiên cứu diffusion cho thấy cả phát sóng từ nguồn lớn và truyền lan nhiều thế hệ cùng góp phần tạo độ phổ biến. Goel và cộng sự chỉ ra cấu trúc lan truyền rất đa dạng; mô hình contagion đơn giản không tái hiện hết các đặc trưng quan sát. SEISMIC là ví dụ mô hình point process sử dụng lịch sử reshare để dự báo cascade, đã kiểm tra trên dữ liệu Twitter. Kết quả đó không xác nhận SEIR-F này, cũng không tự chuyển thành độ chính xác trên TikTok, Facebook hoặc YouTube. [Nguồn 5, 6]

Các vấn đề cụ thể:

1. **Keyword không tham gia tính toán.** API chỉ phản hồi lại chuỗi nhập. Cùng `days` thì hai keyword bất kỳ nhận cùng trajectory. Không có ingest lịch sử, fit tham số hoặc ngày quan sát cuối.
2. **Sai trạng thái đầu:** S0 = N − I0, E0 = 2I0, I0 = I0. Tổng S+E+I+R = N+2I0; mặc định là 1,000,200 thay vì 1,000,000. Hệ ODE bảo toàn tổng được khởi tạo sai này.
3. **Lệch lưới thời gian:** `linspace(0, days, days)` với 21 điểm tạo bước 1.05 ngày; đầu ra lại gắn ngày 1…21, trong khi điểm đầu ở t=0. Phải quyết định rõ bao gồm hiện tại hay chỉ dự báo tương lai.
4. **Chuẩn hóa theo cực đại của chính khoảng dự báo.** Probe cùng trạng thái ngày đầu: active_virality 0.063 khi chọn 7 ngày và 0.001 khi chọn 60 ngày. Chỉ số này có ý nghĩa tương đối trong cửa sổ mô phỏng, không phải độ viral tuyệt đối để so giữa các báo cáo.
5. Pha trend dựa vào vị trí index so với argmax trong cửa sổ. Nếu cực đại nằm ở biên phải, chưa đủ cơ sở gọi đó là đỉnh thật. Pha PEAK chỉ được gán sau index cực đại, còn đúng index cực đại lại là SURGING.
6. `F` là trạng thái ẩn tích lũy từ I, chưa phải phép đo người dùng đã chán. Comment công thức dùng alpha×F, còn code dùng alpha×F/N; cần nhất quán định nghĩa và đơn vị. Tham số beta hiện là hằng số dù tài liệu nói beta(t).
7. Không có observation model nối view/share/creator count với S,E,I,R,F. Các trạng thái ẩn và tham số có thể khó xác định chỉ từ một chuỗi views. Chưa có khoảng bất định hoặc kiểm nghiệm hồi cứu.

**Ứng dụng thực tế đề xuất:** trước hết đo động lượng trend theo ngành và nền tảng: lượng bài mới, số creator duy nhất, tốc độ tăng tương tác đã điều chỉnh tuổi bài, độ tập trung nguồn, chất lượng/phạm vi mẫu. Bắt đầu với dự báo ngắn hạn 1/3/7 ngày và baseline giá trị gần nhất, seasonal naïve nếu đủ mùa vụ. Đây là lựa chọn triển khai đề xuất, không phải khẳng định mô hình nào đã thắng.

Chỉ đưa SEIR-F vào cạnh tranh sau khi có lịch sử, cách đo trạng thái và cơ chế fit. Dùng rolling-origin backtest; chỉ dùng dữ liệu sẵn có tại thời điểm dự báo; đánh giá MAE/WAPE phù hợp với mẫu số, độ phủ khoảng dự báo và lỗi ngày đạt đỉnh. Hawkes/SEISMIC phù hợp để nghiên cứu khi có event reshare; dữ liệu snapshot tổng hợp không tự có đầy đủ thông tin cascade.

## 4. TDA: sai khác lớn giữa tên gọi, phép tính và kết luận kinh doanh

**Bằng chứng mã:** toàn bộ `packages/algo-core/tda_whitespace.py`, đặc biệt dòng 35, 49–65; API dùng vector ngẫu nhiên tại `apps/api/main.py:87–98`.

Persistent homology nghiên cứu cấu trúc tồn tại qua nhiều thang khoảng cách: H0 là thành phần liên thông, H1 là vòng, H2 là khoang. Ripser tính persistence diagram gồm cặp birth–death. Nghiên cứu TDA có công cụ để đánh giá tính ổn định và thống kê của đặc trưng topo. **Khoảng cách giữa hai tâm cụm không phải persistence và không chứng minh có H1/H2.** [Nguồn 7, 8]

Code không dựng filtration, không tính homology, Betti numbers hay birth–death. `persistence_threshold` đang được dùng như ngưỡng khoảng cách Euclid.

Các vấn đề ảnh hưởng trực tiếp đến sản phẩm:

1. **Không có chứng cứ nhu cầu:** `unanswered_queries` được nhận nhưng không dùng. Probe thay danh sách rỗng bằng query có count 10,000 không đổi kết quả. Với danh sách rỗng, đầu ra vẫn khẳng định khán giả thường xuyên tìm kiếm và đối thủ chưa từng khai thác.
2. **Điểm 0.98 không phải 98% cơ hội thành công.** Chỉ là `min(0.98, distance×0.8)`. Vector cách xa có thể là chủ đề không liên quan hoặc không có thị trường.
3. **Phụ thuộc scale:** giữ nguyên cấu trúc điểm, nhân tọa độ 0.1 làm số gap trong probe giảm từ 1 xuống 0. Ngưỡng phải gắn với embedding, chuẩn hóa và metric đã chọn, rồi đánh giá độ nhạy.
4. **Tâm khoảng giữa hai cụm chưa chắc là vùng trống:** có thể đã có cụm thứ ba nằm đúng đó. Code không kiểm tra mật độ lân cận hoặc nội dung thực tế xung quanh midpoint.
5. `center_gap[:3]` chỉ lấy ba chiều đầu embedding; không phải phép chiếu 3D có ý nghĩa. Biểu đồ 3D nên là công cụ khám phá với cảnh báo méo khoảng cách, không là bằng chứng thị trường.
6. `list(set(labels))` làm thứ tự nhãn không ổn định giữa tiến trình; có thể đổi ID/thứ tự khi điểm bằng nhau. So sánh mọi cặp cụm là O(K²), cần đánh giá chi phí nếu số cụm tăng.

**Hướng thực dụng:** bắt đầu từ câu hỏi/bình luận thực tế, gom nhóm nhu cầu, khử trùng lặp và bot; đo số người hỏi độc lập, mức gần đây và mức liên quan đến khách hàng. Tìm nội dung đối thủ thực sự trả lời từng nhu cầu, chấm độ phủ và chất lượng bằng rubric có người kiểm tra. Mỗi đề xuất phải có trích đoạn, URL, ngày lấy và phạm vi corpus. “Không thấy trong mẫu đối thủ đã khảo sát” chính xác hơn “chưa đối thủ nào làm”. Không được ghi nhu cầu là 0 khi dữ liệu chưa thu được; trạng thái phải là thiếu dữ liệu.

Có thể dùng điểm ưu tiên từ demand, khoảng thiếu supply, brand fit và độ tin cậy; trọng số cần hiệu chỉnh bằng thử nghiệm. Chỉ thêm TDA khi ablation chứng minh cải thiện chất lượng đề xuất so với clustering/semantic retrieval đơn giản. Một lỗ topo thật vẫn chưa chứng minh ý định mua hoặc khả năng tạo doanh thu.

## 5. Khả năng chạy và phạm vi đã kiểm tra

- Môi trường ban đầu không có numpy/scipy/fastapi/pydantic. Đã tạo venv tạm riêng để chạy kiểm tra, không sửa engine hoặc cài dependency vào dự án.
- Với repository root trên Python path, import API thất bại: `ModuleNotFoundError: No module named 'packages.algo_core'`. Thư mục thật tên `algo-core`, còn code import `algo_core`. Lệnh chạy từ `apps/api` trong README còn cần giải quyết package root.
- CFI và whitespace endpoint dùng dữ liệu tổng hợp; trend dùng tham số cố định. Không có endpoint xử lý video thật hoặc thu dữ liệu một keyword trong code hiện có.
- Kết quả probe nằm trong `algorithm_probe_results.json`; script tái lập là `check_algorithms.py`. Các probe chứng minh lỗi/giới hạn trên đầu vào tổng hợp, **không đo độ chính xác với người dùng thật**. Không khởi động HTTP server và chưa load test production.
- Môi trường chạy probe: Python 3.12.16; numpy 2.5.4, scipy 1.18.1, fastapi 0.162.0, pydantic 2.14.2. Không suy ra đây là phiên bản bắt buộc của app.

Tái lập từ repository root trong môi trường có dependency:

```sh
python docs/research/check_algorithms.py
```

## 6. Thứ tự triển khai và điều kiện nghiệm thu đề xuất

1. **Nền tảng:** thống nhất package/import, khai báo dependency, kiểm tra input và đơn vị; phân biệt demo/experimental với dữ liệu thực; lưu provenance, thời gian và phạm vi dữ liệu. Chưa xuất phần trăm completion hoặc nhu cầu khẳng định khi không có bằng chứng.
2. **MVP có thể kiểm tra trực tiếp:** tìm câu hỏi chưa được nội dung hiện có trả lời, kèm nguồn; và timeline feature video cho biên tập viên. Chọn một ngành, một nền tảng để kiểm chứng trước.
3. **Đánh giá với người dùng:** biên tập viên đánh giá đúng/sai và mức hữu ích theo rubric; so với baseline đơn giản; đo thời gian tiết kiệm và tỷ lệ đề xuất được chấp nhận. Thử nghiệm nội dung trong điều kiện so sánh được, báo cả bất định và yếu tố gây nhiễu.
4. **Dự báo có điều kiện:** chỉ công bố khi dữ liệu đủ, vượt baseline trên tập thời gian tương lai và kênh chưa thấy, độ bất định được đánh giá và chi phí/lần phân tích phù hợp. Đặt ngưỡng nghiệm thu trước khi xem kết quả; chưa có căn cứ đưa ra một cỡ mẫu hay mức chính xác bảo đảm chung.

Không nên hứa roadmap bốn tuần đủ cho scraping đa nền tảng, thu ground truth, ba thuật toán đã kiểm nghiệm và launch. Thời gian phụ thuộc quyền truy cập, độ phủ dữ liệu và tốc độ thu nhãn; cần hoàn thành một thử nghiệm dữ liệu trước khi ước lượng lịch.

## 7. Nguồn đối chiếu

Các nguồn được tra cứu ngày 31/10/2026. Nguồn học thuật chứng minh phương pháp gốc, không xác nhận hiệu quả của triển khai SocialLens Pro.

1. [YouTube: Search & discovery tips](https://support.google.com/youtube/answer/11914225?hl=en) — cá nhân hóa, performance, cạnh tranh và mùa vụ.
2. [YouTube: Understand your content performance](https://support.google.com/youtube/answer/16559650?hl=en) — appeal, engagement, satisfaction.
3. [YouTube Analytics: Channel Reports](https://developers.google.com/youtube/analytics/channel_reports) — quyền chủ kênh và audience retention reports.
4. [YouTube Analytics: Metrics](https://developers.google.com/youtube/analytics/metrics) — định nghĩa audienceWatchRatio và relativeRetentionPerformance.
5. [Goel et al.: The Structural Virality of Online Diffusion](https://cs.stanford.edu/people/ashton/pubs/twiral.pdf) — broadcast và viral diffusion, giới hạn mô hình contagion.
6. [Zhao et al. (KDD 2015): SEISMIC](https://arxiv.org/abs/1506.02594) — dự báo reshare từ lịch sử cascade Twitter.
7. [Ripser: API reference](https://ripser.scikit-tda.org/en/latest/reference/stubs/ripser.ripser.html) — persistence diagrams, filtration và homology dimensions.
8. [Bubenik (JMLR 2015): Statistical Topological Data Analysis using Persistence Landscapes](https://www.jmlr.org/papers/v16/bubenik15a.html) — biểu diễn topo phục vụ suy luận thống kê.
