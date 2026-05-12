// Booking page functionality

let courtData = null;
let selectedSlot = null;
let selectedDate = null;
let paymentMethods = [];

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courtId = urlParams.get('id');

    if (!courtId) {
        window.location.href = '/user/search/search.html';
        return;
    }

    loadCourtDetails(courtId);
    loadPaymentMethods();

    document.getElementById('confirm-booking-btn').addEventListener('click', submitBooking);
});

async function loadPaymentMethods() {
    try {
        paymentMethods = await api.get('/bookings/payment-methods/list');
    } catch (error) {
        console.error('Load payment methods error:', error);
    }
}

async function loadCourtDetails(courtId) {
    const container = document.getElementById('court-detail');

    try {
        courtData = await api.get(`/courts/${courtId}`);
        const reviews = await api.get(`/courts/${courtId}/reviews`);

        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        selectedDate = tomorrow.toISOString().split('T')[0];

        container.innerHTML = `
      <!-- Left: Court Info -->
      <div>
        <img src="${courtData.image_url || 'https://via.placeholder.com/600x400?text=Pickleball+Court'}" 
             alt="${courtData.name}" 
             style="width: 100%; height: 300px; object-fit: cover; border-radius: var(--radius-lg);"
             onerror="this.src='https://via.placeholder.com/600x400?text=Pickleball+Court'">
        
        <h1 class="mt-2">${courtData.name}</h1>
        <p class="text-muted">📍 ${courtData.address}, ${courtData.district_name}</p>
        
        <div class="flex-between mt-2">
          <div>
            ${courtData.avg_rating
                ? `${getStarsHTML(Math.round(courtData.avg_rating))} (${courtData.review_count} đánh giá)`
                : 'Chưa có đánh giá'
            }
          </div>
          <div class="text-lg font-bold text-primary">${formatPrice(courtData.price_per_hour)}/giờ</div>
        </div>

        ${courtData.description ? `<p class="mt-2">${courtData.description}</p>` : ''}

        <!-- Reviews -->
        <div class="mt-3">
          <h3>Đánh giá từ khách hàng</h3>
          ${reviews.length > 0
                ? reviews.slice(0, 3).map(r => `
                <div class="card" style="padding: 1rem;">
                  <div class="flex-between">
                    <strong>${r.user_name}</strong>
                    ${getStarsHTML(r.rating)}
                  </div>
                  <p class="text-muted text-sm mt-1">${r.comment || 'Không có nhận xét'}</p>
                </div>
              `).join('')
                : '<p class="text-muted">Chưa có đánh giá nào.</p>'
            }
        </div>
      </div>

      <!-- Right: Booking Form -->
      <div class="card">
        <h2 class="mb-2">Đặt sân</h2>

        <div class="form-group">
          <label class="form-label">Chọn ngày</label>
          <input type="date" id="booking-date" class="form-control" 
                 value="${selectedDate}" 
                 min="${new Date().toISOString().split('T')[0]}">
        </div>

        <div class="form-group">
          <label class="form-label">Chọn khung giờ</label>
          <div id="slots-container" class="slot-grid">
            <div class="loading"><div class="spinner"></div></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Phương thức thanh toán</label>
          <select id="payment-method" class="form-control">
            <option value="">-- Chọn phương thức --</option>
            ${paymentMethods.map(p => `<option value="${p.id}">${p.display_name}</option>`).join('')}
          </select>
        </div>

        <div class="card" style="background: var(--background-alt);">
          <div class="flex-between">
            <span>Giá mỗi giờ:</span>
            <span>${formatPrice(courtData.price_per_hour)}</span>
          </div>
          <div class="flex-between">
            <span>Thời lượng:</span>
            <span>1.5 giờ</span>
          </div>
          <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid var(--border-color);">
          <div class="flex-between font-bold">
            <span>Tổng cộng:</span>
            <span class="text-primary">${formatPrice(courtData.price_per_hour * 1.5)}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-block mt-2" id="book-btn" disabled>
          Đặt sân ngay
        </button>
        <p class="text-center text-muted text-sm mt-1">
          ${isLoggedIn() ? '' : '<a href="/auth/login/login.html">Đăng nhập</a> để đặt sân'}
        </p>
      </div>
    `;

        // Load slots
        loadSlots();

        // Event listeners
        document.getElementById('booking-date').addEventListener('change', (e) => {
            selectedDate = e.target.value;
            selectedSlot = null;
            loadSlots();
        });

        document.getElementById('book-btn').addEventListener('click', () => {
            if (!isLoggedIn()) {
                window.location.href = '/auth/login/login.html';
                return;
            }
            openConfirmModal();
        });

    } catch (error) {
        container.innerHTML = '<p class="text-center text-danger">Không thể tải thông tin sân.</p>';
    }
}

async function loadSlots() {
    const container = document.getElementById('slots-container');
    if (!container) return;

    showLoading(container);

    try {
        const slots = await api.get(`/courts/${courtData.id}/slots?date=${selectedDate}`);

        // Đã sửa: Dùng 'slots.map' thay vì 'time_slots.map'
        container.innerHTML = slots.map(slot => `
      <button class="slot-btn ${slot.available ? '' : 'unavailable'}" 
              data-slot-id="${slot.id}"
              data-start="${slot.start_time}"
              data-end="${slot.end_time}"
              ${slot.available ? '' : 'disabled'}>
        ${slot.name} <!-- Đã sửa: Dùng slot.name hiển thị giờ cho đẹp -->
      </button>
    `).join('');

        // Bắt sự kiện chọn slot
        container.querySelectorAll('.slot-btn:not(.unavailable)').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedSlot = {
                    id: btn.dataset.slotId,
                    start: btn.dataset.start,
                    end: btn.dataset.end
                };
                updateBookButton();
            });
        });

        updateBookButton();
    } catch (error) {
        console.error("Chi tiết lỗi hiển thị slot:", error); // Thêm dòng này để dễ debug
        container.innerHTML = '<p class="text-danger">Không thể tải khung giờ.</p>';
    }
}

function updateBookButton() {
    const btn = document.getElementById('book-btn');
    const paymentSelect = document.getElementById('payment-method');

    if (btn) {
        btn.disabled = !selectedSlot || !paymentSelect.value || !isLoggedIn();
    }

    if (paymentSelect) {
        paymentSelect.addEventListener('change', updateBookButton);
    }
}

function openConfirmModal() {
    const paymentSelect = document.getElementById('payment-method');
    const paymentMethod = paymentMethods.find(p => p.id == paymentSelect.value);

    document.getElementById('confirm-court').textContent = courtData.name;
    document.getElementById('confirm-date').textContent = formatDate(selectedDate);
    document.getElementById('confirm-slot').textContent = `${selectedSlot.start} - ${selectedSlot.end}`;
    document.getElementById('confirm-payment').textContent = paymentMethod ? paymentMethod.display_name : '-';
    document.getElementById('confirm-price').textContent = formatPrice(courtData.price_per_hour * 1.5);

    showModal('confirm-modal');
}

async function submitBooking() {
    const btn = document.getElementById('confirm-booking-btn');
    const paymentMethodId = document.getElementById('payment-method').value;

    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';

    try {
        await api.post('/bookings', {
            court_id: courtData.id,
            slot_id: parseInt(selectedSlot.id),
            booking_date: selectedDate,
            payment_method_id: parseInt(paymentMethodId)
        });

        hideModal('confirm-modal');
        showAlert('Đặt sân thành công!', 'success');

        setTimeout(() => {
            window.location.href = '/user/history/history.html';
        }, 1500);
    } catch (error) {
        showAlert(error.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Xác nhận đặt sân';
    }
}
