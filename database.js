const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./koperasi.db', (err) => {
    if (err) {
        console.error('Gagal terhubung ke database SQLite:', err.message);
    } else {
        console.log('Terhubung ke database SQLite (koperasi.db).');
    }
});

db.serialize(() => {
    // 1. Tabel Users (Ditambahkan kolom 'role')
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nik TEXT UNIQUE,
            password TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            bank TEXT,
            department TEXT,
            role TEXT DEFAULT 'anggota',
            simpanan_pokok REAL DEFAULT 1000000,
            simpanan_wajib REAL DEFAULT 4500000,
            simpanan_sukarela REAL DEFAULT 10000000
        )
    `);

    // 2. Tabel Simpanan Transaksi
    db.run(`
        CREATE TABLE IF NOT EXISTS simpanan_transaksi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            tanggal TEXT,
            jenis TEXT,
            keterangan TEXT,
            amount REAL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // 3. Tabel Pinjaman
    db.run(`
        CREATE TABLE IF NOT EXISTS pinjaman (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            tanggal TEXT,
            jumlah REAL,
            tenor INTEGER,
            status TEXT,
            keperluan TEXT,
            sisa_pinjaman REAL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Hashing Password
    const salt = bcrypt.genSaltSync(10);
    const passUser = bcrypt.hashSync('user123', salt);
    const passAdmin = bcrypt.hashSync('admin123', salt);

    // Seed Data 1: Anggota (NIK: 123456 / Pass: user123)
    db.get(`SELECT * FROM users WHERE nik = '123456'`, (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (nik, password, name, email, phone, bank, department, role)
                VALUES ('123456', ?, 'Dowell Simbolon', 'dowell@koperasi.co.id', '+62 812-3456-7890', 'Bank Mandiri - 137000987654', 'Informatics Engineering', 'anggota')
            `, [passUser], function (err) {
                if (!err) {
                    const userId = this.lastID;
                    db.run(`INSERT INTO simpanan_transaksi (user_id, tanggal, jenis, keterangan, amount) VALUES (?, '2026-09-01', 'Simpanan Wajib', 'Auto-debit Payroll Sept', 100000)`, [userId]);
                    db.run(`INSERT INTO simpanan_transaksi (user_id, tanggal, jenis, keterangan, amount) VALUES (?, '2026-08-15', 'Simpanan Sukarela', 'Setoran Tunai', 500000)`, [userId]);
                    db.run(`INSERT INTO pinjaman (user_id, tanggal, jumlah, tenor, status, keperluan, sisa_pinjaman) VALUES (?, '2026-05-10', 6000000, 12, 'Disetujui', 'Renovasi Rumah', 4250000)`, [userId]);
                }
            });
        }
    });

    // Seed Data 2: Bendahara (NIK: 888888 / Pass: admin123)
    db.get(`SELECT * FROM users WHERE nik = '888888'`, (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (nik, password, name, email, phone, bank, department, role)
                VALUES ('888888', ?, 'Susanti (Bendahara)', 'bendahara@koperasi.co.id', '+62 812-9999-0000', 'Bank BCA', 'Finance & Accounting', 'bendahara')
            `, [passAdmin]);
        }
    });

    // Seed Data 3: Pengurus (NIK: 999999 / Pass: admin123)
    db.get(`SELECT * FROM users WHERE nik = '999999'`, (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (nik, password, name, email, phone, bank, department, role)
                VALUES ('999999', ?, 'Ivan Sihite (Pengurus)', 'pengurus@koperasi.co.id', '+62 812-8888-0000', 'Bank BNI', 'Management', 'pengurus')
            `, [passAdmin]);
        }
    });
});

module.exports = db;