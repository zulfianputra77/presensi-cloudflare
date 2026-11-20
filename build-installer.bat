@echo off
setlocal
title Pembuat Installer Software - Sistem Absensi Sekolah
cd /d "%~dp0"

echo ==============================================================
echo   PEMBUAT INSTALLER SOFTWARE WINDOWS (SEPERTI DAPODIK/E-RAPOR)
echo ==============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

if exist "node_modules\esbuild\package.json" goto RUN_PACKAGER
echo [INFO] Menginstall dependensi build terlebih dahulu...
call npm install
if not errorlevel 1 goto RUN_PACKAGER
call npm install --legacy-peer-deps
if errorlevel 1 goto INSTALL_FAILED

:RUN_PACKAGER
node scripts/build-software-package.mjs %*
if errorlevel 1 goto PACK_FAILED

echo.
echo Proses selesai! Periksa folder "release\" untuk hasilnya.
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js belum terinstall di komputer pembuat installer ini!
echo Download Node.js LTS dari https://nodejs.org
echo.
pause
exit /b 1

:INSTALL_FAILED
echo [ERROR] Gagal menginstall dependensi npm.
echo.
pause
exit /b 1

:PACK_FAILED
echo [ERROR] Gagal memaketkan software. Periksa pesan error di atas.
echo.
pause
exit /b 1
