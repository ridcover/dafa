const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/auditLogger');

/**
 * GET /api/users
 * Mendapatkan daftar semua pengguna beserta hak akses multi-role (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.nama, u.username, u.role, u.created_at,
              ca.kepsek, ca.waka_kurikulum, ca.waka_kesiswaan, ca.waka_sarpras, ca.bendahara, ca.tu, ca.guru
       FROM users u
       LEFT JOIN client_access ca ON u.id = ca.user_id
       ORDER BY u.id ASC`
    );

    const formattedUsers = users.map(u => ({
      id: u.id,
      nama: u.nama,
      username: u.username,
      role: u.role,
      created_at: u.created_at,
      access: {
        kepsek: Boolean(u.kepsek),
        waka_kurikulum: Boolean(u.waka_kurikulum),
        waka_kesiswaan: Boolean(u.waka_kesiswaan),
        waka_sarpras: Boolean(u.waka_sarpras),
        bendahara: Boolean(u.bendahara),
        tu: Boolean(u.tu),
        guru: Boolean(u.guru)
      }
    }));

    return res.json({ success: true, data: formattedUsers });
  } catch (err) {
    console.error(`[Get Users Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data pengguna.' });
  }
});

/**
 * POST /api/users
 * Menambah pengguna baru (Admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { nama, username, password, role, access } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ success: false, message: 'Nama, username, dan password wajib diisi.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Cek duplikasi username
    const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Username '${cleanUsername}' sudah digunakan.` });
    }

    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'client';

    const [userResult] = await connection.query(
      'INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)',
      [nama.trim(), cleanUsername, hashedPassword, userRole]
    );

    const newUserId = userResult.insertId;

    // Simpan hak akses jabatan di client_access
    const acc = access || {};
    await connection.query(
      `INSERT INTO client_access (user_id, kepsek, waka_kurikulum, waka_kesiswaan, waka_sarpras, bendahara, tu, guru)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        acc.kepsek ? 1 : 0,
        acc.waka_kurikulum ? 1 : 0,
        acc.waka_kesiswaan ? 1 : 0,
        acc.waka_sarpras ? 1 : 0,
        acc.bendahara ? 1 : 0,
        acc.tu ? 1 : 0,
        acc.guru !== undefined ? (acc.guru ? 1 : 0) : 1
      ]
    );

    await connection.commit();

    await logActivity(req, 'CREATE_USER', `Membuat pengguna baru '${nama}' (${cleanUsername}) dengan role '${userRole}'`);

    return res.status(201).json({
      success: true,
      message: 'Pengguna baru berhasil ditambahkan.',
      user: {
        id: newUserId,
        nama,
        username: cleanUsername,
        role: userRole,
        access: acc
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error(`[Create User Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan pengguna.' });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/users/:id
 * Mengubah data pengguna dan hak akses jabatan (Admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { nama, username, role, access } = req.body;

    const [users] = await connection.query('SELECT id, username FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    await connection.beginTransaction();

    if (nama || username || role) {
      const updates = [];
      const params = [];
      if (nama) { updates.push('nama = ?'); params.push(nama.trim()); }
      if (username) { updates.push('username = ?'); params.push(username.trim().toLowerCase()); }
      if (role) { updates.push('role = ?'); params.push(role); }
      params.push(id);

      await connection.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (access) {
      await connection.query(
        `INSERT INTO client_access (user_id, kepsek, waka_kurikulum, waka_kesiswaan, waka_sarpras, bendahara, tu, guru)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          kepsek = VALUES(kepsek),
          waka_kurikulum = VALUES(waka_kurikulum),
          waka_kesiswaan = VALUES(waka_kesiswaan),
          waka_sarpras = VALUES(waka_sarpras),
          bendahara = VALUES(bendahara),
          tu = VALUES(tu),
          guru = VALUES(guru)`,
        [
          id,
          access.kepsek ? 1 : 0,
          access.waka_kurikulum ? 1 : 0,
          access.waka_kesiswaan ? 1 : 0,
          access.waka_sarpras ? 1 : 0,
          access.bendahara ? 1 : 0,
          access.tu ? 1 : 0,
          access.guru ? 1 : 0
        ]
      );
    }

    await connection.commit();

    await logActivity(req, 'UPDATE_USER', `Memperbarui profil/hak akses pengguna ID ${id}`);

    return res.json({ success: true, message: 'Data pengguna dan hak akses berhasil diperbarui.' });

  } catch (err) {
    await connection.rollback();
    console.error(`[Update User Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui data pengguna.' });
  } finally {
    connection.release();
  }
});

/**
 * PUT /api/users/:id/reset-password
 * Reset kata sandi pengguna ke default atau password baru (Admin only)
 */
router.put('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const defaultPwd = newPassword && newPassword.trim() ? newPassword.trim() : 'smk12345';
    const hashedPassword = await bcrypt.hash(defaultPwd, 10);

    const [result] = await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    await logActivity(req, 'RESET_PASSWORD', `Mereset kata sandi pengguna ID ${id} menjadi default.`);

    return res.json({
      success: true,
      message: `Kata sandi berhasil direset ke: '${defaultPwd}'`
    });
  } catch (err) {
    console.error(`[Reset Password Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal mereset kata sandi.' });
  }
});

/**
 * DELETE /api/users/:id
 * Menghapus pengguna (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    await logActivity(req, 'DELETE_USER', `Menghapus akun pengguna ID ${id}`);

    return res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    console.error(`[Delete User Error]`, err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
});

module.exports = router;
