// File: server/reset_db.js
const { pool } = require('./src/config/database');

async function resetDatabase() {
    try {
        console.log('🔄 ĐANG BẮT ĐẦU SỬA LỖI TOÀN BỘ DATABASE...');

        // 1. Xóa sạch các bảng cũ để tránh xung đột
        await pool.query('DROP TABLE IF EXISTS bookings CASCADE');
        await pool.query('DROP TABLE IF EXISTS reviews CASCADE'); // Xóa cả review nếu có
        await pool.query('DROP TABLE IF EXISTS slots CASCADE');
        await pool.query('DROP TABLE IF EXISTS booking_statuses CASCADE');
        await pool.query('DROP TABLE IF EXISTS payment_methods CASCADE');

        console.log('✅ Đã dọn dẹp bảng cũ.');

        // 2. Tạo bảng SLOTS (KHUNG GIỜ) - CÓ CỘT NAME
        await pool.query(`
            CREATE TABLE slots (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50),  -- QUAN TRỌNG: Cột này sửa lỗi "column name does not exist"
                start_time VARCHAR(10) NOT NULL,
                end_time VARCHAR(10) NOT NULL,
                price_modifier DECIMAL(3, 2) DEFAULT 1.0
            );
        `);

        // 3. Thêm dữ liệu Slots
        await pool.query(`
            INSERT INTO slots (name, start_time, end_time) VALUES 
            ('Ca Sáng 1', '05:00', '06:30'),
            ('Ca Sáng 2', '06:30', '08:00'),
            ('Ca Sáng 3', '08:00', '09:30'),
            ('Ca Chiều 1', '16:00', '17:30'),
            ('Ca Chiều 2', '17:30', '19:00'),
            ('Ca Tối',    '19:00', '20:30');
        `);
        console.log('✅ Đã tạo xong bảng Slots (Có cột Name).');

        // 4. Tạo bảng Payment Methods (Thanh toán)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payment_methods (
                id SERIAL PRIMARY KEY,
                method_name VARCHAR(50) NOT NULL,
                display_name VARCHAR(100) NOT NULL
            );
        `);
        await pool.query(`
            INSERT INTO payment_methods (method_name, display_name) VALUES 
            ('cash', 'Tiền mặt tại sân'),
            ('transfer', 'Chuyển khoản ngân hàng');
        `);

        // 5. Tạo bảng Status (Trạng thái)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS booking_statuses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL
            );
        `);
        await pool.query(`
            INSERT INTO booking_statuses (id, name) VALUES 
            (1, 'Pending'), (2, 'Confirmed'), (3, 'Cancelled'), (4, 'Completed');
        `);

        // 6. Tạo lại bảng BOOKINGS (Đặt sân)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                court_id INTEGER,
                slot_id INTEGER REFERENCES slots(id),
                booking_date DATE,
                status_id INTEGER DEFAULT 1,
                payment_method_id INTEGER,
                total_price DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('🎉 SỬA LỖI THÀNH CÔNG! BẠN HÃY CHẠY LẠI SERVER.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Lỗi:', error);
        console.log('⚠️ GỢI Ý: Kiểm tra lại mật khẩu trong config/database.js xem đúng 123456 chưa?');
        process.exit(1);
    }
}

resetDatabase();