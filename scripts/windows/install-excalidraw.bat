@echo off
setlocal EnableExtensions
cd /d "%~dp0..\.."

echo ========================================
echo  Excalidraw - First-time installation
echo ========================================
echo.

echo [1/3] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install Node.js 18 or newer from https://nodejs.org/
    goto :failed
)
for /f "delims=" %%v in ('node -v') do echo       Found %%v

echo.
echo [2/3] Checking Yarn...
where yarn >nul 2>&1
if errorlevel 1 (
    echo       Yarn not found. Installing globally via npm...
    call npm install -g yarn
    if errorlevel 1 goto :failed
)
for /f "delims=" %%v in ('yarn -v') do echo       Found Yarn %%v

echo.
echo [3/3] Installing dependencies (may take several minutes)...
call yarn
if errorlevel 1 goto :failed

echo.
echo ========================================
echo  Installation complete!
echo  Run scripts\windows\run-excalidraw.bat to start.
echo ========================================
goto :end

:failed
echo.
echo Installation did not finish successfully.
exit /b 1

:end
pause
exit /b 0
