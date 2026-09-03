import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  KeyRound, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  ShieldCheck, 
  Search, 
  AlertCircle 
} from 'lucide-react';
import { ROLES_LIST } from '../../utils/constants';
import api from '../../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form State Add User
  const [newUserData, setNewUserData] = useState({
    nama: '',
    username: '',
    password: 'smk12345',
    role: 'client',
    access: {
      kepsek: false,
      waka_kurikulum: false,
      waka_kesiswaan: false,
      waka_sarpras: false,
      bendahara: false,
      tu: false,
      guru: true
    }
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat pengguna.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Quick Toggle Role Access
  const handleToggleRole = async (user, roleKey) => {
    const updatedAccess = {
      ...user.access,
      [roleKey]: !user.access[roleKey]
    };

    try {
      await api.put(`/users/${user.id}`, { access: updatedAccess });
      setUsers(users.map((u) => (u.id === user.id ? { ...u, access: updatedAccess } : u)));
      setSuccess(`Hak akses '${roleKey}' untuk ${user.nama} berhasil diperbarui.`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError('Gagal memperbarui hak akses.');
    }
  };

  // Submit Add User
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', newUserData);
      setShowAddModal(false);
      setNewUserData({
        nama: '',
        username: '',
        password: 'smk12345',
        role: 'client',
        access: { kepsek: false, waka_kurikulum: false, waka_kesiswaan: false, waka_sarpras: false, bendahara: false, tu: false, guru: true }
      });
      fetchUsers();
      setSuccess('Pengguna baru berhasil ditambahkan.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah pengguna.');
    }
  };

  // Submit Reset Password
  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset kata sandi untuk ${user.nama} menjadi 'smk12345'?`)) return;
    try {
      await api.put(`/users/${user.id}/reset-password`, { newPassword: 'smk12345' });
      setSuccess(`Kata sandi ${user.nama} berhasil direset ke 'smk12345'.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Gagal mereset kata sandi.');
    }
  };

  // Submit Delete User
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Hapus pengguna ${user.nama} (${user.username})?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      setUsers(users.filter((u) => u.id !== user.id));
      setSuccess(`Pengguna ${user.nama} berhasil dihapus.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus pengguna.');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nama.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Alert Messages */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama guru / staf / username..."
            className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 text-white text-xs font-semibold shadow-lg transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Users Table with 7 Role Checkboxes */}
      <div className="overflow-x-auto rounded-2xl border border-slate-700/60 glass-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-3 px-4">Nama Pengguna & Username</th>
              <th className="py-3 px-2 text-center">Kepsek</th>
              <th className="py-3 px-2 text-center">Kurikulum</th>
              <th className="py-3 px-2 text-center">Kesiswaan</th>
              <th className="py-3 px-2 text-center">Sarpras</th>
              <th className="py-3 px-2 text-center">Bendahara</th>
              <th className="py-3 px-2 text-center">TU</th>
              <th className="py-3 px-2 text-center">Guru</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredUsers.map((u) => {
              const isAdmin = u.role === 'admin';

              return (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Name */}
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                        <span>{u.nama}</span>
                        {isAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300 border border-red-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </div>
                  </td>

                  {/* 7 Roles Checkboxes */}
                  {ROLES_LIST.map((role) => {
                    const isChecked = Boolean(u.access && u.access[role.key]);

                    return (
                      <td key={role.key} className="py-3 px-2 text-center">
                        <button
                          disabled={isAdmin}
                          onClick={() => handleToggleRole(u, role.key)}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            isAdmin
                              ? 'bg-emerald-500/20 text-emerald-400 cursor-default opacity-80'
                              : isChecked
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30 hover:bg-emerald-500'
                              : 'bg-slate-800/80 text-slate-600 hover:bg-slate-700/80 border border-slate-700'
                          }`}
                          title={`${role.label} (${isChecked ? 'Aktif' : 'Non-aktif'})`}
                        >
                          {isChecked || isAdmin ? <Check className="w-3.5 h-3.5" /> : null}
                        </button>
                      </td>
                    );
                  })}

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-colors"
                        title="Reset Kata Sandi ke 'smk12345'"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {!isAdmin && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL TAMBAH PENGGUNA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 border border-slate-700 animate-fade-in shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">Tambah Pengguna Baru</h3>
            <p className="text-xs text-slate-400 mb-4">Buat akun untuk guru atau staf SMK Diponegoro Cipari</p>

            <form onSubmit={handleAddUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  required
                  value={newUserData.nama}
                  onChange={(e) => setNewUserData({ ...newUserData, nama: e.target.value })}
                  placeholder="Contoh: Ahmad Fauzi, S.Pd."
                  className="w-full glass-input px-3 py-2 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    placeholder="ahmadfauzi"
                    className="w-full glass-input px-3 py-2 rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password Awal</label>
                  <input
                    type="text"
                    required
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="smk12345"
                    className="w-full glass-input px-3 py-2 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Hak Akses Jabatan (RBAC Multi-Role):</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  {ROLES_LIST.map((r) => (
                    <label key={r.key} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserData.access[r.key] || false}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            access: { ...newUserData.access, [r.key]: e.target.checked }
                          })
                        }
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
