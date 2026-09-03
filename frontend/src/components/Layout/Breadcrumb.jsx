import React from 'react';
import { Home, ChevronRight, Folder } from 'lucide-react';
import { JABATAN_MAP } from '../../utils/constants';

export default function Breadcrumb({ currentTapel, parentPath, onNavigatePath }) {
  const segments = parentPath ? parentPath.split('/').filter(Boolean) : [];

  const handleSegmentClick = (index) => {
    if (index === -1) {
      onNavigatePath('');
      return;
    }
    const targetPath = segments.slice(0, index + 1).join('/');
    onNavigatePath(targetPath);
  };

  return (
    <nav className="flex items-center space-x-1.5 text-xs text-slate-300 overflow-x-auto py-1 scrollbar-none">
      {/* Root / Beranda Arsip */}
      <button
        onClick={() => handleSegmentClick(-1)}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 hover:text-emerald-400 transition-colors border border-slate-700/60 flex-shrink-0"
      >
        <Home className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold text-slate-200">Arsip {currentTapel}</span>
      </button>

      {/* Segments */}
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const displayLabel = JABATAN_MAP[segment] || segment;

        return (
          <div key={index} className="flex items-center space-x-1.5 flex-shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <button
              onClick={() => handleSegmentClick(index)}
              disabled={isLast}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-colors ${
                isLast
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Folder className={`w-3 h-3 ${isLast ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{displayLabel}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
