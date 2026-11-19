# PANDUAN LENGKAP KONEKSI DATABASE KE SUPABASE & DEPLOY ONLINE

Panduan ini menjelaskan cara menghubungkan **Sistem Absensi Sekolah Pintar** ke database **Supabase (PostgreSQL Cloud Managed)** gratis, cara mengeksekusi skema database, serta langkah mempublikasikan aplikasi agar online dan dapat diakses dari mana saja.

---

## DAFTAR ISI
1. [Mengapa Supabase?](#1-mengapa-supabase)
2. [Langkah 1: Membuat Akun & Project Baru di Supabase](#langkah-1-membuat-akun--project-baru-di-supabase)
3. [Langkah 2: Menjalankan Skema Database di Supabase SQL Editor](#langkah-2-menjalankan-skema-database-di-supabase-sql-editor)
4. [Langkah 3: Mengambil Kredensial & Connection String Supabase](#langkah-3-mengambil-kredensial--connection-string-supabase)
5. [Langkah 4: Menghubungkan Aplikasi ke Supabase (File .env)](#langkah-4-menghubungkan-aplikasi-ke-supabase-file-env)
6. [Langkah 5: Mempublikasikan Aplikasi Secara Online](#langkah-5-mempublikasikan-aplikasi-secara-online)
   - [Opsi A: Deploy ke Vercel / Railway / Render (Paling Mudah)](#opsi-a-deploy-ke-railway--render--vercel)
   - [Opsi B: Deploy ke VPS Ubuntu (Nginx + PM2 + SSL)](#opsi-b-deploy-ke-vps-ubuntu)
   - [Opsi C: Deploy ke Google Cloud Run](#opsi-c-deploy-ke-google-cloud-run)
7. [Penting: Syarat HTTPS/SSL untuk Kamera Scanner QR di HP & Laptop](#penting-syarat-httpsssl-untuk-kamera-scanner-qr)
8. [Uji Koneksi & Verifikasi](#uji-koneksi--verifikasi)
9. [Tanya Jawab & Pemecahan Masalah (FAQ)](#tanya-jawab--pemecahan-masalah-faq)

---

## 1. Mengapa Supabase?
Supabase adalah platform database PostgreSQL cloud terkelola (Managed Database) yang memiliki keunggulan:
- **Gratis (Free Tier)**: Mendukung kapasitas hingga 500 MB database dan 50.000 pengguna aktif per bulan (sangat cukup untuk ribuan data siswa sekolah).
- **Performa Tinggi**: PostgreSQL versi terbaru (v15/16) di cloud dengan latensi rendah (tersedia region Singapura `ap-southeast-1` yang sangat dekat dengan Indonesia).
- **Tanpa Maintenance Server DB**: Anda tidak perlu memikirkan patching OS, instalasi database server, ataupun konfigurasi port lokal.
- **Backup Cloud Otomatis**: Dilengkapi auto-backup dan dashboard visual untuk melihat data tabel siswa dan presensi secara langsung.

---

## 2. Langkah 1: Membuat Akun & Project Baru di Supabase

1. Kunjungi website resmi Supabase: **[https://supabase.com](https://supabase.com)**
2. Klik tombol **"Start your project"** atau **"Sign In"** (bisa login menggunakan akun GitHub atau Email).
3. Di halaman Dashboard Supabase, klik **"New Project"**.
4. Isi formulir pembuatan project:
   - **Name**: `absensi-sekolah` (atau nama sekolah Anda, misal: `smpn4-jambi-absensi`)
   - **Database Password**: Masukkan password yang kuat dan **CATAT PASSWORD INI** (misal: `SekolahHebat2026!`). Password ini akan digunakan pada file `.env`.
   - **Region**: Pilih **`Singapore (ap-southeast-1)`** agar koneksi dari Indonesia sangat cepat dan responsif.
   - **Pricing Plan**: Pilih **Free Plan** ($0 / bulan).
5. Klik **"Create new project"**.
6. Tunggu sekitar 1 - 2 menit hingga Supabase selesai menyiapkan database Anda.

---

## 3. Langkah 2: Menjalankan Skema Database di Supabase SQL Editor

Aplikasi ini sudah dilengkapi dengan file skema SQL resmi bernama **`supabase_schema.sql`** di root folder project.

1. Di Dashboard Supabase project Anda, klik menu **"SQL Editor"** (ikon terminal `>_` di bilah sisi kiri).
2. Klik tombol **"New Query"**.
3. Buka file **`supabase_schema.sql`** yang ada di folder project aplikasi ini, lalu **salin (copy) semua isinya**.
4. Tempelkan (paste) ke editor SQL di Supabase.
5. Klik tombol hijau **"Run"** (atau tekan `Ctrl + Enter`).
6. Supabase akan menampilkan pesan **"Success. No rows returned"**.
7. Sekarang semua tabel berikut sudah siap di Supabase:
   - `users` (Akun admin, guru, wakel, siswa)
   - `siswa` (Data master siswa, NISN, kelas, nomor HP ortu untuk WhatsApp)
   - `kelas` (Daftar kelas sekolah)
   - `absensi` (Catatan presensi datang & pulang realtime)
   - `absensi_sholat` (Presensi sholat berjamaah harian)
   - `hari_libur` (Daftar tanggal merah & libur sekolah)
   - `konfigurasi` (Jam operasional, jam batas terlambat & pulang)
   - `log_notifikasi_wa` (Riwayat pesan WhatsApp Alpa terkirim)
   - `sessions` (Token login sesi)
8. Klik menu **"Table Editor"** di Supabase untuk melihat tabel dan data default yang langsung terisi otomatis!

---

## 4. Langkah 3: Mengambil Kredensial & Connection String Supabase

1. Di Dashboard Supabase, buka menu **Project Settings** (ikon gerigi di kiri bawah) -> Pilih submenu **"Database"**.
2. Gulir ke bawah ke bagian **"Connection string"**.
3. Pilih tab **"URI"**:
   - Jika tersedia pilihan Mode, pilih **"Transaction"** (Port 6543) atau **"Session"** (Port 5432).
   - Format URL akan terlihat seperti ini:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
     ```
     atau Direct Connection:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
4. Ganti `[YOUR-PASSWORD]` dengan password database yang Anda buat pada Langkah 1.
5. Salin URL tersebut.

Jika Anda ingin menggunakan parameter terpisah, Anda juga dapat mencatat:
- **Host**: `db.[PROJECT-REF].supabase.co` (atau `aws-0-ap-southeast-1.pooler.supabase.com`)
- **Port**: `5432` atau `6543`
- **Database**: `postgres`
- **User**: `postgres` (atau `postgres.[PROJECT-REF]`)
- **Password**: `[Password-Anda]`

---

## 5. Langkah 4: Menghubungkan Aplikasi ke Supabase (File .env)

Di server atau komputer tempat aplikasi dijalankan, buat/edit file **`.env`** di root folder project.

### Cara A: Menggunakan Connection URI (Paling Praktis)
```env
PORT=3000
NODE_ENV=production

# Masukkan Connection String Supabase Anda langsung:
DATABASE_URL="postgresql://postgres.xxx:PasswordAnda123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Domain aplikasi Anda
APP_URL="https://absensi.sekolah.sch.id"
```

### Cara B: Menggunakan Parameter Terpisah
```env
PORT=3000
NODE_ENV=production

# Parameter Supabase PostgreSQL
SQL_HOST="db.xxxxxxxxxxxxxxxxxxxx.supabase.co"
SQL_PORT=5432
SQL_USER="postgres"
SQL_PASSWORD="PasswordAnda123!"
SQL_DB_NAME="postgres"
SQL_SSL=true

# Domain aplikasi Anda
APP_URL="https://absensi.sekolah.sch.id"
```

> **Catatan Penting Keamanan SSL**:
> Backend aplikasi ini sudah diprogram untuk **otomatis mengaktifkan enkripsi SSL (`ssl: { rejectUnauthorized: false }`)** ketika mendeteksi domain `supabase.co` atau `supabase.com` ataupun ketika `SQL_SSL=true`, sehingga Anda tidak akan mengalami error sertifikat SSL saat menyambung ke Supabase.

---

## 6. Langkah 5: Mempublikasikan Aplikasi Secara Online

Setelah database Supabase siap, pilih salah satu platform hosting berikut untuk mempublikasikan aplikasi:

### Opsi A: Deploy ke Railway / Render / Vercel (Paling Mudah & Otomatis)

#### 1. Melalui Railway (Rekomendasi Cepat):
1. Buka **[https://railway.app](https://railway.app)** dan login dengan akun GitHub Anda.
2. Push repositori project aplikasi ini ke GitHub Anda.
3. Di Railway, klik **"New Project"** -> **"Deploy from GitHub repo"** -> Pilih repositori Anda.
4. Klik service yang baru dibuat -> Buka tab **"Variables"**.
5. Tambahkan variabel lingkungan:
   - `DATABASE_URL`: Isi dengan connection string Supabase Anda.
   - `NODE_ENV`: `production`
6. Buka tab **"Settings"** -> Di bagian **"Networking"**, klik **"Generate Domain"** (atau hubungkan custom domain sekolah Anda).
7. Railway akan otomatis build dan memberi URL HTTPS resmi gratis (misal: `https://absensi-production-xxxx.up.railway.app`).

#### 2. Melalui Render.com:
1. Buka **[https://render.com](https://render.com)** -> Klik **"New"** -> **"Web Service"**.
2. Hubungkan ke repositori GitHub Anda.
3. Konfigurasi:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx tsx server.ts`
4. Tambahkan Environment Variable `DATABASE_URL` (dari Supabase).
5. Klik **"Create Web Service"**.

---

### Opsi B: Deploy ke VPS Ubuntu (Server Mandiri dengan Domain Sekolah)

Jika sekolah memiliki VPS Ubuntu (contoh: IDCloudHost, Niagahoster, Biznet, DigitalOcean):

```bash
# 1. Update VPS & install Node.js 20, Nginx, PM2, Certbot
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 2. Masuk ke folder aplikasi
cd /var/www/absensi-sekolah
npm install
npm run build

# 3. Atur file .env dengan DATABASE_URL dari Supabase
nano .env
# (Ketik DATABASE_URL="postgresql://..." simpan dengan Ctrl+O lalu Ctrl+X)

# 4. Jalankan aplikasi 24/7 menggunakan PM2
pm2 start server.ts --name "absensi-sekolah" --interpreter="tsx"
pm2 save
pm2 startup

# 5. Konfigurasi Nginx Reverse Proxy
sudo nano /etc/nginx/sites-available/absensi
```

Isi Nginx Reverse Proxy:
```nginx
server {
    listen 80;
    server_name absensi.sekolah.sch.id;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan Nginx & pasang SSL HTTPS:
```bash
sudo ln -s /etc/nginx/sites-available/absensi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Aktifkan sertifikat SSL gratis Let's Encrypt:
sudo certbot --nginx -d absensi.sekolah.sch.id
```

---

### Opsi C: Deploy ke Google Cloud Run

Jika menggunakan Google Cloud Platform (GCP):

```bash
# Build container image
gcloud builds submit --tag gcr.io/PROJECT_ID_ANDA/absensi-sekolah

# Deploy ke Cloud Run dengan DATABASE_URL Supabase
gcloud run deploy absensi-sekolah \
  --image gcr.io/PROJECT_ID_ANDA/absensi-sekolah \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://postgres.xxx:Password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

---

## 7. Penting: Syarat HTTPS/SSL untuk Kamera Scanner QR

- Browser seperti Google Chrome di smartphone Android dan Safari di iPhone **hanya akan mengizinkan akses kamera (`navigator.mediaDevices.getUserMedia`) jika web diakses melalui protokol HTTPS**.
- Jika website diakses melalui `http://` biasa, tombol **"Buka Kamera Live"** akan menampilkan peringatan keamanan dan ditolak oleh browser.
- Dengan mengikuti langkah di atas (Let's Encrypt di VPS, atau domain bawaan Railway / Render / Cloud Run), website Anda sudah otomatis terproteksi **HTTPS (SSL)** sehingga kamera pemindai QR Code kartu pelajar siswa dapat langsung aktif tanpa hambatan.

---

## 8. Uji Koneksi & Verifikasi

1. **Uji via Endpoint Status Database**:
   Buka URL:
   ```text
   https://domain-anda.com/api/database/status
   ```
   Aplikasi akan mengembalikan JSON status:
   ```json
   {
     "success": true,
     "connected": true,
     "provider": "Supabase PostgreSQL Cloud",
     "host": "Supabase Connection URI",
     "database": "postgres (Supabase)",
     "ssl": true
   }
   ```
2. **Uji di Dashboard Aplikasi**:
   - Buka menu **"Panduan Server"** di navbar atas atau sidebar aplikasi.
   - Status koneksi database akan menampilkan badge hijau **"Terhubung ke Supabase PostgreSQL Cloud"**.
3. **Cek Data Realtime di Supabase**:
   - Lakukan scan QR atau tambah siswa baru di web.
   - Buka menu **Table Editor** di Dashboard Supabase (`https://supabase.com/dashboard`).
   - Buka tabel `absensi` atau `siswa`. Data yang Anda scan akan langsung muncul di Supabase dalam hitungan detik!

---

## 9. Tanya Jawab & Pemecahan Masalah (FAQ)

### T: Apakah siswa dan guru perlu akun Supabase?
**J:** Tidak. Pengguna (guru, siswa, satpam) hanya mengakses website aplikasi Anda. Supabase hanya bekerja di balik layar sebagai tempat penyimpanan data (database engine).

### T: Bagaimana jika saya lupa password database Supabase?
**J:** Anda dapat mengganti (reset) password database kapan saja di Dashboard Supabase:
*Buka Project Settings -> Database -> Database Password -> "Reset database password"*. Jangan lupa perbarui password baru tersebut di file `.env` aplikasi Anda.

### T: Apakah scanner barcode USB (seperti MC26) tetap berfungsi saat online?
**J:** Ya, 100% berfungsi! Scanner barcode USB MC26 bekerja sebagai keyboard emulasi (HID). Ketika dicolokkan ke laptop/PC di gerbang sekolah dan kartu siswa ditembak, angka NISN akan otomatis terkirim ke server Supabase secara instan.
