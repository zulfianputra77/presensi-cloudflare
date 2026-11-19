/**
 * Turso (libSQL / SQLite Edge) HTTP Pipeline Adapter for Cloudflare Workers
 * Menggunakan Turso Hrana v2 HTTP API (`/v2/pipeline`) melalui `fetch()` bawaan
 * tanpa memerlukan package tambahan dan 100% kompatibel dengan Cloudflare Workers.
 */

import type {
  AbsensiRecord,
  AbsensiSholatRecord,
  HariLiburRecord,
  KelasRecord,
  PagesEnv,
  PengajuanIzinRecord,
  SessionRecord,
  SiswaRecord,
  UserRecord,
} from './supabase.ts';

type HranaArg =
  | { type: 'null' }
  | { type: 'text'; value: string }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number };

interface HranaCell {
  type: 'null' | 'text' | 'integer' | 'float' | 'blob';
  value?: string | number | null;
  base64?: string;
}

interface HranaCol {
  name: string;
  decltype?: string | null;
}

interface HranaExecuteResult {
  cols: HranaCol[];
  rows: HranaCell[][];
  affected_row_count: number;
  last_insert_rowid: string | null;
}

const DEFAULT_CONFIG: Record<string, string> = {
  jam_masuk_mulai: '06:00',
  jam_masuk_akhir: '07:15',
  jam_pulang_mulai: '15:00',
  jam_pulang_akhir: '17:00',
  mode_absen: 'masuk_pulang',
  jadwal_harian: JSON.stringify({
    '1': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '2': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '3': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '4': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '5': { libur: false, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '6': { libur: true, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
    '7': { libur: true, masuk_mulai: '06:00', masuk_akhir: '07:15', pulang_mulai: '15:00', pulang_akhir: '17:00' },
  }),
};

function normalizeTursoHttpUrl(rawUrl?: string): string {
  const clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (clean.startsWith('libsql://')) {
    return 'https://' + clean.slice('libsql://'.length);
  }
  if (clean.startsWith('wss://')) {
    return 'https://' + clean.slice('wss://'.length);
  }
  if (clean.startsWith('ws://')) {
    return 'http://' + clean.slice('ws://'.length);
  }
  return clean;
}

function toHranaArg(val: unknown): HranaArg {
  if (val === null || val === undefined) {
    return { type: 'null' };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { type: 'integer', value: String(val) };
    }
    return { type: 'float', value: val };
  }
  return { type: 'text', value: String(val) };
}

function fromHranaCell(cell: HranaCell): any {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer' || cell.type === 'float') return Number(cell.value);
  if (cell.type === 'blob') return cell.base64 ?? '';
  return cell.value !== undefined && cell.value !== null ? String(cell.value) : '';
}

function parseRows<T = Record<string, any>>(result: HranaExecuteResult): T[] {
  const cols = result.cols.map((c) => c.name);
  return result.rows.map((row) => {
    const obj: Record<string, any> = {};
    cols.forEach((colName, idx) => {
      obj[colName] = fromHranaCell(row[idx]);
    });
    return obj as T;
  });
}

let schemaInitializedForUrl: string | null = null;
let schemaInitPromise: Promise<void> | null = null;

export function hasTursoConfig(env: PagesEnv): boolean {
  return Boolean(normalizeTursoHttpUrl(env.TURSO_DATABASE_URL) && (env.TURSO_AUTH_TOKEN || '').trim());
}

export class TursoStorage {
  private baseUrl: string;
  private authToken: string;

  constructor(env: PagesEnv) {
    this.baseUrl = normalizeTursoHttpUrl(env.TURSO_DATABASE_URL);
    this.authToken = (env.TURSO_AUTH_TOKEN || '').trim();
  }

  hasConfig(): boolean {
    return Boolean(this.baseUrl && this.authToken);
  }

  private async pipeline(statements: Array<{ sql: string; args?: unknown[] }>): Promise<HranaExecuteResult[]> {
    if (!this.hasConfig()) {
      throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN belum diatur di Environment Variables Cloudflare.');
    }

    const requests = [
      ...statements.map((s) => ({
        type: 'execute',
        stmt: {
          sql: s.sql,
          args: (s.args || []).map(toHranaArg),
        },
      })),
      { type: 'close' },
    ];

    const res = await fetch(`${this.baseUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Turso HTTP error (${res.status}): ${text}`);
    }

    const json = (await res.json()) as {
      results: Array<{
        type: 'ok' | 'error';
        error?: { message: string; code?: string };
        response?: { type: string; result?: HranaExecuteResult };
      }>;
    };

    const output: HranaExecuteResult[] = [];
    for (let i = 0; i < statements.length; i++) {
      const item = json.results[i];
      if (!item || item.type === 'error') {
        throw new Error(`Turso SQL error: ${item?.error?.message || 'Unknown error'}`);
      }
      if (item.response?.result) {
        output.push(item.response.result);
      }
    }
    return output;
  }

  private async query<T = Record<string, any>>(sql: string, args: unknown[] = []): Promise<T[]> {
    await this.ensureSchema();
    const [result] = await this.pipeline([{ sql, args }]);
    return result ? parseRows<T>(result) : [];
  }

  private async execute(sql: string, args: unknown[] = []): Promise<HranaExecuteResult> {
    await this.ensureSchema();
    const [result] = await this.pipeline([{ sql, args }]);
    return result;
  }

  private async ensureSchema(force = false): Promise<void> {
    if (!this.hasConfig()) return;
    if (!force && schemaInitializedForUrl === this.baseUrl) return;
    if (schemaInitPromise) {
      await schemaInitPromise;
      return;
    }

    schemaInitPromise = (async () => {

    await this.pipeline([
      {
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uid TEXT UNIQUE,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          nama TEXT,
          kelas TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS kelas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama TEXT NOT NULL UNIQUE,
          urutan INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS siswa (
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
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas)` },
      { sql: `CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON siswa(nisn)` },
      {
        sql: `CREATE TABLE IF NOT EXISTS absensi (
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
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_absensi_tgl_nisn ON absensi(tanggal, nisn)` },
      { sql: `CREATE INDEX IF NOT EXISTS idx_absensi_tgl_kelas ON absensi(tanggal, kelas)` },
      { sql: `CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal)` },
      {
        sql: `CREATE TABLE IF NOT EXISTS absensi_sholat (
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
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_sholat_tgl_waktu ON absensi_sholat(tanggal, waktu_sholat, kelas)` },
      {
        sql: `CREATE TABLE IF NOT EXISTS hari_libur (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tanggal TEXT NOT NULL UNIQUE,
          keterangan TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS konfigurasi (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          keterangan TEXT
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS log_notifikasi_wa (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          waktu_dikirim TEXT NOT NULL,
          tanggal_absensi TEXT NOT NULL,
          nisn TEXT NOT NULL,
          nama TEXT NOT NULL,
          kelas TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Sudah Dikirim',
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_log_wa_tgl_nisn ON log_notifikasi_wa(tanggal_absensi, nisn)` },
      {
        sql: `CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL UNIQUE,
          identifier TEXT NOT NULL,
          role TEXT NOT NULL,
          nama TEXT,
          kelas TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)` },
      {
        sql: `CREATE TABLE IF NOT EXISTS pengajuan_izin (
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
        )`,
      },
      { sql: `CREATE INDEX IF NOT EXISTS idx_pengajuan_nisn ON pengajuan_izin(nisn)` },
      { sql: `CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan_izin(status)` },
    ]);

    // Seed initial default data only once if seed_completed is not set
    const [seedRes] = await this.pipeline([
      { sql: `SELECT value FROM konfigurasi WHERE key = 'seed_completed' LIMIT 1` },
    ]);
    const seedRows = seedRes ? parseRows<{ value: string }>(seedRes) : [];
    const alreadySeeded = seedRows.length > 0 && seedRows[0].value === 'true';

    if (!alreadySeeded) {
      await this.pipeline([
        {
          sql: `INSERT OR IGNORE INTO users (username, password, role, nama, kelas) VALUES
            ('admin', 'admin123', 'admin', 'Administrator Sekolah', ''),
            ('guru1', 'guru123', 'guru', 'Guru Wali Kelas VII', 'VII A,VII B'),
            ('wakel', 'wakel123', 'wakel', 'Wakil Kepala Sekolah', '')`,
        },
        {
          sql: `INSERT OR IGNORE INTO kelas (nama, urutan) VALUES
            ('VII A', 1), ('VII B', 2), ('VII C', 3),
            ('VIII A', 4), ('VIII B', 5), ('IX A', 6), ('IX B', 7)`,
        },
        {
          sql: `INSERT OR IGNORE INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat) VALUES
            ('1234567890', 'Ahmad Rizki', 'Laki-laki', '2010-05-15', 'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890', 'VII A', 'Jl. Merdeka No. 10, Jambi'),
            ('1234567891', 'Siti Nurhaliza', 'Perempuan', '2010-08-20', 'Islam', 'Usman', 'Farida', '081298765432', 'VII A', 'Jl. Sudirman No. 25, Jambi'),
            ('1234567892', 'Budi Santoso', 'Laki-laki', '2010-03-12', 'Islam', 'Joko', 'Sri Rahayu', '081345678901', 'VII B', 'Jl. Pahlawan No. 7, Jambi'),
            ('1234567893', 'Dewi Sartika', 'Perempuan', '2010-11-04', 'Islam', 'Hendra', 'Ratna', '081278901234', 'VII B', 'Jl. Melati No. 15, Jambi'),
            ('1234567894', 'Kevin Pratama', 'Laki-laki', '2010-07-22', 'Kristen', 'Daniel', 'Maria', '081389012345', 'VII C', 'Jl. Kenanga No. 8, Jambi'),
            ('1234567895', 'Rian Ardiansyah', 'Laki-laki', '2009-02-18', 'Islam', 'Herman', 'Yuliana', '081290123456', 'VIII A', 'Jl. Anggrek No. 12, Jambi'),
            ('1234567896', 'Putri Ayu', 'Perempuan', '2009-09-30', 'Islam', 'Suhartono', 'Endang', '081301234567', 'VIII B', 'Jl. Mawar No. 3, Jambi')`,
        },
        ...Object.entries(DEFAULT_CONFIG).map(([key, val]) => ({
          sql: `INSERT OR IGNORE INTO konfigurasi (key, value) VALUES (?, ?)`,
          args: [key, val],
        })),
        {
          sql: `INSERT INTO konfigurasi (key, value) VALUES ('seed_completed', 'true')
                ON CONFLICT(key) DO UPDATE SET value = 'true'`,
        },
      ]);
    }

    schemaInitializedForUrl = this.baseUrl;
    })();

    try {
      await schemaInitPromise;
    } finally {
      schemaInitPromise = null;
    }
  }

  async forceInitSchema() {
    schemaInitializedForUrl = null;
    await this.ensureSchema(true);
    const tables = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    );
    return tables.map((t) => t.name);
  }

  async checkConnection() {
    if (!this.hasConfig()) {
      return {
        connected: false,
        provider: 'Cloudflare Workers (Turso belum dikonfigurasi)',
        host: 'Belum diatur',
        database: 'turso (libSQL)',
        ssl: true,
        hasEnv: false,
        lastError: 'TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN belum diatur di Environment Variables Cloudflare',
      };
    }

    try {
      await this.query('SELECT COUNT(*) as total FROM konfigurasi');
      return {
        connected: true,
        provider: 'Turso libSQL Cloud (Cloudflare Workers)',
        host: new URL(this.baseUrl).hostname,
        database: 'libSQL (Turso Edge)',
        ssl: true,
        hasEnv: true,
        lastError: null,
      };
    } catch (err: any) {
      schemaInitializedForUrl = null;
      return {
        connected: false,
        provider: 'Turso libSQL Cloud (Cloudflare Workers)',
        host: this.baseUrl,
        database: 'libSQL (Turso Edge)',
        ssl: true,
        hasEnv: true,
        lastError: err?.message || String(err),
      };
    }
  }

  // Users
  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const rows = await this.query<UserRecord>(
      'SELECT id, username, password, role, nama, kelas FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username]
    );
    return rows[0] || null;
  }

  async getAllGuru(): Promise<UserRecord[]> {
    return this.query<UserRecord>(
      "SELECT id, username, password, role, nama, kelas FROM users WHERE role = 'guru' ORDER BY username ASC"
    );
  }

  async createGuru(u: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    const rows = await this.query<UserRecord>(
      'INSERT INTO users (username, password, role, nama, kelas) VALUES (?, ?, ?, ?, ?) RETURNING id, username, password, role, nama, kelas',
      [u.username, u.password, u.role, u.nama, u.kelas]
    );
    return rows[0];
  }

  async updateGuru(oldUsername: string, u: Partial<UserRecord>): Promise<void> {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (u.username !== undefined) {
      sets.push('username = ?');
      args.push(u.username);
    }
    if (u.password !== undefined) {
      sets.push('password = ?');
      args.push(u.password);
    }
    if (u.kelas !== undefined) {
      sets.push('kelas = ?');
      args.push(u.kelas);
    }
    if (sets.length === 0) return;
    args.push(oldUsername);
    await this.execute(`UPDATE users SET ${sets.join(', ')} WHERE username = ?`, args);
  }

  async deleteGuru(username: string): Promise<void> {
    await this.execute('DELETE FROM users WHERE username = ?', [username]);
  }

  // Sessions
  async createSession(s: SessionRecord): Promise<void> {
    await this.execute(
      'INSERT INTO sessions (token, identifier, role, nama, kelas, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [s.token, s.identifier, s.role, s.nama, s.kelas, s.expiresAt]
    );
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    const rows = await this.query<any>(
      'SELECT token, identifier, role, nama, kelas, expires_at FROM sessions WHERE token = ? LIMIT 1',
      [token]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      token: r.token,
      identifier: r.identifier,
      role: r.role,
      nama: r.nama || '',
      kelas: r.kelas || '',
      expiresAt: r.expires_at,
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.execute('DELETE FROM sessions WHERE token = ?', [token]);
  }

  // Siswa
  private mapSiswa(r: any): SiswaRecord {
    return {
      id: Number(r.id),
      nisn: String(r.nisn),
      nama: String(r.nama),
      jenisKelamin: r.jenis_kelamin || '',
      tanggalLahir: r.tanggal_lahir || '',
      agama: r.agama || '',
      namaAyah: r.nama_ayah || '',
      namaIbu: r.nama_ibu || '',
      noHp: r.no_hp || '',
      kelas: r.kelas || '',
      alamat: r.alamat || '',
    };
  }

  async getAllSiswa(filterKelas?: string): Promise<SiswaRecord[]> {
    let sql =
      'SELECT id, nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat FROM siswa';
    const args: unknown[] = [];
    if (filterKelas && filterKelas !== 'SEMUA') {
      const arr = filterKelas.split(',').map((k) => k.trim()).filter(Boolean);
      if (arr.length > 0) {
        sql += ` WHERE kelas IN (${arr.map(() => '?').join(', ')})`;
        args.push(...arr);
      }
    }
    sql += ' ORDER BY nama ASC';
    const rows = await this.query<any>(sql, args);
    return rows.map((r) => this.mapSiswa(r));
  }

  async findSiswaByNisn(nisn: string): Promise<SiswaRecord | null> {
    const clean = nisn.replace(/'/g, '').trim();
    const rows = await this.query<any>(
      'SELECT id, nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat FROM siswa WHERE nisn = ? LIMIT 1',
      [clean]
    );
    return rows[0] ? this.mapSiswa(rows[0]) : null;
  }

  async createSiswa(s: Omit<SiswaRecord, 'id'>): Promise<SiswaRecord> {
    const cleanNisn = s.nisn.replace(/'/g, '').trim();
    const rows = await this.query<any>(
      'INSERT INTO siswa (nisn, nama, jenis_kelamin, tanggal_lahir, agama, nama_ayah, nama_ibu, no_hp, kelas, alamat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
      [
        cleanNisn,
        s.nama,
        s.jenisKelamin,
        s.tanggalLahir,
        s.agama,
        s.namaAyah,
        s.namaIbu,
        s.noHp,
        s.kelas,
        s.alamat,
      ]
    );
    return this.mapSiswa(rows[0]);
  }

  async updateSiswa(oldNisn: string, s: Partial<SiswaRecord>): Promise<void> {
    const cleanOld = oldNisn.replace(/'/g, '').trim();
    const sets: string[] = [];
    const args: unknown[] = [];

    if (s.nama !== undefined) { sets.push('nama = ?'); args.push(s.nama); }
    if (s.jenisKelamin !== undefined) { sets.push('jenis_kelamin = ?'); args.push(s.jenisKelamin); }
    if (s.tanggalLahir !== undefined) { sets.push('tanggal_lahir = ?'); args.push(s.tanggalLahir); }
    if (s.agama !== undefined) { sets.push('agama = ?'); args.push(s.agama); }
    if (s.namaAyah !== undefined) { sets.push('nama_ayah = ?'); args.push(s.namaAyah); }
    if (s.namaIbu !== undefined) { sets.push('nama_ibu = ?'); args.push(s.namaIbu); }
    if (s.noHp !== undefined) { sets.push('no_hp = ?'); args.push(s.noHp); }
    if (s.kelas !== undefined) { sets.push('kelas = ?'); args.push(s.kelas); }
    if (s.alamat !== undefined) { sets.push('alamat = ?'); args.push(s.alamat); }

    if (sets.length === 0) return;
    args.push(cleanOld);
    await this.execute(`UPDATE siswa SET ${sets.join(', ')} WHERE nisn = ?`, args);
  }

  async deleteSiswa(nisn: string): Promise<void> {
    const clean = nisn.replace(/'/g, '').trim();
    await this.ensureSchema();
    await this.pipeline([
      { sql: 'DELETE FROM absensi WHERE TRIM(nisn) = ? OR nisn = ?', args: [clean, clean] },
      { sql: 'DELETE FROM absensi_sholat WHERE TRIM(nisn) = ? OR nisn = ?', args: [clean, clean] },
      { sql: 'DELETE FROM log_notifikasi_wa WHERE TRIM(nisn) = ? OR nisn = ?', args: [clean, clean] },
      { sql: 'DELETE FROM siswa WHERE TRIM(nisn) = ? OR nisn = ?', args: [clean, clean] },
    ]);
  }

  // Kelas
  async getAllKelas(): Promise<string[]> {
    const rows = await this.query<{ nama: string }>('SELECT nama FROM kelas ORDER BY nama ASC');
    return rows.map((r) => r.nama);
  }

  async getKelasMaster(): Promise<KelasRecord[]> {
    return this.query<KelasRecord>('SELECT id, nama, urutan FROM kelas ORDER BY nama ASC');
  }

  async createKelas(nama: string): Promise<KelasRecord> {
    const rows = await this.query<KelasRecord>(
      'INSERT INTO kelas (nama) VALUES (?) RETURNING id, nama, urutan',
      [nama]
    );
    return rows[0];
  }

  async updateKelas(id: number, namaBaru: string): Promise<void> {
    const oldRows = await this.query<{ nama: string }>('SELECT nama FROM kelas WHERE id = ? LIMIT 1', [id]);
    const oldName = oldRows[0]?.nama;
    await this.execute('UPDATE kelas SET nama = ? WHERE id = ?', [namaBaru, id]);
    if (oldName) {
      await this.execute('UPDATE siswa SET kelas = ? WHERE kelas = ?', [namaBaru, oldName]);
    }
  }

  async deleteKelas(id: number): Promise<void> {
    await this.execute('DELETE FROM kelas WHERE id = ?', [id]);
  }

  // Hari Libur
  async getAllHariLibur(): Promise<HariLiburRecord[]> {
    return this.query<HariLiburRecord>('SELECT id, tanggal, keterangan FROM hari_libur ORDER BY tanggal DESC');
  }

  async addHariLibur(tanggal: string, keterangan: string): Promise<void> {
    await this.execute(
      'INSERT INTO hari_libur (tanggal, keterangan) VALUES (?, ?) ON CONFLICT(tanggal) DO UPDATE SET keterangan = excluded.keterangan',
      [tanggal, keterangan]
    );
  }

  async deleteHariLibur(tanggal: string): Promise<void> {
    await this.execute('DELETE FROM hari_libur WHERE tanggal = ?', [tanggal]);
  }

  // Konfigurasi
  async getConfig(): Promise<Record<string, string>> {
    const rows = await this.query<{ key: string; value: string }>('SELECT key, value FROM konfigurasi');
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return { ...DEFAULT_CONFIG, ...map };
  }

  async saveConfigKey(key: string, value: string): Promise<void> {
    await this.execute(
      'INSERT INTO konfigurasi (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }

  // Absensi
  private mapAbsensi(r: any): AbsensiRecord {
    return {
      id: Number(r.id),
      tanggal: r.tanggal,
      nisn: r.nisn,
      nama: r.nama,
      kelas: r.kelas,
      jamDatang: r.jam_datang || '',
      jamPulang: r.jam_pulang || '',
      keterangan: r.keterangan || '',
      status: r.status || 'Hadir',
    };
  }

  async getAbsensiToday(tanggal: string, nisn: string): Promise<AbsensiRecord | null> {
    const rows = await this.query<any>(
      'SELECT id, tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status FROM absensi WHERE tanggal = ? AND nisn = ? LIMIT 1',
      [tanggal, nisn]
    );
    return rows[0] ? this.mapAbsensi(rows[0]) : null;
  }

  async getAbsensiByDate(tanggal: string): Promise<AbsensiRecord[]> {
    const rows = await this.query<any>(
      'SELECT id, tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status FROM absensi WHERE tanggal = ?',
      [tanggal]
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async getAbsensiRange(startDate: string, endDate: string): Promise<AbsensiRecord[]> {
    const rows = await this.query<any>(
      'SELECT id, tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status FROM absensi WHERE tanggal >= ? AND tanggal <= ?',
      [startDate, endDate]
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async getAbsensiMonthByNisn(nisn: string, ym: string): Promise<AbsensiRecord[]> {
    const clean = nisn.replace(/'/g, '').trim();
    const rows = await this.query<any>(
      'SELECT id, tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status FROM absensi WHERE nisn = ? AND tanggal LIKE ? ORDER BY tanggal ASC',
      [clean, ym + '%']
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async recordAbsensiMasuk(rec: Omit<AbsensiRecord, 'id'>): Promise<AbsensiRecord> {
    const rows = await this.query<any>(
      'INSERT INTO absensi (tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status',
      [
        rec.tanggal,
        rec.nisn,
        rec.nama,
        rec.kelas,
        rec.jamDatang,
        rec.jamPulang || '',
        rec.keterangan || '',
        rec.status || 'Hadir',
      ]
    );
    return this.mapAbsensi(rows[0]);
  }

  async recordAbsensiPulang(id: number, jamPulang: string, keterangan: string): Promise<void> {
    await this.execute('UPDATE absensi SET jam_pulang = ?, keterangan = ? WHERE id = ?', [
      jamPulang,
      keterangan,
      id,
    ]);
  }

  async updateAbsensiStatus(
    tanggal: string,
    nisn: string,
    nama: string,
    kelas: string,
    status: string,
    jamDatang?: string
  ): Promise<void> {
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

    const existing = await this.query<{ id: number; jam_datang: string }>(
      'SELECT id, jam_datang FROM absensi WHERE tanggal = ? AND nisn = ? LIMIT 1',
      [tanggal, nisn]
    );

    if (existing.length > 0) {
      const jd = isHadir ? existing[0].jam_datang || jamDatang || '07:00:00' : existing[0].jam_datang;
      await this.execute('UPDATE absensi SET status = ?, jam_datang = ? WHERE id = ?', [
        canonicalStatus,
        jd,
        existing[0].id,
      ]);
    } else {
      await this.execute(
        'INSERT INTO absensi (tanggal, nisn, nama, kelas, jam_datang, jam_pulang, keterangan, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          tanggal,
          nisn,
          nama,
          kelas,
          isHadir ? jamDatang || '07:00:00' : '',
          '',
          isHadir ? 'Tepat Waktu' : 'Status Manual',
          canonicalStatus,
        ]
      );
    }
  }

  // Sholat
  private mapSholat(r: any): AbsensiSholatRecord {
    return {
      id: Number(r.id),
      tanggal: r.tanggal,
      nisn: r.nisn,
      nama: r.nama,
      kelas: r.kelas,
      waktuSholat: r.waktu_sholat,
      status: r.status,
      keterangan: r.keterangan || '',
      inputOleh: r.input_oleh || '',
    };
  }

  async getSholatByDate(tanggal: string, waktuSholat?: string): Promise<AbsensiSholatRecord[]> {
    let sql =
      'SELECT id, tanggal, nisn, nama, kelas, waktu_sholat, status, keterangan, input_oleh FROM absensi_sholat WHERE tanggal = ?';
    const args: unknown[] = [tanggal];
    if (waktuSholat) {
      sql += ' AND waktu_sholat = ?';
      args.push(waktuSholat);
    }
    const rows = await this.query<any>(sql, args);
    return rows.map((r) => this.mapSholat(r));
  }

  async getSholatMonth(ym: string): Promise<AbsensiSholatRecord[]> {
    const rows = await this.query<any>(
      'SELECT id, tanggal, nisn, nama, kelas, waktu_sholat, status, keterangan, input_oleh FROM absensi_sholat WHERE tanggal LIKE ? ORDER BY tanggal ASC',
      [ym + '%']
    );
    return rows.map((r) => this.mapSholat(r));
  }

  async saveSholatRecords(tanggal: string, waktuSholat: string, list: any[], inputOleh: string): Promise<void> {
    if (list.length === 0) return;
    await this.ensureSchema();
    const nisnArr = list.map((l) => String(l.nisn));
    const stmts: Array<{ sql: string; args?: unknown[] }> = [
      {
        sql: `DELETE FROM absensi_sholat WHERE tanggal = ? AND waktu_sholat = ? AND nisn IN (${nisnArr.map(() => '?').join(', ')})`,
        args: [tanggal, waktuSholat, ...nisnArr],
      },
      ...list.map((item) => ({
        sql: 'INSERT INTO absensi_sholat (tanggal, nisn, nama, kelas, waktu_sholat, status, keterangan, input_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          tanggal,
          item.nisn,
          item.nama,
          item.kelas,
          waktuSholat,
          item.status,
          item.keterangan || '',
          inputOleh || 'Guru',
        ],
      })),
    ];
    await this.pipeline(stmts);
  }

  // WhatsApp Log
  async getWaStatus(tanggal: string): Promise<Record<string, { sudahDikirim: boolean; waktu: string }>> {
    const rows = await this.query<{ nisn: string; waktu_dikirim: string }>(
      'SELECT nisn, waktu_dikirim FROM log_notifikasi_wa WHERE tanggal_absensi = ?',
      [tanggal]
    );
    const result: Record<string, { sudahDikirim: boolean; waktu: string }> = {};
    rows.forEach((r) => {
      result[r.nisn] = { sudahDikirim: true, waktu: r.waktu_dikirim };
    });
    return result;
  }

  async recordWaSent(nisn: string, tanggal: string): Promise<void> {
    const s = await this.findSiswaByNisn(nisn);
    if (!s) return;

    const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    await this.execute(
      'INSERT INTO log_notifikasi_wa (waktu_dikirim, tanggal_absensi, nisn, nama, kelas, status) VALUES (?, ?, ?, ?, ?, ?)',
      [nowStr, tanggal, nisn, s.nama, s.kelas, 'Sudah Dikirim']
    );
  }

  // Pengajuan Izin & Sakit
  private mapPengajuan(r: any): PengajuanIzinRecord {
    return {
      id: Number(r.id),
      nisn: r.nisn,
      nama: r.nama,
      kelas: r.kelas,
      jenis: r.jenis,
      tanggalMulai: r.tanggal_mulai,
      tanggalSelesai: r.tanggal_selesai,
      keterangan: r.keterangan,
      dokumenUrl: r.dokumen_url || '',
      status: r.status,
      catatanAdmin: r.catatan_admin || '',
      reviewedAt: r.reviewed_at || '',
      reviewedBy: r.reviewed_by || '',
      createdAt: r.created_at,
    };
  }

  async getAllPengajuan(filter?: { nisn?: string; status?: string; kelas?: string }): Promise<PengajuanIzinRecord[]> {
    let sql =
      'SELECT id, nisn, nama, kelas, jenis, tanggal_mulai, tanggal_selesai, keterangan, dokumen_url, status, catatan_admin, reviewed_at, reviewed_by, created_at FROM pengajuan_izin WHERE 1=1';
    const args: unknown[] = [];

    if (filter?.nisn) {
      sql += ' AND nisn = ?';
      args.push(filter.nisn);
    }
    if (filter?.status && filter.status !== 'SEMUA') {
      sql += ' AND status = ?';
      args.push(filter.status);
    }
    if (filter?.kelas && filter.kelas !== 'SEMUA') {
      const arr = filter.kelas.split(',').map((k) => k.trim()).filter(Boolean);
      if (arr.length > 0) {
        sql += ` AND kelas IN (${arr.map(() => '?').join(', ')})`;
        args.push(...arr);
      }
    }
    sql += ' ORDER BY id DESC';
    const rows = await this.query<any>(sql, args);
    return rows.map((r) => this.mapPengajuan(r));
  }

  async createPengajuan(p: Omit<PengajuanIzinRecord, 'id' | 'status' | 'createdAt'>): Promise<PengajuanIzinRecord> {
    const rows = await this.query<any>(
      'INSERT INTO pengajuan_izin (nisn, nama, kelas, jenis, tanggal_mulai, tanggal_selesai, keterangan, dokumen_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
      [
        p.nisn,
        p.nama,
        p.kelas,
        p.jenis,
        p.tanggalMulai,
        p.tanggalSelesai,
        p.keterangan,
        p.dokumenUrl || '',
        'Menunggu Persetujuan',
      ]
    );
    return this.mapPengajuan(rows[0]);
  }

  async reviewPengajuan(
    id: number,
    status: 'Disetujui' | 'Ditolak',
    catatanAdmin = '',
    adminName = 'Admin'
  ): Promise<PengajuanIzinRecord | null> {
    const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const rows = await this.query<any>(
      'UPDATE pengajuan_izin SET status = ?, catatan_admin = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? RETURNING *',
      [status, catatanAdmin, nowStr, adminName, id]
    );
    const target = rows[0] ? this.mapPengajuan(rows[0]) : null;

    if (target && status === 'Disetujui') {
      const startDate = new Date(target.tanggalMulai + 'T00:00:00');
      const endDate = new Date(target.tanggalSelesai + 'T00:00:00');
      const cur = new Date(startDate);

      while (cur <= endDate) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;

        await this.updateAbsensiStatus(dStr, target.nisn, target.nama, target.kelas, target.jenis, '');
        await this.execute('UPDATE absensi SET keterangan = ? WHERE tanggal = ? AND nisn = ?', [
          `${target.jenis} disetujui Admin: ${target.keterangan}`,
          dStr,
          target.nisn,
        ]);

        cur.setDate(cur.getDate() + 1);
      }
    }

    return target;
  }

  async clearAcademicYear(): Promise<void> {
    await this.ensureSchema();
    await this.pipeline([
      { sql: 'DELETE FROM absensi' },
      { sql: 'DELETE FROM absensi_sholat' },
    ]);
  }
}
