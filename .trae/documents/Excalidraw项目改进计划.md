# Excalidraw PDF导出功能改进计划

## 一、技术可行性分析结论

经过系统性分析，添加PDF导出功能在技术上是可行的，推荐使用jsPDF库将canvas转换为PDF，主要基于以下考虑：

1. **架构兼容性**：现有架构支持添加新的导出格式，可通过扩展现有export函数实现
2. **开发复杂度**：利用现有导出基础设施，开发复杂度最低
3. **性能影响**：PDF生成只是导出时的一次性操作，对整体性能影响较小
4. **风险可控**：jsPDF是成熟的PDF生成库，浏览器兼容性良好

## 二、改进计划

### 1. 安装依赖
```bash
yarn add jspdf
```

### 2. 添加PDF导出功能

#### 2.1 在`packages/excalidraw/scene/export.ts`中添加`exportToPdf`函数
```typescript
export const exportToPdf = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  opts: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    exportingFrame?: ExcalidrawFrameLikeElement | null;
  }
) => {
  // 首先将场景渲染到canvas
  const canvas = await exportToCanvas(elements, appState, files, opts);

  // 使用jsPDF将canvas转换为PDF
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height]
  });

  // 将canvas添加到PDF
  const imgData = canvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

  return pdf;
};
```

#### 2.2 更新导出对话框组件
在`packages/excalidraw/components/ExportDialog.tsx`中添加PDF导出选项

#### 2.3 添加i18n字符串
在所有语言文件中添加PDF导出相关的翻译

#### 2.4 更新导出功能管理器
在`packages/excalidraw/actions/actionExport.tsx`中添加PDF导出支持

### 3. 测试

1. 单元测试：为新添加的`exportToPdf`函数编写测试用例
2. 集成测试：测试完整的PDF导出流程
3. 手动测试：在不同浏览器中测试PDF导出功能

## 三、预期效果

1. 用户可以在导出对话框中选择PDF格式
2. 导出的PDF保持原有手绘风格和质量
3. 支持深色/浅色模式导出
4. 支持框架导出
5. 保持与现有导出功能的一致性

## 四、风险控制

1. **库大小增加**：jsPDF库大小约为1MB，会增加包体积
2. **浏览器兼容性**：确保在所有支持的浏览器中测试
3. **PDF输出质量**：优化canvas到PDF的转换参数
4. **大型场景**：添加内存使用监控和优化

## 五、执行时间

预计开发时间：2-3天
预计测试时间：1天
预计文档更新时间：半天