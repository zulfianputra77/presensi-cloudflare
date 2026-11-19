import React, { useState, useEffect } from 'react';
import {
  Globe,
  Server,
  Cloud,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  X,
  FileCode,
  Layers,
  Cpu,
  Database,
  ExternalLink,
  Lock,
  ArrowRight,
  RefreshCw,
  Zap
} from 'lucide-react';

interface PanduanDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PanduanDeployModal({ isOpen, onClose }: PanduanDeployModalProps) {
  const [activeTab, setActiveTab] = useState<'supabase' | 'vercel' | 'ringkasan' | 'vps' | 'cloudrun' | 'paas' | 'konfigurasi'>('supabase');
  const [activeConfigFile, setActiveConfigFile] = useState<'supabase_env' | 'supabase_sql' | 'npmrc' | 'vercel' | 'env' | 'nginx' | 'pm2'>('supabase_env');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Database Connection Status
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [checkingDb, setCheckingDb] = useState(false);

  const checkDatabaseConnection = async () => {
    setCheckingDb(true);
    try {
      const res = await fetch('/api/database/status');
      const data = await res.json();
      setDbStatus(data);
    } catch {
      setDbStatus({ connected: false, provider: 'Koneksi API Gagal' });
    } finally {
      setCheckingDb(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkDatabaseConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const configFiles = {
    supabase_env: {
      name: '.env (Supabase Connection URI)',
      desc: 'Konfigurasi environment variabel untuk menghubungkan aplikasi ke Supabase Cloud Database',
      code: `# PORT APLIKASI
PORT=3000
NODE_ENV=production

# KONEKSI RESMI SUPABASE POSTGRESQL (Ganti password & project ref sesuai project Anda):
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD-ANDA]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Atau gunakan parameter terpisah:
# SQL_HOST="db.[PROJECT-REF].supabase.co"
# SQL_PORT=5432
# SQL_USER="postgres"
# SQL_PASSWORD="[PASSWORD-ANDA]"
# SQL_DB_NAME="postgres"
# SQL_SSL=true

# DOMAIN RESMI APLIKASI ANDA (HTTPS WAJIB UNTUK KAMERA):
APP_URL="https://absensi.sekolah.sch.id"`,
    },
    supabase_sql: {
      name: 'supabase_schema.sql (SQL Editor Supabase)',
      desc: 'Salin script SQL ini ke menu SQL Editor di Dashboard Supabase untuk membuat semua tabel & data awal',
      code: `-- ====================================================================
-- SKEMA DATABASE SISTEM ABSENSI SEKOLAH PINTAR (SUPABASE POSTGRESQL)
-- Salin dan tempelkan seluruh kode ini ke Supabase Dashboard:
-- Masuk ke project Supabase Anda -> Menu "SQL Editor" -> "New Query" -> Run
-- ====================================================================

-- 1. TABEL PENGGUNA (USERS)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nama TEXT,
    kelas TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABEL KELAS
CREATE TABLE IF NOT EXISTS kelas (
    id SERIAL PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE,
    urutan INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL SISWA
CREATE TABLE IF NOT EXISTS siswa (
    id SERIAL PRIMARY KEY,
    nisn TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    jenis_kelamin TEXT,
    tanggal_lahir TEXT,
    agama TEXT,
    nama_ayah TEXT,
    nama_ibu TEXT,
    no_hp TEXT,
    kelas TEXT NOT NULL,
    alamat TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON siswa(nisn);

-- 4. TABEL PRESENSI (ABSENSI MASUK & PULANG)
CREATE TABLE IF NOT EXISTS absensi (
    id SERIAL PRIMARY KEY,
    tanggal TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    jam_datang TEXT DEFAULT '',
    jam_pulang TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    status TEXT NOT NULL,
    jam_sholat TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absensi_tgl_nisn ON absensi(tanggal, nisn);
CREATE INDEX IF NOT EXISTS idx_absensi_tgl_kelas ON absensi(tanggal, kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);

-- 5. TABEL PRESENSI SHOLAT
CREATE TABLE IF NOT EXISTS absensi_sholat (
    id SERIAL PRIMARY KEY,
    tanggal TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    waktu_sholat TEXT NOT NULL,
    status TEXT NOT NULL,
    keterangan TEXT DEFAULT '',
    input_oleh TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sholat_tgl_waktu ON absensi_sholat(tanggal, waktu_sholat, kelas);

-- 6. TABEL HARI LIBUR
CREATE TABLE IF NOT EXISTS hari_libur (
    id SERIAL PRIMARY KEY,
    tanggal TEXT NOT NULL UNIQUE,
    keterangan TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABEL KONFIGURASI
CREATE TABLE IF NOT EXISTS konfigurasi (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    keterangan TEXT
);

-- 8. TABEL LOG NOTIFIKASI WA ALPA
CREATE TABLE IF NOT EXISTS log_notifikasi_wa (
    id SERIAL PRIMARY KEY,
    waktu_dikirim TEXT NOT NULL,
    tanggal_absensi TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Sudah Dikirim',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_wa_tgl_nisn ON log_notifikasi_wa(tanggal_absensi, nisn);

-- 9. TABEL SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    identifier TEXT NOT NULL,
    role TEXT NOT NULL,
    nama TEXT,
    kelas TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- ====================================================================
-- SEED DATA AWAL (DEMO & AKUN RESMI)
-- ====================================================================

-- DATA AWAL DEFAULT (ADMIN & GURU)
INSERT INTO users (username, password, role, nama, kelas)
VALUES 
    ('admin', 'admin123', 'admin', 'Administrator Sekolah', ''),
    ('guru1', 'guru123', 'guru', 'Guru Wali Kelas VII', 'VII A,VII B'),
    ('wakel', 'wakel123', 'wakel', 'Wakil Kepala Sekolah', '')
ON CONFLICT (username) DO NOTHING;

-- DATA MASTER KELAS
INSERT INTO kelas (nama, urutan)
VALUES 
    ('VII A', 1),
    ('VII B', 2),
    ('VII C', 3),
    ('VIII A', 4),
    ('VIII B', 5),
    ('IX A', 6),
    ('IX B', 7)
ON CONFLICT (nama) DO NOTHING;

-- DATA SISWA CONTOH
INSERT INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat)
VALUES 
    ('1234567890', 'Ahmad Rizki', 'Laki-laki', '2010-05-15', 'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890', 'VII A', 'Jl. Merdeka No. 10, Jambi'),
    ('1234567891', 'Siti Nurhaliza', 'Perempuan', '2010-08-20', 'Islam', 'Usman', 'Farida', '081298765432', 'VII A', 'Jl. Sudirman No. 25, Jambi'),
    ('1234567892', 'Budi Santoso', 'Laki-laki', '2010-03-12', 'Islam', 'Joko', 'Sri Rahayu', '081345678901', 'VII B', 'Jl. Pahlawan No. 7, Jambi'),
    ('1234567893', 'Dewi Sartika', 'Perempuan', '2010-11-04', 'Islam', 'Hendra', 'Ratna', '081278901234', 'VII B', 'Jl. Melati No. 15, Jambi'),
    ('1234567894', 'Kevin Pratama', 'Laki-laki', '2010-07-22', 'Kristen', 'Daniel', 'Maria', '081389012345', 'VII C', 'Jl. Kenanga No. 8, Jambi'),
    ('1234567895', 'Rian Ardiansyah', 'Laki-laki', '2009-02-18', 'Islam', 'Herman', 'Yuliana', '081290123456', 'VIII A', 'Jl. Anggrek No. 12, Jambi'),
    ('1234567896', 'Putri Ayu', 'Perempuan', '2009-09-30', 'Islam', 'Suhartono', 'Endang', '081301234567', 'VIII B', 'Jl. Mawar No. 3, Jambi')
ON CONFLICT (nisn) DO NOTHING;

-- KONFIGURASI JAM OPERASIONAL ABSENSI
INSERT INTO konfigurasi (key, value, keterangan)
VALUES 
    ('jam_masuk_mulai', '06:00', 'Jam buka absensi datang'),
    ('jam_masuk_akhir', '07:15', 'Batas jam tepat waktu masuk'),
    ('jam_pulang_mulai', '15:00', 'Jam mulai absensi pulang'),
    ('jam_pulang_akhir', '17:00', 'Batas tutup absensi pulang'),
    ('mode_absen', 'masuk_pulang', 'Mode absensi: masuk_pulang'),
    ('jadwal_harian', '{"1":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"2":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"3":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"4":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"5":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"6":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"7":{"libur":true,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"}}', 'Jadwal harian')
ON CONFLICT (key) DO NOTHING;`,
    },
    npmrc: {
      name: '.npmrc (Vercel Fix ERESOLVE)',
      desc: 'File konfigurasi npm untuk mencegah error peer dependency (ERESOLVE) saat Vercel build',
      code: `legacy-peer-deps=true`,
    },
    vercel: {
      name: 'vercel.json (Konfigurasi Resmi Vercel)',
      desc: 'File konfigurasi Vercel untuk routing serverless function Express dan SPA React Vite',
      code: `{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ]
}`,
    },
    env: {
      name: '.env.production (VPS Lokal)',
      desc: 'Konfigurasi jika Anda menggunakan database PostgreSQL lokal di VPS Ubuntu sendiri',
      code: `PORT=3000
NODE_ENV=production

SQL_HOST=127.0.0.1
SQL_PORT=5432
SQL_USER=absensi_user
SQL_PASSWORD=PasswordSuperAman123!
SQL_DB_NAME=absensi_db
SQL_SSL=false

APP_URL=https://absensi.smpn4jambi.sch.id`,
    },
    nginx: {
      name: '/etc/nginx/sites-available/absensi',
      desc: 'Konfigurasi Nginx Reverse Proxy (Port 80/443 -> Port 3000 + Support Kamera & WebSockets)',
      code: `server {
    listen 80;
    server_name absensi.sekolah.sch.id;
    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}`,
    },
    pm2: {
      name: 'ecosystem.config.cjs',
      desc: 'Konfigurasi PM2 Process Manager agar server berjalan 24/7 dan auto-restart',
      code: `module.exports = {
  apps: [
    {
      name: 'absensi-sekolah',
      script: 'server.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};`,
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shrink-0">
              <Zap className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Supabase & Cloud Deploy Guide
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">PostgreSQL Managed</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Panduan Koneksi Supabase & Publikasi Aplikasi Online
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Database Status Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500">Status Database:</span>
            {dbStatus ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                dbStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span>{dbStatus.provider}</span>
              </span>
            ) : (
              <span className="text-slate-400">Memeriksa status...</span>
            )}
            {dbStatus && !dbStatus.connected && dbStatus.lastError && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                {dbStatus.lastError}
              </span>
            )}
          </div>

          <button
            onClick={checkDatabaseConnection}
            disabled={checkingDb}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition self-end sm:self-auto"
          >
            <RefreshCw className={`w-3 h-3 ${checkingDb ? 'animate-spin' : ''}`} />
            <span>Tes Ulang Koneksi</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2.5 overflow-x-auto gap-2 shrink-0 scrollbar-none">
          {[
            { id: 'supabase', label: '⚡ 1. Database Supabase', icon: <Database className="w-3.5 h-3.5 text-emerald-600" /> },
            { id: 'vercel', label: '▲ 2. Deploy ke Vercel (Paling Mudah)', icon: <ExternalLink className="w-3.5 h-3.5 text-black" /> },
            { id: 'ringkasan', label: '3. Syarat SSL & Kamera', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { id: 'paas', label: '4. Railway / Render', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'vps', label: '5. VPS Ubuntu', icon: <Server className="w-3.5 h-3.5" /> },
            { id: 'cloudrun', label: '6. Google Cloud Run', icon: <Cloud className="w-3.5 h-3.5" /> },
            { id: 'konfigurasi', label: '7. Script SQL & Config', icon: <FileCode className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 px-3 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-700 text-xs leading-relaxed bg-white">
          {/* TAB 1: SUPABASE DETAIL */}
          {activeTab === 'supabase' && (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                <h4 className="font-bold text-emerald-900 text-sm mb-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Mengapa Menyimpan Database ke Supabase?
                </h4>
                <p className="text-emerald-800 text-xs">
                  Supabase menyediakan database <strong>PostgreSQL Cloud Managed Gratis</strong> dengan performa tinggi. Anda tidak perlu mengelola server database lokal, aman dari kehilangan data, kapasitas hingga 500 MB (ribuan siswa), dan dapat langsung dibuka di browser!
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                    <h5 className="font-bold text-slate-900 text-xs">Buat Akun & Project Baru di Supabase</h5>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                    <li>Buka <strong><a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">https://supabase.com</a></strong> lalu klik <em>Start your project</em> (login pakai GitHub atau Email).</li>
                    <li>Klik <strong>New Project</strong>.</li>
                    <li>Isi <strong>Project Name</strong> (misal: <code>absensi-sekolah</code>).</li>
                    <li>Masukkan <strong>Database Password</strong> dan <strong>CATAT PASSWORD TERSEBUT</strong>.</li>
                    <li>Pilih Region <strong>Singapore (ap-southeast-1)</strong> agar akses dari Indonesia sangat cepat.</li>
                    <li>Pilih <strong>Free Plan</strong> ($0) lalu klik <strong>Create new project</strong>. Tunggu 1 menit hingga database siap.</li>
                  </ol>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                      <h5 className="font-bold text-slate-900 text-xs">Jalankan Skema Tabel di Supabase SQL Editor</h5>
                    </div>
                    <button
                      onClick={() => handleCopy(configFiles.supabase_sql.code, 'supabase_sql_direct')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedKey === 'supabase_sql_direct' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Kode SQL Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Kode SQL (1-Klik)</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-slate-600">
                    Klik tombol <strong>"Salin Kode SQL"</strong> di atas, lalu tempelkan (*paste*) ke SQL Editor di Supabase:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                    <li>Di dashboard Supabase, klik menu <strong>SQL Editor</strong> di bilah kiri (ikon <code>&gt;_</code>).</li>
                    <li>Klik <strong>New Query</strong>.</li>
                    <li>Tempelkan (*paste*) kode SQL yang sudah disalin di bawah ini.</li>
                    <li>Klik tombol hijau <strong>Run</strong> (atau tekan <code>Ctrl + Enter</code>).</li>
                    <li>Selesai! Tabel <code>users</code>, <code>siswa</code>, <code>kelas</code>, <code>absensi</code>, <code>hari_libur</code>, dan konfigurasi otomatis terbentuk.</li>
                  </ol>

                  {/* Preview SQL Code Box */}
                  <div className="relative mt-2">
                    <div className="flex items-center justify-between bg-slate-800 text-slate-300 px-3 py-1.5 rounded-t-xl text-[10px] font-mono">
                      <span>supabase_schema.sql (9 Tabel + Index + Seed Data)</span>
                      <span>PostgreSQL 15/16</span>
                    </div>
                    <pre className="bg-slate-900 text-emerald-400 p-3 rounded-b-xl overflow-x-auto text-[10px] font-mono max-h-48 leading-relaxed border border-slate-800">
                      {configFiles.supabase_sql.code}
                    </pre>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                    <h5 className="font-bold text-slate-900 text-xs">Ambil Connection String & Masukkan ke .env</h5>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                    <li>Di Supabase, buka menu <strong>Project Settings</strong> (ikon gerigi) ➔ <strong>Database</strong>.</li>
                    <li>Gulir ke bawah ke bagian <strong>Connection string</strong> ➔ Pilih tab <strong>URI</strong> (Mode: Transaction Pooler atau Session).</li>
                    <li>Salin URI tersebut, ganti <code>[YOUR-PASSWORD]</code> dengan password database Anda.</li>
                    <li>Masukkan ke file <code>.env</code> di aplikasi Anda:</li>
                  </ol>
                  <pre className="bg-slate-900 text-emerald-300 p-3 rounded-xl overflow-x-auto text-[11px] font-mono">
DATABASE_URL="postgresql://postgres.xxx:PasswordAnda123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
                  </pre>
                  <p className="text-[11px] text-slate-500">
                    *Aplikasi otomatis mendeteksi Supabase dan mengaktifkan enkripsi SSL (<code>ssl: &#123; rejectUnauthorized: false &#125;</code>) tanpa perlu konfigurasi tambahan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPLOY KE VERCEL (UTAMA) */}
          {activeTab === 'vercel' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black tracking-wider">▲ VERCEL CLOUD DEPLOYMENT</span>
                    <span className="bg-emerald-500 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase">
                      Siap Pakai 100%
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    File <code>vercel.json</code> dan <code>api/index.ts</code> sudah dikonfigurasi dan diuji bebas error.
                  </p>
                </div>
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-white text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-slate-100 transition shrink-0"
                >
                  <span>Buka Vercel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                    <h5 className="font-bold text-slate-900 text-xs">Upload / Push Project ke Akun GitHub Anda</h5>
                  </div>
                  <p className="text-slate-600 pl-8">
                    Pastikan seluruh folder project aplikasi ini (termasuk <code>vercel.json</code>, <code>api/index.ts</code>, dan <code>supabase_schema.sql</code>) sudah di-push ke repositori GitHub pribadi/sekolah Anda.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                    <h5 className="font-bold text-slate-900 text-xs">Import Project di Dashboard Vercel</h5>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-8">
                    <li>Buka <strong><a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">https://vercel.com</a></strong> dan login dengan akun GitHub Anda.</li>
                    <li>Di dashboard utama, klik tombol <strong>"Add New..."</strong> ➔ pilih <strong>"Project"</strong>.</li>
                    <li>Cari nama repositori GitHub aplikasi absensi Anda, lalu klik tombol <strong>"Import"</strong>.</li>
                  </ol>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                    <h5 className="font-bold text-slate-900 text-xs">Atur Framework Preset & Build Settings</h5>
                  </div>
                  <p className="text-slate-600 pl-8">
                    Vercel otomatis mendeteksi konfigurasi berikut (tidak perlu diubah):
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 font-mono text-[11px] pl-8">
                    <li>Framework Preset: <strong>Vite</strong></li>
                    <li>Build Command: <code>npm run build</code></li>
                    <li>Output Directory: <code>dist</code></li>
                    <li>Install Command: <code>npm install --legacy-peer-deps</code> <em>(Aktifkan override jika muncul error ERESOLVE)</em></li>
                  </ul>
                  <div className="mt-2 ml-8 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    <strong>💡 Tips Bebas Error Vercel:</strong> File <code>.npmrc</code> (berisi <code>legacy-peer-deps=true</code>) sudah disediakan di project ini. Jika Vercel memunculkan <code>ERESOLVE could not resolve</code>, cukup atur <strong>Install Command</strong> di atas menjadi <code>npm install --legacy-peer-deps</code>.
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">4</span>
                    <h5 className="font-bold text-slate-900 text-xs">Tambahkan Environment Variables (Koneksi Supabase)</h5>
                  </div>
                  <p className="text-slate-600 pl-8">
                    Sebelum klik Deploy, buka dropdown <strong>"Environment Variables"</strong> di halaman Vercel dan tambahkan:
                  </p>
                  <div className="pl-8 space-y-2">
                    <div className="bg-slate-900 p-3 rounded-xl font-mono text-[11px] space-y-1 text-slate-200">
                      <div><span className="text-indigo-400">Key:</span> <code>DATABASE_URL</code></div>
                      <div><span className="text-indigo-400">Value:</span> <code className="text-emerald-300">postgresql://postgres.xxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres</code></div>
                      <div className="pt-2"><span className="text-indigo-400">Key:</span> <code>NODE_ENV</code></div>
                      <div><span className="text-indigo-400">Value:</span> <code>production</code></div>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed space-y-1">
                      <p><strong>🔑 Tips Password dengan simbol @:</strong> Jika password database Anda memiliki karakter <code>@</code> (misal: <code>Afif@2707199</code>), tuliskan sebagai <code>Afif%402707199</code> pada URI koneksi agar terbaca dengan sempurna.</p>
                      <p><strong>🔄 Wajib Redeploy:</strong> Di Vercel, setelah mengubah atau menyimpan Environment Variable di Settings, Anda <strong>wajib klik Redeploy</strong> pada tab Deployments agar nilai baru tersebut mulai dipakai!</p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">5</span>
                    <h5 className="font-bold text-slate-900 text-xs">Klik "Deploy" & Selesai!</h5>
                  </div>
                  <p className="text-slate-600 pl-8">
                    Vercel akan mem-build aplikasi dalam waktu sekitar 45 - 60 detik. Anda akan langsung mendapatkan domain HTTPS resmi gratis, misalnya:
                    <code className="block mt-1 font-bold text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                      https://absensi-sekolah-anda.vercel.app
                    </code>
                    Aplikasi langsung bisa dibuka di smartphone, tablet gerbang, dan laptop. Kamera scanner live otomatis aktif karena Vercel sudah menggunakan enkripsi SSL (HTTPS)!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RINGKASAN & SYARAT SSL */}
          {activeTab === 'ringkasan' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-2xl">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-1">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>WAJIB DIPERHATIKAN: Syarat Akses Kamera Web (HTTPS / SSL)</span>
                </div>
                <p className="text-amber-700">
                  Semua browser (Chrome Android, Safari iPhone, Edge, Firefox) secara ketat <strong>memblokir akses kamera</strong> (<code>navigator.mediaDevices.getUserMedia</code>) jika website dibuka lewat HTTP biasa tanpa sertifikat SSL/HTTPS (kecuali di <code>localhost</code>).
                </p>
                <p className="text-amber-800 font-bold mt-1.5">
                  👉 Saat meng-onlinekan aplikasi ke domain sekolah, Anda <strong>WAJIB mengaktifkan sertifikat SSL (HTTPS)</strong>. Platform PaaS seperti Railway/Render/Cloud Run otomatis memberikan HTTPS gratis. Jika menggunakan VPS, pasang Let's Encrypt gratis via Certbot.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-xs mb-1">Database Supabase</h4>
                  <p className="text-slate-500 text-[11px]">
                    Cloud managed PostgreSQL 15/16 gratis di Singapura, tidak perlu install server DB sendiri.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-xs mb-1">Hardware Scanner MC26 USB</h4>
                  <p className="text-slate-500 text-[11px]">
                    Scanner barcode USB langsung dicolok ke laptop di gerbang, otomatis ketik NISN + Enter.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <h4 className="font-bold text-slate-800 text-xs mb-1">Kamera Live di Smartphone</h4>
                  <p className="text-slate-500 text-[11px]">
                    Buka link HTTPS di Chrome Android atau Safari iOS, klik Buka Kamera, scan kartu pelajar langsung.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAAS (RAILWAY / RENDER) */}
          {activeTab === 'paas' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Pilihan termudah untuk meng-onlinekan aplikasi dengan database Supabase (100% cloud, tanpa perlu kelola OS Linux server):
              </p>

              <div className="space-y-3">
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <h5 className="font-bold text-slate-900 text-xs">Deploy ke Railway.app (Rekomendasi Cepat)</h5>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                    <li>Push kode project aplikasi ini ke repositori <strong>GitHub</strong> Anda.</li>
                    <li>Buka <strong><a href="https://railway.app" target="_blank" rel="noreferrer" className="text-indigo-600 underline">https://railway.app</a></strong> dan login dengan GitHub.</li>
                    <li>Klik <strong>New Project</strong> ➔ <strong>Deploy from GitHub repo</strong> ➔ Pilih repo Anda.</li>
                    <li>Buka tab <strong>Variables</strong> di Railway, tambahkan:
                      <ul className="list-disc list-inside pl-4 mt-1 font-mono text-[11px] text-slate-700">
                        <li><code>DATABASE_URL</code> = (URI connection string dari Supabase)</li>
                        <li><code>NODE_ENV</code> = <code>production</code></li>
                      </ul>
                    </li>
                    <li>Buka tab <strong>Settings</strong> ➔ di bagian <strong>Networking</strong>, klik <strong>Generate Domain</strong>.</li>
                    <li>Railway akan otomatis mem-build dan memberi link HTTPS resmi gratis (misal: <code>https://absensi-sekolah.up.railway.app</code>).</li>
                  </ol>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <h5 className="font-bold text-slate-900 text-xs">Deploy ke Render.com</h5>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                    <li>Buka <strong><a href="https://render.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">https://render.com</a></strong> ➔ Klik <strong>New +</strong> ➔ <strong>Web Service</strong>.</li>
                    <li>Hubungkan repositori GitHub Anda.</li>
                    <li>Build Command: <code>npm install && npm run build</code></li>
                    <li>Start Command: <code>npx tsx server.ts</code></li>
                    <li>Masukkan Environment Variable <code>DATABASE_URL</code> dari Supabase.</li>
                    <li>Klik <strong>Create Web Service</strong>. Domain HTTPS otomatis aktif.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VPS UBUNTU */}
          {activeTab === 'vps' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Deploy ke VPS Ubuntu milik sekolah (misal: IDCloudHost, Niagahoster, Biznet, DigitalOcean) menggunakan Supabase sebagai database:
              </p>

              <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed">
{`# 1. Update VPS dan install Node.js 20, Nginx, PM2, Certbot
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 2. Clone project ke VPS
sudo mkdir -p /var/www/absensi-sekolah
sudo chown -R $USER:$USER /var/www/absensi-sekolah
cd /var/www/absensi-sekolah
# git clone REPO_ANDA .
npm install
npm run build

# 3. Buat file .env dengan DATABASE_URL Supabase
nano .env
# Isi dengan:
# DATABASE_URL="postgresql://postgres.xxx:Password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
# APP_URL="https://absensi.sekolah.sch.id"

# 4. Jalankan aplikasi 24/7 dengan PM2
pm2 start server.ts --name "absensi-sekolah" --interpreter="tsx"
pm2 save
pm2 startup

# 5. Konfigurasi Nginx Reverse Proxy (lihat tab Script SQL & Config)
sudo nano /etc/nginx/sites-available/absensi
sudo ln -s /etc/nginx/sites-available/absensi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. Pasang SSL HTTPS Let's Encrypt gratis (wajib untuk kamera)
sudo certbot --nginx -d absensi.sekolah.sch.id`}
              </pre>
            </div>
          )}

          {/* TAB 5: GOOGLE CLOUD RUN */}
          {activeTab === 'cloudrun' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Deploy container serverless ke Google Cloud Platform dengan database Supabase:
              </p>

              <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed">
{`# 1. Build image container ke Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID_ANDA/absensi-sekolah

# 2. Deploy ke Cloud Run dengan variabel DATABASE_URL Supabase
gcloud run deploy absensi-sekolah \\
  --image gcr.io/PROJECT_ID_ANDA/absensi-sekolah \\
  --platform managed \\
  --region asia-southeast1 \\
  --allow-unauthenticated \\
  --set-env-vars DATABASE_URL="postgresql://postgres.xxx:Password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"`}
              </pre>
            </div>
          )}

          {/* TAB 6: CONFIG FILES */}
          {activeTab === 'konfigurasi' && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {(['supabase_env', 'supabase_sql', 'npmrc', 'vercel', 'env', 'nginx', 'pm2'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setActiveConfigFile(key)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap ${
                      activeConfigFile === key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {configFiles[key].name}
                  </button>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-500 text-xs">{configFiles[activeConfigFile].desc}</p>
                  <button
                    onClick={() => handleCopy(configFiles[activeConfigFile].code, activeConfigFile)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs shrink-0"
                  >
                    {copiedKey === activeConfigFile ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Konfigurasi</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed border border-slate-800 max-h-96">
                  {configFiles[activeConfigFile].code}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 text-center sm:text-left">
            Panduan lengkap tersimpan di file <code>PANDUAN_SUPABASE.md</code> dan <code>supabase_schema.sql</code> di root project.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition w-full sm:w-auto"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
