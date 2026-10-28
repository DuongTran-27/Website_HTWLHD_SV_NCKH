# Bộ hồ sơ kiểm tra và chốt dự án

Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên

Phiên bản hồ sơ: 1.0 để kiểm tra. Ngày cập nhật: 21/10/2026, múi giờ Việt Nam.

## Mục đích

Bộ hồ sơ tập hợp các lựa chọn hiện hành và diễn giải thành yêu cầu, quyền, luồng xử lý, dữ liệu, API, màn hình, kiểm thử và triển khai để chủ dự án kiểm tra trước khi chốt triển khai. Bộ hồ sơ chưa phải sản phẩm phần mềm đã nghiệm thu.

Có thể đọc toàn bộ nội dung trong [bản tổng hợp liên tục](HO_SO_TONG_HOP.md) hoặc đọc từng tài liệu bên dưới.

## Tài liệu trong bộ hồ sơ

| Thứ tự | Tài liệu | Nội dung kiểm tra |
|---|---|---|
| 1 | [Tổng quan và yêu cầu](01_TONG_QUAN_VA_YEU_CAU.md) | Mục tiêu, phạm vi, công nghệ, chức năng và tiêu chí chất lượng |
| 2 | [Tác nhân quyền và luồng](02_TAC_NHAN_QUYEN_VA_LUONG.md) | Phân quyền, trạng thái, DFD và tình huống nghiệp vụ |
| 3 | [Thiết kế dữ liệu](03_THIET_KE_DU_LIEU.md) | ERD, bảng dữ liệu, trường chính, khóa và giao dịch |
| 4 | [Đặc tả API](04_DAC_TA_API.md) | Quy ước, endpoint, payload, lỗi và quyền truy cập |
| 5 | [Giao diện kiểm thử và triển khai](05_GIAO_DIEN_KIEM_THU_TRIEN_KHAI.md) | Màn hình, test, dữ liệu mẫu, vận hành và bàn giao |
| 6 | [Phiếu kiểm tra và chốt](06_PHIEU_KIEM_TRA_VA_CHOT.md) | Danh sách nội dung cần rà soát, xác nhận hoặc điều chỉnh |
| 7 | PROJECT_REQUIREMENTS_SNAPSHOT.md | Bản sao nguyên trạng yêu cầu gốc và lịch sử lựa chọn tại ngày đóng gói |

## Cách hiểu trạng thái

- Đã chọn: lựa chọn thiết kế đã được người dùng giao lựa chọn và ghi tại mục 13 của PROJECT_REQUIREMENTS.md.
- Chi tiết hóa để kiểm tra: tên trường, enum, endpoint và cách tổ chức màn hình được cụ thể hóa trong bộ hồ sơ này; chưa có code/migration/OpenAPI thực thi để chứng minh hoạt động.
- Cần kiểm chứng: hạn mức tài khoản dịch vụ, hiệu năng, độ chính xác thuật toán, upload/download và sao lưu; chỉ xác nhận sau chạy thử thực tế.
- Chưa thực hiện: xây dựng website, tạo dịch vụ, mua gói, publish, chạy kiểm thử và tạo ảnh chụp hướng dẫn sử dụng.

## Lựa chọn hiện hành

JavaScript, React/Vite/React Router, Tailwind CSS, React Hook Form/Zod, TanStack Query; Express/Node.js; PostgreSQL/Prisma; Cloudinary cho ảnh và tài liệu. Frontend trên Vercel, backend trên Render, PostgreSQL trên Supabase. Không dùng TypeScript, MongoDB/Mongoose, Vercel Blob hoặc Supabase Storage trong phương án này.

Tác nhân: sinh viên, giảng viên, cán bộ khoa, quản trị viên. Trưởng nhóm là thuộc tính thành viên. Hội đồng độc lập và kinh phí nằm ngoài bản đầu.

## Các điểm thay đổi so với bản cũ

| Nội dung cũ | Nội dung hiện hành |
|---|---|
| MongoDB và Mongoose | PostgreSQL và Prisma |
| Đề xuất TypeScript | JavaScript toàn bộ ứng dụng |
| Blob hoặc Supabase Storage cho tài liệu | Cloudinary raw/authenticated |
| Express có thể trên Vercel | Express trên Render, frontend trên Vercel |
| Upload trực tiếp theo chữ ký là luồng chính | Upload qua Express để xác minh file trong bản đầu |
| Tên gần giống dùng Dice JavaScript | pg_trgm; ngưỡng phải hiệu chỉnh lại |
| Một cờ quyền đọc lịch sử | Kiểm soát quyền theo thời gian và phiên bản tài liệu |

## Điểm phải biết trước khi xác nhận

1. Giới hạn 20 MB/file là yêu cầu ứng dụng, chưa xác minh tài khoản Cloudinary hiện có hỗ trợ. Không tự mua gói hoặc hạ giới hạn để coi là đã đạt.
2. Cảnh báo tương tự hỗ trợ xét duyệt; không phải phát hiện mọi trường hợp trùng ý hoặc đạo văn. Ngưỡng số chưa chốt vì phải đo bằng dữ liệu có nhãn.
3. Nhóm 1–3 người, cùng khoa, giảng viên đánh giá cuối là baseline đồ án, không tuyên bố đây là quy chế của trường.
4. Thiết kế này có khoảng ba chục bảng nhỏ theo nghiệp vụ; không đồng nghĩa phải có từng ấy màn hình hoặc dịch vụ riêng.
5. Việc chốt hồ sơ cho phép lập trình theo phạm vi; không đồng nghĩa phê duyệt chi phí hoặc xác nhận website đã hoàn thành.

## Nguồn và thứ tự áp dụng

Nguồn chính là yêu cầu người dùng trong hội thoại, tài liệu Word tham khảo và PROJECT_REQUIREMENTS.md mục 13 cùng các điều khoản cũ chưa bị thay thế. Tài liệu nguồn trong sources/ không được sửa. Bộ hồ sơ này hợp nhất cách trình bày để đọc; nếu phát hiện khác biệt ngoài các lựa chọn đã thống nhất, ghi vào phiếu chốt để sửa trước khi lập trình.

Không kèm tài liệu Word gốc trong gói tải nhằm tránh nhân bản tài liệu tham khảo không cần thiết. Bộ hồ sơ có danh sách nguồn trong tài liệu 01.
