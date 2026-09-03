import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import Breadcrumb from '../components/Layout/Breadcrumb';
import FileList from '../components/FileManager/FileList';
import FilePreview from '../components/FileManager/FilePreview';
import FileActions from '../components/FileManager/FileActions';
import api from '../services/api';

export default function Archives({ user, activeTapel, currentTapel }) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL Param states
  const parentPath = searchParams.get('parent_path') || '';
  const searchParam = searchParams.get('search') || '';
  const jabatanParam = searchParams.get('jabatan') || '';

  // Data states
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  // Modals state for Rename & Delete
  const [itemToRename, setItemToRename] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Extract current Jabatan from parentPath if available
  const currentJabatan = parentPath ? parentPath.split('/')[0] : (jabatanParam || '');

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const res = await api.get('/archives', {
        params: {
          tapel: currentTapel || activeTapel,
          parent_path: parentPath,
          search: searchQuery,
          jabatan: jabatanParam
        }
      });
      setItems(res.data.data || []);
      setIsLocked(res.data.isLocked || false);
    } catch (err) {
      console.error('Failed to load archives', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
  }, [currentTapel, activeTapel, parentPath, searchQuery, jabatanParam]);

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
    if (currentTapel) {
      newParams.set('tapel', currentTapel);
    }
    setSearchParams(newParams);
    setSearchQuery('');
    setSelectedItem(null);
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
    if (item.isFolder) {
      const folderPath = item.parent_path ? `${item.parent_path}/${item.name}` : item.name;
      window.location.href = `/api/archives/download-zip?tapel=${encodeURIComponent(currentTapel || activeTapel)}&parent_path=${encodeURIComponent(folderPath)}&name=${encodeURIComponent(item.name)}`;
    } else {
      window.location.href = `/api/archives/${item.id}/download`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Read-Only Banner if Locked */}
      {isLocked && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs shadow-lg space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 font-bold text-amber-300">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Arsip Terkunci (Read-Only) - Tahun Pelajaran {currentTapel || activeTapel}</span>
            </div>
            <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Read-Only
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
            Anda sedang melihat arsip <strong>Tahun Pelajaran {currentTapel || activeTapel}</strong> yang berstatus <strong>Read-Only</strong> (berkas hanya dapat dilihat dan diunduh). Setiap tanggal <strong>01 Juli adalah awal dari tahun ajaran baru</strong> sehingga sistem secara otomatis mengunci (Read-Only) seluruh arsip tahun pelajaran sebelumnya guna menjamin integritas dan keutuhan data dokumen sekolah.
          </p>
        </div>
      )}

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
          isLocked={isLocked}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onRefresh={fetchArchives}
          itemToRename={itemToRename}
          onCloseRename={() => setItemToRename(null)}
          itemToDelete={itemToDelete}
          onCloseDelete={() => setItemToDelete(null)}
        />
      </div>

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
            isLocked={isLocked}
            isLoading={loading}
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
