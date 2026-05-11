const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 1. API Lấy danh sách phương thức thanh toán
router.get('/payment-methods/list', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payment_methods');
        res.json(result.rows);
    } catch (error) {
        // Nếu lỗi bảng, trả về mảng rỗng để web không sập
        res.json([]);
    }
});

// 2. API Xử lý Đặt sân
router.post('/', async (req, res) => {
    const { court_id, slot_id, booking_date, payment_method_id } = req.body;
    const user_id = req.user ? req.user.id : 1; 

    try {
        const courtRes = await pool.query('SELECT price_per_hour FROM courts WHERE id = $1', [court_id]);
        if (courtRes.rows.length === 0) return res.status(404).json({ error: 'Sân không tồn tại' });
        
        const totalPrice = courtRes.rows[0].price_per_hour * 1.5;

        // Mặc định status_id = 1 (Pending)
        const newBooking = await pool.query(
            `INSERT INTO bookings (user_id, court_id, slot_id, booking_date, status_id, payment_method_id, total_price)
             VALUES ($1, $2, $3, $4, 1, $5, $6) RETURNING *`,
            [user_id, court_id, slot_id, booking_date, payment_method_id, totalPrice]
        );

        res.json({ message: 'Đặt sân thành công!', booking: newBooking.rows[0] });

    } catch (error) {
        console.error('Lỗi đặt sân:', error);
        res.status(500).json({ error: 'Lỗi Server khi đặt sân' });
    }
});

// 3. API Lấy Lịch sử (ĐÃ SỬA LỖI TRẠNG THÁI)
router.get('/', async (req, res) => {
    const user_id = req.user ? req.user.id : 1; 

    try {
        // QUAN TRỌNG: Dùng LOWER(st.status_name) để chuyển "Confirmed" -> "confirmed"
        // Giúp Frontend nhận diện đúng màu xanh/đỏ
        const query = `
            SELECT 
                b.id, 
                b.booking_date, 
                b.total_price,
                c.name as court_name, 
                c.image_url,
                c.address as court_address, 
                s.start_time, 
                s.end_time,
                LOWER(st.name) as status,  -- <--- SỬA Ở ĐÂY
                pm.display_name as payment_method
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN time_slots s ON b.slot_id = s.id
            LEFT JOIN booking_statuses st ON b.status_id = st.id
            LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
            WHERE b.user_id = $1
            ORDER BY b.booking_date DESC, s.start_time DESC
        `;
        
        const result = await pool.query(query, [user_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy lịch sử:', error);
        res.status(500).json({ error: 'Lỗi Server lấy lịch sử' });
    }
});

// 4. API Hủy (Dành cho User tự hủy)
router.put('/:id/cancel', async (req, res) => {
    const bookingId = req.params.id;
    const { reason } = req.body;
    
    try {
        // Tìm ID của trạng thái Cancelled
        const statusRes = await pool.query("SELECT id FROM booking_statuses WHERE name = 'Cancelled'");
        const cancelledId = statusRes.rows[0]?.id || 3;

        await pool.query(
            'UPDATE bookings SET status_id = $1 WHERE id = $2', 
            [cancelledId, bookingId]
        );
        res.json({ message: 'Hủy thành công' });
    } catch (error) {
        console.error('Lỗi hủy sân:', error);
        res.status(500).json({ error: 'Không thể hủy sân' });
    }
});

module.exports = router;