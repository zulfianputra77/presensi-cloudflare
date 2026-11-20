@echo off
setlocal
title Sistem Absensi Sekolah - Status Localhost
cd /d "%~dp0"

set "NODE_BIN=node"
if exist "runtime\node.exe" set "NODE_BIN=runtime\node.exe"
if exist "runtime\node.exe" goto CHECK_PORT

where node >nul 2>nul
if errorlevel 1 goto NODE_NOT_FOUND

:CHECK_PORT
if "%~1"=="" goto STATUS_DEFAULT
"%NODE_BIN%" localhost-daemon.mjs status --port=%~1
goto DONE

:STATUS_DEFAULT
"%NODE_BIN%" localhost-daemon.mjs status

:DONE
pause
exit /b 0

:NODE_NOT_FOUND
echo [ERROR] Node.js tidak ditemukan.
echo.
pause
exit /b 1
