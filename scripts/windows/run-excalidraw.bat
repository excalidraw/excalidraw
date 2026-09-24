@echo off
setlocal EnableExtensions
cd /d "%~dp0..\.."

echo ========================================
echo  Excalidraw - Dev server
echo ========================================
echo.

if not exist "package.json" (
    echo ERROR: Run from excalidraw repo root. package.json not found.
    goto :failed
)

if not exist "node_modules" (
    echo ERROR: Dependencies are not installed.
    echo Run scripts\windows\install-excalidraw.bat first.
    goto :failed
)

where yarn >nul 2>&1
if errorlevel 1 (
    echo ERROR: Yarn is not installed.
    goto :failed
)

echo Starting Vite dev server...
echo   Default URL: http://localhost:3000
echo   Press Ctrl+C to stop.
echo.

call yarn start
if errorlevel 1 goto :failed
goto :end

:failed
echo.
echo Server exited with an error.
pause
exit /b 1

:end
pause
exit /b 0
