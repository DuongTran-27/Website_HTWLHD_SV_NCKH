# Đánh giá thuật toán tương tự

2026-10-22T08:42:54.919Z

60 cặp tổng hợp có nhãn theo cách sinh: 20 trùng, 20 gần, 20 khác. Chia theo đề tài nguồn: 39 cặp hiệu chỉnh / 21 cặp kiểm thử, không giao nguồn hoặc biến thể. Ngưỡng được ghi trước khi đọc tập test.

Tên: pg_trgm sau NFC/giữ dấu. Nội dung: TF-IDF unigram/bigram, cosine; fit riêng trên corpus tham chiếu của mỗi phần.

Ngưỡng tên 0.95, nội dung 0.85.

| Tập        | Precision | Recall | TP  | TN  | FP  | FN  |
| ---------- | --------- | ------ | --- | --- | --- | --- |
| Hiệu chỉnh | 1         | 1      | 26  | 13  | 0   | 0   |
| Kiểm thử   | 1         | 1      | 14  | 7   | 0   | 0   |

Giới hạn: dữ liệu do chương trình sinh, nhãn chưa được người chuyên môn gán độc lập; kết quả không chứng minh độ chính xác học thuật. Cảnh báo hỗ trợ xét duyệt, không kết luận đạo văn. Chi tiết và ví dụ lỗi (nếu có): SIMILARITY_RESULTS.json.
