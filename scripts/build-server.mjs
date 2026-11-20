/**
 * Build localhost-server.ts menjadi bundle pure JavaScript ESM (dist-server/localhost-server.mjs)
 * sehingga software terinstall bisa langsung jalan memakai node.exe tanpa memerlukan tsx / typescript.
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

export async function buildLocalhostServerBundle() {
  const outDir = path.resolve(ROOT, 'dist-server');
  const outFile = path.resolve(outDir, 'localhost-server.mjs');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await build({
    entryPoints: [path.resolve(ROOT, 'localhost-server.ts')],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });

  return outFile;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  buildLocalhostServerBundle()
    .then((outFile) => {
      console.log(`[OK] Bundle server selesai: ${outFile}`);
    })
    .catch((err) => {
      console.error('[ERROR] Gagal build bundle server:', err);
      process.exit(1);
    });
}
