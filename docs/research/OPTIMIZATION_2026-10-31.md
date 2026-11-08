# Tối ưu thuật toán ngày 31/10/2026

Đã sửa mã nguồn và API, bổ sung dependency manifest/lockfile cùng 26 bài kiểm tra. Đây là bản cải thiện tính đúng và khả năng kiểm chứng, chưa phải chứng nhận tăng retention hoặc hiệu quả marketing thực tế.

## Thay đổi đã triển khai

| Phần | Trước | Sau |
|---|---|---|
| CFI đầu vào toàn 0 | Hạng B, completion 18.9%, không cảnh báo | Hạng F về nhịp dựng, score 0, một đoạn cần xem lại |
| Đạo hàm CFI | Theo chỉ số lát cắt | Theo giây; cùng tín hiệu vật lý khi đổi tần suất lấy mẫu cho kết quả tương đương |
| HOOK | Che các cảnh báo khác | `stage` độc lập với `zone` |
| Đếm valley | Mỗi lát cắt là một valley | Gộp lát cắt liên tiếp thành một episode |
| Completion | Nhân cố định 82 | `null`, trạng thái `not_calibrated` |
| Video ít chuyển động nhưng có ngữ nghĩa | Penalty chỉ xét hình/âm thanh | Semantic density bảo vệ khỏi penalty chỉ do camera tĩnh |
| SEIR tổng dân số đầu | N+2I0 | Đúng N; kiểm tra bảo toàn và trạng thái không âm sau giải |
| SEIR thời gian | Lưới lệch và nhãn sai | Ngày tương lai 1…days, không gồm trạng thái t=0 |
| SEIR chỉ số/pha | Phụ thuộc cực đại cửa sổ dự báo | Chuẩn hóa theo N cố định; pha dựa trên tăng trưởng trạng thái hiện tại |
| Trend thực tế | Keyword chỉ là nhãn của mô phỏng cố định | API yêu cầu chuỗi quan sát; fit beta và exposed ban đầu, trả về priors và lỗi fit |
| Whitespace | Khoảng cách tâm cụm và khẳng định nhu cầu dựng sẵn | Retrieval cosine giữa câu hỏi và từng nội dung, yêu cầu nguồn nhu cầu |
| Điểm cơ hội | Khoảng cách × 0.8, chặn 0.98 | Trọng số demand tuyệt đối × semantic gap, ghi rõ heuristic |
| Thiếu nhu cầu | Vẫn sinh cơ hội | Danh sách rỗng và `missing_demand_data` |
| Vector/query trùng | Phụ thuộc scale và thứ tự set | Chuẩn hóa L2, ID hash ổn định, dedup query không cộng dồn count |
| API | Import lỗi, dữ liệu demo trộn với dự báo | Package chuẩn, phân tách simulate/analyze/forecast, JSON input và HTTP 422 |

Triển khai mới ở `packages/algo_core`; thư mục `packages/algo-core` giữ shim để hỗ trợ các đường dẫn cũ. Tên `TDAWhitespaceEngine` còn là alias tương thích nhưng không được mô tả là persistent homology. Các trường có tên cũ như `BOREDOM_VALLEY`, `void_center_coordinates` được giải thích trong README; tọa độ 3D hiện để rỗng.

## Kiểm chứng

Lệnh: `python -m unittest discover -s tests -v` và `python docs/research/check_algorithms.py` trong môi trường có dependency khai báo ở `pyproject.toml`.

26 bài kiểm tra gồm: CFI toàn 0/một lát/NaN/khác chiều/đổi tần suất; không che overload ở hook; SEIR bảo toàn dân số và không âm, ngày tương lai, ổn định khi đổi horizon, dữ liệu quan sát khác nhau tạo dự báo khác nhau; gap thiếu evidence, đã được phủ, trùng query, scale và thứ tự corpus; import API từ thư mục README, JSON response và HTTP 422. TestClient kiểm tra các route ASGI, chưa phải load test production.

Thử nghiệm holdout tổng hợp: tạo chuỗi 36 ngày từ SEIR-F với beta 0.65, dùng 28 ngày đầu để fit, giữ riêng 8 ngày sau. Fit thu beta xấp xỉ 0.65; MAE holdout khoảng 0.0023 so với baseline lấy giá trị cuối khoảng 25,288.4. **Dữ liệu được tạo bằng cùng họ mô hình nên đây chỉ là phép kiểm tra khôi phục/thực thi, không dùng các số này để quảng cáo độ chính xác ngoài thực tế.**

Kết quả máy đọc nằm ở `optimized_probe_results.json`. Bằng chứng trước tối ưu vẫn ở `algorithm_probe_results.json`. `test_results_optimized.txt` lưu kết quả bộ kiểm tra. Snapshot mã gốc (không chứa cache Python) là `baseline_source_2026-10-31.tar.gz`.

## Những giới hạn còn lại

- CFI chưa trích feature từ file video và chưa học/hiệu chuẩn từ retention thật. Trọng số, ngưỡng và grade là quy tắc có thể kiểm tra, không phải nhãn chất lượng nội dung tổng thể. Không giả định càng nhiều hiệu ứng càng tốt.
- SEIR-F yêu cầu số người đang lan truyền theo ngày, không nhận views tổng thay thế. Chưa có collector tự lấy chuỗi cho keyword. Fit giữ cố định N/sigma/gamma/alpha/kappa và giả định R0=F0=0; giả định này có thể không phù hợp trend đã tồn tại lâu. Sai số fit là trong mẫu; chưa có khoảng dự báo đã hiệu chuẩn hoặc backtest dữ liệu thực.
- Content gap chỉ xét corpus và nguồn do caller cung cấp; URL chưa được tự mở/xác minh. Similarity không chứng minh bài đã trả lời đúng hoặc câu hỏi có giá trị kinh doanh. Cần kiểm tra thủ công, khử trùng lặp người dùng và dùng cùng embedding model/version. Không lấy lỗ topo làm bằng chứng nhu cầu.
- API phục vụ chạy local, chưa bổ sung authentication, scraper, queue hoặc pipeline sản xuất.

## Tương thích và khôi phục

`/trend/forecast` đổi sang JSON có observations; `/trend/simulate` giữ mục đích mô phỏng. `/whitespaces/discover` đổi sang JSON dữ liệu thật. Các caller cũ cần cập nhật; OpenAPI tại `/docs` và README mô tả contract mới. Không có frontend trong checkout để cập nhật.

Để xem mã trước sửa, giải nén snapshot vào **một thư mục riêng** rồi đối chiếu; không giải nén đè lên mã hiện tại. Checkout ban đầu không có Git nên snapshot là bản lưu phục vụ khôi phục.
