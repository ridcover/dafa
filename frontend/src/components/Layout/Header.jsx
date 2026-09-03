import React, { useState } from 'react';
import { 
  FolderLock, 
  LogOut, 
  User, 
  KeyRound, 
  Calendar, 
  ShieldAlert, 
  Sparkles,
  Menu,
  ChevronDown
} from 'lucide-react';
import authService from '../../services/auth';

export default function Header({ 
  user, 
  onLogout, 
  activeTapel, 
  currentTapel, 
  onSelectTapel, 
  allTapelList = [], 
  onToggleSidebar 
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const isLockedYear = currentTapel && activeTapel && currentTapel !== activeTapel;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    try {
      setIsChangingPwd(true);
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('Kata sandi berhasil diperbarui.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Gagal memperbarui kata sandi.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 glass-nav px-4 lg:px-6 py-3 flex items-center justify-between">
        {/* Left: Mobile menu toggle & Logo title */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 lg:hidden transition-colors"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-200">
                  DAF ARCHIVE
                </span>
                <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SMK Diponegoro Cipari
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Sistem Penyimpanan Arsip Digital Terpusat (8 SNP)
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right: Tahun Pelajaran Selector & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Selector Tahun Pelajaran */}
          <div className="flex items-center bg-slate-900/80 border border-slate-700/60 rounded-xl px-2.5 py-1.5 shadow-inner">
            <Calendar className="w-4 h-4 text-emerald-400 mr-2" />
            <select
              value={currentTapel || activeTapel || ''}
              onChange={(e) => onSelectTapel && onSelectTapel(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-medium text-slate-200 focus:outline-none cursor-pointer pr-2"
            >
              {allTapelList.map((ta) => (
                <option key={ta} value={ta} className="bg-slate-900 text-slate-200">
                  TP {ta} {ta === activeTapel ? '(Aktif)' : ''}
                </option>
              ))}
            </select>

            {isLockedYear && (
              <span 
                className="flex items-center space-x-1 text-[11px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 ml-2"
                title="Tahun pelajaran ini telah dikunci. Berkas hanya dapat dilihat dan diunduh (Read-Only)."
              >
                <FolderLock className="w-3 h-3 text-amber-400" />
                <span className="hidden md:inline">Terkunci (Read-Only)</span>
              </span>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user?.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block max-w-[140px]">
                <div className="text-xs font-semibold text-slate-100 truncate">{user?.nama || 'Pengguna'}</div>
                <div className="text-[10px] text-emerald-400 capitalize truncate">
                  {user?.isAdmin ? 'Administrator' : user?.username}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div 
                className="absolute right-0 mt-2 w-64 glass-card rounded-xl p-2 z-50 animate-fade-in divide-y divide-slate-700/50 border border-slate-700/80 shadow-2xl"
                onClick={() => setShowProfileMenu(false)}
              >
                <div className="px-3 py-2.5">
                  <p className="text-xs text-slate-400">Masuk sebagai:</p>
                  <p className="text-sm font-bold text-slate-100 truncate">{user?.nama}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user?.isAdmin ? (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
                        Admin Utama
                      </span>
                    ) : (
                      Object.keys(user?.access || {})
                        .filter(k => user.access[k])
                        .map(k => (
                          <span key={k} className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 capitalize">
                            {k.replace('_', ' ')}
                          </span>
                        ))
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setShowProfileMenu(false); setShowPasswordModal(true); }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors text-left"
                  >
                    <KeyRound className="w-4 h-4 text-teal-400" />
                    <span>Ubah Kata Sandi</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Ubah Kata Sandi */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 animate-fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Ubah Kata Sandi</h3>
                <p className="text-xs text-slate-400">Perbarui kata sandi akun Anda</p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Masukkan kata sandi lama"
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi Baru</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isChangingPwd}
                  className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isChangingPwd ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
