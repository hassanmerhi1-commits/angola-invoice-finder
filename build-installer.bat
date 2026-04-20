@echo off
:: Always run from the folder where this script lives (project root)
cd /d "%~dp0"

title NEXOR ERP - Build Installer
color 0A

echo.
echo ========================================
echo    KWANZA ERP - BUILD INSTALLER
echo ========================================
echo.

echo [INFO] Running from: %cd%
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

:: Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Please run this script from the project root folder.
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/5] Installing Electron (dev dependencies)...
call npm install --save-dev electron electron-builder electron-squirrel-startup
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Electron
    pause
    exit /b 1
)

echo.
echo [3/5] Installing backend dependencies...
call npm --prefix backend install --omit=dev
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

:: Verify dotenv landed (the dependency that previously broke the installer)
if not exist "backend\node_modules\dotenv\package.json" (
    echo [ERROR] backend\node_modules\dotenv is missing after install.
    echo The installer would ship a broken backend. Aborting.
    pause
    exit /b 1
)

echo.
echo [4/6] Building web application...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build web app
    pause
    exit /b 1
)

echo.
echo [5/6] Building Windows installer...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
call npx electron-builder --win -c.win.signAndEditExecutable=false
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build installer
    pause
    exit /b 1
)

echo.
echo ========================================
echo    BUILD COMPLETE!
echo ========================================
echo.
echo Your installers are in the "release" folder:
echo.
dir /b release\*.exe 2>nul
echo.
echo - .exe installer: Double-click to install
echo - Portable .exe: Run directly, no install needed
echo.

:: Open release folder
start "" "release"

pause
