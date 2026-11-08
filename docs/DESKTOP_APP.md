# CadenceLab desktop 0.3.1

## Bản đã tạo

`release/CadenceLab-0.3.1-mac-arm64.dmg` là bộ cài **Mac Apple Silicon** (M1 trở lên), khoảng 416 MiB. Mở DMG và kéo CadenceLab vào Applications. App tự chạy backend riêng và mở giao diện trong cửa sổ native; người dùng không cần cài Python, Node hoặc mở Terminal để khởi động.

Đây là bản kiểm thử nội bộ, ký ad-hoc. Chưa có Apple Developer ID/notarization nên macOS có thể chặn bản được tải qua Internet. Chưa xác nhận khả năng cài trên một máy Mac sạch. Không tắt Gatekeeper để phát hành. Bản Intel và Windows chưa được tạo/kiểm thử; cấu hình NSIS trong mã nguồn chưa phải file `.exe` dùng được.

## Cài đặt AI

Mở **Cài đặt AI** ở thanh trên, chọn nhà cung cấp, nhập tên model và API key nếu cần, bấm **Kiểm tra kết nối**, sau đó **Lưu cài đặt**. Model phải hỗ trợ trả JSON và có quyền truy cập trong tài khoản. Kiểm tra kết nối thực sự gửi một yêu cầu nhỏ, có thể dùng hạn mức của nhà cung cấp.

- **Codex local**: dùng CLI Codex được cài và đăng nhập sẵn trên máy. App không đóng gói tài khoản, thuê bao hay thông tin đăng nhập. Vẫn cần Internet và hạn mức. Model kế thừa cấu hình Codex của người dùng.
- **OpenAI / Gemini / DeepSeek / Groq**: gửi API key và dữ liệu cần phân tích trực tiếp từ backend trên máy tới endpoint cố định của nhà cung cấp đã chọn. Không có máy chủ trung gian CadenceLab. Không tự chuyển sang nhà cung cấp khác khi lỗi.
- **Ollama**: phải cài Ollama, tải model hỗ trợ JSON trước và chạy dịch vụ local. Chỉ cho địa chỉ HTTP loopback có cổng và đường dẫn `/v1`. Mặc định `http://127.0.0.1:11434/v1`. Với file video có sẵn và model có sẵn, luồng này không cần AI cloud; phân tích link mạng xã hội vẫn cần Internet để lấy dữ liệu.

API key lưu bằng Electron safeStorage của hệ điều hành, không lưu localStorage và không nằm trong bộ cài. Nếu cơ chế mã hóa không sẵn sàng, app từ chối lưu key. Ô key để trống giữ key trước đó của cùng nhà cung cấp. Cấu hình và SQLite nằm dưới thư mục userData của CadenceLab (macOS: `~/Library/Application Support/CadenceLab`), không nằm trong Applications. Chế độ kiểm thử có thể đổi vị trí bằng `CADENCELAB_USER_DATA`.

Bản desktop mở các trạm phân tích trực tiếp. Đăng nhập Google của bản web không áp dụng cho bản desktop.

## Những gì được đóng gói

Electron + frontend Next đã xuất tĩnh, backend Python đóng băng bằng PyInstaller, FFmpeg, thư viện xử lý tín hiệu và model faster-whisper tiny. Backend chỉ lắng nghe `127.0.0.1` ở cổng do hệ điều hành cấp. Mỗi lần mở có token ngẫu nhiên do Electron main giữ; truy cập thiếu token và Origin khác bị từ chối. Renderer có sandbox, context isolation và không có Node integration. Preload chỉ cung cấp bốn lệnh cài đặt/thông tin app.

Giới hạn phân tích hiện tại vẫn áp dụng: video tối đa 60 giây/25 MiB; nhận dạng lời nói và đo tín hiệu, chưa có OCR hoặc hiểu toàn bộ nội dung hình ảnh. Thu thập TikTok công khai vẫn có thể thất bại do giới hạn nguồn. Khi thiếu dữ liệu/AI, app báo trạng thái thiếu thay vì thay bằng mẫu hoặc tự dựng điểm. Các mô hình chưa có độ chính xác dự báo được hiệu chuẩn trên kết quả khán giả thực tế.

## Build lại trên máy phát triển

Chạy từ thư mục gốc, Python 3.12+ và Node phù hợp với lockfile:

```sh
uv sync --locked --extra media --group dev --group build
npm --prefix apps/web ci
npm --prefix apps/desktop ci
uv run --extra media python scripts/prepare_video_models.py
uv run --extra media python scripts/desktop/build_frontend.py
uv run --extra media --group build python scripts/desktop/build_backend.py
npm --prefix apps/desktop run dist:mac
```

Backend PyInstaller và Electron phải cùng OS/kiến trúc với bộ cài. Windows cần thực hiện các bước này trên Windows x64 rồi chạy `npm --prefix apps/desktop run dist:win`; không dùng backend macOS để tạo bộ cài Windows. `build_frontend.py` dựng trong staging riêng, không đọc `.env.local` và không ghi đè `.next` của web đang chạy.

Nếu GitHub URL tải toolset icons bị timeout, dùng bản tải qua API chính thức và kiểm checksum đã pin:

```sh
uv run python scripts/desktop/download_toolsets.py
ELECTRON_BUILDER_ICONS_TOOLSET_DIR="$PWD/build/toolsets/icons-1.2.3/icons-bundle" npm --prefix apps/desktop run dist:mac
```

Electron 45.2.3 macOS arm64 của lần build này đã được đối chiếu SHA-256 với `node_modules/electron/checksums.json`: `4d7c429064087a47b855d9bd06c76ead4819b7f02b385de232d4a5c37ecef55f`.

Trước phát hành công khai cần ký Developer ID, notarize/staple bản Mac, ký bản Windows và hoàn tất thông báo giấy phép/cung cấp mã nguồn tương ứng của thành phần đi kèm theo yêu cầu giấy phép. Xem `DESKTOP_NOTICES.txt`; bản hiện tại dùng để thử nội bộ.

## Kiểm chứng lần build này

- 89 kiểm thử Python; 5 kiểm thử Node cho cài đặt/mã hóa; build TypeScript và xuất frontend thành công.
- Backend đã đóng băng chạy độc lập: chặn truy cập không có token, phục vụ frontend, tạo job báo cáo, xử lý video thật với FFmpeg/ASR. Bài thử nhận dạng 58 từ và 52 lát cắt; cố ý ngắt AI và xác nhận không dựng điểm ngữ nghĩa.
- Mở app đã đóng gói, backend riêng hoạt động, frontend tải thành công. Bấm Kiểm tra kết nối trong cửa sổ native đã nhận JSON hợp lệ từ Codex đã đăng nhập; lưu cấu hình Codex thành công.
- Adapter cloud được kiểm bằng transport giả; chưa thử key cloud thật hay lưu key thật vào Keychain. Chưa xác nhận mọi model của các nhà cung cấp đều tương thích.
- `codesign --verify --deep --strict` và `hdiutil verify` thành công. Rà nội dung app không có `.env`, auth.json, database người dùng hay giá trị key/token từ cấu hình dự án.

Chứng cứ: `docs/research/desktop-frozen-smoke.json`, `docs/research/desktop-distribution-audit.json`, file checksum bên cạnh DMG. Có thể chạy lại `scripts/desktop/audit_bundle.py` sau khi đóng gói; script chỉ in số lượng và checksum, không in bí mật.

Từ 0.3.1 có mục Cập nhật phần mềm trong Cài đặt AI; xem RELEASING.md. Windows được build/kiểm thử trên GitHub Actions; chỉ coi là có bộ cài khi workflow thành công và asset EXE đã xuất hiện trong Release.
