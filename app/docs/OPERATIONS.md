# Vận hành, scheduler, backup và restore

## Scheduler local đã cài

Windows task **ResearchHubNCKH-Daily**, 09:00 mỗi ngày theo múi giờ máy (máy này UTC+7), chạy script `app/scripts/run-daily.ps1` trong workspace. Task dùng tài khoản hiện tại, quyền Limited, cửa sổ ẩn; cần máy hoạt động và tài khoản đăng nhập. `StartWhenAvailable` cho phép chạy bù khi có thể. Không phụ thuộc trình duyệt mở hoặc timer của Express.

Đã chạy thử thành công, LastTaskResult=0; minh chứng lưu tại [SCHEDULER_RESULTS.json](SCHEDULER_RESULTS.json). Log local `.local/daily-jobs.jsonl`. Lần chạy khi thiếu Cloudinary bỏ qua cleanup có ghi rõ, vẫn chạy nhắc hạn và backup database không có file.

```powershell
# Cài lại nếu chuyển workspace/máy; lệnh cũng chạy thử một lần
powershell -NoProfile -ExecutionPolicy Bypass -File app/scripts/install-scheduler.ps1
# Gỡ task khi không còn dùng
powershell -NoProfile -ExecutionPolicy Bypass -File app/scripts/install-scheduler.ps1 -Remove
# Chạy CLI không chờ lịch
npm run jobs
npm run daily
```

`run-daily.ps1` chỉ khởi động PostgreSQL portable khi DATABASE_URL là loopback. Với database remote, không tạo database local tự động. Production dùng Render cron hoặc scheduler ngoài browser/instance; mẫu Render chưa deploy.

## Nhắc hạn và dọn file

Nhắc các mốc trong 3 ngày tới hoặc đã quá hạn, chỉ đề tài đang được duyệt/thực hiện và mốc chưa đạt hoặc được mở lại. Unique `(recipientId,eventKey)` chặn trùng. Key chứa mốc, **deadlineVersion**, deadline và loại upcoming/overdue. Trigger tăng deadlineVersion khi đổi hạn, kể cả quay lại ngày cũ. Chạy lại job không spam cùng sự kiện.

Lời mời/đề nghị quá hạn được chuyển expired; idempotency record hết 24 giờ được dọn. File pending/failed/ready chưa tham chiếu quá 24 giờ được đối chiếu trước khi xóa. File gắn snapshot/submission không xóa. Trước xóa asset, file không còn ready để tránh finalize đồng thời; xóa thất bại giữ trạng thái retry được. Job còn đối chiếu remote asset không có metadata sau lỗi upload/DB, và ảnh đại diện cũ. Cần credential Cloudinary mới kiểm chứng cleanup thật; test transport có mock riêng.

Không xóa thủ công ảnh/tài liệu đã được tham chiếu trên Cloudinary. `nckh-probes/` là vùng probe có cleanup riêng; nếu probe bị ngắt, kiểm tra các asset này trước khi dọn.

## Backup

```powershell
npm run backup
# Hoặc chọn thư mục riêng được bảo vệ
npm run backup -- .local/backup-manual
```

`PG_BIN` chỉ thư mục có pg_dump/pg_restore phiên bản tương thích server. Credentials PostgreSQL truyền qua environment của tiến trình con, không đưa vào argv/log. Backup gồm:

- `database.dump` dạng custom từ pg_dump.
- `manifest.json` với checksum dump, file, kích thước và trạng thái complete.
- `files/<attachmentId>` là **byte file đã tải**, không phải link Cloudinary. File ready phải tải và khớp SHA-256/kích thước.
- Bản sao byte ảnh đại diện cùng checksum khi có ảnh.

Windows giới hạn ACL thư mục backup cho người dùng hiện tại và SYSTEM; Linux tạo thư mục 0700/file 0600. Không commit backup. Job daily giữ 7 thư mục backup hoàn chỉnh do ứng dụng tạo, có marker `generatedBy=research-hub-v1`, kiểm tra đường dẫn trước khi dọn. Backup thủ công ngoài thư mục `backups/` không thuộc retention này. Bản backup đang dở không được đánh dấu complete hoặc dùng restore.

Backup dùng advisory lock nghiệp vụ khi chụp dump/manifest. Phù hợp quy mô bản đầu; dataset lớn cần thiết kế thêm thời gian bảo trì hoặc snapshot nhất quán có kiểm soát. Dùng project/database riêng cho ứng dụng để không đưa dữ liệu hệ thống khác vào dump. Muốn có khả năng phục hồi sau mất máy, cần sao chép backup sang đích riêng đã được cấp quyền và bảo vệ; chưa có đích remote bổ sung nào trong phiên này.

## Restore

Restore luôn vào **database mới, trống, tên kết thúc `_restore`**. Script từ chối ghi đè database đã có bảng, không tự clean/drop production. Đặt `RESTORE_DATABASE_URL` trong môi trường được bảo vệ; không truyền URL chứa mật khẩu vào lệnh.

```powershell
npm run restore -- <thu-muc-backup>
```

Script xác minh manifest/checksum, restore database, upload lại byte file vào namespace `nckh-restore/` với ID mới, cập nhật attachment trên database restore, tải lại từng file để so checksum. Ảnh đại diện restore vào namespace riêng. Không ghi đè asset của hệ thống đang chạy. Giữ Cloudinary credential phù hợp môi trường khôi phục; không dùng ảnh/file restore lẫn với production khi chưa xem xét.

Với database local hiện chưa có nội dung file Cloudinary thật, phép kiểm chứng riêng:

```powershell
npm run verify:restore
```

Lệnh tạo một database `nckh_verify_*_restore` mới, backup/restore và ghi [RESTORE_RESULTS.json](RESTORE_RESULTS.json). **Đã kiểm chứng database**, chưa kiểm chứng khôi phục nội dung Cloudinary. Chỉ với backup không có file, `--allow-empty-files` mới cho phép xác nhận phạm vi database; không dùng cờ đó để bỏ qua nội dung file bị thiếu.

## Log và khắc phục sự cố

- API lỗi có requestId; log server chỉ ghi mã/lần lỗi, không password, raw token, connection string hay signed download URL.
- `/api/v1/ready` lỗi 503: kiểm tra tiến trình PostgreSQL, URL và mạng; không xuất secret vào terminal chia sẻ.
- Upload 503: kiểm tra credential/quota/PDF; upload chưa được tính là báo cáo đã nộp.
- Xung đột revision 409: tải lại, xem dữ liệu mới, gửi lại ý định hợp lệ.
- Refresh reuse 401: family đã bị thu hồi; đăng nhập lại. Không đổi sang lưu raw token trong localStorage để xử lý.
- Dời thư mục dự án: cài lại Windows task và chỉnh PG_BIN nếu cần.
