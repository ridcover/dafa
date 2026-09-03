// Mapping 7 Jabatan RBAC
export const ROLES_LIST = [
  { key: 'kepsek', label: 'Kepala Sekolah', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { key: 'waka_kurikulum', label: 'Waka Kurikulum', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { key: 'waka_kesiswaan', label: 'Waka Kesiswaan', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { key: 'waka_sarpras', label: 'Waka Sarpras', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { key: 'bendahara', label: 'Bendahara', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { key: 'tu', label: 'Tata Usaha', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { key: 'guru', label: 'Guru', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
];

export const JABATAN_MAP = {
  kepsek: 'Kepala Sekolah',
  waka_kurikulum: 'Waka Kurikulum',
  waka_kesiswaan: 'Waka Kesiswaan',
  waka_sarpras: 'Waka Sarpras',
  kurikulum: 'Waka Kurikulum',
  kesiswaan: 'Waka Kesiswaan',
  sarpras: 'Waka Sarpras',
  bendahara: 'Bendahara',
  tu: 'Tata Usaha',
  guru: 'Guru',
  admin: 'Administrator'
};

/**
 * Normalisasi nama key jabatan
 */
export function normalizeJabatan(jabatan) {
  if (!jabatan) return 'guru';
  const j = String(jabatan).toLowerCase().trim();
  if (j === 'sarpras' || j === 'waka_sarpras') return 'waka_sarpras';
  if (j === 'kurikulum' || j === 'waka_kurikulum') return 'waka_kurikulum';
  if (j === 'kesiswaan' || j === 'waka_kesiswaan') return 'waka_kesiswaan';
  return j;
}

// 8 Standar Nasional Pendidikan (SNP) & Pemetaan Folder
export const SNP_LIST = [
  { code: 'SI', name: 'Standar Isi', jabatans: ['waka_kurikulum'] },
  { code: 'SP', name: 'Standar Proses', jabatans: ['waka_kurikulum', 'guru'] },
  { code: 'SKL', name: 'Standar Kompetensi Lulusan', jabatans: ['waka_kesiswaan', 'guru'] },
  { code: 'PTK', name: 'Standar Pendidik & Tenaga Kependidikan', jabatans: ['tu'] },
  { code: 'SAP', name: 'Standar Sarana Prasarana', jabatans: ['waka_sarpras'] },
  { code: 'P', name: 'Standar Pengelolaan', jabatans: ['kepsek', 'waka_kesiswaan', 'tu'] },
  { code: 'PB', name: 'Standar Pembiayaan', jabatans: ['bendahara'] },
  { code: 'PN', name: 'Standar Penilaian', jabatans: ['guru'] }
];

export const FOLDER_SNP_HIERARCHY = [
  {
    jabatan: 'kepsek',
    label: 'Kepala Sekolah',
    folders: ['Standar Pengelolaan (P)']
  },
  {
    jabatan: 'waka_kurikulum',
    label: 'Waka Kurikulum',
    folders: ['Standar Isi (SI)', 'Standar Proses (SP)']
  },
  {
    jabatan: 'waka_kesiswaan',
    label: 'Waka Kesiswaan',
    folders: ['Standar Lulusan (SKL)', 'Standar Pengelolaan (P)']
  },
  {
    jabatan: 'waka_sarpras',
    label: 'Waka Sarpras',
    folders: ['Standar Sarpras (SAP)']
  },
  {
    jabatan: 'bendahara',
    label: 'Bendahara',
    folders: ['Standar Pembiayaan (PB)']
  },
  {
    jabatan: 'tu',
    label: 'Tata Usaha',
    folders: ['Standar PTK', 'Standar Pengelolaan (P)']
  },
  {
    jabatan: 'guru',
    label: 'Guru',
    folders: ['Standar Proses (SP)', 'Standar Penilaian (PN)']
  }
];

/**
 * Helper untuk mengecek apakah user memiliki hak Tulis (Upload, Buat Folder, Rename, Delete)
 */
export function canUserWrite(user, folderJabatan, isLocked = false) {
  if (isLocked) return false;
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!user.access) return false;

  if (!folderJabatan) {
    // Jika di root, periksa apakah punya minimal salah satu akses
    return Object.values(user.access).some(Boolean);
  }

  const norm = normalizeJabatan(folderJabatan);
  return Boolean(user.access[norm]);
}

// Helper Format Ukuran Berkas
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper Format Tanggal
export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Deteksi Tipe Berkas
export function getFileType(fileName) {
  if (!fileName) return 'unknown';
  const ext = fileName.split('.').pop().toLowerCase();

  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['txt', 'csv', 'json', 'md', 'xml', 'log'].includes(ext)) return 'text';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)) return 'office';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mkv', 'mov'].includes(ext)) return 'video';

  return 'other';
}
