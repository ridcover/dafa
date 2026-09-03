const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/auditLogger');

/**
 * POST /api/auth/login
 * Login dengan username dan password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.'
      });
    }

    // Ambil data user beserta client_access
    const [users] = await pool.query(
      `SELECT u.id, u.nama, u.username, u.password, u.role,
              ca.kepsek, ca.waka_kurikulum, ca.waka_kesiswaan, ca.waka_sarpras, ca.bendahara, ca.tu, ca.guru
       FROM users u
       LEFT JOIN client_access ca ON u.id = ca.user_id
       WHERE u.username = ?`,
      [username.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password tidak valid.'
      });
    }

    const user = users[0];

    // Verifikasi password dengan bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password tidak valid.'
      });
    }

    // Buat JWT Token
    const payload = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
    });

    const accessRoles = {
      kepsek: Boolean(user.kepsek),
      waka_kurikulum: Boolean(user.waka_kurikulum),
      waka_kesiswaan: Boolean(user.waka_kesiswaan),
      waka_sarpras: Boolean(user.waka_sarpras),
      bendahara: Boolean(user.bendahara),
      tu: Boolean(user.tu),
      guru: Boolean(user.guru)
    };

    // Catat log aktivitas login
    await logActivity(req, 'LOGIN', `Pengguna '${user.nama}' (${user.username}) berhasil login.`, user.id, user.username);

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token: token,
      user: {
        id: user.id,
        nama: user.nama,
        username: user.username,
        role: user.role,
        isAdmin: user.role === 'admin',
        access: accessRoles
      }
    });

  } catch (err) {
    console.error(`[Login Error]`, err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat proses login.'
    });
  }
});

/**
 * GET /api/auth/me
 * Mendapatkan profil & status autentikasi user saat ini
 */
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Logout dan hapus cookie autentikasi
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await logActivity(req, 'LOGOUT', `Pengguna '${req.user.nama}' (${req.user.username}) logout.`);
    
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      message: 'Logout berhasil.'
    });
  } catch (err) {
    console.error(`[Logout Error]`, err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat proses logout.'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Ubah password akun sendiri
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password saat ini dan password baru wajib diisi.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal 6 karakter.'
      });
    }

    // Ambil user dan verifikasi password lama
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Password saat ini yang Anda masukkan salah.'
      });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    await logActivity(req, 'CHANGE_PASSWORD', `Pengguna '${req.user.nama}' berhasil mengubah kata sandi.`);

    return res.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui.'
    });
  } catch (err) {
    console.error(`[Change Password Error]`, err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui kata sandi.'
    });
  }
});

module.exports = router;
