const jwt = require('jsonwebtoken');

const JWT_SECRET = 'koperasi_secret_key_2026_super_secure';

// 1. Verifikasi Token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token tidak valid atau telah kadaluwarsa.' });
        }
        req.user = user; // Menyimpan data payload JWT (id, nik, name, role)
        next();
    });
}

// 2. Middleware Pengecekan Hak Akses (RBAC)
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Akses Ditolak! Fitur ini hanya untuk role: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
}

module.exports = { authenticateToken, authorizeRoles, JWT_SECRET };