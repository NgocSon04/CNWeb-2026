# Hệ Thống Đặt Sân Pickleball

Hệ thống web đặt sân Pickleball với đầy đủ tính năng cho người dùng và admin.

## 🚀 Cách chạy

### Yêu cầu hệ thống
- **Docker Desktop** (cho Cách 1) hoặc **Node.js 18+** và **PostgreSQL 15+** (cho Cách 2)

---

### Cách 1: Sử dụng Docker (Khuyến nghị)

**Bước 1:** Tải và cài đặt Docker Desktop
- Truy cập: https://www.docker.com/products/docker-desktop/
- Tải phiên bản phù hợp với hệ điều hành (Windows/Mac/Linux)
- Cài đặt và khởi động lại máy nếu được yêu cầu

**Bước 2:** Mở Docker Desktop và đợi đến khi hiện trạng thái **"Docker is running"** (biểu tượng màu xanh ở góc dưới bên trái)

**Bước 3:** Mở terminal và di chuyển vào thư mục project
```bash
cd c:\Users\admin\Desktop\a
```

**Bước 4:** Chạy với Docker Compose
```bash
docker-compose up --build
```

**Bước 5:** Đợi đến khi thấy thông báo `Server running on port 3000`

**Bước 6:** Mở trình duyệt và truy cập: **http://localhost:3000**

> 💡 **Lưu ý:**  
> - PostgreSQL chạy trên port **5433** (từ máy host) hoặc 5432 (trong Docker)
> - Dữ liệu được lưu trữ trong Docker volume `postgres_data`
> - Để dừng: nhấn `Ctrl+C` hoặc chạy `docker-compose down`
> - Để xóa dữ liệu: `docker-compose down -v`

---

### Cách 2: Chạy trực tiếp (Không dùng Docker)

**Bước 1:** Cài đặt và khởi động PostgreSQL, tạo database tên `pickleball`
```sql
CREATE DATABASE pickleball;
```

**Bước 2:** Mở terminal và di chuyển vào thư mục server
```bash
cd c:\Users\admin\Desktop\a\server
```

**Bước 3:** Cài đặt dependencies
```bash
npm install
```

**Bước 4:** Cấu hình biến môi trường (nếu cần thay đổi mặc định)
```bash
# Windows CMD
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=pickleball
set DB_USER=postgres
set DB_PASSWORD=postgres123

# Windows PowerShell
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="pickleball"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres123"
```

**Bước 5:** Tạo bảng và thêm dữ liệu mẫu
```bash
npm run seed
```

**Bước 6:** Khởi động server
```bash
npm start
```

**Bước 7:** Mở trình duyệt và truy cập: **http://localhost:3000**

---

## 🔑 Tài khoản test

### Admin
- **Email:** admin@pickleball.com
- **Password:** admin123

### Khách hàng
| Email | Password |
|-------|----------|
| user1@gmail.com | user123 |
| user2@gmail.com | user123 |
| user3@gmail.com | user123 |

---

## 📋 Các tính năng

### Người dùng
- ✅ Đăng ký / Đăng nhập / Đăng xuất
- ✅ Quên mật khẩu (lấy mã xác nhận)
- ✅ Xem và chỉnh sửa thông tin cá nhân
- ✅ Xóa tài khoản
- ✅ Tìm kiếm sân (theo tên, quận, giá)
- ✅ Đặt sân (chọn ngày, khung giờ, thanh toán)
- ✅ Xem lịch sử đặt sân
- ✅ Hủy đặt sân
- ✅ Đánh giá sân đã đặt

### Admin
- ✅ Dashboard với thống kê tổng quan
- ✅ Xem báo cáo doanh thu
- ✅ Quản lý đơn đặt sân (xác nhận / hủy / hoàn thành)
- ✅ Quản lý khách hàng (khóa / mở khóa / xóa)
- ✅ Quản lý sân (thêm / sửa / xóa)
- ✅ Quản lý khung giờ

---

## 📁 Cấu trúc thư mục

```
├── client/                 # Frontend (HTML/CSS/JS)
│   ├── assets/            # CSS và JS chung
│   ├── auth/              # Trang đăng nhập/đăng ký
│   ├── user/              # Trang người dùng
│   ├── admin/             # Trang admin
│   └── index.html         # Trang chủ
│
├── server/                 # Backend (Node.js)
│   ├── src/
│   │   ├── config/        # Cấu hình database
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Auth middleware
│   │   ├── index.js       # Entry point
│   │   └── seed.js        # Script thêm dữ liệu mẫu
│   └── data/              # SQLite database
│
├── docker-compose.yml
├── Dockerfile
├── sample-data.json        # Dữ liệu mẫu
└── README.md
```

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** HTML, CSS, JavaScript thuần
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT + bcrypt
- **Container:** Docker

