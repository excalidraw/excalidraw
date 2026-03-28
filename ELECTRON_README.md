# Excalidraw 桌面端应用

将 Excalidraw 打包为桌面端应用，解决浏览器 Canvas 限制并提升性能。

## 优势

✅ **解决浏览器 Canvas 限制**：
- 禁用同源策略，支持本地文件和图片直接加载
- 更高的内存限制和更好的资源管理
- 更好的 GPU 加速支持

✅ **性能优化**：
- Canvas 进程外光栅化（OOP Rasterization）
- WebGPU 支持
- 禁用 GPU vsync 以获得更高帧率
- 后台不限制渲染性能

✅ **原生体验**：
- 桌面应用菜单和快捷键
- 全屏模式支持
- 更好的窗口管理

## 安装步骤

### 1. 安装根目录依赖（如果还没安装）
```bash
yarn install
```

### 2. 安装 Electron 依赖
```bash
yarn electron:install
```

## 使用方式

### 开发模式
同时启动开发服务器和 Electron：
```bash
yarn electron:dev
```

或者手动分步：
```bash
# 终端 1 - 启动开发服务器
yarn start

# 终端 2 - 等待服务器启动后运行 Electron
cd electron
yarn dev
```

### 生产构建

#### 构建所有平台
```bash
yarn electron:build
```

#### Windows 平台
```bash
yarn electron:build:win
```

#### macOS 平台
```bash
yarn electron:build:mac
```

#### Linux 平台
```bash
yarn electron:build:linux
```

构建产物将输出到 `dist-electron/` 目录。

## 性能优化说明

### Canvas 相关优化

主进程中已启用以下优化（`electron/main.js`）：

```javascript
// Canvas 进程外光栅化
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');

// 启用不安全的 WebGPU（用于实验性功能）
app.commandLine.appendSwitch('enable-unsafe-webgpu');

// 禁用 GPU vsync 以获得更高帧率
app.commandLine.appendSwitch('disable-gpu-vsync');
```

### WebPreferences 配置

```javascript
webPreferences: {
  webSecurity: false,              // 禁用同源策略
  hardwareAcceleration: true,      // 启用硬件加速
  experimentalFeatures: true,      // 启用实验性功能
  disableBlinkFeatures: 'CacheStorage', // 禁用缓存存储
}
```

### 进一步优化建议

如果需要进一步优化，可以考虑：

1. **使用离屏 Canvas**：在渲染大量元素时使用离屏 Canvas
2. **Web Workers**：将复杂计算移到 Web Workers
3. **虚拟滚动**：对于非常大的画布，实现虚拟滚动/视口裁剪
4. **WebAssembly**：关键路径使用 WASM 优化

## 菜单快捷键

| 功能 | 快捷键 |
|------|--------|
| 新建 | Ctrl/Cmd + N |
| 打开 | Ctrl/Cmd + O |
| 保存 | Ctrl/Cmd + S |
| 导出图片 | Ctrl/Cmd + Shift + S |
| 放大 | Ctrl/Cmd + + |
| 缩小 | Ctrl/Cmd + - |
| 重置缩放 | Ctrl/Cmd + 0 |
| 全屏 | F11 |
| 开发者工具 | F12 |

## 故障排除

### Canvas 性能问题
- 确保 `hardwareAcceleration` 为 true
- 检查 `chrome://gpu`（在 Electron 中按 F12，然后在 Console 输入 `chrome://gpu`）
- 尝试不同的 GPU 驱动程序

### 内存占用过高
- Electron 应用本身会有一些基础内存开销
- 使用 `process.memoryUsage()` 监控应用内存
- 考虑实现画布元素的懒加载和释放

### 构建失败
- 确保已安装所有依赖
- 检查 Node.js 版本（需要 >= 18）
- 尝试清理 `node_modules` 并重新安装

## 与浏览器版本的差异

| 特性 | 浏览器版 | 桌面版 |
|------|----------|--------|
| Canvas 同源限制 | 有 | 无 |
| 内存限制 | 浏览器限制 | 更高 |
| GPU 加速 | 取决于浏览器 | 优化配置 |
| 离线使用 | 需 PWA | 完全支持 |
| 文件系统访问 | 受限 | 原生支持 |
| 系统集成 | 有限 | 完整 |

## 下一步

- 配置自动更新机制
- 添加系统托盘图标
- 实现文件关联（双击 .excalidraw 文件打开）
- 添加更多原生功能（如打印、系统主题集成等）
