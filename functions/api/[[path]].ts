/**
 * Cloudflare Pages Functions API Router (/api/*)
 * Menangani seluruh endpoint /api/* secara native di Cloudflare Workers runtime
 * dan terhubung ke Supabase via HTTPS PostgREST API.
 *
 * File ini bersifat tambahan (addon) khusus untuk deployment Cloudflare Pages,
 * sehingga kode lama (server.ts, api/index.ts, vercel.json) tetap utuh tanpa diubah.
 */

import * as XLSX from 'xlsx';
import { SupabaseRestStorage, type PagesEnv } from '../_lib/supabase.ts';

interface PagesContext {
  request: Request;
  env: PagesEnv;
  params: Record<string, string | string[]>;
}

interface AuthUser {
  username: string;
  identifier: string;
  role: string;
  nama: string;
  kelas: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function readJson<T = any>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function getWibDateTime(clientTime?: string, clientDate?: string) {
  if (clientDate && clientTime && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    const timeClean = clientTime.replace('.', ':');
    const timeParts = timeClean.split(':');
    const h = String(timeParts[0] || '00').padStart(2, '0');
    const m = String(timeParts[1] || '00').padStart(2, '0');
    const s = String(timeParts[2] || '00').padStart(2, '0');
    return {
      dateStr: clientDate,
      timeStr: `${h}:${m}`,
      timeSecStr: `${h}:${m}:${s}`,
    };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const dateStr =
    clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
      ? clientDate
      : `${map.year}-${map.month}-${map.day}`;
  let timeStr = `${map.hour}:${map.minute}`;
  let timeSecStr = `${map.hour}:${map.minute}:${map.second}`;

  if (clientTime && /^\d{1,2}[:.]\d{2}/.test(clientTime)) {
    const clean = clientTime.replace('.', ':');
    const p = clean.split(':');
    timeStr = `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
    timeSecStr = `${timeStr}:${(p[2] || '00').padStart(2, '0')}`;
  }

  return { dateStr, timeStr, timeSecStr };
}

const getTodayStr = (clientDate?: string) => getWibDateTime(undefined, clientDate).dateStr;
const getNowTimeStr = (clientTime?: string) => getWibDateTime(clientTime).timeStr;
const getNowTimeSecStr = (clientTime?: string) => getWibDateTime(clientTime).timeSecStr;

function calculateTimeDiffMinutes(startTime: string, endTime: string) {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

async function checkHolidayStatus(dateStr: string, config: any, db: SupabaseRestStorage) {
  const d = new Date(dateStr + 'T12:00:00+07:00');
  const jsDay = d.getDay();
  const dayKey = jsDay === 0 ? '7' : String(jsDay);
  const dayNames: Record<string, string> = {
    '1': 'Senin',
    '2': 'Selasa',
    '3': 'Rabu',
    '4': 'Kamis',
    '5': 'Jumat',
    '6': 'Sabtu',
    '7': 'Minggu',
  };

  if (config.jadwal_harian && config.jadwal_harian[dayKey]?.libur) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur rutin: Hari ${dayNames[dayKey] || ''}` };
  } else if (!config.jadwal_harian && (dayKey === '6' || dayKey === '7')) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur rutin: Hari ${dayNames[dayKey] || ''}` };
  }

  const holidays = await db.getAllHariLibur();
  const libur = holidays.find((h) => h.tanggal === dateStr);
  if (libur) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur: ${libur.keterangan}` };
  }

  return { isHoliday: false, message: '' };
}

async function resolveAuth(request: Request, db: SupabaseRestStorage): Promise<AuthUser> {
  const authHeader = request.headers.get('authorization');
  const sessionTokenHeader = request.headers.get('x-session-token');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : sessionTokenHeader;

  if (token === 'kiosk' || request.headers.get('x-kiosk-mode') === 'true') {
    return {
      identifier: 'kiosk',
      username: 'kiosk',
      role: 'guru',
      nama: 'Petugas Gerbang (Kiosk)',
      kelas: '',
    };
  }

  if (token) {
    try {
      const sess = await db.findSession(token);
      if (sess && new Date(sess.expiresAt) > new Date()) {
        return {
          identifier: sess.identifier,
          username: sess.identifier,
          role: sess.role,
          nama: sess.nama || sess.identifier,
          kelas: sess.kelas || '',
        };
      }
    } catch {
      // Fallback gracefully like src/middleware/auth.ts
    }
  }

  return {
    identifier: 'petugas',
    username: 'petugas',
    role: 'guru',
    nama: 'Petugas Absensi',
    kelas: '',
  };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token, X-Kiosk-Mode',
      },
    });
  }

  const db = new SupabaseRestStorage(env);

  try {
    // ------------------------------------------------------------------
    // HEALTH & DATABASE STATUS
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/health') {
      const status = await db.checkConnection();
      return jsonResponse({
        status: 'ok',
        provider: 'cloudflare-pages',
        database: 'supabase-rest',
        db: status,
        timestamp: new Date().toISOString(),
      });
    }

    if (method === 'GET' && path === '/database/status') {
      const status = await db.checkConnection();
      return jsonResponse({ success: true, ...status });
    }

    // ------------------------------------------------------------------
    // 1. AUTENTIKASI & SESSION
    // ------------------------------------------------------------------
    if (method === 'POST' && path === '/auth/login') {
      const body = await readJson(request);
      const { username, password, nisn } = body;

      let userFound: {
        role: string;
        identifier: string;
        nama: string;
        kelas: string;
      } | null = null;

      if (nisn) {
        const cleanNisn = String(nisn).trim();
        const s = await db.findSiswaByNisn(cleanNisn);
        if (!s) {
          return jsonResponse({ success: false, message: 'NISN tidak ditemukan di database.' }, 404);
        }
        userFound = {
          role: 'siswa',
          identifier: s.nisn,
          nama: s.nama,
          kelas: s.kelas,
        };
      } else if (username && password) {
        const cleanUser = String(username).trim();
        const u = await db.findUserByUsername(cleanUser);
        if (!u || u.password !== String(password).trim()) {
          return jsonResponse({ success: false, message: 'Username atau password salah.' }, 401);
        }
        userFound = {
          role: u.role,
          identifier: u.username,
          nama: u.nama || u.username,
          kelas: u.kelas || '',
        };
      } else {
        return jsonResponse({ success: false, message: 'Kredensial login tidak lengkap.' }, 400);
      }

      const token = crypto.randomUUID();
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.createSession({
        token,
        identifier: userFound.identifier,
        role: userFound.role,
        nama: userFound.nama,
        kelas: userFound.kelas,
        expiresAt: expiry,
      });

      return jsonResponse({
        success: true,
        token,
        role: userFound.role,
        username: userFound.identifier,
        nama: userFound.nama,
        kelas: userFound.kelas,
        nisn: userFound.role === 'siswa' ? userFound.identifier : null,
      });
    }

    if (method === 'GET' && path === '/auth/me') {
      const user = await resolveAuth(request, db);
      return jsonResponse({ success: true, user });
    }

    if (method === 'POST' && path === '/auth/logout') {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.split('Bearer ')[1]
        : request.headers.get('x-session-token');
      if (token) {
        await db.deleteSession(token);
      }
      return jsonResponse({ success: true, message: 'Logged out successfully' });
    }

    // ------------------------------------------------------------------
    // 2. SISWA CRUD, LOOKUP & TEMPLATE EXCEL
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/siswa') {
      const filterKelas = url.searchParams.get('filterKelas') || undefined;
      const list = await db.getAllSiswa(filterKelas);
      return jsonResponse({ success: true, data: list });
    }

    if (method === 'GET' && path === '/siswa/cache') {
      const list = await db.getAllSiswa();
      return jsonResponse({
        success: true,
        data: list.map((s) => ({ nisn: s.nisn, nama: s.nama, kelas: s.kelas })),
      });
    }

    if (method === 'GET' && path === '/siswa/template') {
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
        'Alamat',
      ];
      const sampleRows = [
        headers,
        [1, 'Ahmad Rizki', '1234567890', 'Laki-laki', '2010-05-15', 'Islam', 'Budi Santoso', 'Siti Aminah', '081234567890', 'VII A', 'Jl. Merdeka No. 10, Jambi'],
        [2, 'Siti Nurhaliza', '1234567891', 'Perempuan', '2010-08-20', 'Islam', 'Usman', 'Farida', '081298765432', 'VII A', 'Jl. Sudirman No. 25, Jambi'],
        [3, 'Kevin Pratama', '1234567894', 'Laki-laki', '2010-07-22', 'Kristen', 'Daniel', 'Maria', '081389012345', 'VII B', 'Jl. Kenanga No. 8, Jambi'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sampleRows);
      ws['!cols'] = [
        { wch: 5 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 10 },
        { wch: 35 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');

      const instructions = [
        ['PETUNJUK PENGISIAN TEMPLATE IMPORT SISWA'],
        [''],
        ['Kolom', 'Keterangan & Format yang Didukung'],
        ['Nama Lengkap', 'Wajib diisi. Nama lengkap siswa sesuai dokumen resmi.'],
        ['NISN', 'Wajib diisi. 10 digit NISN unik (jangan ada duplikat).'],
        ['Jenis Kelamin', 'Isi "Laki-laki" atau "Perempuan" (atau L / P).'],
        ['Tanggal Lahir', 'Format: YYYY-MM-DD (Contoh: 2010-05-15).'],
        ['Agama', 'Islam / Kristen / Katolik / Hindu / Buddha / Konghucu.'],
        ['Nama Ayah', 'Nama orang tua/wali siswa.'],
        ['Nama Ibu', 'Nama orang tua/wali siswa.'],
        ['No Handphone', 'Nomor WhatsApp/HP aktif (Contoh: 081234567890) untuk notifikasi WA Alpa.'],
        ['Kelas', 'Nama kelas terdaftar (Contoh: VII A, VII B, VII C, VIII A).'],
        ['Alamat', 'Alamat tempat tinggal siswa.'],
      ];
      const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
      wsInstr['!cols'] = [{ wch: 20 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk');

      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      return new Response(out, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Template_Import_Siswa_Format_Resmi.xlsx"',
        },
      });
    }

    if (method === 'POST' && path === '/siswa/bulk-import') {
      const items = await readJson(request);
      if (!Array.isArray(items) || items.length === 0) {
        return jsonResponse({ success: false, message: 'Data import kosong' }, 400);
      }

      let added = 0;
      let skipped = 0;
      for (const item of items) {
        const cleanNisn = String(item.nisn || '').replace(/'/g, '').trim();
        if (!cleanNisn || !item.nama) {
          skipped++;
          continue;
        }
        const existing = await db.findSiswaByNisn(cleanNisn);
        if (existing) {
          skipped++;
          continue;
        }
        await db.createSiswa({
          nisn: cleanNisn,
          nama: String(item.nama).trim(),
          jenisKelamin: item.jenisKelamin || 'Laki-laki',
          tanggalLahir: item.tanggalLahir || '2010-01-01',
          agama: item.agama || 'Islam',
          namaAyah: item.namaAyah || '',
          namaIbu: item.namaIbu || '',
          noHp: String(item.noHp || '').replace(/'/g, '').trim(),
          kelas: item.kelas || 'VII A',
          alamat: item.alamat || '',
        });
        added++;
      }

      return jsonResponse({
        success: true,
        added,
        skipped,
        message: `Import selesai. Berhasil: ${added}, Dilewati/Duplikat: ${skipped}`,
      });
    }

    if (method === 'POST' && path === '/siswa') {
      const data = await readJson(request);
      const cleanNisn = String(data.nisn || '').replace(/'/g, '').trim();
      const existing = await db.findSiswaByNisn(cleanNisn);
      if (existing) {
        return jsonResponse({ success: false, message: 'NISN sudah terdaftar' }, 400);
      }
      await db.createSiswa({
        nisn: cleanNisn,
        nama: data.nama,
        jenisKelamin: data.jenisKelamin || 'Laki-laki',
        tanggalLahir: data.tanggalLahir || '2010-01-01',
        agama: data.agama || 'Islam',
        namaAyah: data.namaAyah || '',
        namaIbu: data.namaIbu || '',
        noHp: data.noHp ? String(data.noHp).replace(/'/g, '').trim() : '',
        kelas: data.kelas || 'VII A',
        alamat: data.alamat || '',
      });
      return jsonResponse({ success: true, message: 'Siswa berhasil ditambahkan' });
    }

    if (path.startsWith('/siswa/') && path.split('/').length === 3) {
      const seg = decodeURIComponent(path.split('/')[2]).replace(/'/g, '').trim();
      if (method === 'GET') {
        const s = await db.findSiswaByNisn(seg);
        if (!s) return jsonResponse({ success: false, message: 'Siswa tidak ditemukan' }, 404);
        return jsonResponse({ success: true, data: s });
      }
      if (method === 'PUT') {
        const data = await readJson(request);
        await db.updateSiswa(seg, {
          nama: data.nama,
          jenisKelamin: data.jenisKelamin,
          tanggalLahir: data.tanggalLahir,
          agama: data.agama,
          namaAyah: data.namaAyah,
          namaIbu: data.namaIbu,
          noHp: data.noHp ? String(data.noHp).replace(/'/g, '').trim() : '',
          kelas: data.kelas,
          alamat: data.alamat,
        });
        return jsonResponse({ success: true, message: 'Data siswa berhasil diupdate' });
      }
      if (method === 'DELETE') {
        await db.deleteSiswa(seg);
        return jsonResponse({ success: true, message: 'Data siswa berhasil dihapus' });
      }
    }

    // ------------------------------------------------------------------
    // 3. GURU CRUD
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/guru') {
      const list = await db.getAllGuru();
      return jsonResponse({ success: true, data: list });
    }

    if (method === 'POST' && path === '/guru') {
      const { username, password, kelas: guruKelas } = await readJson(request);
      const cleanUser = String(username || '').replace(/'/g, '').trim();
      const existing = await db.findUserByUsername(cleanUser);
      if (existing) {
        return jsonResponse({ success: false, message: 'Username guru sudah terdaftar' }, 400);
      }
      await db.createGuru({
        username: cleanUser,
        password: String(password || '').replace(/'/g, '').trim(),
        role: 'guru',
        nama: cleanUser,
        kelas: guruKelas || '',
      });
      return jsonResponse({ success: true, message: 'Guru berhasil ditambahkan' });
    }

    if (path.startsWith('/guru/') && path.split('/').length === 3) {
      const oldUsername = decodeURIComponent(path.split('/')[2]).replace(/'/g, '').trim();
      if (method === 'PUT') {
        const { username, password, kelas: guruKelas } = await readJson(request);
        await db.updateGuru(oldUsername, {
          username: username ? String(username).replace(/'/g, '').trim() : undefined,
          password: password ? String(password).replace(/'/g, '').trim() : undefined,
          kelas: guruKelas !== undefined ? guruKelas : undefined,
        });
        return jsonResponse({ success: true, message: 'Data guru berhasil diupdate' });
      }
      if (method === 'DELETE') {
        await db.deleteGuru(oldUsername);
        return jsonResponse({ success: true, message: 'Guru berhasil dihapus' });
      }
    }

    // ------------------------------------------------------------------
    // 4. KELAS CRUD
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/kelas') {
      const list = await db.getAllKelas();
      return jsonResponse({ success: true, data: list });
    }

    if (method === 'GET' && path === '/kelas/master') {
      const list = await db.getKelasMaster();
      return jsonResponse({
        success: true,
        data: list.map((k) => ({ rowIndex: k.id, nama: k.nama })),
      });
    }

    if (method === 'POST' && path === '/kelas') {
      const body = await readJson(request);
      const nama = String(body.namaKelas || body.nama || '').trim();
      if (!nama) return jsonResponse({ success: false, message: 'Nama kelas tidak boleh kosong' }, 400);
      const existing = await db.getAllKelas();
      if (existing.some((k) => k.toLowerCase() === nama.toLowerCase())) {
        return jsonResponse({ success: false, message: `Kelas "${nama}" sudah ada.` }, 400);
      }
      await db.createKelas(nama);
      return jsonResponse({ success: true, message: `Kelas "${nama}" berhasil ditambahkan.` });
    }

    if (path.startsWith('/kelas/') && path.split('/').length === 3) {
      const id = parseInt(path.split('/')[2], 10);
      if (method === 'PUT') {
        const body = await readJson(request);
        const namaBaru = String(body.namaBaru || body.nama || '').trim();
        if (!namaBaru) return jsonResponse({ success: false, message: 'Nama kelas baru tidak boleh kosong' }, 400);
        await db.updateKelas(id, namaBaru);
        return jsonResponse({ success: true, message: `Kelas berhasil diubah ke "${namaBaru}".` });
      }
      if (method === 'DELETE') {
        const master = await db.getKelasMaster();
        const item = master.find((m) => m.id === id);
        if (!item) return jsonResponse({ success: false, message: 'Kelas tidak ditemukan' }, 404);
        const allSiswa = await db.getAllSiswa(item.nama);
        if (allSiswa.length > 0) {
          return jsonResponse(
            {
              success: false,
              message: `Kelas "${item.nama}" masih digunakan oleh ${allSiswa.length} siswa. Pindahkan atau hapus siswa terlebih dahulu.`,
            },
            400
          );
        }
        await db.deleteKelas(id);
        return jsonResponse({ success: true, message: `Kelas "${item.nama}" berhasil dihapus.` });
      }
    }

    // ------------------------------------------------------------------
    // 5. HARI LIBUR & KONFIGURASI
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/hari-libur') {
      const list = await db.getAllHariLibur();
      return jsonResponse({ success: true, data: list });
    }

    if (method === 'POST' && path === '/hari-libur') {
      const { tanggal, keterangan } = await readJson(request);
      await db.addHariLibur(tanggal, keterangan);
      return jsonResponse({ success: true, message: 'Hari libur berhasil ditambahkan' });
    }

    if (method === 'POST' && path === '/hari-libur/range') {
      const { tanggalMulai, tanggalAkhir, keterangan } = await readJson(request);
      if (tanggalAkhir < tanggalMulai) {
        return jsonResponse({ success: false, message: 'Tanggal akhir tidak boleh sebelum tanggal mulai.' }, 400);
      }
      const dMulai = new Date(tanggalMulai + 'T00:00:00');
      const dAkhir = new Date(tanggalAkhir + 'T00:00:00');
      let added = 0;
      for (let d = new Date(dMulai); d <= dAkhir; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        await db.addHariLibur(`${year}-${month}-${day}`, keterangan);
        added++;
      }
      return jsonResponse({ success: true, message: `${added} hari libur berhasil ditambahkan.` });
    }

    if (method === 'PUT' && path === '/hari-libur') {
      const { oldDate, newDate, newKeterangan } = await readJson(request);
      if (oldDate !== newDate) {
        await db.deleteHariLibur(oldDate);
      }
      await db.addHariLibur(newDate, newKeterangan);
      return jsonResponse({ success: true, message: 'Hari libur berhasil diperbarui' });
    }

    if (method === 'DELETE' && path.startsWith('/hari-libur/')) {
      const tanggal = decodeURIComponent(path.split('/')[2]);
      await db.deleteHariLibur(tanggal);
      return jsonResponse({ success: true, message: 'Hari libur dihapus' });
    }

    if (method === 'GET' && path === '/config') {
      const cfg = await db.getConfig();
      let jadwalHarian = {};
      if (cfg.jadwal_harian) {
        try {
          jadwalHarian = JSON.parse(cfg.jadwal_harian);
        } catch {}
      }
      return jsonResponse({
        success: true,
        data: {
          jam_masuk_mulai: cfg.jam_masuk_mulai || '06:00',
          jam_masuk_akhir: cfg.jam_masuk_akhir || '07:15',
          jam_pulang_mulai: cfg.jam_pulang_mulai || '15:00',
          jam_pulang_akhir: cfg.jam_pulang_akhir || '17:00',
          mode_absen: cfg.mode_absen || 'masuk_pulang',
          jadwal_harian: jadwalHarian,
        },
      });
    }

    if (method === 'POST' && path === '/config') {
      const newConfig = await readJson(request);
      if (newConfig.jam_masuk_mulai) await db.saveConfigKey('jam_masuk_mulai', newConfig.jam_masuk_mulai);
      if (newConfig.jam_masuk_akhir) await db.saveConfigKey('jam_masuk_akhir', newConfig.jam_masuk_akhir);
      if (newConfig.jam_pulang_mulai) await db.saveConfigKey('jam_pulang_mulai', newConfig.jam_pulang_mulai);
      if (newConfig.jam_pulang_akhir) await db.saveConfigKey('jam_pulang_akhir', newConfig.jam_pulang_akhir);
      if (newConfig.mode_absen) await db.saveConfigKey('mode_absen', newConfig.mode_absen);

      if (newConfig.jadwal_harian) {
        const parsed =
          typeof newConfig.jadwal_harian === 'string'
            ? JSON.parse(newConfig.jadwal_harian)
            : newConfig.jadwal_harian;
        await db.saveConfigKey('jadwal_harian', JSON.stringify(parsed));
      } else {
        const curCfg = await db.getConfig();
        let jadwalHarian: any = {};
        try {
          jadwalHarian = JSON.parse(curCfg.jadwal_harian || '{}');
        } catch {}
        for (let day = 1; day <= 7; day++) {
          const k = String(day);
          if (!jadwalHarian[k]) jadwalHarian[k] = { libur: day >= 6 };
          if (!jadwalHarian[k].libur) {
            if (newConfig.jam_masuk_mulai) jadwalHarian[k].masuk_mulai = newConfig.jam_masuk_mulai;
            if (newConfig.jam_masuk_akhir) jadwalHarian[k].masuk_akhir = newConfig.jam_masuk_akhir;
            if (newConfig.jam_pulang_mulai) jadwalHarian[k].pulang_mulai = newConfig.jam_pulang_mulai;
            if (newConfig.jam_pulang_akhir) jadwalHarian[k].pulang_akhir = newConfig.jam_pulang_akhir;
          }
        }
        await db.saveConfigKey('jadwal_harian', JSON.stringify(jadwalHarian));
      }

      return jsonResponse({ success: true, message: 'Konfigurasi jadwal operasional berhasil disimpan' });
    }

    // ------------------------------------------------------------------
    // 6. REALTIME PRESENSI & SCAN
    // ------------------------------------------------------------------
    if (method === 'GET' && path.startsWith('/absensi/today/')) {
      const cleanNisn = decodeURIComponent(path.split('/')[3] || '').trim();
      const today = getTodayStr();
      const cfg = await db.getConfig();
      let jadwalHarian = {};
      try {
        jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}');
      } catch {}

      const holidayInfo = await checkHolidayStatus(today, { ...cfg, jadwal_harian: jadwalHarian }, db);
      const rec = await db.getAbsensiToday(today, cleanNisn);

      return jsonResponse({
        success: true,
        data: rec
          ? {
              tanggal: rec.tanggal,
              jamDatang: rec.jamDatang || '',
              jamPulang: rec.jamPulang || '',
              status: rec.status || 'Hadir',
            }
          : null,
        isLibur: holidayInfo.isHoliday,
        keteranganLibur: holidayInfo.message,
      });
    }

    if (method === 'GET' && path === '/absensi/monitoring') {
      const today = getTodayStr();
      const filterKelas = url.searchParams.get('filterKelas') || undefined;
      const allSiswa = await db.getAllSiswa(filterKelas);
      const allAbsenToday = await db.getAbsensiByDate(today);
      const absenMap: Record<string, any> = {};
      allAbsenToday.forEach((a) => {
        absenMap[a.nisn] = a;
      });

      const result = allSiswa.map((s) => {
        const a = absenMap[s.nisn];
        let jamDatang = '-';
        let jamPulang = '-';
        let status = 'Belum Absen';
        let keterangan = '-';

        if (a) {
          jamDatang = a.jamDatang ? a.jamDatang.substring(0, 5) : '-';
          jamPulang = a.jamPulang ? a.jamPulang.substring(0, 5) : '-';
          status = a.status || 'Hadir';
          keterangan = a.keterangan || (status === 'Hadir' ? 'Tepat Waktu' : '-');
        }

        return {
          nama: s.nama,
          nisn: s.nisn,
          kelas: s.kelas,
          jamDatang,
          jamPulang,
          status,
          keterangan,
        };
      });

      return jsonResponse({ success: true, data: result });
    }

    if (method === 'POST' && path === '/absensi/status') {
      const { nisn, nama, kelas: siswaKelas, status: newStatus, tanggal: clientTanggal } = await readJson(request);
      const cleanNisn = String(nisn).trim();
      const today = clientTanggal && /^\d{4}-\d{2}-\d{2}$/.test(clientTanggal) ? clientTanggal : getTodayStr();
      const nowSecTime = getNowTimeSecStr();
      await db.updateAbsensiStatus(today, cleanNisn, nama, siswaKelas, newStatus, nowSecTime);
      return jsonResponse({ success: true, message: 'Status berhasil diubah', jamDatang: nowSecTime, tanggal: today });
    }

    if (method === 'POST' && path === '/absensi/scan') {
      const { nisn, scannerRole, scannerKelas, scanMode = 'auto', clientTime, clientDate } = await readJson(request);
      const cleanNisn = String(nisn || '').replace(/[^a-zA-Z0-9]/g, '').trim();
      if (!cleanNisn) {
        return jsonResponse({ success: false, message: 'QR Code tidak valid atau kosong.' }, 400);
      }

      const { dateStr: today, timeStr: nowTime, timeSecStr: nowSecTime } = getWibDateTime(clientTime, clientDate);
      const cfg = await db.getConfig();
      let jadwalHarian: any = {};
      try {
        jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}');
      } catch {}
      const config: Record<string, any> = { ...cfg, jadwal_harian: jadwalHarian };

      const holidayInfo = await checkHolidayStatus(today, config, db);
      if (holidayInfo.isHoliday) {
        return jsonResponse({ success: false, message: holidayInfo.message });
      }

      const targetSiswa = await db.findSiswaByNisn(cleanNisn);
      if (!targetSiswa) {
        return jsonResponse({ success: false, message: 'NISN tidak terdaftar di database.' });
      }

      if (scannerRole === 'guru' && scannerKelas && scannerKelas !== 'SEMUA') {
        const allowedKelas = String(scannerKelas).split(',').map((k) => k.trim().toUpperCase());
        if (!allowedKelas.includes(targetSiswa.kelas.toUpperCase())) {
          return jsonResponse({
            success: false,
            message: `Ditolak! Siswa ini kelas ${targetSiswa.kelas}. Anda hanya bisa scan kelas ${scannerKelas}.`,
          });
        }
      }

      const d = new Date(today + 'T12:00:00+07:00');
      const jsDay = d.getDay();
      const dayKey = jsDay === 0 ? '7' : String(jsDay);
      const daySchedule = jadwalHarian && jadwalHarian[dayKey] ? jadwalHarian[dayKey] : null;

      const jamMasukMulai = daySchedule?.masuk_mulai || config.jam_masuk_mulai || '06:00';
      const jamMasukAkhir = daySchedule?.masuk_akhir || config.jam_masuk_akhir || '07:15';
      const jamPulangMulai = daySchedule?.pulang_mulai || config.jam_pulang_mulai || '15:00';

      const existing = await db.getAbsensiToday(today, cleanNisn);
      const modeAbsen = scanMode === 'pulang' ? 'masuk_pulang' : config.mode_absen || 'masuk_pulang';

      if (scanMode === 'pulang') {
        if (!existing || existing.status === 'Belum Absen' || !existing.status) {
          return jsonResponse({
            success: false,
            code: 'BELUM_MASUK',
            message: `${targetSiswa.nama} belum melakukan absen datang hari ini, tidak bisa absen pulang.`,
            nama: targetSiswa.nama,
            kelas: targetSiswa.kelas,
          });
        }
        if (existing.status === 'Sakit' || existing.status === 'Izin' || existing.status === 'Alpa') {
          return jsonResponse({
            success: false,
            code: 'STATUS_BUKAN_HADIR',
            message: `${targetSiswa.nama} tercatat ${existing.status} hari ini, tidak bisa scan absen pulang.`,
            nama: targetSiswa.nama,
            kelas: targetSiswa.kelas,
          });
        }
        if (existing.jamPulang) {
          return jsonResponse({
            success: false,
            code: 'ALREADY_PULANG',
            message: `${targetSiswa.nama} sudah absen pulang hari ini (${existing.jamPulang.substring(0, 5)} WIB).`,
            nama: targetSiswa.nama,
            jamPulang: existing.jamPulang,
          });
        }

        let ketBaru = existing.keterangan || '';
        let pesanPulang = 'Absen Pulang Berhasil ✓';
        if (nowTime < jamPulangMulai) {
          ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat';
          pesanPulang = 'Absen Pulang (Pulang Cepat)';
        }
        await db.recordAbsensiPulang(existing.id, nowSecTime, ketBaru);

        return jsonResponse({
          success: true,
          message: pesanPulang,
          type: 'pulang',
          jamPulang: nowSecTime,
          nama: targetSiswa.nama,
          kelas: targetSiswa.kelas,
          status: 'Hadir',
        });
      }

      if (existing) {
        if (modeAbsen === 'masuk_saja') {
          return jsonResponse({ success: false, message: `${targetSiswa.nama} sudah absen masuk hari ini.` });
        }
        if (scanMode === 'masuk') {
          return jsonResponse({
            success: false,
            code: 'ALREADY_MASUK',
            message: `${targetSiswa.nama} sudah absen datang hari ini (${existing.jamDatang ? existing.jamDatang.substring(0, 5) + ' WIB' : 'Hadir'}).`,
            nama: targetSiswa.nama,
            kelas: targetSiswa.kelas,
            status: existing.status,
            jamDatang: existing.jamDatang || '',
            jamPulang: existing.jamPulang || '',
          });
        }
        if (existing.status === 'Sakit' || existing.status === 'Izin' || existing.status === 'Alpa') {
          return jsonResponse({
            success: false,
            code: 'STATUS_BUKAN_HADIR',
            message: `${targetSiswa.nama} tercatat ${existing.status} hari ini, tidak bisa scan absen pulang.`,
            nama: targetSiswa.nama,
            kelas: targetSiswa.kelas,
          });
        }
        if (existing.jamPulang) {
          return jsonResponse({
            success: false,
            code: 'ALREADY_PULANG',
            message: `${targetSiswa.nama} sudah absen pulang hari ini (${existing.jamPulang.substring(0, 5)} WIB).`,
            nama: targetSiswa.nama,
            jamPulang: existing.jamPulang,
          });
        }

        let ketBaru = existing.keterangan || '';
        let pesanPulang = 'Absen Pulang Berhasil ✓';
        if (nowTime < jamPulangMulai) {
          ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat';
          pesanPulang = 'Absen Pulang (Pulang Cepat)';
        }
        await db.recordAbsensiPulang(existing.id, nowSecTime, ketBaru);

        return jsonResponse({
          success: true,
          message: pesanPulang,
          type: 'pulang',
          jamPulang: nowSecTime,
          nama: targetSiswa.nama,
          kelas: targetSiswa.kelas,
          status: 'Hadir',
        });
      }

      if (nowTime < jamMasukMulai) {
        return jsonResponse({
          success: false,
          message: `Absensi belum dibuka. Buka mulai jam ${jamMasukMulai} WIB (Waktu sekarang: ${nowTime} WIB).`,
        });
      }

      let keteranganWaktu = 'Tepat Waktu';
      if (nowTime > jamMasukAkhir) {
        const lateMinutes = calculateTimeDiffMinutes(jamMasukAkhir, nowTime);
        keteranganWaktu = `Terlambat ${lateMinutes} menit`;
      }

      await db.recordAbsensiMasuk({
        tanggal: today,
        nisn: cleanNisn,
        nama: targetSiswa.nama,
        kelas: targetSiswa.kelas,
        jamDatang: nowSecTime,
        jamPulang: '',
        keterangan: keteranganWaktu,
        status: 'Hadir',
      });

      return jsonResponse({
        success: true,
        message: keteranganWaktu.includes('Terlambat') ? `Absen Masuk (${keteranganWaktu})` : 'Absen Masuk Berhasil ✓',
        type: 'datang',
        jamDatang: nowSecTime,
        nama: targetSiswa.nama,
        kelas: targetSiswa.kelas,
        status: 'Hadir',
      });
    }

    if (method === 'GET' && path === '/absensi/daftar-hadir') {
      const filterKelas = url.searchParams.get('kelas') || '';
      const tanggal = url.searchParams.get('tanggal') || '';
      if (!tanggal) return jsonResponse({ success: true, data: {} });

      const records = await db.getAbsensiByDate(tanggal);
      const result: Record<string, { status: string; jamDatang: string; hasJamDatang: boolean }> = {};
      const allowed =
        filterKelas && filterKelas !== 'SEMUA'
          ? filterKelas.split(',').map((k) => k.trim().toUpperCase())
          : null;

      records.forEach((r) => {
        if (!allowed || allowed.includes(r.kelas.toUpperCase())) {
          result[r.nisn] = {
            status: r.status.toLowerCase(),
            jamDatang: r.jamDatang ? r.jamDatang.substring(0, 5) : '',
            hasJamDatang: !!r.jamDatang,
          };
        }
      });

      return jsonResponse({ success: true, data: result });
    }

    if (method === 'GET' && path === '/absensi/daftar-hadir-detail') {
      const tanggal = url.searchParams.get('tanggal') || '';
      const queryDate = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? tanggal : getTodayStr();
      const records = await db.getAbsensiByDate(queryDate);
      const result: Record<string, { status: string; jamDatang: string; jamPulang: string; rowIndex: number }> = {};

      records.forEach((r) => {
        result[r.nisn] = {
          status: (r.status || 'Hadir').toLowerCase(),
          jamDatang: r.jamDatang ? r.jamDatang.substring(0, 5) : '',
          jamPulang: r.jamPulang ? r.jamPulang.substring(0, 5) : '',
          rowIndex: r.id,
        };
      });

      return jsonResponse({ success: true, data: result });
    }

    if (method === 'POST' && path === '/absensi/pulang-satu') {
      const { nisn, tanggal } = await readJson(request);
      const cleanNisn = String(nisn).trim();
      const nowSecTime = getNowTimeSecStr();
      const nowTime = getNowTimeStr();
      const cfg = await db.getConfig();

      const rec = await db.getAbsensiToday(tanggal, cleanNisn);
      if (!rec) {
        return jsonResponse(
          { success: false, message: 'Data absen masuk tidak ditemukan. Siswa belum melakukan absen datang.' },
          404
        );
      }
      if (rec.status !== 'Hadir') {
        return jsonResponse({ success: false, message: `Siswa berstatus ${rec.status}, tidak perlu absen pulang.` }, 400);
      }
      if (rec.jamPulang) {
        return jsonResponse({ success: false, message: `${rec.nama} sudah tercatat pulang (${rec.jamPulang}).` }, 400);
      }

      let ketBaru = rec.keterangan || 'Tepat Waktu';
      if (nowTime < (cfg.jam_pulang_mulai || '15:00') && !ketBaru.includes('Pulang Cepat')) {
        ketBaru = `${ketBaru} & Pulang Cepat`;
      }
      await db.recordAbsensiPulang(rec.id, nowSecTime, ketBaru);

      return jsonResponse({
        success: true,
        nama: rec.nama,
        jamPulang: nowSecTime,
        message: `${rec.nama} berhasil dicatat pulang (${nowSecTime})`,
      });
    }

    if (method === 'POST' && path === '/absensi/pulang-semua-hadir') {
      const { kelas: filterKelas, tanggal, namaPengirim } = await readJson(request);
      const nowSecTime = getNowTimeSecStr();
      const nowTime = getNowTimeStr();
      const cfg = await db.getConfig();

      const allToday = await db.getAbsensiByDate(tanggal);
      const allowed =
        filterKelas && filterKelas !== 'SEMUA'
          ? filterKelas.split(',').map((k: string) => k.trim().toUpperCase())
          : null;

      const eligible = allToday.filter(
        (r) => r.status === 'Hadir' && !r.jamPulang && (!allowed || allowed.includes(r.kelas.toUpperCase()))
      );

      if (eligible.length === 0) {
        return jsonResponse({
          success: true,
          count: 0,
          message: 'Tidak ada siswa berstatus Hadir yang belum absen pulang.',
        });
      }

      let count = 0;
      for (const rec of eligible) {
        let ketBaru = rec.keterangan || 'Tepat Waktu';
        if (nowTime < (cfg.jam_pulang_mulai || '15:00') && !ketBaru.includes('Pulang Cepat')) {
          ketBaru = `${ketBaru} & Pulang Cepat (Input: ${namaPengirim || 'Guru'})`;
        }
        await db.recordAbsensiPulang(rec.id, nowSecTime, ketBaru);
        count++;
      }

      return jsonResponse({
        success: true,
        count,
        message: `${count} siswa Hadir berhasil dicatat pulang (${nowSecTime}). Status Sakit/Izin/Alpa tetap terjaga.`,
      });
    }

    // ------------------------------------------------------------------
    // 7. LAPORAN & REKAP BULANAN + EXPORT EXCEL
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/absensi/rekap-bulanan') {
      const bulan = parseInt(url.searchParams.get('bulan') || '0', 10);
      const tahun = parseInt(url.searchParams.get('tahun') || String(new Date().getFullYear()), 10);
      const kelasFilter = url.searchParams.get('kelas') || undefined;

      const endDate = new Date(tahun, bulan + 1, 0);
      const daysInMonth = endDate.getDate();

      const startStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
      const endStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const todayStr = getTodayStr();

      const cfg = await db.getConfig();
      let jadwalHarian: Record<string, any> = {};
      try {
        jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}');
      } catch {}

      const allHolidays = await db.getAllHariLibur();
      const holidayMap: Record<string, string> = {};
      allHolidays.forEach((h) => {
        if (h.tanggal >= startStr && h.tanggal <= endStr) holidayMap[h.tanggal] = h.keterangan;
      });

      const studentList = await db.getAllSiswa(kelasFilter);
      const absensiRows = await db.getAbsensiRange(startStr, endStr);
      const absenMap: Record<string, string> = {};
      absensiRows.forEach((a) => {
        absenMap[`${a.tanggal}_${a.nisn}`] = a.status;
      });

      const students = studentList.map((s) => {
        const stats = { h: 0, s: 0, i: 0, a: 0, effectiveDays: 0 };
        const dailyCodes = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const curDate = new Date(tahun, bulan, day);
          const curStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isHoliday = !!holidayMap[curStr];
          const jsDay = curDate.getDay();
          const dayKey = jsDay === 0 ? '7' : String(jsDay);
          const isRoutineOff = jadwalHarian?.[dayKey]?.libur || jsDay === 0;

          let code = '-';
          const isDayOff = isHoliday || isRoutineOff;

          if (isDayOff) {
            code = 'L';
          } else if (curStr > todayStr) {
            code = '';
          } else {
            stats.effectiveDays++;
            const st = absenMap[`${curStr}_${s.nisn}`];
            if (st === 'Hadir') {
              code = 'H';
              stats.h++;
            } else if (st === 'Sakit') {
              code = 'S';
              stats.s++;
            } else if (st === 'Izin') {
              code = 'I';
              stats.i++;
            } else {
              code = 'A';
              stats.a++;
            }
          }

          dailyCodes.push({ date: day, code, isHoliday: isDayOff });
        }

        const percent = stats.effectiveDays > 0 ? Math.round((stats.h / stats.effectiveDays) * 100) : 0;
        return {
          nama: s.nama,
          nisn: s.nisn,
          kelas: s.kelas,
          dailyCodes,
          stats: { ...stats, percent },
        };
      });

      return jsonResponse({ success: true, data: { daysInMonth, students } });
    }

    if (method === 'POST' && path === '/absensi/export-excel') {
      const { type, filters = {} } = await readJson(request);
      const wb = XLSX.utils.book_new();

      if (type === 'laporan_bulanan') {
        const { bulan, tahun, kelas } = filters;
        const endDate = new Date(tahun, bulan + 1, 0);
        const daysInMonth = endDate.getDate();
        const startStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
        const endStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        const cfg = await db.getConfig();
        let jadwalHarian: Record<string, any> = {};
        try {
          jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}');
        } catch {}

        const allHolidays = await db.getAllHariLibur();
        const holidayMap: Record<string, string> = {};
        allHolidays.forEach((h) => {
          if (h.tanggal >= startStr && h.tanggal <= endStr) holidayMap[h.tanggal] = h.keterangan;
        });

        const studentList = await db.getAllSiswa(kelas);
        const absensiRows = await db.getAbsensiRange(startStr, endStr);
        const absenMap: Record<string, string> = {};
        absensiRows.forEach((a) => {
          absenMap[`${a.tanggal}_${a.nisn}`] = a.status;
        });

        const headers = ['No', 'Nama Siswa', 'NISN', 'Kelas'];
        for (let d = 1; d <= daysInMonth; d++) headers.push(String(d));
        headers.push('H', 'S', 'I', 'A', '%');

        const rows: any[][] = [headers];

        studentList.forEach((s, idx) => {
          const row: any[] = [idx + 1, s.nama, s.nisn, s.kelas];
          let h = 0,
            sc = 0,
            i = 0,
            a = 0,
            eff = 0;

          for (let day = 1; day <= daysInMonth; day++) {
            const curStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isHoliday = !!holidayMap[curStr];
            const jsDay = new Date(tahun, bulan, day).getDay();
            const dayKey = jsDay === 0 ? '7' : String(jsDay);
            const isRoutineOff = jadwalHarian?.[dayKey]?.libur || jsDay === 0;

            if (isHoliday || isRoutineOff) {
              row.push('L');
            } else {
              eff++;
              const st = absenMap[`${curStr}_${s.nisn}`];
              if (st === 'Hadir') {
                row.push('H');
                h++;
              } else if (st === 'Sakit') {
                row.push('S');
                sc++;
              } else if (st === 'Izin') {
                row.push('I');
                i++;
              } else {
                row.push('A');
                a++;
              }
            }
          }
          const pct = eff > 0 ? Math.round((h / eff) * 100) : 0;
          row.push(h, sc, i, a, `${pct}%`);
          rows.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
      } else {
        const fStart = filters.tanggalMulai || getTodayStr();
        const fEnd = filters.tanggalAkhir || getTodayStr();
        const filterKelas = filters.kelas;

        const studentList = await db.getAllSiswa(filterKelas);
        const absensiRows = await db.getAbsensiRange(fStart, fEnd);
        const absenMap: Record<string, any> = {};
        absensiRows.forEach((a) => {
          absenMap[`${a.tanggal}_${a.nisn}`] = a;
        });

        const logRows: any[][] = [
          ['No', 'Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Jam Datang', 'Jam Pulang', 'Keterangan', 'Status'],
        ];
        let counter = 1;
        const dStart = new Date(fStart + 'T00:00:00');
        const dEnd = new Date(fEnd + 'T00:00:00');

        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const curDateStr = `${year}-${month}-${day}`;

          for (const s of studentList) {
            const item = absenMap[`${curDateStr}_${s.nisn}`];
            logRows.push([
              counter++,
              curDateStr,
              s.nisn,
              s.nama,
              s.kelas,
              item?.jamDatang || '-',
              item?.jamPulang || '-',
              item?.keterangan || (item?.status === 'Hadir' ? 'Tepat Waktu' : '-'),
              item?.status || 'Belum Absen',
            ]);
          }
        }

        const ws = XLSX.utils.aoa_to_sheet(logRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Log Presensi');
      }

      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      return new Response(out, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=Presensi_${Date.now()}.xlsx`,
        },
      });
    }

    // ------------------------------------------------------------------
    // 8. ABSENSI SHOLAT
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/sholat') {
      const tanggal = url.searchParams.get('tanggal') || getTodayStr();
      const waktuSholat = url.searchParams.get('waktuSholat') || undefined;
      const rows = await db.getSholatByDate(tanggal, waktuSholat);

      const map: Record<string, { status: string; keterangan: string }> = {};
      rows.forEach((r) => {
        map[r.nisn] = { status: r.status, keterangan: r.keterangan || '' };
      });
      return jsonResponse({ success: true, data: map });
    }

    if (method === 'POST' && path === '/sholat') {
      const { dataList, tanggal, waktuSholat, inputOleh } = await readJson(request);
      if (!Array.isArray(dataList) || dataList.length === 0) {
        return jsonResponse({ success: false, message: 'Data sholat kosong' }, 400);
      }
      await db.saveSholatRecords(tanggal, waktuSholat, dataList, inputOleh || 'Guru');
      return jsonResponse({ success: true, message: `${dataList.length} data absensi sholat berhasil disimpan.` });
    }

    if (method === 'GET' && path === '/sholat/rekap') {
      const filterKelas = url.searchParams.get('kelas') || '';
      const bulan = url.searchParams.get('bulan') || getTodayStr().substring(0, 7);
      const waktuSholat = url.searchParams.get('waktuSholat') || '';

      const rows = await db.getSholatMonth(bulan);
      let filtered = rows;
      if (waktuSholat) filtered = filtered.filter((r) => r.waktuSholat === waktuSholat);
      if (filterKelas && filterKelas !== 'SEMUA') {
        const allowed = filterKelas.split(',').map((k) => k.trim().toUpperCase());
        filtered = filtered.filter((r) => allowed.includes(r.kelas.toUpperCase()));
      }
      return jsonResponse({ success: true, data: filtered });
    }

    // ------------------------------------------------------------------
    // 9. WHATSAPP LOG NOTIFIKASI
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/whatsapp/status') {
      const targetDate = url.searchParams.get('tanggal') || getTodayStr();
      const map = await db.getWaStatus(targetDate);
      return jsonResponse({ success: true, data: map });
    }

    if (method === 'POST' && path === '/whatsapp/kirim') {
      const { nisn, tanggal } = await readJson(request);
      await db.recordWaSent(String(nisn).trim(), tanggal);
      return jsonResponse({ success: true, message: 'Notifikasi berhasil dicatat.' });
    }

    // ------------------------------------------------------------------
    // 10. PROMOSI & ARSIP
    // ------------------------------------------------------------------
    if (method === 'POST' && path === '/promosi/proses') {
      const { kelasTujuan, promoData } = await readJson(request);
      if (!Array.isArray(promoData)) {
        return jsonResponse({ success: false, message: 'Data promosi kosong' }, 400);
      }
      for (const p of promoData) {
        if (p.status === 'NAIK') {
          if (kelasTujuan === 'LULUS') {
            await db.deleteSiswa(p.nisn);
          } else {
            await db.updateSiswa(p.nisn, { kelas: kelasTujuan });
          }
        }
      }
      return jsonResponse({ success: true, message: 'Kenaikan kelas berhasil diproses.' });
    }

    if (method === 'POST' && path === '/arsip/reset') {
      const { namaArsip } = await readJson(request);
      await db.clearAcademicYear();
      return jsonResponse({
        success: true,
        message: `Data absensi berhasil diarsipkan dan direset untuk ${namaArsip || 'Tahun Baru'}.`,
      });
    }

    // ------------------------------------------------------------------
    // 11. PENGAJUAN IZIN & SAKIT
    // ------------------------------------------------------------------
    if (method === 'GET' && path === '/pengajuan-izin') {
      const nisn = url.searchParams.get('nisn') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const kelas = url.searchParams.get('kelas') || undefined;
      const list = await db.getAllPengajuan({ nisn, status, kelas });
      return jsonResponse({ success: true, data: list });
    }

    if (method === 'POST' && path === '/pengajuan-izin') {
      const { nisn, nama, kelas, jenis, tanggalMulai, tanggalSelesai, keterangan, dokumenUrl } = await readJson(request);
      if (!nisn || !nama || !jenis || !tanggalMulai || !tanggalSelesai) {
        return jsonResponse({ success: false, message: 'Data pengajuan tidak lengkap.' }, 400);
      }
      if (tanggalSelesai < tanggalMulai) {
        return jsonResponse({ success: false, message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' }, 400);
      }

      const created = await db.createPengajuan({
        nisn: String(nisn).trim(),
        nama: String(nama).trim(),
        kelas: String(kelas || '').trim(),
        jenis: jenis === 'Sakit' ? 'Sakit' : 'Izin',
        tanggalMulai: String(tanggalMulai).trim(),
        tanggalSelesai: String(tanggalSelesai).trim(),
        keterangan: String(keterangan || '').trim(),
        dokumenUrl: dokumenUrl ? String(dokumenUrl).trim() : '',
      });

      return jsonResponse({
        success: true,
        message: 'Pengajuan izin/sakit berhasil dikirim dan menunggu persetujuan Admin/Guru.',
        data: created,
      });
    }

    if (method === 'POST' && /^\/pengajuan-izin\/\d+\/review$/.test(path)) {
      const id = parseInt(path.split('/')[2], 10);
      const { status, catatanAdmin } = await readJson(request);
      if (!['Disetujui', 'Ditolak'].includes(status)) {
        return jsonResponse({ success: false, message: 'Status review harus "Disetujui" atau "Ditolak".' }, 400);
      }

      const user = await resolveAuth(request, db);
      const reviewerName = user.nama || user.identifier || 'Admin/Guru';
      const updated = await db.reviewPengajuan(id, status, catatanAdmin || '', reviewerName);
      if (!updated) {
        return jsonResponse({ success: false, message: 'Data pengajuan tidak ditemukan.' }, 404);
      }

      return jsonResponse({
        success: true,
        message: `Pengajuan berhasil ${status.toLowerCase()} dan status absensi siswa telah diperbarui.`,
        data: updated,
      });
    }

    // ------------------------------------------------------------------
    // 12. LAPORAN KEHADIRAN SISWA BULANAN
    // ------------------------------------------------------------------
    if (method === 'GET' && path.startsWith('/absensi/siswa-bulanan/')) {
      const rawNisn = decodeURIComponent(path.split('/')[3] || '');
      const cleanNisn = String(rawNisn).replace(/[^a-zA-Z0-9]/g, '').trim();
      if (!cleanNisn) {
        return jsonResponse({ success: false, message: 'NISN tidak valid.' }, 400);
      }

      const bulanQuery = url.searchParams.get('bulan') || '';
      const currentYM = getTodayStr().substring(0, 7);
      const targetYM = bulanQuery || currentYM;

      const rows = await db.getAbsensiMonthByNisn(cleanNisn, targetYM);

      let totalHadir = 0;
      let totalSakit = 0;
      let totalIzin = 0;
      let totalAlpa = 0;
      let totalTerlambat = 0;

      rows.forEach((r) => {
        const st = r.status || 'Hadir';
        if (st === 'Hadir') {
          totalHadir++;
          if (r.keterangan && r.keterangan.toLowerCase().includes('terlambat')) {
            totalTerlambat++;
          }
        } else if (st === 'Sakit') {
          totalSakit++;
        } else if (st === 'Izin') {
          totalIzin++;
        } else if (st === 'Alpa') {
          totalAlpa++;
        }
      });

      const totalTercatat = totalHadir + totalSakit + totalIzin + totalAlpa;
      const persentaseHadir = totalTercatat > 0 ? Math.round((totalHadir / totalTercatat) * 100) : 100;

      return jsonResponse({
        success: true,
        data: {
          nisn: cleanNisn,
          bulan: targetYM,
          totalHadir,
          totalSakit,
          totalIzin,
          totalAlpa,
          totalTerlambat,
          totalTercatat,
          persentaseHadir,
          records: rows,
        },
      });
    }

    return jsonResponse({ success: false, message: `Endpoint API tidak ditemukan: ${method} /api${path}` }, 404);
  } catch (error: any) {
    console.error('[Cloudflare Pages API Error]', error);
    return jsonResponse({ success: false, message: error?.message || 'Internal Server Error' }, 500);
  }
}
