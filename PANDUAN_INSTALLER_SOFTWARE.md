# Panduan Membangun Software Installer Windows (`Setup.exe` seperti Dapodik & e-Rapor)

Seluruh komponen di project ini sekarang mendukung pemaketan menjadi **aplikasi software Windows mandiri** (seperti **Dapodik** dan **e-Rapor**). Setelah di-install di komputer/laptop sekolah, operator tinggal **klik ganda ikon di Desktop** dan aplikasi langsung terbuka di browser pada alamat **`http://localhost:<PORT>`** secara lokal tanpa harus membuka CMD atau mengetik perintah apa pun.

---

## 1. Cara Kerja Setelah Di-install (Sama Seperti Dapodik / e-Rapor)

1. **Sudah Membawa Runtime Sendiri (`runtime/node.exe`)**
   - Komputer sekolah/TU tempat meng-install **tidak perlu menginstall Node.js atau PostgreSQL** secara terpisah.
   - Semua dependensi, tampilan React terkompilasi (`dist/`), dan server terkompilasi (`dist-server/`) sudah dikemas di dalam installer.
2. **Database Lokal Otomatis (`data/absensi-local-db.json`)**
   - Data siswa, kelas, guru, jadwal, absensi QR/Barcode, sholat, dan pengajuan izin langsung tersimpan permanen di hardisk komputer (100% bisa jalan offline tanpa internet).
   - Jika komputer punya `.env` berisi PostgreSQL lokal atau Turso Cloud, sistem juga tetap bisa menyambung otomatis.
3. **Silent Background Service & Ikon Desktop**
   - Klik ganda ikon Desktop **"Sistem Absensi Sekolah"** -> menjalankan server localhost secara tersembunyi di latar belakang (**0 kedipan CMD**) lalu langsung membuka `http://localhost:<PORT>` di browser.
   - Opsi **Auto-Start Windows**: menyalakan server localhost otomatis setiap kali komputer dinyalakan.
   - Dapat diakses komputer/HP lain di jaringan **WiFi/LAN** yang sama via IP komputer server (contoh `http://192.168.1.8:4500`).

---

## 2. Daftar Komponen Pembuat Software Installer

- **`scripts/generate-app-icon.mjs`** — Menghasilkan ikon aplikasi Windows (`assets/app-icon.ico`) untuk Desktop, Start Menu, dan file `Setup.exe`.
- **`scripts/build-server.mjs`** — Mengompilasi `localhost-server.ts` menjadi `dist-server/localhost-server.mjs` (JavaScript murni agar startup cepat ~50ms).
- **`scripts/build-software-package.mjs`** — Menyusun paket lengkap `release/AbsensiSekolah-Portable/` (frontend `dist/`, server `dist-server/`, `node_modules` produksi, runtime `node.exe` Windows x64, dan launcher `.vbs`).
- **`installer/AbsensiSekolah.iss`** — Script **Inno Setup 6** untuk menghasilkan 1 file installer **`Setup-Absensi-Sekolah-v1.0.0.exe`** (wizard Next > Atur Port > Install > Selesai).
- **`launcher/Absensi-Launcher.vbs`** — Launcher senyap Windows untuk ikon Desktop (membuka browser ke localhost).
- **`launcher/Absensi-AppWindow.vbs`** — Launcher mode jendela aplikasi terpisah (Edge/Chrome `--app` mode).
- **`launcher/Start-Silent.vbs`** & **`launcher/Stop-Silent.vbs`** — Menyalakan / menghentikan server latar belakang tanpa jendela CMD.
- **`build-installer.bat`** — Tombol 1-klik di Windows untuk membuat paket portable dan `Setup.exe`.

---

## 3. Langkah Membuat File `Setup-Absensi-Sekolah-v1.0.0.exe` di Windows

### Persiapan Sekali Saja (di Komputer Pembuat Installer)
1. Pastikan **Node.js LTS (v20/v22)** terpasang di komputer pembuat installer.
2. Install **Inno Setup 6** (gratis) dari situs resmi:
   ```text
   https://jrsoftware.org/isdl.php
   ```
   *(Pilih `innosetup-6.x.x.exe` lalu install dengan pengaturan default).*

### Proses Build Installer (1 Klik)
1. Buka folder project Anda di Windows (misal `C:\Absensi-Sekolah`).
2. Klik ganda **`build-installer.bat`** (atau jalankan `npm run package:win` di CMD).
3. Script akan otomatis mengerjakan 6 tahap:
   - Membuat ikon `assets\app-icon.ico`.
   - Build tampilan React (`npm run build` -> `dist\`).
   - Build server Node murni (`dist-server\localhost-server.mjs`).
   - Menyusun folder portable `release\AbsensiSekolah-Portable\` beserta `node_modules` produksi.
   - Mengunduh runtime **`node.exe` Windows x64** otomatis (disimpan di `.cache\` agar build berikutnya cepat).
   - Mengompilasi `installer\AbsensiSekolah.iss` menjadi:
     ```text
     release\Setup-Absensi-Sekolah-v1.0.0.exe
     ```

> **Catatan:** Jika Anda ingin membangun paket tanpa mengunduh `node.exe` portable (misal target PC sudah punya Node.js), jalankan:
> ```cmd
> node scripts/build-software-package.mjs --no-node
> ```

---

## 4. Cara Install & Pakai di Komputer Sekolah Target

1. Salin file **`Setup-Absensi-Sekolah-v1.0.0.exe`** ke komputer/server sekolah (lewat flashdisk atau download).
2. Klik ganda `Setup-Absensi-Sekolah-v1.0.0.exe`:
   - Pilih lokasi instalasi (default `C:\AbsensiSekolah`).
   - Masukkan **Port Server Localhost** yang diinginkan (default `4500`, atau ganti `4040` / `8080` agar tidak bentrok dengan Dapodik `5774` atau e-Rapor `8154`).
   - Biarkan centang **"Buat ikon pintasan di Desktop"** & **"Jalankan server localhost otomatis saat Windows menyala"**.
   - Klik **Install** -> **Finish**.
3. Setelah selesai:
   - Aplikasi langsung menyala di latar belakang dan terbuka di browser (`http://localhost:4500`).
   - Setiap kali ingin membuka ulang, cukup klik ganda ikon **"Sistem Absensi Sekolah"** di Desktop.
   - Untuk menghentikan server atau cek status, tersedia pintasan di **Start Menu > Sistem Absensi Sekolah**.
4. **Upgrade / Update Aplikasi di Masa Depan:**
   - Saat menginstall versi baru di folder yang sama, installer otomatis menjaga file `.env` dan seluruh isi database di folder `data\absensi-local-db.json` agar **data sekolah tidak tertimpa/hilang**.
