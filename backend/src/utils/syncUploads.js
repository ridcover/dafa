const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const UPLOADS_BASE = path.join(__dirname, '../../uploads');

/**
 * Sinkronisasi otomatis direktori fisik uploads ke tabel database 'archives'
 */
async function syncPhysicalUploadsToDb() {
  if (!fs.existsSync(UPLOADS_BASE)) return;

  try {
    const tapelDirs = fs.readdirSync(UPLOADS_BASE).filter((f) => {
      const p = path.join(UPLOADS_BASE, f);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    });

    for (const tapelDir of tapelDirs) {
      // Format folder fisik: "2026-2027" -> "2026/2027"
      const tapel = tapelDir.replace('-', '/');
      const tapelPath = path.join(UPLOADS_BASE, tapelDir);

      try {
        await pool.query('INSERT IGNORE INTO tahun_akademik (ta) VALUES (?)', [tapel]);
      } catch (e) {}

      await walkAndSync(tapelPath, tapel, '');
    }

    console.log(`[Storage Auto-Sync] Sinkronisasi direktori fisik uploads ke database berhasil diselesaikan.`);
  } catch (err) {
    console.error(`[Storage Auto-Sync Error]`, err.message);
  }
}

async function walkAndSync(currentDiskPath, tapel, currentRelPath) {
  if (!fs.existsSync(currentDiskPath)) return;
  const entries = fs.readdirSync(currentDiskPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryName = entry.name;
    const fullPath = path.join(currentDiskPath, entryName);
    const jabatan = currentRelPath ? currentRelPath.split('/')[0] : (entry.isDirectory() ? entryName : 'guru');

    if (entry.isDirectory()) {
      const nextRelPath = currentRelPath ? `${currentRelPath}/${entryName}` : entryName;

      try {
        const [existing] = await pool.query(
          'SELECT id FROM archives WHERE tapel = ? AND parent_path = ? AND name = ? AND isFolder = 1',
          [tapel, currentRelPath, entryName]
        );

        if (existing.length === 0) {
          await pool.query(
            `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
             VALUES (?, ?, ?, 1, 0, ?, ?, ?, NULL)`,
            [entryName, entryName, entryName, tapel, jabatan, currentRelPath]
          );
        }
      } catch (e) {}

      // Masuk ke subfolder rekursif
      await walkAndSync(fullPath, tapel, nextRelPath);
    } else {
      // Berkas
      try {
        const stat = fs.statSync(fullPath);
        const [existing] = await pool.query(
          'SELECT id FROM archives WHERE tapel = ? AND parent_path = ? AND (stored_name = ? OR name = ?)',
          [tapel, currentRelPath, entryName, entryName]
        );

        if (existing.length === 0) {
          let origName = entryName;
          const parts = entryName.split('_');
          if (parts.length >= 3) {
            origName = parts.slice(2).join('_');
          }

          await pool.query(
            `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?, 1)`,
            [entryName, entryName, origName, stat.size, tapel, jabatan, currentRelPath]
          );
        }
      } catch (e) {}
    }
  }
}

module.exports = {
  syncPhysicalUploadsToDb
};
