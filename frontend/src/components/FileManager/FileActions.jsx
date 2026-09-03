import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, 
  FolderPlus, 
  Download, 
  Search, 
  X, 
  FileUp, 
  Folder, 
  Check, 
  AlertTriangle, 
  Lock, 
  Sparkles, 
  Info,
  FolderTree
} from 'lucide-react';
import { JABATAN_MAP, ROLES_LIST, normalizeJabatan, canUserWrite } from '../../utils/constants';
import api from '../../services/api';

export default function FileActions({
  user,
  currentTapel,
  parentPath,
  currentJabatan,
  isLocked,
  searchQuery,
  onSearchChange,
  onRefresh,
  itemToRename,
  onCloseRename,
  itemToDelete,
  onCloseDelete
}) {
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadJabatan, setUploadJabatan] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Folder Form State
  const [folderName, setFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState('');

  // Rename Form State
  const [newRenameName, setNewRenameName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Delete Form State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Hitung apakah user memiliki hak tulis (upload, buat folder, rename, delete) di folder saat ini
  const userHasWrite = canUserWrite(user, currentJabatan, isLocked);

  // Hitung daftar jabatan yang dapat dipilih oleh user saat upload
  const availableJabatans = user?.isAdmin
    ? ROLES_LIST
    : ROLES_LIST.filter((r) => user?.access && user.access[r.key]);

  // Buka Upload Modal
  const openUploadModal = () => {
    setUploadError('');
    setSelectedFile(null);
    setUploadProgress(0);
    
    const normCur = normalizeJabatan(currentJabatan);
    if (currentJabatan && (user?.isAdmin || (user?.access && user.access[normCur]))) {
      setUploadJabatan(normCur);
    } else if (availableJabatans.length > 0) {
      setUploadJabatan(availableJabatans[0].key);
    } else {
      setUploadJabatan('guru');
    }
    setShowUploadModal(true);
  };

  // Live preview format penamaan: {Jabatan}_{NamaUser}_{NamaFileAsli}
  const computeAutoName = () => {
    if (!selectedFile) return '';
    const jLabel = JABATAN_MAP[uploadJabatan] || 'Guru';
    const uName = user?.nama || 'User';
    return `${jLabel}_${uName}_${selectedFile.name}`;
  };

  // Submit Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Pilih berkas yang akan diunggah.');
      return;
    }

    if (!user?.isAdmin && (!parentPath || !parentPath.includes('/'))) {
      setUploadError('Anda wajib membuka salah satu sub-folder standar SNP terlebih dahulu sebelum mengunggah berkas.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError('');

      const formData = new FormData();
      formData.append('tapel', currentTapel);
      formData.append('jabatan', uploadJabatan);
      formData.append('parent_path', parentPath || '');
      formData.append('file', selectedFile);

      await api.post('/archives/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setShowUploadModal(false);
      setSelectedFile(null);
      onRefresh();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Create Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setFolderError('Nama folder wajib diisi.');
      return;
    }

    try {
      setIsCreatingFolder(true);
      setFolderError('');

      const targetJab = currentJabatan 
        ? normalizeJabatan(currentJabatan) 
        : (availableJabatans[0] ? availableJabatans[0].key : 'guru');

      await api.post('/archives/folder', {
        name: folderName.trim(),
        tapel: currentTapel,
        jabatan: targetJab,
        parent_path: parentPath || ''
      });

      setShowFolderModal(false);
      setFolderName('');
      onRefresh();
    } catch (err) {
      setFolderError(err.response?.data?.message || 'Gagal membuat folder.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Submit Rename
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!newRenameName.trim()) {
      setRenameError('Nama baru wajib diisi.');
      return;
    }

    try {
      setIsRenaming(true);
      setRenameError('');

      await api.put(`/archives/${itemToRename.id}/rename`, {
        newName: newRenameName.trim()
      });

      onCloseRename();
      onRefresh();
    } catch (err) {
      setRenameError(err.response?.data?.message || 'Gagal mengubah nama.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');

      await api.delete(`/archives/${itemToDelete.id}`);

      onCloseDelete();
      onRefresh();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Gagal menghapus arsip.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Unduh Seluruh Folder (ZIP)
  const handleDownloadZip = () => {
    const token = localStorage.getItem('token') || '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const folderName = parentPath ? parentPath.split('/').pop() : `Semua_Arsip_${currentTapel}`;
    const url = `/api/archives/download-zip?tapel=${encodeURIComponent(currentTapel)}&parent_path=${encodeURIComponent(parentPath || '')}&name=${encodeURIComponent(folderName)}${tokenParam}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-3">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari berkas di semua folder arsip..."
            className="w-full glass-input pl-10 pr-9 py-2 rounded-xl text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              title="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Download ZIP button */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
            title="Unduh seluruh isi direktori ini dalam arsip ZIP"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Unduh Folder (ZIP)</span>
          </button>

          {userHasWrite ? (
            <>
              {/* Buat Folder (Hanya untuk Admin) */}
              {user?.isAdmin && (
                <button
                  onClick={() => { setFolderError(''); setFolderName(''); setShowFolderModal(true); }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/30 transition-colors shadow-sm"
                  title="Buat folder baru (Administrator Only)"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                  <span>Buat Folder</span>
                </button>
              )}

              {/* Upload Berkas */}
              <button
                onClick={openUploadModal}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
                title="Unggah berkas baru"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Berkas</span>
              </button>
            </>
          ) : (
            <div 
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium"
              title={isLocked ? 'Tahun pelajaran ini terkunci (Read-Only)' : 'Anda memiliki akses Lihat & Unduh (Read-Only) pada folder ini'}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>{isLocked ? 'Terkunci (Read-Only)' : 'Mode Lihat & Unduh (Read-Only)'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REACT PORTALS: Rendered at <body> level to prevent any modal clipping   */}
      {/* ========================================================================= */}

      {/* MODAL UPLOAD BERKAS */}
      {showUploadModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 border border-slate-700 shadow-2xl animate-fade-in relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Upload Berkas Arsip</h3>
                  <p className="text-xs text-slate-400">Arsip otomatis dinamai sesuai format standar</p>
                </div>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Jabatan Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Jabatan / Wewenang Pengunggah
                </label>
                <select
                  value={uploadJabatan}
                  onChange={(e) => setUploadJabatan(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-900"
                >
                  {availableJabatans.map((r) => (
                    <option key={r.key} value={r.key} className="bg-slate-900 text-slate-100">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop File Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pilih File Dokumen
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-emerald-500/40 bg-slate-900/40 hover:bg-slate-900/80'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center text-emerald-400 mb-2 border border-slate-700">
                    <Upload className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-300 break-all">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Klik untuk memilih file atau seret file ke sini</p>
                      <p className="text-[11px] text-slate-400 mt-1">Mendukung PDF, Gambar, Dokumen Office, Teks, dll. (Maks 100MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-Naming Live Preview */}
              {selectedFile && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1.5">
                  <div className="flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Format Auto-Naming Terapan:</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 break-all">
                    {computeAutoName()}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Sistem otomatis memberi prefix Jabatan dan Nama Pengguna pada arsip.
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Mengunggah...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {isUploading ? 'Mengunggah...' : 'Unggah Berkas'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL BUAT FOLDER (BEBAS TERHALANG OLEH CONTAINER APAPUN) */}
      {showFolderModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700/80 shadow-2xl animate-fade-in relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Buat Folder Baru</h3>
                  <p className="text-xs text-slate-400">Tambahkan sub-folder di direktori arsip</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFolderModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Path info */}
            <div className="mb-4 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center space-x-2 text-xs text-slate-300">
              <FolderTree className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">
                Lokasi: <strong className="text-emerald-300">TP {currentTapel}</strong> / {parentPath || (currentJabatan ? JABATAN_MAP[currentJabatan] : 'Root')}
              </span>
            </div>

            {folderError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{folderError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Folder
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Contoh: Perangkat Pembelajaran 2026-2027"
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-900/90"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{isCreatingFolder ? 'Membuat...' : 'Buat Folder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL RENAME */}
      {itemToRename && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl animate-fade-in relative my-8">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Ubah Nama {itemToRename.isFolder ? 'Folder' : 'Berkas'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">Masukkan nama baru untuk arsip</p>

            {renameError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs">
                {renameError}
              </div>
            )}

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  autoFocus
                  defaultValue={itemToRename.name}
                  onChange={(e) => setNewRenameName(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-900/90"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onCloseRename}
                  className="px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg"
                >
                  {isRenaming ? 'Menyimpan...' : 'Simpan Nama'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DELETE CONFIRMATION */}
      {itemToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl animate-fade-in relative my-8">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Konfirmasi Hapus</h3>
                <p className="text-xs text-slate-400">Tindakan ini bersifat permanen</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Apakah Anda yakin ingin menghapus {itemToDelete.isFolder ? 'folder' : 'berkas'}{' '}
              <strong className="text-white">"{itemToDelete.name}"</strong>?
              {itemToDelete.isFolder && (
                <span className="block text-rose-400 mt-1 font-medium">
                  Seluruh sub-folder dan berkas di dalamnya juga akan terhapus.
                </span>
              )}
            </p>

            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onCloseDelete}
                className="px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
