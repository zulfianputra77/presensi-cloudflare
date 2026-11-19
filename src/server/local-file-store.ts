import fs from 'fs';
import path from 'path';
import type {
  UserRecord,
  SiswaRecord,
  KelasRecord,
  AbsensiRecord,
  AbsensiSholatRecord,
  HariLiburRecord,
  SessionRecord,
  LogWaRecord,
  PengajuanIzinRecord,
} from './storage.ts';

interface LocalDatabaseSchema {
  users: UserRecord[];
  kelas: KelasRecord[];
  siswa: SiswaRecord[];
  absensi: AbsensiRecord[];
  absensiSholat: AbsensiSholatRecord[];
  hariLibur: HariLiburRecord[];
  sessions: SessionRecord[];
  logWa: LogWaRecord[];
  pengajuanIzin: PengajuanIzinRecord[];
  config: Record<string, string>;
}

const DEFAULT_LOCAL_DATA: LocalDatabaseSchema = {
  users: [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin', nama: 'Administrator', kelas: '' },
    { id: 2, username: 'guru1', password: 'guru123', role: 'guru', nama: 'Guru Wali Kelas VII', kelas: 'VII A,VII B' },
    { id: 3, username: 'wakel', password: 'wakel123', role: 'wakel', nama: 'Wakil Kepala Sekolah', kelas: '' },
  ],
  kelas: [
    { id: 1, nama: 'VII A', urutan: 1 },
    { id: 2, nama: 'VII B', urutan: 2 },
    { id: 3, nama: 'VII C', urutan: 3 },
    { id: 4, nama: 'VIII A', urutan: 4 },
    { id: 5, nama: 'VIII B', urutan: 5 },
    { id: 6, nama: 'IX A', urutan: 6 },
    { id: 7, nama: 'IX B', urutan: 7 },
  ],
  siswa: [
    { id: 1, nisn: '1234567890', nama: 'Ahmad Rizki', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-05-15', agama: 'Islam', namaAyah: 'Budi Santoso', namaIbu: 'Siti Aminah', noHp: '081234567890', kelas: 'VII A', alamat: 'Jl. Merdeka No. 10, Jambi' },
    { id: 2, nisn: '1234567891', nama: 'Siti Nurhaliza', jenisKelamin: 'Perempuan', tanggalLahir: '2010-08-20', agama: 'Islam', namaAyah: 'Usman', namaIbu: 'Farida', noHp: '081298765432', kelas: 'VII A', alamat: 'Jl. Sudirman No. 25, Jambi' },
    { id: 3, nisn: '1234567892', nama: 'Budi Santoso', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-03-12', agama: 'Islam', namaAyah: 'Joko', namaIbu: 'Sri Rahayu', noHp: '081345678901', kelas: 'VII B', alamat: 'Jl. Pahlawan No. 7, Jambi' },
    { id: 4, nisn: '1234567893', nama: 'Dewi Sartika', jenisKelamin: 'Perempuan', tanggalLahir: '2010-11-04', agama: 'Islam', namaAyah: 'Hendra', namaIbu: 'Ratna', noHp: '081278901234', kelas: 'VII B', alamat: 'Jl. Melati No. 15, Jambi' },
    { id: 5, nisn: '1234567894', nama: 'Kevin Pratama', jenisKelamin: 'Laki-laki', tanggalLahir: '2010-07-22', agama: 'Kristen', namaAyah: 'Daniel', namaIbu: 'Maria', noHp: '081389012345', kelas: 'VII C', alamat: 'Jl. Kenanga No. 8, Jambi' },
    { id: 6, nisn: '1234567895', nama: 'Rian Ardiansyah', jenisKelamin: 'Laki-laki', tanggalLahir: '2009-02-18', agama: 'Islam', namaAyah: 'Herman', namaIbu: 'Yuliana', noHp: '081290123456', kelas: 'VIII A', alamat: 'Jl. Anggrek No. 12, Jambi' },
    { id: 7, nisn: '1234567896', nama: 'Putri Ayu', jenisKelamin: 'Perempuan', tanggalLahir: '2009-09-30', agama: 'Islam', namaAyah: 'Suhartono', namaIbu: 'Endang', noHp: '081301234567', kelas: 'VIII B', alamat: 'Jl. Mawar No. 3, Jambi' },
  ],
  absensi: [],
  absensiSholat: [],
  hariLibur: [],
  sessions: [],
  logWa: [],
  pengajuanIzin: [],
  config: {
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
  },
};

export function createLocalFileStorage(customDbPath?: string) {
  const dbFilePath = path.resolve(customDbPath || process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'data', 'absensi-local-db.json'));
  const dbDir = path.dirname(dbFilePath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  let state: LocalDatabaseSchema;

  const persist = () => {
    const payload = JSON.stringify(state, null, 2);
    const tmpPath = `${dbFilePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, payload, 'utf-8');
      fs.renameSync(tmpPath, dbFilePath);
    } catch {
      fs.writeFileSync(dbFilePath, payload, 'utf-8');
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
    }
  };

  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      state = {
        users: Array.isArray(parsed.users) ? parsed.users : structuredClone(DEFAULT_LOCAL_DATA.users),
        kelas: Array.isArray(parsed.kelas) ? parsed.kelas : structuredClone(DEFAULT_LOCAL_DATA.kelas),
        siswa: Array.isArray(parsed.siswa) ? parsed.siswa : structuredClone(DEFAULT_LOCAL_DATA.siswa),
        absensi: Array.isArray(parsed.absensi) ? parsed.absensi : [],
        absensiSholat: Array.isArray(parsed.absensiSholat) ? parsed.absensiSholat : [],
        hariLibur: Array.isArray(parsed.hariLibur) ? parsed.hariLibur : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        logWa: Array.isArray(parsed.logWa) ? parsed.logWa : [],
        pengajuanIzin: Array.isArray(parsed.pengajuanIzin) ? parsed.pengajuanIzin : [],
        config: parsed.config && typeof parsed.config === 'object'
          ? { ...DEFAULT_LOCAL_DATA.config, ...parsed.config }
          : structuredClone(DEFAULT_LOCAL_DATA.config),
      };
    } catch {
      state = structuredClone(DEFAULT_LOCAL_DATA);
      persist();
    }
  } else {
    state = structuredClone(DEFAULT_LOCAL_DATA);
    persist();
  }

  return {
    getFilePath: () => dbFilePath,
    isPostgres: () => false,

    // Users
    async findUserByUsername(username: string): Promise<UserRecord | null> {
      return state.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
    },

    async getAllGuru(): Promise<UserRecord[]> {
      return state.users.filter((u) => u.role === 'guru').sort((a, b) => a.username.localeCompare(b.username));
    },

    async createGuru(u: Omit<UserRecord, 'id'>): Promise<UserRecord> {
      const rec: UserRecord = { id: Date.now() + Math.floor(Math.random() * 1000), ...u };
      state.users.push(rec);
      persist();
      return rec;
    },

    async updateGuru(oldUsername: string, u: Partial<UserRecord>): Promise<void> {
      const idx = state.users.findIndex((item) => item.username === oldUsername);
      if (idx !== -1) {
        state.users[idx] = { ...state.users[idx], ...u };
        persist();
      }
    },

    async deleteGuru(username: string): Promise<void> {
      state.users = state.users.filter((u) => u.username !== username);
      persist();
    },

    // Sessions
    async createSession(s: SessionRecord): Promise<void> {
      state.sessions.push(s);
      // Clean up expired sessions automatically
      const now = Date.now();
      state.sessions = state.sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
      persist();
    },

    async findSession(token: string): Promise<SessionRecord | null> {
      const s = state.sessions.find((item) => item.token === token);
      return s || null;
    },

    async deleteSession(token: string): Promise<void> {
      state.sessions = state.sessions.filter((s) => s.token !== token);
      persist();
    },

    // Siswa
    async getAllSiswa(filterKelas?: string): Promise<SiswaRecord[]> {
      let list = [...state.siswa];
      if (filterKelas && filterKelas !== 'SEMUA') {
        const arr = filterKelas.split(',').map((k) => k.trim().toUpperCase()).filter(Boolean);
        list = list.filter((s) => arr.includes(s.kelas.toUpperCase()));
      }
      return list.sort((a, b) => a.nama.localeCompare(b.nama));
    },

    async findSiswaByNisn(nisn: string): Promise<SiswaRecord | null> {
      const clean = nisn.replace(/'/g, '').trim();
      return state.siswa.find((s) => s.nisn === clean) || null;
    },

    async createSiswa(s: Omit<SiswaRecord, 'id'>): Promise<SiswaRecord> {
      const cleanNisn = s.nisn.replace(/'/g, '').trim();
      const rec: SiswaRecord = { id: Date.now() + Math.floor(Math.random() * 1000), ...s, nisn: cleanNisn };
      state.siswa.push(rec);
      persist();
      return rec;
    },

    async updateSiswa(oldNisn: string, s: Partial<SiswaRecord>): Promise<void> {
      const cleanOld = oldNisn.replace(/'/g, '').trim();
      const idx = state.siswa.findIndex((item) => item.nisn === cleanOld);
      if (idx !== -1) {
        state.siswa[idx] = { ...state.siswa[idx], ...s };
        persist();
      }
    },

    async deleteSiswa(nisn: string): Promise<void> {
      const clean = nisn.replace(/'/g, '').trim();
      state.siswa = state.siswa.filter((s) => s.nisn !== clean);
      state.absensi = state.absensi.filter((a) => a.nisn.trim() !== clean);
      state.absensiSholat = state.absensiSholat.filter((a) => a.nisn.trim() !== clean);
      state.logWa = state.logWa.filter((l) => l.nisn.trim() !== clean);
      persist();
    },

    // Kelas
    async getAllKelas(): Promise<string[]> {
      return state.kelas.map((k) => k.nama).sort();
    },

    async getKelasMaster(): Promise<KelasRecord[]> {
      return [...state.kelas].sort((a, b) => a.nama.localeCompare(b.nama));
    },

    async createKelas(nama: string): Promise<KelasRecord> {
      const rec: KelasRecord = { id: Date.now() + Math.floor(Math.random() * 1000), nama, urutan: state.kelas.length + 1 };
      state.kelas.push(rec);
      persist();
      return rec;
    },

    async updateKelas(id: number, namaBaru: string): Promise<void> {
      const idx = state.kelas.findIndex((k) => k.id === id);
      if (idx !== -1) {
        const oldName = state.kelas[idx].nama;
        state.kelas[idx].nama = namaBaru;
        state.siswa.forEach((s) => {
          if (s.kelas === oldName) s.kelas = namaBaru;
        });
        persist();
      }
    },

    async deleteKelas(id: number, _namaKelas: string): Promise<void> {
      state.kelas = state.kelas.filter((k) => k.id !== id);
      persist();
    },

    // Hari Libur
    async getAllHariLibur(): Promise<HariLiburRecord[]> {
      return [...state.hariLibur].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    },

    async addHariLibur(tanggal: string, keterangan: string): Promise<void> {
      const existing = state.hariLibur.find((h) => h.tanggal === tanggal);
      if (existing) existing.keterangan = keterangan;
      else state.hariLibur.push({ id: Date.now() + Math.floor(Math.random() * 1000), tanggal, keterangan });
      persist();
    },

    async deleteHariLibur(tanggal: string): Promise<void> {
      state.hariLibur = state.hariLibur.filter((h) => h.tanggal !== tanggal);
      persist();
    },

    // Konfigurasi
    async getConfig(): Promise<Record<string, string>> {
      return { ...state.config };
    },

    async saveConfigKey(key: string, value: string): Promise<void> {
      state.config[key] = value;
      persist();
    },

    // Absensi Realtime
    async getAbsensiToday(tanggal: string, nisn: string): Promise<AbsensiRecord | null> {
      return state.absensi.find((a) => a.tanggal === tanggal && a.nisn === nisn) || null;
    },

    async getAbsensiByDate(tanggal: string): Promise<AbsensiRecord[]> {
      return state.absensi.filter((a) => a.tanggal === tanggal);
    },

    async getAbsensiRange(startDate: string, endDate: string): Promise<AbsensiRecord[]> {
      return state.absensi.filter((a) => a.tanggal >= startDate && a.tanggal <= endDate);
    },

    async recordAbsensiMasuk(rec: Omit<AbsensiRecord, 'id'>): Promise<AbsensiRecord> {
      const item: AbsensiRecord = { id: Date.now() + Math.floor(Math.random() * 1000), ...rec };
      state.absensi.push(item);
      persist();
      return item;
    },

    async recordAbsensiPulang(id: number, jamPulang: string, keterangan: string): Promise<void> {
      const idx = state.absensi.findIndex((a) => a.id === id);
      if (idx !== -1) {
        state.absensi[idx].jamPulang = jamPulang;
        state.absensi[idx].keterangan = keterangan;
        persist();
      }
    },

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

      const idx = state.absensi.findIndex((a) => a.tanggal === tanggal && a.nisn === nisn);
      if (idx !== -1) {
        state.absensi[idx].status = canonicalStatus;
        if (isHadir && !state.absensi[idx].jamDatang) {
          state.absensi[idx].jamDatang = jamDatang || '07:00:00';
        }
      } else {
        state.absensi.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          tanggal,
          nisn,
          nama,
          kelas,
          jamDatang: isHadir ? jamDatang || '07:00:00' : '',
          jamPulang: '',
          keterangan: isHadir ? 'Tepat Waktu' : 'Status Manual',
          status: canonicalStatus,
        });
      }
      persist();
    },

    // Sholat
    async getSholatByDate(tanggal: string, waktuSholat?: string): Promise<AbsensiSholatRecord[]> {
      return state.absensiSholat.filter(
        (s) => s.tanggal === tanggal && (!waktuSholat || s.waktuSholat === waktuSholat)
      );
    },

    async getSholatMonth(ym: string): Promise<AbsensiSholatRecord[]> {
      return state.absensiSholat.filter((s) => s.tanggal.startsWith(ym));
    },

    async saveSholatRecords(tanggal: string, waktuSholat: string, list: any[], inputOleh: string): Promise<void> {
      state.absensiSholat = state.absensiSholat.filter(
        (s) => !(s.tanggal === tanggal && s.waktuSholat === waktuSholat && list.some((l) => l.nisn === s.nisn))
      );
      for (const item of list) {
        state.absensiSholat.push({
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
      persist();
    },

    // WhatsApp Log
    async getWaStatus(tanggal: string): Promise<Record<string, { sudahDikirim: boolean; waktu: string }>> {
      const result: Record<string, { sudahDikirim: boolean; waktu: string }> = {};
      state.logWa
        .filter((l) => l.tanggalAbsensi === tanggal)
        .forEach((l) => {
          result[l.nisn] = { sudahDikirim: true, waktu: l.waktuDikirim };
        });
      return result;
    },

    async recordWaSent(nisn: string, tanggal: string): Promise<void> {
      const nowStr = new Date().toLocaleString('id-ID');
      const s = await this.findSiswaByNisn(nisn);
      if (!s) return;

      state.logWa.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        waktuDikirim: nowStr,
        tanggalAbsensi: tanggal,
        nisn,
        nama: s.nama,
        kelas: s.kelas,
        status: 'Sudah Dikirim',
      });
      persist();
    },

    // Pengajuan Izin & Sakit
    async getAllPengajuan(filter?: { nisn?: string; status?: string; kelas?: string }): Promise<PengajuanIzinRecord[]> {
      let list = [...state.pengajuanIzin];
      if (filter?.nisn) list = list.filter((p) => p.nisn === filter.nisn);
      if (filter?.status && filter.status !== 'SEMUA') list = list.filter((p) => p.status === filter.status);
      if (filter?.kelas && filter.kelas !== 'SEMUA') {
        const arr = filter.kelas.split(',').map((k) => k.trim().toUpperCase());
        list = list.filter((p) => arr.includes(p.kelas.toUpperCase()));
      }
      return list.sort((a, b) => b.id - a.id);
    },

    async createPengajuan(
      p: Omit<PengajuanIzinRecord, 'id' | 'status' | 'createdAt'>
    ): Promise<PengajuanIzinRecord> {
      const rec: PengajuanIzinRecord = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        status: 'Menunggu Persetujuan',
        createdAt: new Date().toISOString(),
        ...p,
      };
      state.pengajuanIzin.unshift(rec);
      persist();
      return rec;
    },

    async reviewPengajuan(
      id: number,
      status: 'Disetujui' | 'Ditolak',
      catatanAdmin = '',
      adminName = 'Admin'
    ): Promise<PengajuanIzinRecord | null> {
      const nowStr = new Date().toLocaleString('id-ID');
      const idx = state.pengajuanIzin.findIndex((item) => item.id === id);
      let target: PengajuanIzinRecord | null = null;

      if (idx !== -1) {
        state.pengajuanIzin[idx].status = status;
        state.pengajuanIzin[idx].catatanAdmin = catatanAdmin;
        state.pengajuanIzin[idx].reviewedAt = nowStr;
        state.pengajuanIzin[idx].reviewedBy = adminName;
        target = state.pengajuanIzin[idx];
        persist();
      }

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
          const a = state.absensi.find((x) => x.tanggal === dStr && x.nisn === target!.nisn);
          if (a) a.keterangan = `${target.jenis} disetujui Admin: ${target.keterangan}`;
          cur.setDate(cur.getDate() + 1);
        }
        persist();
      }

      return target;
    },

    async getAbsensiMonthByNisn(nisn: string, ym: string): Promise<AbsensiRecord[]> {
      const clean = nisn.replace(/'/g, '').trim();
      return state.absensi.filter((a) => a.nisn === clean && a.tanggal.startsWith(ym));
    },

    async clearAcademicYear(): Promise<void> {
      state.absensi = [];
      state.absensiSholat = [];
      persist();
    },

    getDatabaseStatus() {
      return {
        connected: true,
        provider: 'Database Lokal Offline (Hardisk Komputer/Server)',
        host: 'localhost',
        database: dbFilePath,
        ssl: false,
        hasEnv: true,
        lastError: null,
      };
    },
  };
}
