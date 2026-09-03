const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS || '';
  const database = process.env.DB_NAME || 'db_dafa_archive';

  console.log(`[InitDB] Menghubungkan ke MySQL di ${host}:${port} dengan user '${user}'...`);

  let connection;
  try {
    // 1. Connect without database first to ensure DB exists
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`[InitDB] Membaca file SQL dari database/schema_and_seed.sql...`);
    const sqlPath = path.join(__dirname, '../../../database/schema_and_seed.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log(`[InitDB] Menjalankan script SQL pembuatan database dan seed data 19 pengguna + 1 admin...`);
    await connection.query(sqlContent);

    console.log(`[InitDB] Inisialisasi Database '${database}' BERHASIL!`);
    console.log(`[InitDB] 19 Akun Guru/Staf + 1 Akun Admin siap digunakan (Password default: smk12345)`);

    // Inisialisasi folder fisik uploads untuk tahun-tahun pelajaran yang terdaftar
    const folderGenerator = require('../utils/folderGenerator');
    const { seedAllSNPFiles } = require('./seedArchiveFiles');
    const defaultYears = ['2024/2025', '2025/2026', '2026/2027'];
    for (const yr of defaultYears) {
      await folderGenerator.generateSNPStructure(yr);
      console.log(`[InitDB] Struktur folder SNP untuk tahun '${yr}' berhasil disiapkan di uploads/`);
    }

    // Inisialisasi berkas dokumen standar 8 SNP lengkap
    await seedAllSNPFiles(['2026/2027', '2025/2026']);
    console.log(`[InitDB] Seluruh berkas arsip 8 SNP lengkap berhasil dibuat.`);
    process.exit(0);
  } catch (error) {
    console.error(`[InitDB ERROR] Gagal menginisialisasi database:`, error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();

