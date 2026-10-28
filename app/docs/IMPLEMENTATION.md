# Nhật ký triển khai

Baseline: prompt trực tiếp, mục 13 PROJECT_REQUIREMENTS_SNAPSHOT.md và hồ sơ 1.0 ngày 21/10/2026. Tài liệu gốc giữ nguyên. Thư mục app cũ không có mã nguồn; triển khai mới trong workspace hiện hành.

Các giai đoạn: (1) schema, migration, auth, quyền; (2) nhóm, hồ sơ, hướng dẫn, duyệt; (3) tiến độ, file, kết quả, thay đổi; (4) tương tự, thống kê, jobs; (5) kiểm thử và tài liệu.

Đã tích hợp các giai đoạn trên trong mã nguồn local: 34 bảng, 5 migration SQL, 105 endpoint, 24 màn hình/tab theo vai trò. Kết quả hiện tại 51 test Vitest/Supertest và 8 test Playwright đạt; có build/lint/audit, benchmark 1.000 đề tài và kiểm chứng restore PostgreSQL. Các thay đổi nghiệp vụ dùng advisory lock PostgreSQL, snapshot/version và idempotency; FK đặc thù nằm trong SQL có phiên bản.

Lựa chọn: PostgreSQL local thật để kiểm thử; không thay bằng bộ nhớ/SQLite. Cloudinary thiếu credential phải báo 503 rõ ràng, mock chỉ trong test. Phạm vi kiểm chứng dịch vụ và triển khai được ghi riêng trong TEST_REPORT.md.

Scheduler Windows được đăng ký lúc 09:00 mỗi ngày và đã chạy thử thành công; log/proof trong OPERATIONS.md và SCHEDULER_RESULTS.json. Cloudinary, khôi phục nội dung file và deploy thật chưa được coi là đạt. Nguồn baseline và mọi file tham khảo giữ nguyên.
