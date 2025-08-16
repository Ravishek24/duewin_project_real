@echo off
chcp 65001 >nul
title Manual Attendance Cron Trigger

echo 🚀 Manual Attendance Cron Trigger Script
echo =====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.

REM Navigate to Backend directory
cd /d "%~dp0.."
echo 📁 Working directory: %CD%
echo.

REM Check if manual script exists
if not exist "scripts\manual-attendance-cron.js" (
    echo ❌ Manual attendance script not found
    pause
    exit /b 1
)

echo 📜 Found manual script
echo.

echo Available options:
echo   Default: Process today's attendance
echo   --date=YYYY-MM-DD: Process specific date
echo   --force: Force processing even if already processed
echo.

REM Ask for options
set /p "useForce=Force processing? (y/N): "
set /p "useDate=Process specific date? (YYYY-MM-DD or press Enter for today): "

REM Build command
set "command=node scripts\manual-attendance-cron.js"
if /i "%useForce%"=="y" set "command=%command% --force"
if "%useDate%" neq "" (
    echo %useDate% | findstr /r "^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$" >nul
    if %errorlevel% equ 0 set "command=%command% --date=%useDate%"
)

echo.
echo 🚀 Running command: %command%
echo.

REM Execute the command
%command%

if %errorlevel% equ 0 (
    echo.
    echo ✅ Script execution completed!
) else (
    echo.
    echo ❌ Script execution failed!
)

echo.
pause
