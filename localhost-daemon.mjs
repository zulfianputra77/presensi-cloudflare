/**
 * Localhost Background Daemon Manager
 * Menjalankan localhost-server.ts di background (tanpa jendela CMD tetap terbuka di Windows)
 * dan menyediakan perintah start / stop / status.
 *
 * Penggunaan:
 *   node localhost-daemon.mjs start [port]
 *   node localhost-daemon.mjs start --port=4040
 *   node localhost-daemon.mjs stop
 *   node localhost-daemon.mjs status [port]
 */

import 'dotenv/config';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const PID_FILE = path.resolve(DATA_DIR, 'localhost.pid');
const LOG_FILE = path.resolve(DATA_DIR, 'localhost-server.log');
const SERVER_ENTRY = path.resolve(__dirname, 'localhost-server.ts');
const TSX_CLI = path.resolve(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function resolvePort(args) {
  const cliPortArg = args.find((arg) => arg.startsWith('--port='));
  if (cliPortArg) {
    const val = parseInt(cliPortArg.split('=')[1], 10);
    if (!Number.isNaN(val) && val > 0) return val;
  }

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      const val = parseInt(arg, 10);
      if (val > 0) return val;
    }
  }

  const envPort = process.env.LOCALHOST_PORT || process.env.PORT;
  if (envPort && /^\d+$/.test(envPort)) {
    const val = parseInt(envPort, 10);
    if (val > 0) return val;
  }

  return 4500;
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function readPidMeta() {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const raw = fs.readFileSync(PID_FILE, 'utf-8').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.pid === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writePidMeta(meta) {
  ensureDataDir();
  fs.writeFileSync(PID_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    // ignore
  }
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

function checkHealth(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ ok: false, statusCode: res.statusCode, foreign: true });
            return;
          }
          try {
            const json = JSON.parse(body);
            if (json && json.status === 'ok') {
              resolve({ ok: true, data: json });
            } else {
              resolve({ ok: false, foreign: true });
            }
          } catch {
            resolve({ ok: false, foreign: true });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false });
    });

    req.on('error', () => {
      resolve({ ok: false });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLogTail(offsetBytes = 0, maxChars = 4000) {
  try {
    if (!fs.existsSync(LOG_FILE)) return '';
    const stat = fs.statSync(LOG_FILE);
    const start = Math.max(0, offsetBytes < stat.size ? offsetBytes : stat.size - maxChars);
    const length = stat.size - start;
    if (length <= 0) return '';
    const fd = fs.openSync(LOG_FILE, 'r');
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);
    fs.closeSync(fd);
    const text = buf.toString('utf-8').trim();
    if (text.length > maxChars) {
      return text.slice(-maxChars);
    }
    return text;
  } catch {
    return '';
  }
}

function printRunningInfo({ port, pid, dbProvider, alreadyRunning = false }) {
  const lanIps = getLanAddresses();
  console.log('');
  console.log('==============================================================');
  console.log(
    alreadyRunning
      ? '  SERVER LOCALHOST SUDAH AKTIF DI BACKGROUND'
      : '  SERVER LOCALHOST BERHASIL JALAN DI BACKGROUND'
  );
  console.log('==============================================================');
  console.log(`  Port Aktif     : ${port}`);
  console.log(`  Akses Lokal    : http://localhost:${port}`);
  for (const ip of lanIps) {
    console.log(`  Akses WiFi/LAN : http://${ip}:${port}`);
  }
  if (dbProvider) {
    console.log(`  Database       : ${dbProvider}`);
  }
  if (pid) {
    console.log(`  PID Proses     : ${pid}`);
  }
  console.log(`  File Log       : ${LOG_FILE}`);
  console.log('--------------------------------------------------------------');
  console.log('  Akun Default   : admin / admin123 | guru1 / guru123');
  console.log('  Siswa Contoh   : NISN 1234567890');
  console.log('==============================================================');
  console.log('');
}

async function handleStart(args) {
  const requestedPort = resolvePort(args);

  if (!fs.existsSync(TSX_CLI)) {
    console.error(`[ERROR] Komponen tsx belum terpasang di: ${TSX_CLI}`);
    console.error('Jalankan "npm install" terlebih dahulu.');
    process.exit(1);
  }
  if (!fs.existsSync(SERVER_ENTRY)) {
    console.error(`[ERROR] File server tidak ditemukan: ${SERVER_ENTRY}`);
    process.exit(1);
  }

  // Cek apakah sudah berjalan dari PID file
  const existing = readPidMeta();
  if (existing && isPidAlive(existing.pid)) {
    const check = await checkHealth(existing.port);
    if (check.ok && check.data?.mode === 'localhost-standalone') {
      printRunningInfo({
        port: existing.port,
        pid: existing.pid,
        dbProvider: check.data?.db?.provider,
        alreadyRunning: true,
      });
      process.exit(0);
    }
  }

  // Cek apakah port target sudah aktif oleh instance server aplikasi ini
  const portCheck = await checkHealth(requestedPort);
  if (portCheck.ok && portCheck.data?.mode === 'localhost-standalone') {
    printRunningInfo({
      port: requestedPort,
      pid: existing && isPidAlive(existing.pid) ? existing.pid : null,
      dbProvider: portCheck.data?.db?.provider,
      alreadyRunning: true,
    });
    process.exit(0);
  }
  if (portCheck.foreign) {
    console.error(`[ERROR] Port ${requestedPort} sudah dipakai aplikasi lain.`);
    console.error('Ubah LOCALHOST_PORT di file .env atau jalankan dengan port lain.');
    process.exit(1);
  }

  ensureDataDir();

  // Reset log jika lebih dari 2 MB agar tidak menumpuk
  let logFlag = 'a';
  if (fs.existsSync(LOG_FILE)) {
    const st = fs.statSync(LOG_FILE);
    if (st.size > 2 * 1024 * 1024) {
      logFlag = 'w';
    }
  }
  const initialOffset = logFlag === 'w' || !fs.existsSync(LOG_FILE) ? 0 : fs.statSync(LOG_FILE).size;

  const headerLine = `\n[${new Date().toISOString()}] Memulai localhost-server pada port ${requestedPort}...\n`;
  fs.appendFileSync(LOG_FILE, headerLine, { flag: logFlag, encoding: 'utf-8' });

  const logFd = fs.openSync(LOG_FILE, 'a');

  let childExited = false;
  let childExitCode = null;
  let spawnError = null;

  const child = spawn(process.execPath, [TSX_CLI, SERVER_ENTRY, `--port=${requestedPort}`], {
    cwd: __dirname,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });

  try {
    fs.closeSync(logFd);
  } catch {
    // ignore
  }

  child.on('error', (err) => {
    spawnError = err;
    childExited = true;
  });

  child.on('exit', (code) => {
    childExited = true;
    childExitCode = code;
  });

  child.unref();

  // Tunggu sampai /api/health merespons 200 OK (maks 25 detik)
  const maxAttempts = 80;
  for (let i = 0; i < maxAttempts; i++) {
    if (childExited) {
      removePidFile();
      console.error(`[ERROR] Server berhenti sebelum siap (exit code: ${childExitCode ?? 'unknown'}).`);
      if (spawnError) {
        console.error(`Detail spawn error: ${spawnError.message}`);
      }
      const tail = readLogTail(initialOffset);
      if (tail) {
        console.error('\n--- Log Terakhir ---');
        console.error(tail);
        console.error('--------------------\n');
      }
      process.exit(1);
    }

    const health = await checkHealth(requestedPort, 800);
    if (health.ok && health.data?.mode === 'localhost-standalone') {
      writePidMeta({
        pid: child.pid,
        port: requestedPort,
        startedAt: new Date().toISOString(),
        logFile: LOG_FILE,
      });
      printRunningInfo({
        port: requestedPort,
        pid: child.pid,
        dbProvider: health.data?.db?.provider,
        alreadyRunning: false,
      });
      process.exit(0);
    }

    await sleep(300);
  }

  console.error(`[ERROR] Timeout menunggu server localhost siap di port ${requestedPort}.`);
  const tail = readLogTail(initialOffset);
  if (tail) {
    console.error('\n--- Log Terakhir ---');
    console.error(tail);
    console.error('--------------------\n');
  }
  process.exit(1);
}

async function handleStop() {
  const meta = readPidMeta();
  if (!meta) {
    console.log('[INFO] Tidak ditemukan proses background yang tercatat (data/localhost.pid kosong).');
    process.exit(0);
  }

  const { pid, port } = meta;
  if (!isPidAlive(pid)) {
    removePidFile();
    console.log(`[INFO] Server background (PID ${pid}) sudah tidak berjalan. File PID dibersihkan.`);
    process.exit(0);
  }

  console.log(`[INFO] Menghentikan server localhost (PID ${pid}, port ${port})...`);

  try {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        process.kill(pid);
      }
    } else {
      process.kill(pid, 'SIGTERM');
      for (let i = 0; i < 20; i++) {
        if (!isPidAlive(pid)) break;
        await sleep(150);
      }
      if (isPidAlive(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch (err) {
    console.error(`[ERROR] Gagal menghentikan PID ${pid}: ${err?.message || err}`);
    process.exit(1);
  }

  await sleep(250);
  removePidFile();
  console.log(`[OK] Server localhost di port ${port} berhasil dihentikan.`);
  process.exit(0);
}

async function handleStatus(args) {
  const meta = readPidMeta();
  const port = meta?.port || resolvePort(args);
  const pidAlive = meta ? isPidAlive(meta.pid) : false;
  const health = await checkHealth(port);

  console.log('');
  console.log('==============================================================');
  console.log('  STATUS SERVER LOCALHOST - SISTEM ABSENSI SEKOLAH');
  console.log('==============================================================');

  if (health.ok && health.data?.mode === 'localhost-standalone') {
    console.log('  Status         : AKTIF (Running di Background)');
    console.log(`  Port Aktif     : ${port}`);
    console.log(`  Akses Lokal    : http://localhost:${port}`);
    for (const ip of getLanAddresses()) {
      console.log(`  Akses WiFi/LAN : http://${ip}:${port}`);
    }
    console.log(`  PID Proses     : ${pidAlive ? meta.pid : 'Aktif (tanpa PID file)'}`);
    console.log(`  Database       : ${health.data?.db?.provider || '-'}`);
    console.log(`  File Log       : ${LOG_FILE}`);
  } else {
    if (meta && !pidAlive) {
      removePidFile();
    }
    console.log('  Status         : MATI (Tidak Berjalan)');
    console.log(`  Port Target    : ${port}`);
    console.log(`  File Log       : ${LOG_FILE}`);
  }

  console.log('==============================================================');
  console.log('');
  process.exit(0);
}

const [, , command = 'start', ...restArgs] = process.argv;

if (command === 'start') {
  handleStart(restArgs);
} else if (command === 'stop') {
  handleStop();
} else if (command === 'status') {
  handleStatus(restArgs);
} else {
  // Jika argumen pertama langsung berupa angka port atau --port=..., perlakukan sebagai start
  handleStart([command, ...restArgs]);
}
