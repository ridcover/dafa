const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'daf_archive_smk_diponegoro_cipari_secret_key_2026_thesis_secure_jwt';

/**
 * Middleware Autentikasi JWT (Mendukung HTTP-Only Cookie dan Header Authorization)
 */
async function authenticateToken(req, res, next) {
  try {
    let token = null;

    // 1. Cek dari HTTP-Only Cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Cek dari Header Authorization: Bearer <token>
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 3. Cek dari Query Parameter (Fallback untuk tag <iframe> / <img> preview)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.'
      });
    }

    // Verifikasi Token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ambil data user terbaru dari database beserta hak akses multi-role
    const [users] = await pool.query(
      `SELECT u.id, u.nama, u.username, u.role,
              ca.kepsek, ca.waka_kurikulum, ca.waka_kesiswaan, ca.waka_sarpras, ca.bendahara, ca.tu, ca.guru
       FROM users u
       LEFT JOIN client_access ca ON u.id = ca.user_id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan atau sesi telah berakhir.'
      });
    }

    const user = users[0];
    
    // Susun object access roles
    req.user = {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role, // 'admin' | 'client'
      isAdmin: user.role === 'admin',
      access: {
        kepsek: Boolean(user.kepsek),
        waka_kurikulum: Boolean(user.waka_kurikulum),
        waka_kesiswaan: Boolean(user.waka_kesiswaan),
        waka_sarpras: Boolean(user.waka_sarpras),
        bendahara: Boolean(user.bendahara),
        tu: Boolean(user.tu),
        guru: Boolean(user.guru)
      }
    };

    next();
  } catch (err) {
    console.error(`[Auth Middleware Error]`, err.message);
    return res.status(401).json({
      success: false,
      message: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.'
    });
  }
}

/**
 * Middleware untuk memastikan role Admin
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses terlarang: Fitur ini hanya dapat diakses oleh Administrator.'
    });
  }
  next();
}

/**
 * Middleware untuk validasi hak akses jabatan (RBAC)
 * Admin memiliki akses penuh ke semua folder jabatan.
 */
function authorizeJabatan(targetJabatan) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Belum terautentikasi.' });
    }

    if (req.user.isAdmin) {
      return next();
    }

    const jabatan = targetJabatan || req.body.jabatan || req.query.jabatan || req.params.jabatan;

    if (!jabatan) {
      return next();
    }

    if (req.user.access[jabatan] === true) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Akses ditolak: Anda tidak memiliki hak akses untuk folder jabatan '${jabatan}'.`
    });
  };
}

/**
 * Middleware Penguncian Arsip Tahun Lalu (Read-Only):
 * Mencegah operasi mutasi (POST, PUT, DELETE) pada tahun pelajaran yang sudah lewat.
 */
async function checkLockedYear(req, res, next) {
  try {
    // Lewati jika request bertipe pembacaan data (GET / HEAD)
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    // Administrator memiliki akses penuh untuk mengelola seluruh tahun pelajaran
    if (req.user && req.user.isAdmin) {
      return next();
    }

    const requestedTapel = req.body.tapel || req.query.tapel || req.params.tapel;
    if (!requestedTapel) {
      return next();
    }

    // Ambil daftar tahun pelajaran yang berstatus terbuka (is_open = 1)
    const [openRows] = await pool.query('SELECT ta FROM tahun_akademik WHERE is_open = 1');
    const openYears = openRows.map((r) => r.ta);

    // Fallback: pastikan active_tahun_pelajaran dari global_settings selalu berstatus terbuka
    let activeTapel = '2026/2027';
    try {
      const [settings] = await pool.query('SELECT active_tahun_pelajaran FROM global_settings WHERE id = 1');
      if (settings.length > 0) activeTapel = settings[0].active_tahun_pelajaran;
    } catch (e) {}

    if (activeTapel && !openYears.includes(activeTapel)) {
      openYears.push(activeTapel);
    }

    if (!openYears.includes(requestedTapel)) {
      return res.status(403).json({
        success: false,
        isLocked: true,
        message: `Arsip Tahun Pelajaran '${requestedTapel}' telah dikunci (Read-Only). Anda hanya dapat melihat dan mengunduh berkas.`
      });
    }

    next();
  } catch (err) {
    console.error(`[checkLockedYear Error]`, err.message);
    next();
  }
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireAdmin,
  authorizeJabatan,
  checkLockedYear
};
