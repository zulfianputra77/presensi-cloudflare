@echo off
setlocal
title Sistem Absensi Sekolah - Status Localhost
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

if "%~1"=="" goto STATUS_DEFAULT
node localhost-daemon.mjs status --port=%~1
goto DONE

:STATUS_DEFAULT
node localhost-daemon.mjs status

:DONE
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js tidak ditemukan.
echo.
pause
exit /b 1
