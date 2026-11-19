import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api.ts';
import {
  Calendar,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  Info,
  CalendarDays,
  Camera,
  MapPin,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  Eye,
  FileCheck,
  Stethoscope,
  Trash2,
  Edit
} from 'lucide-react';

interface PengajuanIzinSiswaViewProps {
  currentUser: {
    role: string;
    nama?: string;
    nisn?: string;
    kelas?: string;
  };
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PengajuanIzinSiswaView({ currentUser, showToast }: PengajuanIzinSiswaViewProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'riwayat'>('form');
  const [jenis, setJenis] = useState<'Izin' | 'Sakit'>('Izin');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [dokumenUrl, setDokumenUrl] = useState('');
  const [dokumenFileName, setDokumenFileName] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Riwayat Pengajuan
  const [riwayatList, setRiwayatList] = useState<any[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  // Set default today's date
  useEffect(() => {
    const today = new Date().toISOString().substring(0, 10);
    setTanggalMulai(today);
    setTanggalSelesai(today);
  }, []);

  const loadRiwayat = async () => {
    if (!currentUser.nisn) return;
    try {
      setLoadingRiwayat(true);
      const res = await api.getPengajuanIzin({ nisn: currentUser.nisn });
      if (res.success && Array.isArray(res.data)) {
        setRiwayatList(res.data);
      }
    } catch (err: any) {
      console.warn('Gagal memuat riwayat pengajuan:', err);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  useEffect(() => {
    loadRiwayat();
  }, [currentUser]);

  // Handle local file selection and convert to Base64 data URL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 6MB
    if (file.size > 6 * 1024 * 1024) {
      showToast('Ukuran file maksimal 6MB.', 'error');
      setValidationError('Ukuran file terlalu besar (maksimal 6MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setDokumenUrl(result);
      setDokumenFileName(file.name);
      setValidationError('');
      showToast(`File "${file.name}" berhasil diunggah!`, 'success');
    };
    reader.onerror = () => {
      showToast('Gagal membaca file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const clearUploadedFile = () => {
    setDokumenUrl('');
    setDokumenFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!currentUser.nisn || !currentUser.nama) {
      showToast('Data akun siswa tidak valid.', 'error');
      return;
    }

    if (!tanggalMulai || !tanggalSelesai) {
      const msg = 'Pilih tanggal mulai dan tanggal selesai pengajuan.';
      setValidationError(msg);
      showToast(msg, 'error');
      return;
    }

    if (tanggalSelesai < tanggalMulai) {
      const msg = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
      setValidationError(msg);
      showToast(msg, 'error');
      return;
    }

    if (!keterangan.trim()) {
      const msg = 'Tuliskan alasan atau keterangan pengajuan Anda.';
      setValidationError(msg);
      showToast(msg, 'error');
      return;
    }

    // MANDATORY DOCUMENT CHECKS ACCORDING TO USER REQUIREMENTS:
    // 1. Sakit -> Wajib upload surat sakit dari dokter/puskesmas/klinik
    // 2. Izin -> Wajib upload foto yang ada titik koordinat menggunakan aplikasi GPS Map Camera
    if (!dokumenUrl || !dokumenUrl.trim()) {
      let docMsg = '';
      if (jenis === 'Sakit') {
        docMsg = 'Wajib mengunggah Surat Sakit dari dokter / puskesmas / klinik sebagai bukti pengajuan sakit!';
      } else {
        docMsg = 'Wajib mengunggah Foto yang ada titik koordinat (menggunakan aplikasi GPS Map Camera) untuk pengajuan izin!';
      }
      setValidationError(docMsg);
      showToast(docMsg, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createPengajuanIzin({
        nisn: currentUser.nisn,
        nama: currentUser.nama,
        kelas: currentUser.kelas || '',
        jenis,
        tanggalMulai,
        tanggalSelesai,
        keterangan,
        dokumenUrl,
      });

      if (res.success) {
        showToast('✓ Pengajuan izin/sakit berhasil dikirim! Menunggu pengecekan Admin.', 'success');
        setKeterangan('');
        setDokumenUrl('');
        setDokumenFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setActiveTab('riwayat');
        loadRiwayat();
      } else {
        showToast(res.message || 'Gagal mengirim pengajuan.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isImageDoc = (url: string) => {
    return url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url);
  };

  const isPdfDoc = (url: string) => {
    return url.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(url);
  };

  const handlePerbaikiPengajuan = (item: any) => {
    setJenis(item.jenis === 'Sakit' ? 'Sakit' : 'Izin');
    setTanggalMulai(item.tanggalMulai || '');
    setTanggalSelesai(item.tanggalSelesai || item.tanggalMulai || '');
    setKeterangan(item.keterangan || '');
    setDokumenUrl(item.dokumenUrl || '');
    setDokumenFileName(
      item.dokumenUrl
        ? isPdfDoc(item.dokumenUrl)
          ? 'Lampiran_Sebelumnya.pdf'
          : 'Lampiran_Sebelumnya.png'
        : ''
    );
    setValidationError('');
    setActiveTab('form');
    showToast('Form telah dimuat dengan data pengajuan sebelumnya. Silakan perbaiki dan kirim ulang.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white mb-2">
            Layanan Mandiri Siswa
          </span>
          <h2 className="text-xl md:text-2xl font-black">Form Pengajuan Izin & Sakit</h2>
          <p className="text-xs text-indigo-100 mt-1">
            Ajukan permohonan ketidakhadiran secara online dengan melampirkan berkas bukti resmi.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="bg-black/30 p-1.5 rounded-2xl flex border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'form' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Buat Pengajuan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('riwayat');
              loadRiwayat();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'riwayat' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Riwayat ({riwayatList.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'form' ? (
        /* Form View */
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Student Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Nama Siswa:</span>
                <p className="font-bold text-slate-800 text-sm">{currentUser.nama}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">NISN:</span>
                <p className="font-mono font-bold text-indigo-600">{currentUser.nisn}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Kelas:</span>
                <p className="font-bold text-slate-700">{currentUser.kelas || '-'}</p>
              </div>
            </div>

            {/* Validation alert banner */}
            {validationError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="block font-bold">Perhatian:</strong>
                  <p>{validationError}</p>
                </div>
              </div>
            )}

            {/* Jenis Pengajuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Jenis Pengajuan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setJenis('Izin');
                    setValidationError('');
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                    jenis === 'Izin'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${jenis === 'Izin' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Izin</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Keperluan keluarga, acara penting, atau dinas luar.</p>
                    <span className="inline-block mt-2 text-[10px] font-extrabold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-md">
                      📍 Wajib Foto GPS Map Camera
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setJenis('Sakit');
                    setValidationError('');
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                    jenis === 'Sakit'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${jenis === 'Sakit' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Sakit</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sedang mengalami gangguan kesehatan / dirawat.</p>
                    <span className="inline-block mt-2 text-[10px] font-extrabold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                      🏥 Wajib Surat Sakit Dokter
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Rentang Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dari Tanggal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggalMulai}
                  onChange={(e) => {
                    setTanggalMulai(e.target.value);
                    if (tanggalSelesai < e.target.value) setTanggalSelesai(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sampai Tanggal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={tanggalMulai}
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Keterangan Detail */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan / Keterangan Lengkap <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder={
                  jenis === 'Sakit'
                    ? "Jelaskan keluhan sakit (cth: Demam tinggi, flu berat, disarankan istirahat 3 hari oleh dokter dr. Hendra Sp.A di Puskesmas Simpang IV)..."
                    : "Jelaskan keperluan izin (cth: Menghadiri pernikahan kakak kandung di Jakarta bersama keluarga besar)..."
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            {/* DOKUMEN WAJIB UNGGAH BERDASARKAN KETENTUAN SEKOLAH */}
            <div className={`p-5 rounded-2xl border-2 transition ${
              jenis === 'Sakit'
                ? 'bg-amber-50/40 border-amber-300'
                : 'bg-blue-50/40 border-blue-300'
            }`}>
              {/* Header Ketentuan */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-xl text-white shrink-0 ${
                    jenis === 'Sakit' ? 'bg-amber-600' : 'bg-blue-600'
                  }`}>
                    {jenis === 'Sakit' ? <Stethoscope className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900">
                      {jenis === 'Sakit'
                        ? 'Dokumen Wajib: Surat Sakit Dokter / Puskesmas / Klinik'
                        : 'Dokumen Wajib: Foto Koordinat GPS Map Camera'}
                      <span className="text-rose-600 ml-1.5 text-xs font-black">* (Wajib Diunggah)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {jenis === 'Sakit'
                        ? 'Wajib melampirkan foto / scan surat keterangan sakit resmi dari dokter, klinik, atau puskesmas sebagai syarat validasi absensi sakit.'
                        : 'Wajib melampirkan foto yang memiliki cap titik koordinat lokasi (latitude & longitude) menggunakan aplikasi GPS Map Camera.'}
                    </p>
                  </div>
                </div>

                {/* Upload Mode Selector */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      uploadMode === 'file' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Upload File / Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      uploadMode === 'link' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Link URL
                  </button>
                </div>
              </div>

              {/* Upload Input Area */}
              {uploadMode === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={jenis === 'Sakit' ? 'image/*,application/pdf' : 'image/*'}
                    onChange={handleFileChange}
                    className="hidden"
                    id="doc-file-input"
                  />

                  {!dokumenUrl ? (
                    <label
                      htmlFor="doc-file-input"
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 transition">
                        <Upload className="w-6 h-6 group-hover:scale-110 transition" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                        Klik untuk memilih {jenis === 'Sakit' ? 'Surat Sakit Dokter' : 'Foto GPS Map Camera'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {jenis === 'Sakit'
                          ? 'Mendukung format JPG, PNG, WEBP, atau PDF (maksimal 6MB)'
                          : 'Mendukung format Foto Kamera JPG / PNG (maksimal 6MB)'}
                      </p>
                    </label>
                  ) : (
                    /* File Uploaded Preview Card */
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        {isImageDoc(dokumenUrl) ? (
                          <div className="relative group shrink-0">
                            <img
                              src={dokumenUrl}
                              alt="Bukti Pengajuan"
                              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewImage(dokumenUrl)}
                              className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                              title="Perbesar gambar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <FileText className="w-8 h-8" />
                          </div>
                        )}

                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-emerald-700">
                              {jenis === 'Sakit' ? 'Surat Sakit Dokter Terlampir' : 'Foto Koordinat GPS Terlampir'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-mono truncate max-w-xs mt-0.5">
                            {dokumenFileName || 'Berkas Dokumen Terlampir'}
                          </p>
                          <span className="inline-block text-[10px] text-slate-400">Siap dikirim bersama formulir</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isImageDoc(dokumenUrl) && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(dokumenUrl)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={clearUploadedFile}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Ganti File</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Link Mode Input */
                <div>
                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={dokumenUrl}
                      onChange={(e) => {
                        setDokumenUrl(e.target.value);
                        setDokumenFileName('Link Berkas Google Drive / Cloud');
                        setValidationError('');
                      }}
                      placeholder={
                        jenis === 'Sakit'
                          ? "https://drive.google.com/file/... (Link Surat Sakit Dokter)"
                          : "https://drive.google.com/file/... (Link Foto GPS Map Camera)"
                      }
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Pastikan tautan dapat dibuka secara publik / oleh Guru dan Admin sekolah.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
              <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <p>
                <strong>Catatan Penting:</strong> Permohonan izin atau sakit Anda akan segera diperiksa oleh pihak Admin dan Guru Wali Kelas. Pastikan dokumen yang dilampirkan jelas dan terbaca.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirimkan Pengajuan & Dokumen...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>KIRIM PENGAJUAN SEKARANG</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Riwayat View */
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Riwayat Pengajuan Izin & Sakit Anda</h3>
              <p className="text-[11px] text-slate-400">Pantau proses peninjauan oleh pihak Admin/Sekolah</p>
            </div>
            <button
              onClick={loadRiwayat}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
              title="Perbarui data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRiwayat ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingRiwayat ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Memuat data pengajuan...</span>
            </div>
          ) : riwayatList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600">Belum ada pengajuan izin atau sakit.</p>
              <p className="text-slate-400">Gunakan tab "Buat Pengajuan" untuk mengajukan permohonan baru.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {riwayatList.map((item) => {
                const isPending = item.status === 'Menunggu Persetujuan';
                const isApproved = item.status === 'Disetujui';
                const isRejected = item.status === 'Ditolak';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1 ${
                            item.jenis === 'Sakit' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item.jenis === 'Sakit' ? <Stethoscope className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          {item.jenis}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {item.tanggalMulai === item.tanggalSelesai
                            ? item.tanggalMulai
                            : `${item.tanggalMulai} s/d ${item.tanggalSelesai}`}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {isPending && <Clock className="w-3.5 h-3.5 animate-spin" />}
                        {isApproved && <CheckCircle className="w-3.5 h-3.5" />}
                        {isRejected && <XCircle className="w-3.5 h-3.5" />}
                        <span>{item.status}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <strong>Alasan:</strong> {item.keterangan}
                    </p>

                    {item.dokumenUrl && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {isImageDoc(item.dokumenUrl) ? (
                            <img
                              src={item.dokumenUrl}
                              alt="Dokumen"
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-indigo-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-slate-800 block text-[11px]">
                              {item.jenis === 'Sakit' ? 'Dokumen Surat Dokter' : 'Foto Koordinat GPS Map Camera'}
                            </span>
                            <span className="text-[10px] text-slate-400">Berkas Terverifikasi</span>
                          </div>
                        </div>

                        {isImageDoc(item.dokumenUrl) || isPdfDoc(item.dokumenUrl) ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.dokumenUrl)}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] shrink-0 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Bukti</span>
                          </button>
                        ) : (
                          <a
                            href={item.dokumenUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] shrink-0 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Buka Link</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Catatan Admin jika sudah ditinjau */}
                    {item.catatanAdmin && (
                      <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700 border-l-4 border-indigo-600">
                        <span className="font-bold text-[10px] uppercase text-indigo-700 block mb-0.5">
                          Tanggapan Admin ({item.reviewedBy || 'Pihak Sekolah'}):
                        </span>
                        <p>{item.catatanAdmin}</p>
                      </div>
                    )}

                    {/* Tombol Perbaiki Pengajuan jika ditolak oleh Admin / Guru Piket */}
                    {isRejected && (
                      <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handlePerbaikiPengajuan(item)}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Perbaiki Pengajuan</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Dokumen Lampiran</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-900 flex items-center justify-center p-2">
              {isPdfDoc(previewImage) ? (
                <iframe
                  src={previewImage}
                  title="Pratinjau Dokumen PDF"
                  className="w-full h-[65vh] rounded-xl border border-slate-700 bg-white"
                />
              ) : (
                <img
                  src={previewImage}
                  alt="Pratinjau Dokumen"
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                />
              )}
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
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
