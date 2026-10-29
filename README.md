# Research Hub · Hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên

Ứng dụng JavaScript/JSX gồm React/Vite/Router, Tailwind, React Hook Form/Zod, TanStack Query, Express, PostgreSQL/Prisma, Cloudinary, pg_trgm và TF-IDF/cosine. Bốn vai trò, phân quyền đối tượng tại backend. Bộ hồ sơ ngày 21/10/2026 được giữ nguyên ở thư mục gốc.

**Trạng thái bàn giao:** các luồng local đã tích hợp và kiểm thử. Cloudinary thực, proxy/cookie HTTPS và triển khai Vercel/Render/Supabase còn chờ tài khoản. Không có kho file giả hoặc dashboard hard-code. Chi tiết bằng chứng: [báo cáo kiểm thử](app/docs/TEST_REPORT.md), [đối chiếu FR01–FR26](app/docs/REQUIREMENTS_MATRIX.md).

## Chạy ngay trên máy hiện tại

Mở PowerShell trong `D:\Website_HTWLHD_SV_NCKH`:

```powershell
npm run db:start
npm run dev
```

Mở **http://localhost:5173** hoặc **http://127.0.0.1:5173**. API: `http://localhost:4000/api/v1`; Swagger: `http://localhost:4000/api/v1/docs`.

Tài khoản hư cấu local:

| Vai trò                            | Email                              |
| ---------------------------------- | ---------------------------------- |
| Trưởng nhóm có hồ sơ nháp          | student1@demo.test                 |
| Sinh viên có đề tài đang thực hiện | student5@demo.test                 |
| Sinh viên còn trống để tạo nhóm    | student11@demo.test                |
| Giảng viên                         | lecturer1@demo.test                |
| Giảng viên khoa khác               | lecturer2@demo.test                |
| Cán bộ CNTT / Kỹ thuật             | staff@demo.test / staff2@demo.test |
| Quản trị kỹ thuật                  | admin@demo.test                    |

Mật khẩu demo là giá trị **DEMO_PASSWORD trong `.env`**, được tạo ngẫu nhiên khi thiết lập. Không đưa `.env` lên Git hoặc gửi secret vào chat. Tài khoản được tạo/import/reset qua UI phải đổi mật khẩu khi đăng nhập lần đầu. Seed demo bị chặn khi `NODE_ENV=production`.

Hiện không có credential Cloudinary: upload báo lỗi “Kho tài liệu chưa được cấu hình”. Hồ sơ, nhóm, xét duyệt, đối chiếu, nhật ký, thống kê và thông báo vẫn làm việc với PostgreSQL thật. Ví dụ báo cáo/đánh giá có file thật được bổ sung bằng `npm run seed:cloud` sau khi cấu hình dịch vụ; seed local không tạo asset giả.

## Cài mới

Yêu cầu Node.js 24 LTS và PostgreSQL 17 có `pg_trgm`, `btree_gist`. Phiên bản đã chạy: Node 24.12.0, PostgreSQL 17.6 trên Windows. Dependency được khóa trong `package-lock.json`; không có dependency thử nghiệm. Dùng bản vá Node 24 LTS hiện hành khi triển khai.

```powershell
npm ci --offline=false
node app/scripts/setup-local.js --env-only
npm run db:generate
```

Chọn PostgreSQL đã cài hoặc PostgreSQL portable. Trên Windows có thể tải binary ổn định từ [EDB, được PostgreSQL liên kết](https://www.postgresql.org/download/windows/) và giải nén `pgsql/bin`, `pgsql/lib`, `pgsql/share` vào `.local/pgsql`. Không cần cài Windows service. Các binary hiện có trong workspace máy này; chúng không thuộc mã nguồn bàn giao.

```powershell
npm run db:start
npm run setup:local
npm run similarity:evaluate
npm run similarity:publish
npm run dev
```

`setup:local` tạo database local `nckh`, `nckh_test`, `nckh_bench`, `nckh_restore`, chạy migration và seed. Chạy lại không ghi đè tài khoản/hồ sơ demo đã có. Nó kết nối PostgreSQL đã chạy, không tự khởi động database.

Với PostgreSQL/Supabase có sẵn, chỉnh `DATABASE_URL` và `MIGRATION_DATABASE_URL` trong `.env`, rồi chạy `npm run db:migrate` và `npm run db:seed`; không dùng `setup:local` để tự tạo database trên tài khoản managed không có quyền CREATE DATABASE. Tùy chọn Docker: `compose.yaml`, đặt `LOCAL_POSTGRES_PASSWORD` và URL tương ứng; không chạy Docker và portable cùng cổng 55432.

## Kiểm tra

```powershell
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run similarity:evaluate
npm run benchmark
npm run verify:restore
npm audit --offline=false
```

Vitest/Supertest dùng **nckh_test** riêng; Playwright dùng **nckh_e2e**, API 4101 và Vite 5174. Các database này được reset bởi test. Benchmark dùng **nckh_bench** riêng, 1.000 đề tài. Script restore kiểm chứng tạo một database `nckh_verify_*_restore` mới, giữ lại để kiểm tra. Không dùng database sản xuất cho test.

Mock chỉ có trong test transport Cloudinary. Các test API vẫn dùng PostgreSQL, FK, partial unique và transaction thật. Playwright dùng API thật, không mock dữ liệu trả về. Tệp `app/docs/*_RESULTS.json`, `vitest-results.json`, `playwright-results.json` và `screenshots/` ghi kết quả thực tế.

## Cloudinary

Điền cùng lúc `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` vào backend `.env` và khởi động lại API. Không dùng VITE\_\* cho secret. Sau đó:

```powershell
npm run verify:cloudinary -- --expiry
npm run seed:cloud
```

Probe upload/download PDF đúng `FILE_MAX` byte, so checksum, kiểm tra ảnh công khai, và thử chính link tải sau 5 phút. Giới hạn tài liệu và ảnh hiện là **4 MB** (4.000.000 byte): chủ dự án hạ từ 20 MB xuống 10 MB (28/10/2026, gói Cloudinary Free nhận raw tối đa 10.485.760 byte), rồi xuống 4 MB (29/10/2026) khi chuyển backend sang Vercel Functions vì request body tối đa 4,5 MB. Hồ sơ yêu cầu gốc vẫn ghi 20 MB/5 MB. Muốn nâng lại: chuyển upload sang trình duyệt → Cloudinary trực tiếp (hoặc chạy Express trên host không giới hạn body như Render) và nâng gói Cloudinary, rồi đổi `FILE_MAX`/`IMAGE_MAX` trong `app/server/src/files.js` và giới hạn ở `app/client/src/workspace.jsx`, `app/client/src/pages.jsx`. Nếu tài khoản chặn PDF, vượt quota hoặc không hỗ trợ raw/authenticated như yêu cầu, probe ghi fail; cần kiểm tra cấu hình/gói với chủ tài khoản.

Tài liệu PDF/DOCX/XLSX/PPTX đi qua Express, xác minh nội dung/cấu trúc, raw/authenticated. Ảnh nghiên cứu riêng tối đa 5.000.000 byte có thể làm tài liệu bổ trợ trong bản báo cáo có ít nhất một PDF/Office; tổng tối đa 5 tệp. Ảnh đại diện được decode, resize và lưu image/upload công khai. Upload thành công chỉ tạo file ready; finalize mới ghi giờ nộp, deadlineSnapshot và isLate.

## Cấu trúc

```text
app/client/src/      shell, các trang theo vai trò, workspace và API client
app/server/src/      auth, quyền, nhóm, hồ sơ, tiến độ, file, tương tự, báo cáo, jobs
app/server/prisma/   34 model, migration SQL có phiên bản và seed
app/scripts/         thiết lập, corpus, đo hiệu năng, probe Cloudinary, backup/restore
app/tests/           Vitest/Supertest và Playwright
app/docs/            OpenAPI, bằng chứng, hướng dẫn và đối chiếu yêu cầu
```

Prisma dùng scalar FK; các FK thường/composite, chỉ mục có điều kiện, ràng buộc khoảng quyền và trigger lịch sử nằm trong migration SQL. Mọi giao dịch ghi nghiệp vụ dùng một advisory lock PostgreSQL trong bản đầu để kiểm soát chỗ tham gia, corpus và điều kiện nghiệm thu. Đây là lựa chọn cho quy mô một trường; phép đo hiện tại chưa đánh giá thông lượng ghi đồng thời lớn.

## Vận hành và bàn giao

- [Hướng dẫn sử dụng theo vai trò và ảnh thật](app/docs/USER_GUIDE.md).
- [Đối chiếu 24 màn hình](app/docs/SCREEN_MAP.md).
- [OpenAPI JSON](app/docs/openapi.json), sinh lại bằng `npm run docs:api`.
- [Ví dụ gọi API](app/docs/API_EXAMPLES.md).
- [Triển khai Vercel/Render/Supabase](app/docs/DEPLOYMENT.md).
- [Scheduler, backup và restore](app/docs/OPERATIONS.md).
- [Thuật toán và giới hạn bộ nhãn](app/docs/SIMILARITY_REPORT.md).
- [Kết quả đo hiệu năng](app/docs/PERFORMANCE_REPORT.md).
- [Bảng chuyển trạng thái](app/docs/STATE_TRANSITIONS.md).

Windows Task Scheduler `ResearchHubNCKH-Daily` đã được tạo trên máy này: 09:00 mỗi ngày, chạy nhắc hạn/dọn file/backup và giữ 7 backup do ứng dụng tạo. Xem bằng chứng và giới hạn trong OPERATIONS.md. Có thể gỡ bằng `powershell -File app/scripts/install-scheduler.ps1 -Remove`. PostgreSQL dừng bằng `npm run db:stop`; tác vụ ngày sau sẽ khởi động lại database local nếu cần.
