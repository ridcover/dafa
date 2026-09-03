import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderTree, 
  FileText, 
  Folder, 
  HardDrive, 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react';
import { SNP_LIST, formatBytes, formatDate, JABATAN_MAP } from '../utils/constants';
import api from '../services/api';
import FilePreview from '../components/FileManager/FilePreview';

export default function Dashboard({ user, activeTapel, currentTapel }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState(null);

  const isLockedYear = currentTapel && activeTapel && currentTapel !== activeTapel;

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/archives/stats?tapel=${encodeURIComponent(currentTapel || activeTapel)}`);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentTapel, activeTapel]);

  const handleOpenSNP = (snp) => {
    // Arahkan ke folder jabatan yang relevan dengan SNP
    const targetJabatan = snp.jabatans[0] || 'guru';
    navigate(`/archives?parent_path=${encodeURIComponent(targetJabatan)}&tapel=${encodeURIComponent(currentTapel || activeTapel)}`);
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Banner if Locked */}
      {isLockedYear && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs shadow-lg space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 font-bold text-amber-300">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Arsip Terkunci (Read-Only) - Tahun Pelajaran {currentTapel}</span>
            </div>
            <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Read-Only
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
            Anda sedang melihat arsip <strong>Tahun Pelajaran {currentTapel}</strong> yang berstatus <strong>Read-Only</strong> (berkas hanya dapat dilihat dan diunduh). Setiap tanggal <strong>01 Juli adalah awal dari tahun ajaran baru</strong> sehingga sistem secara otomatis mengunci (Read-Only) seluruh arsip tahun pelajaran sebelumnya guna menjamin integritas dan keutuhan data dokumen sekolah.
          </p>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DAF Archive • SMK Diponegoro Cipari</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Selamat Datang, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{user?.nama}</span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Sistem Penyimpanan Arsip Digital Terpusat mempermudah pengelolaan dan pencarian dokumen sekolah berbasis 8 Standar Nasional Pendidikan (SNP) dengan tata kelola hak akses terjamin.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/archives')}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-700/30 transition-all hover:scale-105"
            >
              <FolderTree className="w-4 h-4" />
              <span>Buka Eksplorasi Arsip (8 SNP)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tahun Aktif: <strong>{activeTapel}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total File */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Berkas</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {stats?.totalFiles ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Dokumen tersimpan</div>
        </div>

        {/* Total Folder */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Folder</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Folder className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {stats?.totalFolders ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Struktur 8 SNP & custom</div>
        </div>

        {/* Total Storage */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Penyimpanan</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {formatBytes(stats?.totalBytes ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Kapasitas terpakai</div>
        </div>

        {/* 8 SNP Readiness */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Standar SNP</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            8 / 8
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Standar Nasional Pendidikan</div>
        </div>
      </div>

      {/* 8 Standar Nasional Pendidikan (SNP) Quick Shortcuts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100">8 Standar Nasional Pendidikan (SNP)</h3>
            <p className="text-xs text-slate-400">Pilih salah satu standar untuk membuka folder arsip terkait</p>
          </div>
          <button
            onClick={() => navigate('/archives')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {SNP_LIST.map((snp) => (
            <div
              key={snp.code}
              onClick={() => handleOpenSNP(snp)}
              className="glass-card glass-card-hover rounded-2xl p-4 border border-slate-700/60 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {snp.code}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-1" />
                </div>
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                  {snp.name}
                </h4>
              </div>
              <div className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-800 flex flex-wrap gap-1">
                {snp.jabatans.map((j) => (
                  <span key={j} className="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                    {JABATAN_MAP[j] || j}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Split-View: Recent Files & Live Preview */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-100">Berkas Unggahan Terbaru</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Recent Files Table */}
          <div className={`${previewItem ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
            <div className="overflow-x-auto rounded-2xl border border-slate-700/60 glass-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Nama Berkas</th>
                    <th className="py-3 px-3">Jabatan</th>
                    <th className="py-3 px-3 hidden sm:table-cell">Pengunggah</th>
                    <th className="py-3 px-3 hidden md:table-cell">Ukuran</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats?.recentFiles && stats.recentFiles.length > 0 ? (
                    stats.recentFiles.map((file) => (
                      <tr
                        key={file.id}
                        onClick={() => setPreviewItem(file)}
                        className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                          previewItem?.id === file.id ? 'bg-emerald-600/20 text-emerald-200' : 'text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-100">
                          <div className="truncate max-w-[200px] sm:max-w-xs">{file.stored_name || file.name || file.original_name}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                            {JABATAN_MAP[file.jabatan] || file.jabatan}
                          </span>
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-400">
                          {file.uploader_nama || 'Sistem'}
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell text-slate-400">
                          {formatBytes(file.size)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewItem(file); }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition-colors text-xs font-semibold"
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-500">
                        Belum ada berkas yang diunggah untuk tahun pelajaran ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Preview Panel */}
          {previewItem && (
            <div className="lg:col-span-5">
              <FilePreview
                item={previewItem}
                onClose={() => setPreviewItem(null)}
                onDownload={(file) => {
                  window.location.href = `/api/archives/${file.id}/download`;
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
