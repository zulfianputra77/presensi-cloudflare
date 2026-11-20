@echo off
setlocal
title Sistem Absensi Sekolah - Localhost Background Launcher
cd /d "%~dp0"

echo ==============================================================
echo   SISTEM ABSENSI SEKOLAH - LOCALHOST BACKGROUND LAUNCHER
echo ==============================================================
echo.

set "NODE_BIN=node"
if exist "runtime\node.exe" set "NODE_BIN=runtime\node.exe"
if exist "runtime\node.exe" goto CHECK_ENV

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

:CHECK_ENV
if exist ".env" goto CHECK_DEPS
if not exist ".env.localhost.example" goto CHECK_DEPS
copy /y ".env.localhost.example" ".env" >nul
echo [INFO] File .env dibuat otomatis dari .env.localhost.example

:CHECK_DEPS
if exist "dist-server\localhost-server.mjs" goto CHECK_BUILD
if exist "node_modules\tsx\dist\cli.mjs" goto CHECK_BUILD
echo [1/3] Menginstall seluruh komponen dependensi npm...
call npm install
if not errorlevel 1 goto CHECK_BUILD
echo [INFO] Mencoba install ulang dengan --legacy-peer-deps...
call npm install --legacy-peer-deps
if errorlevel 1 goto INSTALL_FAILED

:CHECK_BUILD
if exist "dist\index.html" goto START_DAEMON
echo [2/3] Membangun tampilan frontend produksi...
call npm run build
if errorlevel 1 goto BUILD_FAILED

:START_DAEMON
echo [3/3] Menyalakan server localhost di background...
if "%~1"=="" goto START_DEFAULT_PORT
"%NODE_BIN%" localhost-daemon.mjs start --port=%~1
if errorlevel 1 goto DAEMON_FAILED
goto START_SUCCESS

:START_DEFAULT_PORT
"%NODE_BIN%" localhost-daemon.mjs start
if errorlevel 1 goto DAEMON_FAILED

:START_SUCCESS
echo Server aktif di background. Jendela CMD akan tertutup otomatis...
timeout /t 2 /nobreak >nul
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js belum terinstall di komputer ini!
echo Silakan download dan install Node.js LTS dari https://nodejs.org
echo.
pause
exit /b 1

:INSTALL_FAILED
echo [ERROR] Gagal menginstall dependensi. Pastikan koneksi internet tersedia saat instalasi pertama.
echo.
pause
exit /b 1

:BUILD_FAILED
echo [ERROR] Gagal melakukan build frontend.
echo.
pause
exit /b 1

:DAEMON_FAILED
echo.
echo [ERROR] Server gagal dijalankan di background. Periksa pesan error di atas atau data\localhost-server.log.
echo.
pause
exit /b 1
