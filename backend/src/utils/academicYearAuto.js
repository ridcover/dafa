const { pool } = require('../config/db');
const { generateSNPStructure } = require('./folderGenerator');

/**
 * Menghitung Tahun Pelajaran berdasarkan tanggal:
 * - Setiap tanggal 01 Juli, tahun pelajaran baru dimulai.
 * - Bulan >= 7 (Juli - Desember): Tahun Pelajaran = YYYY / (YYYY + 1)
 * - Bulan < 7 (Januari - Juni): Tahun Pelajaran = (YYYY - 1) / YYYY
 */
function getCalculatedAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1 s/d 12

  if (month >= 7) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
}

/**
 * Mendapatkan tanggal pergantian tahun pelajaran berikutnya (01 Juli tahun depan/berjalan)
 */
function getNextTransitionInfo(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  let nextJulyYear = year;
  if (month >= 7) {
    nextJulyYear = year + 1;
  }

  const nextCalculatedTapel = `${nextJulyYear}/${nextJulyYear + 1}`;

  return {
    nextDate: `01 Juli ${nextJulyYear}`,
    nextTapel: nextCalculatedTapel,
    ruleExplanation: 'Setiap tanggal 01 Juli pada tahun berjalan, sistem DAF Archive otomatis membentuk Tahun Pelajaran baru dan mengaktifkannya.'
  };
}

/**
 * Mengecek dan menyinkronkan Tahun Pelajaran aktif dan struktur folder 8 SNP
 */
async function checkAndSyncAcademicYear() {
  try {
    const calculatedYear = getCalculatedAcademicYear();

    // 1. Ambil daftar tahun akademik di database
    const [years] = await pool.query('SELECT ta FROM tahun_akademik');
    const existingYears = years.map((y) => y.ta);

    // 2. Jika tahun hasil kalkulasi belum terdaftar, masukkan ke database
    if (!existingYears.includes(calculatedYear)) {
      console.log(`[AutoAcademicYear] Mendeteksi Tahun Pelajaran baru '${calculatedYear}'. Menambahkan ke sistem...`);
      await pool.query('INSERT INTO tahun_akademik (ta) VALUES (?)', [calculatedYear]);
      await generateSNPStructure(calculatedYear);
      console.log(`[AutoAcademicYear] Struktur 8 SNP untuk '${calculatedYear}' berhasil dibuat.`);
    }

    // 3. Cek pengaturan active_tahun_pelajaran
    const [settings] = await pool.query('SELECT active_tahun_pelajaran FROM global_settings WHERE id = 1');
    
    let activeTapel = settings.length > 0 ? settings[0].active_tahun_pelajaran : null;

    if (!activeTapel) {
      activeTapel = calculatedYear;
      await pool.query(
        'INSERT INTO global_settings (id, active_tahun_pelajaran) VALUES (1, ?) ON DUPLICATE KEY UPDATE active_tahun_pelajaran = ?',
        [calculatedYear, calculatedYear]
      );
      await generateSNPStructure(calculatedYear);
      console.log(`[AutoAcademicYear] Mengaktifkan Tahun Pelajaran '${calculatedYear}' secara default.`);
    }

    return {
      success: true,
      calculatedYear,
      activeTapel,
      transitionInfo: getNextTransitionInfo()
    };
  } catch (err) {
    console.error(`[AutoAcademicYear Error]`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  getCalculatedAcademicYear,
  getNextTransitionInfo,
  checkAndSyncAcademicYear
};
