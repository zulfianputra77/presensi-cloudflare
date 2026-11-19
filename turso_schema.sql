-- ====================================================================
-- SKEMA DATABASE SISTEM ABSENSI SEKOLAH PINTAR (TURSO / LIBSQL)
-- Jalankan SQL ini di Turso Web Console (SQL Shell) atau via Turso CLI.
-- (Aplikasi juga otomatis memastikan tabel & data awal tersedia saat startup)
-- ====================================================================

-- 1. TABEL PENGGUNA (USERS)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nama TEXT,
    kelas TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. TABEL MASTER KELAS
CREATE TABLE IF NOT EXISTS kelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL UNIQUE,
    urutan INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. TABEL MASTER SISWA
CREATE TABLE IF NOT EXISTS siswa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON siswa(nisn);

-- 4. TABEL PRESENSI HARIAN (ABSENSI MASUK & PULANG)
CREATE TABLE IF NOT EXISTS absensi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    jam_datang TEXT DEFAULT '',
    jam_pulang TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    status TEXT NOT NULL,
    jam_sholat TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_absensi_tgl_nisn ON absensi(tanggal, nisn);
CREATE INDEX IF NOT EXISTS idx_absensi_tgl_kelas ON absensi(tanggal, kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);

-- 5. TABEL PRESENSI SHOLAT BERJAMAAH
CREATE TABLE IF NOT EXISTS absensi_sholat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    waktu_sholat TEXT NOT NULL,
    status TEXT NOT NULL,
    keterangan TEXT DEFAULT '',
    input_oleh TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sholat_tgl_waktu ON absensi_sholat(tanggal, waktu_sholat, kelas);

-- 6. TABEL HARI LIBUR
CREATE TABLE IF NOT EXISTS hari_libur (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL UNIQUE,
    keterangan TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 7. TABEL KONFIGURASI OPERASIONAL
CREATE TABLE IF NOT EXISTS konfigurasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    keterangan TEXT
);

-- 8. TABEL LOG NOTIFIKASI WHATSAPP ALPA
CREATE TABLE IF NOT EXISTS log_notifikasi_wa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu_dikirim TEXT NOT NULL,
    tanggal_absensi TEXT NOT NULL,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Sudah Dikirim',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_log_wa_tgl_nisn ON log_notifikasi_wa(tanggal_absensi, nisn);

-- 9. TABEL SESI LOGIN
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    identifier TEXT NOT NULL,
    role TEXT NOT NULL,
    nama TEXT,
    kelas TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 10. TABEL PENGAJUAN IZIN & SAKIT SISWA
CREATE TABLE IF NOT EXISTS pengajuan_izin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    jenis TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL,
    tanggal_selesai TEXT NOT NULL,
    keterangan TEXT NOT NULL,
    dokumen_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
    catatan_admin TEXT DEFAULT '',
    reviewed_at TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pengajuan_nisn ON pengajuan_izin(nisn);
CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan_izin(status);

-- ====================================================================
-- SEED DATA AWAL (DEMO & AKUN RESMI)
-- ====================================================================

INSERT OR IGNORE INTO users (username, password, role, nama, kelas) VALUES
    ('admin', 'admin123', 'admin', 'Administrator Sekolah', ''),
    ('guru1', 'guru123', 'guru', 'Guru Wali Kelas VII', 'VII A,VII B'),
    ('wakel', 'wakel123', 'wakel', 'Wakil Kepala Sekolah', '');

INSERT OR IGNORE INTO kelas (nama, urutan) VALUES
    ('VII A', 1),
    ('VII B', 2),
    ('VII C', 3),
    ('VIII A', 4),
    ('VIII B', 5),
    ('IX A', 6),
    ('IX B', 7);

INSERT OR IGNORE INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat) VALUES
    ('1234567890', 'Ahmad Rizki', 'Laki-laki', '2010-05-15', 'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890', 'VII A', 'Jl. Merdeka No. 10, Jambi'),
    ('1234567891', 'Siti Nurhaliza', 'Perempuan', '2010-08-20', 'Islam', 'Usman', 'Farida', '081298765432', 'VII A', 'Jl. Sudirman No. 25, Jambi'),
    ('1234567892', 'Budi Santoso', 'Laki-laki', '2010-03-12', 'Islam', 'Joko', 'Sri Rahayu', '081345678901', 'VII B', 'Jl. Pahlawan No. 7, Jambi'),
    ('1234567893', 'Dewi Sartika', 'Perempuan', '2010-11-04', 'Islam', 'Hendra', 'Ratna', '081278901234', 'VII B', 'Jl. Melati No. 15, Jambi'),
    ('1234567894', 'Kevin Pratama', 'Laki-laki', '2010-07-22', 'Kristen', 'Daniel', 'Maria', '081389012345', 'VII C', 'Jl. Kenanga No. 8, Jambi'),
    ('1234567895', 'Rian Ardiansyah', 'Laki-laki', '2009-02-18', 'Islam', 'Herman', 'Yuliana', '081290123456', 'VIII A', 'Jl. Anggrek No. 12, Jambi'),
    ('1234567896', 'Putri Ayu', 'Perempuan', '2009-09-30', 'Islam', 'Suhartono', 'Endang', '081301234567', 'VIII B', 'Jl. Mawar No. 3, Jambi');

INSERT OR IGNORE INTO konfigurasi (key, value, keterangan) VALUES
    ('jam_masuk_mulai', '06:00', 'Jam buka absensi datang'),
    ('jam_masuk_akhir', '07:15', 'Batas jam tepat waktu masuk'),
    ('jam_pulang_mulai', '15:00', 'Jam mulai absensi pulang'),
    ('jam_pulang_akhir', '17:00', 'Batas tutup absensi pulang'),
    ('mode_absen', 'masuk_pulang', 'Mode absensi: masuk_pulang'),
    ('jadwal_harian', '{"1":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"2":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"3":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"4":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"5":{"libur":false,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"6":{"libur":true,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"},"7":{"libur":true,"masuk_mulai":"06:00","masuk_akhir":"07:15","pulang_mulai":"15:00","pulang_akhir":"17:00"}}', 'Jadwal harian Senin - Minggu'),
    ('seed_completed', 'true', 'Penanda seed awal selesai');
