# Cẩm nang AI Y tế Việt Nam 2026 — bản đọc một trang

Bản cập nhật giao diện cho website GitHub Pages.

## Điểm thay đổi chính

- Mọi kích thước màn hình chỉ hiển thị **một trang**.
- Nút Trang trước / Trang sau, phím mũi tên và thao tác vuốt chỉ chuyển **một trang mỗi lần**.
- Chế độ **Đọc rõ** mặc định mở trang lớn hơn để chữ dễ nhìn; trang có thể cuộn dọc khi cần.
- Chế độ **Vừa màn hình** thu toàn bộ trang vào vùng đọc.
- Giữ nguyên: mục lục, ảnh thu nhỏ, tìm kiếm, tải PDF, giao diện sáng/tối, toàn màn hình và nhớ trang đang đọc.
- Có điều khiển A− / A+ để điều chỉnh kích thước trang từ 70% đến 220%.

## Chạy thử trên máy

Tại thư mục chứa `index.html`, chạy một web server tĩnh, ví dụ:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000/?start=1`.

## Triển khai GitHub Pages

Thay toàn bộ nội dung repository `htsolutiontech/HBookAIDoctor` bằng các file trong thư mục này, commit và push lên nhánh đang được GitHub Pages sử dụng.

## Cấu trúc chính

- `index.html`: giao diện đọc một trang.
- `styles.css`: bố cục responsive và hiệu ứng lật từng trang.
- `app.js`: điều hướng một trang, tìm kiếm, zoom, chế độ đọc rõ/vừa màn hình.
- `content-data.js`: dữ liệu mục lục và nội dung tìm kiếm.
- `assets/pages`: 69 ảnh trang PNG.
- `assets/thumbs`: 69 ảnh thu nhỏ WEBP.
- `assets/Cam-nang-AI-y-te-Viet-Nam-2026.pdf`: bản PDF tải xuống.
