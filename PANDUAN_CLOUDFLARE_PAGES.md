# Panduan Deploy ke Cloudflare Pages + Database Supabase

Project ini sekarang mendukung **dua mode deployment sekaligus** tanpa mengubah atau menghapus kode lama:
- **Vercel / Node.js / VPS**: tetap menggunakan `api/index.ts`, `vercel.json`, `server.ts`, dan `src/server/*` (menggunakan `DATABASE_URL`).
- **Cloudflare Pages**: menggunakan kode tambahan di folder `functions/` (`functions/api/[[path]].ts` & `functions/_lib/supabase.ts`) yang terhubung ke **Supabase melalui HTTPS PostgREST API** agar berjalan 100% native di Cloudflare Workers runtime.

---

## 1. File Tambahan yang Dibuat

1. `functions/api/[[path]].ts` — Handler Cloudflare Pages Functions untuk seluruh endpoint `/api/*`.
2. `functions/_lib/supabase.ts` — Adapter database Supabase via HTTPS REST API (`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`).
3. `wrangler.toml` — Konfigurasi build output Cloudflare Pages (`dist`).

---

## 2. Persiapan Database di Supabase

1. Pastikan skema utama dari `supabase_schema.sql` sudah dijalankan di **Supabase Dashboard → SQL Editor → New Query → Run**.
2. Jika tabel `pengajuan_izin` belum ada di Supabase Anda, jalankan SQL tambahan berikut di SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS pengajuan_izin (
    id SERIAL PRIMARY KEY,
    nisn TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas TEXT NOT NULL,
    jenis TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL,
    tanggal_selesai TEXT NOT NULL,
    keterangan TEXT NOT NULL,
    dokumen_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Menunggu Persetujuan',
    catatan_admin TEXT DEFAULT '',
    reviewed_at TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pengajuan_nisn ON pengajuan_izin(nisn);
CREATE INDEX IF NOT EXISTS idx_pengajuan_status ON pengajuan_izin(status);
```

3. Ambil kredensial API Supabase Anda di **Supabase Dashboard → Project Settings → API**:
   - **Project URL** (contoh: `https://abcdefghijklmno.supabase.co`)
   - **Project API Keys → `service_role` (secret)**

> **Catatan Keamanan**: `SUPABASE_SERVICE_ROLE_KEY` hanya dibaca di sisi server (`functions/` Cloudflare Pages Functions) dan **tidak pernah dikirim ke browser**.

---

## 3. Cara Deploy ke Cloudflare Pages

1. Push seluruh kode (termasuk folder `functions/` dan `wrangler.toml`) ke repository GitHub Anda.
2. Login ke **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pilih repository GitHub Anda, lalu isi **Build configuration**:
   - **Framework preset**: `Vite` (atau `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Klik **Save and Deploy** (atau langsung tambahkan Environment Variables sebelum deploy).
5. Buka menu **Settings → Environment variables** di project Cloudflare Pages Anda (tambahkan pada **Production** dan **Preview**):
   - `SUPABASE_URL` = `https://PROJECT_REF_ANDA.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOi...` (key `service_role` dari Supabase)
6. Lakukan **Retry deployment** (atau push commit baru) agar Environment Variables aktif pada Pages Functions.

---

## 4. Uji Koneksi Setelah Deploy

Buka URL berikut di browser:
```text
https://nama-project-anda.pages.dev/api/database/status
```

Jika konfigurasi benar, akan muncul respons JSON:
```json
{
  "success": true,
  "connected": true,
  "provider": "Supabase PostgreSQL Cloud (Cloudflare Pages)",
  "host": "PROJECT_REF_ANDA.supabase.co",
  "database": "postgres (Supabase)",
  "ssl": true,
  "hasEnv": true,
  "lastError": null
}
```
