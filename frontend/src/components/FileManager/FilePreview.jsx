import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileCode, 
  File, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Copy, 
  Check, 
  AlertCircle,
  FolderOpen,
  Info
} from 'lucide-react';
import { formatBytes, formatDate, getFileType, JABATAN_MAP } from '../../utils/constants';
import api from '../../services/api';

export default function FilePreview({ item, onClose, onDownload }) {
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  const fileType = item ? getFileType(item.original_name || item.name) : 'unknown';
  const previewUrl = item ? `/api/preview/${item.id}` : '';

  useEffect(() => {
    setImgZoom(1);
    setImgRotation(0);
    setTextContent('');
    setCopied(false);

    if (item && fileType === 'text') {
      setLoadingText(true);
      api.get(previewUrl, { responseType: 'text' })
        .then((res) => {
          setTextContent(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent('Gagal memuat isi teks berkas.');
          setLoadingText(false);
        });
    }
  }, [item?.id]);

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center glass-card rounded-2xl border border-slate-700/60 min-h-[450px]">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
          <Eye className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-100 mb-2">Split-View File Previewer</h3>
        <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
          Pilih salah satu berkas dari daftar di sebelah kiri untuk melihat pratinjau langsung (PDF, Gambar, Teks/CSV).
        </p>
        <div className="flex items-center space-x-2 text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
          <Info className="w-3.5 h-3.5" />
          <span>Mendukung PDF, Gambar, Teks & Berkas Dokumen</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl animate-fade-in min-h-[500px]">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-700/80 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 truncate mr-2">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0">
            {fileType === 'pdf' && <FileText className="w-4 h-4 text-rose-400" />}
            {fileType === 'image' && <ImageIcon className="w-4 h-4 text-sky-400" />}
            {fileType === 'office' && <FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
            {fileType === 'text' && <FileCode className="w-4 h-4 text-teal-400" />}
            {fileType !== 'pdf' && fileType !== 'image' && fileType !== 'office' && fileType !== 'text' && (
              <File className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-100 truncate" title={item.stored_name || item.name || item.original_name}>
              {item.stored_name || item.name || item.original_name}
            </h4>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
              <span>{formatBytes(item.size)}</span>
              <span>•</span>
              <span className="text-emerald-400">{JABATAN_MAP[item.jabatan] || item.jabatan}</span>
              <span>•</span>
              <span>{item.uploader_nama || 'Sistem'}</span>
              {item.original_name && item.original_name !== (item.stored_name || item.name) && (
                <>
                  <span>•</span>
                  <span className="text-slate-400" title={`Nama Asli: ${item.original_name}`}>Asli: {item.original_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Buka di Tab Baru"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => onDownload(item)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors text-xs font-semibold"
            title="Unduh Berkas"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unduh</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-Naming Info Banner */}
      {item.stored_name && (
        <div className="px-3.5 py-1.5 bg-slate-900/60 border-b border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
          <span className="text-slate-400">Nama Penyimpanan (Auto-Naming):</span>
          <code className="text-emerald-400 font-mono text-[10px] bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[280px]">
            {item.stored_name}
          </code>
        </div>
      )}

      {/* Preview Content Area */}
      <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-slate-950/40 relative">
        {/* PDF PREVIEW */}
        {fileType === 'pdf' && (
          <div className="w-full h-full min-h-[480px] flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
            <iframe
              src={`${previewUrl}#toolbar=1&navpanes=0`}
              title={item.name}
              className="w-full h-full flex-1 border-0 rounded-xl"
            />
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {fileType === 'image' && (
          <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center relative">
            {/* Zoom & Rotation Controls */}
            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 z-10 shadow-lg">
              <button
                onClick={() => setImgZoom((z) => Math.max(0.5, z - 0.2))}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1.5 text-slate-300">{Math.round(imgZoom * 100)}%</span>
              <button
                onClick={() => setImgZoom((z) => Math.min(3, z + 0.2))}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setImgRotation((r) => (r + 90) % 360)}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                title="Putar 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[500px] p-4 flex items-center justify-center">
              <img
                src={previewUrl}
                alt={item.original_name}
                style={{
                  transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  transition: 'transform 0.2s ease'
                }}
                className="max-w-full max-h-[460px] object-contain rounded-lg shadow-2xl border border-slate-800"
              />
            </div>
          </div>
        )}

        {/* TEXT PREVIEW */}
        {fileType === 'text' && (
          <div className="w-full h-full flex flex-col rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">Text Content Viewer</span>
              <button
                onClick={handleCopyText}
                className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-auto whitespace-pre-wrap flex-1 max-h-[480px]">
              {loadingText ? 'Memuat teks berkas...' : textContent}
            </pre>
          </div>
        )}

        {/* OFFICE DOCUMENTS (DOC, DOCX, XLS, XLSX) FALLBACK */}
        {fileType === 'office' && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-950/50">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-100 mb-2">
              Preview tidak tersedia, silakan unduh
            </h4>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Format dokumen Microsoft Office (.docx, .xlsx, .pptx) memerlukan aplikasi lokal untuk dibuka. Silakan unduh berkas untuk melihat konten selengkapnya.
            </p>
            <button
              onClick={() => onDownload(item)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Berkas Sekarang ({formatBytes(item.size)})</span>
            </button>
          </div>
        )}

        {/* AUDIO PREVIEW */}
        {fileType === 'audio' && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <audio controls src={previewUrl} className="w-full max-w-md rounded-lg" />
          </div>
        )}

        {/* VIDEO PREVIEW */}
        {fileType === 'video' && (
          <div className="w-full h-full max-h-[450px] flex items-center justify-center">
            <video controls src={previewUrl} className="max-w-full max-h-full rounded-xl shadow-2xl" />
          </div>
        )}

        {/* OTHER / ARCHIVE / UNKNOWN */}
        {fileType !== 'pdf' && fileType !== 'image' && fileType !== 'text' && fileType !== 'office' && fileType !== 'audio' && fileType !== 'video' && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3 border border-slate-700">
              <File className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-200 mb-1">Pratinjau Tidak Didukung</h4>
            <p className="text-xs text-slate-400 mb-5">
              Tipe berkas ini tidak dapat dipratinjau secara langsung di peramban. Silakan unduh file untuk melihatnya.
            </p>
            <button
              onClick={() => onDownload(item)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Berkas ({formatBytes(item.size)})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
