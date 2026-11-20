/**
 * Automated Software Packager (Dapodik / e-Rapor Style)
 * Membangun folder software standalone siap-pakai (release/AbsensiSekolah-Portable)
 * lengkap dengan compiled frontend (dist/), compiled server (dist-server/),
 * silent Windows launcher (launcher/), production node_modules,
 * serta bundling Node.js portable (runtime/node.exe) dan kompilasi Setup.exe via Inno Setup 6.
 *
 * Penggunaan:
 *   node scripts/build-software-package.mjs
 *   node scripts/build-software-package.mjs --no-node   (tanpa mengunduh runtime node.exe)
 */

import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAppIconFiles } from './generate-app-icon.mjs';
import { buildLocalhostServerBundle } from './build-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.resolve(ROOT, 'release');
const PORTABLE_DIR = path.resolve(RELEASE_DIR, 'AbsensiSekolah-Portable');
const CACHE_DIR = path.resolve(ROOT, '.cache');

const NODE_WIN_VERSION = 'v22.14.0';
const NODE_WIN_ZIP = `node-${NODE_WIN_VERSION}-win-x64.zip`;
const NODE_WIN_URL = `https://nodejs.org/dist/${NODE_WIN_VERSION}/${NODE_WIN_ZIP}`;

const args = process.argv.slice(2);
const skipNodeDownload = args.includes('--no-node');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function findInnoSetupCompiler() {
  const candidates = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const out = execSync(process.platform === 'win32' ? 'where ISCC' : 'which iscc', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out.split(/\r?\n/)[0];
  } catch {
    // not found
  }
  return null;
}

async function preparePortableNodeRuntime(targetRuntimeDir) {
  const targetNodeExe = path.resolve(targetRuntimeDir, 'node.exe');
  if (skipNodeDownload) {
    console.log('[INFO] Melewati unduhan runtime Node.js portable (--no-node).');
    return false;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachedNodeExe = path.resolve(CACHE_DIR, `node-${NODE_WIN_VERSION}-win-x64.exe`);
  if (fs.existsSync(cachedNodeExe)) {
    fs.mkdirSync(targetRuntimeDir, { recursive: true });
    fs.copyFileSync(cachedNodeExe, targetNodeExe);
    console.log(`[OK] Menggunakan cache runtime Node.js (${NODE_WIN_VERSION})`);
    return true;
  }

  const cachedZip = path.resolve(CACHE_DIR, NODE_WIN_ZIP);
  if (!fs.existsSync(cachedZip)) {
    console.log(`[INFO] Mengunduh runtime Node.js Windows x64 (${NODE_WIN_VERSION}) agar installer 100% offline...`);
    try {
      const res = await fetch(NODE_WIN_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrBuf = await res.arrayBuffer();
      fs.writeFileSync(cachedZip, Buffer.from(arrBuf));
    } catch (err) {
      console.log(`[PERINGATAN] Gagal mengunduh Node.js portable (${err.message}). Paket akan memakai Node.js komputer target.`);
      return false;
    }
  }

  // Ekstrak hanya node.exe dari arsip ZIP
  const tempExtractDir = path.resolve(CACHE_DIR, 'extract-node');
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    if (process.platform === 'win32') {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -Path '${cachedZip}' -DestinationPath '${tempExtractDir}' -Force`,
        ],
        { stdio: 'inherit' }
      );
    } else {
      execFileSync('unzip', ['-q', '-o', cachedZip, `node-${NODE_WIN_VERSION}-win-x64/node.exe`, '-d', tempExtractDir]);
    }

    const extractedExe = path.resolve(tempExtractDir, `node-${NODE_WIN_VERSION}-win-x64`, 'node.exe');
    if (fs.existsSync(extractedExe)) {
      fs.copyFileSync(extractedExe, cachedNodeExe);
      fs.mkdirSync(targetRuntimeDir, { recursive: true });
      fs.copyFileSync(extractedExe, targetNodeExe);
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      console.log(`[OK] Runtime portable node.exe (${NODE_WIN_VERSION}) siap di bundle.`);
      return true;
    }
  } catch (err) {
    console.log(`[PERINGATAN] Gagal mengekstrak node.exe (${err.message}).`);
  }
  return false;
}

async function main() {
  console.log('==============================================================');
  console.log('  PEMBUAT PAKET SOFTWARE & INSTALLER - SISTEM ABSENSI SEKOLAH');
  console.log('==============================================================\n');

  console.log('[1/6] Membuat ikon aplikasi Windows (assets/app-icon.ico)...');
  generateAppIconFiles();

  console.log('[2/6] Membangun frontend produksi (npm run build -> dist/)...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  console.log('[3/6] Mengompilasi server localhost (esbuild -> dist-server/)...');
  await buildLocalhostServerBundle();

  console.log('[4/6] Menyiapkan direktori software portable (release/AbsensiSekolah-Portable/)...');
  fs.rmSync(PORTABLE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PORTABLE_DIR, { recursive: true });

  copyRecursive(path.resolve(ROOT, 'dist'), path.resolve(PORTABLE_DIR, 'dist'));
  copyRecursive(path.resolve(ROOT, 'dist-server'), path.resolve(PORTABLE_DIR, 'dist-server'));
  copyRecursive(path.resolve(ROOT, 'launcher'), path.resolve(PORTABLE_DIR, 'launcher'));
  copyRecursive(path.resolve(ROOT, 'assets'), path.resolve(PORTABLE_DIR, 'assets'));

  const filesToCopy = [
    'localhost-daemon.mjs',
    'package.json',
    'package-lock.json',
    '.env.localhost.example',
    'start-localhost.bat',
    'stop-localhost.bat',
    'status-localhost.bat',
    'start-localhost-console.bat',
    'PANDUAN_LOCALHOST.md',
    'PANDUAN_INSTALLER_SOFTWARE.md',
  ];

  for (const rel of filesToCopy) {
    const src = path.resolve(ROOT, rel);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.resolve(PORTABLE_DIR, rel));
    }
  }

  console.log('[5/6] Memasang dependensi produksi (node_modules) & runtime Node.js...');
  try {
    execSync('npm ci --omit=dev --ignore-scripts', { cwd: PORTABLE_DIR, stdio: 'inherit' });
  } catch {
    execSync('npm install --omit=dev --ignore-scripts --legacy-peer-deps', {
      cwd: PORTABLE_DIR,
      stdio: 'inherit',
    });
  }

  const hasBundledNode = await preparePortableNodeRuntime(path.resolve(PORTABLE_DIR, 'runtime'));

  console.log('[6/6] Mengecek compiler Inno Setup 6 (ISCC.exe)...');
  const iscc = findInnoSetupCompiler();
  const issPath = path.resolve(ROOT, 'installer', 'AbsensiSekolah.iss');

  if (iscc && fs.existsSync(issPath)) {
    console.log(`[INFO] Menjalankan Inno Setup Compiler: ${iscc}`);
    execFileSync(iscc, [issPath], { cwd: ROOT, stdio: 'inherit' });
    console.log('\n==============================================================');
    console.log('  SUKSES! INSTALLER .EXE BERHASIL DIBUAT:');
    console.log(`  -> ${path.resolve(RELEASE_DIR, 'Setup-Absensi-Sekolah-v1.0.0.exe')}`);
    console.log(`  Runtime Node.js Portable : ${hasBundledNode ? 'TERTANAM (100% Offline)' : 'Memakai Node.js Komputer'}`);
    console.log('==============================================================\n');
  } else {
    console.log('\n==============================================================');
    console.log('  PAKET SOFTWARE PORTABLE SELESAI DIBUAT!');
    console.log(`  Folder Portable : ${PORTABLE_DIR}`);
    console.log(`  Runtime Node.js : ${hasBundledNode ? 'TERTANAM (runtime/node.exe)' : 'Memakai Node.js Komputer'}`);
    console.log('');
    console.log('  Untuk mengubah folder ini menjadi 1 file Setup-Absensi-Sekolah.exe:');
    console.log('  1. Install Inno Setup 6 (gratis) di Windows: https://jrsoftware.org/isdl.php');
    console.log('  2. Jalankan ulang build-installer.bat (atau klik kanan installer/AbsensiSekolah.iss -> Compile)');
    console.log('==============================================================\n');
  }
}

main().catch((err) => {
  console.error('[ERROR] Gagal membuat paket software:', err);
  process.exit(1);
});
