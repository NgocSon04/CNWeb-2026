// Admin Timeslots Page

let currentCourtId = null;
let currentSlots = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    if (!requireAdmin()) return;

    loadCourts();

    document.getElementById('court-select').addEventListener('change', loadSlots);
    document.getElementById('save-slots-btn').addEventListener('click', saveSlots);
});

async function loadCourts() {
    try {
        const courts = await api.get('/courts');
        const select = document.getElementById('court-select');

        select.innerHTML = '<option value="">-- Chọn sân --</option>' +
            courts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        showAlert('Không thể tải danh sách sân', 'error');
    }
}

async function loadSlots() {
    const courtId = document.getElementById('court-select').value;
    const container = document.getElementById('slots-list');

    if (!courtId) {
        container.innerHTML = '<p class="text-muted">Vui lòng chọn sân để xem khung giờ.</p>';
        return;
    }

    currentCourtId = courtId;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
       const slots = await api.get(`/admin/courts/${courtId}/slots`);
        currentSlots = slots;

        container.innerHTML = time_slots.map(slot => `
      <div class="slot-item">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" 
                 data-slot-id="${slot.id}" 
                 ${slot.is_available ? 'checked' : ''}>
          <strong>${slot.start_time} - ${slot.end_time}</strong>
        </label>
        <span class="badge ${slot.is_available ? 'badge-success' : 'badge-secondary'}">
          ${slot.is_available ? 'Hoạt động' : 'Tạm ngưng'}
        </span>
      </div>
    `).join('');
    } catch (error) {
        container.innerHTML = '<p class="text-danger">Có lỗi xảy ra.</p>';
    }
}

async function saveSlots() {
    if (!currentCourtId) {
        showAlert('Vui lòng chọn sân', 'warning');
        return;
    }

    const btn = document.getElementById('save-slots-btn');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    const slots = [];
    document.querySelectorAll('#slots-list input[type="checkbox"]').forEach(cb => {
        time_slots.push({
            id: parseInt(cb.dataset.slotId),
            is_available: cb.checked
        });
    });

    try {
        await api.put(`/admin/courts/${currentCourtId}/slots`, { slots });
        showAlert('Cập nhật khung giờ thành công!', 'success');
        loadSlots();
    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Lưu thay đổi';
    }
}
