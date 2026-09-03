import React from 'react';
import { 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  File, 
  Eye, 
  Download, 
  Edit3, 
  Trash2, 
  Clock, 
  User as UserIcon,
  FolderOpen,
  Lock,
  ArrowRight
} from 'lucide-react';
import { formatBytes, formatDate, getFileType, JABATAN_MAP, canUserWrite } from '../../utils/constants';

function getFileIcon(item) {
  if (item.isFolder) {
    return <Folder className="w-5 h-5 text-amber-400 flex-shrink-0" />;
  }

  const type = getFileType(item.original_name || item.name);
  switch (type) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-rose-400 flex-shrink-0" />;
    case 'image':
      return <ImageIcon className="w-5 h-5 text-sky-400 flex-shrink-0" />;
    case 'office':
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
    case 'archive':
      return <FileArchive className="w-5 h-5 text-purple-400 flex-shrink-0" />;
    case 'text':
      return <FileCode className="w-5 h-5 text-teal-400 flex-shrink-0" />;
    default:
      return <File className="w-5 h-5 text-slate-400 flex-shrink-0" />;
  }
}

export default function FileList({
  user,
  items = [],
  selectedItem,
  onSelectItem,
  onOpenFolder,
  onDownload,
  onRename,
  onDelete,
  isLocked = false,
  isLoading = false
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium">Memuat berkas arsip...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-card rounded-2xl border border-slate-700/60">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3 border border-slate-700/60">
          <FolderOpen className="w-7 h-7 text-slate-400" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200 mb-1">Folder ini masih kosong</h4>
        <p className="text-xs text-slate-400 max-w-sm">
          {isLocked 
            ? 'Tidak ada arsip pada tahun pelajaran ini dan folder telah dikunci (Read-Only).' 
            : 'Belum ada dokumen atau sub-folder yang diunggah. Klik tombol "Upload Berkas" untuk menambahkan dokumen.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-700/60 glass-card">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
            <th className="py-3 px-4">Nama Berkas / Folder</th>
            <th className="py-3 px-3 hidden sm:table-cell">Jabatan</th>
            <th className="py-3 px-3 hidden md:table-cell">Pengunggah</th>
            <th className="py-3 px-3 hidden lg:table-cell">Ukuran</th>
            <th className="py-3 px-3 hidden xl:table-cell">Tanggal</th>
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const jabatanLabel = JABATAN_MAP[item.jabatan] || item.jabatan;

            return (
              <tr
                key={item.id}
                onClick={() => {
                  if (item.isFolder) {
                    onOpenFolder(item);
                  } else {
                    onSelectItem(item);
                  }
                }}
                className={`transition-colors cursor-pointer group ${
                  isSelected 
                    ? 'bg-emerald-600/20 border-l-4 border-l-emerald-500 text-emerald-200' 
                    : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                {/* Name & Icon */}
                <td className="py-3 px-4 font-medium">
                  <div className="flex items-center space-x-3 min-w-[200px]">
                    <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
                      {getFileIcon(item)}
                    </div>
                    <div className="truncate max-w-[260px] md:max-w-xs xl:max-w-md">
                      <div className="truncate font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                        {item.original_name || item.name}
                      </div>
                      {!item.isFolder && item.stored_name && item.stored_name !== item.original_name && (
                        <div className="text-[10px] text-slate-400 truncate" title={item.stored_name}>
                          Auto-Name: {item.stored_name}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Jabatan */}
                <td className="py-3 px-3 hidden sm:table-cell">
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
                    {jabatanLabel}
                  </span>
                </td>

                {/* Uploader */}
                <td className="py-3 px-3 hidden md:table-cell text-slate-300 truncate max-w-[140px]">
                  <div className="flex items-center space-x-1.5 truncate">
                    <UserIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{item.uploader_nama || 'Sistem'}</span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-3 px-3 hidden lg:table-cell text-slate-400 whitespace-nowrap">
                  {item.isFolder ? '-' : formatBytes(item.size)}
                </td>

                {/* Date */}
                <td className="py-3 px-3 hidden xl:table-cell text-slate-400 whitespace-nowrap">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </td>

                {/* Action Buttons */}
                <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1">
                    {item.isFolder ? (
                      <button
                        onClick={() => onOpenFolder(item)}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors"
                        title="Buka Folder"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectItem(item)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 transition-colors"
                        title="Preview Berkas"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Download */}
                    <button
                      onClick={() => onDownload(item)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-teal-600/30 text-slate-300 hover:text-teal-300 transition-colors"
                      title={item.isFolder ? "Unduh Folder (ZIP)" : "Unduh Berkas"}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Rename & Delete (Hanya jika user memiliki hak tulis di jabatan ini dan tapel tidak terkunci) */}
                    {canUserWrite(user, item.jabatan, isLocked) ? (
                      <>
                        <button
                          onClick={() => onRename(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 transition-colors"
                          title="Ubah Nama"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-300 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="p-1.5 text-slate-500 flex items-center" title="Read-Only (Hanya Lihat & Unduh)">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
