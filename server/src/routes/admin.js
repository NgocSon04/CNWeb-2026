const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ==========================================
// Middleware bảo mật
// ==========================================
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// 1. QUẢN LÝ ĐẶT SÂN
// ==========================================
router.get('/bookings', async (req, res) => {
    try {
        const { status } = req.query;

        let sql = `
            SELECT 
                b.*,
                c.name AS court_name,
                s.start_time,
                s.end_time,
                LOWER(bs.name) AS status,
                u.full_name AS user_name,
                u.email AS user_email
            FROM bookings b
            LEFT JOIN courts c ON b.court_id = c.id
            LEFT JOIN time_slots s ON b.slot_id = s.id
            LEFT JOIN booking_statuses bs ON b.status_id = bs.id
            LEFT JOIN users u ON b.user_id = u.id
        `;

        const params = [];

        if (status) {
            sql += ` WHERE LOWER(bs.name) = LOWER($1)`;
            params.push(status);
        }

        sql += ` ORDER BY b.created_at DESC`;

        const result = await pool.query(sql, params);

        res.json(result.rows);

    } catch (error) {
        console.error('Lỗi lấy danh sách:', error);
        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

// ==========================================
// 2. XÁC NHẬN / HỦY / HOÀN THÀNH ĐƠN
// ==========================================
router.put('/bookings/:id', async (req, res) => {
    try {
        const { action, reason } = req.body;

        let targetStatusName = '';

        if (action === 'confirm') {
            targetStatusName = 'confirmed';
        } else if (action === 'complete') {
            targetStatusName = 'completed';
        } else if (action === 'cancel') {
            targetStatusName = 'cancelled';
        } else {
            return res.status(400).json({
                error: 'Hành động không hợp lệ'
            });
        }

        const statusRes = await pool.query(
            `SELECT id FROM booking_statuses WHERE LOWER(name) = LOWER($1)`,
            [targetStatusName]
        );

        if (statusRes.rows.length === 0) {
            return res.status(500).json({
                error: `Không tìm thấy trạng thái ${targetStatusName}`
            });
        }

        const newStatusId = statusRes.rows[0].id;

        await pool.query(
            `UPDATE bookings SET status_id = $1 WHERE id = $2`,
            [newStatusId, req.params.id]
        );

        // Lưu lý do hủy
        if (action === 'cancel' && reason) {
            try {
                await pool.query(
                    `
                    INSERT INTO booking_cancellations
                    (booking_id, reason, cancelled_by)
                    VALUES ($1, $2, $3)
                    `,
                    [req.params.id, reason, req.user.id]
                );
            } catch (err) {
                console.log('Không thể lưu log hủy đơn');
            }
        }

        res.json({
            message: 'Cập nhật trạng thái thành công'
        });

    } catch (error) {
        console.error('Lỗi cập nhật booking:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

// ==========================================
// 3. BÁO CÁO DOANH THU
// ==========================================
router.get('/revenue', async (req, res) => {
    try {

        // Lấy danh sách trạng thái
        const statusRes = await pool.query(`
            SELECT id, name FROM booking_statuses
        `);

        const getStatusId = (statusName) => {
            const found = statusRes.rows.find(
                s => s.name.toLowerCase() === statusName.toLowerCase()
            );

            return found ? found.id : null;
        };

        const pendingId = getStatusId('pending');
        const confirmedId = getStatusId('confirmed');
        const cancelledId = getStatusId('cancelled');
        const completedId = getStatusId('completed');

        // Tổng doanh thu
        const totalRes = await pool.query(`
            SELECT COALESCE(SUM(total_price), 0) AS total
            FROM bookings
            WHERE status_id IN ($1, $2)
        `, [confirmedId, completedId]);

        // Doanh thu theo sân
        const revenueByCourt = await pool.query(`
            SELECT 
                c.name AS court_name,
                COUNT(b.id) AS booking_count,
                COALESCE(SUM(b.total_price), 0) AS revenue
            FROM courts c
            LEFT JOIN bookings b
                ON c.id = b.court_id
                AND b.status_id IN ($1, $2)
            GROUP BY c.id, c.name
            ORDER BY revenue DESC
        `, [confirmedId, completedId]);

        // Doanh thu theo tháng
        const revenueByMonth = await pool.query(`
            SELECT
                TO_CHAR(booking_date, 'YYYY-MM') AS month,
                COALESCE(SUM(total_price), 0) AS revenue
            FROM bookings
            WHERE status_id IN ($1, $2)
            GROUP BY TO_CHAR(booking_date, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        `, [confirmedId, completedId]);

        // Thống kê booking
        const statsRes = await pool.query(`
            SELECT
                COUNT(*) AS total,

                SUM(
                    CASE
                        WHEN status_id = $1 THEN 1
                        ELSE 0
                    END
                ) AS pending,

                SUM(
                    CASE
                        WHEN status_id = $2 THEN 1
                        ELSE 0
                    END
                ) AS confirmed,

                SUM(
                    CASE
                        WHEN status_id = $3 THEN 1
                        ELSE 0
                    END
                ) AS cancelled,

                SUM(
                    CASE
                        WHEN status_id = $4 THEN 1
                        ELSE 0
                    END
                ) AS completed

            FROM bookings
        `, [
            pendingId,
            confirmedId,
            cancelledId,
            completedId
        ]);

        const stats = statsRes.rows[0];

        res.json({
            totalRevenue: totalRes.rows[0].total,

            revenueByCourt: revenueByCourt.rows,

            revenueByMonth: revenueByMonth.rows,

            bookingStats: {
                total: parseInt(stats.total) || 0,
                pending: parseInt(stats.pending) || 0,
                confirmed: parseInt(stats.confirmed) || 0,
                cancelled: parseInt(stats.cancelled) || 0,
                completed: parseInt(stats.completed) || 0
            }
        });

    } catch (error) {
        console.error('Lỗi doanh thu:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

// ==========================================
// 4. QUẢN LÝ KHÁCH HÀNG
// ==========================================
router.get('/customers', async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT *
            FROM users
            WHERE role_id = (
                SELECT id
                FROM roles
                WHERE name = 'user'
            )
        `);

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});
// ==========================================
// XÓA KHÁCH HÀNG
// ==========================================
router.delete('/customers/:id', async (req, res) => {
    try {

        const userId = req.params.id;

        // Không cho xóa admin
        const userCheck = await pool.query(`
            SELECT u.id, r.name as role_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [userId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Không tìm thấy người dùng'
            });
        }

        if (userCheck.rows[0].role_name === 'admin') {
            return res.status(403).json({
                error: 'Không thể xóa tài khoản admin'
            });
        }

        // Xóa booking trước
        await pool.query(`
            DELETE FROM bookings
            WHERE user_id = $1
        `, [userId]);

        // Xóa user
        await pool.query(`
            DELETE FROM users
            WHERE id = $1
        `, [userId]);

        res.json({
            message: 'Xóa khách hàng thành công'
        });

    } catch (error) {

        console.error('Lỗi xóa khách hàng:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});
// ==========================================
// KHÓA / MỞ KHÓA TÀI KHOẢN
// ==========================================
router.put('/customers/:id/lock', async (req, res) => {
    try {

        const userId = req.params.id;

        // Kiểm tra user tồn tại
        const userRes = await pool.query(`
            SELECT u.id, u.is_locked, r.name as role_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [userId]);

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                error: 'Không tìm thấy người dùng'
            });
        }

        const user = userRes.rows[0];

        // Không cho khóa admin
        if (user.role_name === 'admin') {
            return res.status(403).json({
                error: 'Không thể khóa tài khoản admin'
            });
        }

        // Đảo trạng thái
        const newStatus = !user.is_locked;

        await pool.query(`
            UPDATE users
            SET is_locked = $1
            WHERE id = $2
        `, [newStatus, userId]);

        res.json({
            message: newStatus
                ? 'Mở khóa tài khoản thành công'
                : 'Khóa tài khoản thành công',
            is_locked: newStatus
        });

    } catch (error) {

        console.error('Lỗi khóa tài khoản:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});
// ==========================================
// 5. QUẢN LÝ SÂN
// ==========================================
router.post('/courts', async (req, res) => {
    try {

        const {
            name,
            address,
            district_id,
            price_per_hour,
            description,
            image_url
        } = req.body;

        await pool.query(`
            INSERT INTO courts
            (
                name,
                address,
                district_id,
                price_per_hour,
                description,
                image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            name,
            address,
            district_id,
            price_per_hour,
            description,
            image_url
        ]);

        res.status(201).json({
            message: 'Thêm sân thành công'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

router.put('/courts/:id', async (req, res) => {
    try {

        const {
            name,
            address,
            district_id,
            price_per_hour,
            description,
            image_url
        } = req.body;

        await pool.query(`
            UPDATE courts
            SET
                name = $1,
                address = $2,
                district_id = $3,
                price_per_hour = $4,
                description = $5,
                image_url = $6
            WHERE id = $7
        `, [
            name,
            address,
            district_id,
            price_per_hour,
            description,
            image_url,
            req.params.id
        ]);

        res.json({
            message: 'Cập nhật sân thành công'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

router.delete('/courts/:id', async (req, res) => {
    try {

        await pool.query(`
            DELETE FROM courts
            WHERE id = $1
        `, [req.params.id]);

        res.json({
            message: 'Xóa sân thành công'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

// ==========================================
// 6. QUẢN LÝ KHUNG GIỜ
// ==========================================

// Lấy danh sách khung giờ
router.get('/courts/:id/slots', async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT *
            FROM time_slots
            ORDER BY start_time
        `);

        const slots = result.rows.map(slot => ({
            ...slot,
            is_available:
                slot.is_available === undefined ||
                slot.is_available === null
                    ? true
                    : slot.is_available
        }));

        res.json(slots);

    } catch (error) {
        console.error('Lỗi lấy khung giờ:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });
    }
});

// Cập nhật trạng thái khung giờ
router.put('/courts/:id/slots', async (req, res) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const { slots } = req.body;

        if (!slots || !Array.isArray(slots)) {
            return res.status(400).json({
                error: 'Dữ liệu slots không hợp lệ'
            });
        }

        for (const slot of slots) {

            if (
                slot.id &&
                slot.is_available !== undefined
            ) {
                await client.query(`
                    UPDATE time_slots
                    SET is_available = $1
                    WHERE id = $2
                `, [
                    slot.is_available,
                    slot.id
                ]);
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Cập nhật khung giờ thành công'
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Lỗi cập nhật slots:', error);

        res.status(500).json({
            error: 'Lỗi server'
        });

    } finally {
        client.release();
    }
});

module.exports = router;