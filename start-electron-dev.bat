@echo off
echo ========================================
echo Excalidraw 桌面端 - 开发模式
echo ========================================
echo.

echo 检查依赖...
if not exist "node_modules" (
    echo 正在安装根目录依赖...
    call yarn install
    if errorlevel 1 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

if not exist "electron\node_modules" (
    echo 正在安装 Electron 依赖...
    call yarn electron:install
    if errorlevel 1 (
        echo Electron 依赖安装失败！
        pause
        exit /b 1
    )
)

echo.
echo 启动开发服务器和 Electron...
echo.
echo 提示：
echo - 开发服务器将在 http://localhost:3000 启动
echo - Electron 窗口会自动打开
echo - 按 Ctrl+C 停止
echo.

call yarn electron:dev
pause
