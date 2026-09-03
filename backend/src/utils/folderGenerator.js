const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { sanitizePathSegment } = require('./fileNaming');

const SNP_STRUCTURE = [
  { jabatan: 'kepsek', label: 'Kepala Sekolah', folders: ['Standar Pengelolaan (P)'] },
  { jabatan: 'waka_kurikulum', label: 'Waka Kurikulum', folders: ['Standar Isi (SI)', 'Standar Proses (SP)'] },
  { jabatan: 'waka_kesiswaan', label: 'Waka Kesiswaan', folders: ['Standar Lulusan (SKL)', 'Standar Pengelolaan (P)'] },
  { jabatan: 'waka_sarpras', label: 'Waka Sarpras', folders: ['Standar Sarpras (SAP)'] },
  { jabatan: 'bendahara', label: 'Bendahara', folders: ['Standar Pembiayaan (PB)'] },
  { jabatan: 'tu', label: 'Tata Usaha', folders: ['Standar PTK', 'Standar Pengelolaan (P)'] },
  { jabatan: 'guru', label: 'Guru', folders: ['Standar Proses (SP)', 'Standar Penilaian (PN)'] }
];

/**
 * Normalisasi jabatan alias jika masih menggunakan format singkat
 */
function normalizeJabatanKey(jabatan) {
  if (!jabatan) return 'guru';
  const j = jabatan.toLowerCase().trim();
  if (j === 'sarpras' || j === 'waka_sarpras') return 'waka_sarpras';
  if (j === 'kurikulum' || j === 'waka_kurikulum') return 'waka_kurikulum';
  if (j === 'kesiswaan' || j === 'waka_kesiswaan') return 'waka_kesiswaan';
  return j;
}

const UPLOADS_BASE = path.join(__dirname, '../../uploads');

/**
 * Membuat struktur fisik folder & entri database untuk Tahun Pelajaran tertentu
 */
async function generateSNPStructure(tapel) {
  if (!tapel) return;

  const tapelDirName = sanitizePathSegment(tapel);
  const tapelDirPath = path.join(UPLOADS_BASE, tapelDirName);

  if (!fs.existsSync(UPLOADS_BASE)) {
    fs.mkdirSync(UPLOADS_BASE, { recursive: true });
  }

  if (!fs.existsSync(tapelDirPath)) {
    fs.mkdirSync(tapelDirPath, { recursive: true });
  }

  // Buat folder fisik dan catat ke database
  for (const group of SNP_STRUCTURE) {
    const jabatanDirPath = path.join(tapelDirPath, group.jabatan);
    if (!fs.existsSync(jabatanDirPath)) {
      fs.mkdirSync(jabatanDirPath, { recursive: true });
    }

    // Pastikan folder root jabatan ada di DB (atau level 0)
    // Cek apakah entri folder jabatan sudah ada
    try {
      const [existingJabatanFolder] = await pool.query(
        'SELECT id FROM archives WHERE tapel = ? AND jabatan = ? AND name = ? AND parent_path = ? AND isFolder = 1',
        [tapel, group.jabatan, group.jabatan, '']
      );

      if (existingJabatanFolder.length === 0) {
        await pool.query(
          `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
           VALUES (?, ?, ?, 1, 0, ?, ?, ?, NULL)`,
          [group.jabatan, group.jabatan, group.jabatan, tapel, group.jabatan, '']
        );
      }
    } catch (e) {
      console.warn(`[FolderGenerator DB Notice] Root jabatan folder insert: ${e.message}`);
    }

    // Buat sub-folder SNP
    for (const snpFolder of group.folders) {
      const snpDirPath = path.join(jabatanDirPath, snpFolder);
      if (!fs.existsSync(snpDirPath)) {
        fs.mkdirSync(snpDirPath, { recursive: true });
      }

      try {
        const [existingSnpFolder] = await pool.query(
          'SELECT id FROM archives WHERE tapel = ? AND jabatan = ? AND name = ? AND parent_path = ? AND isFolder = 1',
          [tapel, group.jabatan, snpFolder, group.jabatan]
        );

        if (existingSnpFolder.length === 0) {
          await pool.query(
            `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
             VALUES (?, ?, ?, 1, 0, ?, ?, ?, NULL)`,
            [snpFolder, snpFolder, snpFolder, tapel, group.jabatan, group.jabatan]
          );
        }
      } catch (e) {
        console.warn(`[FolderGenerator DB Notice] SNP folder insert: ${e.message}`);
      }
    }
  }

  return true;
}

module.exports = {
  SNP_STRUCTURE,
  normalizeJabatanKey,
  generateSNPStructure
};
