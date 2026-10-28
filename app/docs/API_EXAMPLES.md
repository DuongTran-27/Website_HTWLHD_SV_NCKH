# Ví dụ gọi API

Swagger local: `http://localhost:4000/api/v1/docs`; schema [openapi.json](openapi.json). Ví dụ dùng ký hiệu `<...>`; không đặt token/password thật trong history shell hoặc repository. Có thể dùng Swagger local hoặc công cụ API có vùng secret được bảo vệ. Refresh cookie chỉ browser nhận, không lưu localStorage.

```http
POST /api/v1/auth/login
Origin: http://localhost:5173
X-CSRF-Protection: 1
Content-Type: application/json

{"email":"student1@demo.test","password":"<mật khẩu trong .env local>"}
```

Trả `{data:{accessToken,expiresIn:900,user},requestId}` và Set-Cookie HttpOnly. Các request dùng JWT phải kèm `Authorization: Bearer <accessToken>`; mọi write thêm Origin được cấp và `X-CSRF-Protection: 1`.

```http
GET /api/v1/me/topics?page=1&pageSize=20&sort=-createdAt
Authorization: Bearer <accessToken>
```

```http
POST /api/v1/topics/<topic-uuid>/submit
Authorization: Bearer <accessToken>
Origin: http://localhost:5173
X-CSRF-Protection: 1
Idempotency-Key: <uuid mới cho ý định gửi này; giữ khi retry>
Content-Type: application/json

{"revision":3,"attachmentIds":[]}
```

Backend chạy tương tự, kiểm tra consent và ghi snapshot; lỗi không chuyển trạng thái. Revision stale 409. Cùng idempotency key nhưng khác payload 409; không tự cấp key khác khi chưa biết request trước đã commit hay chưa.

```http
POST /api/v1/topics/<topic-uuid>/decisions
Authorization: Bearer <JWT cán bộ đúng khoa>
Origin: http://localhost:5173
X-CSRF-Protection: 1
Idempotency-Key: <uuid>
Content-Type: application/json

{"revision":4,"topicRevisionId":"<snapshot đã xem>","action":"approve","warningJustification":"Đã xem xét cảnh báo và chấp thuận vì phạm vi nghiên cứu khác biệt."}
```

Mốc copy từ đợt nếu không truyền milestones. Có thể gửi danh sách >=3 mốc required với code/name/expectedOutput/deadline/sortOrder theo schema OpenAPI.

Upload multipart qua `/topics/<id>/attachments`, trường `file`, `purpose=proposal|report|private_image`. Đây chỉ là bước chuẩn bị. Không gửi URL/asset ID tự khai.

```http
POST /api/v1/milestones/<milestone-uuid>/submissions
Authorization: Bearer <JWT thành viên hiện hành>
Origin: http://localhost:5173
X-CSRF-Protection: 1
Idempotency-Key: <uuid>
Content-Type: application/json

{"milestoneRevision":2,"attachmentIds":["<ready report attachment uuid>"],"note":"Bản báo cáo cập nhật"}
```

Trả version/submittedAt/deadlineSnapshot/isLate/status do server gán. Không nhận các trường đó từ client. Nộp lại phải upload file mới.

```http
POST /api/v1/attachments/<attachment-uuid>/download-links
Authorization: Bearer <JWT có quyền phiên bản>
Origin: http://localhost:5173
X-CSRF-Protection: 1
Content-Type: application/json

{}
```

Trả link 5 phút với Cache-Control no-store sau khi kiểm tra quyền của snapshot/submission. Không lưu link làm URL cố định, không đưa vào log hoặc response idempotency.

```http
GET /api/v1/reports/topics?status=in_progress&groupBy=field
Authorization: Bearer <JWT giảng viên/cán bộ>

GET /api/v1/reports/topics/export?status=in_progress
Authorization: Bearer <cùng JWT>
```

Hai endpoint dùng cùng filter/scope và evaluation hiện hành. CSV UTF-8 BOM, chống diễn giải công thức. API errors theo `{error:{code,message,details?},requestId}`; chi tiết không chứa secret hoặc nội dung của hồ sơ ngoài quyền.
