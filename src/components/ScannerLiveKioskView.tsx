import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  RefreshCw,
  QrCode,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { api } from '../lib/api.ts';

interface SimplePresensiItem {
  nisn: string;
  nama: string;
  kelas?: string;
  jamDatang: string;
  jamPulang?: string;
  status?: string;
  keterangan?: string;
}

interface ScannerLiveKioskViewProps {
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  kelasList?: string[];
}

export default function ScannerLiveKioskView({
  onClose,
  showToast,
}: ScannerLiveKioskViewProps) {
  const [mode, setMode] = useState<'masuk' | 'pulang'>('masuk');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualNisn, setManualNisn] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Attendance feed: strictly Nama Siswa & Jam Datang
  const [presensiList, setPresensiList] = useState<SimplePresensiItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Latest Scan Announcement Card
  const [lastScanResult, setLastScanResult] = useState<{
    nama: string;
    jam: string;
    message: string;
    success: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);
  const modeRef = useRef<'masuk' | 'pulang'>(mode);
  const scanResultTimerRef = useRef<any>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    return () => {
      if (scanResultTimerRef.current) clearTimeout(scanResultTimerRef.current);
    };
  }, []);

  // Real-time clock updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance records (filtered to students with arrival time)
  const fetchTodayFeed = async () => {
    try {
      setLoadingList(true);
      const res = await api.getMonitoring('SEMUA');
      if (res && res.success && Array.isArray(res.data)) {
        // Filter students who have arrived today
        const attended = res.data
          .filter((item: any) => item.jamDatang && item.jamDatang !== '-')
          .map((item: any) => ({
            nisn: item.nisn,
            nama: item.nama,
            kelas: item.kelas,
            jamDatang: item.jamDatang,
            jamPulang: item.jamPulang !== '-' ? item.jamPulang : '',
            status: item.status,
            keterangan: item.keterangan,
          }));

        // Sort latest arrived on top
        attended.sort((a: any, b: any) => (b.jamDatang || '').localeCompare(a.jamDatang || ''));
        setPresensiList(attended);
      }
    } catch (e) {
      console.warn('Gagal memuat feed presensi:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchTodayFeed();
    // Auto-refresh feed every 6 seconds to capture multi-device check-ins
    const interval = setInterval(fetchTodayFeed, 6000);
    return () => clearInterval(interval);
  }, [mode]);

  // Audio synthesizer beep
  const playBeep = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  // Process Scanned NISN
  const handleProcessScan = async (rawNisn: string) => {
    const clean = rawNisn.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!clean) return;

    const activeMode = modeRef.current; // ALWAYS read the active mode (masuk / pulang)
    try {
      const nowObj = new Date();
      const clientTime = nowObj.toLocaleTimeString('en-GB', { hour12: false });
      const clientDate = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
      const res = await api.scanAbsensi(clean, 'guru', '', activeMode, clientTime, clientDate);
      const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

      if (res && res.success) {
        playBeep(true);
        const studentName = res.nama || 'Siswa Terdaftar';
        const displayJam = (activeMode === 'pulang' ? (res.jamPulang ? res.jamPulang.substring(0, 5) + ' WIB' : jamNow) : (res.jamDatang ? res.jamDatang.substring(0, 5) + ' WIB' : jamNow));

        setLastScanResult({
          nama: studentName,
          jam: displayJam,
          message: res.message || (activeMode === 'pulang' ? 'Absen Pulang Berhasil' : 'Presensi Datang Berhasil'),
          success: true,
        });

        // Prepend or update immediately in attendance list
        setPresensiList((prev) => {
          const exists = prev.some((p) => p.nisn === clean);
          if (exists) {
            return prev.map((p) => {
              if (p.nisn !== clean) return p;
              if (activeMode === 'pulang') {
                return {
                  ...p,
                  jamPulang: (res.jamPulang ? res.jamPulang.substring(0, 5) : displayJam.substring(0, 5)),
                  keterangan: res.message || p.keterangan,
                };
              }
              return { ...p, jamDatang: displayJam.substring(0, 5) };
            });
          }
          return [
            {
              nisn: clean,
              nama: studentName,
              kelas: res.kelas || '',
              jamDatang: res.jamDatang ? res.jamDatang.substring(0, 5) : (activeMode === 'masuk' ? displayJam.substring(0, 5) : '-'),
              jamPulang: activeMode === 'pulang' ? (res.jamPulang ? res.jamPulang.substring(0, 5) : displayJam.substring(0, 5)) : '',
              status: 'Hadir',
              keterangan: res.message || '',
            },
            ...prev,
          ];
        });

        showToast(`✓ ${studentName}: ${res.message || 'Presensi berhasil'}`);
      } else {
        playBeep(false);
        setLastScanResult({
          nama: res?.nama || `NISN: ${clean}`,
          jam: jamNow,
          message: res?.message || 'Presensi Gagal / Tidak Memenuhi Syarat',
          success: false,
        });
      }
    } catch (err: any) {
      playBeep(false);
      setLastScanResult({
        nama: `NISN: ${clean}`,
        jam: '',
        message: err.message || 'Koneksi ke database gagal',
        success: false,
      });
    } finally {
      // Clear announcement banner after 4 seconds (rentang 3-5 detik)
      if (scanResultTimerRef.current) {
        clearTimeout(scanResultTimerRef.current);
      }
      scanResultTimerRef.current = setTimeout(() => {
        setLastScanResult(null);
      }, 4000);
    }
  };

  // Camera Management
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    isScanningRef.current = false;
  };

  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      isScanningRef.current = true;

      let lastScannedData = '';
      let lastScannedTimestamp = 0;

      const scanLoop = () => {
        if (!isScanningRef.current || !videoRef.current) return;
        const video = videoRef.current;

        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
          }
          const canvas = canvasRef.current;
          const w = video.videoWidth;
          const h = video.videoHeight;
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const qrCode = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });

            if (qrCode && qrCode.data) {
              const now = Date.now();
              // Prevent duplicate triggers within 2.5 seconds for same code
              if (qrCode.data !== lastScannedData || now - lastScannedTimestamp > 2500) {
                lastScannedData = qrCode.data;
                lastScannedTimestamp = now;
                handleProcessScan(qrCode.data);
              }
            }
          }
        }

        if (isScanningRef.current) {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }
      };

      animFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn('Gagal mengakses kamera:', err);
      showToast('Kamera tidak dapat diaktifkan: ' + (err.message || 'Izin ditolak'), 'error');
      setCameraActive(false);
    }
  };

  // Auto-start camera when kiosk view mounts
  useEffect(() => {
    startCamera(cameraFacing);
    return () => {
      stopCamera();
    };
  }, [cameraFacing]);

  // MC26 USB Barcode Gun Listener (HID Keyboard input)
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).id !== 'kiosk-barcode-input') {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 250) barcodeBuffer = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim().length >= 4) {
          handleProcessScan(barcodeBuffer.trim());
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1 && /^[0-9a-zA-Z]$/.test(e.key)) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
  };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 flex flex-col select-none">
      {/* Kiosk Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm md:text-base text-white tracking-wide">
                Scanner Kamera Live Gerbang Sekolah
              </h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Realtime
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Arahkan QR Kartu Siswa ke kamera live atau gunakan Barcode Scanner USB (MC26).
            </p>
          </div>
        </div>

        {/* Mode Selector, Sound Toggle & Exit */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800/80 p-1 rounded-xl flex border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setMode('masuk')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'masuk'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Absen Masuk
            </button>
            <button
              onClick={() => setMode('pulang')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                mode === 'pulang'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" /> Absen Pulang
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700 cursor-pointer"
            title={soundEnabled ? 'Matikan Suara Beep' : 'Nyalakan Suara Beep'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-rose-900/30 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Kembali ke Halaman Login</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Layout: Flat view (Live Camera on Left, Simple Feed on Right) */}
      <main className="flex-1 min-h-0 p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 overflow-hidden">
        {/* Left Column: Live Camera Section (7 Cols on desktop) */}
        <section className="lg:col-span-7 flex flex-col gap-2.5 min-h-0 h-full overflow-hidden">
          <div className="relative flex-1 min-h-0 bg-black rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
            {/* Live HTML5 Video Element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
              autoPlay
            />

            {/* Target Viewfinder Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                <div
                  className={`relative w-56 h-56 sm:w-72 sm:h-72 border-2 rounded-3xl backdrop-brightness-105 flex items-center justify-center transition-colors duration-300 ${
                    mode === 'pulang'
                      ? 'border-orange-500/70 shadow-[0_0_50px_rgba(249,115,22,0.25)]'
                      : 'border-emerald-400/60 shadow-[0_0_50px_rgba(16,185,129,0.15)]'
                  }`}
                >
                  {/* Viewfinder Corners */}
                  <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl ${mode === 'pulang' ? 'border-orange-400' : 'border-emerald-400'}`}></div>
                  <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl ${mode === 'pulang' ? 'border-orange-400' : 'border-emerald-400'}`}></div>
                  <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl ${mode === 'pulang' ? 'border-orange-400' : 'border-emerald-400'}`}></div>
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-xl ${mode === 'pulang' ? 'border-orange-400' : 'border-emerald-400'}`}></div>

                  {/* Laser Beam Animation */}
                  <div
                    className={`absolute inset-x-3 top-2 h-1 bg-gradient-to-r from-transparent to-transparent animate-pulse ${
                      mode === 'pulang'
                        ? 'via-orange-400 shadow-[0_0_15px_#fb923c]'
                        : 'via-emerald-400 shadow-[0_0_15px_#34d399]'
                    }`}
                  ></div>

                  <p className="text-white/90 font-bold text-xs bg-black/75 px-3 py-1.5 rounded-full backdrop-blur-xs border border-white/10 flex items-center gap-1.5">
                    {mode === 'pulang' ? (
                      <>
                        <LogOut className="w-3.5 h-3.5 text-orange-400" />
                        <span>Posisikan QR Kartu (Scan Pulang)</span>
                      </>
                    ) : (
                      <span>Posisikan QR Kartu di Kotak Ini</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Inactive Camera State */}
            {!cameraActive && (
              <div className="text-center p-6 text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Kamera Live Sedang Ditutup</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Klik tombol di bawah untuk mengaktifkan kembali pemindai kamera live.
                  </p>
                </div>
                <button
                  onClick={() => startCamera(cameraFacing)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition inline-flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Buka Kamera Live Sekarang
                </button>
              </div>
            )}

            {/* Camera Floating Controls */}
            {cameraActive && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={toggleCameraFacing}
                  className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl transition border border-white/10 cursor-pointer"
                  title="Putar Kamera (Depan / Belakang)"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={stopCamera}
                  className="p-2 bg-rose-600/80 hover:bg-rose-600 backdrop-blur-md text-white rounded-xl transition cursor-pointer"
                  title="Tutup Kamera"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Live Scan Notification Toast Banner - Dipindahkan ke ATAS RATA TENGAH layar kamera dengan ukuran tulisan besar & jelas */}
            {lastScanResult && (
              <div
                className={`absolute top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-lg z-30 p-3.5 md:p-4 rounded-2xl backdrop-blur-md border shadow-2xl transition-all transform animate-in fade-in zoom-in-95 text-center flex flex-col items-center justify-center ${
                  lastScanResult.success
                    ? mode === 'pulang'
                      ? 'bg-orange-950/95 border-orange-500 text-orange-100 shadow-[0_0_35px_rgba(249,115,22,0.4)]'
                      : 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-[0_0_35px_rgba(16,185,129,0.4)]'
                    : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-[0_0_35px_rgba(244,63,94,0.4)]'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      lastScanResult.success
                        ? mode === 'pulang'
                          ? 'bg-orange-500 text-white'
                          : 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {lastScanResult.success ? (
                      mode === 'pulang' ? <LogOut className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 font-black" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <span className="font-extrabold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/40">
                    {lastScanResult.success
                      ? (mode === 'pulang' ? 'Presensi Pulang Berhasil' : 'Presensi Datang Berhasil')
                      : 'Presensi Gagal'}
                  </span>
                  {lastScanResult.jam && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/50 text-white">
                      {lastScanResult.jam}
                    </span>
                  )}
                </div>

                {/* Teks Nama Siswa Dibuat Besar dan Terlihat Jelas */}
                <h3 className="font-black text-lg md:text-2xl text-white tracking-wide truncate max-w-full drop-shadow-sm">
                  {lastScanResult.nama}
                </h3>
                <p className="text-xs md:text-sm font-semibold opacity-95 mt-0.5">
                  {lastScanResult.message}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Bar: Manual NISN Input + USB MC26 Barcode Helper */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full flex items-center gap-2">
              <input
                id="kiosk-barcode-input"
                type="text"
                value={manualNisn}
                onChange={(e) => setManualNisn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleProcessScan(manualNisn);
                    setManualNisn('');
                  }
                }}
                placeholder={mode === 'pulang' ? 'Scan Absen Pulang: Input NISN / Scanner USB MC26...' : 'Input NISN Manual / Arahkan Scanner USB MC26...'}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  handleProcessScan(manualNisn);
                  setManualNisn('');
                }}
                className={`px-4 py-2.5 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  mode === 'pulang' ? 'bg-orange-600 hover:bg-orange-500 active:scale-95' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                }`}
              >
                <span>{mode === 'pulang' ? 'Scan Pulang' : 'Scan'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-slate-400 shrink-0 font-medium hidden sm:block">
              {currentDateStr} • <span className="font-mono text-emerald-400 font-bold">{currentTime}</span>
            </div>
          </div>
        </section>

        {/* Right Column: Attendance List strictly containing: Nama Siswa & Jam Datang / Jam Pulang */}
        <section className="lg:col-span-5 flex flex-col min-h-0 h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'pulang' ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                {mode === 'pulang' ? <LogOut className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                  {mode === 'pulang' ? 'Daftar Presensi Pulang' : 'Daftar Hadir Hari Ini'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {mode === 'pulang' ? 'Menampilkan status siswa & jam kepulangan' : 'Hanya menampilkan Nama Siswa & Jam Datang'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === 'pulang' ? (
                <>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    {presensiList.filter(p => Boolean(p.jamPulang)).length} Pulang
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {presensiList.length} Hadir
                  </span>
                </>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {presensiList.length} Hadir
                </span>
              )}
              <button
                onClick={fetchTodayFeed}
                className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition"
                title="Perbarui Daftar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Simple Table: strictly Nama Siswa & Jam Datang / Jam Pulang */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 backdrop-blur-xs border-b border-slate-800 z-10">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Nama Siswa</th>
                  {mode === 'pulang' ? (
                    <>
                      <th className="p-3 text-center">Datang</th>
                      <th className="p-3 text-right">Jam Pulang</th>
                    </>
                  ) : (
                    <th className="p-3 text-right">Jam Datang</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {presensiList.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'pulang' ? 4 : 3} className="p-10 text-center text-slate-500">
                      {loadingList ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                          <span>Memuat daftar hadir hari ini...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Clock className="w-8 h-8 mx-auto opacity-30 text-slate-400 mb-2" />
                          <p className="font-bold text-slate-400">Belum ada siswa yang hadir hari ini</p>
                          <p className="text-[11px] text-slate-500">
                            Arahkan QR kartu siswa ke kamera untuk mencatat presensi.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  presensiList.map((item, idx) => (
                    <tr
                      key={item.nisn}
                      className={`hover:bg-slate-800/40 transition ${
                        idx === 0
                          ? mode === 'pulang' && item.jamPulang
                            ? 'bg-orange-950/30'
                            : 'bg-emerald-950/30'
                          : ''
                      }`}
                    >
                      <td className="p-3 text-center font-mono text-slate-500 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white text-xs md:text-sm">
                          {item.nama}
                        </div>
                        {item.kelas && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Kelas: {item.kelas}
                          </div>
                        )}
                      </td>
                      {mode === 'pulang' ? (
                        <>
                          <td className="p-3 text-center font-mono text-slate-400 text-xs">
                            {item.jamDatang || '-'}
                          </td>
                          <td className="p-3 text-right">
                            {item.jamPulang ? (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 font-mono font-bold text-xs text-orange-400">
                                {item.jamPulang}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Belum Pulang
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="p-3 text-right">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 font-mono font-bold text-xs text-emerald-400">
                            {item.jamDatang}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <span>Mode Saat Ini: <strong className="text-white capitalize">{mode === 'masuk' ? 'Datang' : 'Pulang'}</strong></span>
            <span>Total Siswa Tercatat: <strong className="text-emerald-400 font-mono">{presensiList.length}</strong></span>
          </div>
        </section>
      </main>
    </div>
  );
}
