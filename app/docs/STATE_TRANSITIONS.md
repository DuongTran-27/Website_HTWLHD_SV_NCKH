# Bảng chuyển trạng thái hiện thực

Các quyết định ghi trong transaction có khóa PostgreSQL, revision và idempotency cho thao tác quan trọng. Snapshot/review/evaluation/audit append-only bằng trigger. API không nhận PATCH status tùy ý.

## Đề tài

| Từ                       | Thao tác                      | Người thực hiện               | Sang / điều kiện                                                                                                                                       |
| ------------------------ | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| draft, revision_required | submit                        | Trưởng nhóm hiện hành         | submitted; đúng hạn, form đủ, nhóm đúng min/max/khoa, GV nhận đúng hash, file ready, tương tự thành công; tạo snapshot                                 |
| submitted                | approve                       | CB đúng scope, không tự duyệt | approved; đúng revision/currentRevisionId; GV còn hoạt động/đã đồng ý; >=3 mốc required có hạn tương lai; kiểm tra lại corpus; cảnh báo cần giải trình |
| submitted                | request_revision              | CB                            | revision_required; lý do                                                                                                                               |
| submitted                | reject                        | CB                            | rejected; lý do, đóng nhóm/giải phóng chỗ                                                                                                              |
| approved                 | start                         | GV hiện hành hoặc CB          | in_progress                                                                                                                                            |
| in_progress              | request-evaluation            | Trưởng nhóm                   | pending_evaluation; mọi mốc required có bản hiện hành accepted, không reopened, không change/cancel pending                                            |
| pending_evaluation       | return-to-progress            | GV hiện hành                  | in_progress; lý do và mốc cần mở lại                                                                                                                   |
| pending_evaluation       | evaluation                    | GV hiện hành                  | completed; kiểm tra lại mốc trong cùng giao dịch; passed/failed và nhận xét, score tùy chọn; đóng nhóm                                                 |
| Chưa kết thúc            | cancel / cancellation approve | CB                            | cancelled; lý do, đóng nhóm, giải phóng chỗ                                                                                                            |
| completed                | evaluation-correction         | CB                            | completed; evaluation.version mới, correctionReason, giữ bản trước                                                                                     |

Không mở lại rejected/cancelled. Nội dung/thành viên khóa khi submitted. Sau approved/in_progress thay qua change-request. Hoàn thành/từ chối/hủy không xóa lịch sử.

## Bản báo cáo và mốc

| Từ                                               | Hành động                       | Kết quả                                                                                                    |
| ------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Chưa có bản / pending_review / changes_requested | Finalize 1–5 file ready         | Phiên bản mới pending_review, ít nhất một report PDF/Office; ảnh riêng bổ trợ; lưu giờ/hạn/late server     |
| pending_review, changes_requested                | GV nhận xét comment_only        | Append review, không đổi quyết định                                                                        |
| pending_review, changes_requested                | GV changes_requested / accepted | Append review, cập nhật đúng bản hiện hành                                                                 |
| accepted                                         | comment_only                    | Chỉ thêm nhận xét; không đổi quyết định bằng review trực tiếp                                              |
| Mốc current accepted                             | GV reopen                       | resubmissionAllowed=true, revision tăng, lý do/audit; mất điều kiện nghiệm thu                             |
| Mốc reopened                                     | Finalize bản mới                | Version mới pending_review, resubmissionAllowed=false; vẫn chưa đủ nghiệm thu cho đến khi bản mới accepted |

Retry cùng idempotency key/payload trả cùng bản. File đã gắn bản nộp không dùng lại cho bản khác. `isLate = submittedAt > deadlineSnapshot`; đúng deadline không muộn. Thay hạn không viết lại snapshot cũ.

## Lời mời và hướng dẫn

| Từ      | Hành động          | Sang                                                                              |
| ------- | ------------------ | --------------------------------------------------------------------------------- |
| pending | Người nhận accept  | accepted, chưa hết hạn; initial invitation kiểm tra lại period/khoa/slot/capacity |
| pending | Người nhận decline | declined                                                                          |
| pending | Trưởng nhóm cancel | cancelled                                                                         |
| pending | Job khi quá hạn    | expired                                                                           |

Accepted/declined/cancelled/expired không phản hồi lại. Lời mời approved_change accepted chỉ là consent; CB áp dụng membership sau. Đề nghị supervision initial accepted gắn academicHash; sửa học thuật/GV đề xuất hủy xác nhận cũ. Replacement accepted chỉ có hiệu lực phân công sau khi CB duyệt change.

## Thay đổi và hủy

| Từ             | Hành động                | Sang                                 |
| -------------- | ------------------------ | ------------------------------------ |
| pending        | Người yêu cầu withdraw   | withdrawn                            |
| pending        | CB reject có lý do       | rejected                             |
| pending        | CB approve có lý do      | approved; áp dụng trong transaction  |
| pending change | baseRevision đã thay đổi | conflicted; không áp dụng dữ liệu cũ |

Academic: kiểm tra đầy đủ và tương tự lại; tạo snapshot approved_change, publish corpus version mới. Members: consent người mới, min/max/chỗ/cùng khoa kiểm tra lúc áp dụng; chuyển leader hợp lệ và tạo/đóng khoảng quyền. Supervisor: GV mới nhận đúng nội dung; kết thúc assignment cũ và chấm dứt quyền GV cũ. Pending cancellation không làm topic cancelled cho tới quyết định.

## Tài liệu và phiên

File pending → ready sau upload/xác minh, pending → failed nếu lỗi. File chưa tham chiếu chuyển failed với dấu dọn/xóa trước khi gọi dịch vụ để chặn finalize cạnh tranh; xóa asset rồi mới xóa metadata chưa có lịch sử. Ready đã tham chiếu được giữ lại.

Refresh session mới → rotated (giữ hash cũ) → session mới trong cùng family; hết 7 ngày tuyệt đối không gia hạn. Reuse token đã xoay/thu hồi thu hồi family trong giao dịch vẫn commit. Logout/khóa/đổi/reset/quyền thay đổi thu hồi phiên; middleware kiểm tra user/session/authVersion ở mọi API nên JWT còn hạn cũng bị chặn.
