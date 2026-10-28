# Đối chiếu 24 màn hình

Các mục workspace dùng chung bố cục và component, theo đúng quyền backend. URL dùng UUID nội bộ để định tuyến; giao diện hiển thị mã/tên nghiệp vụ.

| Màn hình                     | Đường dẫn / vị trí                                              |
| ---------------------------- | --------------------------------------------------------------- |
| UI01 Đăng nhập               | `/login`                                                        |
| UI02 Hồ sơ và mật khẩu       | `/profile`, bấm tên người dùng cuối sidebar                     |
| UI03 Tổng quan               | `/`                                                             |
| UI04 Kho đề tài              | `/repository`, `/repository/:id`                                |
| UI05 Đợt đăng ký             | `/periods`                                                      |
| UI06 Nhóm và lời mời         | `/teams`                                                        |
| UI07 Form đề tài             | `/topics/new`, `/topics/:id/edit`                               |
| UI08 Đối chiếu tương tự      | `/topics/:id/similarity`                                        |
| UI09 Workspace               | `/topics/:id`                                                   |
| UI10 Phiên bản hồ sơ         | `/topics/:id/revisions`                                         |
| UI11 Mốc và nhật ký tiến độ  | `/topics/:id/milestones`                                        |
| UI12 Upload và báo cáo       | `/topics/:id/submissions`                                       |
| UI13 Nhận xét                | `/topics/:id/reviews`                                           |
| UI14 Kết quả và sửa sai      | `/topics/:id/evaluations`                                       |
| UI15 Thay đổi và hủy         | `/topics/:id/requests`                                          |
| UI16 Hướng dẫn nghiên cứu    | `/supervision`                                                  |
| UI17 Hàng chờ cán bộ         | `/queue`                                                        |
| UI18 Cấu hình đợt/mốc mẫu    | `/periods/new`, `/periods/:id/edit`                             |
| UI19 Thống kê/Recharts/CSV   | `/reports`                                                      |
| UI20 Thông báo               | `/notifications`                                                |
| UI21 Tài khoản và import CSV | `/users`                                                        |
| UI22 Vai trò và phạm vi      | `/roles`                                                        |
| UI23 Danh mục                | `/catalogs`                                                     |
| UI24 Lịch sử và khoảng quyền | `/topics/:id/history`, `/audit` cho nhật ký hệ thống theo quyền |

Danh sách công việc riêng: `/my-topics`. Nút thao tác gọi API thật, pending khóa gửi lặp, lỗi hiển thị trong form/trang. File upload không được tính đã nộp trước finalize; khi Cloudinary chưa cấu hình hiện lỗi dịch vụ rõ ràng.
