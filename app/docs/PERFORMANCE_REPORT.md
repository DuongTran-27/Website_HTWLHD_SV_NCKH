# Đo hiệu năng local

2026-10-22T09:44:13.188Z

1.000 đề tài tổng hợp trong nckh_bench, tách dữ liệu ứng dụng và bộ nhãn. Sequential local tests, concurrency=1; 20 warm-up + 100 measured ordinary searches. HTTP includes authentication/session validation, scope, filters, pagination count, metadata enrichment and response parsing. Similarity separately includes rebuilding TF-IDF for 1000 documents.

Tra cứu HTTP p95: 5.97 ms. Truy vấn PostgreSQL riêng p95: 1.06 ms. Tương tự pg_trgm + TF-IDF p95: 142.39 ms.

Mục tiêu HTTP p95 <2 giây: đạt trong cấu hình local đã đo. Chưa đo mạng/tải đồng thời trên Vercel/Render/Supabase. Cấu hình máy và số mẫu: PERFORMANCE_RESULTS.json.
