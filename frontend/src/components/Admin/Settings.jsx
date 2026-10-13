import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  FolderSync, 
  Plus, 
  FolderTree, 
  Check, 
  AlertCircle,
  Sparkles,
  Info,
  Lock,
  Unlock,
  Star
} from 'lucide-react';
import { FOLDER_SNP_HIERARCHY, SNP_LIST } from '../../utils/constants';
import api from '../../services/api';

export default function Settings({ onActiveYearChanged }) {
  const [years, setYears] = useState([]);
  const [yearDetails, setYearDetails] = useState([]);
  const [activeTahun, setActiveTahun] = useState('');
  const [newYearInput, setNewYearInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/tahun-akademik');
      setYears(res.data.years || []);
      setYearDetails(res.data.yearDetails || []);
      setActiveTahun(res.data.activeTahun || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat pengaturan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Set Primary/Default Academic Year
  const handleSetActiveYear = async (tapel) => {
    try {
      setError('');
      setSuccess('');
      const res = await api.put('/settings/active-tahun', { active_tahun_pelajaran: tapel });
      setActiveTahun(tapel);
      setSuccess(res.data.message || `Tahun Pelajaran '${tapel}' berhasil ditetapkan sebagai tahun utama.`);
      fetchSettings();
      onActiveYearChanged && onActiveYearChanged(tapel);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengaktifkan tahun pelajaran.');
    }
  };

  // Toggle Open/Lock Status for an Academic Year
  const handleToggleOpen = async (tapel, currentIsOpen) => {
    try {
      setError('');
      setSuccess('');
      const newStatus = !currentIsOpen;
      const res = await api.put('/settings/toggle-tahun-status', {
        ta: tapel,
        isOpen: newStatus
      });
      setSuccess(res.data.message || `Status TP '${tapel}' berhasil diperbarui.`);
      fetchSettings();
      onActiveYearChanged && onActiveYearChanged(activeTahun);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah status tahun pelajaran.');
    }
  };

  // Add New Academic Year
  const handleAddYear = async (e) => {
    e.preventDefault();
    if (!newYearInput.trim()) return;

    try {
      setError('');
      setSuccess('');
      const res = await api.post('/settings/tahun-akademik', { ta: newYearInput.trim() });
      setSuccess(res.data.message || 'Tahun akademik baru berhasil ditambahkan.');
      setNewYearInput('');
      fetchSettings();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah tahun akademik.');
    }
  };

  // Manual Trigger SNP Folder Generator
  const handleSyncSNP = async () => {
    try {
      setSyncing(true);
      setError('');
      setSuccess('');
      const res = await api.post('/settings/generate-snp', { tapel: activeTahun });
      setSuccess(res.data.message || 'Sinkronisasi folder SNP berhasil.');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal sinkronisasi folder SNP.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span>{error}</span>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={fetchSettings}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Coba Muat Ulang
            </button>
            <button type="button" onClick={() => setError('')} className="text-rose-300 hover:text-white">✕</button>
          </div>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Card: Manajemen Tahun Pelajaran & SNP Generator */}
      <div className="glass-card rounded-2xl p-5 border border-slate-700/60 space-y-5">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-700/80">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Pengaturan Tahun Pelajaran & 8 SNP</h3>
            <p className="text-xs text-slate-400">
              Admin dapat membuka lebih dari satu Tahun Pelajaran sekaligus untuk memungkinkan pengunggahan berkas oleh staf/guru pada tahun-tahun yang dipilih.
            </p>
          </div>
        </div>

        {/* Banner Kebijakan Otomatisasi 01 Juli */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-teal-900/20 to-slate-900/40 border border-emerald-500/30 space-y-2.5">
          <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Kebijakan Otomatisasi Tahun Pelajaran (Setiap 01 Juli) & Multi-Tahun Aktif</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sistem DAF Archive dirancang dengan mekanisme otomatisasi siklus tahunan: <strong>Setiap tanggal 01 Juli</strong> pada tahun berjalan, sistem akan secara otomatis membentuk Tahun Pelajaran baru beserta seluruh struktur direktori 8 Standar Nasional Pendidikan (SNP) dan mengaktifkannya. Dengan arsitektur <em>Multi-Year Access</em>, Administrator dapat membuka status <strong>Read-Write</strong> pada lebih dari satu tahun pelajaran (misal: saat masa transisi tahun ajaran baru atau audit).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">Tanggal Acuan Sistem:</span>
              <strong className="text-emerald-300">28 Agustus 2026</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">TP Utama Saat Ini:</span>
              <strong className="text-teal-300">{activeTahun || '2026/2027'}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
              <span className="text-slate-400 block">Jadwal Auto-Gen Berikutnya:</span>
              <strong className="text-amber-300">01 Juli 2027 (TP 2027/2028)</strong>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 pt-1">
            <Info className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span>Tahun pelajaran yang dikunci berstatus <strong>Read-Only</strong> bagi staf/guru, namun tetap dapat dikelola secara penuh oleh Administrator.</span>
          </div>
        </div>

        {/* Form Tambah Tahun Pelajaran Baru */}
        <form onSubmit={handleAddYear} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tambah Tahun Pelajaran Baru (Format: YYYY/YYYY)
            </label>
            <input
              type="text"
              required
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              placeholder="Contoh: 2026/2027"
              className="w-full glass-input px-3.5 py-2 rounded-xl text-xs sm:text-sm"
            />
          </div>
          <button
            type="submit"
            className="sm:self-end flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah & Generate SNP</span>
          </button>
        </form>

        {/* Daftar Tahun Pelajaran & Status Buka/Kunci */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-slate-700/60 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-200">
                Status Buka / Kunci Tahun Pelajaran (Multi-Year Access):
              </label>
              <p className="text-[11px] text-slate-400">
                Admin dapat membuka lebih dari satu Tahun Pelajaran sekaligus untuk memungkinkan pengunggahan berkas oleh staf/guru pada tahun-tahun yang dipilih.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-semibold text-slate-400">
              <span className="flex items-center space-x-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Terbuka (Read & Write)</span>
              </span>
              <span className="flex items-center space-x-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Terkunci (Read-Only)</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(yearDetails.length > 0 ? yearDetails : years.map(y => ({ ta: y, isOpen: y === activeTahun, isDefault: y === activeTahun }))).map((item) => {
              const tapel = item.ta;
              const isDefault = item.isDefault || tapel === activeTahun;
              const isOpen = item.isOpen;

              return (
                <div
                  key={tapel}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3.5 ${
                    isDefault
                      ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/40'
                      : isOpen
                      ? 'bg-slate-900/80 border-teal-500/40 shadow-sm'
                      : 'bg-slate-900/60 border-slate-700/80 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className={`w-4 h-4 ${isOpen ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span className="text-sm font-bold text-slate-100">TP {tapel}</span>
                      </div>
                      
                      {isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>Tahun Utama</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] leading-relaxed">
                      {isOpen ? (
                        <div className="text-emerald-400 font-medium flex items-center space-x-1.5 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          <Unlock className="w-3 h-3 flex-shrink-0" />
                          <span>Akses Terbuka (Staf & Guru dapat mengunggah)</span>
                        </div>
                      ) : (
                        <div className="text-amber-400 font-medium flex items-center space-x-1.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                          <Lock className="w-3 h-3 flex-shrink-0" />
                          <span>Terkunci (Hanya Read-Only untuk staf & guru)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
                    {/* Toggle Buka / Kunci */}
                    <button
                      type="button"
                      disabled={isDefault && isOpen}
                      onClick={() => handleToggleOpen(tapel, isOpen)}
                      title={isDefault && isOpen ? 'Tahun utama sistem tidak dapat dikunci' : ''}
                      className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isDefault && isOpen
                          ? 'bg-slate-800/50 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-60'
                          : isOpen
                          ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isOpen ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Kunci Tahun</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Akses</span>
                        </>
                      )}
                    </button>

                    {/* Set Default Primary */}
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetActiveYear(tapel)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700 flex items-center space-x-1 cursor-pointer"
                        title="Jadikan sebagai Tahun Pelajaran utama saat login"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span>Set Utama</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual Sync Button */}
        <div className="pt-2 flex items-center justify-between bg-slate-900/40 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>Pastikan seluruh folder fisik dan record basis data 8 SNP sinkron untuk tahun {activeTahun}.</span>
          </div>
          <button
            onClick={handleSyncSNP}
            disabled={syncing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600 text-teal-300 hover:text-white text-xs font-semibold border border-teal-500/40 transition-colors disabled:opacity-50"
          >
            <FolderSync className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Folder SNP'}</span>
          </button>
        </div>
      </div>

      {/* Card: Rincian Pemetaan 8 Standar Nasional Pendidikan (SNP) */}
      <div className="glass-card rounded-2xl p-5 border border-slate-700/60 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-700/80">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Pemetaan Struktur 8 SNP SMK Diponegoro Cipari</h3>
            <p className="text-xs text-slate-400">
              Folder standar nasional pendidikan yang otomatis dibuat untuk masing-masing jabatan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FOLDER_SNP_HIERARCHY.map((item) => (
            <div key={item.jabatan} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-300 capitalize">{item.label}</span>
                <span className="text-[10px] text-slate-500 font-mono">uploads/{item.jabatan}/</span>
              </div>
              <div className="space-y-1">
                {item.folders.map((folder) => (
                  <div key={folder} className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    <span>{folder}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
