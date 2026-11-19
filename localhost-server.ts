/**
 * Standalone Localhost Server Launcher
 * Menjalankan seluruh sistem (Frontend React + Backend Express API + Database Lokal/PostgreSQL/Turso)
 * di komputer atau server lokal dengan port tersendiri (misalnya http://localhost:4500).
 *
 * Cara menjalankan:
 *   npx tsx localhost-server.ts
 *   npx tsx localhost-server.ts --port=4500
 *   PORT=8080 npx tsx localhost-server.ts
 */

import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import { initStorage, storage } from './src/server/storage.ts';
import { createLocalFileStorage } from './src/server/local-file-store.ts';
import { TursoStorage, hasTursoConfig } from './functions/_lib/turso.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const cliPortArg = process.argv.find((arg) => arg.startsWith('--port='));
  if (cliPortArg) {
    const val = parseInt(cliPortArg.split('=')[1], 10);
    if (!Number.isNaN(val) && val > 0) return val;
  }

  const positionalPort = process.argv[2];
  if (positionalPort && /^\d+$/.test(positionalPort)) {
    return parseInt(positionalPort, 10);
  }

  const envPort = process.env.LOCALHOST_PORT || process.env.PORT;
  if (envPort && /^\d+$/.test(envPort)) {
    return parseInt(envPort, 10);
  }

  return 4500;
}

function getLanAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

async function startLocalhostServer() {
  const PORT = resolvePort();
  const app = express();

  // 1. Coba konek PostgreSQL lokal/cloud jika DATABASE_URL atau SQL_HOST diisi di .env
  await initStorage();

  let dbModeLabel = 'PostgreSQL Server';

  if (!storage.isPostgres()) {
    // 2. Jika Turso dikonfigurasi di .env, gunakan Turso
    if (hasTursoConfig(process.env)) {
      const turso = new TursoStorage(process.env);
      const tursoAny: any = turso;
      Object.assign(storage, {
        isPostgres: () => false,
        findUserByUsername: tursoAny.findUserByUsername.bind(turso),
        getAllGuru: tursoAny.getAllGuru.bind(turso),
        createGuru: tursoAny.createGuru.bind(turso),
        updateGuru: tursoAny.updateGuru.bind(turso),
        deleteGuru: tursoAny.deleteGuru.bind(turso),
        createSession: tursoAny.createSession.bind(turso),
        findSession: tursoAny.findSession.bind(turso),
        deleteSession: tursoAny.deleteSession.bind(turso),
        getAllSiswa: tursoAny.getAllSiswa.bind(turso),
        findSiswaByNisn: tursoAny.findSiswaByNisn.bind(turso),
        createSiswa: tursoAny.createSiswa.bind(turso),
        updateSiswa: tursoAny.updateSiswa.bind(turso),
        deleteSiswa: tursoAny.deleteSiswa.bind(turso),
        getAllKelas: tursoAny.getAllKelas.bind(turso),
        getKelasMaster: tursoAny.getKelasMaster.bind(turso),
        createKelas: tursoAny.createKelas.bind(turso),
        updateKelas: tursoAny.updateKelas.bind(turso),
        deleteKelas: (_id: number, _nama: string) => tursoAny.deleteKelas(_id),
        getAllHariLibur: tursoAny.getAllHariLibur.bind(turso),
        addHariLibur: tursoAny.addHariLibur.bind(turso),
        deleteHariLibur: tursoAny.deleteHariLibur.bind(turso),
        getConfig: tursoAny.getConfig.bind(turso),
        saveConfigKey: tursoAny.saveConfigKey.bind(turso),
        getAbsensiToday: tursoAny.getAbsensiToday.bind(turso),
        getAbsensiByDate: tursoAny.getAbsensiByDate.bind(turso),
        getAbsensiRange: tursoAny.getAbsensiRange.bind(turso),
        recordAbsensiMasuk: tursoAny.recordAbsensiMasuk.bind(turso),
        recordAbsensiPulang: tursoAny.recordAbsensiPulang.bind(turso),
        updateAbsensiStatus: tursoAny.updateAbsensiStatus.bind(turso),
        getSholatByDate: tursoAny.getSholatByDate.bind(turso),
        getSholatMonth: tursoAny.getSholatMonth.bind(turso),
        saveSholatRecords: tursoAny.saveSholatRecords.bind(turso),
        getWaStatus: tursoAny.getWaStatus.bind(turso),
        recordWaSent: tursoAny.recordWaSent.bind(turso),
        getAllPengajuan: tursoAny.getAllPengajuan.bind(turso),
        createPengajuan: tursoAny.createPengajuan.bind(turso),
        reviewPengajuan: tursoAny.reviewPengajuan.bind(turso),
        getAbsensiMonthByNisn: tursoAny.getAbsensiMonthByNisn.bind(turso),
        clearAcademicYear: tursoAny.clearAcademicYear.bind(turso),
        getDatabaseStatus: () => ({
          connected: true,
          provider: 'Turso libSQL Cloud (Localhost)',
          host: process.env.TURSO_DATABASE_URL || 'turso.io',
          database: 'libSQL (Turso)',
          ssl: true,
          hasEnv: true,
          lastError: null,
        }),
      });
      dbModeLabel = 'Turso Cloud (libSQL)';
    } else {
      // 3. Default Offline/Standalone: Database File Lokal Persisten di hardisk komputer!
      const localStore = createLocalFileStorage(process.env.LOCAL_DB_PATH);
      Object.assign(storage, localStore);
      dbModeLabel = `Database Lokal Offline (${localStore.getFilePath()})`;
    }
  }

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use('/api', apiRouter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: 'localhost-standalone',
      port: PORT,
      db: storage.getDatabaseStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  // Sajikan build produksi `dist/` jika sudah ada; jika belum, pakai Vite middleware otomatis
  const distDir = path.resolve(__dirname, 'dist');
  const distHtmlPath = path.resolve(distDir, 'index.html');
  const hasDist = fs.existsSync(distHtmlPath);

  if (hasDist) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const rootHtmlPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(rootHtmlPath)) {
          let template = fs.readFileSync(rootHtmlPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
        return next();
      } catch (e) {
        return next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const lanIps = getLanAddresses();
    console.log('\n==============================================================');
    console.log('  SISTEM ABSENSI SEKOLAH - MODE LOCALHOST / SERVER MANDIRI');
    console.log('==============================================================');
    console.log(`  Port Aktif     : ${PORT}`);
    console.log(`  Akses Lokal    : http://localhost:${PORT}`);
    lanIps.forEach((ip) => {
      console.log(`  Akses WiFi/LAN : http://${ip}:${PORT}`);
    });
    console.log(`  Database       : ${dbModeLabel}`);
    console.log(`  Frontend Mode  : ${hasDist ? 'Production Build (dist/)' : 'Vite Dev Server'}`);
    console.log('--------------------------------------------------------------');
    console.log('  Akun Default   : admin / admin123 | guru1 / guru123');
    console.log('  Siswa Contoh   : NISN 1234567890');
    console.log('==============================================================\n');
  });
}

startLocalhostServer().catch((err) => {
  console.error('Gagal menjalankan server localhost:', err);
  process.exit(1);
});
