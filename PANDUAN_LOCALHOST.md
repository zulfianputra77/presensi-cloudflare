# Panduan Menjalankan Aplikasi Secara Utuh di Localhost (Komputer / Server Sekolah)

Aplikasi **Sistem Absensi Sekolah QR & Barcode** bisa dijalankan **100% utuh secara mandiri di komputer atau server lokal (`localhost`) dengan port tersendiri** — lengkap dengan Frontend, Backend API, Export Excel/PDF, Scanner QR/Barcode MC26, hingga penyimpanan database permanen.

---

## 1. File Komponen Localhost yang Tersedia

Seluruh komponen sudah lengkap di project ini:
- **`localhost-server.ts`** — Server utama localhost dengan port tersendiri (default `4500`, bebas diubah via `.env` atau argumen `--port=`).
- **`localhost-daemon.mjs`** — Manajer proses latar belakang (background daemon) untuk menjalankan server secara tersembunyi tanpa jendela CMD terbuka (`start`, `stop`, `status`).
- **`src/server/local-file-store.ts`** — Mesin database lokal persisten (`./data/absensi-local-db.json`) agar data **tidak hilang saat komputer dimatikan** (berjalan 100% offline tanpa perlu install database tambahan).
- **`src/server/routes.ts`** & **`src/middleware/auth.ts`** — Seluruh endpoint API lengkap.
- **`src/App.tsx`** & **`src/components/*`** — Seluruh antarmuka web React + Tailwind.
- **`start-localhost.bat`** — Launcher 1-klik **Windows Background** (otomatis menutup jendela CMD setelah server aktif, server tetap jalan di latar belakang).
- **`stop-localhost.bat`** — Menghentikan server background Windows dengan aman.
- **`status-localhost.bat`** — Mengecek apakah server sedang aktif, port aktif, PID, serta lokasi log.
- **`start-localhost-console.bat`** — Launcher Windows mode console (jendela CMD tetap terbuka untuk melihat log langsung bila dibutuhkan).
- **`start-localhost.sh`** — Launcher untuk **Linux / Ubuntu Server / macOS**.
- **`.env.localhost.example`** — Contoh pengaturan port & pilihan database (Offline File DB / PostgreSQL Lokal / Turso).

---

## 2. Pilihan Mode Database di Komputer / Server

Saat menjalankan `localhost-server.ts`, sistem otomatis memilih database dengan urutan berikut:
1. **PostgreSQL Lokal** *(jika `DATABASE_URL` atau `SQL_HOST` diisi di `.env`)* — cocok jika di server sekolah sudah terpasang PostgreSQL / pgAdmin.
2. **Turso Cloud** *(jika `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN` diisi di `.env`)*.
3. **Database File Lokal Offline (`./data/absensi-local-db.json`)** *(otomatis aktif jika poin 1 & 2 kosong)* — tidak perlu instalasi database apa pun, data langsung tersimpan permanen ke hardisk komputer.

---

## 3. Cara Instalasi & Menjalankan di Komputer Windows (Background Tanpa CMD Terbuka)

1. Install **Node.js LTS (v20 atau v22)** dari `https://nodejs.org`.
2. Download / clone seluruh folder project ini ke komputer (misal `C:\Absensi-Sekolah`).
3. *(Opsional — untuk mengatur port sendiri)*:
   Salin file `.env.localhost.example` menjadi `.env`, lalu ubah baris:
   ```env
   LOCALHOST_PORT=4040
   ```
   *(Anda bebas mengganti `4040` menjadi `4500`, `5000`, `8080`, dll agar tidak bentrok dengan aplikasi lain).*
4. **Klik ganda (double-click) file `start-localhost.bat`**:
   - Pertama kali jalan, script otomatis menginstall dependensi (`npm install`) dan melakukan build (`npm run build`).
   - Setelah server dipastikan aktif dan sehat, jendela CMD akan **otomatis tertutup sendiri** sementara aplikasi **tetap berjalan di latar belakang (background)**.
   - Jika suatu saat ingin menentukan port lewat CMD:
     ```cmd
     start-localhost.bat 8080
     ```
5. Buka browser Chrome/Edge dan akses:
   ```text
   http://localhost:4040
   ```
   *(sesuaikan dengan port di `.env` atau default `4500`)*.
6. **Kontrol Server Background di Windows**:
   - **Cek status & alamat akses**: Klik ganda `status-localhost.bat`.
   - **Hentikan server**: Klik ganda `stop-localhost.bat`.
   - **Lihat log proses**: Buka file `data\localhost-server.log` atau jalankan `start-localhost-console.bat`.

---

## 4. Cara Menjalankan di Linux / Server Sekolah (Ubuntu / Debian)

1. Install Node.js 22:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
2. Masuk ke folder project, salin `.env.localhost.example` menjadi `.env` (atur `LOCALHOST_PORT` sesuai keinginan):
   ```bash
   cp .env.localhost.example .env
   chmod +x start-localhost.sh
   ./start-localhost.sh 4500
   ```
3. **Agar tetap berjalan otomatis 24 jam di background (PM2)**:
   ```bash
   sudo npm install -g pm2
   npm install
   npm run build
   pm2 start localhost-server.ts --name "absensi-localhost" --interpreter="npx" --interpreter-args="tsx" -- --port=4500
   pm2 save
   pm2 startup
   ```

---

## 5. Akses dari Komputer / HP Lain di WiFi Sekolah (LAN)

Saat `localhost-server.ts` menyala, terminal akan menampilkan alamat IP jaringan lokal Anda, contohnya:
```text
  Port Aktif     : 4500
  Akses Lokal    : http://localhost:4500
  Akses WiFi/LAN : http://192.168.1.25:4500
```
Perangkat lain (laptop piket, PC TU, HP guru) yang terhubung ke WiFi sekolah yang sama dapat langsung membuka `http://192.168.1.25:4500`.

> **Catatan Kamera vs USB Scanner di Jaringan LAN**:
> - **Di komputer server (`http://localhost:4500`)**: Kamera Live QR & USB Barcode Scanner MC26 langsung aktif tanpa HTTPS.
> - **Di laptop/HP lain lewat IP LAN (`http://192.168.x.x:4500`)**: USB Barcode Scanner MC26, login, input absen manual, cetak kartu, dan rekap langsung berfungsi penuh. Untuk membuka **Kamera Live** di browser perangkat lain lewat IP LAN HTTP, gunakan browser di `localhost` atau pasang SSL lokal (Nginx/Caddy reverse proxy).

---

## 6. Backup Data Offline

Jika memakai mode Database Lokal Offline, seluruh data siswa, guru, absensi, sholat, jadwal, dan izin tersimpan di satu file:
```text
data/absensi-local-db.json
```
Untuk backup harian/bulanan, cukup salin (copy) file tersebut ke flashdisk atau Google Drive.

---

## 7. Memaketkan Menjadi Software Installer (`Setup.exe` seperti Dapodik / e-Rapor)

Jika ingin mengemas seluruh aplikasi ini menjadi software installer Windows yang tinggal di-klik **Next > Install > Finish** (lengkap dengan ikon Desktop, auto-start Windows, dan runtime Node.js tertanam sehingga komputer target tidak perlu install Node.js), ikuti panduan lengkap di file:
- **`PANDUAN_INSTALLER_SOFTWARE.md`**
- Atau jalankan langsung **`build-installer.bat`** di Windows.

