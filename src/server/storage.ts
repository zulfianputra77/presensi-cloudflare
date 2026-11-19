import { Pool } from 'pg';
import crypto from 'crypto';

export interface UserRecord {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'guru' | 'wakel' | 'siswa';
  nama: string;
  kelas: string;
}

export interface SiswaRecord {
  id: number;
  nisn: string;
  nama: string;
  jenisKelamin: string;
  tanggalLahir: string;
  agama: string;
  namaAyah: string;
  namaIbu: string;
  noHp: string;
  kelas: string;
  alamat: string;
}

export interface KelasRecord {
  id: number;
  nama: string;
  urutan: number;
}

export interface AbsensiRecord {
  id: number;
  tanggal: string; // YYYY-MM-DD
  nisn: string;
  nama: string;
  kelas: string;
  jamDatang: string;
  jamPulang: string;
  keterangan: string;
  status: string; // 'Hadir' | 'Sakit' | 'Izin' | 'Alpa' | 'Belum Absen'
  jamSholat?: string;
}

export interface AbsensiSholatRecord {
  id: number;
  tanggal: string;
  nisn: string;
  nama: string;
  kelas: string;
  waktuSholat: string;
  status: string;
  keterangan: string;
  inputOleh: string;
}

export interface HariLiburRecord {
  id: number;
  tanggal: string;
  keterangan: string;
}

export interface SessionRecord {
  token: string;
  identifier: string;
  role: string;
  nama: string;
  kelas: string;
  expiresAt: Date;
}

export interface LogWaRecord {
  id: number;
  waktuDikirim: string;
  tanggalAbsensi: string;
  nisn: string;
  nama: string;
  kelas: string;
  status: string;
}

export interface PengajuanIzinRecord {
  id: number;
  nisn: string;
  nama: string;
  kelas: string;
  jenis: 'Izin' | 'Sakit';
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
  keterangan: string;
  dokumenUrl?: string;
  status: 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak';
  catatanAdmin?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
}

// In-memory initial seed state
let memoryUsers: UserRecord[] = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin', nama: 'Administrator', kelas: '' },
  { id: 2, username: 'guru1', password: 'guru123', role: 'guru', nama: 'Guru Wali Kelas VII', kelas: 'VII A,VII B' },
  { id: 3, username: 'wakel', password: 'wakel123', role: 'wakel', nama: 'Wakil Kepala Sekolah', kelas: '' },
];

let memoryKelas: KelasRecord[] = [
  { id: 1, nama: 'VII A', urutan: 1 },
  { id: 2, nama: 'VII B', urutan: 2 },
  { id: 3, nama: 'VII C', urutan: 3 },
  { id: 4, nama: 'VIII A', urutan: 4 },
  { id: 5, nama: 'VIII B', urutan: 5 },
  { id: 6, nama: 'IX A', urutan: 6 },
  { id: 7, nama: 'IX B', urutan: 7 },
];

let memorySiswa: SiswaRecord[] = [
  { id: 1, nisn: '1234567890', nama: 'Ahmad Rizki', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-05-15', agama: 'Islam', namaAyah: 'Budi Santoso', namaIbu: 'Siti Aminah', noHp: '081234567890', kelas: 'VII A', alamat: 'Jl. Merdeka No. 10, Jambi' },
  { id: 2, nisn: '1234567891', nama: 'Siti Nurhaliza', jenisKelamin: 'Perempuan', tanggalLahir: '2010-08-20', agama: 'Islam', namaAyah: 'Usman', namaIbu: 'Farida', noHp: '081298765432', kelas: 'VII A', alamat: 'Jl. Sudirman No. 25, Jambi' },
  { id: 3, nisn: '1234567892', nama: 'Budi Santoso', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-03-12', agama: 'Islam', namaAyah: 'Joko', namaIbu: 'Sri Rahayu', noHp: '081345678901', kelas: 'VII B', alamat: 'Jl. Pahlawan No. 7, Jambi' },
  { id: 4, nisn: '1234567893', nama: 'Dewi Sartika', jenisKelamin: 'Perempuan', tanggalLahir: '2010-11-04', agama: 'Islam', namaAyah: 'Hendra', namaIbu: 'Ratna', noHp: '081278901234', kelas: 'VII B', alamat: 'Jl. Melati No. 15, Jambi' },
  { id: 5, nisn: '1234567894', nama: 'Kevin Pratama', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-07-22', agama: 'Kristen', namaAyah: 'Daniel', namaIbu: 'Maria', noHp: '081389012345', kelas: 'VII C', alamat: 'Jl. Kenanga No. 8, Jambi' },
  { id: 6, nisn: '1234567895', nama: 'Rian Ardiansyah', jenisKelamin: 'Laki-laki', tanggalLahir: '2009-02-18', agama: 'Islam', namaAyah: 'Herman', namaIbu: 'Yuliana', noHp: '081290123456', kelas: 'VIII A', alamat: 'Jl. Anggrek No. 12, Jambi' },
  { id: 7, nisn: '1234567896', nama: 'Putri Ayu', jenisKelamin: 'Perempuan', tanggalLahir: '2009-09-30', agama: 'Islam', namaAyah: 'Suhartono', namaIbu: 'Endang', noHp: '081301234567', kelas: 'VIII B', alamat: 'Jl. Mawar No. 3, Jambi' },
];

let memoryAbsensi: AbsensiRecord[] = [];
let memoryAbsensiSholat: AbsensiSholatRecord[] = [];
let memoryHariLibur: HariLiburRecord[] = [];
let memorySessions: SessionRecord[] = [];
let memoryLogWa: LogWaRecord[] = [];
let memoryPengajuanIzin: PengajuanIzinRecord[] = [];

let memoryConfig: Record<string, string> = {
  jam_masuk_mulai: '06:00',
  jam_masuk_akhir: '07:15',
  jam_pulang_mulai: '15:00',
  jam_pulang_akhir: '17:00',
  mode_absen: 'masuk_pulang',
  jadwal_harian: JSON.stringify({
    "1": { libur: false, masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "2": { libur: false, masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "3": { libur: false, masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "4": { libur: false, masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "5": { libur: false, masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "6": { libur: true,  masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" },
    "7": { libur: true,  masuk_mulai: "06:00", masuk_akhir: "07:15", pulang_mulai: "15:00", pulang_akhir: "17:00" }
  }),
};

// PostgreSQL Connection state
let pgPool: Pool | null = null;
let isPgActive = false;
let pgLastError: string | null = null;

export function cleanConnectionString(raw?: string): string {
  if (!raw) return '';
  let str = raw.trim().replace(/^["']|["']$/g, '').replace(/[\r\n\t ]+/g, '');
  // Encode unencoded @ in password: postgresql://user:pass@word@host:port/db -> postgresql://user:pass%40word@host:port/db
  const match = str.match(/^(postgresql:\/\/[^:]+:)(.*)(@[^@]+:[0-9]+\/.*)$/);
  if (match) {
    const userPart = match[1];
    const passwordPart = match[2];
    const hostPart = match[3];
    const safePass = passwordPart.replace(/@/g, '%40');
    str = `${userPart}${safePass}${hostPart}`;
  }
  return str;
}

export async function ensureConnection(): Promise<boolean> {
  if (isPgActive && pgPool) return true;
  const rawConn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (rawConn || process.env.SQL_HOST) {
    await initStorage();
    return isPgActive;
  }
  return false;
}

export async function initStorage() {
  const rawConn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const connectionString = cleanConnectionString(rawConn);
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  const isSupabase = Boolean(
    connectionString?.includes('supabase') ||
    host?.includes('supabase') ||
    process.env.SQL_SSL === 'true'
  );
  const ssl = isSupabase ? { rejectUnauthorized: false } : false;

  if (connectionString || (host && user && database)) {
    try {
      if (connectionString) {
        pgPool = new Pool({
          connectionString,
          ssl,
          connectionTimeoutMillis: 8000,
          idleTimeoutMillis: 5000,
          max: 5,
        });
      } else {
        pgPool = new Pool({
          host,
          user,
          password,
          database,
          port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
          ssl,
          connectionTimeoutMillis: 8000,
          idleTimeoutMillis: 5000,
          max: 5,
        });
      }

      const client = await pgPool.connect();
      try {
        await client.query('SELECT 1');
        isPgActive = true;
        pgLastError = null;
        const providerName = isSupabase ? 'Supabase PostgreSQL' : 'PostgreSQL Server';
        console.log(`[Storage] Connected to ${providerName} (${connectionString ? 'Connection String' : `${host}/${database}`}) with SSL: ${Boolean(ssl)}`);

        // Run auto-migration / table creation
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            nama TEXT,
            kelas TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW()
          );

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
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS kelas (
            id SERIAL PRIMARY KEY,
            nama TEXT NOT NULL UNIQUE,
            urutan INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          );

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
            created_at TIMESTAMP DEFAULT NOW()
          );

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
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS hari_libur (
            id SERIAL PRIMARY KEY,
            tanggal TEXT NOT NULL UNIQUE,
            keterangan TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS konfigurasi (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            keterangan TEXT
          );

          CREATE TABLE IF NOT EXISTS log_notifikasi_wa (
            id SERIAL PRIMARY KEY,
            waktu_dikirim TEXT NOT NULL,
            tanggal_absensi TEXT NOT NULL,
            nisn TEXT NOT NULL,
            nama TEXT NOT NULL,
            kelas TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Sudah Dikirim',
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            token TEXT NOT NULL UNIQUE,
            identifier TEXT NOT NULL,
            role TEXT NOT NULL,
            nama TEXT,
            kelas TEXT,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS pengajuan_izin (
            id SERIAL PRIMARY KEY,
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
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);

        // Check if initial master seeding was already executed
        const seedCheck = await client.query("SELECT value FROM konfigurasi WHERE key = 'seed_completed'");
        const alreadySeeded = seedCheck.rows.length > 0 && seedCheck.rows[0].value === 'true';

        // Seed users if empty
        const userCheck = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(userCheck.rows[0].count) === 0) {
          for (const u of memoryUsers) {
            await client.query('INSERT INTO users (username, password, role, nama, kelas) VALUES ($1, $2, $3, $4, $5)', [
              u.username, u.password, u.role, u.nama, u.kelas
            ]);
          }
        }

        // Seed kelas if empty
        const kelasCheck = await client.query('SELECT COUNT(*) FROM kelas');
        if (parseInt(kelasCheck.rows[0].count) === 0) {
          for (const k of memoryKelas) {
            await client.query('INSERT INTO kelas (nama, urutan) VALUES ($1, $2)', [k.nama, k.urutan]);
          }
        }

        // Seed siswa ONLY once upon very first initial install, NEVER re-seed if user deleted records
        if (!alreadySeeded) {
          const siswaCheck = await client.query('SELECT COUNT(*) FROM siswa');
          if (parseInt(siswaCheck.rows[0].count) === 0) {
            for (const s of memorySiswa) {
              await client.query(
                'INSERT INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (nisn) DO NOTHING',
                [s.nisn, s.nama, s.jenisKelamin, s.tanggalLahir, s.agama, s.namaAyah, s.namaIbu, s.noHp, s.kelas, s.alamat]
              );
            }
          }
          await client.query("INSERT INTO konfigurasi (key, value) VALUES ('seed_completed', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
        }

        // Seed konfigurasi if empty
        const cfgCheck = await client.query('SELECT COUNT(*) FROM konfigurasi');
        if (parseInt(cfgCheck.rows[0].count) === 0) {
          for (const [key, val] of Object.entries(memoryConfig)) {
            await client.query('INSERT INTO konfigurasi (key, value) VALUES ($1, $2)', [key, val]);
          }
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[Storage] PostgreSQL connection not available (' + err.message + '). Operating with in-memory fallback store.');
      isPgActive = false;
      pgLastError = err.message || String(err);
    }
  } else {
    console.log('[Storage] DATABASE_URL / SQL_HOST not set. Operating with high-speed in-memory store.');
    isPgActive = false;
    pgLastError = 'DATABASE_URL belum diatur di Environment Variables';
  }
}

// Storage Operations
export const storage = {
  isPostgres: () => isPgActive,

  // Users
  async findUserByUsername(username: string): Promise<UserRecord | null> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, username, password, role, nama, kelas FROM users WHERE username = $1 LIMIT 1', [username]);
      return res.rows[0] || null;
    }
    return memoryUsers.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  },

  async getAllGuru(): Promise<UserRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query("SELECT id, username, password, role, nama, kelas FROM users WHERE role = 'guru' ORDER BY username ASC");
      return res.rows;
    }
    return memoryUsers.filter(u => u.role === 'guru').sort((a, b) => a.username.localeCompare(b.username));
  },

  async createGuru(u: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('INSERT INTO users (username, password, role, nama, kelas) VALUES ($1, $2, $3, $4, $5) RETURNING *', [
        u.username, u.password, u.role, u.nama, u.kelas
      ]);
      return res.rows[0];
    }
    const rec: UserRecord = { id: Date.now(), ...u };
    memoryUsers.push(rec);
    return rec;
  },

  async updateGuru(oldUsername: string, u: Partial<UserRecord>): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('UPDATE users SET username = COALESCE($1, username), password = COALESCE($2, password), kelas = COALESCE($3, kelas) WHERE username = $4', [
        u.username, u.password, u.kelas, oldUsername
      ]);
      return;
    }
    const idx = memoryUsers.findIndex(item => item.username === oldUsername);
    if (idx !== -1) {
      memoryUsers[idx] = { ...memoryUsers[idx], ...u };
    }
  },

  async deleteGuru(username: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM users WHERE username = $1', [username]);
      return;
    }
    memoryUsers = memoryUsers.filter(u => u.username !== username);
  },

  // Sessions
  async createSession(s: SessionRecord): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('INSERT INTO sessions (token, identifier, role, nama, kelas, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', [
        s.token, s.identifier, s.role, s.nama, s.kelas, s.expiresAt
      ]);
      return;
    }
    memorySessions.push(s);
  },

  async findSession(token: string): Promise<SessionRecord | null> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT token, identifier, role, nama, kelas, expires_at as "expiresAt" FROM sessions WHERE token = $1 LIMIT 1', [token]);
      return res.rows[0] || null;
    }
    const s = memorySessions.find(item => item.token === token);
    return s || null;
  },

  async deleteSession(token: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM sessions WHERE token = $1', [token]);
      return;
    }
    memorySessions = memorySessions.filter(s => s.token !== token);
  },

  // Siswa
  async getAllSiswa(filterKelas?: string): Promise<SiswaRecord[]> {
    await ensureConnection();
    if (isPgActive && pgPool) {
      let q = 'SELECT id, nisn, nama, jenis_kelamin as "jenisKelamin", tanggal_lahir as "tanggalLahir", agama, nama_ayah as "namaAyah", nama_ibu as "namaIbu", no_hp as "noHp", kelas, alamat FROM siswa';
      const params: any[] = [];
      if (filterKelas && filterKelas !== 'SEMUA') {
        const arr = filterKelas.split(',').map(k => k.trim()).filter(Boolean);
        if (arr.length > 0) {
          q += ' WHERE kelas = ANY($1)';
          params.push(arr);
        }
      }
      q += ' ORDER BY nama ASC';
      const res = await pgPool.query(q, params);
      return res.rows;
    }

    let list = [...memorySiswa];
    if (filterKelas && filterKelas !== 'SEMUA') {
      const arr = filterKelas.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
      list = list.filter(s => arr.includes(s.kelas.toUpperCase()));
    }
    return list.sort((a, b) => a.nama.localeCompare(b.nama));
  },

  async findSiswaByNisn(nisn: string): Promise<SiswaRecord | null> {
    const clean = nisn.replace(/'/g, '').trim();
    await ensureConnection();
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, nisn, nama, jenis_kelamin as "jenisKelamin", tanggal_lahir as "tanggalLahir", agama, nama_ayah as "namaAyah", nama_ibu as "namaIbu", no_hp as "noHp", kelas, alamat FROM siswa WHERE nisn = $1 LIMIT 1', [clean]);
      return res.rows[0] || null;
    }
    return memorySiswa.find(s => s.nisn === clean) || null;
  },

  async createSiswa(s: Omit<SiswaRecord, 'id'>): Promise<SiswaRecord> {
    const cleanNisn = s.nisn.replace(/'/g, '').trim();
    await ensureConnection();
    if (isPgActive && pgPool) {
      const res = await pgPool.query(
        'INSERT INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [cleanNisn, s.nama, s.jenisKelamin, s.tanggalLahir, s.agama, s.namaAyah, s.namaIbu, s.noHp, s.kelas, s.alamat]
      );
      return res.rows[0];
    }
    const rec: SiswaRecord = { id: Date.now(), ...s, nisn: cleanNisn };
    memorySiswa.push(rec);
    return rec;
  },

  async updateSiswa(oldNisn: string, s: Partial<SiswaRecord>): Promise<void> {
    const cleanOld = oldNisn.replace(/'/g, '').trim();
    await ensureConnection();
    if (isPgActive && pgPool) {
      await pgPool.query(
        'UPDATE siswa SET nama = COALESCE($1, nama), jenis_kelamin = COALESCE($2, jenis_kelamin), tanggal_lahir = COALESCE($3, tanggal_lahir), agama = COALESCE($4, agama), nama_ayah = COALESCE($5, nama_ayah), nama_ibu = COALESCE($6, nama_ibu), no_hp = COALESCE($7, no_hp), kelas = COALESCE($8, kelas), alamat = COALESCE($9, alamat) WHERE nisn = $10',
        [s.nama, s.jenisKelamin, s.tanggalLahir, s.agama, s.namaAyah, s.namaIbu, s.noHp, s.kelas, s.alamat, cleanOld]
      );
      return;
    }
    const idx = memorySiswa.findIndex(item => item.nisn === cleanOld);
    if (idx !== -1) {
      memorySiswa[idx] = { ...memorySiswa[idx], ...s };
    }
  },

  async deleteSiswa(nisn: string): Promise<void> {
    const clean = nisn.replace(/'/g, '').trim();
    await ensureConnection();
    memorySiswa = memorySiswa.filter(s => s.nisn !== clean);
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM absensi WHERE TRIM(nisn) = $1 OR nisn = $1', [clean]);
      await pgPool.query('DELETE FROM absensi_sholat WHERE TRIM(nisn) = $1 OR nisn = $1', [clean]);
      await pgPool.query('DELETE FROM log_notifikasi_wa WHERE TRIM(nisn) = $1 OR nisn = $1', [clean]);
      await pgPool.query('DELETE FROM siswa WHERE TRIM(nisn) = $1 OR nisn = $1', [clean]);
      return;
    }
  },

  // Kelas
  async getAllKelas(): Promise<string[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT nama FROM kelas ORDER BY nama ASC');
      return res.rows.map(r => r.nama);
    }
    return memoryKelas.map(k => k.nama).sort();
  },

  async getKelasMaster(): Promise<KelasRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, nama, urutan FROM kelas ORDER BY nama ASC');
      return res.rows;
    }
    return [...memoryKelas].sort((a, b) => a.nama.localeCompare(b.nama));
  },

  async createKelas(nama: string): Promise<KelasRecord> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('INSERT INTO kelas (nama) VALUES ($1) RETURNING id, nama, urutan', [nama]);
      return res.rows[0];
    }
    const rec: KelasRecord = { id: Date.now(), nama, urutan: memoryKelas.length + 1 };
    memoryKelas.push(rec);
    return rec;
  },

  async updateKelas(id: number, namaBaru: string): Promise<void> {
    if (isPgActive && pgPool) {
      const old = await pgPool.query('SELECT nama FROM kelas WHERE id = $1', [id]);
      const oldName = old.rows[0]?.nama;
      await pgPool.query('UPDATE kelas SET nama = $1 WHERE id = $2', [namaBaru, id]);
      if (oldName) {
        await pgPool.query('UPDATE siswa SET kelas = $1 WHERE kelas = $2', [namaBaru, oldName]);
      }
      return;
    }
    const idx = memoryKelas.findIndex(k => k.id === id);
    if (idx !== -1) {
      const oldName = memoryKelas[idx].nama;
      memoryKelas[idx].nama = namaBaru;
      memorySiswa.forEach(s => {
        if (s.kelas === oldName) s.kelas = namaBaru;
      });
    }
  },

  async deleteKelas(id: number, namaKelas: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM kelas WHERE id = $1', [id]);
      return;
    }
    memoryKelas = memoryKelas.filter(k => k.id !== id);
  },

  // Hari Libur
  async getAllHariLibur(): Promise<HariLiburRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, tanggal, keterangan FROM hari_libur ORDER BY tanggal DESC');
      return res.rows;
    }
    return [...memoryHariLibur].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  },

  async addHariLibur(tanggal: string, keterangan: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('INSERT INTO hari_libur (tanggal, keterangan) VALUES ($1, $2) ON CONFLICT (tanggal) DO UPDATE SET keterangan = $2', [tanggal, keterangan]);
      return;
    }
    const existing = memoryHariLibur.find(h => h.tanggal === tanggal);
    if (existing) existing.keterangan = keterangan;
    else memoryHariLibur.push({ id: Date.now(), tanggal, keterangan });
  },

  async deleteHariLibur(tanggal: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM hari_libur WHERE tanggal = $1', [tanggal]);
      return;
    }
    memoryHariLibur = memoryHariLibur.filter(h => h.tanggal !== tanggal);
  },

  // Konfigurasi
  async getConfig(): Promise<Record<string, string>> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT key, value FROM konfigurasi');
      const map: Record<string, string> = {};
      res.rows.forEach(r => { map[r.key] = r.value; });
      return { ...memoryConfig, ...map };
    }
    return { ...memoryConfig };
  },

  async saveConfigKey(key: string, value: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('INSERT INTO konfigurasi (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
      return;
    }
    memoryConfig[key] = value;
  },

  // Absensi Realtime
  async getAbsensiToday(tanggal: string, nisn: string): Promise<AbsensiRecord | null> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, tanggal, nisn, nama, kelas, jam_datang as "jamDatang", jam_pulang as "jamPulang", keterangan, status FROM absensi WHERE tanggal = $1 AND nisn = $2 LIMIT 1', [tanggal, nisn]);
      return res.rows[0] || null;
    }
    return memoryAbsensi.find(a => a.tanggal === tanggal && a.nisn === nisn) || null;
  },

  async getAbsensiByDate(tanggal: string): Promise<AbsensiRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, tanggal, nisn, nama, kelas, jam_datang as "jamDatang", jam_pulang as "jamPulang", keterangan, status FROM absensi WHERE tanggal = $1', [tanggal]);
      return res.rows;
    }
    return memoryAbsensi.filter(a => a.tanggal === tanggal);
  },

  async getAbsensiRange(startDate: string, endDate: string): Promise<AbsensiRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, tanggal, nisn, nama, kelas, jam_datang as "jamDatang", jam_pulang as "jamPulang", keterangan, status FROM absensi WHERE tanggal >= $1 AND tanggal <= $2', [startDate, endDate]);
      return res.rows;
    }
    return memoryAbsensi.filter(a => a.tanggal >= startDate && a.tanggal <= endDate);
  },

  async recordAbsensiMasuk(rec: Omit<AbsensiRecord, 'id'>): Promise<AbsensiRecord> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query(
        'INSERT INTO absensi (tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, tanggal, nisn, nama, kelas, jam_datang as "jamDatang", jam_pulang as "jamPulang", keterangan, status',
        [rec.tanggal, rec.nisn, rec.nama, rec.kelas, rec.jamDatang, rec.jamPulang || '', rec.keterangan || '', rec.status || 'Hadir']
      );
      return res.rows[0];
    }
    const item: AbsensiRecord = { id: Date.now() + Math.floor(Math.random() * 1000), ...rec };
    memoryAbsensi.push(item);
    return item;
  },

  async recordAbsensiPulang(id: number, jamPulang: string, keterangan: string): Promise<void> {
    if (isPgActive && pgPool) {
      await pgPool.query('UPDATE absensi SET jam_pulang = $1, keterangan = $2 WHERE id = $3', [jamPulang, keterangan, id]);
      return;
    }
    const idx = memoryAbsensi.findIndex(a => a.id === id);
    if (idx !== -1) {
      memoryAbsensi[idx].jamPulang = jamPulang;
      memoryAbsensi[idx].keterangan = keterangan;
    }
  },

  async updateAbsensiStatus(tanggal: string, nisn: string, nama: string, kelas: string, status: string, jamDatang?: string): Promise<void> {
    const isHadir = status.toLowerCase() === 'hadir';
    const canonicalStatus = isHadir
      ? 'Hadir'
      : status.toLowerCase() === 'sakit'
      ? 'Sakit'
      : status.toLowerCase() === 'izin'
      ? 'Izin'
      : status.toLowerCase() === 'alpa'
      ? 'Alpa'
      : status;

    if (isPgActive && pgPool) {
      const existing = await pgPool.query('SELECT id, jam_datang FROM absensi WHERE tanggal = $1 AND nisn = $2', [tanggal, nisn]);
      if (existing.rows.length > 0) {
        const jd = isHadir
          ? (existing.rows[0].jam_datang || jamDatang || '07:00:00')
          : existing.rows[0].jam_datang;
        await pgPool.query('UPDATE absensi SET status = $1, jam_datang = $2 WHERE id = $3', [canonicalStatus, jd, existing.rows[0].id]);
      } else {
        await pgPool.query(
          'INSERT INTO absensi (tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tanggal, nisn, nama, kelas, isHadir ? (jamDatang || '07:00:00') : '', '', isHadir ? 'Tepat Waktu' : 'Status Manual', canonicalStatus]
        );
      }
      return;
    }

    const idx = memoryAbsensi.findIndex(a => a.tanggal === tanggal && a.nisn === nisn);
    if (idx !== -1) {
      memoryAbsensi[idx].status = canonicalStatus;
      if (isHadir && !memoryAbsensi[idx].jamDatang) {
        memoryAbsensi[idx].jamDatang = jamDatang || '07:00:00';
      }
    } else {
      memoryAbsensi.push({
        id: Date.now(),
        tanggal,
        nisn,
        nama,
        kelas,
        jamDatang: isHadir ? (jamDatang || '07:00:00') : '',
        jamPulang: '',
        keterangan: isHadir ? 'Tepat Waktu' : 'Status Manual',
        status: canonicalStatus,
      });
    }
  },

  // Sholat
  async getSholatByDate(tanggal: string, waktuSholat?: string, kelas?: string): Promise<AbsensiSholatRecord[]> {
    if (isPgActive && pgPool) {
      let q = 'SELECT id, tanggal, nisn, nama, kelas, waktu_sholat as "waktuSholat", status, keterangan, input_oleh as "inputOleh" FROM absensi_sholat WHERE tanggal = $1';
      const params: any[] = [tanggal];
      if (waktuSholat) {
        q += ' AND waktu_sholat = $2';
        params.push(waktuSholat);
      }
      const res = await pgPool.query(q, params);
      return res.rows;
    }

    return memoryAbsensiSholat.filter(s => s.tanggal === tanggal && (!waktuSholat || s.waktuSholat === waktuSholat));
  },

  async getSholatMonth(ym: string): Promise<AbsensiSholatRecord[]> {
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT id, tanggal, nisn, nama, kelas, waktu_sholat as "waktuSholat", status, keterangan, input_oleh as "inputOleh" FROM absensi_sholat WHERE tanggal LIKE $1 ORDER BY tanggal ASC', [ym + '%']);
      return res.rows;
    }
    return memoryAbsensiSholat.filter(s => s.tanggal.startsWith(ym));
  },

  async saveSholatRecords(tanggal: string, waktuSholat: string, list: any[], inputOleh: string): Promise<void> {
    if (isPgActive && pgPool) {
      const nisnArr = list.map(l => l.nisn);
      await pgPool.query('DELETE FROM absensi_sholat WHERE tanggal = $1 AND waktu_sholat = $2 AND nisn = ANY($3)', [tanggal, waktuSholat, nisnArr]);
      for (const item of list) {
        await pgPool.query(
          'INSERT INTO absensi_sholat (tanggal, nisn, nama, kelas, waktu_sholat, status, keterangan, input_oleh) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tanggal, item.nisn, item.nama, item.kelas, waktuSholat, item.status, item.keterangan || '', inputOleh || 'Guru']
        );
      }
      return;
    }

    memoryAbsensiSholat = memoryAbsensiSholat.filter(s => !(s.tanggal === tanggal && s.waktuSholat === waktuSholat && list.some(l => l.nisn === s.nisn)));
    for (const item of list) {
      memoryAbsensiSholat.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        tanggal,
        nisn: item.nisn,
        nama: item.nama,
        kelas: item.kelas,
        waktuSholat,
        status: item.status,
        keterangan: item.keterangan || '',
        inputOleh: inputOleh || 'Guru',
      });
    }
  },

  // WhatsApp Log
  async getWaStatus(tanggal: string): Promise<Record<string, { sudahDikirim: boolean; waktu: string }>> {
    const result: Record<string, { sudahDikirim: boolean; waktu: string }> = {};
    if (isPgActive && pgPool) {
      const res = await pgPool.query('SELECT nisn, waktu_dikirim as "waktuDikirim" FROM log_notifikasi_wa WHERE tanggal_absensi = $1', [tanggal]);
      res.rows.forEach(r => {
        result[r.nisn] = { sudahDikirim: true, waktu: r.waktuDikirim };
      });
      return result;
    }
    memoryLogWa.filter(l => l.tanggalAbsensi === tanggal).forEach(l => {
      result[l.nisn] = { sudahDikirim: true, waktu: l.waktuDikirim };
    });
    return result;
  },

  async recordWaSent(nisn: string, tanggal: string): Promise<void> {
    const nowStr = new Date().toLocaleString('id-ID');
    const s = await this.findSiswaByNisn(nisn);
    if (!s) return;

    if (isPgActive && pgPool) {
      await pgPool.query(
        'INSERT INTO log_notifikasi_wa (waktu_dikirim, tanggal_absensi, nisn, nama, kelas, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [nowStr, tanggal, nisn, s.nama, s.kelas, 'Sudah Dikirim']
      );
      return;
    }

    memoryLogWa.push({
      id: Date.now(),
      waktuDikirim: nowStr,
      tanggalAbsensi: tanggal,
      nisn,
      nama: s.nama,
      kelas: s.kelas,
      status: 'Sudah Dikirim',
    });
  },

  // Pengajuan Izin & Sakit
  async getAllPengajuan(filter?: { nisn?: string; status?: string; kelas?: string }): Promise<PengajuanIzinRecord[]> {
    await ensureConnection();
    if (isPgActive && pgPool) {
      let q = 'SELECT id, nisn, nama, kelas, jenis, tanggal_mulai as "tanggalMulai", tanggal_selesai as "tanggalSelesai", keterangan, dokumen_url as "dokumenUrl", status, catatan_admin as "catatanAdmin", reviewed_at as "reviewedAt", reviewed_by as "reviewedBy", created_at as "createdAt" FROM pengajuan_izin WHERE 1=1';
      const params: any[] = [];
      if (filter?.nisn) {
        params.push(filter.nisn);
        q += ` AND nisn = $${params.length}`;
      }
      if (filter?.status && filter.status !== 'SEMUA') {
        params.push(filter.status);
        q += ` AND status = $${params.length}`;
      }
      if (filter?.kelas && filter.kelas !== 'SEMUA') {
        const arr = filter.kelas.split(',').map(k => k.trim()).filter(Boolean);
        if (arr.length > 0) {
          params.push(arr);
          q += ` AND kelas = ANY($${params.length})`;
        }
      }
      q += ' ORDER BY id DESC';
      const res = await pgPool.query(q, params);
      return res.rows;
    }

    let list = [...memoryPengajuanIzin];
    if (filter?.nisn) list = list.filter(p => p.nisn === filter.nisn);
    if (filter?.status && filter.status !== 'SEMUA') list = list.filter(p => p.status === filter.status);
    if (filter?.kelas && filter.kelas !== 'SEMUA') {
      const arr = filter.kelas.split(',').map(k => k.trim().toUpperCase());
      list = list.filter(p => arr.includes(p.kelas.toUpperCase()));
    }
    return list.sort((a, b) => b.id - a.id);
  },

  async createPengajuan(p: Omit<PengajuanIzinRecord, 'id' | 'status' | 'createdAt'>): Promise<PengajuanIzinRecord> {
    await ensureConnection();
    const nowStr = new Date().toISOString();
    if (isPgActive && pgPool) {
      const res = await pgPool.query(
        'INSERT INTO pengajuan_izin (nisn, nama, kelas, jenis, tanggal_mulai, tanggal_selesai, keterangan, dokumen_url, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, nisn, nama, kelas, jenis, tanggal_mulai as "tanggalMulai", tanggal_selesai as "tanggalSelesai", keterangan, dokumen_url as "dokumenUrl", status, catatan_admin as "catatanAdmin", created_at as "createdAt"',
        [p.nisn, p.nama, p.kelas, p.jenis, p.tanggalMulai, p.tanggalSelesai, p.keterangan, p.dokumenUrl || '', 'Menunggu Persetujuan']
      );
      return res.rows[0];
    }

    const rec: PengajuanIzinRecord = {
      id: Date.now(),
      status: 'Menunggu Persetujuan',
      createdAt: nowStr,
      ...p,
    };
    memoryPengajuanIzin.unshift(rec);
    return rec;
  },

  async reviewPengajuan(id: number, status: 'Disetujui' | 'Ditolak', catatanAdmin = '', adminName = 'Admin'): Promise<PengajuanIzinRecord | null> {
    await ensureConnection();
    const nowStr = new Date().toLocaleString('id-ID');

    let target: PengajuanIzinRecord | null = null;
    if (isPgActive && pgPool) {
      const res = await pgPool.query(
        'UPDATE pengajuan_izin SET status = $1, catatan_admin = $2, reviewed_at = $3, reviewed_by = $4 WHERE id = $5 RETURNING id, nisn, nama, kelas, jenis, tanggal_mulai as "tanggalMulai", tanggal_selesai as "tanggalSelesai", keterangan, status',
        [status, catatanAdmin, nowStr, adminName, id]
      );
      target = res.rows[0] || null;
    } else {
      const idx = memoryPengajuanIzin.findIndex(item => item.id === id);
      if (idx !== -1) {
        memoryPengajuanIzin[idx].status = status;
        memoryPengajuanIzin[idx].catatanAdmin = catatanAdmin;
        memoryPengajuanIzin[idx].reviewedAt = nowStr;
        memoryPengajuanIzin[idx].reviewedBy = adminName;
        target = memoryPengajuanIzin[idx];
      }
    }

    // If approved, automatically propagate Izin/Sakit to the absensi records for all dates in the range!
    if (target && status === 'Disetujui') {
      const startDate = new Date(target.tanggalMulai + 'T00:00:00');
      const endDate = new Date(target.tanggalSelesai + 'T00:00:00');
      
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;

        await this.updateAbsensiStatus(
          dStr,
          target.nisn,
          target.nama,
          target.kelas,
          target.jenis,
          ''
        );

        if (isPgActive && pgPool) {
          await pgPool.query(
            'UPDATE absensi SET keterangan = $1 WHERE tanggal = $2 AND nisn = $3',
            [`${target.jenis} disetujui Admin: ${target.keterangan}`, dStr, target.nisn]
          );
        } else {
          const a = memoryAbsensi.find(x => x.tanggal === dStr && x.nisn === target.nisn);
          if (a) a.keterangan = `${target.jenis} disetujui Admin: ${target.keterangan}`;
        }

        cur.setDate(cur.getDate() + 1);
      }
    }

    return target;
  },

  async getAbsensiMonthByNisn(nisn: string, ym: string): Promise<AbsensiRecord[]> {
    const clean = nisn.replace(/'/g, '').trim();
    await ensureConnection();
    if (isPgActive && pgPool) {
      const res = await pgPool.query(
        'SELECT id, tanggal, nisn, nama, kelas, jam_datang as "jamDatang", jam_pulang as "jamPulang", keterangan, status FROM absensi WHERE nisn = $1 AND tanggal LIKE $2 ORDER BY tanggal ASC',
        [clean, ym + '%']
      );
      return res.rows;
    }
    return memoryAbsensi.filter(a => a.nisn === clean && a.tanggal.startsWith(ym));
  },

  async clearAcademicYear(): Promise<void> {
    await ensureConnection();
    if (isPgActive && pgPool) {
      await pgPool.query('DELETE FROM absensi');
      await pgPool.query('DELETE FROM absensi_sholat');
      return;
    }
    memoryAbsensi.length = 0;
    memoryAbsensiSholat.length = 0;
  },

  getDatabaseStatus() {
    const rawConn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    const connStr = cleanConnectionString(rawConn);
    const host = process.env.SQL_HOST;
    const isSupabase = Boolean(connStr?.includes('supabase') || host?.includes('supabase'));
    return {
      connected: isPgActive,
      provider: isPgActive ? (isSupabase ? 'Supabase PostgreSQL Cloud' : 'PostgreSQL Server') : 'In-Memory Cache (Preview)',
      host: host || (connStr ? 'Supabase Connection URI' : 'Local Fallback'),
      database: process.env.SQL_DB_NAME || (connStr ? 'postgres (Supabase)' : 'absensi_db'),
      ssl: Boolean(isSupabase || process.env.SQL_SSL === 'true'),
      hasEnv: Boolean(rawConn || host),
      lastError: isPgActive ? null : pgLastError,
    };
  }
};
