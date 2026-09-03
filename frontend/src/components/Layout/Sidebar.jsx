import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderTree, 
  ShieldCheck, 
  BookOpen, 
  Users, 
  Building2, 
  Wallet, 
  Briefcase, 
  GraduationCap, 
  X,
  Sparkles,
  ChevronRight,
  School,
  Eye,
  Check
} from 'lucide-react';
import { FOLDER_SNP_HIERARCHY, canUserWrite, normalizeJabatan } from '../../utils/constants';

const JABATAN_ICONS = {
  kepsek: School,
  waka_kurikulum: BookOpen,
  waka_kesiswaan: Users,
  waka_sarpras: Building2,
  kurikulum: BookOpen,
  kesiswaan: Users,
  sarpras: Building2,
  bendahara: Wallet,
  tu: Briefcase,
  guru: GraduationCap
};

export default function Sidebar({ isOpen, onClose, user, onNavigateFolder }) {
  const hasFullAccess = (jabatan) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    const norm = normalizeJabatan(jabatan);
    return Boolean(user.access && user.access[norm]);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 glass-sidebar flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <School className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">DAF ARCHIVE</h2>
              <p className="text-[10px] text-emerald-400 font-medium">SMK Diponegoro Cipari</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Navigation */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Menu Utama
            </p>
            <nav className="space-y-1">
              <NavLink
                to="/"
                end
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-900/20'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/archives"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-md shadow-emerald-900/20'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                <FolderTree className="w-4 h-4 text-teal-400" />
                <span>Eksplorasi Arsip (8 SNP)</span>
              </NavLink>
            </nav>
          </div>

          {/* Folder Jabatan & SNP (Seluruh folder dapat dibuka oleh semua pengguna) */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Folder 8 SNP Jabatan
              </p>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                Semua Terbuka
              </span>
            </div>
            
            <div className="space-y-1">
              {FOLDER_SNP_HIERARCHY.map((item) => {
                const IconComponent = JABATAN_ICONS[item.jabatan] || FolderTree;
                const isFull = hasFullAccess(item.jabatan);

                return (
                  <button
                    key={item.jabatan}
                    onClick={() => {
                      if (onNavigateFolder) {
                        onNavigateFolder(item.jabatan);
                        onClose && onClose();
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-all text-slate-300 hover:bg-slate-800/80 hover:text-emerald-300 group cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 ${isFull ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {isFull ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Akses Penuh
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center space-x-0.5">
                          <Eye className="w-2.5 h-2.5" />
                          <span>Read Only</span>
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Panel (Hanya untuk Admin) */}
          {user?.isAdmin && (
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Administrator
              </p>
              <nav className="space-y-1">
                <NavLink
                  to="/admin"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-md'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`
                  }
                >
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Admin Panel</span>
                </NavLink>
              </nav>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-center">
          <div className="text-[10px] text-slate-400">
            DAF Archive v1.0 • Skripsi
          </div>
          <div className="text-[9px] text-slate-500">
            SMK Diponegoro Cipari
          </div>
        </div>
      </aside>
    </>
  );
}
