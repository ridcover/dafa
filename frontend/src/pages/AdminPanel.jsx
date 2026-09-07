import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Settings as SettingsIcon, 
  History, 
  Sparkles 
} from 'lucide-react';
import UserManagement from '../components/Admin/UserManagement';
import Settings from '../components/Admin/Settings';
import AuditLogs from '../components/Admin/AuditLogs';

export default function AdminPanel({ user, onActiveYearChanged }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'users';

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card rounded-3xl p-6 border border-purple-500/20 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-950/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-100">Pusat Kontrol Administrator</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Akses Penuh
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kelola hak akses multi-role 19 guru/staf, tahun pelajaran, struktur 8 SNP, dan audit keamanan sistem.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 mt-6 border-b border-slate-700/80 pb-1 overflow-x-auto">
          <button
            onClick={() => handleTabChange('users')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manajemen 19 Pengguna (RBAC)</span>
          </button>

          <button
            onClick={() => handleTabChange('settings')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Tahun Pelajaran & 8 SNP</span>
          </button>

          <button
            onClick={() => handleTabChange('audit')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Audit Log</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'settings' && <Settings onActiveYearChanged={onActiveYearChanged} />}
        {activeTab === 'audit' && <AuditLogs />}
      </div>
    </div>
  );
}
