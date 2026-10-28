# Tổng quan và yêu cầu dự án

Phiên bản kiểm tra 1.0 ngày 21/10/2026.

## 1 Mục tiêu và bài toán

Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên trong một trường. Hệ thống tập trung hồ sơ, nhóm thực hiện và giảng viên; theo dõi các mốc, tài liệu, nhận xét và kết quả; hỗ trợ kiểm tra tương tự khi đăng ký và tổng hợp số liệu.

Các vấn đề cần xử lý là dữ liệu phân tán qua email/bảng tính, khó theo dõi thời hạn, khó biết bản báo cáo hiện hành, thiếu lịch sử phê duyệt, tổng hợp thủ công và khó tra cứu đề tài có khả năng trùng lặp. Đây là mô tả bài toán cần khảo sát, không phải số liệu khảo sát đã thu thập tại trường.

## 2 Phạm vi

| Trong bản đầu | Ngoài bản đầu |
|---|---|
| Tài khoản do cán bộ/quản trị được cấp quyền tạo hoặc nhập CSV | Đăng ký tài khoản tự do, SSO |
| Danh mục khoa/ngành/lớp/lĩnh vực; đợt đăng ký | Quản lý nhân sự và đào tạo toàn trường |
| Nhóm cùng khoa, lời mời, một trưởng nhóm | Nhóm liên khoa/liên trường |
| Hồ sơ, xác nhận hướng dẫn, xét duyệt, yêu cầu sửa | Hội đồng độc lập, phản biện tự động, tự xếp lịch |
| Tiến độ, file theo giai đoạn, nhận xét và kết quả | Hợp đồng, kinh phí, quy đổi giờ |
| Trùng tên/tương tự nội dung nhập trong form | Đọc toàn bộ PDF/Word, tìm đạo văn Internet |
| Tra cứu metadata, thông báo trong web, CSV | Email/SMS/chat, chatbot và API AI |
| Lịch sử, yêu cầu thay đổi/hủy, phân quyền | Ứng dụng di động riêng |

Không tuyên bố giảm 80–90% công sức khi chưa đo. Hiệu quả được đánh giá bằng thời gian xử lý, mức đầy đủ dữ liệu và kết quả kiểm thử.

## 3 Công nghệ đã chọn

| Thành phần | Lựa chọn | Mục đích |
|---|---|---|
| Ngôn ngữ | JavaScript ES modules, JSX, SQL cho migration | Đồng nhất mã ứng dụng, không dùng TypeScript |
| Frontend | React, Vite, React Router | Giao diện theo vai trò |
| UI | Tailwind CSS | Responsive, tiếng Việt |
| Form | React Hook Form, Zod | Kiểm tra form; backend kiểm tra độc lập |
| Dữ liệu UI | TanStack Query | Cache, tải lại, phân trang; xóa cache khi logout |
| Backend | Node.js LTS, Express, REST | Một ứng dụng chia module |
| Database | PostgreSQL trên Supabase | Dữ liệu quan hệ, FK, transaction, thống kê |
| ORM | Prisma bằng JavaScript, Prisma Migrate | Truy vấn và thay đổi schema có phiên bản |
| Đăng nhập | JWT, refresh token, Argon2id | Phiên có thu hồi và mật khẩu băm |
| File | Cloudinary | raw/authenticated cho tài liệu, image/upload cho ảnh công khai |
| Tương tự | pg_trgm, TF-IDF và cosine bằng JavaScript | So tên/nội dung; không thêm Python service |
| Báo cáo | Recharts, CSV | Biểu đồ và danh sách xuất |
| Kiểm thử | Vitest, Supertest, Playwright | Unit, integration, end-to-end |
| API docs | OpenAPI và Swagger UI phù hợp môi trường | Hợp đồng API |
| Deploy | Vercel frontend, Render backend | Database/file lưu dịch vụ bền vững |

Không dùng Supabase Auth hoặc Storage trong phương án hiện hành; Supabase cung cấp PostgreSQL. Không cần Redux, Redis, microservices hoặc Kubernetes trong bản đầu. Phiên bản chính xác khóa khi khởi tạo sau kiểm tra tương thích.

## 4 Yêu cầu chức năng

FR01–FR15 giữ ý nghĩa yêu cầu core đã lưu; FR16–FR26 cụ thể hóa các bổ sung. Mọi tiêu chí dưới đây là điều kiện nghiệm thu cần thực hiện, chưa phải kết quả đã kiểm thử.

| Mã | Chức năng | Điều kiện đạt chính |
|---|---|---|
| FR01 | Đăng nhập, logout, đổi mật khẩu, refresh | Tài khoản khóa không dùng được phiên; logout thu hồi phiên hiện tại |
| FR02 | Quản lý tài khoản, nhập CSV, reset mật khẩu | Mã/email không trùng; báo lỗi theo dòng; không cho tự nâng quyền |
| FR03 | Nhóm, thành viên và trưởng nhóm | Lời mời được chấp nhận mới thành thành viên; không vượt giới hạn hoặc tham gia chồng |
| FR04 | Khoa/ngành/lớp/lĩnh vực/đợt | Danh mục được kiểm tra tham chiếu; min/max và các hạn hợp lệ |
| FR05 | Hồ sơ đề tài | Lưu nháp, sửa khi hợp lệ, gửi đúng quyền; sinh mã chống trùng |
| FR06 | Kiểm tra tương tự | Top 5, điểm riêng, snapshot và version; lỗi không được coi là không tương tự |
| FR07 | Xét duyệt | Đúng cán bộ/khoa/revision; lưu lý do và người xử lý |
| FR08 | Tra cứu và danh sách | Bộ lọc, phân trang; kho chung không lộ file/thành viên/nhận xét |
| FR09 | Mốc thực hiện | Có đầu ra, hạn, required; thay hạn có lịch sử |
| FR10 | Cập nhật tiến độ | Lưu tác giả, việc đã làm/khó khăn/kế hoạch; % là tự khai |
| FR11 | Upload và nộp báo cáo | File ready; bản mới không ghi đè; nhãn muộn theo server |
| FR12 | Nhận xét và đánh giá | Chỉ giảng viên hiện hành, đúng bản nộp; kết quả cuối và nhận xét bắt buộc |
| FR13 | Thông báo trong web | Có trạng thái đã đọc, nhắc hạn và chống trùng sự kiện |
| FR14 | Thống kê và CSV | Giảng viên/lĩnh vực/trạng thái/kết quả/khoa/năm/đợt; số liệu CSV khớp |
| FR15 | Lịch sử xử lý | Ghi ai, khi nào, thao tác, đối tượng và thay đổi cần thiết |
| FR16 | Đề nghị nhận hướng dẫn | Giảng viên nhận/từ chối; đã nhận mới cho gửi xét duyệt |
| FR17 | Phiên bản hồ sơ xét duyệt | Mỗi lần gửi có snapshot bất biến; quyết định trỏ đúng snapshot |
| FR18 | Thay đổi sau duyệt | Yêu cầu trước/sau, lý do, kiểm tra xung đột; cán bộ quyết định |
| FR19 | Thay giảng viên | Giảng viên mới nhận, cán bộ duyệt; quyền giảng viên cũ chấm dứt |
| FR20 | Đề nghị và quyết định hủy | Đang chờ không tự đóng; quyết định có lý do |
| FR21 | Rời nhóm và đọc lịch sử | Người rời trước duyệt mất quyền; sau duyệt theo khoảng quyền và phiên bản |
| FR22 | Mở lại mốc đã đạt | Giảng viên có lý do; điều kiện nghiệm thu dùng bản hiện hành |
| FR23 | Sửa sai kết quả | Cán bộ tạo phiên bản mới có lý do; không xóa đánh giá trước |
| FR24 | Tải tài liệu riêng | Kiểm tra quyền rồi cấp link 5 phút; không công khai URL cố định |
| FR25 | Vai trò và phạm vi | Admin không tự có quyền nghiệp vụ; cán bộ chỉ thao tác khoa được cấp |
| FR26 | Sao lưu và dọn file | Khôi phục được cả dữ liệu/file; dọn mồ côi không xóa tài liệu đã nộp |

## 5 Quy tắc dữ liệu đầu vào

| Trường | Quy tắc cho demo |
|---|---|
| Tên đề tài | 10–250 ký tự sau trim |
| Tóm tắt | 100–5.000 ký tự sau trim |
| Mục tiêu | 50–5.000 ký tự sau trim |
| Nội dung nghiên cứu | 200–20.000 ký tự sau trim |
| Phương pháp và sản phẩm dự kiến | Bắt buộc khi gửi; tối đa 10.000 ký tự mỗi trường |
| Nhóm | 1–3 người mặc định; min/max theo đợt; cùng khoa |
| Báo cáo | 1–5 file/lần; PDF/DOCX/XLSX/PPTX, tối đa 20 MB/file |
| Ảnh | JPEG/PNG/WebP, tối đa 5 MB; phân biệt ảnh riêng/công khai |
| Tiến độ | Số nguyên 0–100, không thay thế xác nhận giảng viên |
| Điểm | Tùy chọn 0–10; không tự suy ra đạt/không đạt |
| Ngày giờ | Lưu UTC; hiển thị Asia/Ho_Chi_Minh |

Các mức tối đa văn bản là chi tiết hóa form để kiểm tra trong bản hồ sơ này, không phải quy chế trường. Độ dài tối thiểu không bảo đảm chất lượng học thuật. MB trong kiểm tra file của ứng dụng được thống nhất là 1.000.000 byte và phải dùng cùng một giá trị ở UI/API/test.

## 6 Yêu cầu chất lượng

| Mã | Yêu cầu | Cách chứng minh |
|---|---|---|
| NFR01 | Phân quyền theo đối tượng và scope | Test chéo vai trò, ID và tải file |
| NFR02 | Xác thực an toàn | Kiểm tra Argon2id, rotation, reuse, thu hồi, Origin/CSRF |
| NFR03 | Toàn vẹn dữ liệu | FK/unique/check/transaction; test thao tác đồng thời |
| NFR04 | File đúng loại và giới hạn | Đọc chữ ký/định dạng thực, không tin MIME client; kiểm tra cấu trúc OOXML |
| NFR05 | Hiệu năng tra cứu | Mục tiêu p95 <2 giây với 1.000 đề tài; ghi máy/tải/bộ lọc; đo thuật toán riêng |
| NFR06 | Dễ sử dụng | Tiếng Việt, bàn phím, nhãn form, responsive, loading/empty/error rõ |
| NFR07 | Lịch sử và phiên bản | Không mất bản nộp/nhận xét khi sửa; có xung đột revision |
| NFR08 | Khôi phục | Khôi phục database, bản sao file và kiểm tra tải lại |
| NFR09 | Triển khai lặp lại được | .env.example không chứa bí mật, migration, seed, lockfile, README |
| NFR10 | Giới hạn thuật toán minh bạch | Bộ nhãn riêng, precision/recall, false positives/negatives |
| NFR11 | Không lộ bí mật | Không đưa API_SECRET vào frontend/log, không log token/download link |
| NFR12 | Tác vụ nền có thể chạy lại | Nhắc hạn/dọn file có khóa chống trùng, retry, log và scheduler thật |

## 7 Tổng hợp tài liệu tham khảo

| Nguồn | Giá trị kế thừa | Cách sử dụng có giới hạn |
|---|---|---|
| Google nguồn 1 Hinet | Dữ liệu tập trung, biểu mẫu và báo cáo, minh bạch | Dựa bản trích trong Word; chưa đối chiếu được trang trong phiên kiểm tra trước |
| Google nguồn 2 Hoàng Hà | Quy trình đề xuất/xét duyệt/nghiệm thu | Không có URL riêng và trùng phần nguồn 4; không đếm là bằng chứng độc lập |
| Google nguồn 3 Thiên An UniResearch | Vòng đời đề tài, sản phẩm và báo cáo | Đã đối chiếu trang trong phiên trước; chọn phần phù hợp sinh viên |
| Google nguồn 4 Hoàng Hà | Hồ sơ, phân quyền, biểu mẫu | Dựa bản trích; không áp dụng nguyên mẫu số hội đồng/thang điểm/công nghệ cũ |
| Soft Việt bổ sung | Đăng ký website, chuyên đề SV, sao lưu | Tách riêng ngoài 4 nguồn đánh số |
| GPT trong Word | Vai trò, luồng trạng thái, phiên bản/lịch sử | Ý tưởng thiết kế, không phải quy chế hoặc bằng chứng hiệu quả |
| Gemini trong Word | Nhóm SV, hướng dẫn, tiến độ, nhắc hạn | Không dùng tuyên bố giảm 80–90% công sức chưa có minh chứng |

So sánh này áp dụng cho các đoạn trả lời trong Word, không xếp hạng năng lực chung của GPT/Gemini. Google là công cụ tìm; nguồn thực tế là các trang doanh nghiệp.

Đường dẫn nguồn:
- Hinet: https://hinet.com.vn/phan-mem-quan-ly-de-tai-nghien-cuu-khoa-hoc-cho-truong-hoc
- Thiên An: https://thienan.vn/thienan_product_uniresearch.html
- Hoàng Hà: http://hhsc.com.vn/chi-tiet-san-pham/9/phan-mem-quan-ly-nghien-cuu-khoa-hoc
- Soft Việt: https://softviet.info/san-pham/san-pham-nha-nuoc/phan-mem-quan-ly-nghien-cuu-khoa-hoc
- Word do người dùng cung cấp: Tài liệu tham khảo_website hỗ trợ quản lý sv nckh.docx.
- Quyết định dự án: PROJECT_REQUIREMENTS.md mục 13, ngày 21/10/2026.

## 8 Sản phẩm bàn giao dự kiến

Website demo và tài khoản theo vai trò; mã nguồn JavaScript kèm migration/seed; đặc tả API OpenAPI thực thi được sau khi xây dựng; báo cáo thiết kế/thuật toán/kiểm thử/hạn chế; hướng dẫn cài đặt/sử dụng có ảnh chụp từ sản phẩm thật. Bộ hồ sơ hiện tại là tài liệu chuẩn bị, chưa phải các bàn giao phần mềm này.

## 9 Tài liệu kỹ thuật chính thức dùng đối chiếu

- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): khóa và ràng buộc dữ liệu.
- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html): so sánh chuỗi theo trigram.
- [Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql): kết nối và mô hình truy cập dữ liệu.
- [Cloudinary upload parameters](https://cloudinary.com/documentation/upload_parameters): raw asset và delivery type.
- [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media): authenticated và private_download_url; signed link thông thường không tự hết hạn.
- [Cloudinary delivery](https://cloudinary.com/documentation/image_delivery_options): cấu hình phân phối PDF trên tài khoản phù hợp.
- [Render web services](https://render.com/docs/web-services): triển khai Express.
- [Vercel Functions limitations](https://vercel.com/docs/functions/limitations): cần đối chiếu giới hạn đường đi upload/proxy thực tế.
- [Vite](https://vite.dev/guide/), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Playwright](https://playwright.dev/docs/intro): các công cụ hỗ trợ giao diện và kiểm thử.

Các liên kết là tài liệu kỹ thuật để triển khai và kiểm chứng, không phải chứng nhận tài khoản/gói dịch vụ đang đáp ứng yêu cầu. Phiên bản thư viện, hạn mức và chi phí kiểm tra lại khi khởi tạo/deploy.
