const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// API Login
app.post('/api/auth/login', (req, res) => {
    const { nik, password } = req.body;
    if (!nik || !password) {
        return res.status(400).json({ success: false, message: 'NIK dan Password wajib diisi.' });
    }

    db.get(`SELECT * FROM users WHERE nik = ?`, [nik], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, message: 'NIK atau Password salah.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'NIK atau Password salah.' });
        }

        const token = jwt.sign(
            { id: user.id, nik: user.nik, name: user.name },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: 'Login berhasil.',
            token: token,
            user: { id: user.id, nik: user.nik, name: user.name, email: user.email, department: user.department }
        });
    });
});

// API Dashboard Summary
app.get('/api/dashboard/summary', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get(`SELECT simpanan_pokok, simpanan_wajib, simpanan_sukarela FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const totalSimpanan = user.simpanan_pokok + user.simpanan_wajib + user.simpanan_sukarela;

        db.get(`SELECT SUM(sisa_pinjaman) as total_pinjaman FROM pinjaman WHERE user_id = ? AND status = 'Disetujui'`, [userId], (err, loan) => {
            const sisaPinjaman = loan.total_pinjaman || 0;
            const simpananWajibBulanan = 100000;
            const cicilanPinjamanBulanan = sisaPinjaman > 0 ? 750000 : 0;

            res.json({
                success: true,
                data: {
                    totalSimpanan,
                    sisaPinjaman,
                    potonganPayroll: simpananWajibBulanan + cicilanPinjamanBulanan
                }
            });
        });
    });
});

// API Simpanan
app.get('/api/simpanan', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get(`SELECT simpanan_pokok, simpanan_wajib, simpanan_sukarela FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        db.all(`SELECT * FROM simpanan_transaksi WHERE user_id = ? ORDER BY id DESC`, [userId], (err, history) => {
            res.json({
                success: true,
                saldo: {
                    pokok: user.simpanan_pokok,
                    wajib: user.simpanan_wajib,
                    sukarela: user.simpanan_sukarela,
                    total: user.simpanan_pokok + user.simpanan_wajib + user.simpanan_sukarela
                },
                riwayat: history
            });
        });
    });
});

app.post('/api/simpanan/transaksi', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { jenis_transaksi, amount, keterangan } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Nominal transaksi harus lebih besar dari 0.' });
    }

    db.get(`SELECT simpanan_sukarela FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        if (jenis_transaksi === 'TARIK' && user.simpanan_sukarela < amount) {
            return res.status(400).json({ success: false, message: 'Saldo Simpanan Sukarela Anda tidak mencukupi.' });
        }

        const newSaldo = jenis_transaksi === 'SETOR' ? user.simpanan_sukarela + amount : user.simpanan_sukarela - amount;

        db.run(`UPDATE users SET simpanan_sukarela = ? WHERE id = ?`, [newSaldo, userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            const tanggal = new Date().toISOString().split('T')[0];
            const ketFinal = `${jenis_transaksi === 'SETOR' ? 'Setoran' : 'Penarikan'}: ${keterangan}`;

            db.run(`INSERT INTO simpanan_transaksi (user_id, tanggal, jenis, keterangan, amount) VALUES (?, ?, 'Simpanan Sukarela', ?, ?)`,
                [userId, tanggal, ketFinal, amount],
                () => res.json({ success: true, message: 'Transaksi simpanan berhasil diproses.', saldoSukarela: newSaldo })
            );
        });
    });
});

// API Pinjaman
app.get('/api/pinjaman', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all(`SELECT * FROM pinjaman WHERE user_id = ? ORDER BY id DESC`, [userId], (err, loans) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: loans });
    });
});

app.post('/api/pinjaman/pengajuan', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { jumlah, tenor, keperluan } = req.body;

    if (!jumlah || !tenor || !keperluan) {
        return res.status(400).json({ success: false, message: 'Jumlah, tenor, dan keperluan wajib diisi.' });
    }

    const tanggal = new Date().toISOString().split('T')[0];
    db.run(
        `INSERT INTO pinjaman (user_id, tanggal, jumlah, tenor, status, keperluan, sisa_pinjaman) VALUES (?, ?, ?, ?, 'Diproses', ?, ?)`,
        [userId, tanggal, jumlah, tenor, keperluan, jumlah],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: 'Pengajuan pinjaman berhasil dikirim dan sedang diproses.' });
        }
    );
});

// API Payroll
app.get('/api/payroll/slip', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get(`SELECT name, nik, department FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        db.get(`SELECT SUM(sisa_pinjaman) as total_pinjaman FROM pinjaman WHERE user_id = ? AND status = 'Disetujui'`, [userId], (err, loan) => {
            const hasLoan = (loan.total_pinjaman || 0) > 0;
            const simpananWajib = 100000;
            const cicilanPinjaman = hasLoan ? 750000 : 0;

            res.json({
                success: true,
                periode: 'September 2026',
                karyawan: user,
                rincian: [
                    { item: 'Simpanan Wajib Bulanan', amount: simpananWajib },
                    { item: hasLoan ? 'Cicilan Pinjaman Syariah (Angsuran Ke-4 dari 12)' : 'Cicilan Pinjaman', amount: cicilanPinjaman }
                ],
                totalPotongan: simpananWajib + cicilanPinjaman
            });
        });
    });
});

// API Profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get(`SELECT nik, name, email, phone, bank, department FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: user });
    });
});

app.put('/api/user/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { name, email, phone, bank } = req.body;
    db.run(
        `UPDATE users SET name = ?, email = ?, phone = ?, bank = ? WHERE id = ?`,
        [name, email, phone, bank, userId],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: 'Profil berhasil diperbarui.' });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server Back-End Koperasi berjalan di: http://localhost:${PORT}`);
});