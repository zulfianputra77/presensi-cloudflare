#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=============================================================="
echo "  SISTEM ABSENSI SEKOLAH - LOCALHOST LAUNCHER (LINUX/MAC)"
echo "=============================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js belum terinstall! Install Node.js 20/22 terlebih dahulu."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] Menginstall seluruh komponen dependensi npm..."
  npm install
fi

if [ ! -f "dist/index.html" ]; then
  echo "[2/3] Membangun tampilan frontend produksi..."
  npm run build
fi

if [ -n "$1" ]; then
  echo "[3/3] Menjalankan server localhost pada port $1..."
  npx tsx localhost-server.ts --port="$1"
else
  echo "[3/3] Menjalankan server localhost (port .env atau default 4500)..."
  npx tsx localhost-server.ts
fi
