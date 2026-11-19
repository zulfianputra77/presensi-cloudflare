import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { storage } from './storage.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';

export const apiRouter = Router();

apiRouter.get('/database/status', (_req: Request, res: Response) => {
  return res.json({ success: true, ...storage.getDatabaseStatus() });
});

// Helper: Format date/time in Indonesian Western Time (Asia/Jakarta - WIB / UTC+7)
export const getWibDateTime = (clientTime?: string, clientDate?: string) => {
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
  parts.forEach(p => { map[p.type] = p.value; });

  const dateStr = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) ? clientDate : `${map.year}-${map.month}-${map.day}`;
  let timeStr = `${map.hour}:${map.minute}`;
  let timeSecStr = `${map.hour}:${map.minute}:${map.second}`;

  if (clientTime && /^\d{1,2}[:.]\d{2}/.test(clientTime)) {
    const clean = clientTime.replace('.', ':');
    const p = clean.split(':');
    timeStr = `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
    timeSecStr = `${timeStr}:${(p[2] || '00').padStart(2, '0')}`;
  }

  return { dateStr, timeStr, timeSecStr };
};

const getTodayStr = (clientDate?: string) => {
  return getWibDateTime(undefined, clientDate).dateStr;
};

const getNowTimeStr = (clientTime?: string) => {
  return getWibDateTime(clientTime).timeStr;
};

const getNowTimeSecStr = (clientTime?: string) => {
  return getWibDateTime(clientTime).timeSecStr;
};

const calculateTimeDiffMinutes = (startTime: string, endTime: string) => {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
};

// Helper: Check holiday and schedule
async function checkHolidayStatus(dateStr: string, config: any) {
  const d = new Date(dateStr + 'T12:00:00+07:00');
  let jsDay = d.getDay(); // 0=Sunday, 1=Monday... 6=Saturday
  const dayKey = jsDay === 0 ? '7' : String(jsDay);
  const dayNames: Record<string, string> = { '1': 'Senin', '2': 'Selasa', '3': 'Rabu', '4': 'Kamis', '5': 'Jumat', '6': 'Sabtu', '7': 'Minggu' };

  if (config.jadwal_harian && config.jadwal_harian[dayKey]?.libur) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur rutin: Hari ${dayNames[dayKey] || ''}` };
  } else if (!config.jadwal_harian && (dayKey === '6' || dayKey === '7')) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur rutin: Hari ${dayNames[dayKey] || ''}` };
  }

  const holidays = await storage.getAllHariLibur();
  const libur = holidays.find(h => h.tanggal === dateStr);
  if (libur) {
    return { isHoliday: true, message: `Absensi DITUTUP. Hari ini libur: ${libur.keterangan}` };
  }

  return { isHoliday: false, message: '' };
}

// ----------------------------------------------------------------------
// 1. AUTENTIKASI & SESSION
// ----------------------------------------------------------------------
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password, nisn } = req.body;

    let userFound: {
      role: string;
      identifier: string;
      nama: string;
      kelas: string;
    } | null = null;

    if (nisn) {
      const cleanNisn = String(nisn).trim();
      const s = await storage.findSiswaByNisn(cleanNisn);
      if (!s) {
        return res.status(404).json({ success: false, message: 'NISN tidak ditemukan di database.' });
      }
      userFound = {
        role: 'siswa',
        identifier: s.nisn,
        nama: s.nama,
        kelas: s.kelas,
      };
    } else if (username && password) {
      const cleanUser = String(username).trim();
      const u = await storage.findUserByUsername(cleanUser);
      if (!u || u.password !== String(password).trim()) {
        return res.status(401).json({ success: false, message: 'Username atau password salah.' });
      }
      userFound = {
        role: u.role,
        identifier: u.username,
        nama: u.nama || u.username,
        kelas: u.kelas || '',
      };
    } else {
      return res.status(400).json({ success: false, message: 'Kredensial login tidak lengkap.' });
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await storage.createSession({
      token,
      identifier: userFound.identifier,
      role: userFound.role,
      nama: userFound.nama,
      kelas: userFound.kelas,
      expiresAt: expiry,
    });

    return res.json({
      success: true,
      token,
      role: userFound.role,
      username: userFound.identifier,
      nama: userFound.nama,
      kelas: userFound.kelas,
      nisn: userFound.role === 'siswa' ? userFound.identifier : null,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
  }
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  return res.json({ success: true, user: req.user });
});

apiRouter.post('/auth/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  const token = (req.headers.authorization?.split('Bearer ')[1]) || (req.headers['x-session-token'] as string);
  if (token) {
    await storage.deleteSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// ----------------------------------------------------------------------
// 2. SISWA CRUD, LOOKUP & TEMPLATE EXCEL
// ----------------------------------------------------------------------
apiRouter.get('/siswa', async (req: Request, res: Response) => {
  try {
    const filterKelas = req.query.filterKelas as string;
    const list = await storage.getAllSiswa(filterKelas);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/siswa/cache', async (_req: Request, res: Response) => {
  try {
    const list = await storage.getAllSiswa();
    return res.json({ success: true, data: list.map(s => ({ nisn: s.nisn, nama: s.nama, kelas: s.kelas })) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint unduh template Excel resmi untuk Direktori Siswa
apiRouter.get('/siswa/template', async (_req: Request, res: Response) => {
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

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 25 }, // Nama Lengkap
      { wch: 15 }, // NISN
      { wch: 15 }, // Jenis Kelamin
      { wch: 15 }, // Tanggal Lahir
      { wch: 12 }, // Agama
      { wch: 20 }, // Nama Ayah
      { wch: 20 }, // Nama Ibu
      { wch: 18 }, // No Handphone
      { wch: 10 }, // Kelas
      { wch: 35 }, // Alamat
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');

    // Instructions sheet
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
      ['Alamat', 'Alamat tempat tinggal siswa.']
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
    wsInstr['!cols'] = [{ wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Template_Import_Siswa_Format_Resmi.xlsx"');
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/siswa/:nisn', async (req: Request, res: Response) => {
  try {
    const cleanNisn = String(req.params.nisn).trim();
    const s = await storage.findSiswaByNisn(cleanNisn);
    if (!s) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    return res.json({ success: true, data: s });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/siswa', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const cleanNisn = String(data.nisn).replace(/'/g, '').trim();

    const existing = await storage.findSiswaByNisn(cleanNisn);
    if (existing) {
      return res.status(400).json({ success: false, message: 'NISN sudah terdaftar' });
    }

    await storage.createSiswa({
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

    return res.json({ success: true, message: 'Siswa berhasil ditambahkan' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/siswa/:oldNisn', requireAuth, async (req: Request, res: Response) => {
  try {
    const oldNisn = String(req.params.oldNisn).replace(/'/g, '').trim();
    const data = req.body;

    await storage.updateSiswa(oldNisn, {
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

    return res.json({ success: true, message: 'Data siswa berhasil diupdate' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/siswa/:nisn', requireAuth, async (req: Request, res: Response) => {
  try {
    const cleanNisn = String(req.params.nisn).replace(/'/g, '').trim();
    await storage.deleteSiswa(cleanNisn);
    return res.json({ success: true, message: 'Data siswa berhasil dihapus' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/siswa/bulk-import', requireAuth, async (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Data import kosong' });
    }

    let added = 0;
    let skipped = 0;

    for (const item of items) {
      const cleanNisn = String(item.nisn || '').replace(/'/g, '').trim();
      if (!cleanNisn || !item.nama) {
        skipped++;
        continue;
      }

      const existing = await storage.findSiswaByNisn(cleanNisn);
      if (existing) {
        skipped++;
        continue;
      }

      await storage.createSiswa({
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

    return res.json({
      success: true,
      added,
      skipped,
      message: `Import selesai. Berhasil: ${added}, Dilewati/Duplikat: ${skipped}`,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 3. GURU CRUD
// ----------------------------------------------------------------------
apiRouter.get('/guru', requireAuth, async (_req: Request, res: Response) => {
  try {
    const list = await storage.getAllGuru();
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/guru', requireAuth, async (req: Request, res: Response) => {
  try {
    const { username, password, kelas: guruKelas } = req.body;
    const cleanUser = String(username).replace(/'/g, '').trim();

    const existing = await storage.findUserByUsername(cleanUser);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username guru sudah terdaftar' });
    }

    await storage.createGuru({
      username: cleanUser,
      password: String(password).replace(/'/g, '').trim(),
      role: 'guru',
      nama: cleanUser,
      kelas: guruKelas || '',
    });

    return res.json({ success: true, message: 'Guru berhasil ditambahkan' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/guru/:oldUsername', requireAuth, async (req: Request, res: Response) => {
  try {
    const oldUsername = String(req.params.oldUsername).replace(/'/g, '').trim();
    const { username, password, kelas: guruKelas } = req.body;

    await storage.updateGuru(oldUsername, {
      username: username ? String(username).replace(/'/g, '').trim() : undefined,
      password: password ? String(password).replace(/'/g, '').trim() : undefined,
      kelas: guruKelas !== undefined ? guruKelas : undefined,
    });

    return res.json({ success: true, message: 'Data guru berhasil diupdate' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/guru/:username', requireAuth, async (req: Request, res: Response) => {
  try {
    const cleanUser = String(req.params.username).replace(/'/g, '').trim();
    await storage.deleteGuru(cleanUser);
    return res.json({ success: true, message: 'Guru berhasil dihapus' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 4. KELAS CRUD
// ----------------------------------------------------------------------
apiRouter.get('/kelas', async (_req: Request, res: Response) => {
  try {
    const list = await storage.getAllKelas();
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/kelas/master', async (_req: Request, res: Response) => {
  try {
    const list = await storage.getKelasMaster();
    return res.json({ success: true, data: list.map(k => ({ rowIndex: k.id, nama: k.nama })) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/kelas', requireAuth, async (req: Request, res: Response) => {
  try {
    const nama = String(req.body.namaKelas || req.body.nama || '').trim();
    if (!nama) return res.status(400).json({ success: false, message: 'Nama kelas tidak boleh kosong' });

    const existing = await storage.getAllKelas();
    if (existing.some(k => k.toLowerCase() === nama.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Kelas "${nama}" sudah ada.` });
    }

    await storage.createKelas(nama);
    return res.json({ success: true, message: `Kelas "${nama}" berhasil ditambahkan.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/kelas/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const namaBaru = String(req.body.namaBaru || req.body.nama || '').trim();
    if (!namaBaru) return res.status(400).json({ success: false, message: 'Nama kelas baru tidak boleh kosong' });

    await storage.updateKelas(id, namaBaru);
    return res.json({ success: true, message: `Kelas berhasil diubah ke "${namaBaru}".` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/kelas/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const master = await storage.getKelasMaster();
    const item = master.find(m => m.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Kelas tidak ditemukan' });

    const allSiswa = await storage.getAllSiswa(item.nama);
    if (allSiswa.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Kelas "${item.nama}" masih digunakan oleh ${allSiswa.length} siswa. Pindahkan atau hapus siswa terlebih dahulu.`,
      });
    }

    await storage.deleteKelas(id, item.nama);
    return res.json({ success: true, message: `Kelas "${item.nama}" berhasil dihapus.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 5. HARI LIBUR & KONFIGURASI
// ----------------------------------------------------------------------
apiRouter.get('/hari-libur', async (_req: Request, res: Response) => {
  try {
    const list = await storage.getAllHariLibur();
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/hari-libur', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tanggal, keterangan } = req.body;
    await storage.addHariLibur(tanggal, keterangan);
    return res.json({ success: true, message: 'Hari libur berhasil ditambahkan' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/hari-libur/range', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tanggalMulai, tanggalAkhir, keterangan } = req.body;
    if (tanggalAkhir < tanggalMulai) {
      return res.status(400).json({ success: false, message: 'Tanggal akhir tidak boleh sebelum tanggal mulai.' });
    }

    const dMulai = new Date(tanggalMulai + 'T00:00:00');
    const dAkhir = new Date(tanggalAkhir + 'T00:00:00');
    let added = 0;

    for (let d = new Date(dMulai); d <= dAkhir; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      await storage.addHariLibur(dateStr, keterangan);
      added++;
    }

    return res.json({ success: true, message: `${added} hari libur berhasil ditambahkan.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/hari-libur', requireAuth, async (req: Request, res: Response) => {
  try {
    const { oldDate, newDate, newKeterangan } = req.body;
    if (oldDate !== newDate) {
      await storage.deleteHariLibur(oldDate);
    }
    await storage.addHariLibur(newDate, newKeterangan);
    return res.json({ success: true, message: 'Hari libur berhasil diperbarui' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/hari-libur/:tanggal', requireAuth, async (req: Request, res: Response) => {
  try {
    const tanggal = req.params.tanggal;
    await storage.deleteHariLibur(tanggal);
    return res.json({ success: true, message: 'Hari libur dihapus' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const cfg = await storage.getConfig();
    let jadwalHarian = {};
    if (cfg.jadwal_harian) {
      try { jadwalHarian = JSON.parse(cfg.jadwal_harian); } catch {}
    }

    return res.json({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const newConfig = req.body;
    if (newConfig.jam_masuk_mulai) await storage.saveConfigKey('jam_masuk_mulai', newConfig.jam_masuk_mulai);
    if (newConfig.jam_masuk_akhir) await storage.saveConfigKey('jam_masuk_akhir', newConfig.jam_masuk_akhir);
    if (newConfig.jam_pulang_mulai) await storage.saveConfigKey('jam_pulang_mulai', newConfig.jam_pulang_mulai);
    if (newConfig.jam_pulang_akhir) await storage.saveConfigKey('jam_pulang_akhir', newConfig.jam_pulang_akhir);
    if (newConfig.mode_absen) await storage.saveConfigKey('mode_absen', newConfig.mode_absen);

    if (newConfig.jadwal_harian) {
      const parsed = typeof newConfig.jadwal_harian === 'string'
        ? JSON.parse(newConfig.jadwal_harian)
        : newConfig.jadwal_harian;
      await storage.saveConfigKey('jadwal_harian', JSON.stringify(parsed));
    } else {
      const curCfg = await storage.getConfig();
      let jadwalHarian: any = {};
      try { jadwalHarian = JSON.parse(curCfg.jadwal_harian || '{}'); } catch {}
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
      await storage.saveConfigKey('jadwal_harian', JSON.stringify(jadwalHarian));
    }

    return res.json({ success: true, message: 'Konfigurasi jadwal operasional berhasil disimpan' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 6. REALTIME PRESENSI & SCAN (DAFTAR HADIR)
// ----------------------------------------------------------------------
apiRouter.get('/absensi/today/:nisn', async (req: Request, res: Response) => {
  try {
    const cleanNisn = String(req.params.nisn).trim();
    const today = getTodayStr();
    const cfg = await storage.getConfig();
    let jadwalHarian = {};
    try { jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}'); } catch {}

    const holidayInfo = await checkHolidayStatus(today, { ...cfg, jadwal_harian: jadwalHarian });
    const rec = await storage.getAbsensiToday(today, cleanNisn);

    return res.json({
      success: true,
      data: rec ? {
        tanggal: rec.tanggal,
        jamDatang: rec.jamDatang || '',
        jamPulang: rec.jamPulang || '',
        status: rec.status || 'Hadir',
      } : null,
      isLibur: holidayInfo.isHoliday,
      keteranganLibur: holidayInfo.message,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/absensi/monitoring', async (req: Request, res: Response) => {
  try {
    const today = getTodayStr();
    const filterKelas = req.query.filterKelas as string;

    const allSiswa = await storage.getAllSiswa(filterKelas);
    const allAbsenToday = await storage.getAbsensiByDate(today);

    const absenMap: Record<string, any> = {};
    allAbsenToday.forEach(a => { absenMap[a.nisn] = a; });

    const result = allSiswa.map(s => {
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

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update status (diperbolehkan juga di mode kiosk publik)
apiRouter.post('/absensi/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { nisn, nama, kelas: siswaKelas, status: newStatus, tanggal: clientTanggal } = req.body;
    const cleanNisn = String(nisn).trim();
    const today = (clientTanggal && /^\d{4}-\d{2}-\d{2}$/.test(clientTanggal)) ? clientTanggal : getTodayStr();
    const nowSecTime = getNowTimeSecStr();

    await storage.updateAbsensiStatus(today, cleanNisn, nama, siswaKelas, newStatus, nowSecTime);

    return res.json({ success: true, message: 'Status berhasil diubah', jamDatang: nowSecTime, tanggal: today });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Single QR Scan
apiRouter.post('/absensi/scan', async (req: Request, res: Response) => {
  try {
    const { nisn, scannerRole, scannerKelas, scanMode = 'auto', clientTime, clientDate } = req.body;
    const cleanNisn = String(nisn || '').replace(/[^a-zA-Z0-9]/g, '').trim();

    if (!cleanNisn) {
      return res.status(400).json({ success: false, message: 'QR Code tidak valid atau kosong.' });
    }

    const { dateStr: today, timeStr: nowTime, timeSecStr: nowSecTime } = getWibDateTime(clientTime, clientDate);

    const cfg = await storage.getConfig();
    let jadwalHarian: any = {};
    try { jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}'); } catch {}
    const config: Record<string, any> = { ...cfg, jadwal_harian: jadwalHarian };

    // 1. Holiday Check
    const holidayInfo = await checkHolidayStatus(today, config);
    if (holidayInfo.isHoliday) {
      return res.json({ success: false, message: holidayInfo.message });
    }

    // 2. Lookup student
    const targetSiswa = await storage.findSiswaByNisn(cleanNisn);
    if (!targetSiswa) {
      return res.json({ success: false, message: 'NISN tidak terdaftar di database.' });
    }

    // 3. Scanner role & class check
    if (scannerRole === 'guru' && scannerKelas && scannerKelas !== 'SEMUA') {
      const allowedKelas = String(scannerKelas).split(',').map(k => k.trim().toUpperCase());
      if (!allowedKelas.includes(targetSiswa.kelas.toUpperCase())) {
        return res.json({
          success: false,
          message: `Ditolak! Siswa ini kelas ${targetSiswa.kelas}. Anda hanya bisa scan kelas ${scannerKelas}.`,
        });
      }
    }

    // Determine operational hours based on day or general config
    const d = new Date(today + 'T12:00:00+07:00');
    let jsDay = d.getDay(); // 0=Sunday, 1=Monday... 6=Saturday
    const dayKey = jsDay === 0 ? '7' : String(jsDay);
    const daySchedule = jadwalHarian && jadwalHarian[dayKey] ? jadwalHarian[dayKey] : null;

    const jamMasukMulai = (daySchedule && daySchedule.masuk_mulai) ? daySchedule.masuk_mulai : (config.jam_masuk_mulai || '06:00');
    const jamMasukAkhir = (daySchedule && daySchedule.masuk_akhir) ? daySchedule.masuk_akhir : (config.jam_masuk_akhir || '07:15');
    const jamPulangMulai = (daySchedule && daySchedule.pulang_mulai) ? daySchedule.pulang_mulai : (config.jam_pulang_mulai || '15:00');

    // 4. Attendance Handling
    const existing = await storage.getAbsensiToday(today, cleanNisn);
    const modeAbsen = scanMode === 'pulang' ? 'masuk_pulang' : (config.mode_absen || 'masuk_pulang');

    // ==========================================================
    // KHUSUS MODE ABSEN PULANG
    // ==========================================================
    if (scanMode === 'pulang') {
      if (!existing || existing.status === 'Belum Absen' || !existing.status) {
        return res.json({
          success: false,
          code: 'BELUM_MASUK',
          message: `${targetSiswa.nama} belum melakukan absen datang hari ini, tidak bisa absen pulang.`,
          nama: targetSiswa.nama,
          kelas: targetSiswa.kelas,
        });
      }

      if (existing.status === 'Sakit' || existing.status === 'Izin' || existing.status === 'Alpa') {
        return res.json({
          success: false,
          code: 'STATUS_BUKAN_HADIR',
          message: `${targetSiswa.nama} tercatat ${existing.status} hari ini, tidak bisa scan absen pulang.`,
          nama: targetSiswa.nama,
          kelas: targetSiswa.kelas,
        });
      }

      if (existing.jamPulang) {
        return res.json({
          success: false,
          code: 'ALREADY_PULANG',
          message: `${targetSiswa.nama} sudah absen pulang hari ini (${existing.jamPulang.substring(0, 5)} WIB).`,
          nama: targetSiswa.nama,
          jamPulang: existing.jamPulang,
        });
      }

      // Siswa berstatus Hadir (baik via scan QR maupun manual guru) -> catat pulang
      let ketBaru = existing.keterangan || '';
      let pesanPulang = 'Absen Pulang Berhasil ✓';
      if (nowTime < jamPulangMulai) {
        ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat';
        pesanPulang = 'Absen Pulang (Pulang Cepat)';
      }

      await storage.recordAbsensiPulang(existing.id, nowSecTime, ketBaru);

      return res.json({
        success: true,
        message: pesanPulang,
        type: 'pulang',
        jamPulang: nowSecTime,
        nama: targetSiswa.nama,
        kelas: targetSiswa.kelas,
        status: 'Hadir',
      });
    }

    // ==========================================================
    // MODE MASUK ATAU AUTO (DATANG / PULANG)
    // ==========================================================
    if (existing) {
      if (modeAbsen === 'masuk_saja') {
        return res.json({ success: false, message: `${targetSiswa.nama} sudah absen masuk hari ini.` });
      }

      if (scanMode === 'masuk') {
        return res.json({
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

      // Mode auto: Jika siswa berstatus Sakit/Izin/Alpa tidak bisa pulang
      if (existing.status === 'Sakit' || existing.status === 'Izin' || existing.status === 'Alpa') {
        return res.json({
          success: false,
          code: 'STATUS_BUKAN_HADIR',
          message: `${targetSiswa.nama} tercatat ${existing.status} hari ini, tidak bisa scan absen pulang.`,
          nama: targetSiswa.nama,
          kelas: targetSiswa.kelas,
        });
      }

      if (existing.jamPulang) {
        return res.json({
          success: false,
          code: 'ALREADY_PULANG',
          message: `${targetSiswa.nama} sudah absen pulang hari ini (${existing.jamPulang.substring(0, 5)} WIB).`,
          nama: targetSiswa.nama,
          jamPulang: existing.jamPulang,
        });
      }

      // Record Pulang
      let ketBaru = existing.keterangan || '';
      let pesanPulang = 'Absen Pulang Berhasil ✓';
      if (nowTime < jamPulangMulai) {
        ketBaru = (ketBaru ? ketBaru + ' & ' : '') + 'Pulang Cepat';
        pesanPulang = 'Absen Pulang (Pulang Cepat)';
      }

      await storage.recordAbsensiPulang(existing.id, nowSecTime, ketBaru);

      return res.json({
        success: true,
        message: pesanPulang,
        type: 'pulang',
        jamPulang: nowSecTime,
        nama: targetSiswa.nama,
        kelas: targetSiswa.kelas,
        status: 'Hadir',
      });
    }

    // New Check-in (Masuk)
    if (nowTime < jamMasukMulai) {
      return res.json({
        success: false,
        message: `Absensi belum dibuka. Buka mulai jam ${jamMasukMulai} WIB (Waktu sekarang: ${nowTime} WIB).`,
      });
    }

    let keteranganWaktu = 'Tepat Waktu';
    const batasAkhir = jamMasukAkhir;
    if (nowTime > batasAkhir) {
      const lateMinutes = calculateTimeDiffMinutes(batasAkhir, nowTime);
      keteranganWaktu = `Terlambat ${lateMinutes} menit`;
    }

    await storage.recordAbsensiMasuk({
      tanggal: today,
      nisn: cleanNisn,
      nama: targetSiswa.nama,
      kelas: targetSiswa.kelas,
      jamDatang: nowSecTime,
      jamPulang: '',
      keterangan: keteranganWaktu,
      status: 'Hadir',
    });

    return res.json({
      success: true,
      message: keteranganWaktu.includes('Terlambat') ? `Absen Masuk (${keteranganWaktu})` : 'Absen Masuk Berhasil ✓',
      type: 'datang',
      jamDatang: nowSecTime,
      nama: targetSiswa.nama,
      kelas: targetSiswa.kelas,
      status: 'Hadir',
    });
  } catch (error: any) {
    console.error('Scan error:', error);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Daftar Hadir: By Class & Date
apiRouter.get('/absensi/daftar-hadir', async (req: Request, res: Response) => {
  try {
    const { kelas: filterKelas, tanggal } = req.query as { kelas: string; tanggal: string };
    if (!tanggal) return res.json({ success: true, data: {} });

    const records = await storage.getAbsensiByDate(tanggal);
    const result: Record<string, { status: string; jamDatang: string; hasJamDatang: boolean }> = {};
    const allowed = filterKelas && filterKelas !== 'SEMUA' ? filterKelas.split(',').map(k => k.trim().toUpperCase()) : null;

    records.forEach(r => {
      if (!allowed || allowed.includes(r.kelas.toUpperCase())) {
        result[r.nisn] = {
          status: r.status.toLowerCase(),
          jamDatang: r.jamDatang ? r.jamDatang.substring(0, 5) : '',
          hasJamDatang: !!r.jamDatang,
        };
      }
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Daftar Hadir: Detail By Class & Date
apiRouter.get('/absensi/daftar-hadir-detail', async (req: Request, res: Response) => {
  try {
    const { kelas: filterKelas, tanggal } = req.query as { kelas: string; tanggal: string };
    const queryDate = (tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)) ? tanggal : getTodayStr();

    const records = await storage.getAbsensiByDate(queryDate);
    const result: Record<string, { status: string; jamDatang: string; jamPulang: string; rowIndex: number }> = {};
    const allowed = filterKelas && filterKelas !== 'SEMUA' ? filterKelas.split(',').map(k => k.trim().toUpperCase()) : null;

    records.forEach(r => {
      // Include student record if class matches or if checking all students; also include if NISN exists
      if (!allowed || !r.kelas || allowed.includes(r.kelas.trim().toUpperCase())) {
        result[r.nisn] = {
          status: (r.status || 'Hadir').toLowerCase(),
          jamDatang: r.jamDatang ? r.jamDatang.substring(0, 5) : '',
          jamPulang: r.jamPulang ? r.jamPulang.substring(0, 5) : '',
          rowIndex: r.id,
        };
      } else {
        // Fallback: also provide record so client student list can look it up
        result[r.nisn] = {
          status: (r.status || 'Hadir').toLowerCase(),
          jamDatang: r.jamDatang ? r.jamDatang.substring(0, 5) : '',
          jamPulang: r.jamPulang ? r.jamPulang.substring(0, 5) : '',
          rowIndex: r.id,
        };
      }
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/absensi/pulang-satu', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { nisn, tanggal } = req.body;
    const cleanNisn = String(nisn).trim();
    const nowSecTime = getNowTimeSecStr();
    const nowTime = getNowTimeStr();
    const cfg = await storage.getConfig();

    const rec = await storage.getAbsensiToday(tanggal, cleanNisn);
    if (!rec) {
      return res.status(404).json({ success: false, message: 'Data absen masuk tidak ditemukan. Siswa belum melakukan absen datang.' });
    }

    if (rec.status !== 'Hadir') {
      return res.status(400).json({ success: false, message: `Siswa berstatus ${rec.status}, tidak perlu absen pulang.` });
    }

    if (rec.jamPulang) {
      return res.status(400).json({ success: false, message: `${rec.nama} sudah tercatat pulang (${rec.jamPulang}).` });
    }

    let ketBaru = rec.keterangan || 'Tepat Waktu';
    if (nowTime < (cfg.jam_pulang_mulai || '15:00') && !ketBaru.includes('Pulang Cepat')) {
      ketBaru = `${ketBaru} & Pulang Cepat`;
    }

    await storage.recordAbsensiPulang(rec.id, nowSecTime, ketBaru);

    return res.json({
      success: true,
      nama: rec.nama,
      jamPulang: nowSecTime,
      message: `${rec.nama} berhasil dicatat pulang (${nowSecTime})`,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/absensi/pulang-semua-hadir', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kelas: filterKelas, tanggal, namaPengirim } = req.body;
    const nowSecTime = getNowTimeSecStr();
    const nowTime = getNowTimeStr();
    const cfg = await storage.getConfig();

    const allToday = await storage.getAbsensiByDate(tanggal);
    const allowed = filterKelas && filterKelas !== 'SEMUA' ? filterKelas.split(',').map((k: string) => k.trim().toUpperCase()) : null;

    const eligible = allToday.filter(r =>
      r.status === 'Hadir' &&
      !r.jamPulang &&
      (!allowed || allowed.includes(r.kelas.toUpperCase()))
    );

    if (eligible.length === 0) {
      return res.json({ success: true, count: 0, message: 'Tidak ada siswa berstatus Hadir yang belum absen pulang.' });
    }

    let count = 0;
    for (const rec of eligible) {
      let ketBaru = rec.keterangan || 'Tepat Waktu';
      if (nowTime < (cfg.jam_pulang_mulai || '15:00') && !ketBaru.includes('Pulang Cepat')) {
        ketBaru = `${ketBaru} & Pulang Cepat (Input: ${namaPengirim || 'Guru'})`;
      }
      await storage.recordAbsensiPulang(rec.id, nowSecTime, ketBaru);
      count++;
    }

    return res.json({
      success: true,
      count,
      message: `${count} siswa Hadir berhasil dicatat pulang (${nowSecTime}). Status Sakit/Izin/Alpa tetap terjaga.`,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 7. LAPORAN & REKAP BULANAN
// ----------------------------------------------------------------------
apiRouter.get('/absensi/rekap-bulanan', async (req: Request, res: Response) => {
  try {
    const bulan = parseInt(req.query.bulan as string); // 0 = Jan, 11 = Dec
    const tahun = parseInt(req.query.tahun as string);
    const kelasFilter = req.query.kelas as string;

    const startDate = new Date(tahun, bulan, 1);
    const endDate = new Date(tahun, bulan + 1, 0);
    const daysInMonth = endDate.getDate();

    const startStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
    const endStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const todayStr = getTodayStr();

    const cfg = await storage.getConfig();
    let jadwalHarian = {};
    try { jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}'); } catch {}

    const allHolidays = await storage.getAllHariLibur();
    const holidayMap: Record<string, string> = {};
    allHolidays.forEach(h => {
      if (h.tanggal >= startStr && h.tanggal <= endStr) holidayMap[h.tanggal] = h.keterangan;
    });

    const studentList = await storage.getAllSiswa(kelasFilter);
    const absensiRows = await storage.getAbsensiRange(startStr, endStr);
    const absenMap: Record<string, string> = {};
    absensiRows.forEach(a => { absenMap[`${a.tanggal}_${a.nisn}`] = a.status; });

    const students = studentList.map(s => {
      const stats = { h: 0, s: 0, i: 0, a: 0, effectiveDays: 0 };
      const dailyCodes = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const curDate = new Date(tahun, bulan, day);
        const curStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isHoliday = !!holidayMap[curStr];
        const jsDay = curDate.getDay();
        const dayKey = jsDay === 0 ? '7' : String(jsDay);
        const isRoutineOff = (jadwalHarian as Record<string, any>)?.[dayKey]?.libur || jsDay === 0;

        let code = '-';
        const isDayOff = isHoliday || isRoutineOff;

        if (isDayOff) {
          code = 'L';
        } else if (curStr > todayStr) {
          code = '';
        } else {
          stats.effectiveDays++;
          const st = absenMap[`${curStr}_${s.nisn}`];
          if (st === 'Hadir') { code = 'H'; stats.h++; }
          else if (st === 'Sakit') { code = 'S'; stats.s++; }
          else if (st === 'Izin') { code = 'I'; stats.i++; }
          else { code = 'A'; stats.a++; }
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

    return res.json({ success: true, data: { daysInMonth, students } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Excel Export
apiRouter.post('/absensi/export-excel', async (req: Request, res: Response) => {
  try {
    const { type, filters } = req.body;
    const wb = XLSX.utils.book_new();

    if (type === 'laporan_bulanan') {
      const { bulan, tahun, kelas } = filters;
      const startDate = new Date(tahun, bulan, 1);
      const endDate = new Date(tahun, bulan + 1, 0);
      const daysInMonth = endDate.getDate();
      const startStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
      const endStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const cfg = await storage.getConfig();
      let jadwalHarian = {};
      try { jadwalHarian = JSON.parse(cfg.jadwal_harian || '{}'); } catch {}

      const allHolidays = await storage.getAllHariLibur();
      const holidayMap: Record<string, string> = {};
      allHolidays.forEach(h => {
        if (h.tanggal >= startStr && h.tanggal <= endStr) holidayMap[h.tanggal] = h.keterangan;
      });

      const studentList = await storage.getAllSiswa(kelas);
      const absensiRows = await storage.getAbsensiRange(startStr, endStr);
      const absenMap: Record<string, string> = {};
      absensiRows.forEach(a => { absenMap[`${a.tanggal}_${a.nisn}`] = a.status; });

      const headers = ['No', 'Nama Siswa', 'NISN', 'Kelas'];
      for (let d = 1; d <= daysInMonth; d++) headers.push(String(d));
      headers.push('H', 'S', 'I', 'A', '%');

      const rows: any[][] = [headers];

      studentList.forEach((s, idx) => {
        const row: any[] = [idx + 1, s.nama, s.nisn, s.kelas];
        let h = 0, sc = 0, i = 0, a = 0, eff = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const curStr = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isHoliday = !!holidayMap[curStr];
          const jsDay = new Date(tahun, bulan, day).getDay();
          const dayKey = jsDay === 0 ? '7' : String(jsDay);
          const isRoutineOff = (jadwalHarian as Record<string, any>)?.[dayKey]?.libur || jsDay === 0;

          if (isHoliday || isRoutineOff) {
            row.push('L');
          } else {
            eff++;
            const st = absenMap[`${curStr}_${s.nisn}`];
            if (st === 'Hadir') { row.push('H'); h++; }
            else if (st === 'Sakit') { row.push('S'); sc++; }
            else if (st === 'Izin') { row.push('I'); i++; }
            else { row.push('A'); a++; }
          }
        }
        const pct = eff > 0 ? Math.round((h / eff) * 100) : 0;
        row.push(h, sc, i, a, `${pct}%`);
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
    } else {
      // Monitoring & Log
      const fStart = filters.tanggalMulai || getTodayStr();
      const fEnd = filters.tanggalAkhir || getTodayStr();
      const filterKelas = filters.kelas;

      const studentList = await storage.getAllSiswa(filterKelas);
      const absensiRows = await storage.getAbsensiRange(fStart, fEnd);
      const absenMap: Record<string, any> = {};
      absensiRows.forEach(a => { absenMap[`${a.tanggal}_${a.nisn}`] = a; });

      const logRows: any[][] = [['No', 'Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Jam Datang', 'Jam Pulang', 'Keterangan', 'Status']];
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

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Presensi_${Date.now()}.xlsx`);
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 8. ABSENSI SHOLAT
// ----------------------------------------------------------------------
apiRouter.get('/sholat', async (req: Request, res: Response) => {
  try {
    const { kelas: filterKelas, tanggal, waktuSholat } = req.query as {
      kelas?: string;
      tanggal?: string;
      waktuSholat?: string;
    };

    const targetDate = tanggal || getTodayStr();
    const rows = await storage.getSholatByDate(targetDate, waktuSholat, filterKelas);

    const map: Record<string, { status: string; keterangan: string }> = {};
    rows.forEach(r => {
      map[r.nisn] = { status: r.status, keterangan: r.keterangan || '' };
    });

    return res.json({ success: true, data: map });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/sholat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dataList, tanggal, waktuSholat, inputOleh } = req.body;
    if (!Array.isArray(dataList) || dataList.length === 0) {
      return res.status(400).json({ success: false, message: 'Data sholat kosong' });
    }

    await storage.saveSholatRecords(tanggal, waktuSholat, dataList, inputOleh || 'Guru');
    return res.json({ success: true, message: `${dataList.length} data absensi sholat berhasil disimpan.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/sholat/rekap', async (req: Request, res: Response) => {
  try {
    const { kelas: filterKelas, bulan, waktuSholat } = req.query as {
      kelas?: string;
      bulan?: string; // YYYY-MM
      waktuSholat?: string;
    };

    const ym = bulan || getTodayStr().substring(0, 7);
    const rows = await storage.getSholatMonth(ym);
    let filtered = rows;
    if (waktuSholat) filtered = filtered.filter(r => r.waktuSholat === waktuSholat);
    if (filterKelas && filterKelas !== 'SEMUA') {
      const allowed = filterKelas.split(',').map(k => k.trim().toUpperCase());
      filtered = filtered.filter(r => allowed.includes(r.kelas.toUpperCase()));
    }

    return res.json({ success: true, data: filtered });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 9. WHATSAPP LOG NOTIFIKASI
// ----------------------------------------------------------------------
apiRouter.get('/whatsapp/status', async (req: Request, res: Response) => {
  try {
    const { tanggal } = req.query as { tanggal?: string };
    const targetDate = tanggal || getTodayStr();
    const map = await storage.getWaStatus(targetDate);
    return res.json({ success: true, data: map });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/whatsapp/kirim', requireAuth, async (req: Request, res: Response) => {
  try {
    const { nisn, tanggal } = req.body;
    const cleanNisn = String(nisn).trim();

    await storage.recordWaSent(cleanNisn, tanggal);
    return res.json({ success: true, message: 'Notifikasi berhasil dicatat.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 10. PROMOSI / KENAIKAN KELAS & ARSIP
// ----------------------------------------------------------------------
apiRouter.post('/promosi/proses', requireAuth, async (req: Request, res: Response) => {
  try {
    const { kelasAsal, kelasTujuan, promoData } = req.body;
    if (!Array.isArray(promoData)) return res.status(400).json({ success: false, message: 'Data promosi kosong' });

    for (const p of promoData) {
      if (p.status === 'NAIK') {
        if (kelasTujuan === 'LULUS') {
          await storage.deleteSiswa(p.nisn);
        } else {
          await storage.updateSiswa(p.nisn, { kelas: kelasTujuan });
        }
      }
    }

    return res.json({ success: true, message: 'Kenaikan kelas berhasil diproses.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/arsip/reset', requireAuth, async (req: Request, res: Response) => {
  try {
    const { namaArsip } = req.body;
    await storage.clearAcademicYear();
    return res.json({ success: true, message: `Data absensi berhasil diarsipkan dan direset untuk ${namaArsip || 'Tahun Baru'}.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 11. PENGAJUAN IZIN & SAKIT (SISWA & ADMIN REVIEW)
// ----------------------------------------------------------------------
apiRouter.get('/pengajuan-izin', async (req: Request, res: Response) => {
  try {
    const { nisn, status, kelas } = req.query as { nisn?: string; status?: string; kelas?: string };
    const list = await storage.getAllPengajuan({ nisn, status, kelas });
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/pengajuan-izin', async (req: Request, res: Response) => {
  try {
    const { nisn, nama, kelas, jenis, tanggalMulai, tanggalSelesai, keterangan, dokumenUrl } = req.body;

    if (!nisn || !nama || !jenis || !tanggalMulai || !tanggalSelesai) {
      return res.status(400).json({ success: false, message: 'Data pengajuan tidak lengkap.' });
    }

    if (tanggalSelesai < tanggalMulai) {
      return res.status(400).json({ success: false, message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
    }

    const created = await storage.createPengajuan({
      nisn: String(nisn).trim(),
      nama: String(nama).trim(),
      kelas: String(kelas || '').trim(),
      jenis: jenis === 'Sakit' ? 'Sakit' : 'Izin',
      tanggalMulai: String(tanggalMulai).trim(),
      tanggalSelesai: String(tanggalSelesai).trim(),
      keterangan: String(keterangan || '').trim(),
      dokumenUrl: dokumenUrl ? String(dokumenUrl).trim() : '',
    });

    return res.json({
      success: true,
      message: 'Pengajuan izin/sakit berhasil dikirim dan menunggu persetujuan Admin/Guru.',
      data: created,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/pengajuan-izin/:id/review', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, catatanAdmin } = req.body;

    if (!['Disetujui', 'Ditolak'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status review harus "Disetujui" atau "Ditolak".' });
    }

    const reviewerName = req.user?.nama || req.user?.identifier || 'Admin/Guru';
    const updated = await storage.reviewPengajuan(id, status, catatanAdmin || '', reviewerName);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Data pengajuan tidak ditemukan.' });
    }

    return res.json({
      success: true,
      message: `Pengajuan berhasil ${status.toLowerCase()} dan status absensi siswa telah diperbarui.`,
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------
// 12. LAPORAN KEHADIRAN SISWA BULANAN (UNTUK DASHBOARD SISWA)
// ----------------------------------------------------------------------
apiRouter.get('/absensi/siswa-bulanan/:nisn', async (req: Request, res: Response) => {
  try {
    const nisn = req.params.nisn;
    const cleanNisn = String(nisn || '').replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!cleanNisn) {
      return res.status(400).json({ success: false, message: 'NISN tidak valid.' });
    }

    const bulanQuery = req.query.bulan as string; // format YYYY-MM
    const currentYM = getTodayStr().substring(0, 7);
    const targetYM = bulanQuery || currentYM;

    const rows = await storage.getAbsensiMonthByNisn(cleanNisn, targetYM);

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
    // Persentase Kehadiran: (Hadir / total tercatat) * 100
    const persentaseHadir = totalTercatat > 0 ? Math.round((totalHadir / totalTercatat) * 100) : 100;

    return res.json({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

