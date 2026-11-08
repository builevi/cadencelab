# Web không phụ thuộc laptop

GitHub lưu source, Actions build phần mềm, Releases lưu bộ cài. GitHub Pages chỉ phục vụ HTML/CSS/JS tĩnh, không chạy FastAPI, SQLite worker, FFmpeg hoặc Codex CLI. Cloudflare Tunnel là đường dẫn tới origin; origin trên laptop tắt thì web vẫn tắt.

Để bản Web chạy độc lập cần một máy chủ/container hoạt động liên tục: cài Python/uv, Node; clone repo; chạy FastAPI và Next dưới process manager, volume bền cho `.sociallens`, reverse proxy HTTPS và tên miền. Next mặc định chuyển `/api/v1` tới `127.0.0.1:8000`, vì vậy hai tiến trình cần cùng máy hoặc chỉnh rewrite khi tách container.

Bản hiện tại phù hợp self-host cho một chủ máy hoặc nhóm tin cậy. Login Google phía frontend không kiểm soát quyền gọi API; chưa có xác minh token server/tenant isolation/rate limit theo người dùng. Phải hoàn thiện các lớp đó trước khi mở dịch vụ SaaS cho khách không tin cậy. Không công khai tài khoản Codex cá nhân thành AI dùng chung. Chọn provider cloud bằng secret của môi trường hosting và kiểm soát ngân sách trên server.

Repo không tự đăng ký dịch vụ trả phí, không tự chuyển DNS và không biến GitHub thành backend. Người vận hành chọn host, lưu trữ, tài khoản provider và chi phí. Desktop tiếp tục chạy ngay cả khi website không truy cập được; các thao tác cloud/thu thập URL vẫn cần mạng.

Nguồn: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
