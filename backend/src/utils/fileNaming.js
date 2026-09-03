const path = require('path');

const JABATAN_LABELS = {
  kepsek: 'Kepala Sekolah',
  waka_kurikulum: 'Waka Kurikulum',
  waka_kesiswaan: 'Waka Kesiswaan',
  waka_sarpras: 'Waka Sarpras',
  bendahara: 'Bendahara',
  tu: 'Tata Usaha',
  guru: 'Guru',
  admin: 'Administrator'
};

/**
 * Format nama file otomatis sesuai aturan: {Jabatan}_{NamaUser}_{NamaFileAsli}
 * Contoh: Waka_Kurikulum_Santi_Setiawan,_S.Pd._Silabus_Jurusan_AKL.pdf
 */
function generateStoredFileName(jabatanKeyOrLabel, userName, originalFileName) {
  // Ambil label yang rapi jika berupa key
  const jabatanLabel = JABATAN_LABELS[jabatanKeyOrLabel] || jabatanKeyOrLabel || 'Guru';
  
  // Format Jabatan: ubah spasi jadi underscore
  const cleanJabatan = jabatanLabel.replace(/[\/\\:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
  
  // Format Nama User: ubah spasi jadi underscore, pertahankan koma dan titik gelar
  const cleanUser = (userName || 'User').replace(/[\/\\:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
  
  // Format Original File Name: ubah spasi jadi underscore
  let cleanOriginal = (originalFileName || 'file.pdf').replace(/[\/\\:*?"<>|]/g, '').trim().replace(/\s+/g, '_');

  // Hindari duplikasi awalan ganda jika nama file sudah memiliki format lengkap
  if (cleanOriginal.startsWith(`${cleanJabatan}_${cleanUser}_`)) {
    return cleanOriginal;
  }

  // Gabungkan dengan format standar
  return `${cleanJabatan}_${cleanUser}_${cleanOriginal}`;
}

/**
 * Sanitasi nama folder / tapel untuk path filesystem (misal: '2024/2025' -> '2024-2025')
 */
function sanitizePathSegment(segment) {
  if (!segment) return '';
  return segment.replace(/\//g, '-').replace(/[\/\\:*?"<>|]/g, '_').trim();
}

module.exports = {
  JABATAN_LABELS,
  generateStoredFileName,
  sanitizePathSegment
};
