// Konfigurasi URL Base REST API Back-End Node.js
const API_BASE_URL = 'https://koperasi-backend-g1z7u7hh2-frans-dowell.vercel.app/';

let chartInstance = null;

// Helper: Header Request dengan Authorization JWT Token
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Helper: Format Angka ke Rupiah
function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(angka || 0);
}

// ================= LOGIKA LOGIN & LOGOUT =================
async function handleLogin(event) {
    if (event) event.preventDefault();
    const nik = document.getElementById("nik").value;
    const password = document.getElementById("password").value;

    try {
       fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nik, password })
        });

        const result = await response.json();

        if (result.success) {
            // Simpan JWT Token, Role, dan Nama di LocalStorage
            localStorage.setItem("token", result.token);
            localStorage.setItem("userRole", result.user.role);
            localStorage.setItem("userName", result.user.name);

            // Terapkan aturan hak akses menu & tampilkan aplikasi
            applyRolePermissions();
            showAppView();
        } else {
            alert(`Login Gagal: ${result.message}`);
        }
    } catch (error) {
        console.error('Error login:', error);
        alert("Gagal terhubung ke server Back-End. Pastikan Node.js berjalan di port 5000!");
    }
}

function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    
    // Sembunyikan menu admin saat keluar
    const adminNav = document.getElementById('nav-admin') || document.getElementById('admin-menu');
    if (adminNav) {
        adminNav.style.display = 'none';
        adminNav.classList.add('hidden');
    }
    
    showLoginView();
}

function showLoginView() {
    const loginView = document.getElementById("login-view");
    const appView = document.getElementById("app-view");

    if (loginView) loginView.classList.remove("hidden");
    if (appView) appView.classList.add("hidden");
}

function showAppView() {
    const loginView = document.getElementById("login-view");
    const appView = document.getElementById("app-view");

    if (loginView) loginView.classList.add("hidden");
    if (appView) appView.classList.remove("hidden");
    
    // Terapkan hak akses role
    applyRolePermissions();

    // Default: Buka tab dashboard
    showTab('dashboard');
    
    // Muat semua data dari REST API
    loadUserProfile();
    loadDashboardSummary();
    loadSimpananData();
    loadPinjamanData();
    loadPayrollData();
    if (document.getElementById("calc-amount")) updateLoanCalc();
    initChart();
}

// ==================== NAVIGATION TAB SYSTEM ====================
function showTab(tabId) {
    // 1. Sembunyikan semua tab-content & reset kelas active dari menu
    document.querySelectorAll(".tab-content").forEach(el => {
        el.classList.remove("active");
        el.style.display = "none";
    });

    document.querySelectorAll(".nav-links a, .nav-menu button").forEach(el => {
        el.classList.remove("active");
    });

    // 2. Cari elemen tab & navigasi yang dituju (Mendukung ID tab-xxx atau xxx-section)
    const targetTab = document.getElementById(`tab-${tabId}`) || document.getElementById(`${tabId}-section`);
    const targetNav = document.getElementById(`nav-${tabId}`) || document.getElementById(`${tabId}-menu`);

    // 3. Tampilkan tab jika ditemukan
    if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
    }

    if (targetNav) {
        targetNav.classList.add("active");
    }
}

// Alias agar fungsi 'switchTab' di HTML juga berfungsi normal
const switchTab = showTab;

// ================= HAK AKSES PERMISSIONS =================
function applyRolePermissions() {
    const role = localStorage.getItem('userRole');
    const adminNav = document.getElementById('nav-admin') || document.getElementById('admin-menu');

    if (!adminNav) return;

    if (role === 'bendahara' || role === 'pengurus') {
        adminNav.style.display = 'block';
        adminNav.classList.remove('hidden');
    } else {
        adminNav.style.display = 'none';
        adminNav.classList.add('hidden');
    }
}

// ================= 1. FETCH USER PROFILE =================
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            return handleLogout(); // Session kadaluwarsa
        }

        const result = await response.json();
        if (result.success) {
            const user = result.data;
            const userGreeting = document.getElementById("user-greeting");
            const headerUserName = document.getElementById("header-user-name");

            if (userGreeting) userGreeting.innerText = `Selamat Datang, ${user.name}`;
            if (headerUserName) headerUserName.innerText = user.name;
            
            // Isi form profil jika elemennya ada
            if (document.getElementById("prof-name")) document.getElementById("prof-name").value = user.name || '';
            if (document.getElementById("prof-email")) document.getElementById("prof-email").value = user.email || '';
            if (document.getElementById("prof-phone")) document.getElementById("prof-phone").value = user.phone || '';
            if (document.getElementById("prof-bank")) document.getElementById("prof-bank").value = user.bank || '';
        }
    } catch (error) {
        console.error('Gagal memuat profil:', error);
    }
}

async function saveProfile(e) {
    if (e) e.preventDefault();
    const payload = {
        name: document.getElementById("prof-name").value,
        email: document.getElementById("prof-email").value,
        phone: document.getElementById("prof-phone").value,
        bank: document.getElementById("prof-bank").value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            alert(result.message);
            loadUserProfile();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert("Gagal memperbarui profil.");
    }
}

// ================= 2. FETCH DASHBOARD SUMMARY =================
async function loadDashboardSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            if (document.getElementById("dash-total-simpanan")) {
                document.getElementById("dash-total-simpanan").innerText = formatRupiah(result.data.totalSimpanan);
            }
            if (document.getElementById("dash-sisa-pinjaman")) {
                document.getElementById("dash-sisa-pinjaman").innerText = formatRupiah(result.data.sisaPinjaman);
            }
            if (document.getElementById("dash-payroll-cut")) {
                document.getElementById("dash-payroll-cut").innerText = formatRupiah(result.data.potonganPayroll);
            }
        }
    } catch (error) {
        console.error('Gagal memuat ringkasan dashboard:', error);
    }
}

// ================= 3. FETCH DATA SIMPANAN =================
async function loadSimpananData() {
    try {
        const response = await fetch(`${API_BASE_URL}/simpanan`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            // Update rincian saldo
            if (document.getElementById("val-simpanan-pokok")) {
                document.getElementById("val-simpanan-pokok").innerText = formatRupiah(result.saldo.pokok);
            }
            if (document.getElementById("val-simpanan-wajib")) {
                document.getElementById("val-simpanan-wajib").innerText = formatRupiah(result.saldo.wajib);
            }
            if (document.getElementById("val-simpanan-sukarela")) {
                document.getElementById("val-simpanan-sukarela").innerText = formatRupiah(result.saldo.sukarela);
            }

            // Render Tabel Riwayat
            const tableBody = document.getElementById("table-simpanan-body");
            if (tableBody) {
                tableBody.innerHTML = "";
                result.riwayat.forEach(item => {
                    const row = `<tr>
                        <td>${item.tanggal}</td>
                        <td><span class="badge">${item.jenis}</span></td>
                        <td>${item.keterangan}</td>
                        <td style="color:var(--success); font-weight:bold;">+ ${formatRupiah(item.amount)}</td>
                    </tr>`;
                    tableBody.innerHTML += row;
                });
            }
        }
    } catch (error) {
        console.error('Gagal memuat data simpanan:', error);
    }
}

async function handleTransactionSimpanan(e) {
    if (e) e.preventDefault();
    const payload = {
        jenis_transaksi: document.getElementById("modal-type").value,
        amount: parseFloat(document.getElementById("modal-amount").value),
        keterangan: document.getElementById("modal-note").value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/simpanan/transaksi`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            alert(result.message);
            closeModalSimpanan();
            loadSimpananData();
            loadDashboardSummary();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert("Gagal memproses transaksi simpanan.");
    }
}

function openModalSimpanan() {
    const modal = document.getElementById("simpanan-modal");
    if (modal) modal.classList.remove("hidden");
}

function closeModalSimpanan() {
    const modal = document.getElementById("simpanan-modal");
    if (modal) modal.classList.add("hidden");
}

// ================= 4. FETCH DATA PINJAMAN =================
async function loadPinjamanData() {
    try {
        const response = await fetch(`${API_BASE_URL}/pinjaman`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            const loanBody = document.getElementById("table-pinjaman-body");
            if (loanBody) {
                loanBody.innerHTML = "";
                result.data.forEach(item => {
                    const badgeClass = item.status === 'Disetujui' ? 'badge-success' : '';
                    const row = `<tr>
                        <td>${item.tanggal}</td>
                        <td>${formatRupiah(item.jumlah)}</td>
                        <td>${item.tenor} Bln</td>
                        <td><span class="badge ${badgeClass}">${item.status}</span></td>
                    </tr>`;
                    loanBody.innerHTML += row;
                });
            }
        }
    } catch (error) {
        console.error('Gagal memuat data pinjaman:', error);
    }
}

function updateLoanCalc() {
    const amountEl = document.getElementById("calc-amount");
    const tenorEl = document.getElementById("calc-tenor");
    const resultEl = document.getElementById("calc-installment");

    if (!amountEl || !tenorEl || !resultEl) return;

    const amount = parseFloat(amountEl.value) || 0;
    const tenor = parseInt(tenorEl.value) || 12;

    const totalBunga = amount * 0.01 * tenor;
    const totalBayar = amount + totalBunga;
    const angsuranPerBulan = totalBayar / tenor;

    resultEl.innerText = `${formatRupiah(Math.round(angsuranPerBulan))}/bln`;
}

async function submitPinjaman(e) {
    if (e) e.preventDefault();
    const payload = {
        jumlah: parseFloat(document.getElementById("calc-amount").value),
        tenor: parseInt(document.getElementById("calc-tenor").value),
        keperluan: document.getElementById("calc-reason").value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/pinjaman/pengajuan`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            alert(result.message);
            document.getElementById("calc-reason").value = "";
            loadPinjamanData();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert("Gagal mengirim pengajuan pinjaman.");
    }
}

// ================= 5. FETCH DATA PAYROLL SLIP =================
async function loadPayrollData() {
    try {
        const response = await fetch(`${API_BASE_URL}/payroll/slip`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            if (document.getElementById("pay-name")) document.getElementById("pay-name").innerText = result.karyawan.name;
            if (document.getElementById("pay-total-val")) document.getElementById("pay-total-val").innerText = formatRupiah(result.totalPotongan);
        }
    } catch (error) {
        console.error('Gagal memuat slip payroll:', error);
    }
}

// ================= 6. CHART.JS INTEGRATION =================
function initChart() {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return; // Mencegah error jika elemen canvas tidak ada

    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mei', 'Jun', 'Jul', 'Agt', 'Sept'],
            datasets: [
                {
                    label: 'Total Simpanan (Rp)',
                    data: [12000000, 13000000, 14200000, 14800000, 15500000],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Sisa Pinjaman (Rp)',
                    data: [6000000, 5500000, 5000000, 4500000, 4250000],
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// ================= INISIALISASI SAAT HALAMAN DILOAD =================
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (token) {
        showAppView();
    } else {
        showLoginView();
    }
});
