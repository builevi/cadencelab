# Phát hành và cập nhật

Nguồn phát hành duy nhất: https://github.com/builevi/cadencelab/releases

1. Sửa code, kiểm thử Python/Node và build frontend.
2. Tăng version trong `apps/desktop/package.json`, chạy `npm --prefix apps/desktop install --package-lock-only --ignore-scripts`.
3. Commit, tạo tag `vX.Y.Z` đúng version; push tag. Workflow Desktop release build Mac ARM64 và Windows x64 trên runner native. Artifacts nằm trong Actions để kiểm tra. Workflow kiểm tra app đóng gói khởi động thành công bằng profile tạm. Nếu Release cho version đã tồn tại, file được upload vào Release đó sau khi smoke test đạt; nếu chưa có Release thì chỉ lưu artifacts.
4. Tải artifacts, kiểm tra mở app/đọc video trên từng hệ điều hành, ký/notarize bản Mac và ký Windows khi có chứng chỉ. Tính SHA-256 cho file cuối cùng.
5. Tạo GitHub Release stable cho tag đó, upload `CadenceLab-X.Y.Z-mac-arm64.dmg`, `CadenceLab-X.Y.Z-win-x64.exe` và checksum, ghi rõ thay đổi/giới hạn. Không đánh dấu prerelease nếu muốn hiện ở `/releases/latest`.

Nút tải trên web lấy asset từ latest Release, hiển thị rõ chưa phát hành nếu thiếu file. Desktop: Cài đặt AI → Cập nhật phần mềm → Kiểm tra cập nhật. App so version số, loại draft/prerelease, chọn đúng OS/CPU. Tải bản cập nhật mở bộ cài qua GitHub HTTPS; người dùng đóng app và cài bản mới. Không chạy code tải về tự động. Chưa áp dụng cập nhật tự động cài đè cho bản unsigned/ad-hoc.

Cài phiên bản mới thay ứng dụng nhưng dữ liệu/config nằm trong userData, không kèm bộ cài. Sao lưu dữ liệu trước thay đổi schema; chưa có quy trình rollback/migration giữa mọi phiên bản. Không đưa `.env`, API key, Codex auth hay SQLite người dùng vào repo hoặc Releases.

Dự án công khai mã nguồn để đọc/nghiên cứu; quyền sử dụng/phân phối còn theo giấy phép từng thành phần. Chưa tự gán giấy phép thương mại cho toàn bộ dependency. Xem DESKTOP_NOTICES.txt trước phân phối rộng.

Lần phát hành thử nghiệm đầu 0.3.1 có các lần retry build từ main để sửa tương thích Windows. Xem commit build trong release-validation JSON và log Actions để lấy đúng source tương ứng bộ cài; tag 0.3.1 ghi nhận mốc bắt đầu phát hành. Các phiên bản tiếp theo cần bump version và tạo tag mới sau khi hoàn tất sửa code, tránh thay binary cùng version.

Khi chạy Run workflow thủ công, mặc định chỉ build/kiểm thử và lưu Actions artifacts, không ghi đè Release. Chỉ chọn `publish` khi muốn upload bộ cài vào Release hiện có. Workflow chạy từ tag mới vẫn phát hành như trước. Các action checkout/setup/upload đã nâng lên runtime Node.js 24; Node build ứng dụng vẫn là 22.
