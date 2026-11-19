import { pgTable, serial, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Optional Firebase Auth UID or generated UUID
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull(), // 'admin', 'guru', 'wakel', 'siswa'
  nama: text('nama'),
  kelas: text('kelas').default(''), // comma separated or single class
  createdAt: timestamp('created_at').defaultNow(),
});

export const siswa = pgTable('siswa', {
  id: serial('id').primaryKey(),
  nisn: text('nisn').notNull().unique(),
  nama: text('nama').notNull(),
  jenisKelamin: text('jenis_kelamin'),
  tanggalLahir: text('tanggal_lahir'), // YYYY-MM-DD
  agama: text('agama'),
  namaAyah: text('nama_ayah'),
  namaIbu: text('nama_ibu'),
  noHp: text('no_hp'),
  kelas: text('kelas').notNull(),
  alamat: text('alamat'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('siswa_kelas_idx').on(table.kelas),
  index('siswa_nisn_idx').on(table.nisn),
]);

export const kelas = pgTable('kelas', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull().unique(),
  urutan: integer('urutan').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const absensi = pgTable('absensi', {
  id: serial('id').primaryKey(),
  tanggal: text('tanggal').notNull(), // YYYY-MM-DD
  nisn: text('nisn').notNull(),
  nama: text('nama').notNull(),
  kelas: text('kelas').notNull(),
  jamDatang: text('jam_datang').default(''),
  jamPulang: text('jam_pulang').default(''),
  keterangan: text('keterangan').default(''),
  status: text('status').notNull(), // 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Belum Absen'
  jamSholat: text('jam_sholat').default(''),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('absensi_tgl_nisn_idx').on(table.tanggal, table.nisn),
  index('absensi_tgl_kelas_idx').on(table.tanggal, table.kelas),
  index('absensi_tanggal_idx').on(table.tanggal),
]);

export const absensiSholat = pgTable('absensi_sholat', {
  id: serial('id').primaryKey(),
  tanggal: text('tanggal').notNull(), // YYYY-MM-DD
  nisn: text('nisn').notNull(),
  nama: text('nama').notNull(),
  kelas: text('kelas').notNull(),
  waktuSholat: text('waktu_sholat').notNull(), // 'Subuh', 'Dhuha', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'
  status: text('status').notNull(), // 'Hadir', 'Tidak Hadir', 'Izin / Uzur'
  keterangan: text('keterangan').default(''),
  inputOleh: text('input_oleh').default(''),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('sholat_tgl_waktu_kelas_idx').on(table.tanggal, table.waktuSholat, table.kelas),
  index('sholat_tgl_nisn_idx').on(table.tanggal, table.nisn),
]);

export const hariLibur = pgTable('hari_libur', {
  id: serial('id').primaryKey(),
  tanggal: text('tanggal').notNull().unique(), // YYYY-MM-DD
  keterangan: text('keterangan').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const konfigurasi = pgTable('konfigurasi', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  keterangan: text('keterangan'),
});

export const logNotifikasiWa = pgTable('log_notifikasi_wa', {
  id: serial('id').primaryKey(),
  waktuDikirim: text('waktu_dikirim').notNull(),
  tanggalAbsensi: text('tanggal_absensi').notNull(),
  nisn: text('nisn').notNull(),
  nama: text('nama').notNull(),
  kelas: text('kelas').notNull(),
  status: text('status').notNull().default('Sudah Dikirim'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('wa_log_tgl_nisn_idx').on(table.tanggalAbsensi, table.nisn),
]);

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  identifier: text('identifier').notNull(),
  role: text('role').notNull(),
  nama: text('nama'),
  kelas: text('kelas'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('sessions_token_idx').on(table.token),
]);

export const pengajuanIzin = pgTable('pengajuan_izin', {
  id: serial('id').primaryKey(),
  nisn: text('nisn').notNull(),
  nama: text('nama').notNull(),
  kelas: text('kelas').notNull(),
  jenis: text('jenis').notNull(),
  tanggalMulai: text('tanggal_mulai').notNull(),
  tanggalSelesai: text('tanggal_selesai').notNull(),
  keterangan: text('keterangan').notNull(),
  dokumenUrl: text('dokumen_url').default(''),
  status: text('status').notNull().default('Menunggu Persetujuan'),
  catatanAdmin: text('catatan_admin').default(''),
  reviewedAt: text('reviewed_at').default(''),
  reviewedBy: text('reviewed_by').default(''),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('pengajuan_nisn_idx').on(table.nisn),
  index('pengajuan_status_idx').on(table.status),
]);

