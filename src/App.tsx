/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { api, getAuthToken } from './lib/api.ts';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import {
  School,
  QrCode,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  Camera,
  Download,
  Upload,
  RefreshCw,
  Bell,
  Send,
  MessageCircle,
  GraduationCap,
  CalendarDays,
  ShieldCheck,
  Database,
  ArrowRight,
  Globe,
  FileCheck,
  Percent,
  TrendingUp,
  Lock,
  KeyRound,
  ShieldAlert,
  Check,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Power
} from 'lucide-react';
import PanduanDeployModal from './components/PanduanDeployModal.tsx';
import ScannerLiveKioskView from './components/ScannerLiveKioskView.tsx';
import PengajuanIzinSiswaView from './components/PengajuanIzinSiswaView.tsx';
import PersetujuanIzinAdminView from './components/PersetujuanIzinAdminView.tsx';

interface CurrentUser {
  role: 'admin' | 'guru' | 'wakel' | 'siswa';
  username?: string;
  nama?: string;
  kelas?: string;
  nisn?: string;
  token?: string;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState(false);

  // Auth form states
  const [loginTab, setLoginTab] = useState<'siswa' | 'admin'>('siswa');
  const [loginNisn, setLoginNisn] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Kiosk Access Passcode Verification State ("silahkanmasuk")
  const [showKioskPasscodeModal, setShowKioskPasscodeModal] = useState(false);
  const [kioskPasscode, setKioskPasscode] = useState('');
  const [kioskPasscodeError, setKioskPasscodeError] = useState('');
  const [kioskAttempts, setKioskAttempts] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem('kiosk_passcode_attempts');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const MAX_KIOSK_ATTEMPTS = 3;
  const isKioskLocked = kioskAttempts >= MAX_KIOSK_ATTEMPTS;

  // App notification banner / toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Master Data Cache
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; provider: string; host?: string; lastError?: string } | null>(null);

  useEffect(() => {
    fetch('/api/database/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setDbStatus(data);
        }
      })
      .catch(console.error);
  }, [refreshTrigger]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Check existing session
  useEffect(() => {
    const raw = localStorage.getItem('absensiAppSession');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token) {
          setCurrentUser(parsed);
        }
      } catch {
        localStorage.removeItem('absensiAppSession');
      }
    }
  }, []);

  // Load Kelas (always load so kiosk and login have class lists)
  useEffect(() => {
    api.getKelasList().then(res => {
      if (res.success && Array.isArray(res.data)) {
        setKelasList(res.data);
      }
    }).catch(console.error);
  }, [currentUser, isKioskMode, refreshTrigger]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingAuth(true);

    try {
      const payload = loginTab === 'siswa'
        ? { nisn: loginNisn }
        : { username: loginUsername, password: loginPassword };

      const res = await api.login(payload);
      if (res.success) {
        const userData: CurrentUser = {
          role: res.role,
          username: res.username,
          nama: res.nama,
          kelas: res.kelas || '',
          nisn: res.nisn || '',
          token: res.token,
        };
        localStorage.setItem('absensiAppSession', JSON.stringify(userData));
        try {
          sessionStorage.removeItem('kiosk_passcode_attempts');
        } catch {}
        setKioskAttempts(0);
        setCurrentUser(userData);
        showToast(`Selamat datang, ${userData.nama || userData.username}!`);
      } else {
        setLoginError(res.message || 'Login gagal.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleVerifyKioskPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (isKioskLocked) {
      setKioskPasscodeError('Batas percobaan telah habis. Silakan login akun terlebih dahulu.');
      return;
    }

    if (kioskPasscode.trim() === 'silahkanmasuk') {
      setShowKioskPasscodeModal(false);
      setKioskPasscode('');
      setKioskPasscodeError('');
      setIsKioskMode(true);
      showToast('✓ Kode verifikasi benar! Membuka scanner daftar hadir...', 'success');
    } else {
      const nextAttempts = kioskAttempts + 1;
      setKioskAttempts(nextAttempts);
      try {
        sessionStorage.setItem('kiosk_passcode_attempts', String(nextAttempts));
      } catch {}
      setKioskPasscode('');

      if (nextAttempts >= MAX_KIOSK_ATTEMPTS) {
        setShowKioskPasscodeModal(false);
        showToast(`Batas maksimal percobaan (${MAX_KIOSK_ATTEMPTS} kali) tercapai! Akses langsung ditutup. Silakan login akun terlebih dahulu.`, 'error');
      } else {
        setKioskPasscodeError(`Kode verifikasi salah! Percobaan ${nextAttempts} dari ${MAX_KIOSK_ATTEMPTS}. Sisa kesempatan: ${MAX_KIOSK_ATTEMPTS - nextAttempts} kali.`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('absensiAppSession');
    setCurrentUser(null);
    setActiveView('dashboard');
    showToast('Berhasil keluar dari akun.', 'info');
  };

  // Quick Demo Logins for easy grading & testing
  const quickLogin = async (role: 'admin' | 'guru' | 'siswa') => {
    if (role === 'admin') {
      setLoginTab('admin');
      setLoginUsername('admin');
      setLoginPassword('admin123');
      const res = await api.login({ username: 'admin', password: 'admin123' });
      if (res.success) {
        const u: CurrentUser = { role: 'admin', username: 'admin', nama: 'Administrator', token: res.token };
        localStorage.setItem('absensiAppSession', JSON.stringify(u));
        setCurrentUser(u);
      }
    } else if (role === 'guru') {
      setLoginTab('admin');
      setLoginUsername('guru1');
      setLoginPassword('guru123');
      const res = await api.login({ username: 'guru1', password: 'guru123' });
      if (res.success) {
        const u: CurrentUser = { role: 'guru', username: 'guru1', nama: 'Guru Kelas VI B', kelas: 'VI B', token: res.token };
        localStorage.setItem('absensiAppSession', JSON.stringify(u));
        setCurrentUser(u);
      }
    } else {
      setLoginTab('siswa');
      setLoginNisn('1234567890');
      const res = await api.login({ nisn: '1234567890' });
      if (res.success) {
        const u: CurrentUser = { role: 'siswa', nisn: '1234567890', nama: 'Ahmad Rizki', kelas: 'VI B', token: res.token };
        localStorage.setItem('absensiAppSession', JSON.stringify(u));
        setCurrentUser(u);
      }
    }
  };

  // KIOSK MODE: Akses Langsung Scanner Kamera Live Gerbang Sekolah Tanpa Login
  if (isKioskMode) {
    return (
      <ScannerLiveKioskView
        onClose={() => setIsKioskMode(false)}
        showToast={showToast}
        kelasList={kelasList}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-950 font-sans">
        {/* Background glow effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-700 rounded-full mix-blend-multiply filter blur-[128px] opacity-25 animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-700 rounded-full mix-blend-multiply filter blur-[128px] opacity-25 animate-pulse"></div>
        </div>

        <div className="relative z-10 w-full max-w-5xl bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 flex flex-col lg:flex-row">
          {/* Left Hero */}
          <div className="w-full lg:w-5/12 relative p-8 lg:p-10 flex flex-col justify-between text-white bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-white/10">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                  <School className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-bold tracking-wider text-xs text-indigo-300">SMP NEGERI 004 JAMBI</span>
                  <div className="text-[10px] text-slate-400 font-mono">PostgreSQL Cloud Database</div>
                </div>
              </div>

              <h1 className="text-3xl lg:text-4xl font-black leading-tight mb-4">
                Sistem Absensi <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                  Digital Pintar
                </span>
              </h1>
              <p className="text-slate-300 text-xs leading-relaxed max-w-xs font-light">
                Platform presensi kehadiran sekolah terpadu dengan scanner QR realtime, PostgreSQL Cloud SQL, dan WhatsApp Notification.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex gap-2 text-xs font-medium text-slate-300">
                <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> High Scalability
                </div>
              </div>
            </div>
          </div>

          {/* Right Form */}
          <div className="w-full lg:w-7/12 bg-white p-8 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Selamat Datang</h2>
                <p className="text-slate-500 text-xs mt-1">Silakan masuk menggunakan akun atau NISN Anda</p>
              </div>

              {/* Tabs */}
              <div className="bg-slate-100 p-1.5 rounded-xl flex mb-6 border border-slate-200">
                <button
                  type="button"
                  onClick={() => { setLoginTab('siswa'); setLoginError(''); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    loginTab === 'siswa' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" /> Siswa (NISN)
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginTab('admin'); setLoginError(''); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    loginTab === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" /> Guru / Admin
                </button>
              </div>

              {loginError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {loginTab === 'siswa' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      NISN Siswa
                    </label>
                    <input
                      type="text"
                      required
                      value={loginNisn}
                      onChange={(e) => setLoginNisn(e.target.value)}
                      placeholder="Masukkan 10 digit NISN (cth: 1234567890)"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="admin atau guru1"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition text-sm flex justify-center items-center gap-2"
                >
                  {isSubmittingAuth ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>MASUK SEKARANG</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Tombol Akses Langsung Daftar Hadir Tanpa Login */}
              {/* HIDDEN JIKA TAB SISWA - HANYA MUNCUL DI TAB ADMIN / GURU */}
              {loginTab === 'admin' && (
                <div className="mt-6 pt-5 border-t border-slate-200 animate-in fade-in">
                  {isKioskLocked ? (
                    /* Jika gagal sampai batas maksimal (3 kali), tampilan tombol buka scanner TIDAK MUNCUL dan harus login dulu */
                    <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Akses Scanner Langsung Terkunci</span>
                      </div>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        Anda telah mencapai batas maksimal ({MAX_KIOSK_ATTEMPTS} kali) memasukkan kode verifikasi yang salah.
                        Tampilan tombol buka scanner tanpa login telah <strong>dinonaktifkan</strong>. Anda <strong>harus login akun terlebih dahulu</strong> untuk dapat mengakses scanner daftar hadir.
                      </p>
                    </div>
                  ) : (
                    /* Tampilan untuk Admin/Guru: Memerlukan kata sandi / kode verifikasi "silahkanmasuk" */
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 p-4 rounded-2xl shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 text-white tracking-wider">
                          <QrCode className="w-3 h-3" /> Akses Gerbang Sekolah
                        </span>
                        <span className="text-[10px] text-indigo-800 font-extrabold bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Perlu Kode Akses
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-900 mb-1">
                        Aktifkan Langsung Scanner Daftar Hadir
                      </h4>
                      <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                        Khusus Guru / Admin: Buka scanner presensi kamera/barcode gerbang tanpa login akun. Diperlukan kode verifikasi otorisasi untuk membuka tampilan scanner ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setKioskPasscode('');
                          setKioskPasscodeError('');
                          setShowKioskPasscodeModal(true);
                        }}
                        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white font-bold rounded-xl shadow-md shadow-emerald-200 transition text-xs flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition" />
                        <span>BUKA SCANNER DAFTAR HADIR (VERIFIKASI KODE)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Verifikasi Kode Akses Scanner Kiosk */}
        {showKioskPasscodeModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">Verifikasi Kode Akses</h3>
                    <p className="text-[10px] text-slate-400">Scanner Langsung Tanpa Login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKioskPasscodeModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-600">
                <p>
                  Masukkan kode verifikasi resmi untuk membuka scanner daftar hadir tanpa login:
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">Percobaan gagal: {kioskAttempts} / {MAX_KIOSK_ATTEMPTS}</span>
                  <span className="text-indigo-600">Sisa: {MAX_KIOSK_ATTEMPTS - kioskAttempts} kali</span>
                </div>
              </div>

              {kioskPasscodeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{kioskPasscodeError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyKioskPasscode} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kode Verifikasi Akses <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    value={kioskPasscode}
                    onChange={(e) => setKioskPasscode(e.target.value)}
                    placeholder="Masukkan kode verifikasi..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Jika gagal {MAX_KIOSK_ATTEMPTS} kali, akses langsung akan dikunci dan Anda harus login akun terlebih dahulu.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowKioskPasscodeModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Verifikasi & Buka</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <PanduanDeployModal
          isOpen={isDeployGuideOpen}
          onClose={() => setIsDeployGuideOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white transition-all transform animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-[rgb(26,25,103)] text-white transition-all duration-300 flex flex-col h-full shadow-2xl ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-indigo-900/50">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && (
            <div className="ml-3 truncate">
              <h1 className="font-bold text-sm tracking-wide text-white">E-ABSENSI</h1>
              <p className="text-[9px] text-indigo-300 uppercase tracking-wider font-semibold">PostgreSQL Edition</p>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="p-3">
          <div className="flex items-center p-2.5 bg-black/25 rounded-xl border border-white/10 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
              {(currentUser.nama || currentUser.username || 'U').charAt(0).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="ml-2.5 truncate">
                <p className="font-semibold text-xs text-white truncate max-w-[140px]">
                  {currentUser.nama || currentUser.username}
                </p>
                <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-indigo-800 text-indigo-200 border border-indigo-700">
                  {currentUser.role}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-1 text-xs">
          {/* Dashboard for all */}
          <SidebarBtn
            label="Dashboard"
            icon={<School className="w-4 h-4" />}
            active={activeView === 'dashboard'}
            collapsed={!isSidebarOpen}
            onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
          />

          {/* Admin & Guru specific views */}
          {(currentUser.role === 'admin' || currentUser.role === 'guru') && (
            <>
              <SidebarBtn
                label="Daftar Hadir"
                icon={<CheckCircle className="w-4 h-4" />}
                active={activeView === 'daftar-hadir'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('daftar-hadir'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Direktori Siswa"
                icon={<Users className="w-4 h-4" />}
                active={activeView === 'siswa'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('siswa'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Monitoring Realtime"
                icon={<Clock className="w-4 h-4" />}
                active={activeView === 'monitoring'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('monitoring'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Persetujuan Izin"
                icon={<ShieldCheck className="w-4 h-4 text-amber-300" />}
                active={activeView === 'persetujuan-izin'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('persetujuan-izin'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Rekap Bulanan"
                icon={<CalendarDays className="w-4 h-4" />}
                active={activeView === 'rekap-bulanan'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('rekap-bulanan'); setMobileMenuOpen(false); }}
              />
            </>
          )}

          {/* Admin exclusive views */}
          {currentUser.role === 'admin' && (
            <>
              <SidebarBtn
                label="Data Guru"
                icon={<Users className="w-4 h-4" />}
                active={activeView === 'guru'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('guru'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Manajemen Kelas"
                icon={<Plus className="w-4 h-4" />}
                active={activeView === 'kelas'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('kelas'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Kelola Libur & Jam"
                icon={<Settings className="w-4 h-4" />}
                active={activeView === 'jadwal-libur'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('jadwal-libur'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Kenaikan Kelas"
                icon={<GraduationCap className="w-4 h-4" />}
                active={activeView === 'promosi'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('promosi'); setMobileMenuOpen(false); }}
              />
            </>
          )}

          {/* Student exclusive views */}
          {currentUser.role === 'siswa' && (
            <>
              <SidebarBtn
                label="Pengajuan Izin & Sakit"
                icon={<FileSpreadsheet className="w-4 h-4 text-amber-300" />}
                active={activeView === 'pengajuan-izin'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('pengajuan-izin'); setMobileMenuOpen(false); }}
              />
              <SidebarBtn
                label="Kartu Digital Saya"
                icon={<QrCode className="w-4 h-4" />}
                active={activeView === 'kartu-saya'}
                collapsed={!isSidebarOpen}
                onClick={() => { setActiveView('kartu-saya'); setMobileMenuOpen(false); }}
              />
            </>
          )}

          {/* Panduan Deploy Online (Admin & Guru Only - HILANG UNTUK SISWA) */}
          {currentUser.role !== 'siswa' && (
            <div className="pt-2 border-t border-indigo-900/40 my-2">
              <SidebarBtn
                label="Panduan Deploy"
                icon={<Globe className="w-4 h-4 text-emerald-300" />}
                active={isDeployGuideOpen}
                collapsed={!isSidebarOpen}
                onClick={() => { setIsDeployGuideOpen(true); setMobileMenuOpen(false); }}
              />
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-indigo-900/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full p-2.5 rounded-xl text-rose-300 hover:text-white hover:bg-rose-600/20 transition text-xs font-semibold"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>Keluar Aplikasi</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${
        isSidebarOpen ? 'md:ml-64' : 'md:ml-20'
      }`}>
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth < 768) setMobileMenuOpen(!mobileMenuOpen);
                else setIsSidebarOpen(!isSidebarOpen);
              }}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-800 capitalize">
                {activeView.replace('-', ' ')}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                {dbStatus?.connected ? (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{dbStatus.provider || 'Supabase PostgreSQL'} • Connected</span>
                  </div>
                ) : currentUser.role !== 'siswa' ? (
                  <button
                    onClick={() => setIsDeployGuideOpen(true)}
                    className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 underline cursor-pointer text-left"
                    title={dbStatus?.lastError || 'Klik untuk cek konfigurasi Supabase'}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>In-Memory (Supabase Belum Aktif) • Cek Panduan</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Sistem Terhubung</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hari Ini</p>
              <p className="text-xs font-bold text-slate-700">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {currentUser.role !== 'siswa' && (
              <button
                onClick={() => setIsDeployGuideOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition border border-indigo-200"
                title="Panduan Lengkap Onlinekan Aplikasi & Konfigurasi Server"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Panduan Server</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <Bell className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          {activeView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              onNavigate={(view) => setActiveView(view)}
            />
          )}

          {activeView === 'daftar-hadir' && (
            <DaftarHadirView
              currentUser={currentUser}
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'siswa' && (
            <DataSiswaView
              kelasList={kelasList}
              showToast={showToast}
              dbStatus={dbStatus}
            />
          )}

          {activeView === 'guru' && (
            <DataGuruView
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'kelas' && (
            <ManajemenKelasView
              kelasList={kelasList}
              showToast={showToast}
              onUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          )}

          {activeView === 'monitoring' && (
            <MonitoringView
              currentUser={currentUser}
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'rekap-bulanan' && (
            <RekapBulananView
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'sholat' && (
            <AbsensiSholatView
              currentUser={currentUser}
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'jadwal-libur' && (
            <JadwalLiburView
              showToast={showToast}
            />
          )}

          {activeView === 'promosi' && (
            <PromosiView
              kelasList={kelasList}
              showToast={showToast}
            />
          )}

          {activeView === 'kartu-saya' && currentUser.role === 'siswa' && (
            <KartuSayaView
              currentUser={currentUser}
            />
          )}

          {activeView === 'pengajuan-izin' && currentUser.role === 'siswa' && (
            <PengajuanIzinSiswaView
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {activeView === 'persetujuan-izin' && currentUser.role !== 'siswa' && (
            <PersetujuanIzinAdminView
              currentUser={currentUser}
              kelasList={kelasList}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      <PanduanDeployModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />
    </div>
  );
}

function SidebarBtn({ label, icon, active, collapsed, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition font-medium ${
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
          : 'text-indigo-200 hover:text-white hover:bg-white/10'
      } ${collapsed ? 'justify-center' : 'justify-start'}`}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

// --------------------------------------------------------------------------
// 0. STUDENT DASHBOARD VIEW (DENGAN LAPORAN KEHADIRAN BULANAN PRESENTASE)
// --------------------------------------------------------------------------
function StudentDashboardView({
  currentUser,
  siswaToday,
  onNavigate,
}: {
  currentUser: CurrentUser;
  siswaToday: any;
  onNavigate: (v: string) => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState<{
    persentaseHadir: number;
    totalHadir: number;
    totalSakit: number;
    totalIzin: number;
    totalAlpa: number;
    totalTerlambat: number;
    totalTercatat: number;
    records: any[];
  } | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  useEffect(() => {
    if (!currentUser.nisn) return;
    setLoadingMonthly(true);
    api.getSiswaBulanan(currentUser.nisn, selectedMonth)
      .then((res) => {
        if (res && res.success && res.data) {
          setMonthlyData(res.data);
        }
      })
      .catch((err) => console.warn('Gagal memuat rekap bulanan siswa:', err))
      .finally(() => setLoadingMonthly(false));
  }, [currentUser.nisn, selectedMonth]);

  const formatBulanIndo = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const idx = parseInt(m, 10) - 1;
    return `${months[idx] || m} ${y}`;
  };

  const percentage = monthlyData ? monthlyData.persentaseHadir : 100;
  // Circumference for r=38 is 2 * PI * 38 = 238.76
  const strokeDashoffset = 238.76 - (238.76 * percentage) / 100;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Header Hero Card with Today's Status */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-indigo-200 backdrop-blur-md mb-2 border border-white/10">
              <School className="w-3.5 h-3.5 text-indigo-300" />
              <span>Portal Siswa Terpadu</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Halo, {currentUser.nama}!</h2>
            <p className="text-xs text-indigo-200 mt-1">
              Kelas <strong className="text-white">{currentUser.kelas}</strong> • NISN <strong className="text-white font-mono">{currentUser.nisn}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <button
              onClick={() => onNavigate('pengajuan-izin')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold rounded-2xl text-xs transition shadow-lg shadow-amber-900/30 flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ajukan Izin / Sakit</span>
            </button>
            <button
              onClick={() => onNavigate('kartu-saya')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-2xl text-xs transition border border-white/20 flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Kartu</span>
            </button>
          </div>
        </div>

        {/* Today's Arrival & Departure Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-black/25 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider block">
                Jam Datang Hari Ini
              </span>
              <p className="text-2xl font-mono font-bold mt-1 text-emerald-300">
                {siswaToday?.data?.jamDatang || '--:--'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-black/25 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider block">
                Jam Pulang Hari Ini
              </span>
              <p className="text-2xl font-mono font-bold mt-1 text-orange-300">
                {siswaToday?.data?.jamPulang || '--:--'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
          </div>
        </div>

        {siswaToday?.isLibur && (
          <div className="mt-4 bg-rose-500/20 border border-rose-500/30 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-rose-200 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
            <span>Pemberitahuan: {siswaToday?.keteranganLibur || 'Hari ini adalah hari libur sekolah.'}</span>
          </div>
        )}
      </div>

      {/* 2. LAPORAN KEHADIRAN BULANAN (PRESENTASE) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
              <h3 className="font-black text-lg text-slate-900">Laporan Kehadiran Perbulan</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tingkat kehadiran siswa dihitung secara akurat dalam bentuk persentase bulanan
            </p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Pilih Bulan:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {loadingMonthly ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Menghitung persentase kehadiran {formatBulanIndo(selectedMonth)}...</span>
          </div>
        ) : (
          <>
            {/* Highlight Presentase Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl flex flex-col md:flex-row items-center gap-6">
              {/* Circular Gauge */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="9"
                    className="text-white/10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeDasharray={238.76}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ease-out ${
                      percentage >= 90
                        ? 'text-emerald-400'
                        : percentage >= 75
                        ? 'text-indigo-400'
                        : 'text-amber-400'
                    }`}
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black font-mono tracking-tight">{percentage}%</span>
                  <span className="text-[9px] uppercase font-bold text-slate-300">Kehadiran</span>
                </div>
              </div>

              {/* Detail Info text */}
              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>
                    {percentage >= 90
                      ? 'Sangat Baik (Disiplin Tinggi)'
                      : percentage >= 75
                      ? 'Cukup Baik'
                      : 'Perlu Ditingkatkan'}
                  </span>
                </div>
                <h4 className="text-lg md:text-xl font-black text-white">
                  Tingkat Kehadiran Bulan {formatBulanIndo(selectedMonth)}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  Anda telah hadir sebanyak <strong className="text-emerald-400 font-bold">{monthlyData?.totalHadir || 0} hari</strong> dari total{' '}
                  <strong className="text-white font-bold">{monthlyData?.totalTercatat || 0} hari sekolah tercatat</strong> pada periode bulan ini.
                </p>
              </div>
            </div>

            {/* 5 Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Hadir</span>
                <p className="text-2xl font-black text-emerald-800 mt-1">{monthlyData?.totalHadir || 0}</p>
                <span className="text-[10px] text-emerald-600 font-semibold">Hari</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Sakit</span>
                <p className="text-2xl font-black text-amber-800 mt-1">{monthlyData?.totalSakit || 0}</p>
                <span className="text-[10px] text-amber-600 font-semibold">Hari</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Izin</span>
                <p className="text-2xl font-black text-blue-800 mt-1">{monthlyData?.totalIzin || 0}</p>
                <span className="text-[10px] text-blue-600 font-semibold">Hari</span>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Alpa</span>
                <p className="text-2xl font-black text-rose-800 mt-1">{monthlyData?.totalAlpa || 0}</p>
                <span className="text-[10px] text-rose-600 font-semibold">Hari</span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Terlambat</span>
                <p className="text-2xl font-black text-purple-800 mt-1">{monthlyData?.totalTerlambat || 0}</p>
                <span className="text-[10px] text-purple-600 font-semibold">Kali</span>
              </div>
            </div>

            {/* Daily History Table for Selected Month */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  <span>Rincian Absensi Harian ({formatBulanIndo(selectedMonth)})</span>
                </h4>
                <span className="text-xs text-slate-400 font-medium">
                  {monthlyData?.records?.length || 0} Catatan
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3 text-center">Jam Datang</th>
                      <th className="p-3 text-center">Jam Pulang</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!monthlyData?.records || monthlyData.records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Belum ada catatan presensi pada bulan {formatBulanIndo(selectedMonth)}.
                        </td>
                      </tr>
                    ) : (
                      monthlyData.records.map((r: any, idx: number) => {
                        const st = r.status || 'Hadir';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-semibold text-slate-800">
                              {r.tanggal}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {r.jamDatang ? r.jamDatang.substring(0, 5) : '-'}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {r.jamPulang ? r.jamPulang.substring(0, 5) : '-'}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  st === 'Hadir'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : st === 'Sakit'
                                    ? 'bg-amber-100 text-amber-800'
                                    : st === 'Izin'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {st}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 text-[11px]">
                              {r.keterangan || (st === 'Hadir' ? 'Tepat Waktu' : '-')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Action Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('pengajuan-izin')}
          className="p-5 bg-white hover:bg-slate-50 active:scale-[0.99] rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between text-left transition cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900">Form Pengajuan Izin / Sakit</h4>
              <p className="text-xs text-slate-500 mt-0.5">Kirim surat permohonan izin untuk diverifikasi guru</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
        </button>

        <button
          onClick={() => onNavigate('kartu-saya')}
          className="p-5 bg-white hover:bg-slate-50 active:scale-[0.99] rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between text-left transition cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900">Kartu Pelajar Digital (QR)</h4>
              <p className="text-xs text-slate-500 mt-0.5">Tampilkan kode QR untuk scan di gerbang sekolah</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 1. DASHBOARD VIEW
// --------------------------------------------------------------------------
function DashboardView({ currentUser, onNavigate }: { currentUser: CurrentUser; onNavigate: (v: string) => void }) {
  const [stats, setStats] = useState({ total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, belum: 0 });
  const [loading, setLoading] = useState(true);
  const [siswaToday, setSiswaToday] = useState<any>(null);

  useEffect(() => {
    if (currentUser.role === 'siswa') {
      api.getAbsensiToday(currentUser.nisn || '').then(res => {
        if (res.success) setSiswaToday(res);
        setLoading(false);
      });
    } else {
      const myClass = currentUser.role === 'guru' ? currentUser.kelas : undefined;
      api.getMonitoring(myClass).then(res => {
        if (res.success && Array.isArray(res.data)) {
          const d = res.data;
          setStats({
            total: d.length,
            hadir: d.filter((x: any) => x.status === 'Hadir').length,
            sakit: d.filter((x: any) => x.status === 'Sakit').length,
            izin: d.filter((x: any) => x.status === 'Izin').length,
            alpa: d.filter((x: any) => x.status === 'Alpa').length,
            belum: d.filter((x: any) => x.status === 'Belum Absen').length,
          });
        }
        setLoading(false);
      });
    }
  }, [currentUser]);

  if (currentUser.role === 'siswa') {
    return (
      <StudentDashboardView
        currentUser={currentUser}
        siswaToday={siswaToday}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Migration Notice Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Migrasi Database ke PostgreSQL Berhasil</h3>
            <p className="text-emerald-100 text-xs">
              Backend sekarang menggunakan Cloud SQL PostgreSQL dengan koneksi pool aman dan performa instan tanpa limit Google Sheets!
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('daftar-hadir')}
          className="px-4 py-2 bg-white text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-50 transition shrink-0"
        >
          Buka Scanner QR
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Siswa" value={stats.total} color="indigo" icon={<Users className="w-4 h-4" />} />
        <StatCard label="Hadir" value={stats.hadir} color="emerald" icon={<CheckCircle className="w-4 h-4" />} />
        <StatCard label="Sakit" value={stats.sakit} color="amber" icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard label="Izin" value={stats.izin} color="blue" icon={<Calendar className="w-4 h-4" />} />
        <StatCard label="Alpa / Belum" value={stats.alpa + stats.belum} color="rose" icon={<Clock className="w-4 h-4" />} />
      </div>

      {/* Quick Access */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-indigo-600" /> Akses Cepat Presensi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionBtn
            title="Daftar Hadir Live"
            subtitle="Scan QR masuk & pulang"
            onClick={() => onNavigate('daftar-hadir')}
          />
          <QuickActionBtn
            title="Monitoring Realtime"
            subtitle="Lihat & ubah status siswa"
            onClick={() => onNavigate('monitoring')}
          />
          <QuickActionBtn
            title="Rekap Bulanan"
            subtitle="Matriks kehadiran & export"
            onClick={() => onNavigate('rekap-bulanan')}
          />
          <QuickActionBtn
            title="Data Siswa"
            subtitle="Kelola master & cetak kartu"
            onClick={() => onNavigate('siswa')}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg border ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-black text-slate-800 mt-2">{value}</p>
    </div>
  );
}

function QuickActionBtn({ title, subtitle, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition text-left group"
    >
      <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition">{title}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
    </button>
  );
}

// --------------------------------------------------------------------------
// 2. DAFTAR HADIR GURU (LIVE QR SCAN + MC26 USB + WHATSAPP ALPA)
// --------------------------------------------------------------------------
function DaftarHadirView({ currentUser, kelasList, showToast }: { currentUser: CurrentUser; kelasList: string[]; showToast: any }) {
  const [mode, setMode] = useState<'masuk' | 'pulang'>('masuk');
  const [selectedKelas, setSelectedKelas] = useState<string>('SEMUA');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualNisn, setManualNisn] = useState('');
  const [waMap, setWaMap] = useState<Record<string, { sudahDikirim: boolean; waktu: string }>>({});
  const [todayDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Camera scanner states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [scanMessage, setScanMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Load students & attendance status
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.getSiswaList(selectedKelas);
      const detailRes = await api.getDaftarHadirDetail(selectedKelas, todayDate);
      const waRes = await api.getWhatsAppStatus(selectedKelas, todayDate);

      if (res.success && Array.isArray(res.data)) {
        const detailMap = detailRes.data || {};
        const merged = res.data.map((s: any) => ({
          ...s,
          jamDatang: detailMap[s.nisn]?.jamDatang || '',
          jamPulang: detailMap[s.nisn]?.jamPulang || '',
          status: (detailMap[s.nisn]?.status || 'belum').toLowerCase(),
          idAbsensi: detailMap[s.nisn]?.rowIndex,
        }));
        setStudents(merged);
      }
      if (waRes.success && waRes.data) {
        setWaMap(waRes.data);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedKelas, mode, todayDate]);

  // Audio Beep
  const playBeep = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 300, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.2 : 0.4));
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.2 : 0.4));
    } catch {}
  };

  // Process Scan
  const handleScanNisn = async (rawNisn: string) => {
    const clean = rawNisn.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!clean) return;

    try {
      const nowObj = new Date();
      const clientTime = nowObj.toLocaleTimeString('en-GB', { hour12: false });
      const clientDate = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
      const res = await api.scanAbsensi(clean, currentUser.role, currentUser.kelas || '', mode, clientTime, clientDate);
      if (res.success) {
        playBeep(true);
        setScanMessage({ text: `✓ ${res.nama}: ${res.message}`, success: true });
        showToast(`Presensi berhasil: ${res.nama}`);
        fetchStudents();
      } else {
        playBeep(false);
        setScanMessage({ text: res.message || 'Presensi gagal', success: false });
      }
    } catch (err: any) {
      playBeep(false);
      setScanMessage({ text: err.message, success: false });
    } finally {
      setTimeout(() => setScanMessage(null), 3500);
    }
  };

  // Keyboard HID Scanner Listener (For MC26 USB Barcode/QR Reader)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target.id !== 'scanner-trap') return;

      const now = Date.now();
      if (now - lastKeyTime > 300) buffer = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          handleScanNisn(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1 && /^[0-9a-zA-Z]$/.test(e.key)) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, currentUser]);

  // Integrated Camera Scanner using jsQR cross-browser engine
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      let active = true;
      let lastScanTime = 0;

      const scanFrame = () => {
        if (!active || !videoRef.current) return;
        const video = videoRef.current;

        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (!scanCanvasRef.current) {
            scanCanvasRef.current = document.createElement('canvas');
          }
          const canvas = scanCanvasRef.current;
          const w = video.videoWidth;
          const h = video.videoHeight;
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });

            if (code && code.data && Date.now() - lastScanTime > 2000) {
              lastScanTime = Date.now();
              handleScanNisn(code.data);
            }
          }
        }

        if (active) {
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        }
      };

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      showToast('Kamera tidak dapat diakses: ' + err.message, 'error');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Upload QR code photo directly to scan
  const handleUploadQrPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            handleScanNisn(code.data);
            showToast(`QR terdeteksi: ${code.data}`);
          } else {
            showToast('QR Code tidak terdeteksi pada gambar. Pastikan gambar jelas.', 'error');
          }
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Tandai Pulang Satu Siswa (Manual Action)
  const handleMarkPulangSatu = async (nisn: string, nama: string) => {
    const nowTimeStr = new Date().toTimeString().substring(0, 5);
    // Optimistic UI update
    setStudents(prev => prev.map(item => item.nisn === nisn ? {
      ...item,
      jamPulang: nowTimeStr,
    } : item));

    try {
      const res = await api.submitPulangSatu(nisn, todayDate);
      if (res && res.success) {
        showToast(res.message || `${nama} berhasil dicatat pulang.`);
        fetchStudents();
      } else {
        showToast(res?.message || 'Gagal mencatat pulang siswa', 'error');
        fetchStudents();
      }
    } catch (err: any) {
      showToast(err.message || 'Koneksi gagal', 'error');
      fetchStudents();
    }
  };

  // Tandai Pulang Semua Siswa Hadir (Manual Action)
  const handleMarkPulangSemuaHadir = async () => {
    const hadirBelumPulang = students.filter(s => s.status === 'hadir' && !s.jamPulang);
    if (hadirBelumPulang.length === 0) {
      showToast('Tidak ada siswa Hadir yang belum absen pulang.', 'info');
      return;
    }

    if (!window.confirm(`Catat pulang untuk ${hadirBelumPulang.length} siswa yang berstatus Hadir? Siswa Sakit/Izin/Alpa akan tetap sesuai keterangannya.`)) {
      return;
    }

    const nowTimeStr = new Date().toTimeString().substring(0, 5);
    // Optimistic UI update
    setStudents(prev => prev.map(item => (item.status === 'hadir' && !item.jamPulang) ? {
      ...item,
      jamPulang: nowTimeStr,
    } : item));

    try {
      const res = await api.submitPulangSemuaHadir(selectedKelas, todayDate, currentUser?.nama || 'Petugas');
      if (res && res.success) {
        showToast(res.message || 'Semua siswa hadir berhasil dicatat pulang.');
        fetchStudents();
      } else {
        showToast(res?.message || 'Gagal mencatat pulang massal', 'error');
        fetchStudents();
      }
    } catch (err: any) {
      showToast(err.message || 'Koneksi gagal', 'error');
      fetchStudents();
    }
  };

  // WhatsApp ALPA Sender
  const sendWhatsAppAlpa = async (siswaItem: any) => {
    const rawHp = siswaItem.noHp || '';
    let hp = rawHp.replace(/\D/g, '');
    if (hp.startsWith('08')) hp = '62' + hp.substring(1);
    else if (hp.startsWith('8')) hp = '62' + hp;

    if (!hp) {
      showToast('Nomor HP Orang Tua belum diisi untuk siswa ini.', 'error');
      return;
    }

    const sapaan = siswaItem.namaAyah || siswaItem.namaIbu ? 'Bapak/Ibu Orang Tua' : 'Orang Tua/Wali';
    const message = `Assalamu'alaikum ${sapaan},\n\nKami dari pihak sekolah ingin menyampaikan informasi bahwa siswa:\nNama: *${siswaItem.nama}*\nNISN: *${siswaItem.nisn}*\nKelas: *${siswaItem.kelas}*\nTanggal: *${todayDate}*\nKehadiran: *ALPA (Tidak Hadir Tanpa Keterangan)*.\n\nMohon konfirmasinya. Terima kasih.\nWassalamu'alaikum.`;

    const waUrl = `https://web.whatsapp.com/send?phone=${hp}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');

    await api.catatWhatsApp(siswaItem.nisn, todayDate);
    fetchStudents();
    showToast(`Notifikasi WA untuk ${siswaItem.nama} telah dicatat.`);
  };

  // Quick Status change (Hadir, Sakit, Izin, Alpa) in Masuk Mode (Manual Button Action)
  const setQuickStatus = async (s: any, status: string) => {
    const lowerStatus = status.toLowerCase();
    const nowTimeStr = new Date().toTimeString().substring(0, 5);

    // Instant optimistic UI update so button highlight changes immediately
    setStudents(prev => prev.map(item => item.nisn === s.nisn ? {
      ...item,
      status: lowerStatus,
      jamDatang: lowerStatus === 'hadir' ? (item.jamDatang || nowTimeStr) : item.jamDatang,
    } : item));

    try {
      const res = await api.updateAbsensiStatus(s.nisn, s.nama, s.kelas, status, todayDate);
      if (res && res.success) {
        showToast(`Status ${s.nama} diubah ke ${status}.`);
        await fetchStudents();
      } else {
        showToast(res?.message || 'Gagal mengubah status', 'error');
        await fetchStudents();
      }
    } catch (err: any) {
      showToast(err.message || 'Koneksi gagal', 'error');
      await fetchStudents();
    }
  };

  const hadirCount = students.filter(s => s.status === 'hadir').length;
  const pulangCount = students.filter(s => !!s.jamPulang).length;
  const sakitIzinAlpaCount = students.filter(s => ['sakit', 'izin', 'alpa'].includes(s.status)).length;

  return (
    <div className="space-y-4">
      {/* Mode Slider */}
      <div className="bg-slate-200 p-1.5 rounded-2xl flex max-w-md mx-auto shadow-inner">
        <button
          onClick={() => setMode('masuk')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
            mode === 'masuk' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" /> Absen Masuk (DATANG)
        </button>
        <button
          onClick={() => setMode('pulang')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
            mode === 'pulang' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LogOut className="w-4 h-4" /> Absen Pulang (PULANG)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Filter Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="SEMUA">Semua Kelas</option>
              {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tanggal</label>
            <input
              type="text"
              readOnly
              value={todayDate}
              className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            Hadir Datang: {hadirCount} / {students.length}
          </span>
          <span className="text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
            Sudah Pulang: {pulangCount}
          </span>
          {sakitIzinAlpaCount > 0 && (
            <span className="text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
              Sakit/Izin/Alpa: {sakitIzinAlpaCount}
            </span>
          )}
        </div>
      </div>

      {/* Scanner & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Students Table */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {mode === 'masuk' ? 'Daftar Presensi Masuk (Datang)' : 'Daftar Presensi Pulang'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {mode === 'masuk'
                  ? 'Catat siswa datang tepat waktu / terlambat'
                  : 'Siswa hadir dapat absen pulang, siswa Sakit/Izin/Alpa otomatis tetap sesuai status'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {mode === 'pulang' && (
                <button
                  onClick={handleMarkPulangSemuaHadir}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 shadow-sm"
                  title="Tandai Pulang Semua Siswa Hadir"
                >
                  <LogOut className="w-3.5 h-3.5" /> Tandai Pulang Semua Hadir
                </button>
              )}
              <button
                onClick={fetchStudents}
                disabled={loading}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
                title="Refresh Daftar Hadir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[550px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase sticky top-0 z-10">
                {mode === 'masuk' ? (
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3 text-center">Jam Datang</th>
                    <th className="p-3 text-center">Status Kehadiran</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3 text-center">Jam Datang</th>
                    <th className="p-3 text-center">Jam Pulang</th>
                    <th className="p-3 text-center">Status / Tindakan Pulang</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={mode === 'masuk' ? 4 : 5} className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      <span>Memuat data siswa dari PostgreSQL...</span>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'masuk' ? 4 : 5} className="p-8 text-center text-slate-400">
                      Tidak ada siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  students.map((s, idx) => {
                    const isAlpa = s.status === 'alpa';
                    const isSakit = s.status === 'sakit';
                    const isIzin = s.status === 'izin';
                    const isHadir = s.status === 'hadir';
                    const isBelum = s.status === 'belum' || !s.status;
                    const sudahPulang = isHadir && !!s.jamPulang;
                    const isWaSent = waMap[s.nisn]?.sudahDikirim;

                    return (
                      <tr
                        key={s.nisn}
                        className={`hover:bg-slate-50/80 transition ${
                          sudahPulang
                            ? 'bg-emerald-50/60'
                            : isHadir
                            ? 'bg-emerald-50/20'
                            : isAlpa
                            ? 'bg-rose-50/40'
                            : isSakit
                            ? 'bg-amber-50/40'
                            : isIzin
                            ? 'bg-blue-50/40'
                            : ''
                        }`}
                      >
                        <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-800">{s.nama}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.nisn} • {s.kelas}</p>
                        </td>

                        {/* MODE MASUK COLUMNS */}
                        {mode === 'masuk' && (
                          <>
                            <td className="p-3 text-center font-mono text-[11px]">
                              <span className={s.jamDatang ? 'text-indigo-600 font-bold' : 'text-slate-300'}>
                                {s.jamDatang ? s.jamDatang.substring(0, 5) : '-'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex justify-center gap-1">
                                  {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map(st => {
                                    const active = s.status === st.toLowerCase();
                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        title={`Tandai status: ${st}`}
                                        onClick={() => setQuickStatus(s, st)}
                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer active:scale-95 ${
                                          active
                                            ? st === 'Hadir' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                              : st === 'Sakit' ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                              : st === 'Izin' ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                              : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                      >
                                        {st[0]}
                                      </button>
                                    );
                                  })}
                                </div>

                                {isAlpa && (
                                  <button
                                    onClick={() => sendWhatsAppAlpa(s)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition ${
                                      isWaSent
                                        ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                        : 'bg-green-600 hover:bg-green-700 text-white shadow-xs'
                                    }`}
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>{isWaSent ? 'WA Terkirim' : 'Kirim WA Alpa'}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}

                        {/* MODE PULANG COLUMNS */}
                        {mode === 'pulang' && (
                          <>
                            {/* Jam Datang Column */}
                            <td className="p-3 text-center font-mono text-[11px]">
                              {isHadir && s.jamDatang ? (
                                <span className="text-indigo-600 font-bold">{s.jamDatang.substring(0, 5)}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            {/* Jam Pulang Column */}
                            <td className="p-3 text-center font-mono text-[11px]">
                              {s.jamPulang ? (
                                <span className="text-orange-600 font-bold">{s.jamPulang.substring(0, 5)}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            {/* Status Pulang / Tandai Pulang Action */}
                            <td className="p-3 text-center">
                              {isHadir ? (
                                sudahPulang ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                                    <CheckCircle className="w-3.5 h-3.5" /> Sudah Pulang ({s.jamPulang.substring(0, 5)})
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkPulangSatu(s.nisn, s.nama)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer"
                                  >
                                    <LogOut className="w-3.5 h-3.5" /> Tandai Pulang
                                  </button>
                                )
                              ) : isSakit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                                  Keterangan: Sakit
                                </span>
                              ) : isIzin ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                                  Keterangan: Izin
                                </span>
                              ) : isAlpa ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">
                                  Keterangan: Alpa
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs">Belum Absen Datang</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Camera / Scanner Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" /> Scanner QR Realtime
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                mode === 'masuk' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
              }`}>
                Mode: {mode === 'masuk' ? 'Datang' : 'Pulang'}
              </span>
            </h3>

            {scanMessage && (
              <div className={`p-3 rounded-xl mb-3 text-xs font-bold text-center ${
                scanMessage.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {scanMessage.text}
              </div>
            )}

            {/* Video Preview with Viewfinder Overlay */}
            <div className="rounded-xl overflow-hidden bg-black aspect-4/3 relative flex items-center justify-center mb-3">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                muted
                playsInline
              />

              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-44 h-44 border-2 border-indigo-400 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl-md"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr-md"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1 rounded-bl-md"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1 rounded-br-md"></div>
                    <div className="absolute inset-x-2 top-2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse"></div>
                  </div>
                </div>
              )}

              {!cameraActive && (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Kamera live web nonaktif</p>
                  <p className="text-[10px] text-slate-500 mt-1">Gunakan tombol di bawah untuk membuka kamera</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {cameraActive ? (
                <button
                  onClick={stopCamera}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Tutup Kamera
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className={`w-full py-2.5 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm ${
                    mode === 'masuk' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  <Camera className="w-4 h-4" /> Buka Kamera Live Web ({mode === 'masuk' ? 'Datang' : 'Pulang'})
                </button>
              )}

              {/* Upload QR image option */}
              <label className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200">
                <Upload className="w-3.5 h-3.5 text-slate-500" /> Pilih File Foto / Barcode QR Siswa
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadQrPhoto}
                  className="hidden"
                />
              </label>
            </div>

            {/* Manual input / USB Barcode */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Input NISN Manual / Scanner USB (MC26)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScanNisn(manualNisn);
                      setManualNisn('');
                    }
                  }}
                  placeholder="Ketik NISN lalu tekan Enter..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleScanNisn(manualNisn);
                    setManualNisn('');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Scan
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                *Scanner USB MC26 otomatis terbaca saat menembak kartu tanpa perlu klik apa pun.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. DATA SISWA VIEW (CRUD, PDF CETAK KARTU, IMPORT EXCEL)
// --------------------------------------------------------------------------
function DataSiswaView({ kelasList, showToast, dbStatus }: { kelasList: string[]; showToast: any; dbStatus?: any }) {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ nisn: string; nama: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    nisn: '',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '2010-01-01',
    agama: 'Islam',
    namaAyah: '',
    namaIbu: '',
    noHp: '',
    kelas: '',
    alamat: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getSiswaList(filterKelas);
      if (res.success && Array.isArray(res.data)) {
        setStudents(res.data);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterKelas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.updateSiswa(editItem.nisn, formData);
        showToast('Data siswa berhasil diupdate!');
      } else {
        await api.addSiswa(formData);
        showToast('Siswa baru berhasil ditambahkan!');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    const targetNisn = deleteConfirm.nisn;
    const targetNama = deleteConfirm.nama;
    try {
      // Optimistic UI removal so student vanishes immediately
      setStudents(prev => prev.filter(s => s.nisn !== targetNisn));
      await api.deleteSiswa(targetNisn);
      showToast(`Data siswa "${targetNama}" berhasil dihapus permanen.`);
      setDeleteConfirm(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus siswa', 'error');
      await loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  // Unduh Template Excel resmi untuk import master siswa
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const headers = [
        'No',
        'Nama Lengkap',
        'NISN',
        'Jenis Kelamin',
        'Tanggal Lahir',
        'Agama',
        'Nama Ayah',
        'Nama Ibu',
        'No Handphone',
        'Kelas',
        'Alamat'
      ];

      const sampleRows = [
        headers,
        [1, 'Ahmad Rizki', '1234567890', 'Laki-laki', '2010-05-15', 'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890', 'VII A', 'Jl. Merdeka No. 10, Jambi'],
        [2, 'Siti Nurhaliza', '1234567891', 'Perempuan', '2010-08-20', 'Islam', 'Usman', 'Farida', '081298765432', 'VII A', 'Jl. Sudirman No. 25, Jambi'],
        [3, 'Kevin Pratama', '1234567894', 'Laki-laki', '2010-07-22', 'Kristen', 'Daniel', 'Maria', '081389012345', 'VII B', 'Jl. Kenanga No. 8, Jambi']
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleRows);
      ws['!cols'] = [
        { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 35 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');

      const instructions = [
        ['PETUNJUK PENGISIAN TEMPLATE EXCEL MASTER SISWA'],
        ['1. Kolom "Nama Lengkap" atau "Nama" wajib diisi nama lengkap siswa.'],
        ['2. Kolom "NISN" wajib diisi 10 digit nomor induk siswa nasional (unik).'],
        ['3. Kolom "Jenis Kelamin" isi dengan "Laki-laki" atau "Perempuan" (atau L / P).'],
        ['4. Kolom "Tanggal Lahir" diisi format YYYY-MM-DD (contoh: 2010-05-15).'],
        ['5. Kolom "Agama" isi dengan Islam, Kristen, Katolik, Hindu, Buddha, atau Konghucu.'],
        ['6. Kolom "No Handphone" diisi nomor WhatsApp/HP aktif orang tua (contoh: 081234567890) untuk notifikasi WA Alpa.'],
        ['7. Kolom "Kelas" isi dengan nama kelas yang sesuai (contoh: VII A, VII B, VII C, VIII A).'],
        ['8. Kolom "Alamat" diisi dengan alamat domisili siswa.']
      ];
      const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
      wsInstr['!cols'] = [{ wch: 75 }];
      XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk');

      XLSX.writeFile(wb, 'Template_Import_Siswa_Format_Resmi.xlsx');
      showToast('Template Excel resmi berhasil diunduh. Silakan sesuaikan data lalu import!');
    } catch {
      window.location.href = '/api/siswa/template';
    }
  };

  // Cetak Kartu Siswa PDF (8 per A4 sheet)
  const printKartuSiswaPdf = async () => {
    const listToPrint = students.filter(s => !filterKelas || s.kelas === filterKelas);
    if (listToPrint.length === 0) {
      showToast('Tidak ada data siswa untuk dicetak.', 'error');
      return;
    }

    showToast('Sedang membuat file PDF Kartu Pelajar...');

    const doc = new jsPDF('p', 'mm', 'a4');
    const cardWidth = 86;
    const cardHeight = 54;
    const marginX = 14;
    const marginY = 12;
    const gapX = 10;
    const gapY = 14;

    let col = 0;
    let row = 0;

    for (let i = 0; i < listToPrint.length; i++) {
      const s = listToPrint[i];
      const x = marginX + col * (cardWidth + gapX);
      const y = marginY + row * (cardHeight + gapY);

      // Card border & background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 220);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

      // Card Header
      doc.setFillColor(26, 25, 103);
      doc.rect(x, y, cardWidth, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('KARTU ABSENSI DIGITAL', x + cardWidth / 2, y + 6, { align: 'center' });
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('SMP NEGERI 004 JAMBI', x + cardWidth / 2, y + 10, { align: 'center' });

      // QR Code
      const qrDataUrl = await QRCode.toDataURL(s.nisn, { margin: 1, width: 120 });
      doc.addImage(qrDataUrl, 'PNG', x + 5, y + 18, 22, 22);

      // Student Info
      doc.setTextColor(20, 20, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(s.nama.substring(0, 24), x + 30, y + 23);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`NISN  : ${s.nisn}`, x + 30, y + 30);
      doc.text(`Kelas : ${s.kelas}`, x + 30, y + 36);

      col++;
      if (col >= 2) {
        col = 0;
        row++;
      }
      if (row >= 4 && i < listToPrint.length - 1) {
        doc.addPage();
        col = 0;
        row = 0;
      }
    }

    doc.save(`Kartu_Pelajar_${filterKelas || 'Semua'}.pdf`);
    showToast('File PDF berhasil didownload!');
  };

  // Excel Bulk Import
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const mapped = json.map(r => ({
          nama: r['Nama Lengkap'] || r['Nama'] || '',
          nisn: String(r['NISN'] || '').replace(/'/g, '').trim(),
          jenisKelamin: r['Jenis Kelamin'] || r['JK'] || 'Laki-laki',
          tanggalLahir: r['Tanggal Lahir'] || '2010-01-01',
          agama: r['Agama'] || 'Islam',
          namaAyah: r['Nama Ayah'] || '',
          namaIbu: r['Nama Ibu'] || '',
          noHp: String(r['No Handphone'] || r['HP'] || ''),
          kelas: String(r['Kelas'] || '').trim(),
          alamat: r['Alamat'] || '',
        }));

        const res = await api.bulkImportSiswa(mapped);
        showToast(res.message);
        loadData();
      } catch (err: any) {
        showToast('Gagal memproses file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const filtered = students.filter(s =>
    s.nama.toLowerCase().includes(search.toLowerCase()) ||
    s.nisn.includes(search)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Direktori Master Siswa</h3>
          <p className="text-xs text-slate-400">
            Total data: {students.length} siswa tersimpan di <span className={dbStatus?.connected ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{dbStatus?.connected ? 'Supabase PostgreSQL' : 'In-Memory Cache (Preview)'}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Unduh Template Excel untuk Menyesuaikan Format Import"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Template Excel
          </button>

          <button
            onClick={printKartuSiswaPdf}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Cetak Kartu PDF
          </button>

          <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Import Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={() => {
              setEditItem(null);
              setFormData({
                nama: '',
                nisn: '',
                jenisKelamin: 'Laki-laki',
                tanggalLahir: '2010-01-01',
                agama: 'Islam',
                namaAyah: '',
                namaIbu: '',
                noHp: '',
                kelas: kelasList[0] || 'VI B',
                alamat: '',
              });
              setModalOpen(true);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Siswa
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">Semua Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Nama / NISN..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
            <tr>
              <th className="p-3 w-10 text-center">No</th>
              <th className="p-3">Nama Lengkap</th>
              <th className="p-3">NISN</th>
              <th className="p-3">Kelas</th>
              <th className="p-3">No. HP Orang Tua</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Memuat data siswa...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Data siswa tidak ditemukan.</td></tr>
            ) : (
              filtered.map((s, idx) => (
                <tr key={s.nisn} className="hover:bg-slate-50 transition">
                  <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                  <td className="p-3 font-mono text-slate-600">{s.nisn}</td>
                  <td className="p-3">
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px]">
                      {s.kelas}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 font-mono">{s.noHp || '-'}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditItem(s);
                          setFormData({ ...s });
                          setModalOpen(true);
                        }}
                        className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ nisn: s.nisn, nama: s.nama })}
                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800">
                {editItem ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h4>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">NISN</label>
                  <input
                    type="text"
                    required
                    readOnly={!!editItem}
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Kelas</label>
                  <select
                    value={formData.kelas}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.jenisKelamin}
                    onChange={(e) => setFormData({ ...formData, jenisKelamin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">No. Handphone Ortu</label>
                  <input
                    type="text"
                    value={formData.noHp}
                    onChange={(e) => setFormData({ ...formData, noHp: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Hapus Data Siswa</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Apakah Anda yakin ingin menghapus siswa <strong className="text-slate-800">{deleteConfirm.nama}</strong> (NISN: {deleteConfirm.nisn}) secara permanen? Data presensi terkait juga akan dibersihkan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-200"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. DATA GURU VIEW
// --------------------------------------------------------------------------
function DataGuruView({ kelasList, showToast }: { kelasList: string[]; showToast: any }) {
  const [guruList, setGuruList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const loadGuru = async () => {
    try {
      const res = await api.getGuruList();
      if (res.success && Array.isArray(res.data)) {
        setGuruList(res.data);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadGuru();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        username,
        password,
        kelas: selectedClasses.join(','),
      };

      if (editItem) {
        await api.updateGuru(editItem.username, payload);
        showToast('Guru berhasil diupdate.');
      } else {
        await api.addGuru(payload);
        showToast('Guru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadGuru();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (user: string) => {
    if (!window.confirm(`Hapus guru "${user}"?`)) return;
    try {
      await api.deleteGuru(user);
      showToast('Guru berhasil dihapus.');
      loadGuru();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Manajemen Akun Guru</h3>
          <p className="text-xs text-slate-400">Pengaturan akses kelas dan kredensial guru</p>
        </div>
        <button
          onClick={() => {
            setEditItem(null);
            setUsername('');
            setPassword('');
            setSelectedClasses([]);
            setModalOpen(true);
          }}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Guru
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
            <tr>
              <th className="p-3 w-10 text-center">No</th>
              <th className="p-3">Username</th>
              <th className="p-3">Wali Kelas / Pengampu</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guruList.map((g, idx) => (
              <tr key={g.username} className="hover:bg-slate-50 transition">
                <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                <td className="p-3 font-bold text-slate-800">{g.username}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {g.kelas ? (
                      g.kelas.split(',').map((k: string) => (
                        <span key={k} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {k.trim()}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Semua Kelas</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditItem(g);
                        setUsername(g.username);
                        setPassword(g.password);
                        setSelectedClasses(g.kelas ? g.kelas.split(',').map((k: string) => k.trim()) : []);
                        setModalOpen(true);
                      }}
                      className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.username)}
                      className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h4 className="font-bold text-sm text-slate-800 mb-3">{editItem ? 'Edit Guru' : 'Tambah Guru'}</h4>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Kelas yang Diampu (Multi-pilihan)</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                  {kelasList.map(k => {
                    const checked = selectedClasses.includes(k);
                    return (
                      <label key={k} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedClasses([...selectedClasses, k]);
                            else setSelectedClasses(selectedClasses.filter(c => c !== k));
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className="text-xs">{k}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 5. MANAJEMEN KELAS VIEW
// --------------------------------------------------------------------------
function ManajemenKelasView({ kelasList, showToast, onUpdated }: { kelasList: string[]; showToast: any; onUpdated: () => void }) {
  const [newKelas, setNewKelas] = useState('');
  const [masterList, setMasterList] = useState<any[]>([]);

  const loadData = async () => {
    const res = await api.getKelasMaster();
    if (res.success && Array.isArray(res.data)) {
      setMasterList(res.data);
    }
  };

  useEffect(() => {
    loadData();
  }, [kelasList]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKelas.trim()) return;
    try {
      const res = await api.addKelas(newKelas);
      showToast(res.message);
      setNewKelas('');
      onUpdated();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Hapus kelas "${item.nama}"?`)) return;
    try {
      const res = await api.deleteKelas(item.rowIndex);
      showToast(res.message);
      onUpdated();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit">
        <h4 className="font-bold text-sm text-slate-800 mb-3">Tambah Kelas Baru</h4>
        <form onSubmit={handleAdd} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-600 block mb-1">Nama Kelas</label>
            <input
              type="text"
              required
              value={newKelas}
              onChange={(e) => setNewKelas(e.target.value)}
              placeholder="Contoh: VII A, VIII B, IX C"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
          >
            Tambah Kelas
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
          Daftar Kelas Terdaftar ({masterList.length})
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
          {masterList.map((item) => (
            <div key={item.rowIndex} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">{item.nama}</span>
              <button
                onClick={() => handleDelete(item)}
                className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 6. MONITORING VIEW
// --------------------------------------------------------------------------
function MonitoringView({ currentUser, kelasList, showToast }: { currentUser: CurrentUser; kelasList: string[]; showToast: any }) {
  const [data, setData] = useState<any[]>([]);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMonitoring = async () => {
    setLoading(true);
    try {
      const res = await api.getMonitoring(filterKelas);
      if (res.success && Array.isArray(res.data)) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, [filterKelas]);

  const handleStatusChange = async (s: any, newStatus: string) => {
    try {
      await api.updateAbsensiStatus(s.nisn, s.nama, s.kelas, newStatus);
      showToast(`Status ${s.nama} diubah ke ${newStatus}.`);
      loadMonitoring();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filtered = data.filter(s => {
    const matchSearch = s.nama.toLowerCase().includes(search.toLowerCase()) || s.nisn.includes(search);
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Monitoring Presensi Realtime</h3>
          <p className="text-xs text-slate-400">Status kehadiran hari ini diperbarui langsung ke database</p>
        </div>
        <button
          onClick={() => api.exportExcel('monitoring', { kelas: filterKelas })}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">Semua Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">Semua Status</option>
            <option value="Hadir">Hadir</option>
            <option value="Sakit">Sakit</option>
            <option value="Izin">Izin</option>
            <option value="Alpa">Alpa</option>
            <option value="Belum Absen">Belum Absen</option>
          </select>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari siswa..."
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none w-full sm:w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
            <tr>
              <th className="p-3 w-10 text-center">No</th>
              <th className="p-3">Siswa</th>
              <th className="p-3 text-center">Kelas</th>
              <th className="p-3 text-center">Datang</th>
              <th className="p-3 text-center">Pulang</th>
              <th className="p-3 text-center">Keterangan</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s, idx) => (
              <tr key={s.nisn} className="hover:bg-slate-50">
                <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-800">{s.nama}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{s.nisn}</p>
                </td>
                <td className="p-3 text-center font-bold text-slate-600">{s.kelas}</td>
                <td className="p-3 text-center font-mono">{s.jamDatang}</td>
                <td className="p-3 text-center font-mono">{s.jamPulang}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    s.keterangan?.includes('Terlambat') ? 'bg-rose-50 text-rose-600' : 'text-slate-500'
                  }`}>
                    {s.keterangan}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <select
                    value={s.status}
                    onChange={(e) => handleStatusChange(s, e.target.value)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border-0 outline-none ${
                      s.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'Sakit' ? 'bg-amber-100 text-amber-800'
                        : s.status === 'Izin' ? 'bg-blue-100 text-blue-800'
                        : s.status === 'Alpa' ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <option value="Belum Absen">Belum Absen</option>
                    <option value="Hadir">Hadir</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin</option>
                    <option value="Alpa">Alpa</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 7. REKAP BULANAN VIEW (MATRIX 1-31 DAYS)
// --------------------------------------------------------------------------
function RekapBulananView({ kelasList, showToast }: { kelasList: string[]; showToast: any }) {
  const [bulan, setBulan] = useState(new Date().getMonth());
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [kelas, setKelas] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.getMonthlyReport(bulan, tahun, kelas);
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [bulan, tahun, kelas]);

  const handleExport = () => {
    api.exportExcel('laporan_bulanan', { bulan, tahun, kelas });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Rekapitulasi Kehadiran Bulanan</h3>
          <p className="text-xs text-slate-400">Matriks presensi 1 bulan dengan kalkulasi persentase otomatis</p>
        </div>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <select
          value={bulan}
          onChange={(e) => setBulan(Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
        >
          {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          value={tahun}
          onChange={(e) => setTahun(Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={kelas}
          onChange={(e) => setKelas(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
        >
          <option value="">Semua Kelas</option>
          {kelasList.map((k: string) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2 w-8 text-center sticky left-0 bg-slate-100 z-10 border-r border-slate-200">No</th>
              <th className="p-2 w-48 sticky left-8 bg-slate-100 z-10 border-r border-slate-200">Nama Siswa</th>
              {reportData && Array.from({ length: reportData.daysInMonth }, (_, i) => (
                <th key={i + 1} className="p-1 w-6 text-center border-l border-slate-200 text-[10px]">
                  {i + 1}
                </th>
              ))}
              <th className="p-1.5 w-7 text-center bg-emerald-50 text-emerald-800">H</th>
              <th className="p-1.5 w-7 text-center bg-amber-50 text-amber-800">S</th>
              <th className="p-1.5 w-7 text-center bg-blue-50 text-blue-800">I</th>
              <th className="p-1.5 w-7 text-center bg-rose-50 text-rose-800">A</th>
              <th className="p-1.5 w-10 text-center bg-indigo-50 text-indigo-800">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={40} className="p-8 text-center text-slate-400">Mengambil data presensi...</td></tr>
            ) : !reportData || reportData.students.length === 0 ? (
              <tr><td colSpan={40} className="p-8 text-center text-slate-400">Tidak ada data siswa.</td></tr>
            ) : (
              reportData.students.map((s: any, idx: number) => (
                <tr key={s.nisn} className="hover:bg-slate-50">
                  <td className="p-2 text-center text-slate-400 sticky left-0 bg-white border-r border-slate-200">{idx + 1}</td>
                  <td className="p-2 font-bold text-slate-800 sticky left-8 bg-white border-r border-slate-200 truncate max-w-[180px]">
                    {s.nama}
                  </td>
                  {s.dailyCodes.map((d: any) => (
                    <td
                      key={d.date}
                      className={`p-1 text-center border-l border-slate-100 font-bold ${
                        d.isHoliday ? 'bg-rose-50 text-rose-300' :
                        d.code === 'H' ? 'text-emerald-600 bg-emerald-50/20' :
                        d.code === 'S' ? 'text-amber-600 bg-amber-50/20' :
                        d.code === 'I' ? 'text-blue-600 bg-blue-50/20' :
                        d.code === 'A' ? 'text-rose-600 bg-rose-50/20' : 'text-slate-300'
                      }`}
                    >
                      {d.code}
                    </td>
                  ))}
                  <td className="p-1.5 text-center font-bold text-emerald-700 bg-emerald-50/30">{s.stats.h}</td>
                  <td className="p-1.5 text-center font-bold text-amber-700 bg-amber-50/30">{s.stats.s}</td>
                  <td className="p-1.5 text-center font-bold text-blue-700 bg-blue-50/30">{s.stats.i}</td>
                  <td className="p-1.5 text-center font-bold text-rose-700 bg-rose-50/30">{s.stats.a}</td>
                  <td className="p-1.5 text-center font-bold text-indigo-700 bg-indigo-50/30">{s.stats.percent}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 8. ABSENSI SHOLAT VIEW
// --------------------------------------------------------------------------
function AbsensiSholatView({ currentUser, kelasList, showToast }: { currentUser: CurrentUser; kelasList: string[]; showToast: any }) {
  const [selectedWaktu, setSelectedWaktu] = useState('Dzuhur');
  const [selectedKelas, setSelectedKelas] = useState(kelasList[0] || 'VI B');
  const [students, setStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    if (!selectedKelas) return;
    const sRes = await api.getSiswaList(selectedKelas);
    const sholatRes = await api.getSholat(selectedKelas, todayDate, selectedWaktu);
    if (sRes.success && Array.isArray(sRes.data)) {
      setStudents(sRes.data);
      const existing = sholatRes.data || {};
      const initialMap: Record<string, string> = {};
      sRes.data.forEach((s: any) => {
        initialMap[s.nisn] = existing[s.nisn]?.status || 'Hadir';
      });
      setStatusMap(initialMap);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedKelas, selectedWaktu]);

  const handleSave = async () => {
    const list = students.map(s => ({
      nisn: s.nisn,
      nama: s.nama,
      kelas: s.kelas,
      status: statusMap[s.nisn] || 'Hadir',
    }));

    try {
      const res = await api.submitSholat(list, todayDate, selectedWaktu, currentUser.nama || 'Guru');
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-sm text-slate-800">Presensi Sholat Berjamaah</h3>
          <p className="text-xs text-slate-400">Catat kehadiran sholat harian per kelas</p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
        >
          <CheckCircle className="w-4 h-4" /> Simpan Presensi Sholat
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 flex gap-3">
        <select
          value={selectedWaktu}
          onChange={(e) => setSelectedWaktu(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
        >
          {['Subuh', 'Dhuha', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'].map(w => (
            <option key={w} value={w}>Sholat {w}</option>
          ))}
        </select>
        <select
          value={selectedKelas}
          onChange={(e) => setSelectedKelas(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
        >
          {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
            <tr>
              <th className="p-3 w-10 text-center">No</th>
              <th className="p-3">Nama Siswa</th>
              <th className="p-3 text-center">Status Kehadiran Sholat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s, idx) => (
              <tr key={s.nisn} className="hover:bg-slate-50">
                <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    {['Hadir', 'Tidak Hadir', 'Izin / Uzur'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatusMap({ ...statusMap, [s.nisn]: st })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          statusMap[s.nisn] === st
                            ? st === 'Hadir' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 9. JADWAL & LIBUR VIEW
// --------------------------------------------------------------------------
function JadwalLiburView({ showToast }: any) {
  const [config, setConfig] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [tglLibur, setTglLibur] = useState('');
  const [ketLibur, setKetLibur] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Daily schedule state for days 1 to 7 (1=Senin ... 7=Minggu)
  const defaultSchedule: Record<string, { libur: boolean; masuk_mulai: string; masuk_akhir: string; pulang_mulai: string; pulang_akhir: string }> = {
    '1': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '2': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '3': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '4': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '5': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '6': { libur: true,  masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '7': { libur: true,  masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' }
  };

  const [jadwalHarian, setJadwalHarian] = useState<Record<string, any>>(defaultSchedule);

  const dayMeta: Record<string, { name: string; desc: string }> = {
    '1': { name: 'Senin', desc: 'Awal pekan sekolah & upacara bendera' },
    '2': { name: 'Selasa', desc: 'Kegiatan belajar mengajar' },
    '3': { name: 'Rabu', desc: 'Kegiatan belajar mengajar' },
    '4': { name: 'Kamis', desc: 'Kegiatan belajar mengajar' },
    '5': { name: 'Jumat', desc: 'Kegiatan belajar & sholat Jumat berjamaah' },
    '6': { name: 'Sabtu', desc: 'Akhir pekan / ekstrakurikuler' },
    '7': { name: 'Minggu', desc: 'Hari libur akhir pekan' }
  };

  const loadData = async () => {
    try {
      const cRes = await api.getConfig();
      const hRes = await api.getHariLibur();
      if (cRes.success && cRes.data) {
        setConfig(cRes.data);
        if (cRes.data.jadwal_harian) {
          const raw = typeof cRes.data.jadwal_harian === 'string'
            ? JSON.parse(cRes.data.jadwal_harian)
            : cRes.data.jadwal_harian;
          setJadwalHarian((prev) => ({ ...prev, ...raw }));
        }
      }
      if (hRes.success && Array.isArray(hRes.data)) {
        setHolidays(hRes.data);
      }
    } catch (err: any) {
      console.warn('Gagal memuat jadwal & config:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preset: Senin s.d. Jumat Aktif, Sabtu & Minggu Libur
  const applyPresetSeninJumat = () => {
    setJadwalHarian((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= 5; d++) {
        const k = String(d);
        updated[k] = { ...(updated[k] || defaultSchedule[k]), libur: false };
      }
      updated['6'] = { ...(updated['6'] || defaultSchedule['6']), libur: true };
      updated['7'] = { ...(updated['7'] || defaultSchedule['7']), libur: true };
      return updated;
    });
    showToast('Preset diterapkan: Operasional aktif Senin s.d. Jumat (Sabtu & Minggu Libur)', 'info');
  };

  // Preset: Senin s.d. Sabtu Aktif, Minggu Libur
  const applyPresetSeninSabtu = () => {
    setJadwalHarian((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= 6; d++) {
        const k = String(d);
        updated[k] = { ...(updated[k] || defaultSchedule[k]), libur: false };
      }
      updated['7'] = { ...(updated['7'] || defaultSchedule['7']), libur: true };
      return updated;
    });
    showToast('Preset diterapkan: Operasional aktif Senin s.d. Sabtu (Minggu Libur)', 'info');
  };

  // Copy jam masuk & pulang dari Senin ke semua hari aktif
  const copyTimesToAllActive = () => {
    const senin = jadwalHarian['1'] || defaultSchedule['1'];
    setJadwalHarian((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= 7; d++) {
        const k = String(d);
        if (updated[k] && !updated[k].libur) {
          updated[k] = {
            ...updated[k],
            masuk_mulai: senin.masuk_mulai,
            masuk_akhir: senin.masuk_akhir,
            pulang_mulai: senin.pulang_mulai,
            pulang_akhir: senin.pulang_akhir,
          };
        }
      }
      return updated;
    });
    showToast('Jam operasional hari Senin berhasil disalin ke seluruh hari aktif!', 'success');
  };

  // Toggle Aktif / Nonaktif per hari
  const toggleDayStatus = (dayKey: string) => {
    setJadwalHarian((prev) => {
      const current = prev[dayKey] || defaultSchedule[dayKey];
      const nextLibur = !current.libur;
      return {
        ...prev,
        [dayKey]: {
          ...current,
          libur: nextLibur,
        },
      };
    });
  };

  // Update specific time field for a day
  const updateDayTime = (dayKey: string, field: 'masuk_mulai' | 'masuk_akhir' | 'pulang_mulai' | 'pulang_akhir', val: string) => {
    setJadwalHarian((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || defaultSchedule[dayKey]),
        [field]: val,
      },
    }));
  };

  // Save all schedules to backend
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      // Find standard times from active days or Monday
      const senin = jadwalHarian['1'] || defaultSchedule['1'];
      const payload = {
        ...(config || {}),
        jam_masuk_mulai: senin.masuk_mulai || config?.jam_masuk_mulai || '06:00',
        jam_masuk_akhir: senin.masuk_akhir || config?.jam_masuk_akhir || '07:15',
        jam_pulang_mulai: senin.pulang_mulai || config?.jam_pulang_mulai || '15:00',
        jam_pulang_akhir: senin.pulang_akhir || config?.jam_pulang_akhir || '17:00',
        jadwal_harian: jadwalHarian,
      };

      const res = await api.saveConfig(payload);
      if (res.success) {
        showToast('✓ Pengaturan jadwal jam operasional harian berhasil disimpan!', 'success');
        loadData();
      } else {
        showToast(res.message || 'Gagal menyimpan konfigurasi.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tglLibur || !ketLibur) return;
    try {
      await api.addHariLibur(tglLibur, ketLibur);
      showToast('✓ Hari libur khusus berhasil ditambahkan!', 'success');
      setTglLibur('');
      setKetLibur('');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteHoliday = async (tgl: string) => {
    if (!window.confirm(`Hapus hari libur ${tgl}?`)) return;
    try {
      await api.deleteHariLibur(tgl);
      showToast('Hari libur berhasil dihapus.', 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Current day in WIB to highlight
  const currentJsDay = new Date().getDay();
  const currentDayKey = currentJsDay === 0 ? '7' : String(currentJsDay);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white mb-2">
            Pengaturan Operasional
          </span>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-indigo-300" />
            <span>Jadwal Jam Operasional & Hari Aktif Sekolah</span>
          </h2>
          <p className="text-xs text-indigo-100 mt-1 max-w-2xl">
            Atur hari dan jam kerja presensi sekolah. Anda dapat mengaktifkan atau menonaktifkan operasional per hari (Senin s.d. Minggu) dengan tombol switch Aktif/Nonaktif, serta menyesuaikan jam datang dan jam pulang.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2 items-center bg-black/25 p-2 rounded-2xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={applyPresetSeninJumat}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Aktifkan Senin s.d. Jumat saja (Sabtu & Minggu Libur)"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Senin - Jumat Saja (5 Hari)</span>
          </button>
          <button
            type="button"
            onClick={applyPresetSeninSabtu}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Aktifkan Senin s.d. Sabtu (Minggu Libur)"
          >
            <span>Senin - Sabtu (6 Hari)</span>
          </button>
          <button
            type="button"
            onClick={copyTimesToAllActive}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Samakan jam seluruh hari aktif sesuai jam hari Senin"
          >
            <span>Samakan Jam Operasional</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Schedule Panel: Day-by-Day Settings (2 Cols on XL) */}
        <div className="xl:col-span-2 space-y-4">
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Jadwal Harian (Senin s.d. Minggu)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Gunakan tombol switch untuk menentukan hari aktif sekolah atau hari libur rutin.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>SIMPAN SEMUA PERUBAHAN</span>
                    </>
                  )}
                </button>
              </div>

              {/* 7 Days Cards */}
              <div className="space-y-3">
                {['1', '2', '3', '4', '5', '6', '7'].map((dayKey) => {
                  const item = jadwalHarian[dayKey] || defaultSchedule[dayKey];
                  const meta = dayMeta[dayKey];
                  const isLibur = Boolean(item.libur);
                  const isToday = currentDayKey === dayKey;

                  return (
                    <div
                      key={dayKey}
                      className={`p-4 rounded-2xl border transition-all ${
                        isToday ? 'ring-2 ring-indigo-500/20' : ''
                      } ${
                        isLibur
                          ? 'bg-slate-50/70 border-slate-200 opacity-90'
                          : 'bg-white border-emerald-200 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                            isLibur
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {meta.name.substring(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-slate-900">{meta.name}</h4>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 animate-pulse">
                                  Hari Ini
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">{meta.desc}</p>
                          </div>
                        </div>

                        {/* Interactive Toggle Button: Aktif / Nonaktif */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => toggleDayStatus(dayKey)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs ${
                              isLibur
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{isLibur ? '🔴 NONAKTIF (LIBUR)' : '🟢 AKTIF (SEKOLAH)'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Time Pickers (visible if active, muted notice if inactive) */}
                      {!isLibur ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Jam Datang Buka
                            </label>
                            <input
                              type="time"
                              required
                              value={item.masuk_mulai || '06:00'}
                              onChange={(e) => updateDayTime(dayKey, 'masuk_mulai', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-[9px] text-slate-400 block mt-0.5">Mulai scan masuk</span>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Batas Tepat Waktu
                            </label>
                            <input
                              type="time"
                              required
                              value={item.masuk_akhir || '07:15'}
                              onChange={(e) => updateDayTime(dayKey, 'masuk_akhir', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-[9px] text-amber-600 font-semibold block mt-0.5">Lewat = Terlambat</span>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Jam Pulang Buka
                            </label>
                            <input
                              type="time"
                              required
                              value={item.pulang_mulai || '15:00'}
                              onChange={(e) => updateDayTime(dayKey, 'pulang_mulai', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-[9px] text-slate-400 block mt-0.5">Mulai absen pulang</span>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Jam Pulang Batas
                            </label>
                            <input
                              type="time"
                              required
                              value={item.pulang_akhir || '17:00'}
                              onChange={(e) => updateDayTime(dayKey, 'pulang_akhir', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-[9px] text-slate-400 block mt-0.5">Tutup absen pulang</span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 flex items-center justify-between text-xs text-slate-400 bg-slate-100/60 p-2.5 rounded-xl mt-2 border border-slate-200/60">
                          <span className="font-semibold text-rose-600">
                            Hari Libur Rutin: Absensi gerbang sekolah ditutup otomatis pada hari {meta.name}.
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Status: Libur Rutin</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Submit Action */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Perubahan jadwal harian langsung berpengaruh pada scanner kiosk gerbang & status keterlambatan siswa.
                </p>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-200 transition flex items-center gap-2 cursor-pointer"
                >
                  {savingConfig ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>SIMPAN JADWAL OPERASIONAL</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Panel: Hari Libur Nasional & Khusus */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-600" />
                  <span>Daftar Hari Libur Khusus / Nasional</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Kalender cuti bersama atau hari libur tanggal merah
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                {holidays.length} Hari Libur
              </span>
            </div>

            {/* Form Tambah Hari Libur */}
            <form onSubmit={handleAddHoliday} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Tambah Tanggal Libur
              </span>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Tanggal Libur
                </label>
                <input
                  type="date"
                  required
                  value={tglLibur}
                  onChange={(e) => setTglLibur(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Keterangan Libur
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Libur Idul Fitri / Hari Guru"
                  value={ketLibur}
                  onChange={(e) => setKetLibur(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambahkan Hari Libur</span>
              </button>
            </form>

            {/* List of Holidays */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Hari Libur Terdaftar
              </span>

              {holidays.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  Belum ada tanggal libur khusus yang ditambahkan.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                  {holidays.map((h) => (
                    <div
                      key={h.tanggal}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{h.keterangan}</p>
                        <p className="text-[11px] text-rose-600 font-mono mt-0.5">{h.tanggal}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h.tanggal)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Hapus hari libur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 10. PROMOSI / KENAIKAN KELAS
// --------------------------------------------------------------------------
function PromosiView({ kelasList, showToast }: { kelasList: string[]; showToast: any }) {
  const [asal, setAsal] = useState(kelasList[0] || '');
  const [tujuan, setTujuan] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [promoStatuses, setPromoStatuses] = useState<Record<string, 'NAIK' | 'TINGGAL'>>({});

  const loadStudents = async () => {
    if (!asal) return;
    const res = await api.getSiswaList(asal);
    if (res.success && Array.isArray(res.data)) {
      setStudents(res.data);
      const m: Record<string, 'NAIK' | 'TINGGAL'> = {};
      res.data.forEach(s => { m[s.nisn] = 'NAIK'; });
      setPromoStatuses(m);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [asal]);

  const handleExecute = async () => {
    if (!asal || !tujuan) {
      showToast('Pilih kelas asal dan tujuan.', 'error');
      return;
    }

    const promoData = students.map(s => ({
      nisn: s.nisn,
      nama: s.nama,
      status: promoStatuses[s.nisn] || 'NAIK',
    }));

    try {
      const res = await api.processPromotion(asal, tujuan, promoData);
      showToast(res.message);
      loadStudents();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-4">
      <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-indigo-600" /> Proses Kenaikan Kelas & Kelulusan
      </h3>

      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Kelas Asal</label>
          <select
            value={asal}
            onChange={(e) => setAsal(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
          >
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Naik Ke Kelas (Tujuan)</label>
          <select
            value={tujuan}
            onChange={(e) => setTujuan(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700"
          >
            <option value="">-- Pilih Kelas Tujuan --</option>
            <option value="LULUS">🎓 LULUS (Alumni)</option>
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
        {students.map(s => (
          <div key={s.nisn} className="p-3 flex justify-between items-center text-xs">
            <div>
              <p className="font-bold text-slate-800">{s.nama}</p>
              <p className="text-[10px] text-slate-400 font-mono">{s.nisn}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPromoStatuses({ ...promoStatuses, [s.nisn]: 'NAIK' })}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  promoStatuses[s.nisn] === 'NAIK' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Naik / Lulus
              </button>
              <button
                type="button"
                onClick={() => setPromoStatuses({ ...promoStatuses, [s.nisn]: 'TINGGAL' })}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  promoStatuses[s.nisn] === 'TINGGAL' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Tinggal Kelas
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleExecute}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md"
      >
        Proses Kenaikan Kelas Sekarang
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// 11. KARTU DIGITAL SISWA VIEW
// --------------------------------------------------------------------------
function KartuSayaView({ currentUser }: { currentUser: CurrentUser }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (currentUser.nisn) {
      QRCode.toDataURL(currentUser.nisn, { width: 240, margin: 1 }).then(setQrUrl);
    }
  }, [currentUser]);

  return (
    <div className="flex justify-center items-center py-8">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm border border-slate-200">
        <div className="bg-[rgb(26,25,103)] p-6 text-white text-center">
          <h2 className="text-xl font-black tracking-wide">KARTU ABSENSI DIGITAL</h2>
          <p className="text-[10px] uppercase tracking-widest text-indigo-300 mt-1">SMP NEGERI 004 JAMBI</p>
        </div>

        <div className="p-8 text-center bg-slate-50 flex flex-col items-center">
          <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200 mb-4">
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code Siswa" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400">Loading QR...</div>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900">{currentUser.nama}</h3>
          <p className="text-indigo-600 font-mono font-bold text-base mt-1">{currentUser.nisn}</p>
          <span className="inline-block mt-3 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
            Kelas {currentUser.kelas}
          </span>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Arahkan kartu ini ke kamera scanner sekolah untuk melakukan absensi otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
