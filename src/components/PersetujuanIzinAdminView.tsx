import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import {
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  Search,
  AlertCircle,
  MessageSquare,
  Calendar,
  User,
  ShieldCheck,
  Check,
  X,
  Eye,
  FileCheck,
  Stethoscope,
  MapPin,
  FileText,
  Download,
  Printer
} from 'lucide-react';

interface PersetujuanIzinAdminViewProps {
  currentUser: {
    role: string;
    nama?: string;
    username?: string;
    kelas?: string;
  };
  kelasList?: string[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PersetujuanIzinAdminView({
  currentUser,
  kelasList = [],
  showToast,
}: PersetujuanIzinAdminViewProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('Menunggu Persetujuan');
  const [kelasFilter, setKelasFilter] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');

  // Review modal state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'Disetujui' | 'Ditolak'>('Disetujui');
  const [catatanAdmin, setCatatanAdmin] = useState('');
  const [processingReview, setProcessingReview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nama: string; jenis: string } | null>(null);

  const isImageDoc = (url: string) => {
    return url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url);
  };

  const isPdfDoc = (url: string) => {
    return url.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(url);
  };

  const handleDownloadDoc = (url: string, filename: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      const isPdf = isPdfDoc(url);
      const ext = isPdf ? '.pdf' : '.png';
      a.download = filename.includes('.') ? filename : `${filename}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Mengunduh berkas dokumen...', 'info');
    } catch {
      window.open(url, '_blank');
    }
  };

  const handlePrintDoc = (url: string) => {
    if (isPdfDoc(url)) {
      const printWin = window.open(url, '_blank');
      if (printWin) {
        printWin.focus();
      }
    } else {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Cetak Dokumen Lampiran Siswa</title>
              <style>
                body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
                img { max-width: 95%; max-height: 95vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${url}" onload="window.print();" />
            </body>
          </html>
        `);
        printWin.document.close();
      }
    }
  };

  const fetchPengajuan = async () => {
    try {
      setLoading(true);
      const res = await api.getPengajuanIzin({
        status: statusFilter !== 'SEMUA' ? statusFilter : undefined,
        kelas: kelasFilter !== 'SEMUA' ? kelasFilter : undefined,
      });

      if (res.success && Array.isArray(res.data)) {
        setList(res.data);
      }
    } catch (err: any) {
      console.warn('Gagal memuat permohonan izin:', err);
      showToast('Gagal memuat data pengajuan: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPengajuan();
  }, [statusFilter, kelasFilter]);

  const handleOpenReview = (item: any, type: 'Disetujui' | 'Ditolak') => {
    setSelectedItem(item);
    setActionType(type);
    setCatatanAdmin(type === 'Disetujui' ? 'Permohonan disetujui pihak sekolah.' : 'Dokumen tidak lengkap atau alasan belum memadai.');
  };

  const handleExecuteReview = async () => {
    if (!selectedItem) return;

    setProcessingReview(true);
    try {
      const res = await api.reviewPengajuanIzin(selectedItem.id, actionType, catatanAdmin);
      if (res.success) {
        showToast(`✓ Berhasil: Pengajuan ${selectedItem.nama} telah ${actionType.toLowerCase()}.`, 'success');
        setSelectedItem(null);
        fetchPengajuan();
      } else {
        showToast(res.message || 'Gagal memproses review.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setProcessingReview(false);
    }
  };

  // Filtered by search
  const filteredList = list.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(q)) ||
      (item.nisn && item.nisn.includes(q)) ||
      (item.kelas && item.kelas.toLowerCase().includes(q)) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(q))
    );
  });

  const pendingCount = list.filter(p => p.status === 'Menunggu Persetujuan').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Verifikasi & Validasi
            </span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                {pendingCount} Menunggu Tindakan
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-black">Persetujuan Izin & Sakit Siswa</h2>
          <p className="text-xs text-slate-400 mt-1">
            Tinjau dan verifikasi pengajuan izin/sakit dari siswa. Persetujuan otomatis mencatat status presensi siswa pada tanggal terkait.
          </p>
        </div>

        <button
          onClick={fetchPengajuan}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-2xl text-xs transition flex items-center gap-2 self-start md:self-auto cursor-pointer shadow-lg shadow-indigo-900/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          {(['Menunggu Persetujuan', 'Disetujui', 'Ditolak', 'SEMUA'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'SEMUA' ? 'Semua Status' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Kelas Selector */}
          <select
            value={kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
          >
            <option value="SEMUA">Semua Kelas</option>
            {kelasList.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / NISN..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* List / Cards */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Memuat permohonan siswa...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-400 text-xs space-y-2 border border-slate-200">
          <ShieldCheck className="w-10 h-10 mx-auto text-slate-300" />
          <p className="font-bold text-slate-600">Tidak ada pengajuan izin / sakit yang sesuai kriteria.</p>
          <p className="text-slate-400">Gunakan filter status untuk menampilkan permohonan lainnya.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const isPending = item.status === 'Menunggu Persetujuan';
            const isApproved = item.status === 'Disetujui';
            const isRejected = item.status === 'Ditolak';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-5 border shadow-xs transition hover:shadow-md flex flex-col justify-between gap-4 ${
                  isPending ? 'border-amber-300 ring-2 ring-amber-500/10' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            item.jenis === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.jenis}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">NISN: {item.nisn}</span>
                      </div>
                      <h3 className="font-black text-base text-slate-900 mt-1">{item.nama}</h3>
                      <p className="text-xs font-semibold text-indigo-600">Kelas {item.kelas || '-'}</p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {isPending && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {isApproved && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      {isRejected && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Date range & Description */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>
                        {item.tanggalMulai === item.tanggalSelesai
                          ? item.tanggalMulai
                          : `${item.tanggalMulai} s/d ${item.tanggalSelesai}`}
                      </span>
                    </div>

                    <p className="text-slate-600 leading-relaxed">
                      <strong className="text-slate-800">Alasan:</strong> {item.keterangan}
                    </p>

                    {item.dokumenUrl && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-3 text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          {isImageDoc(item.dokumenUrl) ? (
                            <img
                              src={item.dokumenUrl}
                              alt="Bukti Pengajuan"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-slate-800 text-[11px] block flex items-center gap-1">
                              {item.jenis === 'Sakit' ? (
                                <>
                                  <Stethoscope className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Surat Sakit Dokter / Puskesmas</span>
                                </>
                              ) : (
                                <>
                                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>Foto Koordinat GPS Map Camera</span>
                                </>
                              )}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold">Lampiran Berkas Wajib</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ url: item.dokumenUrl, nama: item.nama, jenis: item.jenis })}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Lihat Berkas Dokumen"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(item.dokumenUrl, `Dokumen_${item.nama.replace(/\s+/g, '_')}_${item.jenis}`)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Download Dokumen"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintDoc(item.dokumenUrl)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Cetak / Print Dokumen"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Review History Notes */}
                  {item.catatanAdmin && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                      <span className="font-bold text-[10px] uppercase text-indigo-700 block mb-0.5">
                        Catatan Review ({item.reviewedBy || 'Admin'}):
                      </span>
                      <p>{item.catatanAdmin}</p>
                    </div>
                  )}
                </div>

                {/* Actions for Pending */}
                {isPending && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenReview(item, 'Disetujui')}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => handleOpenReview(item, 'Ditolak')}
                      className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Tolak</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal Dialog */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {actionType === 'Disetujui' ? '✓ Setujui Pengajuan' : '✕ Tolak Pengajuan'}
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
              <p>
                <strong>Siswa:</strong> {selectedItem.nama} ({selectedItem.nisn})
              </p>
              <p>
                <strong>Jenis:</strong> {selectedItem.jenis} • Kelas {selectedItem.kelas}
              </p>
              <p>
                <strong>Periode:</strong> {selectedItem.tanggalMulai} s/d {selectedItem.tanggalSelesai}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Verifikasi Admin (Opsional):
              </label>
              <textarea
                rows={3}
                value={catatanAdmin}
                onChange={(e) => setCatatanAdmin(e.target.value)}
                placeholder="Tuliskan catatan konfirmasi atau alasan penolakan..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteReview}
                disabled={processingReview}
                className={`px-5 py-2.5 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                  actionType === 'Disetujui'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}
              >
                {processingReview ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Konfirmasi {actionType}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal for Admin Document Verification */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-4 md:p-6 shadow-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verifikasi Berkas ({previewDoc.nama} • {previewDoc.jenis})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc.url, `Dokumen_${previewDoc.nama.replace(/\s+/g, '_')}_${previewDoc.jenis}`)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintDoc(previewDoc.url)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-auto rounded-2xl bg-slate-900 flex items-center justify-center p-2">
              {isPdfDoc(previewDoc.url) ? (
                <iframe
                  src={previewDoc.url}
                  title="Dokumen PDF Bukti Izin"
                  className="w-full h-[68vh] rounded-xl border border-slate-700 bg-white"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt="Dokumen Bukti"
                  className="max-h-[68vh] w-auto object-contain rounded-xl"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <p className="text-[11px] text-slate-500">
                {isPdfDoc(previewDoc.url)
                  ? 'Dokumen format PDF. Anda dapat membaca, mencetak, atau mengunduh berkas surat izin ini.'
                  : 'Periksa keabsahan stempel dokter atau titik koordinat GPS sebelum menyetujui.'}
              </p>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

