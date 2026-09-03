import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Clock, 
  User, 
  ShieldAlert, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Globe,
  Download
} from 'lucide-react';
import { formatDate } from '../../utils/constants';
import api from '../../services/api';

const ACTION_COLORS = {
  LOGIN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  LOGOUT: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  UPLOAD_FILE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  DOWNLOAD_FILE: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  DOWNLOAD_ZIP: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  CREATE_FOLDER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  RENAME_ARCHIVE: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  DELETE_ARCHIVE: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  CHANGE_PASSWORD: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  SET_ACTIVE_YEAR: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit', {
        params: {
          page,
          limit: 20,
          search,
          action: actionFilter
        }
      });
      setLogs(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalRecords(res.data.pagination?.total || 0);
    } catch (err) {
      setError('Gagal memuat log audit aktivitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Bersihkan semua riwayat audit log?')) return;
    try {
      await api.delete('/audit/clear');
      fetchLogs();
    } catch (err) {
      setError('Gagal membersihkan log.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari user, keterangan, atau IP..."
            className="w-full glass-input pl-10 pr-4 py-2 rounded-xl text-xs"
          />
        </form>

        <div className="flex items-center space-x-2">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="glass-input px-3 py-2 rounded-xl text-xs bg-slate-900"
          >
            <option value="">Semua Aksi</option>
            <option value="LOGIN">LOGIN</option>
            <option value="UPLOAD_FILE">UPLOAD FILE</option>
            <option value="DOWNLOAD_FILE">DOWNLOAD FILE</option>
            <option value="DOWNLOAD_ZIP">DOWNLOAD ZIP</option>
            <option value="CREATE_FOLDER">CREATE FOLDER</option>
            <option value="RENAME_ARCHIVE">RENAME</option>
            <option value="DELETE_ARCHIVE">DELETE</option>
            <option value="SET_ACTIVE_YEAR">SET ACTIVE YEAR</option>
          </select>

          <button
            onClick={() => { window.location.href = '/api/audit/export'; }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 text-xs font-semibold border border-slate-700 transition-colors"
            title="Ekspor Riwayat Audit ke CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ekspor CSV</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-slate-700 transition-colors"
            title="Bersihkan Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bersihkan Log</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-700/60 glass-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-3">Pengguna</th>
              <th className="py-3 px-3">Aksi</th>
              <th className="py-3 px-4">Keterangan Aktivitas</th>
              <th className="py-3 px-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">
                  Tidak ada data riwayat aktivitas yang ditemukan.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actionBadgeClass = ACTION_COLORS[log.action] || 'bg-slate-800 text-slate-300 border-slate-700';

                return (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Time */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </td>

                    {/* User */}
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3 h-3 text-emerald-400" />
                        <span>{log.username || 'System'}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionBadgeClass}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-slate-300 max-w-xs md:max-w-md break-words">
                      {log.details}
                    </td>

                    {/* IP */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{log.ip_address || '127.0.0.1'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 text-xs text-slate-400">
        <div>
          Total <strong>{totalRecords}</strong> aktivitas tercatat (Halaman {page} dari {totalPages})
        </div>
        <div className="flex items-center space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
