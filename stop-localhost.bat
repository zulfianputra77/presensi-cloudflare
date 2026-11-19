@echo off
setlocal
title Sistem Absensi Sekolah - Hentikan Localhost
cd /d "%~dp0"

echo ==============================================================
echo   MENGHENTIKAN SERVER LOCALHOST - SISTEM ABSENSI SEKOLAH
echo ==============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

node localhost-daemon.mjs stop
echo.
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js tidak ditemukan.
echo.
pause
exit /b 1
