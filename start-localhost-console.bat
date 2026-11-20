@echo off
setlocal
title Sistem Absensi Sekolah - Localhost Console Mode
cd /d "%~dp0"

echo ==============================================================
echo   SISTEM ABSENSI SEKOLAH - MODE CONSOLE (LOG LANGSUNG)
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
echo [1/3] Menginstall dependensi npm...
call npm install
if not errorlevel 1 goto CHECK_BUILD
call npm install --legacy-peer-deps
if errorlevel 1 goto ERROR_EXIT

:CHECK_BUILD
if exist "dist\index.html" goto RUN_CONSOLE
echo [2/3] Membangun tampilan frontend produksi...
call npm run build
if errorlevel 1 goto ERROR_EXIT

:RUN_CONSOLE
if exist "dist-server\localhost-server.mjs" goto RUN_COMPILED
if "%~1"=="" goto RUN_TSX_DEFAULT
echo [3/3] Menjalankan server di jendela console port %~1...
"%NODE_BIN%" "node_modules\tsx\dist\cli.mjs" localhost-server.ts --port=%~1
goto END_CONSOLE

:RUN_TSX_DEFAULT
echo [3/3] Menjalankan server di jendela console sesuai port .env atau default 4500...
"%NODE_BIN%" "node_modules\tsx\dist\cli.mjs" localhost-server.ts
goto END_CONSOLE

:RUN_COMPILED
if "%~1"=="" goto RUN_COMPILED_DEFAULT
echo [3/3] Menjalankan server terkompilasi di jendela console port %~1...
"%NODE_BIN%" "dist-server\localhost-server.mjs" --port=%~1
goto END_CONSOLE

:RUN_COMPILED_DEFAULT
echo [3/3] Menjalankan server terkompilasi di jendela console sesuai port .env atau default 4500...
"%NODE_BIN%" "dist-server\localhost-server.mjs"

:END_CONSOLE
echo.
echo Server berhenti.
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js belum terinstall.
pause
exit /b 1

:ERROR_EXIT
echo [ERROR] Terjadi kegagalan saat persiapan.
pause
exit /b 1
