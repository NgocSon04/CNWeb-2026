const express = require('express');
const router = express.Router();
const { pool } = require('../config/database'); // Sử dụng pool chuẩn

// 1. Lấy danh sách sân (Có tìm kiếm + Lọc)
router.get('/', async (req, res) => {
    try {
        const { search, district, min_price, max_price } = req.query;

        let sql = `
            SELECT c.*, d.name as district_name,
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(r.id) as review_count
            FROM courts c
            LEFT JOIN districts d ON c.district_id = d.id
            LEFT JOIN reviews r ON c.id = r.court_id
            WHERE c.is_active = true
        `;
        
        const params = [];
        let paramIndex = 1;

        if (search) {
            sql += ` AND c.name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (district) {
            sql += ` AND c.district_id = $${paramIndex}`;
            params.push(district);
            paramIndex++;
        }

        if (min_price) {
            sql += ` AND c.price_per_hour >= $${paramIndex}`;
            params.push(min_price);
            paramIndex++;
        }

        if (max_price) {
            sql += ` AND c.price_per_hour <= $${paramIndex}`;
            params.push(max_price);
            paramIndex++;
        }

        sql += ' GROUP BY c.id, d.name ORDER BY c.id';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Lỗi lấy danh sách sân:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// 2. Lấy danh sách quận
router.get('/districts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM districts ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// 3. Lấy chi tiết sân theo ID
router.get('/:id', async (req, res) => {
    try {
        const sql = `
            SELECT c.*, d.name as district_name,
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(r.id) as review_count
            FROM courts c
            LEFT JOIN districts d ON c.district_id = d.id
            LEFT JOIN reviews r ON c.id = r.court_id
            WHERE c.id = $1
            GROUP BY c.id, d.name
        `;
        
        const result = await pool.query(sql, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sân' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// 4. LẤY KHUNG GIỜ TRỐNG (ĐÃ CHUẨN HÓA THEO CẤU TRÚC DB THỰC TẾ)
router.get('/:id/slots', async (req, res) => {
    try {
        const { date } = req.query;
        const courtId = req.params.id;

        if (!date) {
            return res.status(400).json({ error: 'Vui lòng chọn ngày' });
        }

        const sql = `
            SELECT 
                s.id, 
                -- Tạo cột name hiển thị cho Frontend (VD: 08:00 - 09:00)
                TO_CHAR(s.start_time, 'HH24:MI') || ' - ' || TO_CHAR(s.end_time, 'HH24:MI') as name,
                s.start_time, 
                s.end_time,
                -- Logic kiểm tra chỗ trống kép:
                -- 1. Nếu cột is_available của slot là false -> Hết chỗ (bảo trì/đóng)
                -- 2. Nếu tìm thấy trong bảng bookings -> Hết chỗ (đã có người đặt)
                -- 3. Ngược lại -> Còn chỗ
                CASE 
                    WHEN s.is_available = false THEN false
                    WHEN b.id IS NOT NULL THEN false 
                    ELSE true                        
                END as available
            FROM time_slots s
            LEFT JOIN bookings b ON s.id = b.slot_id 
                AND b.court_id = $1 
                AND b.booking_date = $2
                AND b.status_id != 3 -- Trừ những đơn đã hủy
            WHERE s.court_id = $1 -- CHỈ LẤY CÁC KHUNG GIỜ CỦA ĐÚNG SÂN NÀY
            ORDER BY s.start_time
        `;

        const result = await pool.query(sql, [courtId, date]);
        res.json(result.rows);

    } catch (error) {
        console.error('Lỗi lấy khung giờ:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch' });
    }
});

// 5. Lấy đánh giá
router.get('/:id/reviews', async (req, res) => {
    try {
        // Kiểm tra xem bảng reviews có tồn tại không để tránh lỗi
        // Nếu bạn chưa tạo bảng reviews thì trả về rỗng
        const result = await pool.query(`
            SELECT r.*, u.full_name as user_name
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.court_id = $1
            ORDER BY r.created_at DESC
        `, [req.params.id]);

        res.json(result.rows);
    } catch (error) {
        console.log('Chưa có review hoặc lỗi bảng review, trả về rỗng.');
        res.json([]);
    }
});

module.exports = router;