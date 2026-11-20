@echo off
setlocal
title Sistem Absensi Sekolah - Hentikan Localhost
cd /d "%~dp0"

echo ==============================================================
echo   MENGHENTIKAN SERVER LOCALHOST - SISTEM ABSENSI SEKOLAH
echo ==============================================================
echo.

set "NODE_BIN=node"
if exist "runtime\node.exe" set "NODE_BIN=runtime\node.exe"
if exist "runtime\node.exe" goto STOP_NOW

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

:STOP_NOW
"%NODE_BIN%" localhost-daemon.mjs stop
echo.
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js tidak ditemukan.
echo.
pause
exit /b 1
