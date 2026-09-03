const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateStoredFileName, sanitizePathSegment, JABATAN_LABELS } = require('../utils/fileNaming');

const UPLOADS_BASE = path.join(__dirname, '../../uploads');

// Konfigurasi Disk Storage Dinamis
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tapel = req.body.tapel || 'default';
    const parentPath = req.body.parent_path || '';
    const jabatan = req.body.jabatan || 'umum';

    const cleanTapel = sanitizePathSegment(tapel);
    
    // Tentukan direktori penyimpanan fisik
    // uploads/{tapel}/{parentPath}/
    let uploadDir = path.join(UPLOADS_BASE, cleanTapel);

    if (parentPath) {
      // Normalisasi separator path
      const safeRelativePath = parentPath.replace(/\\/g, '/').split('/').filter(Boolean).join(path.sep);
      uploadDir = path.join(uploadDir, safeRelativePath);
    } else if (jabatan) {
      uploadDir = path.join(uploadDir, sanitizePathSegment(jabatan));
    }

    // Pastikan folder ada
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    // Decode nama file UTF-8 asli jika ada encode Latin-1 dari multer
    let originalName = file.originalname;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      originalName = file.originalname;
    }

    // Tentukan jabatan yang digunakan untuk penamaan
    const jabatanKey = req.body.jabatan || 'guru';
    const userName = (req.user && req.user.nama) ? req.user.nama : 'User';

    // Format: {Jabatan}_{NamaUser}_{NamaFileAsli}
    const autoStoredName = generateStoredFileName(jabatanKey, userName, originalName);

    // Simpan info ke request object untuk disimpan ke DB di controller
    file.autoStoredName = autoStoredName;
    file.decodedOriginalName = originalName;

    cb(null, autoStoredName);
  }
});

// Filter file jika diperlukan (memperbolehkan PDF, Gambar, Office, Teks, Zip, dll.)
const fileFilter = (req, file, cb) => {
  // Izinkan semua jenis berkas arsip yang wajar (dokumen, gambar, zip, sheet, teks)
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // Batas 100 MB per file
  },
  fileFilter: fileFilter
});

module.exports = {
  upload,
  UPLOADS_BASE
};
