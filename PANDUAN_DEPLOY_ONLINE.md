# PANDUAN LENGKAP DEPLOY & MENG-ONLINEKAN SISTEM ABSENSI SEKOLAH (POSTGRESQL)

Dokumentasi ini dibuat untuk memandu Admin IT Sekolah, Guru, atau Tim Pengembang dalam mempublikasikan aplikasi **Sistem Absensi Sekolah Pintar** ke internet agar dapat diakses secara online dari mana saja oleh guru, siswa, wali murid, dan petugas gerbang sekolah.

---

## DAFTAR ISI
1. [Arsitektur Sistem & Persyaratan](#1-arsitektur-sistem--persyaratan)
2. [Penting: Syarat Kamera Web & Scanner (Wajib HTTPS / SSL)](#2-penting-syarat-kamera-web--scanner-wajib-https--ssl)
3. [Pilihan A: Deploy ke VPS Ubuntu (Nginx + PM2 + Let's Encrypt) - Rekomendasi Mandiri](#3-pilihan-a-deploy-ke-vps-ubuntu-nginx--pm2--lets-encrypt)
4. [Pilihan B: Deploy ke Google Cloud Run + Cloud SQL (Rekomendasi Google Cloud)](#4-pilihan-b-deploy-ke-google-cloud-run--cloud-sql)
5. [Pilihan C: Deploy Cepat ke PaaS (Railway / Render + Supabase / Neon)](#5-pilihan-c-deploy-cepat-ke-paas-railway--render)
6. [File-File Konfigurasi Server (Siap Pakai)](#6-file-file-konfigurasi-server-siap-pakai)
   - [.env.production](#a-file-envproduction)
   - [Nginx Reverse Proxy Config](#b-file-konfigurasi-nginx-reverse-proxy)
   - [PM2 ecosystem.config.cjs](#c-file-pm2-ecosystemconfigcjs)
   - [Dockerfile & docker-compose.yml](#d-file-dockerfile--docker-composeyml)
7. [Panduan Integrasi Scanner Barcode USB (MC26) & Smartphone](#7-panduan-integrasi-scanner-barcode-usb-mc26--smartphone)
8. [Perawatan, Backup Database Otomatis & Pemecahan Masalah (Troubleshooting)](#8-perawatan-backup-database-otomatis--troubleshooting)

---

## 1. Arsitektur Sistem & Persyaratan

Aplikasi ini dibangun menggunakan arsitektur modern yang ringan dan cepat:
- **Frontend**: React 19 SPA, Tailwind CSS v4, Lucide Icons, SheetJS (XLSX), jsPDF, jsQR Scanner.
- **Backend**: Node.js v20+ dengan Express REST API.
- **Database**: PostgreSQL 15/16 (Relasional) via node-postgres Pool & Drizzle ORM.
- **Port Layanan**: Default port `3000`.

### Spesifikasi Minimum Server (VPS):
- **CPU**: 1 Core vCPU (Rekomendasi 2 Core untuk sekolah > 500 siswa)
- **RAM**: Minimal 1 GB (Rekomendasi 2 GB jika database PostgreSQL berada dalam satu VPS)
- **Disk**: 20 GB SSD
- **Sistem Operasi**: Ubuntu 22.04 LTS atau Ubuntu 24.04 LTS
- **Domain/Subdomain**: Misal: `absensi.smpn4jambi.sch.id`

---

## 2. Penting: Syarat Kamera Web & Scanner (Wajib HTTPS / SSL)

> ⚠️ **PERINGATAN PENTING KEAMANAN BROWSER**:
> Semua browser modern (Google Chrome, Safari, Mozilla Firefox, Microsoft Edge) **MEMBLOKIR** akses kamera (`navigator.mediaDevices.getUserMedia`) jika website dibuka menggunakan koneksi HTTP biasa tanpa sertifikat SSL (kecuali `localhost`).
> 
> Agar fitur **Buka Kamera Live Scanner QR** berfungsi di HP Android, iPhone, tablet, maupun laptop guru/siswa, **domain website WAJIB memiliki sertifikat SSL / HTTPS**.
> Di panduan ini disertakan langkah gratis menggunakan Let's Encrypt (Certbot).

---

## 3. Pilihan A: Deploy ke VPS Ubuntu (Nginx + PM2 + Let's Encrypt)

Metode ini paling populer untuk sekolah karena hemat biaya (mulai Rp 50.000 - Rp 100.000/bulan di penyedia VPS seperti IDCloudHost, Niagahoster, DomaiNesia, Biznet, DigitalOcean, Linode) dan Anda memegang kendali penuh.

### Langkah 1: Persiapan Server VPS
Login ke server VPS Anda melalui terminal SSH:
```bash
ssh root@IP_SERVER_ANDA
```

Perbarui paket sistem:
```bash
sudo apt update && sudo apt upgrade -y
```

Install alat pendukung:
```bash
sudo apt install -y curl git ufw build-essential
```

### Langkah 2: Install Node.js v20 & PM2
```bash
# Tambahkan repositori Node.js LTS (v20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi versi node dan npm
node -v
npm -v

# Install PM2 (Process Manager agar aplikasi berjalan 24/7 otomatis restart jika server reboot)
sudo npm install -g pm2
```

### Langkah 3: Install & Konfigurasi Database PostgreSQL di VPS
```bash
# Install PostgreSQL server
sudo apt install -y postgresql postgresql-contrib

# Masuk ke shell postgres
sudo -u postgres psql
```

Di dalam prompt PostgreSQL (`postgres=#`), jalankan perintah berikut:
```sql
-- Buat database untuk absensi
CREATE DATABASE absensi_db;

-- Buat user database dengan password kuat
CREATE USER absensi_user WITH ENCRYPTED PASSWORD 'PasswordSuperAman123!';

-- Berikan hak akses penuh ke database
GRANT ALL PRIVILEGES ON DATABASE absensi_db TO absensi_user;

-- Berikan izin skema public (PostgreSQL 15+)
\c absensi_db
GRANT ALL ON SCHEMA public TO absensi_user;

-- Keluar dari postgres
\q
```

### Langkah 4: Clone / Salin Kode Aplikasi ke Server
Pindahkan atau clone repositori aplikasi ke direktori `/var/www/absensi-sekolah`:
```bash
sudo mkdir -p /var/www/absensi-sekolah
sudo chown -R $USER:$USER /var/www/absensi-sekolah
cd /var/www/absensi-sekolah

# Jika menggunakan Git:
# git clone https://github.com/username/sistem-absensi-sekolah.git .
```

Install dependensi:
```bash
npm install
```

### Langkah 5: Atur Environment Variables (`.env`)
Buat file `.env` di folder root project:
```bash
nano .env
```
Isi dengan konfigurasi berikut:
```env
PORT=3000
NODE_ENV=production

# Konfigurasi Database PostgreSQL
SQL_HOST=localhost
SQL_PORT=5432
SQL_USER=absensi_user
SQL_PASSWORD=PasswordSuperAman123!
SQL_DB_NAME=absensi_db
SQL_SSL=false

# URL Domain Publik Anda
APP_URL=https://absensi.smpn4jambi.sch.id
```
Simpan file dengan menekan `CTRL + O`, lalu `Enter`, dan keluar dengan `CTRL + X`.

### Langkah 6: Build Aplikasi Frontend
```bash
npm run build
```
Hasil build production akan tersimpan di folder `dist/`.

### Langkah 7: Jalankan Aplikasi Menggunakan PM2
Buat file `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'absensi-sekolah',
      script: 'node',
      args: 'dist/server.js', // atau: npx tsx server.ts
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Jalankan dengan PM2:
```bash
# Jalankan aplikasi server
pm2 start server.ts --name "absensi-sekolah" --interpreter="tsx"

# Simpan proses agar otomatis berjalan saat server reboot
pm2 save
pm2 startup
```
Cek status aplikasi:
```bash
pm2 status
pm2 logs absensi-sekolah
```

### Langkah 8: Install dan Konfigurasi Nginx Web Server
Nginx bertindak sebagai Reverse Proxy yang menerima lalu lintas web (port 80 dan 443) dan meneruskannya ke port internal Node.js 3000.

```bash
sudo apt install -y nginx
```

Buat konfigurasi virtual host Nginx untuk domain Anda:
```bash
sudo nano /etc/nginx/sites-available/absensi
```
Salin konfigurasi berikut (ganti `absensi.smpn4jambi.sch.id` dengan domain/subdomain Anda):
```nginx
server {
    listen 80;
    server_name absensi.smpn4jambi.sch.id;

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
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/absensi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Langkah 9: Pasang Sertifikat SSL Gratis (HTTPS) dengan Let's Encrypt
Arahkan DNS Record domain/subdomain Anda (A Record) ke IP Publik VPS Anda terlebih dahulu.
Setelah domain terhubung, jalankan Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d absensi.smpn4jambi.sch.id
```
Pilih opsi **Redirect all HTTP traffic to HTTPS**.

Selesai! Buka `https://absensi.smpn4jambi.sch.id` di browser. Kamera live, scanner QR, notifikasi WA, dan database PostgreSQL sekarang sudah 100% online dengan enkripsi aman!

---

## 4. Pilihan B: Deploy ke Google Cloud Run + Cloud SQL

Google Cloud Run adalah layanan serverless hemat biaya yang otomatis autoscaling (bisa scale to zero jika tidak ada yang mengakses di malam hari).

### Langkah 1: Buat Instance PostgreSQL di Google Cloud SQL
1. Masuk ke Google Cloud Console: `https://console.cloud.google.com/sql`
2. Klik **Create Instance** -> Pilih **PostgreSQL**.
3. Masukkan Instance ID (misal: `absensi-sekolah-db`) dan Password admin.
4. Buat Database: `absensi_db`.
5. Catat **Connection Name** instance Anda (format: `project-id:region:instance-id`).

### Langkah 2: Build & Deploy Container ke Google Cloud Run
Pastikan Google Cloud SDK (`gcloud`) terpasang di komputer Anda.

```bash
# Login ke akun GCP
gcloud auth login
gcloud config set project NAMA_PROJECT_GCP_ANDA

# Build image container via Cloud Build
gcloud builds submit --tag gcr.io/NAMA_PROJECT_GCP_ANDA/absensi-sekolah

# Deploy ke Cloud Run dengan koneksi ke Cloud SQL
gcloud run deploy absensi-sekolah \
  --image gcr.io/NAMA_PROJECT_GCP_ANDA/absensi-sekolah \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --add-cloudsql-instances NAMA_PROJECT_GCP_ANDA:asia-southeast1:absensi-sekolah-db \
  --set-env-vars SQL_HOST="/cloudsql/NAMA_PROJECT_GCP_ANDA:asia-southeast1:absensi-sekolah-db",SQL_USER="postgres",SQL_PASSWORD="PasswordAnda",SQL_DB_NAME="absensi_db"
```

Cloud Run akan memberikan URL HTTPS resmi (misal: `https://absensi-sekolah-xyz.a.run.app`). Anda juga dapat memetakan custom domain sekolah Anda di menu Cloud Run -> Custom Domains.

---

## 5. Pilihan C: Deploy Cepat ke PaaS (Railway / Render)

Jika sekolah belum memiliki server sendiri, Anda bisa menggunakan platform PaaS seperti Railway atau Render dengan database PostgreSQL cloud gratis dari Neon atau Supabase:

1. Buat database PostgreSQL gratis di **[Neon.tech](https://neon.tech)** atau **[Supabase.com](https://supabase.com)**.
2. Catat host, username, password, dan nama database.
3. Hubungkan repositori GitHub Anda ke **[Railway.app](https://railway.app)** atau **[Render.com](https://render.com)**.
4. Tambahkan Environment Variables di dashboard:
   - `SQL_HOST` = host neon/supabase
   - `SQL_USER` = user postgres
   - `SQL_PASSWORD` = password database
   - `SQL_DB_NAME` = nama database
   - `SQL_SSL` = `true`
5. Klik Deploy. Platform akan otomatis mengompilasi dan mengaktifkan HTTPS gratis!

---

## 6. File-File Konfigurasi Server (Siap Pakai)

### a. File `.env.production`
```env
PORT=3000
NODE_ENV=production

# Kredensial PostgreSQL
SQL_HOST=127.0.0.1
SQL_PORT=5432
SQL_USER=absensi_user
SQL_PASSWORD=PasswordRahasiaAnda123!
SQL_DB_NAME=absensi_db
SQL_SSL=false

# Domain Aplikasi
APP_URL=https://absensi.smpn4jambi.sch.id
```

### b. File Konfigurasi Nginx Reverse Proxy
Simpan di `/etc/nginx/sites-available/absensi`:
```nginx
server {
    listen 80;
    server_name absensi.smpn4jambi.sch.id;
    client_max_body_size 50M;

    # Gzip Compression untuk performa cepat
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```

### c. File PM2 `ecosystem.config.cjs`
Simpan di folder project `/var/www/absensi-sekolah/ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'absensi-sekolah',
      script: 'server.ts',
      interpreter: 'tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

### d. File `Dockerfile` & `docker-compose.yml`

**Dockerfile**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: absensi_postgres
    restart: always
    environment:
      POSTGRES_USER: absensi_user
      POSTGRES_PASSWORD: PasswordSuperAman123!
      POSTGRES_DB: absensi_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    container_name: absensi_app
    restart: always
    ports:
      - "3000:3000"
    environment:
      SQL_HOST: db
      SQL_PORT: 5432
      SQL_USER: absensi_user
      SQL_PASSWORD: PasswordSuperAman123!
      SQL_DB_NAME: absensi_db
      SQL_SSL: "false"
      PORT: 3000
    depends_on:
      - db

volumes:
  pgdata:
```

---

## 7. Panduan Integrasi Scanner Barcode USB (MC26) & Smartphone

### A. Penggunaan Scanner Barcode USB (MC26 / Barcode Gun USB)
Scanner barcode USB seperti model MC26 atau scanner gun otomatis bekerja menggunakan mode **Keyboard Emulation (HID)**.
- Colokkan kabel USB scanner ke laptop/PC di meja piket atau pos satpam.
- Buka menu **Daftar Hadir** (atau klik tombol **Buka Daftar Hadir (Tanpa Login)** di halaman depan).
- Arahkan scanner ke QR Code kartu pelajar siswa.
- Scanner akan otomatis mengetik NISN dan menekan tombol Enter dalam hitungan milidetik.
- Sistem akan mengeluarkan bunyi "BEEP" sukses dan data kehadiran langsung tersimpan ke PostgreSQL!

### B. Penggunaan Smartphone Kamera Live
- Petugas atau siswa cukup membuka link HTTPS aplikasi di browser Chrome/Safari di HP mereka.
- Klik **Buka Kamera Live**.
- Berikan izin akses kamera saat browser meminta persetujuan (*Allow Camera*).
- Arahkan kamera ke QR Code kartu pelajar. Scanner akan mendeteksi QR code dalam sudut apa pun dan langsung memproses presensi.

---

## 8. Perawatan, Backup Database Otomatis & Troubleshooting

### A. Backup Otomatis Database PostgreSQL
Buat skrip backup harian dengan cron job:
```bash
sudo crontab -e
```
Tambahkan baris berikut untuk backup otomatis setiap pukul 02:00 pagi:
```cron
0 2 * * * pg_dump -U absensi_user -h localhost absensi_db | gzip > /var/backups/absensi_$(date +\%Y\%m\%d).sql.gz
```

### B. Restore Database dari File Backup
Jika sewaktu-waktu ingin memulihkan database dari file backup:
```bash
gunzip -c /var/backups/absensi_20261029.sql.gz | psql -U absensi_user -h localhost -d absensi_db
```

### C. Troubleshooting Umum:
1. **Kamera Tidak Mau Terbuka di HP**:
   - Pastikan URL website menggunakan **HTTPS://**, bukan HTTP://.
   - Periksa izin kamera pada pengaturan browser di ponsel.
2. **Koneksi Database Gagal**:
   - Periksa status PostgreSQL: `sudo systemctl status postgresql`
   - Uji koneksi: `psql -h localhost -U absensi_user -d absensi_db`
3. **Melihat Log Error Aplikasi**:
   - Jalankan `pm2 logs absensi-sekolah`
