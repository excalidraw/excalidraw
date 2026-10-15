@echo off
REM Opens the collections folder in Windows Explorer.
REM Set path in app: Collections - Collections folder path - Save path
REM Or create .excalidraw-collections-path.txt in repo root (one line = full path).
setlocal
cd /d "%~dp0..\.."
set "CONFIG_FILE=%CD%\.excalidraw-collections-path.txt"
set "FOLDER="

if exist "%CONFIG_FILE%" (
  set /p FOLDER=<"%CONFIG_FILE%"
)

if "%FOLDER%"=="" (
  echo No folder path configured.
  echo In Excalidraw: Menu - Collections - set path - Save path.
  echo Or create %CONFIG_FILE% with one line: your folder path.
  pause
  exit /b 1
)

if not exist "%FOLDER%" (
  echo Folder does not exist: %FOLDER%
  pause
  exit /b 1
)

start "" explorer "%FOLDER%"
