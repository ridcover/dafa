const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { sanitizePathSegment, generateStoredFileName } = require('../utils/fileNaming');
const { generateSNPStructure } = require('../utils/folderGenerator');

const UPLOADS_BASE = path.join(__dirname, '../../uploads');

/**
 * Membuat buffer PDF standar yang valid dan dapat di-preview secara visual
 */
function createValidPdfBuffer(title, description, tapel = '2026/2027', jabatan = 'Kurikulum', uploader = 'Guru') {
  const safeTitle = (title || 'Dokumen').replace(/[()]/g, '');
  const safeDesc = (description || 'Dokumen Standar Nasional Pendidikan').replace(/[()]/g, '');
  const safeSchool = 'SMK DIPONEGORO CIPARI';
  const safeApp = 'DAF ARCHIVE - ARSIP DIGITAL TERPUSAT (8 SNP)';
  const safeMeta = `Jabatan: ${jabatan} | Pengunggah: ${uploader} | TP: ${tapel}`;

  const contentText = `BT
/F1 16 Tf
50 780 Td
(${safeSchool}) Tj
0 -22 Td
/F1 12 Tf
(${safeApp}) Tj
0 -20 Td
/F1 10 Tf
(${safeMeta}) Tj
0 -30 Td
/F1 14 Tf
(${safeTitle}) Tj
0 -20 Td
/F1 10 Tf
(${safeDesc}) Tj
0 -30 Td
/F1 9 Tf
(Status: Dokumen Resmi Terverifikasi dan Tersimpan pada Database DAF Archive) Tj
ET`;

  const streamLength = Buffer.byteLength(contentText, 'utf8');

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${contentText}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000311 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${360 + streamLength}
%%EOF`;

  return Buffer.from(pdfString, 'utf8');
}

/**
 * Daftar Berkas 8 SNP yang akan di-generate
 */
const ARCHIVE_DEFINITIONS = [
  // 1. STANDAR ISI (SI)
  {
    category: 'STANDAR ISI (SI)',
    folders: [
      {
        parent_path: 'waka_kurikulum/Standar Isi (SI)',
        jabatan: 'waka_kurikulum',
        user_id: 3,
        user_nama: 'Santi Setiawan, S.Pd.'
      }
    ],
    files: [
      { name: 'Dokumen_Kurikulum_Merdeka_KOSP.pdf', desc: 'Kurikulum Operasional Satuan Pendidikan (KOSP) yang berlaku' },
      { name: 'Struktur_Kurikulum_SMK.pdf', desc: 'Struktur kurikulum per jurusan (TJKT & AKL)' },
      { name: 'Daftar_Mata_Pelajaran.pdf', desc: 'Daftar mata pelajaran per jurusan per semester' },
      { name: 'Silabus_Jurusan_TJKT.pdf', desc: 'Silabus untuk jurusan TJKT' },
      { name: 'Silabus_Jurusan_AKL.pdf', desc: 'Silabus untuk jurusan AKL' },
      { name: 'Capaian_Pembelajaran_CP.pdf', desc: 'Dokumen Capaian Pembelajaran per mata pelajaran' },
      { name: 'Alur_Tujuan_Pembelajaran_ATP.pdf', desc: 'ATP untuk setiap mata pelajaran' },
      { name: 'Dokumen_Penyusunan_Kurikulum.pdf', desc: 'Dokumentasi proses penyusunan kurikulum (nota dinas, SK Tim, dll)' },
      { name: 'Kalender_Pendidikan_Tahunan.pdf', desc: 'Kalender pendidikan per tahun pelajaran' },
      { name: 'SK_Kepala_Sekolah_Kurikulum.pdf', desc: 'SK penetapan kurikulum yang digunakan' }
    ]
  },

  // 2. STANDAR PROSES (SP)
  {
    category: 'STANDAR PROSES (SP)',
    folders: [
      {
        parent_path: 'waka_kurikulum/Standar Proses (SP)',
        jabatan: 'waka_kurikulum',
        user_id: 3,
        user_nama: 'Santi Setiawan, S.Pd.'
      },
      {
        parent_path: 'guru/Standar Proses (SP)',
        jabatan: 'guru',
        user_id: 15,
        user_nama: 'Febriana Eka Nur Azizah'
      }
    ],
    files: [
      { name: 'RPP_ATP_Matematika.pdf', desc: 'RPP/ATP untuk mata pelajaran Matematika' },
      { name: 'RPP_ATP_Bahasa_Inggris.pdf', desc: 'RPP/ATP untuk mata pelajaran Bahasa Inggris' },
      { name: 'RPP_ATP_PAI.pdf', desc: 'RPP/ATP untuk mata pelajaran PAI' },
      { name: 'RPP_ATP_Kejuruan_TJKT.pdf', desc: 'RPP/ATP untuk mata pelajaran kejuruan TJKT' },
      { name: 'RPP_ATP_Kejuruan_AKL.pdf', desc: 'RPP/ATP untuk mata pelajaran kejuruan AKL' },
      { name: 'Jadwal_Pembelajaran.pdf', desc: 'Jadwal pelajaran per kelas' },
      { name: 'Buku_Agenda_Guru_Matematika.pdf', desc: 'Buku kerja guru/jurnal mengajar' },
      { name: 'Buku_Agenda_Guru_Kejuruan.pdf', desc: 'Buku kerja guru kejuruan' },
      { name: 'Dokumen_Evaluasi_Pembelajaran.pdf', desc: 'Dokumentasi evaluasi pembelajaran (refleksi, perbaikan)' },
      { name: 'Dokumen_Supervisi_Kelas.pdf', desc: 'Hasil supervisi kepala sekolah/waka kurikulum' }
    ]
  },

  // 3. STANDAR KOMPETENSI LULUSAN (SKL)
  {
    category: 'STANDAR KOMPETENSI LULUSAN (SKL)',
    folders: [
      {
        parent_path: 'waka_kesiswaan/Standar Lulusan (SKL)',
        jabatan: 'waka_kesiswaan',
        user_id: 4,
        user_nama: 'Muniroh, S.Pd.'
      },
      {
        parent_path: 'guru/Standar Lulusan (SKL)',
        jabatan: 'guru',
        user_id: 10,
        user_nama: 'Usman Aziz, S.Kom.'
      }
    ],
    files: [
      { name: 'Standar_Kompetensi_Lulusan.pdf', desc: 'Dokumen SKL SMK yang berlaku' },
      { name: 'Data_Siswa_Permata_Pelajaran.pdf', desc: 'Rekap data siswa per mata pelajaran' },
      { name: 'Daftar_Nilai_Rapor_Kelas_X.pdf', desc: 'Leger nilai rapor kelas X' },
      { name: 'Daftar_Nilai_Rapor_Kelas_XI.pdf', desc: 'Leger nilai rapor kelas XI' },
      { name: 'Daftar_Nilai_Rapor_Kelas_XII.pdf', desc: 'Leger nilai rapor kelas XII' },
      { name: 'Grafik_Ketuntasan_Belajar.pdf', desc: 'Grafik ketuntasan belajar per mata pelajaran' },
      { name: 'Daftar_Lulusan_TJKT.pdf', desc: 'Data lulusan jurusan TJKT' },
      { name: 'Daftar_Lulusan_AKL.pdf', desc: 'Data lulusan jurusan AKL' },
      { name: 'Tracer_Study_Lulusan.pdf', desc: 'Data tracer study alumni' },
      { name: 'Portofolio_Siswa_Unggulan.pdf', desc: 'Contoh portofolio siswa berprestasi' }
    ]
  },

  // 4. STANDAR PENDIDIK & TENAGA KEPENDIDIKAN (PTK)
  {
    category: 'STANDAR PENDIDIK & TENAGA KEPENDIDIKAN (PTK)',
    folders: [
      {
        parent_path: 'tu/Standar PTK',
        jabatan: 'tu',
        user_id: 8,
        user_nama: 'Erlin Holinah, S.Pd.'
      }
    ],
    files: [
      { name: 'Data_Guru_Tetap.pdf', desc: 'Daftar guru tetap dan honorer' },
      { name: 'Data_Staf_TU.pdf', desc: 'Daftar staf tata usaha' },
      { name: 'Sertifikat_Pendidik_Guru.pdf', desc: 'Koleksi sertifikat pendidik guru' },
      { name: 'Ijazah_Guru_S1.pdf', desc: 'Koleksi ijazah S1 guru' },
      { name: 'SK_Mengajar_Guru_TJKT.pdf', desc: 'SK mengajar guru TJKT' },
      { name: 'SK_Mengajar_Guru_AKL.pdf', desc: 'SK mengajar guru AKL' },
      { name: 'Sertifikat_Pelatihan_Guru.pdf', desc: 'Sertifikat pelatihan/profesi guru' },
      { name: 'Beban_kerja_Guru.pdf', desc: 'Data beban kerja guru (jumlah jam mengajar)' },
      { name: 'Sertifikat_Keahlian_Perjurusan.pdf', desc: 'Sertifikat keahlian untuk guru kejuruan' },
      { name: 'Data_Dapodik_PTK.pdf', desc: 'Data PTK terupdate dari Dapodik' }
    ]
  },

  // 5. STANDAR SARANA PRASARANA (SAP)
  {
    category: 'STANDAR SARANA PRASARANA (SAP)',
    folders: [
      {
        parent_path: 'waka_sarpras/Standar Sarpras (SAP)',
        jabatan: 'waka_sarpras',
        user_id: 5,
        user_nama: 'Abdul Haris, S.Pd.'
      }
    ],
    files: [
      { name: 'Denah_Ruang_Kelas.pdf', desc: 'Denah ruang kelas dan laboratorium' },
      { name: 'Denah_Bengkel_TJKT.pdf', desc: 'Denah bengkel TJKT' },
      { name: 'Denah_Laboratorium_AKL.pdf', desc: 'Denah lab AKL' },
      { name: 'Inventaris_Ruang_Kelas.pdf', desc: 'Inventaris ruang kelas (meja, kursi, papan tulis)' },
      { name: 'Inventaris_Laboratorium_TJKT.pdf', desc: 'Inventaris lab TJKT (komputer, server, switch, router)' },
      { name: 'Inventaris_Laboratorium_AKL.pdf', desc: 'Inventaris lab AKL (komputer, printer, software)' },
      { name: 'Inventaris_Fasilitas_Olahraga.pdf', desc: 'Inventaris fasilitas olahraga' },
      { name: 'Kartu_Perawatan_Alat_Lab_TJKT.pdf', desc: 'Kartu perawatan alat lab TJKT' },
      { name: 'Kartu_Perawatan_Alat_Lab_AKL.pdf', desc: 'Kartu perawatan alat lab AKL' },
      { name: 'Berita_Acara_Pengadaan.pdf', desc: 'Berita acara pengadaan sarpras' },
      { name: 'Dokumen_Pemeliharaan_Bangunan.pdf', desc: 'Dokumen pemeliharaan bangunan' },
      { name: 'Foto_Fasilitas_Praktik.pdf', desc: 'Dokumentasi foto fasilitas praktik' }
    ]
  },

  // 6. STANDAR PENGELOLAAN (P)
  {
    category: 'STANDAR PENGELOLAAN (P)',
    folders: [
      {
        parent_path: 'kepsek/Standar Pengelolaan (P)',
        jabatan: 'kepsek',
        user_id: 2,
        user_nama: 'Lestari Kurniawati, S.Pd.'
      },
      {
        parent_path: 'waka_kesiswaan/Standar Pengelolaan (P)',
        jabatan: 'waka_kesiswaan',
        user_id: 4,
        user_nama: 'Muniroh, S.Pd.'
      },
      {
        parent_path: 'tu/Standar Pengelolaan (P)',
        jabatan: 'tu',
        user_id: 8,
        user_nama: 'Erlin Holinah, S.Pd.'
      }
    ],
    files: [
      { name: 'RKJM_2024-2028.pdf', desc: 'Rencana Kerja Jangka Menengah Sekolah' },
      { name: 'RKT_2026.pdf', desc: 'Rencana Kerja Tahunan' },
      { name: 'SK_Kepala_Sekolah_Terbaru.pdf', desc: 'SK Kepala Sekolah terbaru' },
      { name: 'SK_Kepanitiaan_Akreditasi.pdf', desc: 'SK panitia penyusunan borang akreditasi' },
      { name: 'Borang_Akreditasi_SMK_C.pdf', desc: 'Borang akreditasi terakhir (nilai C)' },
      { name: 'Data_Sekolah_NPSN_NSS.pdf', desc: 'Data pokok sekolah (NPSN, NSS, dll)' },
      { name: 'Struktur_Organisasi_Sekolah.pdf', desc: 'Struktur organisasi SMK Diponegoro Cipari' },
      { name: 'Dokumen_Rapat_KKG_MGMP.pdf', desc: 'Notulen rapat KKG/MGMP' },
      { name: 'Pedoman_Tata_Tertib_Sekolah.pdf', desc: 'Tata tertib sekolah' },
      { name: 'Dokumen_Sosialisasi_Kurikulum.pdf', desc: 'Dokumentasi sosialisasi kurikulum' }
    ]
  },

  // 7. STANDAR PEMBIAYAAN (PB)
  {
    category: 'STANDAR PEMBIAYAAN (PB)',
    folders: [
      {
        parent_path: 'bendahara/Standar Pembiayaan (PB)',
        jabatan: 'bendahara',
        user_id: 6,
        user_nama: 'Rizki Fauzi'
      }
    ],
    files: [
      { name: 'RKAS_2026.pdf', desc: 'Rencana Kerja Anggaran Sekolah tahun berjalan' },
      { name: 'Buku_Kas_Umum.pdf', desc: 'Buku kas umum sekolah' },
      { name: 'LPJ_BOS_Tahunan.pdf', desc: 'Laporan Pertanggungjawaban BOS tahunan' },
      { name: 'LPJ_BOS_Semester.pdf', desc: 'LPJ BOS per semester' },
      { name: 'SPJ_Bantuan_Operasional.pdf', desc: 'SPJ bantuan operasional lainnya' },
      { name: 'RAPBS_Tahunan.pdf', desc: 'Rencana Anggaran Pendapatan dan Belanja Sekolah' },
      { name: 'Buku_Pembantu_Kas.pdf', desc: 'Buku pembantu kas' },
      { name: 'Nota_Transaksi_Bulan_Jan-Jun.pdf', desc: 'Nota/bukti transaksi Jan-Juni' },
      { name: 'Nota_Transaksi_Bulan_Jul-Des.pdf', desc: 'Nota/bukti transaksi Juli-Desember' },
      { name: 'Data_Sumbangan_dari_Orang_Tua.pdf', desc: 'Data sumbangan/pungutan dari orang tua siswa' },
      { name: 'Dokumen_Sumber_Dana_Lain.pdf', desc: 'Sumber dana lain (CSR, bantuan, dll)' }
    ]
  },

  // 8. STANDAR PENILAIAN (PN)
  {
    category: 'STANDAR PENILAIAN (PN)',
    folders: [
      {
        parent_path: 'guru/Standar Penilaian (PN)',
        jabatan: 'guru',
        user_id: 15,
        user_nama: 'Febriana Eka Nur Azizah'
      }
    ],
    files: [
      { name: 'Kisi_Kisi_Soal_Matematika.pdf', desc: 'Kisi-kisi soal matematika' },
      { name: 'Kisi_Kisi_Soal_Bahasa_Inggris.pdf', desc: 'Kisi-kisi soal bahasa Inggris' },
      { name: 'Kisi_Kisi_Soal_Kejuruan_TJKT.pdf', desc: 'Kisi-kisi soal kejuruan TJKT' },
      { name: 'Kisi_Kisi_Soal_Kejuruan_AKL.pdf', desc: 'Kisi-kisi soal kejuruan AKL' },
      { name: 'Bank_Soal_Matematika.pdf', desc: 'Bank soal matematika' },
      { name: 'Bank_Soal_Bahasa_Inggris.pdf', desc: 'Bank soal bahasa Inggris' },
      { name: 'Bank_Soal_Kejuruan_TJKT.pdf', desc: 'Bank soal kejuruan TJKT' },
      { name: 'Bank_Soal_Kejuruan_AKL.pdf', desc: 'Bank soal kejuruan AKL' },
      { name: 'Rubrik_Penilaian_Kognitif.pdf', desc: 'Rubrik penilaian aspek kognitif' },
      { name: 'Rubrik_Penilaian_Psikomotorik.pdf', desc: 'Rubrik penilaian aspek psikomotorik (praktik)' },
      { name: 'Rubrik_Penilaian_Afektif.pdf', desc: 'Rubrik penilaian aspek afektif (sikap)' },
      { name: 'Contoh_Soal_UAS_Matematika.pdf', desc: 'Contoh soal UAS/Ujian Sekolah' },
      { name: 'Contoh_Soal_UKK_Kejuruan_TJKT.pdf', desc: 'Contoh soal UKK kejuruan TJKT' },
      { name: 'Contoh_Soal_UKK_Kejuruan_AKL.pdf', desc: 'Contoh soal UKK kejuruan AKL' },
      { name: 'Analisis_Hasil_Asesmen.pdf', desc: 'Analisis hasil asesmen/ujian' },
      { name: 'Program_Perbaikan_Pengayaan.pdf', desc: 'Program perbaikan dan pengayaan' }
    ]
  }
];

/**
 * Fungsi utama untuk men-generate seluruh berkas arsip 8 SNP
 */
async function seedAllSNPFiles(targetTapelList = ['2026/2027']) {
  console.log(`[SeedFiles] Memulai pembuatan file arsip 8 SNP untuk Tahun Pelajaran: ${targetTapelList.join(', ')}...`);

  let totalFilesCreated = 0;

  for (const tapel of targetTapelList) {
    // 1. Pastikan struktur dasar folder SNP ada
    await generateSNPStructure(tapel);

    const cleanTapel = sanitizePathSegment(tapel);
    const tapelDirPath = path.join(UPLOADS_BASE, cleanTapel);

    for (const group of ARCHIVE_DEFINITIONS) {
      for (const targetFolder of group.folders) {
        // Pastikan folder fisik ada di disk
        const relParts = targetFolder.parent_path.split('/');
        const folderDiskPath = path.join(tapelDirPath, ...relParts);

        if (!fs.existsSync(folderDiskPath)) {
          fs.mkdirSync(folderDiskPath, { recursive: true });
        }

        // Pastikan folder terdaftar di tabel archives jika belum ada
        const rootName = relParts[0];
        const subName = relParts[1];

        if (subName) {
          const [existSub] = await pool.query(
            'SELECT id FROM archives WHERE tapel = ? AND parent_path = ? AND name = ? AND isFolder = 1',
            [tapel, rootName, subName]
          );
          if (existSub.length === 0) {
            await pool.query(
              `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
               VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?)`,
              [subName, subName, subName, tapel, targetFolder.jabatan, rootName, targetFolder.user_id]
            );
          }
        }

        // Buat file-file PDF untuk target folder ini
        for (const fileDef of group.files) {
          const storedFileName = generateStoredFileName(targetFolder.jabatan, targetFolder.user_nama, fileDef.name);
          const fileDiskPath = path.join(folderDiskPath, storedFileName);

          // Buat file PDF valid di disk
          const pdfBuffer = createValidPdfBuffer(
            fileDef.name.replace('.pdf', '').replace(/_/g, ' '),
            fileDef.desc,
            tapel,
            targetFolder.jabatan,
            targetFolder.user_nama
          );

          fs.writeFileSync(fileDiskPath, pdfBuffer);
          const fileSize = pdfBuffer.length;

          // Cek apakah berkas sudah terdaftar di DB
          const [existingFile] = await pool.query(
            'SELECT id FROM archives WHERE tapel = ? AND parent_path = ? AND (name = ? OR stored_name = ?)',
            [tapel, targetFolder.parent_path, storedFileName, storedFileName]
          );

          if (existingFile.length === 0) {
            await pool.query(
              `INSERT INTO archives (name, stored_name, original_name, isFolder, size, tapel, jabatan, parent_path, user_id)
               VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
              [
                storedFileName,
                storedFileName,
                fileDef.name,
                fileSize,
                tapel,
                targetFolder.jabatan,
                targetFolder.parent_path,
                targetFolder.user_id
              ]
            );
          } else {
            // Update ukuran jika sudah ada
            await pool.query(
              `UPDATE archives SET size = ?, stored_name = ?, original_name = ? WHERE id = ?`,
              [fileSize, storedFileName, fileDef.name, existingFile[0].id]
            );
          }

          totalFilesCreated++;
        }
      }
    }
  }

  console.log(`[SeedFiles] SELESAI! Sebanyak ${totalFilesCreated} berkas arsip 8 SNP berhasil dibuat dan terindeks di database.`);
  return totalFilesCreated;
}

module.exports = {
  seedAllSNPFiles,
  ARCHIVE_DEFINITIONS
};

if (require.main === module) {
  seedAllSNPFiles(['2026/2027', '2025/2026'])
    .then(() => {
      console.log('[SeedFiles] Script eksekusi selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SeedFiles ERROR]', err);
      process.exit(1);
    });
}
