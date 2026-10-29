# Báo cáo kiểm thử thực tế

Ngày bàn giao: 22/10/2026, giờ Việt Nam. Workspace `D:\Website_HTWLHD_SV_NCKH`; không có Git repository/commit ban đầu. Dấu vân tay mã nguồn và kiểm tra cuối được ghi trong `QA_RESULTS.json`.

## Môi trường và kết quả

- Node.js 24.12.0, PostgreSQL 17.6 thật, Windows, Intel i5-12500H / 16 GB RAM.
- Vitest/Supertest: **51/51 đạt**; 42 test API và 9 test thuật toán/file/CSV. [Kết quả máy đọc](vitest-results.json).
- Playwright Chromium: **8/8 đạt**. [Kết quả máy đọc](playwright-results.json), [ảnh chụp](screenshots/).
- `npm run build`, `npm run lint`: đã chạy thành công; kiểm tra cuối ghi lại trong QA_RESULTS.json.
- Migration từ database trống đã chạy trên database test/E2E/benchmark. 34 bảng, 5 migration; FK/composite FK, partial unique, exclusion grants, trigger append-only và deadlineVersion được thực thi.
- PostgreSQL backup/restore vào database riêng thành công; **0 file Cloudinary** ở database local hiện tại, không xem đây là restore nội dung file. [Bằng chứng](RESTORE_RESULTS.json).
- Scheduler Windows đã chạy thực, LastTaskResult=0, có log nhắc hạn/backup. [Bằng chứng](SCHEDULER_RESULTS.json).
- Dependency audit sau cập nhật Router/Sharp/Vite/Vitest/deepmerge-ts: không còn advisory tại thời điểm chạy; lưu DEPENDENCY_AUDIT.json.

Database riêng: `nckh_test` reset cho Vitest, `nckh_e2e` reset cho Playwright, `nckh_bench` cho 1.000 đề tài. Không reset database ứng dụng. Mock chỉ trong test: Cloudinary transport, lỗi corpus được inject có chủ đích và inventory trả rỗng cho cleanup test. Phần lớn thao tác API chạy qua PostgreSQL/constraint/transaction thật. E2E không mock response API; test upload khi chưa cấu hình xác nhận lỗi 503 thật.

## 36 kịch bản trong hồ sơ

| Ca   | Kết quả hiện tại                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TC01 | Đạt local: login đúng/sai/khóa và JWT; không trả hash                                                                                         |
| TC02 | Đạt local: rotation, hai refresh cùng token, reuse thu hồi family; frontend hai tab E2E                                                       |
| TC03 | Đạt local: logout, đổi/reset mật khẩu, khóa chặn JWT còn hạn                                                                                  |
| TC04 | Đạt local: CB không cấp admin/scope; không gỡ/khóa admin cuối                                                                                 |
| TC05 | Đạt local: hai nhóm cùng mời một SV; một membership active; đóng đợt chặn accept                                                              |
| TC06 | Đạt local: hai lời mời tranh một chỗ, không vượt max                                                                                          |
| TC07 | Đạt local: leader không rời trước chuyển quyền                                                                                                |
| TC08 | Đạt local: đóng nhóm chưa có hồ sơ giải phóng chỗ và không tái dùng                                                                           |
| TC09 | Đạt local: thiếu consent/đợt đóng/form sai/stale không gửi; đổi nội dung hủy xác nhận cũ                                                      |
| TC10 | Đạt local: submit/retry đồng thời một snapshot; key khác payload 409                                                                          |
| TC11 | Đạt local: nháp nhóm khác bị chặn trực tiếp API                                                                                               |
| TC12 | Đạt local: CB khác khoa không duyệt/cấp link                                                                                                  |
| TC13 | Đạt local: snapshot sai bị chặn; approval chạy tương tự, tăng corpus version                                                                  |
| TC14 | Đạt local parser: giả đuôi/PDF lỗi/ZIP sai/macro/MB thập phân; PDF/ảnh thực được parse                                                        |
| TC15 | Đạt state với transport mock: upload lỗi chưa thành submission; xóa/finalize cạnh tranh không gắn asset đang xóa. Dịch vụ thật chờ credential |
| TC16 | Đạt local: pending/sai topic/sai purpose/giờ tự khai bị chặn; ảnh không thay tài liệu report                                                  |
| TC17 | Đạt local với file transport mock: retry cùng submission, version không trùng                                                                 |
| TC18 | Đạt local: trước/đúng/sau deadline, đúng +1 ms là muộn; snapshot hạn cũ giữ nguyên                                                            |
| TC19 | Đạt local: GV khác/bản cũ không đổi trạng thái hiện hành                                                                                      |
| TC20 | Đạt local: accepted không nộp lại, reopen có lý do mới mở                                                                                     |
| TC21 | Đạt local: reopen/nghiệm thu cùng lúc chỉ một hành động phù hợp thắng; % không tự nghiệm thu                                                  |
| TC22 | Đạt local: failed dù điểm 9.5; passed dù điểm 2; không suy kết quả từ score                                                                   |
| TC23 | Đạt local: sửa sai version mới, bản cũ không được UPDATE                                                                                      |
| TC24 | Đạt local: academic/members/supervisor qua request, consent, roster/leader/snapshot/corpus                                                    |
| TC25 | Đạt local: trước/sau duyệt, tái tham gia, grant theo thời gian; meta progress/audit không lộ số sự kiện ngoài quyền                           |
| TC26 | Đạt local: GV cũ/admin kỹ thuật không đọc workspace/cấp link riêng                                                                            |
| TC27 | **Chưa đạt dịch vụ thật**: chỉ xác nhận SDK ký TTL 300s/no-store; chưa thử link hết hạn tại Cloudinary                                        |
| TC28 | Đạt local: đề nghị pending giữ nhóm; CB approve mới hủy/đóng                                                                                  |
| TC29 | Đạt local/E2E: CSV đúng cùng filter/scope/tổng distinct                                                                                       |
| TC30 | Đạt local: vô hiệu hóa ô CSV có dấu công thức và giữ văn bản thường                                                                           |
| TC31 | Đạt nhắc hạn/OS scheduler; deadlineVersion chống trùng kể cả quay lại ngày cũ. Cleanup có mock, chưa chạy Cloudinary thật                     |
| TC32 | Đạt local: corpus rỗng thành công; lỗi corpus trả lỗi, giữ nháp, không giả điểm 0                                                             |
| TC33 | Đạt kiểm thử kỹ thuật: 60 cặp tổng hợp, nhãn theo cách sinh, tách nguồn; chưa phải đánh giá học thuật độc lập                                 |
| TC34 | Đã đo 1.000 đề tài local, tuần tự; HTTP lookup p95 khoảng 6 ms. Chưa đo tải/mạng triển khai thật                                              |
| TC35 | Đạt database restore; **chưa kiểm chứng byte file Cloudinary và restore toàn phần**                                                           |
| TC36 | **Chưa chạy** Vercel/Render/Supabase thật: thiếu tài khoản, URL và credential                                                                 |

## Hiệu năng và tương tự

[PERFORMANCE_RESULTS.json](PERFORMANCE_RESULTS.json) ghi máy, số mẫu, warm-up, concurrency=1, thời gian PostgreSQL riêng, API đầy đủ và thuật toán riêng. API bao gồm xác thực/session, filter/count/phân trang/enrich metadata và parse response. Mục tiêu p95 dưới 2 giây đạt trong cấu hình local đã đo; không suy ra đạt trên mạng/deploy hoặc tải đồng thời.

[SIMILARITY_RESULTS.json](SIMILARITY_RESULTS.json) ghi 39 cặp hiệu chỉnh/21 cặp test theo 20 nhóm nguồn không giao nhau, ngưỡng khóa trước test, precision/recall/TP/TN/FP/FN. Bộ tổng hợp tạo nhãn bằng cách sinh và dễ hơn dữ liệu nghiên cứu thực; tỷ lệ trên đó không được dùng để tuyên bố chính xác học thuật hoặc tỷ lệ đạo văn.

## Các phần còn phụ thuộc

Cập nhật 28/10/2026: credential Cloudinary đã có trong `.env` local, sau khi cấp quyền cho API key, `npm run verify:cloudinary -- --expiry` đạt cả 4 mục (upload 10 MB, tải PDF riêng đúng checksum, link bị từ chối sau 5 phút, ảnh công khai). Tải 10 MB qua `private_download_url` mất ~88 giây trong khi mạng chung tải 10 MB ~11 giây; probe chờ tối đa 280 giây. Gói Free giới hạn raw 10.485.760 byte, chủ dự án quyết định hạ giới hạn tài liệu xuống 10 MB (lệch NFR02 gốc 20 MB). Supabase: đã chạy 5 migration (34 bảng, `pg_trgm`, `btree_gist`), `/api/v1/ready` đạt khi trỏ tới Supabase; chưa có tài khoản admin. Còn mở: cấp quyền key rồi chạy `npm run verify:cloudinary -- --expiry`, `npm run seed:cloud`, backup/restore byte file, TC27/35, Vercel/Render và TC36. Không có quota/gói dịch vụ nào được tự mua.

Không đánh dấu dự án hoàn tất nghiệm thu toàn bộ khi những mục này chưa được kiểm chứng. Mã adapter, probe, scheduler, template deploy và tài liệu đã được bàn giao để tiếp tục trên dịch vụ thật.
