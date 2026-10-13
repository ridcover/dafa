import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck, Download, Trash2, CheckSquare, X } from 'lucide-react';
import Breadcrumb from '../components/Layout/Breadcrumb';
import FileList from '../components/FileManager/FileList';
import FilePreview from '../components/FileManager/FilePreview';
import FileActions from '../components/FileManager/FileActions';
import api from '../services/api';

export default function Archives({ user, activeTapel, currentTapel, openYears = [] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL Param states
  const parentPath = searchParams.get('parent_path') || '';
  const searchParam = searchParams.get('search') || '';
  const jabatanParam = searchParams.get('jabatan') || '';
  const urlTapel = searchParams.get('tapel') || '';

  // Hitung tapel efektif (utamakan URL param, kemudian state currentTapel, lalu activeTapel)
  const effectiveTapel = urlTapel || currentTapel || activeTapel || '2026/2027';

  // Data states
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  // Modals state for Rename & Delete
  const [itemToRename, setItemToRename] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Extract current Jabatan from parentPath if available
  const currentJabatan = parentPath ? parentPath.split('/')[0] : (jabatanParam || '');

  const fetchArchives = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const res = await api.get('/archives', {
        params: {
          tapel: effectiveTapel,
          parent_path: parentPath,
          search: searchQuery,
          jabatan: jabatanParam
        }
      });
      setItems(res.data.data || []);
      setIsLocked(res.data.isLocked || false);
      setSelectedIds([]); // Reset selection on reload
    } catch (err) {
      console.error('Failed to load archives', err);
      setFetchError(err.response?.data?.message || 'Gagal memuat arsip. Pastikan server backend dan database terhubung.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
  }, [effectiveTapel, parentPath, searchQuery, jabatanParam]);

  // Handle Search Input Change
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set('search', val);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  // Handle Navigate Path (Breadcrumb / Folder Open)
  const handleNavigatePath = (newPath) => {
    const newParams = new URLSearchParams();
    if (newPath) {
      newParams.set('parent_path', newPath);
    }
    if (effectiveTapel) {
      newParams.set('tapel', effectiveTapel);
    }
    setSearchParams(newParams);
    setSearchQuery('');
    setSelectedItem(null);
    setSelectedIds([]);
  };

  // Handle Open Folder
  const handleOpenFolder = (folderItem) => {
    const nextPath = folderItem.parent_path
      ? `${folderItem.parent_path}/${folderItem.name}`
      : folderItem.name;
    handleNavigatePath(nextPath);
  };

  // Handle Download File or ZIP
  const handleDownload = (item) => {
    const token = localStorage.getItem('token') || '';
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    if (item.isFolder) {
      const folderPath = item.parent_path ? `${item.parent_path}/${item.name}` : item.name;
      window.location.href = `/api/archives/download-zip?tapel=${encodeURIComponent(effectiveTapel)}&parent_path=${encodeURIComponent(folderPath)}&name=${encodeURIComponent(item.name)}${tokenParam}`;
    } else {
      window.location.href = `/api/archives/${item.id}/download${token ? '?token=' + encodeURIComponent(token) : ''}`;
    }
  };

  // Handle Multi-Select Toggles
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (ids) => {
    setSelectedIds(ids);
  };

  // Handle Bulk Download ZIP
  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkActionLoading(true);
      const res = await api.post(
        '/archives/bulk-download',
        { ids: selectedIds },
        { responseType: 'blob' }
      );
      
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `DAF_Arsip_Terpilih_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('Gagal mengunduh berkas terpilih.');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Handle Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.length} berkas/folder terpilih secara permanen?`)) return;

    try {
      setIsBulkActionLoading(true);
      const res = await api.post('/archives/bulk-delete', { ids: selectedIds });
      setBulkMessage(res.data.message || 'Item terpilih berhasil dihapus.');
      setTimeout(() => setBulkMessage(''), 3000);
      fetchArchives();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus berkas terpilih.');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner Tahun Ajaran */}
      {isLocked && !user?.isAdmin ? (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs shadow-lg space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 font-bold text-amber-300">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Arsip Terkunci (Read-Only) - Tahun Pelajaran {effectiveTapel}</span>
            </div>
            <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Read-Only
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
            Anda sedang melihat arsip <strong>Tahun Pelajaran {effectiveTapel}</strong> yang berstatus <strong>Read-Only</strong> (berkas hanya dapat dilihat dan diunduh). Tahun pelajaran ini telah dikunci oleh Administrator guna menjamin integritas dan keutuhan data dokumen sekolah.
          </p>
        </div>
      ) : isLocked && user?.isAdmin ? (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2.5 font-bold text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Tahun Pelajaran Lampau ({effectiveTapel}) - Mode Administrator (Akses Penuh Kelola Berkas & Folder)</span>
          </div>
          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-lg font-bold uppercase tracking-wider">
            Admin Mode
          </span>
        </div>
      ) : null}

      {/* Top Header & Breadcrumb */}
      <div className="glass-card rounded-2xl p-4 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <Breadcrumb
          currentTapel={currentTapel || activeTapel}
          parentPath={parentPath}
          onNavigatePath={handleNavigatePath}
        />

        {searchQuery && (
          <div className="text-xs text-slate-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center justify-between">
            <span>Hasil pencarian: <strong>"{searchQuery}"</strong></span>
            <button
              onClick={() => handleSearchChange('')}
              className="text-emerald-400 hover:text-emerald-300 ml-2 font-bold"
            >
              Hapus
            </button>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-700/60 shadow-lg">
        <FileActions
          user={user}
          currentTapel={currentTapel || activeTapel}
          parentPath={parentPath}
          currentJabatan={currentJabatan}
          isLocked={isLocked && !user?.isAdmin}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRefresh={fetchArchives}
          itemToRename={itemToRename}
          onCloseRename={() => setItemToRename(null)}
          itemToDelete={itemToDelete}
          onCloseDelete={() => setItemToDelete(null)}
        />
      </div>

      {/* BULK ACTION FLOATING BAR (Ketik Item Dipilih) */}
      {selectedIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-100 flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fade-in">
          <div className="flex items-center space-x-2 font-bold text-xs">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>{selectedIds.length} berkas/folder dipilih</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={isBulkActionLoading}
              onClick={handleBulkDownload}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Terpilih (ZIP)</span>
            </button>

            {(user?.isAdmin || (!isLocked && currentJabatan && user?.access?.[currentJabatan])) && (
              <button
                disabled={isBulkActionLoading}
                onClick={handleBulkDelete}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih</span>
              </button>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs"
              title="Batalkan pilihan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {bulkMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-semibold">
          {bulkMessage}
        </div>
      )}

      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={fetchArchives}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer flex-shrink-0"
          >
            Coba Muat Ulang
          </button>
        </div>
      )}

      {/* SPLIT VIEW: File List on Left, Interactive Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: File/Folder Explorer Table */}
        <div className={`${selectedItem ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
          <FileList
            user={user}
            items={items}
            selectedItem={selectedItem}
            onSelectItem={(file) => setSelectedItem(file)}
            onOpenFolder={handleOpenFolder}
            onDownload={handleDownload}
            onRename={(item) => setItemToRename(item)}
            onDelete={(item) => setItemToDelete(item)}
            isLocked={isLocked && !user?.isAdmin}
            isLoading={loading}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* Right Side: Split View File Previewer */}
        {selectedItem && (
          <div className="lg:col-span-5 sticky top-20">
            <FilePreview
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onDownload={handleDownload}
            />
          </div>
        )}
      </div>
    </div>
  );
}
