# Phiếu kiểm tra và chốt phạm vi dự án

Tên dự án: Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên.

Phiên bản hồ sơ: 1.0 ngày 21/10/2026. Trạng thái phiếu: chờ chủ dự án kiểm tra. Các ô chưa được đánh dấu; không coi việc tạo phiếu là đã được phê duyệt.

## 1 Phương án đã lựa chọn để kiểm tra

| Nội dung | Phương án hiện hành |
|---|---|
| Ngôn ngữ | JavaScript, không dùng TypeScript |
| Frontend | React/Vite/Router, Tailwind, React Hook Form/Zod, TanStack Query |
| Backend | Express/Node.js, REST API /api/v1 |
| Database | PostgreSQL + Prisma; Supabase cung cấp database |
| File | Cloudinary, tài liệu raw/authenticated; upload qua backend |
| Deploy | Vercel frontend + Render backend |
| Tác nhân | SV, GV, CB khoa, QT; trưởng nhóm là thuộc tính nhóm |
| Nhóm | Mặc định 1–3 người cùng khoa; một nhóm hoạt động/SV/đợt |
| Đánh giá | GV chính kết luận đạt/không đạt, nhận xét bắt buộc |
| Tương tự | Tên chuẩn hóa/pg_trgm, TF-IDF/cosine; cảnh báo không tự từ chối |
| Tài liệu | 1–5 file/lần nộp, tối đa20MB/file theo yêu cầu, có phiên bản |
| Thống kê | Theo GV/lĩnh vực/trạng thái/kết quả/khoa/đợt/năm; CSV |

## 2 Checklist rà soát phạm vi

- [ ] Mục tiêu và phạm vi trong tài liệu 01 phản ánh đúng đồ án.
- [ ] Đồng ý hội đồng độc lập, kinh phí, chat/email, đọc PDF và API AI nằm ngoài bản đầu.
- [ ] Đồng ý tài khoản do quản lý cấp/import, không đăng ký tự do.
- [ ] Đồng ý nhóm cùng khoa và mặc định1–3 thành viên, có cấu hình theo đợt.
- [ ] Đồng ý GV nhận hướng dẫn trước khi gửi; CB khoa chốt phân công và duyệt.
- [ ] Đồng ý hồ sơ đang chờ duyệt bị khóa và mỗi lần gửi có snapshot.
- [ ] Đồng ý sau duyệt đổi nội dung/thành viên/GV đều qua yêu cầu.
- [ ] Đồng ý ba mốc mặc định, phiên bản mới khi nộp lại, nộp muộn vẫn lưu có nhãn.
- [ ] Đồng ý tiến độ% tự khai không thay xác nhận GV.
- [ ] Đồng ý điều kiện nghiệm thu dựa bản hiện hành mọi mốc bắt buộc accepted.
- [ ] Đồng ý GV kết luận cuối; CB sửa sai bằng phiên bản mới có lý do.
- [ ] Đồng ý quyền đọc lịch sử theo khoảng/phiên bản, admin kỹ thuật không mặc nhiên đọc file.
- [ ] Đồng ý đề nghị hủy phải chờ cán bộ quyết định mới đóng nhóm.
- [ ] Đồng ý cảnh báo tương tự là hỗ trợ xét duyệt, không kết luận đạo văn.
- [ ] Đồng ý danh sách màn hình và danh mục API trong bộ hồ sơ.
- [ ] Đồng ý dữ liệu mẫu và kế hoạch kiểm thử trước bàn giao.

## 3 Các chi tiết được cụ thể hóa trong lần tổng hợp này

Các chi tiết sau làm rõ để kiểm tra, chưa có bằng chứng thực thi:

| Chi tiết | Lựa chọn trong bộ hồ sơ |
|---|---|
| Đợt theo phạm vi khoa | Mỗi đợt gắn một khoa; CB khoa tạo/quản lý; trường cần đợt toàn trường có thể tổ chức các đợt cùng năm theo khoa |
| Quyền khi SV tham gia lại | team_access_grants lưu nhiều khoảng, không tự mở file ở giai đoạn vắng mặt |
| Khoa chủ trì | Chốt trên nhóm/đề tài, không đổi theo việc SV chuyển lớp sau này |
| Xung đột lợi ích | Không tự duyệt hồ sơ/yêu cầu khi tài khoản là SV thành viên |
| Đồng ý hướng dẫn | Gắn phiên bản/hash nội dung để thay nội dung đáng kể phải xác nhận lại |
| Lời mời sau duyệt | SV đồng ý trước, CB áp dụng sau; kiểm tra chỗ lúc CB duyệt |
| Nhóm chưa có hồ sơ | Trưởng nhóm được đóng để giải phóng chỗ; không tái sử dụng nhóm đóng |
| Giới hạn form | Độ dài tối thiểu theo baseline; mức tối đa văn bản theo tài liệu 01 |
| Đơn vị file | MB thập phân =1.000.000 byte trong UI/API/test |
| Mã đề tài | NCKH-YYYY-NNNN dùng sequence; không hứa liền mạch/reset theo năm |
| Chống gửi lặp | Idempotency cho thao tác nghiệp vụ, lưu24 giờ, không lưu secret response |
| Nhắc hạn | Trong3 ngày tới và quá hạn, chống trùng theo phiên bản deadline |
| Backup demo | Hằng ngày, cấu hình giữ7 bản gần nhất và thử restore cả file |

## 4 Những điều chưa thể xác nhận bằng quyết định thiết kế

| Nội dung | Trạng thái thật | Bằng chứng cần có |
|---|---|---|
| Cloudinary hỗ trợ20MB/file trên tài khoản dùng thực | Chưa kiểm tra tài khoản | Upload/download thật; hạn mức và cấu hình PDF |
| Link tải5 phút | Chưa chạy tích hợp | Link còn hạn/hết hạn và test quyền |
| Ngưỡng tương tự | Chưa có số ngưỡng đã hiệu chỉnh | Bộ nhãn, phiên bản corpus và báo cáo precision/recall |
| Hiệu năng p95<2 giây | Mục tiêu | Load test1.000 đề tài với cấu hình ghi nhận |
| Cookie/proxy và scheduler | Chưa triển khai | E2E trên URL thật, log job và test chạy lại |
| Khôi phục backup | Chưa thực hiện | Biên bản restore database/file |
| Chi phí | Chưa có báo giá theo tài khoản/gói | Kiểm tra quota/gói; xin phép trước phát sinh chi phí |
| Quy chế trường | Chưa có văn bản xác nhận | Đối chiếu giới hạn nhóm, thẩm quyền, mốc và chấm điểm |

Các mục này là kiểm chứng kỹ thuật/nghiệp vụ trước nghiệm thu, không yêu cầu chủ dự án tự chọn thuật toán hoặc tự xác nhận số liệu chưa đo. Không tự đánh dấu đạt để đóng hồ sơ.

## 5 Ghi nhận điều chỉnh

| Mã | Nội dung cần sửa | Quyết định sau kiểm tra |
|---|---|---|
| DC01 | Chưa có | Chờ phản hồi |

Khi có thay đổi, cập nhật đồng thời yêu cầu, dữ liệu/API/test liên quan và tăng phiên bản hồ sơ. Không tiếp tục dùng các lựa chọn MongoDB/TypeScript/Blob ở tài liệu lịch sử cho triển khai mới.

## 6 Xác nhận

- [ ] Chấp thuận phạm vi thiết kế để chuyển sang lập trình.
- [ ] Chấp thuận có điều chỉnh theo bảng mục5.
- [ ] Cần sửa hồ sơ trước khi lập trình.

Người xác nhận: chưa ghi nhận.

Ngày xác nhận: chưa ghi nhận.

Việc chốt phạm vi không đồng nghĩa website đã hoàn thành, test đã đạt, được phép mua gói dịch vụ hoặc được phép công bố dữ liệu thật.
