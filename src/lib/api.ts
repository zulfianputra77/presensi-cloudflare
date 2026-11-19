/**
 * API Client for PostgreSQL Backend
 */

export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('absensiAppSession');
    if (!raw) return null;
    const sess = JSON.parse(raw);
    return sess.token || null;
  } catch {
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; [key: string]: any }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Session-Token'] = token;
  } else {
    headers['X-Kiosk-Mode'] = 'true';
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return json;
  } else if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
    // Blob download
    const blob = await res.blob();
    return { success: true, blob } as any;
  }

  const text = await res.text();
  return { success: res.ok, message: text } as any;
}

export const api = {
  // Auth
  login: (credentials: { username?: string; password?: string; nisn?: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  // Siswa
  getSiswaList: (filterKelas?: string) =>
    apiRequest(`/siswa${filterKelas ? `?filterKelas=${encodeURIComponent(filterKelas)}` : ''}`),
  getSiswaByNisn: (nisn: string) => apiRequest(`/siswa/${encodeURIComponent(nisn)}`),
  addSiswa: (siswaData: any) => apiRequest('/siswa', { method: 'POST', body: JSON.stringify(siswaData) }),
  updateSiswa: (oldNisn: string, siswaData: any) =>
    apiRequest(`/siswa/${encodeURIComponent(oldNisn)}`, { method: 'PUT', body: JSON.stringify(siswaData) }),
  deleteSiswa: (nisn: string) => apiRequest(`/siswa/${encodeURIComponent(nisn)}`, { method: 'DELETE' }),
  bulkImportSiswa: (data: any[]) => apiRequest('/siswa/bulk-import', { method: 'POST', body: JSON.stringify(data) }),

  // Guru
  getGuruList: () => apiRequest('/guru'),
  addGuru: (data: any) => apiRequest('/guru', { method: 'POST', body: JSON.stringify(data) }),
  updateGuru: (oldUsername: string, data: any) =>
    apiRequest(`/guru/${encodeURIComponent(oldUsername)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGuru: (username: string) => apiRequest(`/guru/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  bulkImportGuru: (data: any[]) => apiRequest('/guru/bulk-import', { method: 'POST', body: JSON.stringify(data) }),

  // Kelas
  getKelasList: () => apiRequest('/kelas'),
  getKelasMaster: () => apiRequest('/kelas/master'),
  addKelas: (namaKelas: string) => apiRequest('/kelas', { method: 'POST', body: JSON.stringify({ namaKelas }) }),
  updateKelas: (id: number, namaBaru: string) =>
    apiRequest(`/kelas/${id}`, { method: 'PUT', body: JSON.stringify({ namaBaru }) }),
  deleteKelas: (id: number) => apiRequest(`/kelas/${id}`, { method: 'DELETE' }),

  // Config & Holidays
  getConfig: () => apiRequest('/config'),
  saveConfig: (newConfig: any) => apiRequest('/config', { method: 'POST', body: JSON.stringify(newConfig) }),
  getHariLibur: () => apiRequest('/hari-libur'),
  addHariLibur: (tanggal: string, keterangan: string) =>
    apiRequest('/hari-libur', { method: 'POST', body: JSON.stringify({ tanggal, keterangan }) }),
  addHariLiburRange: (tanggalMulai: string, tanggalAkhir: string, keterangan: string) =>
    apiRequest('/hari-libur/range', { method: 'POST', body: JSON.stringify({ tanggalMulai, tanggalAkhir, keterangan }) }),
  updateHariLibur: (oldDate: string, newDate: string, newKeterangan: string) =>
    apiRequest('/hari-libur', { method: 'PUT', body: JSON.stringify({ oldDate, newDate, newKeterangan }) }),
  deleteHariLibur: (tanggal: string) => apiRequest(`/hari-libur/${encodeURIComponent(tanggal)}`, { method: 'DELETE' }),
  bulkImportHariLibur: (data: any[]) => apiRequest('/hari-libur/bulk-import', { method: 'POST', body: JSON.stringify(data) }),

  // Absensi Realtime & Scan
  getAbsensiToday: (nisn: string) => apiRequest(`/absensi/today/${encodeURIComponent(nisn)}`),
  getMonitoring: (filterKelas?: string) =>
    apiRequest(`/absensi/monitoring${filterKelas ? `?filterKelas=${encodeURIComponent(filterKelas)}` : ''}`),
  updateAbsensiStatus: (nisn: string, nama: string, kelas: string, status: string, tanggal?: string) =>
    apiRequest('/absensi/status', { method: 'POST', body: JSON.stringify({ nisn, nama, kelas, status, tanggal }) }),
  scanAbsensi: (nisn: string, scannerRole: string, scannerKelas: string, scanMode: string, clientTime?: string, clientDate?: string) =>
    apiRequest('/absensi/scan', { method: 'POST', body: JSON.stringify({ nisn, scannerRole, scannerKelas, scanMode, clientTime, clientDate }) }),
  batchScanAbsensi: (nisnList: string[], scannerRole: string, scannerKelas: string) =>
    apiRequest('/absensi/batch-scan', { method: 'POST', body: JSON.stringify({ nisnList, scannerRole, scannerKelas }) }),
  getDaftarHadir: (kelas: string, tanggal: string) =>
    apiRequest(`/absensi/daftar-hadir?kelas=${encodeURIComponent(kelas)}&tanggal=${encodeURIComponent(tanggal)}`),
  getDaftarHadirDetail: (kelas: string, tanggal: string) =>
    apiRequest(`/absensi/daftar-hadir-detail?kelas=${encodeURIComponent(kelas)}&tanggal=${encodeURIComponent(tanggal)}`),
  submitPulangSatu: (nisn: string, tanggal: string) =>
    apiRequest('/absensi/pulang-satu', { method: 'POST', body: JSON.stringify({ nisn, tanggal }) }),
  submitPulangSemuaHadir: (kelas: string, tanggal: string, namaPengirim?: string) =>
    apiRequest('/absensi/pulang-semua-hadir', { method: 'POST', body: JSON.stringify({ kelas, tanggal, namaPengirim }) }),
  submitPulangMassal: (pulangList: any[], tanggal: string, namaPengirim: string) =>
    apiRequest('/absensi/pulang-massal', { method: 'POST', body: JSON.stringify({ pulangList, tanggal, namaPengirim }) }),
  submitDaftarHadir: (dataList: any[], tanggal: string, namaPengirim: string) =>
    apiRequest('/absensi/submit-daftar-hadir', { method: 'POST', body: JSON.stringify({ dataList, tanggal, namaPengirim }) }),

  // Rekap & Laporan
  getRekapAbsensi: (filters: { tanggalMulai?: string; tanggalAkhir?: string; kelas?: string }) => {
    const q = new URLSearchParams(filters as any).toString();
    return apiRequest(`/absensi/rekap?${q}`);
  },
  getMonthlyReport: (bulan: number, tahun: number, kelas?: string) =>
    apiRequest(`/absensi/rekap-bulanan?bulan=${bulan}&tahun=${tahun}&kelas=${encodeURIComponent(kelas || '')}`),

  // Export
  exportExcel: async (type: string, filters: any) => {
    const token = getAuthToken();
    const res = await fetch('/api/absensi/export-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ type, filters }),
    });
    if (!res.ok) throw new Error('Export Excel failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presensi_${type}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  },

  // Sholat
  getSholat: (kelas: string, tanggal: string, waktuSholat: string) =>
    apiRequest(`/sholat?kelas=${encodeURIComponent(kelas)}&tanggal=${encodeURIComponent(tanggal)}&waktuSholat=${encodeURIComponent(waktuSholat)}`),
  submitSholat: (dataList: any[], tanggal: string, waktuSholat: string, inputOleh: string) =>
    apiRequest('/sholat', { method: 'POST', body: JSON.stringify({ dataList, tanggal, waktuSholat, inputOleh }) }),
  getRekapSholat: (kelas?: string, bulan?: string, waktuSholat?: string) => {
    const p = new URLSearchParams();
    if (kelas) p.append('kelas', kelas);
    if (bulan) p.append('bulan', bulan);
    if (waktuSholat) p.append('waktuSholat', waktuSholat);
    return apiRequest(`/sholat/rekap?${p.toString()}`);
  },

  // WhatsApp
  getWhatsAppStatus: (kelas: string, tanggal: string) =>
    apiRequest(`/whatsapp/status?kelas=${encodeURIComponent(kelas)}&tanggal=${encodeURIComponent(tanggal)}`),
  catatWhatsApp: (nisn: string, tanggal: string) =>
    apiRequest('/whatsapp/kirim', { method: 'POST', body: JSON.stringify({ nisn, tanggal }) }),

  // Promotion & Reset
  processPromotion: (kelasAsal: string, kelasTujuan: string, promoData: any[]) =>
    apiRequest('/promosi/proses', { method: 'POST', body: JSON.stringify({ kelasAsal, kelasTujuan, promoData }) }),
  archiveAndResetYear: (namaArsip: string) =>
    apiRequest('/arsip/reset', { method: 'POST', body: JSON.stringify({ namaArsip }) }),

  // Pengajuan Izin & Sakit
  getPengajuanIzin: (filter?: { nisn?: string; status?: string; kelas?: string }) => {
    const p = new URLSearchParams();
    if (filter?.nisn) p.append('nisn', filter.nisn);
    if (filter?.status) p.append('status', filter.status);
    if (filter?.kelas) p.append('kelas', filter.kelas);
    return apiRequest(`/pengajuan-izin?${p.toString()}`);
  },
  createPengajuanIzin: (data: {
    nisn: string;
    nama: string;
    kelas?: string;
    jenis: 'Izin' | 'Sakit';
    tanggalMulai: string;
    tanggalSelesai: string;
    keterangan: string;
    dokumenUrl?: string;
  }) => apiRequest('/pengajuan-izin', { method: 'POST', body: JSON.stringify(data) }),
  reviewPengajuanIzin: (id: number, status: 'Disetujui' | 'Ditolak', catatanAdmin?: string) =>
    apiRequest(`/pengajuan-izin/${id}/review`, { method: 'POST', body: JSON.stringify({ status, catatanAdmin }) }),

  // Siswa Bulanan Attendance
  getSiswaBulanan: (nisn: string, bulan?: string) =>
    apiRequest(`/absensi/siswa-bulanan/${encodeURIComponent(nisn)}${bulan ? `?bulan=${encodeURIComponent(bulan)}` : ''}`),
};
