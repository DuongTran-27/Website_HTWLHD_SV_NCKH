# Triển khai Vercel / Render / Supabase

Chưa có tài khoản/credential dịch vụ trong phiên bàn giao. Các cấu hình dưới đây đã chuẩn bị; chưa có URL triển khai được xác minh và chưa mua gói nào.

## Giá trị cần cấu hình tập trung

| Thành phần                  | Giá trị                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                  | `DATABASE_URL`, `MIGRATION_DATABASE_URL`                                                                                                    |
| Backend                     | `JWT_SECRET` ngẫu nhiên ít nhất 32 byte, `JWT_ISSUER`, `JWT_AUDIENCE`, `APP_ORIGIN` là đúng origin HTTPS của frontend, `COOKIE_SECURE=true` |
| Cloudinary                  | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                                                                      |
| Khởi tạo tài khoản          | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` ít nhất 16 ký tự, `BOOTSTRAP_ADMIN_CODE` tùy chọn               |
| Scheduler endpoint tùy chọn | `SCHEDULER_SECRET`; CLI job không cần biến này                                                                                              |
| Frontend                    | Chỉ URL backend công khai trong `vercel.json`, không có secret VITE\_\*                                                                     |

Không gửi secret trong chat, đưa vào URL lệnh, commit Git hoặc chụp màn hình. Dùng biến môi trường được bảo vệ của nhà cung cấp. Bootstrap admin chỉ chạy khi chưa có admin, sau đó bỏ biến mật khẩu bootstrap.

## Supabase PostgreSQL

Dùng project/database riêng cho ứng dụng. Supabase chỉ cung cấp PostgreSQL; không dùng Supabase Auth hoặc Storage. Chạy migration từ database rỗng và kiểm tra 34 bảng cùng FK, partial indexes, trigger và extension.

- Runtime Express là kết nối dài hạn; chọn direct connection nếu hạ tầng có IPv6, hoặc session pooler tương thích IPv4. Migration/pg_dump/pg_restore dùng kết nối direct/session, không dùng transaction pooler cho công việc cần session liên tục. [Hướng dẫn kết nối chính thức](https://supabase.com/docs/guides/database/connecting-to-postgres).
- `MIGRATION_DATABASE_URL` phải có quyền DDL/extension. Runtime nên dùng tài khoản quyền tối thiểu được thiết lập cho database riêng.
- Migration cần `pg_trgm` và `btree_gist`. Nếu đã bật extension ở schema `extensions` bằng Dashboard, kiểm tra namespace/search_path trước migration. Trong project riêng có thể đặt extension ở `public` phù hợp migration; không di chuyển extension dùng chung của ứng dụng khác khi chưa đánh giá.
- Dùng `sslmode=require` hoặc cấu hình xác minh TLS phù hợp môi trường. Không in connection string để chẩn đoán.
- Thiết lập giới hạn connection theo gói thực, ví dụ `connection_limit=5` cho một backend nhỏ; giá trị này cần đo lại theo tải và quota, không xem là tối ưu chung.

```text
npm run db:generate
npm run db:migrate
node app/scripts/create-admin.js
```

Không chạy seed demo trên production. Demo công khai cũng cần mật khẩu riêng và quota đã được chủ tài khoản chấp thuận.

## Render backend và scheduler

`render.yaml` mô tả web service và cron job. Xem giá/gói hiện hành trước khi áp dụng: việc tạo cron/service có thể phát sinh chi phí. Chưa có thao tác tạo service trả phí nào được thực hiện.

- Build: `npm ci --include=dev && npm run db:generate`.
- Trước deploy: `npm run db:migrate`, backup trước khi đổi schema có dữ liệu.
- Start: `npm start`; bind cổng `PORT` do Render cung cấp.
- Health check: `/api/v1/ready` thực sự truy vấn PostgreSQL; `/health` chỉ kiểm tra tiến trình.
- Đặt `NODE_ENV=production`, cookie Secure và origin HTTPS chính xác. Không bật CORS tùy ý để bỏ qua lỗi proxy.
- Cron `0 2 * * *` UTC = 09:00 Việt Nam chạy `node app/server/src/jobs.js`. Có event key chống trùng; không dựa timer Express hoặc trình duyệt. [Render cron](https://render.com/docs/cronjobs), [Blueprint reference](https://render.com/docs/blueprint-spec).
- Cron trên Render hiện chạy nhắc hạn/dọn file. Backup nội dung cần đích lưu bền vững được bảo vệ và PostgreSQL client tương thích; bản local có Windows scheduler sao lưu về máy. Đừng đặt backup duy nhất trên đĩa tạm của Render rồi coi là đã được bảo vệ.

## Vercel frontend

Import repository với root directory là thư mục chứa `package.json` gốc. `vercel.json` build workspace frontend và xuất `app/client/dist`.

Thay duy nhất `https://REPLACE-WITH-YOUR-API.onrender.com` trong rewrite bằng backend của bạn. `/api/:path*` đi qua external rewrite đến Express, tiếp theo là fallback React Router. [Tài liệu rewrite chính thức](https://vercel.com/docs/routing/rewrites).

Frontend luôn gọi `/api/v1` cùng origin, không lưu JWT/refresh trong localStorage. Refresh cookie không có Domain cố định; reverse proxy phải giữ Set-Cookie/Origin. Không chuyển upload 20 MB qua một Vercel Function wrapper mà chưa kiểm tra giới hạn của function. Luồng đã chọn là external proxy đến Express. Khả năng proxy gói thực xử lý file 20 MB và timeout cần kiểm chứng trên URL thật.

## Cloudinary và kiểm tra trước mở demo

1. Cấu hình credential backend và chạy `npm run verify:cloudinary -- --expiry`.
2. Xác nhận PDF 20 MB raw/authenticated upload/download đúng checksum, PDF được phép phân phối, link thực sự bị từ chối sau 5 phút, ảnh công khai tải được.
3. Chạy `npm run seed:cloud` ở môi trường demo riêng nếu cần các ví dụ nộp muộn/nộp lại/kết quả có file thật.
4. Kiểm tra trực tiếp API/file với sinh viên ngoài nhóm, giảng viên cũ, cán bộ khác khoa và admin kỹ thuật.
5. Chạy lại E2E trên URL staging thật; xác nhận cookie Secure/HttpOnly/SameSite, CSRF, upload 20 MB, idempotency, scheduler và log.
6. Backup database **và byte nội dung file**, restore vào database trống riêng, đăng nhập/mở hồ sơ/tải lại/checksum trước khi đánh dấu nghiệm thu.

Cloudinary phân biệt URL phân phối ký thông thường và URL tải có thời hạn. Adapter dùng `private_download_url` với `expires_at=now+300`, đúng resource/delivery type; chỉ kiểm thử SDK/ký URL local chưa chứng minh dịch vụ thực đã hết hạn. [Kiểm soát truy cập Cloudinary](https://cloudinary.com/documentation/control_access_to_media), [raw upload](https://cloudinary.com/documentation/upload_parameters).

Các phép đo và test local không thay thế TC27/TC35 phần nội dung file/TC36 triển khai thực. Những mục này còn mở trong TEST_REPORT.md.
