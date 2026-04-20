@echo off
:: Always run from the folder where this script lives (project root)
cd /d "%~dp0"

title NEXOR ERP - Build Installer (FAST)
color 0A

echo.
echo ========================================
echo    NEXOR ERP - FAST PORTABLE BUILD
echo ========================================
echo.
echo [INFO] Running from: %cd%
echo.

:: Check Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)
echo [OK] Node.js: 
node --version
echo.

if not exist "package.json" (
    echo [ERROR] package.json not found!
    pause
    exit /b 1
)

:: ---------- [1/4] Frontend deps (skip if node_modules exists) ----------
if exist "node_modules\.package-lock.json" (
    echo [1/4] Frontend dependencies already installed - SKIPPING
) else (
    echo [1/4] Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 ( echo [ERROR] npm install failed & pause & exit /b 1 )
)
echo.

:: ---------- [2/4] Backend deps (skip if dotenv present) ----------
if exist "backend\node_modules\dotenv\package.json" (
    echo [2/4] Backend dependencies already installed - SKIPPING
) else (
    echo [2/4] Installing backend dependencies...
    call npm --prefix backend install --omit=dev
    if %errorlevel% neq 0 ( echo [ERROR] backend install failed & pause & exit /b 1 )
    if not exist "backend\node_modules\dotenv\package.json" (
        echo [ERROR] backend dotenv missing after install. Aborting.
        pause
        exit /b 1
    )
)
echo.

:: ---------- [3/4] Build web app ----------
echo [3/4] Building web application (Vite)...
call npm run build
if %errorlevel% neq 0 ( echo [ERROR] Vite build failed & pause & exit /b 1 )
echo.

:: ---------- [4/4] Package PORTABLE only (no NSIS, no toolchain download) ----------
echo [4/4] Packaging Windows PORTABLE executable...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
call npx electron-builder --win portable --publish never -c.win.signAndEditExecutable=false
if %errorlevel% neq 0 ( echo [ERROR] electron-builder failed & pause & exit /b 1 )

echo.
echo ========================================
echo    BUILD COMPLETE!
echo ========================================
echo.
echo Output in "release" folder:
dir /b release\*.exe 2>nul
echo.
echo Run the Portable .exe directly - no install needed.
echo.
start "" "release"
pause
