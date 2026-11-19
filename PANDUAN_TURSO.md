# Panduan Lengkap Setup Database Turso + Cloudflare Workers

Aplikasi ini mendukung **Turso (libSQL / SQLite Cloud — 9 GB Gratis)** melalui adapter HTTP pipeline (`functions/_lib/turso.ts`) tanpa mengubah kode lama Vercel/Node.js maupun Supabase.

---

## 1. File Tambahan untuk Turso

- `functions/_lib/turso.ts` — Adapter Turso Hrana HTTP API (`/v2/pipeline`) + pembuat tabel otomatis (`ensureSchema`).
- `functions/api/[[path]].ts` — Otomatis memakai Turso jika `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN` diisi di Cloudflare.
- `turso_schema.sql` — Skema 10 tabel lengkap + data awal (Admin, Guru, Wakel, Kelas, Siswa demo, Konfigurasi) siap pakai untuk Turso.

---

## 2. Langkah Membuat Database di Web Turso

1. Buka **https://turso.tech** lalu daftar / login (bisa memakai akun GitHub).
2. Di dashboard Turso (`https://app.turso.tech`), klik **Create Database** (atau pilih Group lalu **Create Database**).
3. Isi pengaturan database:
   - **Database Name**: misal `absensi-smp004`
   - **Location / Region**: pilih yang paling dekat dengan Indonesia, yaitu **Singapore (`sin`)**.
4. Klik **Create**.

---

## 3. Mengambil `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`

1. Klik nama database `absensi-smp004` yang baru dibuat di dashboard Turso.
2. Salin **Database URL** (formatnya: `libsql://absensi-smp004-namaakun.turso.io`).
3. Klik tombol **Create Token** (atau **Generate Token**):
   - **Expiration**: pilih **Never** (atau **No expiration**).
   - **Permissions**: pilih **Full Access** (*Read & Write*).
4. Salin **Auth Token** yang muncul (hanya ditampilkan sekali — simpan baik-baik).

---

## 4. Menjalankan `turso_schema.sql` di Web Turso

> Adapter `functions/_lib/turso.ts` sudah dilengkapi pembuat tabel otomatis saat request pertama. Namun, sangat disarankan menjalankan `turso_schema.sql` langsung di Web Turso agar seluruh tabel langsung terlihat di dashboard Turso.

1. Di halaman database Turso Anda, buka menu **Data** atau **Console / Shell** (ikon `>_` atau **Execute SQL**).
2. Buka file `turso_schema.sql` dari repository ini, salin seluruh isinya, lalu tempel dan jalankan (**Run / Execute**).
3. Cek tab **Tables** — pastikan ke-10 tabel (`users`, `kelas`, `siswa`, `absensi`, `absensi_sholat`, `hari_libur`, `konfigurasi`, `log_notifikasi_wa`, `sessions`, `pengajuan_izin`) sudah muncul.

---

## 5. Menghubungkan Turso ke Cloudflare Workers (`app-presensi-smp004`)

1. Push seluruh file terbaru (`functions/_lib/turso.ts`, `functions/_lib/supabase.ts`, `functions/api/[[path]].ts`, `turso_schema.sql`) ke GitHub Anda.
2. Buka **Cloudflare Dashboard → Workers & Pages → `app-presensi-smp004` → Settings → Variables and Secrets**.
3. Jika sebelumnya masih ada `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`, Anda boleh menghapusnya (atau biarkan saja, karena sistem otomatis memprioritaskan Turso jika variabel Turso ada).
4. Tambahkan 2 variabel baru:
   - **Variable name**: `TURSO_DATABASE_URL`
     **Value**: `libsql://absensi-smp004-namaakun.turso.io`
   - **Variable name**: `TURSO_AUTH_TOKEN` *(centang **Secret**)*
     **Value**: *(paste token Turso yang Anda buat pada Langkah 3)*
5. Klik **Save / Deploy**.

---

## 6. Verifikasi Koneksi

1. Buka URL Worker Anda + `/api/database/status`:
   `https://app-presensi-smp004.<subdomain-anda>.workers.dev/api/database/status`
2. Pastikan muncul JSON:
   ```json
   {
     "success": true,
     "connected": true,
     "provider": "Turso libSQL Cloud (Cloudflare Workers)",
     "database": "libSQL (Turso Edge)"
   }
   ```
3. Login ke aplikasi menggunakan akun default (`admin` / `admin123` atau NISN `1234567890`) dan uji absensi / tambah siswa.
