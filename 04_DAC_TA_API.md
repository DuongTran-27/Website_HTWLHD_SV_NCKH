# Đặc tả API để kiểm tra thiết kế

Phiên bản kiểm tra 1.0 ngày 21/10/2026. Tài liệu quy ước và hợp đồng thiết kế; chưa phải server hoặc tệp OpenAPI đã thực thi. Mã FR tham chiếu tài liệu 01, dữ liệu tham chiếu tài liệu 03.

## 1 Quy ước

| Nội dung | Quyết định |
|---|---|
| Base | /api/v1 |
| Resource | Danh từ số nhiều, kebab-case; ví dụ research-periods |
| Dữ liệu | JSON UTF-8, camelCase; upload multipart, export text/csv |
| ID | UUID hợp lệ, không dùng mã đề tài thay ID |
| Ngày giờ | ISO 8601 UTC, ví dụ 2026-10-21T08:00:00Z |
| Xác thực | Authorization: Bearer accessToken; refresh token chỉ trong cookie HttpOnly/Secure |
| CSRF | Kiểm tra Origin và cơ chế CSRF cho thao tác cookie, nhất là refresh/logout; không bỏ qua do frontend ẩn nút |
| Phân trang | page >=1; pageSize mặc định20 tối đa100; totalItems/totalPages |
| Sắp xếp | sort=createdAt hoặc -createdAt; whitelist theo từng resource |
| Filter | search, facultyId, periodId, academicYear, supervisorId, fieldId, status, result; chỉ hỗ trợ trường phù hợp resource |
| Revision | Body revision cho cập nhật/quyết định; mismatch ->409, không tự overwrite |
| Idempotency | Bắt buộc trên submit, quyết định, submission, evaluation, áp dụng thay đổi/hủy; khóa do client sinh một lần cho một thao tác |
| Tài nguyên | Không tìm thấy/không được biết tồn tại ->404; không có quyền hành động trên tài nguyên đã được xem ->403 |
| Trạng thái | Backend gán/chuyển; không nhận PATCH status tùy ý |
| Trường cấm | Từ chối trường không hỗ trợ trên write; không cho client tự gán tác giả/khoa chủ trì/time nộp/điểm tương tự |

Logout xóa cache nhạy cảm UI. Access token trong memory; frontend điều phối refresh một luồng và giữa tab; không lưu raw refresh trong localStorage. Mỗi API kiểm tra tài khoản/session và scope hiện hành.

## 2 Response và lỗi

Thành công có body:

```json
{
  "data": {
    "id": "81f7b3ea-a1ee-4b7d-9b26-b49556919f31",
    "status": "draft",
    "revision": 1
  },
  "requestId": "req-20261021-001"
}
```

Danh sách thêm meta:

```json
{
  "data": [],
  "meta": {"page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0},
  "requestId": "req-20261021-002"
}
```

Lỗi:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
    "details": {"currentRevision": 4}
  },
  "requestId": "req-20261021-003"
}
```

Không trả stack trace, connection string, raw token, Cloudinary secret hoặc nội dung riêng của đề tài khác. details validation có fields; details lỗi quyền không tiết lộ hồ sơ bị chặn.

| HTTP | Dùng khi | Mã nghiệp vụ tiêu biểu |
|---|---|---|
| 200 | GET/PATCH/action thành công; có cảnh báo tương tự vẫn thành công | Không có error |
| 201 | Tạo tài nguyên | Không có error |
| 202 | Chỉ dùng khi thật sự có job đã được tiếp nhận | Job có status URL; không dùng cho lỗi bị bỏ qua |
| 204 | Xóa liên kết/đăng xuất thành công không body | Không có body |
| 400 | JSON/query sai cấu trúc | MALFORMED_REQUEST |
| 401 | Phiên/token không hợp lệ | UNAUTHENTICATED, SESSION_REVOKED |
| 403 | Không được làm hành động | ACTION_FORBIDDEN |
| 404 | Tài nguyên không có/không được biết | RESOURCE_NOT_FOUND |
| 409 | Xung đột hoặc điều kiện trạng thái | REVISION_CONFLICT, INVALID_TRANSITION, MEMBER_ALREADY_ACTIVE, TEAM_FULL, IDEMPOTENCY_CONFLICT, CORPUS_CHANGED |
| 413 | File vượt dung lượng | FILE_TOO_LARGE |
| 415 | Định dạng không hỗ trợ | UNSUPPORTED_FILE_TYPE |
| 422 | Dữ liệu không đạt điều kiện | VALIDATION_FAILED, SUPERVISOR_NOT_CONFIRMED, REQUIRED_MILESTONE_NOT_ACCEPTED |
| 429 | Quá giới hạn request | RATE_LIMITED |
| 500 | Lỗi nội bộ | INTERNAL_ERROR |
| 503 | Database/file/kiểm tra tương tự tạm không sẵn sàng | DEPENDENCY_UNAVAILABLE, SIMILARITY_UNAVAILABLE |

409 dùng cho vi phạm unique hay trạng thái do dữ liệu hiện hành thay đổi; không trả 500 cho lỗi nghiệp vụ dự kiến. Lý do từ chối/sửa/hủy tối thiểu 10 tối đa 2.000 ký tự trong thiết kế form.

## 3 Tài khoản và tổ chức

Quyền: ANY=đã đăng nhập; SV=student; TN=trưởng nhóm; GV=giảng viên được phân công hoặc người nhận đề nghị; CB=cán bộ đúng khoa; QT=admin. ADMIN không tự có quyền CB. Mọi endpoint dưới đây dùng tiền tố /api/v1.

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| POST | /auth/login | Chưa đăng nhập | email/password -> accessToken, user và thời hạn; refresh cookie |
| POST | /auth/refresh | Cookie hợp lệ | CSRF/Origin -> accessToken mới, xoay refresh cookie |
| POST | /auth/logout | Session hiện tại | Thu hồi session/family phù hợp, xóa cookie ->204 |
| GET | /auth/me | ANY | Hồ sơ cơ bản, roles, scopes, mustChangePassword |
| PATCH | /auth/password | ANY | currentPassword/newPassword -> thu hồi mọi phiên, yêu cầu đăng nhập lại |
| GET | /users | CB/QT | Filter role/faculty/search -> danh sách được phép, không hash/session |
| GET | /users/:id | Chủ tài khoản/CB/QT | Hồ sơ cho mục đích quản lý theo scope |
| POST | /users | CB/QT | accountCode/email/fullName/facultyId/classId/roles cơ bản ->201; cấp mật khẩu ban đầu qua kênh quản lý |
| PATCH | /users/:id | CB/QT | revision và trường hồ sơ được phép/status; không nhận roles/scopes ở endpoint này |
| POST | /users/import | CB/QT | CSV giới hạn theo cấu hình -> số dòng thành công/lỗi; validate toàn bộ trước, có lỗi thì không ghi một phần |
| POST | /users/:id/reset-password | CB/QT | reason -> đặt lại, mustChangePassword và thu hồi phiên |
| PUT | /users/:id/roles | QT | revision/roles -> cập nhật có audit; không được loại admin cuối cùng |
| PUT | /users/:id/management-scopes | QT | revision/facultyIds -> cập nhật có audit; áp dụng ngay cho session hiện hành |
| GET | /faculties | ANY | Danh mục đang dùng |
| POST | /faculties | QT | code/name ->201 |
| PATCH | /faculties/:id | QT | name/isActive/revision -> cập nhật, không xóa tham chiếu |
| GET | /majors | ANY | facultyId -> danh mục |
| POST | /majors | QT | facultyId/code/name ->201 |
| PATCH | /majors/:id | QT | name/isActive/revision -> cập nhật |
| GET | /classes | ANY | majorId/facultyId -> danh mục |
| POST | /classes | QT | majorId/code/name/admissionYear ->201 |
| PATCH | /classes/:id | QT | name/isActive/revision -> cập nhật |
| GET | /research-fields | ANY | Danh mục lĩnh vực |
| POST | /research-fields | QT | code/name ->201 |
| PATCH | /research-fields/:id | QT | name/isActive/revision -> cập nhật |
| GET | /lecturers | SV/CB/QT | Danh bạ hướng dẫn: id, tên, khoa, chuyên môn; không lộ email riêng/phiên |
| GET | /students/search | TN/CB | accountCode trong khoa -> thông tin tối thiểu để mời; giới hạn tần suất |
| GET | /research-periods | ANY | facultyId/status/academicYear -> danh sách |
| GET | /research-periods/:id | ANY theo scope hiển thị | Chi tiết hạn/min/max/biểu mẫu/mốc dự kiến |
| POST | /research-periods | CB | facultyId/name/academicYear/start/end/min/max/milestoneTemplates ->201 |
| PATCH | /research-periods/:id | CB | revision/trường cho phép/reason nếu thay hạn -> cập nhật |

Không trả danh sách toàn bộ sinh viên cho việc gõ tìm thành viên; tìm theo mã và phạm vi tối thiểu. Import CSV của CB chỉ tạo SV/GV trong scope, không cấp CB/QT. Chưa chốt ngưỡng CSV trước thì dùng cấu hình và kiểm thử, không nhận file vô hạn.

## 4 Nhóm và lời mời

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| GET | /teams | SV/CB | SV thấy nhóm hiện tại/lịch sử của mình; CB theo scope |
| POST | /teams | SV | periodId/name -> team, leader và membership tạo cùng transaction |
| GET | /teams/:id | Nhóm/CB | Thành viên, lời mời phù hợp quyền, revision |
| PATCH | /teams/:id | TN trước duyệt | name/revision -> cập nhật |
| POST | /teams/:id/invitations | TN | inviteeId/revision -> lời mời; sau duyệt phải gắn changeRequestId hợp lệ |
| GET | /team-invitations | Người nhận/TN | Chỉ lời mời của mình/nhóm mình |
| POST | /team-invitations/:id/respond | Người nhận | decision=accept/decline; revision -> kết quả, kiểm tra chỗ khi áp dụng |
| POST | /team-invitations/:id/cancel | TN | revision -> thu hồi pending |
| POST | /teams/:id/transfer-leadership | TN | newLeaderId/revision -> đổi trong transaction |
| POST | /teams/:id/leave | SV trước duyệt | revision -> rời; TN phải chuyển quyền trước |
| DELETE | /teams/:id/members/:studentId | TN trước duyệt | revision query + reason ->204; không xóa lịch sử row |
| POST | /teams/:id/close | TN | revision/reason -> chỉ nhóm chưa có topic, đóng và giải phóng chỗ |

Trong trạng thái submitted, roster bị khóa; phải yêu cầu sửa hoặc xử lý thay đổi đúng giai đoạn. Sau duyệt không dùng DELETE/leave trực tiếp mà qua change-request.

## 5 Đề tài hướng dẫn và xét duyệt

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| GET | /topics | ANY | Kho metadata approved/in_progress/pending_evaluation/completed; filter/paging |
| GET | /me/topics | SV/GV/CB | Danh sách công việc của mình, có thể gồm nháp/chờ duyệt theo quyền |
| POST | /topics | TN | teamId/fieldId/các trường học thuật/GV đề xuất ->201 draft; khoa/đợt suy ra từ nhóm |
| GET | /topics/:id | ANY | Metadata nếu thuộc kho chung; không lộ nháp |
| GET | /topics/:id/workspace | Có quyền hồ sơ | Nội dung đầy đủ, trạng thái, revision, hành động được phép |
| PATCH | /topics/:id | TN | revision/trường học thuật -> chỉ draft/revision_required |
| GET | /topics/:id/revisions | Có quyền phiên bản | Danh sách snapshot được xem |
| GET | /topics/:id/revisions/:version | Có quyền phiên bản | Snapshot và file theo quyền |
| POST | /topics/:id/supervision-requests | TN | lecturerId/revision -> pending request; có thể purpose replacement qua changeRequestId |
| GET | /supervision-requests | GV/TN/CB | Danh sách được phép |
| POST | /supervision-requests/:id/respond | GV nhận | decision/reason/revision -> accepted/declined |
| POST | /supervision-requests/:id/cancel | TN | revision -> thu hồi pending |
| GET | /topics/:id/supervisor-assignments | Có quyền hồ sơ | Lịch sử phân công |
| POST | /topics/:id/similarity-checks | TN/CB | revision -> kết quả kiểm tra trên dữ liệu server |
| GET | /topics/:id/similarity-checks | TN/CB | Lịch sử kết quả theo quyền |
| POST | /topics/:id/submit | TN | revision + Idempotency-Key -> snapshot và submitted; backend chạy lại kiểm tra |
| POST | /topics/:id/decisions | CB | action/revision/topicRevisionId/reason/warningJustification/milestones khi approve -> quyết định |
| POST | /topics/:id/start | GV/CB | revision -> in_progress |
| POST | /topics/:id/request-evaluation | TN | revision -> pending_evaluation nếu đủ điều kiện |
| POST | /topics/:id/return-to-progress | GV | revision/reason/reopenMilestoneIds -> in_progress |
| POST | /topics/:id/cancel | CB | revision/reason -> cancelled chủ động; giữ lịch sử |

Nếu thay nội dung học thuật đáng kể trước gửi sau khi GV đã nhận, đánh dấu cần xác nhận lại theo hash nội dung gắn supervision_request; không coi sự đồng ý cho một hồ sơ cũ là đồng ý mọi nội dung khác. Đây là điều kiện chi tiết cần kiểm tra cùng luồng hướng dẫn.

## 6 Yêu cầu thay đổi và hủy

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| GET | /topics/:id/change-requests | Có quyền hồ sơ | Lịch sử yêu cầu |
| POST | /topics/:id/change-requests | TN | type/afterData/reason/revision -> pending; beforeData do server chụp |
| POST | /change-requests/:id/withdraw | Người yêu cầu | revision -> withdrawn khi còn pending |
| POST | /change-requests/:id/decisions | CB | decision/reason/revision/topicRevision -> áp dụng hoặc từ chối; check lại chỗ/GV/tương tự |
| GET | /topics/:id/cancellation-requests | Có quyền hồ sơ | Lịch sử đề nghị hủy |
| POST | /topics/:id/cancellation-requests | TN | reason/revision -> pending |
| POST | /cancellation-requests/:id/withdraw | TN | revision -> withdrawn |
| POST | /cancellation-requests/:id/decisions | CB | decision/reason/revision -> hủy hoặc giữ đề tài |

afterData academic: chỉ các trường học thuật được phép; members: studentIds sau thay đổi và leaderId; supervisor: lecturerId. Server không nhận beforeData hoặc scope do client tự quyết. Một change-request pending/topic; một cancellation pending/topic; khi có bất kỳ yêu cầu pending không cho request-evaluation. Khi topic kết thúc, yêu cầu chưa giải quyết phải đóng/đánh dấu không còn áp dụng có audit.

## 7 Tiến độ file báo cáo và đánh giá

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| GET | /topics/:id/milestones | Có quyền hồ sơ | Mốc, bản hiện hành, hạn và quyền nộp |
| POST | /topics/:id/milestones | CB | name/code/deadline/required/output/sortOrder/revision ->201 |
| PATCH | /milestones/:id | CB | revision/các trường cho phép/reason -> cập nhật có audit |
| POST | /milestones/:id/reopen | GV | revision/reason -> cho phép nộp lại, ảnh hưởng điều kiện nghiệm thu |
| GET | /topics/:id/progress-updates | Có quyền hồ sơ | Phân trang nhật ký được phép |
| POST | /topics/:id/progress-updates | SV nhóm hiện hành | completedWork/difficulties/nextPlan/selfReportedPercent/milestoneId? ->201 |
| POST | /topics/:id/attachments | SV nhóm hiện hành | multipart một file + purpose; backend kiểm tra, upload Cloudinary ->201 ready hoặc lỗi |
| GET | /attachments/:id | Có quyền phiên bản | Metadata/status, không trả URL công khai |
| POST | /attachments/:id/download-links | Có quyền phiên bản | -> url, expiresAt; Cache-Control no-store |
| DELETE | /attachments/:id | Người upload theo quyền | Chỉ ready chưa gắn hồ sơ hoặc failed, không xóa đã nộp; xử lý an toàn tham chiếu ->204 |
| GET | /milestones/:id/submissions | Có quyền phiên bản | Danh sách lịch sử phù hợp khoảng quyền |
| POST | /milestones/:id/submissions | SV nhóm hiện hành | attachmentIds/note/milestoneRevision + Idempotency-Key ->201, cấp version và giờ nộp server |
| GET | /submissions/:id | Có quyền phiên bản | Chi tiết, file và review được phép |
| GET | /submissions/:id/reviews | Có quyền phiên bản | Lịch sử nhận xét |
| POST | /submissions/:id/reviews | GV | comment/decision/submissionRevision ->201; append-only |
| GET | /topics/:id/evaluations | Có quyền hồ sơ | Phiên bản đánh giá được phép |
| POST | /topics/:id/evaluations | GV | result/comment/score?/revision + Idempotency-Key ->201; completed |
| POST | /topics/:id/evaluation-corrections | CB | result/comment/score?/correctionReason/revision ->201 phiên bản mới |

Tài liệu proposal upload ở draft/revision_required; report ở in_progress; không upload báo cáo khi pending_evaluation trừ khi đã trả về in_progress. Endpoint file một file/request nhằm kiểm soát tài nguyên, tối đa 5 file khi finalize submission. Thất bại giữa upload và lưu DB không được trả như đã nộp; cleanup xử lý asset mồ côi.

## 8 Thông báo báo cáo và vận hành

| Method | Endpoint | Quyền | Input chính và đầu ra |
|---|---|---|---|
| GET | /notifications | ANY | Chỉ của mình; unread/page -> danh sách |
| PATCH | /notifications/:id | Chủ thông báo | read=true -> cập nhật idempotent |
| POST | /notifications/read-all | ANY | Đánh dấu thông báo của mình, không của người khác |
| GET | /reports/topics | GV/CB | Các filter hợp lệ + groupBy -> tổng, breakdown; scope server áp dụng |
| GET | /reports/topics/export | GV/CB | format=csv và cùng filters -> CSV; Content-Disposition attachment |
| GET | /topics/:id/audit-logs | Có quyền lịch sử | Chỉ sự kiện được phép, lọc dữ liệu nhạy cảm |
| GET | /health | Hạ tầng | Trạng thái tối thiểu, không thông tin secret |
| GET | /ready | Hạ tầng theo cấu hình | Kiểm tra phụ thuộc tối thiểu, không lộ chi tiết nội bộ |

Không mở endpoint HTTP công khai để chạy job dọn hoặc backup không xác thực. Job được gọi bằng scheduler có credential máy chủ; chạy lại không làm trùng thông báo hoặc xóa nhầm.

## 9 Ví dụ gửi xét duyệt

```http
POST /api/v1/topics/81f7b3ea-a1ee-4b7d-9b26-b49556919f31/submit
Authorization: Bearer <accessToken>
Content-Type: application/json
Idempotency-Key: cfb68a42-a30b-4495-94ee-751531439acb
```

```json
{"revision": 3}
```

```json
{
  "data": {
    "id": "81f7b3ea-a1ee-4b7d-9b26-b49556919f31",
    "status": "submitted",
    "revision": 4,
    "topicRevisionVersion": 1,
    "similarity": {
      "status": "succeeded",
      "hasWarning": true,
      "exactTitleMatch": true,
      "corpusVersion": 7,
      "matches": [
        {
          "topicId": "c94112f9-f0ca-4efa-ac40-17b73f9b5bb3",
          "title": "Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên",
          "titleScore": 1.0,
          "contentScore": 0.72
        }
      ]
    }
  },
  "requestId": "req-20261021-004"
}
```

Điểm trên chỉ minh họa cấu trúc response, không phải kết quả đo thuật toán. API thực trả algorithm/threshold versions để đối chiếu, không hard-code ngưỡng chưa hiệu chỉnh. Warning không chuyển rejected.

## 10 Ví dụ nộp báo cáo

```json
{
  "milestoneRevision": 2,
  "attachmentIds": ["873f27cd-a368-4cae-9bb7-3741efe62e2c"],
  "note": "Báo cáo giữa kỳ phiên bản cập nhật"
}
```

Backend trả submissionId/version/submittedAt/deadlineSnapshot/isLate/status. Không chấp nhận submittedAt/isLate/version từ client. Retry cùng Idempotency-Key trong 24 giờ trả cùng submission; khác payload trả409. UI lấy phiên bản cũ để xem không được tự đổi thành bản hiện hành.

## 11 Điều kiện để chuyển thành API thực thi

Tạo OpenAPI YAML/JSON với schema đầy đủ, security, enum, nullable, lỗi từng endpoint và ví dụ; đối chiếu Prisma schema; integration test quyền/trạng thái/file và idempotency. Tài liệu Markdown này không thay thế các kiểm tra đó và không chứng minh endpoint đã tồn tại.
