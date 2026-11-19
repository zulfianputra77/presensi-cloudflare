# Panduan Deploy ke Cloudflare (Workers & Pages) + Database Supabase

Project ini mendukung deployment ke **Cloudflare** dan **Vercel / Node.js** secara bersamaan tanpa mengubah atau menghapus kode lama (`server.ts`, `api/index.ts`, `vercel.json`, `src/server/*` tetap utuh 100%).

---

## 1. File Tambahan yang Dibuat

1. `functions/worker.ts` — Entrypoint Cloudflare Worker (mengirim `/api/*` ke API handler dan file statis `dist/` ke binding `ASSETS`).
2. `functions/api/[[path]].ts` — Router seluruh endpoint `/api/*`.
3. `functions/_lib/supabase.ts` — Adapter database Supabase via HTTPS PostgREST API (`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`).
4. `wrangler.toml` — Konfigurasi Cloudflare Workers + Static Assets (`directory = "./dist"`).

---

## 2. Persiapan Database di Supabase

1. Jalankan `supabase_schema.sql` di **Supabase Dashboard → SQL Editor → New Query → Run**.
2. Jika tabel `pengajuan_izin` belum ada di Supabase Anda, jalankan SQL tambahan berikut:

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

3. Ambil kredensial di **Supabase Dashboard → Project Settings → API**:
   - **Project URL** (`https://PROJECT_REF.supabase.co`)
   - **`service_role` secret key**

---

## 3. Pengaturan Build & Environment Variables di Cloudflare

Jika Anda membuat project di **Workers & Pages** (seperti `app-presensi-smp004` yang memakai **Build command** + `npx wrangler deploy`):

1. Pastikan di **Settings → Build**:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
2. Buka **Settings → Variables and Secrets** (di dashboard Worker Anda), lalu tambahkan:
   - `SUPABASE_URL` = `https://PROJECT_REF_ANDA.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = *(isi `service_role` key dari Supabase)*
   *(Simpan sebagai Secret/Encrypted Variable agar aman).*
3. Push perubahan terbaru (termasuk `wrangler.toml` dan folder `functions/`) ke GitHub, lalu klik **Retry build / Deploy** di Cloudflare.

> **Catatan**: Jika nama project Cloudflare Anda berbeda dari `app-presensi-smp004`, ubah baris `name = "app-presensi-smp004"` di `wrangler.toml` agar sama dengan nama project Cloudflare Anda.

---

## 4. Uji Koneksi Setelah Deploy

Buka di browser:
```text
https://NAMA-PROJECT-ANDA.workers.dev/api/database/status
```

Jika konfigurasi benar, respons JSON akan menampilkan `"connected": true`.
