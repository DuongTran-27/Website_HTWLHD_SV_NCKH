# Cơ sở yêu cầu dự án

Thứ tự áp dụng: mục 13 là bộ quyết định hiện hành, được chốt ngày 21/10/2026 theo yêu cầu người dùng chọn phương án đề xuất. Nếu khác mục 1–12 thì áp dụng mục 13. Các mục cũ được giữ để tham khảo lịch sử; không tiếp tục dùng MongoDB, Mongoose, TypeScript hoặc Vercel Blob/Supabase Storage cho bản thiết kế hiện hành. Các giới hạn và quy tắc ở đây là baseline đồ án được người dùng ủy quyền lựa chọn, chưa phải quy chế chính thức của trường.

Ngày ghi nhận: 14/10/2026. Tài liệu này lưu core do người dùng cung cấp và bộ requirement/công nghệ đề xuất để triển khai. Chưa phải xác nhận quy chế của nhà trường. Không chỉnh sửa tài liệu đồng bộ trong sources/.

## 1. Core cần giữ

Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên, gồm:
- Quản lý danh sách đề tài, giảng viên hướng dẫn và nhóm sinh viên.
- Theo dõi tiến độ; lưu nhận xét và đánh giá của giảng viên.
- Lưu tài liệu, báo cáo, tệp đính kèm theo đề tài và giai đoạn, có phiên bản.
- Thống kê theo giảng viên, lĩnh vực, trạng thái và kết quả.
- Phát hiện và cảnh báo tên hoặc nội dung tương tự khi đăng ký mới.

Quy trình: đăng ký → kiểm tra tương tự → duyệt và phân công → thực hiện → nộp báo cáo → nhận xét/chỉnh sửa → đánh giá và hoàn thành.

Đồ án do nhóm 3 sinh viên thực hiện; giảng viên được ghi trong đề bài: Nguyễn Văn Trung. Ba sản phẩm: website demo, báo cáo đồ án thực tập, hướng dẫn sử dụng. Số 3 không phải giới hạn thành viên nhóm nghiên cứu trong website.

## 2. Vai trò

- Sinh viên: xem nhóm/đề tài của mình, cập nhật công việc, nộp báo cáo, xem phản hồi.
- Trưởng nhóm: thuộc tính của thành viên; tạo nhóm, quản lý thành viên trước duyệt, sửa và gửi hồ sơ đề tài.
- Giảng viên: theo dõi, nhận xét và đánh giá đề tài được phân công.
- Cán bộ khoa/quản trị viên: quản lý tài khoản, danh mục, đợt đăng ký, duyệt/phân công và thống kê.

## 3. Requirement chức năng

| Mã | Yêu cầu và đầu ra |
|---|---|
| FR01 | Đăng nhập/đăng xuất/đổi mật khẩu; chặn tài khoản khóa; kiểm tra vai trò và quyền với từng đối tượng ở máy chủ. |
| FR02 | Quản trị tạo/sửa/khóa tài khoản; mã sinh viên/giảng viên không trùng. |
| FR03 | Tạo nhóm, thêm/xóa thành viên, chỉ định một trưởng nhóm; kiểm tra thành viên trùng và giới hạn theo đợt. |
| FR04 | Quản lý lĩnh vực, năm học, đợt đăng ký, thời gian mở/đóng và số thành viên tối thiểu/tối đa. |
| FR05 | Lưu nháp/sửa/gửi hồ sơ: tên, tóm tắt, mục tiêu, nội dung, phương pháp, kết quả dự kiến, nhóm, lĩnh vực, đợt và giảng viên đề xuất. |
| FR06 | So sánh tên và nội dung với kho đề tài; tối đa 5 kết quả, điểm tên/nội dung riêng; lưu snapshot kiểm tra khi gửi, gồm phiên bản thuật toán và ngưỡng. |
| FR07 | Duyệt/yêu cầu sửa/từ chối kèm lý do; xác nhận giảng viên chính; lưu người duyệt và thời điểm. |
| FR08 | Tra cứu, phân trang, lọc theo giảng viên, lĩnh vực, đợt/năm, trạng thái; chi tiết riêng tuân theo quyền. |
| FR09 | Tạo mốc đề cương/giữa kỳ/cuối kỳ, hạn nộp và yêu cầu đầu ra. |
| FR10 | Lưu công việc đã làm, khó khăn, kế hoạch tiếp theo, tiến độ tự khai báo và thời điểm cập nhật. |
| FR11 | Nộp/tải tài liệu theo mốc; tạo phiên bản mới khi nộp lại; lưu người nộp, thời gian, tệp và nhãn muộn. |
| FR12 | Nhận xét gắn với lần nộp; đạt/cần sửa; đánh giá cuối cùng đạt/không đạt, điểm và nhận xét nếu có. |
| FR13 | Thông báo trong website khi duyệt, yêu cầu sửa, nhận xét mới và sắp/quá hạn; có trạng thái đã đọc. |
| FR14 | Thống kê theo giảng viên, lĩnh vực, trạng thái, kết quả; lọc năm/đợt; xuất CSV khớp bộ lọc. Excel là mở rộng. |
| FR15 | Lịch sử gửi, duyệt, đổi trạng thái, thay đổi hồ sơ sau duyệt và đánh giá: ai, lúc nào, hành động, đối tượng. |

## 4. Quy tắc nghiệp vụ đề xuất

- Một đề tài thuộc một nhóm, một đợt và có một giảng viên hướng dẫn chính sau duyệt.
- Một sinh viên chỉ tham gia một đề tài đang hoạt động trong cùng đợt. Cần định nghĩa trạng thái hoạt động khi triển khai.
- Sinh viên sửa hồ sơ khi nháp hoặc cần chỉnh sửa; chỉ gửi trong thời gian đăng ký hợp lệ và đủ thành viên.
- Sau duyệt, đổi tên/thành viên cần cán bộ xác nhận; ghi lịch sử.
- Giảng viên chỉ nhận xét/đánh giá đề tài được phân công; sinh viên chỉ truy cập tài liệu của nhóm mình; cán bộ có quyền quản lý theo phạm vi.
- Nộp sau hạn vẫn lưu, đánh dấu muộn theo thời gian máy chủ; nộp lại không ghi đè phiên bản cũ.
- Cảnh báo tương tự không tự động từ chối; người duyệt quyết định. Không gọi điểm tương đồng là tỷ lệ đạo văn.
- Không xóa cứng hồ sơ đã có lịch sử nghiệp vụ; ưu tiên khóa/ẩn/hủy có dấu vết.

Trạng thái: nháp → chờ duyệt → đã duyệt → đang thực hiện → chờ nghiệm thu → hoàn thành. Chờ duyệt có thể sang cần chỉnh sửa hoặc từ chối; cần chỉnh sửa có thể gửi lại. Hủy cần lý do và quyền phù hợp.

Kết quả riêng: chưa đánh giá/đạt/không đạt. Điểm chỉ áp dụng nếu quy chế yêu cầu.

## 5. Yêu cầu phi chức năng

| Mã | Yêu cầu kiểm chứng |
|---|---|
| NFR01 | Mật khẩu băm bằng Argon2id; kiểm tra quyền từng API, phiên hết hạn; không lộ tài liệu qua URL công khai. |
| NFR02 | PDF/DOCX/XLSX/PPTX, tối đa 20 MB/tệp; kiểm tra phần mở rộng và nội dung định dạng; tên lưu do máy chủ sinh. |
| NFR03 | Với 1.000 đề tài, mục tiêu p95 tra cứu thường <2 giây; ghi cấu hình máy và tải thử. Đo so sánh tương tự riêng. |
| NFR04 | Giao diện tiếng Việt, dùng được trên điện thoại/máy tính, lỗi và trạng thái chờ rõ ràng. |
| NFR05 | Chỉ mục duy nhất, kiểm tra tham chiếu ở backend, giao dịch MongoDB cho cập nhật nhiều document; xử lý cạnh tranh khi thêm thành viên/duyệt. |
| NFR06 | Sao lưu và thử khôi phục database cùng tệp; có quy trình dọn tệp tải lên thất bại. |
| NFR07 | Cấu hình môi trường, migration, dữ liệu mẫu, tài khoản demo; tài liệu API và hướng dẫn chạy. |

## 6. Kiểm tra tương tự

- Tên chính xác: chuẩn hóa Unicode, chữ thường, khoảng trắng và dấu câu; giữ bản gốc.
- Tên gần giống: so sánh trigram bằng JavaScript tại backend trên tên đã chuẩn hóa; không dùng pg_trgm do chọn MongoDB.
- Nội dung: TF-IDF + cosine similarity trên tóm tắt/mục tiêu/nội dung; thống nhất xử lý tiếng Việt và n-gram.
- Fit vectorizer trên corpus tham chiếu; cache vector và cập nhật khi corpus thay đổi. Loại bản thân đề tài khỏi kết quả; không đưa bản nháp riêng của nhóm khác vào corpus mặc định.
- Top 5 xếp theo max(điểm tên, điểm nội dung), giữ hai điểm riêng. Cảnh báo nếu trùng tên chính xác hoặc một điểm vượt ngưỡng tương ứng đã hiệu chỉnh.
- Ngưỡng chưa chốt: dùng tập hiệu chỉnh và tập kiểm thử riêng có cặp trùng/gần giống/khác nhau; báo cáo precision, recall, cảnh báo nhầm và bỏ sót.
- Lưu hồ sơ đầu vào, đối tượng đối chiếu, điểm, ngưỡng, phiên bản corpus/thuật toán, thời điểm khi gửi.
- Nếu dịch vụ lỗi, ghi trạng thái chưa kiểm tra, cho thử lại; không hiển thị như đã kiểm tra và không có trùng.
- Không bao gồm đọc toàn bộ PDF, tìm đạo văn Internet hoặc embedding trong core.

## 7. Công nghệ đề xuất

| Thành phần | Lựa chọn | Mục đích |
|---|---|---|
| Frontend | React + Vite + React Router, JavaScript | Trang theo vai trò, biểu mẫu và điều hướng |
| UI | Tailwind CSS | Giao diện thống nhất, responsive |
| Biểu mẫu | React Hook Form + Zod | Validation giao diện; máy chủ kiểm tra độc lập |
| API | Node.js + Express, JavaScript, REST | Backend chia module; giữ nghiệp vụ tại backend |
| Database | MongoDB; MongoDB Atlas khi triển khai | Document tham chiếu bằng ID, chỉ mục, giao dịch |
| Mô hình dữ liệu | Mongoose | Schema, validation và truy vấn; quản lý thay đổi dữ liệu bằng script có phiên bản |
| Xác thực | JWT (JSON Web Token): access token ngắn hạn, refresh token; Argon2id | Backend xác minh chữ ký, thời hạn và quyền; refresh token trong cookie HttpOnly/Secure/SameSite, lưu bản băm và phiên trong MongoDB để thu hồi |
| Nội dung tương tự | TF-IDF + cosine similarity bằng JavaScript tại backend | Kiểm thử thuật toán bằng tập mẫu; lưu corpus/vector có phiên bản |
| Tài liệu | Vercel Blob private khi triển khai; metadata MongoDB | Cấp quyền upload/download qua backend; local có thể dùng thư mục riêng |
| Hình ảnh | Cloudinary khi có nhiều ảnh hoặc cần tối ưu tải | Resize theo kích thước hiển thị, f_auto/q_auto, ảnh responsive; metadata lưu MongoDB |
| Thống kê | Recharts + xuất CSV tại backend | Biểu đồ và báo cáo |
| Tài liệu API | Swagger/OpenAPI | Mô tả và thử API |
| Kiểm thử | Vitest/Jest + Supertest, Playwright | Nghiệp vụ/phân quyền, luồng đầu cuối và thuật toán JavaScript |
| Triển khai | Vercel + MongoDB Atlas + Vercel Blob private | React và Express trên Vercel; database và tệp lưu ở dịch vụ bền vững |
| Quản lý mã | Git | Theo dõi thay đổi và tích hợp nhóm |

Kiến trúc backend một ứng dụng Express chia module, dùng JavaScript xuyên suốt. Không cần Redis, Kubernetes hoặc các microservice nghiệp vụ cho demo. Phiên bản chính xác được khóa khi khởi tạo sau kiểm tra tương thích; bảng này là lựa chọn thiết kế, chưa khẳng định đã triển khai.

### Phương án Vercel (ghi nhận theo chỉ dẫn người dùng)

- Frontend React/Vite deploy trên Vercel; cấu hình fallback cho đường dẫn React Router.
- Express có thể deploy trên Vercel dưới dạng Function; tái sử dụng kết nối MongoDB, không lưu phiên refresh token/corpus duy nhất trong bộ nhớ tiến trình.
- MongoDB Atlas lưu dữ liệu; không chạy MongoDB bên trong Vercel.
- Không dùng thư mục uploads của Function làm kho lưu bền vững.
- Giới hạn payload Function được tài liệu nêu là 4,5 MB. Với yêu cầu 20 MB/tệp, dùng client upload trực tiếp vào Blob private sau khi backend xác thực và cấp token giới hạn kích thước/loại tệp. Xác minh tệp ở trạng thái pending trước khi cho sử dụng; không chỉ tin MIME do client cung cấp.
- Download từ private storage phải kiểm tra quyền; chọn cơ chế streaming được hỗ trợ để đáp ứng tệp 20 MB, kiểm thử thực tế trước nghiệm thu.
- Lưu token Blob, MongoDB URI và khóa ký JWT ở biến môi trường backend; không đưa vào biến VITE_*.
- Thông báo hạn nộp dùng tác vụ được lập lịch, tránh phụ thuộc timer chạy liên tục trong Function.
- Kiểm tra thời gian chạy, hạn mức và chi phí gói tại thời điểm triển khai; đo so sánh TF-IDF với corpus 1.000 đề tài. Không hứa toàn bộ dịch vụ miễn phí.
- Đây là kế hoạch tham khảo, chưa tạo tài khoản dịch vụ hoặc publish website.

Nguồn chính thức:
- https://vercel.com/
- https://vercel.com/kb/guide/ship-a-express-app-on-vercel
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/vercel-blob/client-upload
- https://vercel.com/docs/vercel-blob/private-storage
- https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/

## 8. Dữ liệu chính

### Xác thực JWT

- JWT là JSON Web Token có chữ ký; không phải một file JSON chứa thông tin đăng nhập.
- Access token gửi bằng Authorization: Bearer, giữ trong bộ nhớ frontend; thời hạn ngắn, cấu hình khi triển khai.
- Refresh token lưu trong cookie HttpOnly/Secure/SameSite; endpoint refresh/logout kiểm tra Origin và chống CSRF phù hợp cấu hình domain.
- Lưu bản băm refresh token và phiên trong MongoDB; xoay refresh token, thu hồi khi đăng xuất/khóa tài khoản/đổi mật khẩu; phát hiện tái sử dụng token đã xoay.
- API kiểm tra trạng thái tài khoản/quyền hiện hành để token cũ không tiếp tục dùng quyền đã bị thu hồi.
- Xác minh thuật toán được cho phép, chữ ký, exp, issuer và audience; không chỉ decode token.
- Payload chỉ chứa định danh và dữ liệu tối thiểu; không chứa mật khẩu, bí mật hoặc tài liệu riêng. JWT ký không đồng nghĩa mã hóa nội dung.

### Hình ảnh Cloudinary

- Ghi nhận theo yêu cầu người dùng: có thể dùng Cloudinary khi nhiều hình ảnh/tải chậm; không cần chuyển toàn bộ tài liệu sang Cloudinary.
- Dùng cho avatar, ảnh minh họa và ảnh sản phẩm nghiên cứu được phép hiển thị. Tài liệu/báo cáo riêng tiếp tục lưu Vercel Blob private.
- Phân phối ảnh đúng kích thước hiển thị, tự chọn định dạng/chất lượng bằng f_auto/q_auto; frontend dùng srcset/sizes và lazy loading ảnh dưới màn hình đầu tiên. Ảnh chính đầu trang không lazy load.
- Upload trực tiếp từ React tới Cloudinary bằng tham số được backend ký sau kiểm tra JWT/quyền; API secret chỉ ở backend, không trong VITE_*.
- Hạn chế dung lượng/định dạng qua cấu hình upload và kiểm tra phía máy chủ. Lưu public_id, secure_url, kích thước và chủ sở hữu trong MongoDB; không lưu base64 ảnh trong document.
- Ảnh riêng của đề tài cần cơ chế phân phối có kiểm soát quyền; không dùng URL ảnh công khai cho nội dung riêng.
- Đo tải trước/sau và kiểm tra hạn mức dịch vụ tại thời điểm triển khai; Cloudinary không tự khắc phục mọi nguyên nhân tải chậm.
- Nguồn: https://cloudinary.com/documentation/image_optimization ; https://cloudinary.com/documentation/upload_images

users, sessions, student_profiles, lecturer_profiles, research_periods, research_fields, teams, team_members, topics, milestones, progress_updates, submissions, attachments, reviews, evaluations, similarity_checks, similarity_matches, notifications, audit_logs.

## 9. Tiêu chí nghiệm thu

1. Nhóm đủ điều kiện gửi hồ sơ → chờ duyệt và có snapshot kiểm tra tương tự.
2. Tên giống/mô tả gần giống → trả đối chiếu và cảnh báo theo ngưỡng cấu hình.
3. Người ngoài nhóm/giảng viên không được phân công → bị chặn API và tải file riêng.
4. Duyệt → xác nhận giảng viên, mở quy trình thực hiện, gửi thông báo.
5. Nộp lại → tạo phiên bản mới, vẫn xem bản/nhận xét cũ; quá hạn → nhãn muộn.
6. Nhận xét → nhóm xem được phản hồi và thông báo.
7. Đánh giá → lưu kết quả riêng, cập nhật trạng thái đúng quyền/quy trình.
8. Thống kê và CSV cùng bộ lọc → số liệu khớp.
9. Khôi phục bản sao → mở được hồ sơ và tải tài liệu liên quan.
10. Tập kiểm thử tương tự → có số liệu đúng/nhầm/bỏ sót, không khẳng định phát hiện mọi trường hợp.

## 10. Phân công và điểm cần thống nhất

- Sinh viên 1: frontend, biểu mẫu, đề tài, tiến độ, dashboard.
- Sinh viên 2: backend, database, xác thực/phân quyền, duyệt/đánh giá.
- Sinh viên 3: so sánh tương tự, tài liệu, kiểm thử và triển khai. Cả nhóm cùng tích hợp và viết báo cáo.

Cần thống nhất với giảng viên: giới hạn thành viên, ai duyệt/chấm cuối, thang điểm, danh mục lĩnh vực, thời hạn và khả năng hiển thị hồ sơ công khai. Đây là tham số nghiệp vụ chưa được xác nhận, không cản trở thiết kế core.

## 11. Quyết định cho bản demo theo ủy quyền lựa chọn của người dùng

Ngày 14/10/2026: người dùng yêu cầu tham khảo và lựa chọn giúp. Các quyết định dưới đây là baseline triển khai, thay cho các phương án còn mở phía trên; không khẳng định là quy chế nhà trường.

### Nghiệp vụ

- Cán bộ khoa duyệt, yêu cầu sửa, từ chối và xác nhận giảng viên. Giảng viên hướng dẫn ghi đánh giá cuối; cán bộ có thể xác nhận/sửa sai có lý do và audit, không ghi đè lịch sử.
- Nhóm mặc định 1–3 sinh viên; min/max cấu hình theo đợt. Một sinh viên chỉ thuộc một nhóm hoạt động trong một đợt, kể cả giai đoạn nháp để ngăn đăng ký chồng.
- Trưởng nhóm sửa/gửi hồ sơ và quản lý thành viên trước duyệt. Mọi thành viên được cập nhật tiến độ/nộp báo cáo; mỗi thao tác ghi người thực hiện.
- Không đăng ký tài khoản tự do trong core; cán bộ tạo/nhập tài khoản. Sinh viên đổi mật khẩu ban đầu; reset mật khẩu do cán bộ, thu hồi phiên.
- Nháp → chờ duyệt khi đủ dữ liệu/thành viên, trong hạn và kiểm tra tương tự thành công. Nếu kiểm tra lỗi, giữ nháp và cho thử lại.
- Chờ duyệt → cần sửa/từ chối/đã duyệt; cần sửa → chờ duyệt khi gửi lại. Từ chối là kết thúc hồ sơ, có thể sao chép sang nháp mới.
- Đã duyệt → đang thực hiện do giảng viên/cán bộ bắt đầu. Trưởng nhóm đề nghị nghiệm thu khi các mốc bắt buộc đã đạt → chờ nghiệm thu. Giảng viên đánh giá đạt/không đạt → hoàn thành, kết quả lưu riêng. Yêu cầu sửa trước kết luận → đang thực hiện.
- Hủy do cán bộ xác nhận kèm lý do. Hoàn thành, từ chối, hủy giải phóng chỗ tham gia nhóm cho sinh viên trong đợt.
- Báo cáo: chờ nhận xét/cần sửa/đạt yêu cầu; nộp muộn là cờ riêng. Nộp lại tạo phiên bản mới chờ nhận xét. Giảng viên chỉ nhận xét/đánh dấu đạt bản hiện hành; bản cũ giữ phản hồi đã có.
- Demo dùng kết quả đạt/không đạt và nhận xét; điểm số tùy chọn 0–10, không tự suy ra đạt từ điểm khi chưa có quy chế.
- Kho đối chiếu nội bộ hiển thị tên, tóm tắt, lĩnh vực, năm học cho tài khoản đăng nhập; bản nháp/cần sửa/từ chối/hủy không hiển thị. Báo cáo, nhận xét và dữ liệu cá nhân chỉ cho nhóm, giảng viên phụ trách và cán bộ.

### Kỹ thuật

- Chốt React/Vite/React Router + Tailwind + React Hook Form/Zod; Express/Node.js JavaScript ES modules; MongoDB Atlas/Mongoose; Recharts; OpenAPI; Vitest/Supertest và Playwright. Không thêm Redux cho core.
- Access JWT 15 phút, refresh token ngẫu nhiên 7 ngày, xoay khi dùng; giữ JWT trong bộ nhớ, refresh trong cookie bảo mật; lưu hash refresh/phiên trong refresh_sessions. Khóa tài khoản/đổi mật khẩu thu hồi mọi phiên. Thời hạn là lựa chọn thiết kế có cấu hình.
- Frontend gọi /api cùng origin qua routing/proxy tới Express trên Vercel để đơn giản cookie. Không dùng tính năng Services thử nghiệm làm phụ thuộc bắt buộc. Cấu hình thực tế phải kiểm thử refresh và download trước publish.
- MongoDB tách collection theo chức năng. Dùng unique indexes cho email/mã tài khoản, (teamId, studentId), (topicId, milestoneId, version). team_members lưu periodId và active; partial unique (periodId, studentId) khi active=true ngăn một sinh viên thuộc hai nhóm hoạt động. Giao dịch cập nhật nhóm, membership, trạng thái và audit liên quan; local MongoDB chạy replica set nếu thử giao dịch.
- Mỗi nhóm có một đề tài hoạt động; chốt active bằng partial unique index trên topics.teamId. Lưu lịch sử đề tài kết thúc, không ghi đè hồ sơ.
- Tệp báo cáo Vercel Blob private, 20 MB/tệp; ảnh Cloudinary tối đa 5 MB/ảnh, JPEG/PNG/WebP. Upload trực tiếp với quyền backend cấp, xác nhận định dạng/chủ sở hữu trước ready; tài liệu private không qua URL ảnh public.
- Không coi bản ghi pending là báo cáo đã nộp. Chỉ finalize submission sau kiểm tra tệp; nhãn muộn tính từ thời điểm finalize ở máy chủ. Dọn tệp pending quá 24 giờ bằng job có tính lặp an toàn.
- Thông báo trong website, polling khi mở trang; job mỗi ngày tạo nhắc hạn trong 3 ngày tới và quá hạn, chống tạo trùng bằng khóa sự kiện. CSV là định dạng xuất core.

### So sánh tương tự và kiểm thử

- JavaScript chuẩn hóa tên + trigram, nội dung TF-IDF/cosine. Corpus gồm đã duyệt/đang thực hiện/chờ nghiệm thu/hoàn thành qua các năm; loại chính hồ sơ đang sửa. Chỉ so sánh trường nhập liệu, không đọc tệp.
- Chuẩn hóa Unicode NFC, chữ thường, khoảng trắng/dấu câu; giữ dấu tiếng Việt ở baseline. Nội dung dùng word unigram/bigram; bỏ stopwords bằng danh sách có phiên bản. Hồ sơ quá ngắn theo mức tối thiểu của form sẽ yêu cầu bổ sung, không gán 0 rồi kết luận khác nhau.
- Chuẩn bị ít nhất 60 cặp gán nhãn: 20 trùng, 20 gần giống, 20 khác nhau; tách tập hiệu chỉnh/kiểm thử theo nhóm đề tài nguồn tránh rò rỉ cặp biến thể. Ngưỡng tên/nội dung lấy từ tập hiệu chỉnh, khóa trước chạy tập kiểm thử; báo cáo precision/recall và lỗi, không hứa độ chính xác trước đo.
- Trùng tên chính xác luôn cảnh báo; trường hợp khác cảnh báo nếu một điểm vượt ngưỡng tương ứng. Top 5 và snapshot lưu điểm riêng, threshold/corpus/algorithm version.
- Kiểm thử bắt buộc: quyền API/file, hai đăng ký đồng thời, xoay/thu hồi token, phiên bản và muộn, lỗi upload, chuyển trạng thái, CSV khớp lọc, tập tương tự và khôi phục backup.
- Các mốc xây dựng: (1) tài khoản/nhóm/hồ sơ/duyệt; (2) tiến độ/tệp/nhận xét/kết quả; (3) tương tự/thống kê/thông báo; (4) kiểm thử/triển khai/tài liệu. Tích hợp thuật toán tương tự phải xong trước nghiệm thu luồng gửi hồ sơ.

Nguồn tham khảo quyết định:
- https://www.mongodb.com/docs/manual/core/index-unique/
- https://www.mongodb.com/docs/manual/core/transactions/
- https://vercel.com/docs/frameworks/backend/express
- https://auth0.com/docs/secure/tokens/refresh-tokens/use-refresh-token-rotation (tham khảo nguyên tắc rotation, không dùng Auth0 làm dịch vụ dự án).

## 12. Chốt đầy đủ các mục trong tệp người dùng đính kèm

Nguồn đầu vào: Pasted text.txt được người dùng đính kèm ngày 14/10/2026. Các lựa chọn sau là yêu cầu triển khai, không còn là danh sách phương án để chọn.

### 12.1 Nghiệp vụ và quyền

| Vấn đề | Quyết định |
|---|---|
| Duyệt và phân công | Cán bộ khoa, luôn lưu người/thời gian/lý do. |
| Kết quả cuối | Giảng viên chính ghi đạt/không đạt và nhận xét bắt buộc; điểm 0–10 là tùy chọn, không tự suy kết quả từ điểm. |
| Nhóm | 1–3 thành viên mặc định, min/max theo đợt; một nhóm gắn với một hồ sơ đề tài, không tái sử dụng nhóm cũ cho hồ sơ mới. |
| Tham gia | Một nhóm hoạt động/sinh viên/đợt, từ lúc tham gia nhóm nháp đến khi đề tài kết thúc. |
| Thêm thành viên | Trưởng nhóm mời tài khoản sinh viên; sinh viên chấp nhận mới trở thành thành viên và chiếm chỗ trong đợt. Kiểm tra min/max và trùng tại thời điểm chấp nhận. |
| Trưởng nhóm | Đúng một người trong nhóm, chuyển quyền trước khi rời nhóm. Sinh viên được từ chối lời mời/rời nhóm trước duyệt; sau duyệt gửi yêu cầu cán bộ. |
| Sửa/gửi hồ sơ | Chỉ trưởng nhóm, khi nháp/cần chỉnh sửa; gửi trong hạn. Cán bộ có thể gia hạn hạn đăng ký và lưu lịch sử nếu cần. |
| Tiến độ/báo cáo | Mọi thành viên được cập nhật/nộp khi đang thực hiện; lịch sử ghi tác giả. Tiến độ % là tự khai báo, không đại diện xác nhận của giảng viên. |
| Hồ sơ bị từ chối | Không mở lại; sao chép thông tin sang hồ sơ/nhóm mới, thành viên xác nhận lại, trong đợt còn mở. |
| Đổi tên/thành viên sau duyệt | Trưởng nhóm gửi đề nghị; cán bộ duyệt hoặc từ chối, giữ giá trị trước/sau và lý do. Đổi tên phải kiểm tra tương tự lại. |
| Giải phóng tham gia | Hoàn thành/từ chối/hủy đóng nhóm, giải phóng chỗ nhưng giữ membership lịch sử và quyền xem tài liệu cũ. |
| Xem kho đề tài | Chỉ tài khoản đăng nhập; kho dùng chung có tên/tóm tắt/lĩnh vực/năm/trạng thái và giảng viên. Không công khai thành viên, file, nhận xét hoặc toàn bộ mô tả. |
| Xem dữ liệu riêng | Thành viên hiện hành và thành viên lịch sử được phép, giảng viên được phân công, cán bộ; không suy quyền từ active membership đang chiếm chỗ. Người đã rời nhóm trước duyệt không giữ quyền riêng. |
| Chỉnh kết quả đã hoàn thành | Chỉ cán bộ, có lý do và phiên bản đánh giá mới; không xóa đánh giá cũ. |

### 12.2 Dữ liệu MongoDB

Chốt collections: users (profile sinh viên/giảng viên nhúng có giới hạn), teams, team_members, team_invitations, research_periods, research_fields, topics, topic_change_requests, milestones, progress_updates, submissions, attachments, reviews, evaluations, notifications, audit_logs, similarity_checks (top 5 matches nhúng có giới hạn), similarity_corpora, refresh_sessions.

- Không tạo collections sessions/student_profiles/lecturer_profiles/similarity_matches riêng cho demo; các tên trước đây được thay thế bởi danh sách này.
- ID tham chiếu bằng ObjectId; backend kiểm tra tồn tại/quyền. Email chuẩn hóa và mã tài khoản có unique index; (teamId, studentId) unique; (periodId, studentId) partial unique cho active membership; topic.teamId unique vì mỗi nhóm một hồ sơ.
- Một trưởng nhóm bằng teams.leaderId tham chiếu member; đổi trưởng nhóm cùng giao dịch với membership liên quan.
- Phiên bản submissions unique (topicId, milestoneId, version). Cấp version bằng bộ đếm nguyên tử; finalize chống lặp bằng idempotency key, không lấy count+1.
- teams/topics giữ revision; thao tác đổi trạng thái có điều kiện revision/trạng thái trước để phát hiện xung đột, trả lỗi rõ và yêu cầu tải lại.
- Giao dịch MongoDB cho gửi/duyệt/kết thúc hồ sơ, membership và audit/notification tương ứng. Tệp ngoài MongoDB không nằm trong giao dịch: dùng pending/finalize và job dọn để khắc phục.

### 12.3 Bảng chuyển trạng thái

| Từ | Sang | Người thực hiện và điều kiện |
|---|---|---|
| Nháp/cần chỉnh sửa | Chờ duyệt | Trưởng nhóm; trong hạn, đủ thành viên/dữ liệu, kiểm tra tương tự thành công; cần sửa giữ nguyên trạng thái nếu kiểm tra lỗi. |
| Chờ duyệt | Đã duyệt | Cán bộ xác nhận giảng viên đang hoạt động và các mốc bắt buộc. |
| Chờ duyệt | Cần chỉnh sửa/từ chối | Cán bộ, lý do bắt buộc. |
| Đã duyệt | Đang thực hiện | Giảng viên chính hoặc cán bộ bắt đầu thực hiện. |
| Đang thực hiện | Chờ nghiệm thu | Trưởng nhóm đề nghị; bản hiện hành của mọi mốc bắt buộc đạt yêu cầu. |
| Chờ nghiệm thu | Đang thực hiện | Giảng viên yêu cầu sửa kèm lý do; không ghi kết quả cuối. |
| Chờ nghiệm thu | Hoàn thành | Giảng viên ghi kết quả đạt/không đạt và nhận xét. |
| Nháp/cần sửa/chờ duyệt/đã duyệt/đang thực hiện/chờ nghiệm thu | Hủy | Cán bộ xác nhận yêu cầu hoặc chủ động hủy, lý do bắt buộc. |

Lần nộp: chờ nhận xét → cần sửa/đạt yêu cầu bởi giảng viên. Nhận xét và quyết định có lịch sử. Nộp lại tạo bản chờ nhận xét mới; bản cũ không bị đổi trạng thái. Chỉ nộp lại mốc đã đạt nếu giảng viên mở lại có lý do; điều kiện nghiệm thu dựa trên bản mới nhất.

Tệp: pending (đang tải/xác minh) → ready hoặc failed. Nộp muộn = submittedAt > deadline, dùng thời gian UTC máy chủ; giao diện hiển thị Asia/Ho_Chi_Minh. Hạn thay đổi phải audit; lưu hạn áp dụng khi nộp để không tự viết lại lịch sử muộn.

### 12.4 JWT và tệp

- Access token JWT 15 phút; refresh token ngẫu nhiên tối đa 7 ngày tính từ đăng nhập, rotation không kéo dài vượt hạn tuyệt đối. Token refresh không bắt buộc là JWT vì cần thu hồi tại server.
- Access token trong bộ nhớ; refresh trong HttpOnly/Secure cookie và hash trong database. Kiểm tra phiên/account hiện hành để logout/khóa/đổi mật khẩu có hiệu lực cả với JWT chưa hết hạn.
- Frontend gom yêu cầu refresh thành một luồng, điều phối giữa tab; server rotation nguyên tử và kiểm thử refresh đồng thời. Token cũ bị dùng lại thu hồi family; không tự nới cơ chế chống reuse để che lỗi chạy đồng thời. Khi phiên mất hiệu lực yêu cầu đăng nhập lại.
- Cookie cùng origin qua /api proxy; SameSite=Lax, kiểm tra Origin/CSRF cho refresh/logout. Khóa JWT, Blob và Cloudinary chỉ ở backend.
- Báo cáo: PDF/DOCX/XLSX/PPTX, tối đa 20 MB/tệp, 5 tệp/lần nộp. Ảnh công khai: JPEG/PNG/WebP, tối đa 5 MB/ảnh trên Cloudinary. Ảnh riêng nghiên cứu cũng lưu kho private như attachment.
- Backend cấp quyền upload sau kiểm tra JWT/quyền, giới hạn định dạng/dung lượng. Khi finalize, xác minh object thực có tồn tại, kích thước/định dạng/chủ sở hữu; không tin URL hay MIME client gửi. Chỉ tệp ready được gắn vào submission.
- Upload thành công chưa tính đã nộp; submittedAt là thời gian finalize thành công. Retry finalize cùng idempotency key trả cùng submission, không tạo phiên bản kép.
- Job hằng ngày dọn pending quá 24 giờ, chỉ xóa object không gắn submission; log lỗi và retry. Tài liệu đã nộp không cho sinh viên xóa cứng.

### 12.5 So sánh và đánh giá thuật toán

- Corpus: đã duyệt/đang thực hiện/chờ nghiệm thu/hoàn thành, mọi năm học. Không dùng nháp/cần sửa/chờ duyệt/từ chối/hủy; người duyệt vẫn kiểm tra thủ công xung đột các hồ sơ cùng chờ duyệt.
- Cảnh báo top 5 chỉ công bố tên/tóm tắt/lĩnh vực/năm và điểm. Corpus đầy đủ xử lý server, không gửi toàn bộ nội dung riêng xuống trình duyệt.
- Form tối thiểu: tên 10–250 ký tự; tóm tắt 100, mục tiêu 50, nội dung 200 ký tự sau trim. Đây là giới hạn nhập liệu, không bảo đảm chất lượng nghiên cứu. Chưa đủ dữ liệu thì yêu cầu bổ sung, không kết luận không tương tự.
- Unicode NFC/chữ thường/chuẩn hóa khoảng trắng và dấu câu; giữ dấu tiếng Việt và từ chuyên ngành. Stopwords có phiên bản, không bỏ thuật ngữ theo danh sách tùy ý.
- Tên dùng Dice similarity trên tập character trigram; tên chuẩn hóa giống hệt thì điểm 1. Nội dung dùng TF-IDF word unigram/bigram và cosine, fit từ corpus tham chiếu. Corpus/version lưu bền vững, không chỉ cache trong Function.
- Ít nhất 60 cặp có nhãn: 20 trùng, 20 gần, 20 khác. Chia theo đề tài nguồn, mục tiêu 40 cặp hiệu chỉnh và 20 kiểm thử, cân bằng lớp khi có thể; ghi rõ tập nhỏ và giới hạn kết luận. Cặp trùng/gần là positive.
- Chọn ngưỡng bằng tập hiệu chỉnh: ưu tiên recall >=0,90 rồi precision cao nhất nếu đạt; nếu không đạt thì công bố kết quả tốt nhất và hạn chế. Không hứa đạt chỉ tiêu trước đo, không chọn ngưỡng bằng tập kiểm thử. Ngưỡng được lưu cấu hình, khóa cùng phiên bản thuật toán.
- Trùng tên chính xác hoặc vượt một trong hai ngưỡng → cảnh báo; không tự từ chối. Lưu snapshot khi gửi và chạy lại khi duyệt nếu corpus đã thay đổi.
- Kiểm tra lỗi: giữ trạng thái nháp/cần sửa, báo chưa kiểm tra và cho retry; tuyệt đối không lưu kết quả giả 0 điểm.

### 12.6 Phạm vi nghiệm thu

Core đầy đủ FR01–FR15; account import CSV đơn giản, thông báo trong website, xuất CSV. Email/chat/hội đồng/kinh phí/đọc PDF/embedding/SSO nằm ngoài phiên bản đầu.

Dataset demo: ít nhất 3 nhóm sinh viên, 2 giảng viên, 1 cán bộ; có hồ sơ qua các trạng thái, bài muộn và nộp lại, dữ liệu tương tự có nhãn. Dataset thử hiệu năng 1.000 đề tài tách khỏi dữ liệu minh họa; không coi dữ liệu sinh ngẫu nhiên là bằng chứng độ chính xác thuật toán.

Ba bàn giao: demo triển khai và tài khoản theo vai trò; báo cáo thiết kế/thuật toán/kiểm thử/hạn chế; hướng dẫn cài đặt và sử dụng có ảnh minh họa. Các quyết định đã chốt đủ để thiết kế database/API và triển khai; nếu quy chế chính thức thay đổi thì cập nhật tài liệu cùng code có kiểm thử.

## 13. Bộ quyết định hiện hành ngày 21 tháng 10 năm 2026

Người dùng yêu cầu chọn theo các đề xuất cho dự án, sau khi yêu cầu dùng JavaScript thay TypeScript và Cloudinary thay kho tài liệu được đề xuất trước đó. Mục này chốt yêu cầu và thiết kế để triển khai; không xác nhận đã có mã nguồn, tài khoản dịch vụ, kiểm thử đạt hoặc website được xuất bản. Các phần mục 12 không bị thay thế tiếp tục có hiệu lực.

### 13.1 Công nghệ và kiến trúc

| Thành phần | Quyết định hiện hành |
|---|---|
| Ngôn ngữ | JavaScript ES modules toàn bộ mã ứng dụng; JSX cho React; SQL cho migration đặc thù. Không dùng TypeScript. |
| Frontend | React, Vite, React Router, Tailwind CSS. |
| Biểu mẫu | React Hook Form và Zod; backend dùng Zod kiểm tra độc lập, không chỉ tin validation frontend. |
| Dữ liệu giao diện | TanStack Query; không thêm Redux cho core; xóa cache nhạy cảm khi logout hoặc đổi tài khoản. |
| Backend | Node.js bản LTS được hỗ trợ tại thời điểm khởi tạo, Express, REST API; một ứng dụng chia module. |
| Database | PostgreSQL; Prisma ORM dùng JavaScript. Schema Prisma là ngôn ngữ mô tả dữ liệu, không phải TypeScript. |
| Migration | Prisma Migrate; SQL có phiên bản cho pg_trgm, chỉ mục có điều kiện và ràng buộc đặc thù. Không coi ORM thay thế kiểm tra nghiệp vụ. |
| Xác thực | JWT access 15 phút; refresh token ngẫu nhiên tối đa 7 ngày kể từ đăng nhập, xoay và lưu hash; Argon2id cho mật khẩu. |
| Tài liệu và ảnh | Cloudinary. Tài liệu nội bộ raw/authenticated; ảnh công khai image/upload. |
| Tương tự | Tên chính xác sau chuẩn hóa; pg_trgm cho tên gần giống; TF-IDF word unigram/bigram và cosine bằng JavaScript tại backend. |
| Báo cáo | Recharts; xuất CSV tại backend theo cùng bộ lọc và quyền. |
| Kiểm thử | Vitest, Supertest, Playwright; ESLint và kiểm tra migration trước tích hợp. |
| Tài liệu API | OpenAPI; Swagger UI chỉ mở ở môi trường phù hợp. |
| Triển khai | Frontend Vercel; Express Render; PostgreSQL được quản lý trên Supabase; file trên Cloudinary. Supabase chỉ phục vụ database trong thiết kế này. |
| Kết nối | Frontend gọi /api cùng origin qua proxy tới backend; kiểm thử cookie, Origin, CSRF, header và streaming trên cấu hình thật. |
| Phiên bản | Khóa phiên bản tương thích trong lockfile khi khởi tạo; không tự chọn bản thử nghiệm. |

Không thêm Python service, microservices, Redis, Elasticsearch, Kubernetes, chatbot, GPT/Gemini API hoặc embedding vào core. Chỉ dùng tài khoản dịch vụ được cấp; việc chốt nhà cung cấp không đồng nghĩa đã mua gói hoặc được phép phát sinh chi phí.

### 13.2 Phạm vi và tác nhân

Core: quản lý tài khoản/danh mục/đợt; nhóm có lời mời; đăng ký và xét duyệt đề tài; hướng dẫn; tiến độ; hồ sơ có phiên bản theo mốc; nhận xét; kết quả; cảnh báo tương tự; thông báo trong web; tra cứu; thống kê/CSV; lịch sử; yêu cầu thay đổi và hủy.

Ngoài phiên bản đầu: quản lý hội đồng độc lập, kinh phí, hợp đồng, quy đổi giờ, email/SMS, chat, SSO, đọc toàn bộ file để so sánh, tìm đạo văn Internet và ứng dụng di động riêng. Giảng viên chính ghi đánh giá cuối trong core.

| Vai trò | Quyền và phạm vi |
|---|---|
| Sinh viên | Xem metadata kho đề tài; tạo/nhận lời mời nhóm; xem hồ sơ được cấp quyền; cập nhật tiến độ và nộp báo cáo khi đang thực hiện. |
| Trưởng nhóm | Thuộc tính của thành viên, không phải vai trò toàn hệ thống. Sửa/gửi hồ sơ, mời thành viên, chuyển trưởng nhóm, đề nghị nghiệm thu/thay đổi/hủy. |
| Giảng viên | Xem đề nghị hướng dẫn gửi cho mình; nhận xét/đánh giá chỉ đề tài được phân công hiện hành; xác nhận bắt đầu và yêu cầu sửa. |
| Cán bộ khoa | Quản lý nghiệp vụ trong các khoa được cấp; duyệt, phân công, xử lý thay đổi/hủy, sửa kết quả có lý do và thống kê theo phạm vi. |
| Quản trị viên | Tài khoản, vai trò, phạm vi quản lý, cấu hình và vận hành. Không mặc nhiên đọc file riêng hoặc duyệt/chấm đề tài; cần vai trò nghiệp vụ phù hợp để làm các việc đó. |

Một tài khoản có thể có nhiều vai trò. Cán bộ không tự nâng quyền hoặc mở rộng phạm vi của mình. Kiểm tra quyền trên server với từng đối tượng, kể cả API file và xuất CSV; không suy quyền từ việc nút có hiển thị hay không.

### 13.3 Danh mục và quy tắc nhóm

- Chuẩn hóa danh mục khoa, ngành, lớp bằng các bảng faculties, majors, classes; tài khoản liên kết đúng loại hồ sơ. Đề tài lưu khoa chủ trì của nhóm tại thời điểm tạo để không bị đổi phạm vi quản lý theo việc sinh viên đổi lớp sau này.
- Demo chọn nhóm cùng khoa, mặc định 1–3 thành viên; min/max theo đợt. Cán bộ khoa chủ trì xử lý; nhóm liên khoa là mở rộng.
- Một sinh viên có một nhóm hoạt động mỗi đợt, tính từ lúc tạo nhóm hoặc chấp nhận lời mời; lời mời đang chờ không chiếm chỗ. Chấp nhận lời mời phải kiểm tra lại số thành viên và chỗ tham gia trong giao dịch.
- Một nhóm gắn tối đa một hồ sơ đề tài, không tái sử dụng nhóm cũ. Khi bị từ chối chỉ sao chép nội dung sang nhóm/hồ sơ mới; thành viên chấp nhận lại.
- Nhóm chưa có hồ sơ vẫn chiếm chỗ; trưởng nhóm được đóng nhóm rỗng hồ sơ trước khi kết thúc để giải phóng chỗ, có audit. Chỉ một trưởng nhóm hiện hành; chuyển trưởng nhóm trước khi rời nhóm.
- Nhóm đóng khi đề tài hoàn thành, bị từ chối hoặc hủy. Lưu lịch sử membership; active dùng kiểm soát chỗ, không đồng nghĩa quyền đọc.
- Người rời nhóm trước duyệt mất quyền riêng. Người tham gia tại thời điểm duyệt được xem snapshot hồ sơ duyệt và tài liệu họ đã có quyền trong thời gian tham gia; nếu rời sau duyệt thì không mặc nhiên xem tài liệu phát sinh sau ngày rời. Lưu mốc quyền đọc và kiểm tra phiên bản tài liệu ở backend. Cán bộ có thể thu hồi quyền lịch sử kèm lý do/audit.
- Thống kê theo khoa chủ trì; toàn bộ thành viên chỉ được xem trong workspace có quyền, không đưa vào kho metadata dùng chung.

### 13.4 Quy trình hướng dẫn và hồ sơ

- Trưởng nhóm đề xuất một giảng viên chính. Lưu đề nghị hướng dẫn riêng; giảng viên chấp nhận/từ chối. Hồ sơ được gửi xét duyệt khi đề nghị hướng dẫn đã được chấp nhận và các điều kiện khác hợp lệ.
- Nếu giảng viên từ chối, trưởng nhóm chọn lại; không tự chuyển sang đã được phân công. Cán bộ chốt giảng viên chính khi duyệt.
- Đổi giảng viên sau duyệt: trưởng nhóm gửi yêu cầu, giảng viên mới xác nhận, cán bộ duyệt. Giảng viên cũ mất quyền nghiệp vụ khi thay thế có hiệu lực; nhận xét/đánh giá cũ giữ nguyên tác giả. Không cấp quyền tải file cũ chỉ vì từng là giảng viên hướng dẫn.
- Trưởng nhóm đề nghị hủy; cán bộ quyết định và ghi lý do. Đề nghị đang chờ chưa tự hủy đề tài hoặc giải phóng thành viên. Cán bộ có thể chủ động hủy nếu có lý do.
- Khi gửi hoặc gửi lại, lưu topic_revision bất biến gồm nội dung, nhóm/thành viên, giảng viên đề xuất, kết quả tương tự và thời gian. Quyết định duyệt tham chiếu đúng revision đã xem, không chỉ bản ghi đề tài hiện tại.
- Sau duyệt, sửa tên/thành viên/giảng viên qua yêu cầu thay đổi. Các trường học thuật khác trong hồ sơ đã duyệt cũng phải qua yêu cầu thay đổi, không PATCH trực tiếp. Đổi tên hoặc nội dung học thuật phải chạy lại kiểm tra tương tự.
- Yêu cầu thay đổi có before/after, người yêu cầu, lý do, người quyết định, revision gốc; nếu dữ liệu hiện hành đã đổi thì yêu cầu cũ bị đánh dấu xung đột, không áp dụng mù.

| Trạng thái trước | Hành động và người thực hiện | Trạng thái sau và điều kiện |
|---|---|---|
| draft / revision_required | Trưởng nhóm gửi hồ sơ | submitted; trong hạn, đủ thành viên/nội dung, giảng viên đã nhận hướng dẫn, kiểm tra tương tự thành công. |
| submitted | Cán bộ yêu cầu sửa | revision_required; lý do bắt buộc. |
| submitted | Cán bộ từ chối | rejected; lý do bắt buộc, đóng nhóm. |
| submitted | Cán bộ duyệt | approved; xác nhận giảng viên hiện hành và các mốc bắt buộc; lưu snapshot và audit. |
| approved | Giảng viên chính/cán bộ bắt đầu | in_progress. |
| in_progress | Trưởng nhóm đề nghị nghiệm thu | pending_evaluation; bản hiện hành mọi mốc bắt buộc đạt yêu cầu, không có yêu cầu thay đổi/hủy đang chờ. |
| pending_evaluation | Giảng viên yêu cầu sửa | in_progress; lý do bắt buộc, chỉ rõ mốc cần mở lại nếu phải nộp lại. |
| pending_evaluation | Giảng viên đánh giá cuối | completed; passed/failed và nhận xét bắt buộc, đóng nhóm. |
| Trạng thái chưa kết thúc | Cán bộ xác nhận hủy | cancelled; lý do bắt buộc, đóng nhóm. |
| completed | Cán bộ sửa sai kết quả | Vẫn completed; phiên bản đánh giá mới có lý do, không mở lại quy trình hay xóa bản cũ. |

Kết quả passed/failed độc lập trạng thái; score 0–10 là tùy chọn và không tự suy kết quả. Hồ sơ rejected/cancelled không mở lại. Các thay đổi liên quan trạng thái/membership/quyết định/audit/thông báo dùng giao dịch và kiểm tra revision.

### 13.5 Tiến độ và phiên bản tài liệu

- Ba mốc mặc định: đề cương, giữa kỳ, cuối kỳ; cán bộ cấu hình hạn và đầu ra trước duyệt. Mỗi mốc bắt buộc có hạn cụ thể, thay đổi hạn phải có lý do và audit.
- Tiến độ gồm việc đã làm, khó khăn, kế hoạch, phần trăm tự khai báo 0–100. Không dùng phần trăm tự khai làm căn cứ tự động nghiệm thu.
- Một lần nộp có 1–5 file đã ready, cùng đề tài/người hoặc nhóm được cấp quyền; tạo submission khi finalize thành công. Lưu submittedAt và deadlineSnapshot, isLate theo UTC server.
- Trạng thái báo cáo: pending_review -> changes_requested / accepted. Nộp lại tạo phiên bản mới pending_review; chỉ bản hiện hành được quyết định. Nhận xét cũ không bị ghi đè; sửa quyết định phải thêm sự kiện có lý do.
- Mốc đã accepted chỉ nộp lại khi giảng viên mở lại có lý do. Trạng thái mở lại và revision mốc ngăn việc đồng thời đề nghị nghiệm thu khi điều kiện đã thay đổi.
- Mỗi file chỉ gắn với một submission; nộp lại có định danh/phiên bản file riêng. Sinh viên không xóa cứng báo cáo đã nộp.
- Dữ liệu trước duyệt dùng topic_revision để lưu lịch sử đề xuất; sau duyệt dùng milestone/submission để quản lý báo cáo. Không buộc tồn tại milestone đã phê duyệt mới được đính kèm hồ sơ đăng ký.

### 13.6 Cloudinary và dữ liệu file

- Báo cáo PDF/DOCX/XLSX/PPTX: raw + authenticated, giữ nguyên bản. Giới hạn yêu cầu 20 MB/file, 5 file/lần nộp; ảnh JPEG/PNG/WebP tối đa 5 MB. File ảnh nghiên cứu riêng cũng phải dùng phân phối được bảo vệ.
- Đây là giới hạn mong muốn của ứng dụng, chưa xác nhận hạn mức tài khoản Cloudinary thực tế. Trước triển khai phải kiểm thử account hỗ trợ upload/download 20 MB và cấu hình phân phối PDF. Nếu không hỗ trợ, ghi rõ trở ngại; không âm thầm hạ giới hạn hoặc tự mua gói.
- Chọn upload qua Express trên Render trong core để máy chủ kiểm soát tài nguyên, loại file, dung lượng và định dạng thực trước khi đưa lên kho. Dùng vùng tạm có giới hạn, dọn khi thành công/thất bại; không dùng đĩa server làm kho bền vững. Upload trực tiếp có chữ ký là tối ưu về sau, không phải luồng chính hiện hành.
- Backend tạo attachment pending, xác minh định dạng thật và quyền, upload với định danh do server cấp, xác minh kết quả rồi chuyển ready/failed. Không tin URL, MIME hoặc asset ID do client tự nhận là đã upload.
- Tải file: xác thực người dùng/quyền với phiên bản hồ sơ, dùng private_download_url đặt hạn 5 phút và đúng resource_type/type. Signed delivery URL thông thường không được coi là có thời hạn.
- Liên kết tải là bearer link có thể chia sẻ trong thời gian còn hạn; thu hồi tài khoản chặn lần cấp link tiếp theo nhưng không hứa vô hiệu ngay mọi link đã cấp. Không ghi URL có chữ ký vào log, không lưu làm URL công khai cố định.
- Metadata: attachment.id, topicId, uploadedBy, originalName, sizeBytes, mimeType, assetId, publicId, resourceType, deliveryType, trạng thái, createdAt. Liên kết file vào topic_revision hoặc submission bằng bảng riêng; không lưu base64 trong database.
- Job hằng ngày dọn pending quá 24 giờ hoặc object mồ côi đã đối chiếu; không xóa file đã gắn hồ sơ; thao tác xóa có retry và audit.
- API_SECRET Cloudinary chỉ ở backend; không dùng unsigned public upload preset cho tài liệu riêng.

Tài liệu kỹ thuật đối chiếu ngày 21/10/2026:
- https://cloudinary.com/documentation/upload_parameters
- https://cloudinary.com/documentation/control_access_to_media
- https://cloudinary.com/documentation/image_delivery_options

### 13.7 Dữ liệu PostgreSQL và ràng buộc

Các bảng chuẩn bị cho schema chi tiết:

| Nhóm | Bảng |
|---|---|
| Tài khoản và tổ chức | users, user_roles, management_scopes, faculties, majors, classes, refresh_sessions |
| Đợt và nhóm | research_periods, research_fields, teams, team_members, team_invitations |
| Khoảng quyền đọc lịch sử | team_access_grants, chi tiết hóa trong bộ hồ sơ kiểm tra ngày 21/10/2026 |
| Hồ sơ và quyết định | topics, topic_revisions, topic_revision_files, supervision_requests, supervisor_assignments, topic_decisions, topic_change_requests, topic_cancellation_requests |
| Thực hiện và tài liệu | milestones, progress_updates, submissions, attachments, submission_files, reviews, evaluations |
| Đối chiếu và vận hành | similarity_corpora, similarity_checks, similarity_matches, notifications, audit_logs, idempotency_records |

- UUID cho khóa chính, timestamptz UTC cho thời gian; JSONB có giới hạn cho snapshot/configuration/before-after, không nhúng lịch sử không giới hạn vào một dòng.
- Email chuẩn hóa và mã tài khoản unique; topics.team_id unique; (team_id, student_id) unique; partial unique (period_id, student_id) WHERE active=true; (milestone_id, version) unique; (topic_id, evaluation.version) unique; (topic_id, topic_revision.version) unique.
- Các FK đảm bảo thành viên/đề tài thuộc đúng nhóm/đợt; bảng liên kết file kiểm tra cùng đề tài. Bổ sung unique/composite FK khi cần thay vì chỉ trông vào frontend.
- Khóa hoặc cập nhật có điều kiện hàng team khi nhận thành viên để không vượt max; leader phải là thành viên hiện hành. Dùng transaction và retry có giới hạn khi cạnh tranh.
- Dùng bộ đếm nguyên tử có khóa cho mã NCKH-YYYY-NNNN và phiên bản; không dùng count+1 hoặc max+1 không khóa. Có unique constraint cuối cùng để bảo vệ.
- revision chống sửa đè ở topic/team/milestone và các yêu cầu quyết định; thao tác stale trả 409. Idempotency key ràng buộc theo người dùng, thao tác và hash payload; cùng khóa khác dữ liệu trả 409.
- supervisor_assignments lưu mốc bắt đầu/kết thúc và người phân công; topics trỏ giảng viên hiện hành, cập nhật cùng giao dịch. topic_decisions tham chiếu topic_revision chính xác.
- Quyền lịch sử của team_members lưu các mốc được cấp; truy cập tài liệu dựa thời điểm/phiên bản và thu hồi quyền, không chỉ một boolean.
- Audit log không lưu mật khẩu, raw token, khóa dịch vụ hoặc signed download URL. Bản sửa sai là bản ghi mới, không xóa sự kiện cũ.

### 13.8 Kiểm tra tương tự

- Giữ các điều kiện dữ liệu tối thiểu và chuẩn hóa NFC/giữ dấu tại mục 12.5. Tên chuẩn hóa giống hệt luôn cảnh báo; dùng pg_trgm cho tên gần giống, không giả định điểm pg_trgm giống thuật toán Dice cũ.
- Nội dung TF-IDF/cosine tính trên tóm tắt, mục tiêu, nội dung; corpus giữ bền vững và có version. Tính năng không đọc nội dung file, không tìm trên Internet.
- Corpus gồm approved/in_progress/pending_evaluation/completed mọi năm; không gồm nháp/chờ duyệt/cần sửa/từ chối/hủy; loại bản thân hồ sơ. Cán bộ kiểm tra thêm xung đột các hồ sơ cùng chờ duyệt.
- Chạy khi xem trước, khi gửi và khi duyệt nếu corpus đổi. Khi duyệt đồng thời, kiểm tra corpus revision và điều phối cập nhật để không sử dụng kết quả cũ mà không biết.
- Kết quả lưu tối đa 5 matches, điểm tên và nội dung 0–1 riêng; snapshot dùng đầu vào đầy đủ phía server. Client chỉ nhận metadata được phép và điểm, không nhận mô tả riêng của đề tài khác.
- Lỗi kiểm tra: giữ draft/revision_required khi gửi, báo chưa kiểm tra; không trả 0 giả. Nếu corpus thật sự rỗng, trả success với corpusSize=0 và matches=[], phân biệt với lỗi tải corpus.
- Ít nhất 60 cặp có nhãn, 20 trùng/20 gần/20 khác; chia hiệu chỉnh/kiểm thử theo nhóm đề tài nguồn, không để biến thể cùng nguồn rơi hai tập. Vì đổi cách tính tên, hiệu chỉnh lại cả hai ngưỡng, không dùng lại ngưỡng Dice.
- Mục tiêu chọn ngưỡng ưu tiên recall >=0,90 trên tập hiệu chỉnh rồi precision cao; khóa trước tập kiểm thử. Đây là mục tiêu đánh giá, không cam kết chất lượng trước đo.
- Người duyệt được chấp thuận hồ sơ có cảnh báo nếu ghi lý do; điểm tương tự không phải tỷ lệ đạo văn.

### 13.9 API và màn hình

- REST /api/v1, JSON camelCase, UUID string, ngày ISO 8601 UTC; danh từ số nhiều, kebab-case ở URL. Database snake_case. HTTP 201 khi tạo, 409 khi xung đột, 422 khi dữ liệu không đạt, 401/403/404 theo quyền; kiểm tra tương tự có cảnh báo vẫn 200.
- Response thành công {data, meta?, requestId}; lỗi {error:{code,message,details?},requestId}. Phân trang mặc định 20 tối đa 100, whitelist sort/filter; CSV áp dụng đúng cùng truy vấn và scope, xử lý ô có thể bị phần mềm bảng tính hiểu là công thức.
- Không PATCH trạng thái tùy ý. Dùng submit/decisions/start/request-evaluation/return-to-progress/cancel và kiểm tra điều kiện server.
- Giữ bộ endpoint đã mô tả trong trao đổi sơ đồ/API, trừ upload-intents trực tiếp được thay bằng POST /topics/:id/attachments dạng multipart qua backend; POST /attachments/:id/download-links cấp link ngắn hạn. Finalize nộp báo cáo vẫn là POST /milestones/:id/submissions dùng file ready.
- Bổ sung GET /topics/:id/revisions và GET /topics/:id/revisions/:version cho lịch sử hồ sơ theo quyền; POST /topics/:id/supervision-requests; POST /supervision-requests/:id/respond; POST /topics/:id/cancellation-requests; POST /cancellation-requests/:id/decisions. Từ chối lời mời/yêu cầu có lý do khi cần, không coi timeout là đồng ý.
- Sinh viên: dashboard, đợt đăng ký, nhóm/lời mời, form đề tài và đối chiếu, workspace gồm tổng quan/mốc/tiến độ/file/nhận xét/lịch sử, yêu cầu thay đổi/hủy, kho tra cứu và thông báo.
- Giảng viên: đề nghị hướng dẫn, danh sách được phân công, workspace, nhận xét từng bản nộp, kết quả cuối và thông báo.
- Cán bộ: dashboard khoa, hàng chờ duyệt, phân công hướng dẫn, yêu cầu thay đổi/hủy, đợt/danh mục, báo cáo/CSV và lịch sử.
- Quản trị: người dùng/import CSV, vai trò/phạm vi, danh mục tổ chức và cấu hình vận hành; không mặc nhiên có workspace nghiệp vụ.
- Giao diện tiếng Việt, responsive; có trạng thái rỗng/đang tải/lỗi/thử lại, hiển thị bản hiện hành và nhãn nộp muộn. Định tuyến có kiểm tra quyền để hỗ trợ UX nhưng backend là nơi quyết định quyền.

### 13.10 Nghiệm thu và tổ chức triển khai

Các kiểm tra bắt buộc:
1. Đăng nhập/refresh/logout/đổi mật khẩu/khóa tài khoản có thu hồi phiên và chống tái sử dụng refresh token.
2. Chấp nhận lời mời đồng thời không tạo hai nhóm hoạt động hoặc vượt số lượng; trưởng nhóm luôn hợp lệ.
3. Gửi hồ sơ đủ điều kiện có topic_revision và snapshot tương tự; lỗi kiểm tra không chuyển chờ duyệt.
4. Duyệt đúng revision, đúng khoa và giảng viên đã đồng ý; lưu mốc, audit, notification trong giao dịch.
5. Người ngoài nhóm, giảng viên cũ và quản trị chỉ có quyền kỹ thuật không đọc được file riêng; kiểm tra trực tiếp API và link cấp sai quyền.
6. Upload sai nội dung/định dạng/dung lượng bị chặn; pending không tính đã nộp; dọn được file mồ côi khi upload/finalize lỗi.
7. Nộp lại tạo đúng một phiên bản khi retry; giữ bản cũ và deadlineSnapshot; kiểm tra đúng nhãn muộn.
8. Chỉ giảng viên hiện hành nhận xét bản hiện hành; yêu cầu nghiệm thu bị chặn nếu mốc bắt buộc chưa đạt hoặc đang mở lại.
9. Hoàn thành đạt/không đạt đóng nhóm; sửa sai kết quả tạo phiên bản mới, không ghi đè lịch sử.
10. Thay thành viên/giảng viên/nội dung và hủy đều có quyết định; quyền cũ/mới cập nhật đúng thời điểm.
11. Báo cáo và CSV khớp theo giảng viên/lĩnh vực/trạng thái/kết quả/khoa/đợt/năm; tránh nhân bản số đề tài do JOIN thành viên.
12. Bộ tương tự có số liệu precision/recall, cảnh báo nhầm/bỏ sót; dataset hiệu năng 1.000 đề tài đo riêng, mục tiêu tra cứu p95 <2 giây theo cấu hình ghi nhận.
13. Sao lưu PostgreSQL cùng manifest và bản sao tệp riêng được bảo vệ; thử khôi phục mở hồ sơ và tải được file. Không coi backup metadata là backup nội dung Cloudinary.
14. Kiểm thử deploy thật: proxy/cookie, upload/download 20 MB, link hết hạn, job dọn và nhắc hạn; ghi rõ giới hạn gói dịch vụ thực tế.

Thông báo trong web, polling khi mở trang; job ngoài vòng đời request tạo nhắc hạn và dọn file hằng ngày, khóa sự kiện tránh tạo trùng. Phải cấu hình scheduler thực tế khi triển khai; không phụ thuộc timer của một instance hoặc mặc định gói miễn phí chạy liên tục.

Dữ liệu demo: ít nhất 3 nhóm, 2 giảng viên, 1 cán bộ, 1 quản trị, đủ các trạng thái chính, bài muộn/nộp lại, lời mời/thay đổi/hủy và cặp tương tự có nhãn. Không dùng dữ liệu cá nhân thật làm mặc định.

Trình tự thực hiện: (1) đặc tả quyền/trạng thái, ERD và OpenAPI; (2) khung frontend/backend, migration/seed và xác thực; (3) nhóm/hồ sơ/hướng dẫn/duyệt; (4) tiến độ/file/nhận xét/kết quả; (5) tích hợp tương tự/thống kê/thông báo; (6) kiểm thử/triển khai/bàn giao. Tương tự phải được tích hợp trước nghiệm thu luồng gửi hồ sơ.

Nhóm 3 người: người 1 phụ trách frontend; người 2 backend/database/xác thực/nghiệp vụ; người 3 tương tự/file/kiểm thử/triển khai. Đây là phân công đề xuất theo chức năng, không phải ràng buộc nhóm nghiên cứu trong ứng dụng; cả nhóm cùng tích hợp và viết báo cáo.

Ba bàn giao: website demo kèm tài khoản theo vai trò; báo cáo đồ án với yêu cầu, sơ đồ, thiết kế, thuật toán, kết quả kiểm thử và hạn chế; hướng dẫn cài đặt/sử dụng có ảnh minh họa. Việc lựa chọn này không tuyên bố các bàn giao đã được tạo hoặc nghiệm thu.

### 13.11 Bộ hồ sơ hợp nhất để chủ dự án kiểm tra

Ngày 21/10/2026 tạo bộ hồ sơ phiên bản kiểm tra 1.0 tại deliverables/2026-10-21, bắt đầu từ 00_DOC_TRUOC.md. Bộ hồ sơ gồm tổng quan/yêu cầu, quyền/luồng, dữ liệu, API, màn hình/test/triển khai và phiếu chốt. Các chi tiết mới như đợt theo khoa, khoảng quyền đọc, giới hạn form, xác nhận lại hướng dẫn và lịch backup được liệt kê riêng trong phiếu để kiểm tra. Chưa coi phiếu là đã được xác nhận; bộ hồ sơ không phải migration, server API hoặc website đã nghiệm thu.
