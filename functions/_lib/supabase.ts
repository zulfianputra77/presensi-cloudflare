/**
 * Supabase PostgREST Storage Adapter for Cloudflare Pages Functions
 * Menggunakan HTTPS REST API Supabase (fetch) agar 100% kompatibel dengan Cloudflare Workers runtime
 * tanpa mengubah kode Express/PostgreSQL (Vercel/Node.js) yang sudah ada.
 */

export interface PagesEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_KEY?: string;
  VITE_SUPABASE_URL?: string;
}

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
  tanggal: string;
  nisn: string;
  nama: string;
  kelas: string;
  jamDatang: string;
  jamPulang: string;
  keterangan: string;
  status: string;
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
  expiresAt: string;
}

export interface PengajuanIzinRecord {
  id: number;
  nisn: string;
  nama: string;
  kelas: string;
  jenis: 'Izin' | 'Sakit';
  tanggalMulai: string;
  tanggalSelesai: string;
  keterangan: string;
  dokumenUrl?: string;
  status: 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak';
  catatanAdmin?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
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

function getCredentials(env: PagesEnv) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_KEY ||
    env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key };
}

function encodeInFilter(values: string[]): string {
  const escaped = values.map((v) => `"${v.replace(/"/g, '\\"')}"`);
  return `in.(${escaped.join(',')})`;
}

export class SupabaseRestStorage {
  private baseUrl: string;
  private apiKey: string;

  constructor(env: PagesEnv) {
    const { url, key } = getCredentials(env);
    this.baseUrl = url;
    this.apiKey = key;
  }

  hasConfig(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private async request<T = any>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    if (!this.hasConfig()) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur di Environment Variables Cloudflare Pages.');
    }

    const res = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        apikey: this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase REST error (${res.status}): ${text}`);
    }

    if (res.status === 204) {
      return [] as unknown as T;
    }

    const text = await res.text();
    if (!text) return [] as unknown as T;
    return JSON.parse(text) as T;
  }

  async checkConnection() {
    if (!this.hasConfig()) {
      return {
        connected: false,
        provider: 'Cloudflare Pages (Supabase belum dikonfigurasi)',
        host: 'Belum diatur',
        database: 'postgres (Supabase)',
        ssl: true,
        hasEnv: false,
        lastError: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur di Environment Variables Cloudflare Pages',
      };
    }

    try {
      await this.request('konfigurasi?select=key&limit=1');
      return {
        connected: true,
        provider: 'Supabase PostgreSQL Cloud (Cloudflare Pages)',
        host: new URL(this.baseUrl).hostname,
        database: 'postgres (Supabase)',
        ssl: true,
        hasEnv: true,
        lastError: null,
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: 'Supabase PostgreSQL Cloud (Cloudflare Pages)',
        host: this.baseUrl,
        database: 'postgres (Supabase)',
        ssl: true,
        hasEnv: true,
        lastError: err?.message || String(err),
      };
    }
  }

  // Users
  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const rows = await this.request<UserRecord[]>(
      `users?select=id,username,password,role,nama,kelas&username=eq.${encodeURIComponent(username)}&limit=1`
    );
    return rows[0] || null;
  }

  async getAllGuru(): Promise<UserRecord[]> {
    return this.request<UserRecord[]>(
      `users?select=id,username,password,role,nama,kelas&role=eq.guru&order=username.asc`
    );
  }

  async createGuru(u: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    const rows = await this.request<UserRecord[]>('users', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: u,
    });
    return rows[0];
  }

  async updateGuru(oldUsername: string, u: Partial<UserRecord>): Promise<void> {
    const patch: Record<string, any> = {};
    if (u.username !== undefined) patch.username = u.username;
    if (u.password !== undefined) patch.password = u.password;
    if (u.kelas !== undefined) patch.kelas = u.kelas;
    if (Object.keys(patch).length === 0) return;

    await this.request(`users?username=eq.${encodeURIComponent(oldUsername)}`, {
      method: 'PATCH',
      body: patch,
    });
  }

  async deleteGuru(username: string): Promise<void> {
    await this.request(`users?username=eq.${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
  }

  // Sessions
  async createSession(s: SessionRecord): Promise<void> {
    await this.request('sessions', {
      method: 'POST',
      body: {
        token: s.token,
        identifier: s.identifier,
        role: s.role,
        nama: s.nama,
        kelas: s.kelas,
        expires_at: s.expiresAt,
      },
    });
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    const rows = await this.request<any[]>(
      `sessions?select=token,identifier,role,nama,kelas,expires_at&token=eq.${encodeURIComponent(token)}&limit=1`
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
    await this.request(`sessions?token=eq.${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
  }

  // Siswa
  private mapSiswa(r: any): SiswaRecord {
    return {
      id: r.id,
      nisn: r.nisn,
      nama: r.nama,
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
    let query = 'siswa?select=id,nisn,nama,jenis_kelamin,tanggal_lahir,agama,nama_ayah,nama_ibu,no_hp,kelas,alamat';
    if (filterKelas && filterKelas !== 'SEMUA') {
      const arr = filterKelas.split(',').map((k) => k.trim()).filter(Boolean);
      if (arr.length > 0) {
        query += `&kelas=${encodeURIComponent(encodeInFilter(arr))}`;
      }
    }
    query += '&order=nama.asc';
    const rows = await this.request<any[]>(query);
    return rows.map((r) => this.mapSiswa(r));
  }

  async findSiswaByNisn(nisn: string): Promise<SiswaRecord | null> {
    const clean = nisn.replace(/'/g, '').trim();
    const rows = await this.request<any[]>(
      `siswa?select=id,nisn,nama,jenis_kelamin,tanggal_lahir,agama,nama_ayah,nama_ibu,no_hp,kelas,alamat&nisn=eq.${encodeURIComponent(clean)}&limit=1`
    );
    return rows[0] ? this.mapSiswa(rows[0]) : null;
  }

  async createSiswa(s: Omit<SiswaRecord, 'id'>): Promise<SiswaRecord> {
    const cleanNisn = s.nisn.replace(/'/g, '').trim();
    const rows = await this.request<any[]>('siswa', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        nisn: cleanNisn,
        nama: s.nama,
        jenis_kelamin: s.jenisKelamin,
        tanggal_lahir: s.tanggalLahir,
        agama: s.agama,
        nama_ayah: s.namaAyah,
        nama_ibu: s.namaIbu,
        no_hp: s.noHp,
        kelas: s.kelas,
        alamat: s.alamat,
      },
    });
    return this.mapSiswa(rows[0]);
  }

  async updateSiswa(oldNisn: string, s: Partial<SiswaRecord>): Promise<void> {
    const cleanOld = oldNisn.replace(/'/g, '').trim();
    const patch: Record<string, any> = {};
    if (s.nama !== undefined) patch.nama = s.nama;
    if (s.jenisKelamin !== undefined) patch.jenis_kelamin = s.jenisKelamin;
    if (s.tanggalLahir !== undefined) patch.tanggal_lahir = s.tanggalLahir;
    if (s.agama !== undefined) patch.agama = s.agama;
    if (s.namaAyah !== undefined) patch.nama_ayah = s.namaAyah;
    if (s.namaIbu !== undefined) patch.nama_ibu = s.namaIbu;
    if (s.noHp !== undefined) patch.no_hp = s.noHp;
    if (s.kelas !== undefined) patch.kelas = s.kelas;
    if (s.alamat !== undefined) patch.alamat = s.alamat;
    if (Object.keys(patch).length === 0) return;

    await this.request(`siswa?nisn=eq.${encodeURIComponent(cleanOld)}`, {
      method: 'PATCH',
      body: patch,
    });
  }

  async deleteSiswa(nisn: string): Promise<void> {
    const clean = encodeURIComponent(nisn.replace(/'/g, '').trim());
    await this.request(`absensi?nisn=eq.${clean}`, { method: 'DELETE' });
    await this.request(`absensi_sholat?nisn=eq.${clean}`, { method: 'DELETE' });
    await this.request(`log_notifikasi_wa?nisn=eq.${clean}`, { method: 'DELETE' });
    await this.request(`siswa?nisn=eq.${clean}`, { method: 'DELETE' });
  }

  // Kelas
  async getAllKelas(): Promise<string[]> {
    const rows = await this.request<{ nama: string }[]>('kelas?select=nama&order=nama.asc');
    return rows.map((r) => r.nama);
  }

  async getKelasMaster(): Promise<KelasRecord[]> {
    return this.request<KelasRecord[]>('kelas?select=id,nama,urutan&order=nama.asc');
  }

  async createKelas(nama: string): Promise<KelasRecord> {
    const rows = await this.request<KelasRecord[]>('kelas', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: { nama },
    });
    return rows[0];
  }

  async updateKelas(id: number, namaBaru: string): Promise<void> {
    const oldRows = await this.request<{ nama: string }[]>(`kelas?select=nama&id=eq.${id}&limit=1`);
    const oldName = oldRows[0]?.nama;

    await this.request(`kelas?id=eq.${id}`, {
      method: 'PATCH',
      body: { nama: namaBaru },
    });

    if (oldName) {
      await this.request(`siswa?kelas=eq.${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        body: { kelas: namaBaru },
      });
    }
  }

  async deleteKelas(id: number): Promise<void> {
    await this.request(`kelas?id=eq.${id}`, { method: 'DELETE' });
  }

  // Hari Libur
  async getAllHariLibur(): Promise<HariLiburRecord[]> {
    return this.request<HariLiburRecord[]>('hari_libur?select=id,tanggal,keterangan&order=tanggal.desc');
  }

  async addHariLibur(tanggal: string, keterangan: string): Promise<void> {
    await this.request('hari_libur?on_conflict=tanggal', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { tanggal, keterangan },
    });
  }

  async deleteHariLibur(tanggal: string): Promise<void> {
    await this.request(`hari_libur?tanggal=eq.${encodeURIComponent(tanggal)}`, {
      method: 'DELETE',
    });
  }

  // Konfigurasi
  async getConfig(): Promise<Record<string, string>> {
    const rows = await this.request<{ key: string; value: string }[]>('konfigurasi?select=key,value');
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return { ...DEFAULT_CONFIG, ...map };
  }

  async saveConfigKey(key: string, value: string): Promise<void> {
    await this.request('konfigurasi?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { key, value },
    });
  }

  // Absensi
  private mapAbsensi(r: any): AbsensiRecord {
    return {
      id: r.id,
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
    const rows = await this.request<any[]>(
      `absensi?select=id,tanggal,nisn,nama,kelas,jam_datang,jam_pulang,keterangan,status&tanggal=eq.${encodeURIComponent(tanggal)}&nisn=eq.${encodeURIComponent(nisn)}&limit=1`
    );
    return rows[0] ? this.mapAbsensi(rows[0]) : null;
  }

  async getAbsensiByDate(tanggal: string): Promise<AbsensiRecord[]> {
    const rows = await this.request<any[]>(
      `absensi?select=id,tanggal,nisn,nama,kelas,jam_datang,jam_pulang,keterangan,status&tanggal=eq.${encodeURIComponent(tanggal)}`
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async getAbsensiRange(startDate: string, endDate: string): Promise<AbsensiRecord[]> {
    const rows = await this.request<any[]>(
      `absensi?select=id,tanggal,nisn,nama,kelas,jam_datang,jam_pulang,keterangan,status&tanggal=gte.${encodeURIComponent(startDate)}&tanggal=lte.${encodeURIComponent(endDate)}`
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async getAbsensiMonthByNisn(nisn: string, ym: string): Promise<AbsensiRecord[]> {
    const clean = nisn.replace(/'/g, '').trim();
    const rows = await this.request<any[]>(
      `absensi?select=id,tanggal,nisn,nama,kelas,jam_datang,jam_pulang,keterangan,status&nisn=eq.${encodeURIComponent(clean)}&tanggal=like.${encodeURIComponent(ym + '*')}&order=tanggal.asc`
    );
    return rows.map((r) => this.mapAbsensi(r));
  }

  async recordAbsensiMasuk(rec: Omit<AbsensiRecord, 'id'>): Promise<AbsensiRecord> {
    const rows = await this.request<any[]>('absensi', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        tanggal: rec.tanggal,
        nisn: rec.nisn,
        nama: rec.nama,
        kelas: rec.kelas,
        jam_datang: rec.jamDatang,
        jam_pulang: rec.jamPulang || '',
        keterangan: rec.keterangan || '',
        status: rec.status || 'Hadir',
      },
    });
    return this.mapAbsensi(rows[0]);
  }

  async recordAbsensiPulang(id: number, jamPulang: string, keterangan: string): Promise<void> {
    await this.request(`absensi?id=eq.${id}`, {
      method: 'PATCH',
      body: { jam_pulang: jamPulang, keterangan },
    });
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

    const existing = await this.request<any[]>(
      `absensi?select=id,jam_datang&tanggal=eq.${encodeURIComponent(tanggal)}&nisn=eq.${encodeURIComponent(nisn)}&limit=1`
    );

    if (existing.length > 0) {
      const jd = isHadir ? existing[0].jam_datang || jamDatang || '07:00:00' : existing[0].jam_datang;
      await this.request(`absensi?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: { status: canonicalStatus, jam_datang: jd },
      });
    } else {
      await this.request('absensi', {
        method: 'POST',
        body: {
          tanggal,
          nisn,
          nama,
          kelas,
          jam_datang: isHadir ? jamDatang || '07:00:00' : '',
          jam_pulang: '',
          keterangan: isHadir ? 'Tepat Waktu' : 'Status Manual',
          status: canonicalStatus,
        },
      });
    }
  }

  // Sholat
  private mapSholat(r: any): AbsensiSholatRecord {
    return {
      id: r.id,
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
    let query = `absensi_sholat?select=id,tanggal,nisn,nama,kelas,waktu_sholat,status,keterangan,input_oleh&tanggal=eq.${encodeURIComponent(tanggal)}`;
    if (waktuSholat) {
      query += `&waktu_sholat=eq.${encodeURIComponent(waktuSholat)}`;
    }
    const rows = await this.request<any[]>(query);
    return rows.map((r) => this.mapSholat(r));
  }

  async getSholatMonth(ym: string): Promise<AbsensiSholatRecord[]> {
    const rows = await this.request<any[]>(
      `absensi_sholat?select=id,tanggal,nisn,nama,kelas,waktu_sholat,status,keterangan,input_oleh&tanggal=like.${encodeURIComponent(ym + '*')}&order=tanggal.asc`
    );
    return rows.map((r) => this.mapSholat(r));
  }

  async saveSholatRecords(tanggal: string, waktuSholat: string, list: any[], inputOleh: string): Promise<void> {
    const nisnArr = list.map((l) => String(l.nisn));
    if (nisnArr.length > 0) {
      await this.request(
        `absensi_sholat?tanggal=eq.${encodeURIComponent(tanggal)}&waktu_sholat=eq.${encodeURIComponent(waktuSholat)}&nisn=${encodeURIComponent(encodeInFilter(nisnArr))}`,
        { method: 'DELETE' }
      );
    }

    const payload = list.map((item) => ({
      tanggal,
      nisn: item.nisn,
      nama: item.nama,
      kelas: item.kelas,
      waktu_sholat: waktuSholat,
      status: item.status,
      keterangan: item.keterangan || '',
      input_oleh: inputOleh || 'Guru',
    }));

    if (payload.length > 0) {
      await this.request('absensi_sholat', {
        method: 'POST',
        body: payload,
      });
    }
  }

  // WhatsApp Log
  async getWaStatus(tanggal: string): Promise<Record<string, { sudahDikirim: boolean; waktu: string }>> {
    const rows = await this.request<{ nisn: string; waktu_dikirim: string }[]>(
      `log_notifikasi_wa?select=nisn,waktu_dikirim&tanggal_absensi=eq.${encodeURIComponent(tanggal)}`
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
    await this.request('log_notifikasi_wa', {
      method: 'POST',
      body: {
        waktu_dikirim: nowStr,
        tanggal_absensi: tanggal,
        nisn,
        nama: s.nama,
        kelas: s.kelas,
        status: 'Sudah Dikirim',
      },
    });
  }

  // Pengajuan Izin & Sakit
  private mapPengajuan(r: any): PengajuanIzinRecord {
    return {
      id: r.id,
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
    let query =
      'pengajuan_izin?select=id,nisn,nama,kelas,jenis,tanggal_mulai,tanggal_selesai,keterangan,dokumen_url,status,catatan_admin,reviewed_at,reviewed_by,created_at';
    if (filter?.nisn) query += `&nisn=eq.${encodeURIComponent(filter.nisn)}`;
    if (filter?.status && filter.status !== 'SEMUA') query += `&status=eq.${encodeURIComponent(filter.status)}`;
    if (filter?.kelas && filter.kelas !== 'SEMUA') {
      const arr = filter.kelas.split(',').map((k) => k.trim()).filter(Boolean);
      if (arr.length > 0) {
        query += `&kelas=${encodeURIComponent(encodeInFilter(arr))}`;
      }
    }
    query += '&order=id.desc';
    const rows = await this.request<any[]>(query);
    return rows.map((r) => this.mapPengajuan(r));
  }

  async createPengajuan(p: Omit<PengajuanIzinRecord, 'id' | 'status' | 'createdAt'>): Promise<PengajuanIzinRecord> {
    const rows = await this.request<any[]>('pengajuan_izin', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        nisn: p.nisn,
        nama: p.nama,
        kelas: p.kelas,
        jenis: p.jenis,
        tanggal_mulai: p.tanggalMulai,
        tanggal_selesai: p.tanggalSelesai,
        keterangan: p.keterangan,
        dokumen_url: p.dokumenUrl || '',
        status: 'Menunggu Persetujuan',
      },
    });
    return this.mapPengajuan(rows[0]);
  }

  async reviewPengajuan(
    id: number,
    status: 'Disetujui' | 'Ditolak',
    catatanAdmin = '',
    adminName = 'Admin'
  ): Promise<PengajuanIzinRecord | null> {
    const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const rows = await this.request<any[]>(`pengajuan_izin?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: {
        status,
        catatan_admin: catatanAdmin,
        reviewed_at: nowStr,
        reviewed_by: adminName,
      },
    });
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
        await this.request(
          `absensi?tanggal=eq.${encodeURIComponent(dStr)}&nisn=eq.${encodeURIComponent(target.nisn)}`,
          {
            method: 'PATCH',
            body: { keterangan: `${target.jenis} disetujui Admin: ${target.keterangan}` },
          }
        );

        cur.setDate(cur.getDate() + 1);
      }
    }

    return target;
  }

  async clearAcademicYear(): Promise<void> {
    await this.request('absensi?id=gt.0', { method: 'DELETE' });
    await this.request('absensi_sholat?id=gt.0', { method: 'DELETE' });
  }
}
