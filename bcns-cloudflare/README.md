# Báo cáo thu ngân sách Cao Bằng

Trang Cloudflare Pages chỉ hiển thị dữ liệu. Việc nhập Excel tiếp tục tại Apps Script. Nguồn số liệu tổng hợp là `thu-chi/data.json` trong repo `luchongky/thongkegiaingan`, do Apps Script cập nhật; trang đọc qua `/api/data` và không giữ khóa Apps Script trên trình duyệt.

Cloudflare Pages: kết nối repo này, thư mục đầu ra `/` (không cần lệnh build); vào Settings → Bindings → Add → Workers AI, tên biến `AI`, sau đó triển khai lại. `/api/ai` chỉ gửi phần số liệu liên quan đến câu hỏi sang Workers AI. Số liệu và nhận định là tham khảo điều hành, ngày chốt hiển thị trên mọi báo cáo.

Số liệu theo xã và phân tích khoản thu dựa vào các trường `xa[].th`, `xa[].dt`, `xa[].K`, `xa[].budgetK`, `xa[].ck`, `xa[].khoan`. Nếu bản xuất Apps Script chưa có trường mới, giao diện nói rõ thiếu dữ liệu, không tự điền số.
