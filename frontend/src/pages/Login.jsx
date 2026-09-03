import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Sparkles, 
  School, 
  ArrowRight, 
  ShieldAlert, 
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import authService from '../services/auth';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('smk12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const demoAccounts = [
    { role: 'Administrator', username: 'admin', desc: 'Akses Penuh Seluruh Sistem' },
    { role: 'Kepala Sekolah & Guru', username: 'lestari', desc: 'Lestari Kurniawati, S.Pd.' },
    { role: 'Waka Kurikulum & Guru', username: 'santi', desc: 'Santi Setiawan, S.Pd.' },
    { role: 'Waka Kesiswaan & Guru', username: 'muniroh', desc: 'Muniroh, S.Pd.' },
    { role: 'Waka Sarpras & Guru', username: 'abdulharis', desc: 'Abdul Haris, S.Pd.' },
    { role: 'Bendahara 1 & Guru', username: 'rizki', desc: 'Rizki Fauzi' },
    { role: 'Operator TU & Guru', username: 'erlin', desc: 'Erlin Holinah, S.Pd.' },
    { role: 'Guru PAI', username: 'fitrihandayani', desc: 'Fitri Handayani, S.Pd.I.' },
    { role: 'Guru Informatika', username: 'jihanisme', desc: 'Jihanisme Difanti, S.Kom.' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan kata sandi wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await authService.login(username.trim(), password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali username dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (u) => {
    setUsername(u);
    setPassword('smk12345');
    setError('');
  };

  return (
    <div className="min-h-screen app-bg-container relative flex items-center justify-center p-4">
      <div className="login-bg-overlay absolute inset-0"></div>

      {/* Main Login Card */}
      <div className="relative z-10 max-w-md w-full glass-card rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl animate-fade-in space-y-6">
        {/* School & App Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 mx-auto flex items-center justify-center shadow-xl shadow-emerald-600/30 ring-2 ring-emerald-400/40 transform hover:scale-105 transition-transform">
            <School className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-200">
              DAF ARCHIVE
            </h1>
            <p className="text-sm font-semibold text-slate-200">SMK Diponegoro Cipari</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sistem Penyimpanan Arsip Digital Terpusat (8 SNP)
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex items-center space-x-2.5 animate-fade-in">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm"
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[11px] text-slate-400">Default: <code className="text-emerald-400">smk12345</code></span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-700/30 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Select Accordion */}
        <div className="pt-2 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => setShowDemoAccounts(!showDemoAccounts)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-emerald-400 py-1 transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>Daftar Akun Pengujian (19 User + Admin)</span>
            </div>
            {showDemoAccounts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDemoAccounts && (
            <div className="mt-2.5 max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <p className="text-[10px] text-slate-400 mb-1 px-1">Klik salah satu akun untuk auto-fill username:</p>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleSelectDemo(acc.username)}
                  className="w-full text-left p-2 rounded-lg bg-slate-800/60 hover:bg-emerald-600/20 hover:border-emerald-500/40 border border-transparent transition-all flex items-center justify-between group"
                >
                  <div>
                    <span className="font-semibold text-slate-200 group-hover:text-emerald-300">
                      @{acc.username}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{acc.desc}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 pt-2">
          Sistem Informasi Penyimpanan Arsip Digital Terpusat • Skripsi
        </div>
      </div>
    </div>
  );
}
