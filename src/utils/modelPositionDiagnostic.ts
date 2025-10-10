// 模型定位诊断工具
// 用于诊断Live2D模型加载后的位置和窗口状态问题

export interface ModelPositionInfo {
  modelName: string;
  windowWidth: number;
  windowHeight: number;
  modelBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  modelMatrix: number[];
  projectionMatrix: number[];
  viewMatrix: number[];
  timestamp: string;
}

export interface WindowInfo {
  width: number;
  height: number;
  x: number;
  y: number;
  isVisible: boolean;
  isFocused: boolean;
  scaleFactor: number;
}

class ModelPositionDiagnostic {
  private diagnosticData: ModelPositionInfo[] = [];
  private isEnabled: boolean = false;
  private logCallback?: ((message: string) => void) | null;

  constructor() {
    this.isEnabled = true;
  }

  // 设置日志回调函数
  setLogCallback(callback: (message: string) => void): void {
    this.logCallback = callback;
  }

  // 启用/禁用诊断
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.log(`模型定位诊断已${enabled ? '启用' : '禁用'}`);
  }

  // 记录诊断信息
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [模型定位诊断] ${message}`;

    console.log(formattedMessage);

    if (this.logCallback) {
      this.logCallback(formattedMessage);
    }
  }

  // 获取窗口信息
  async getWindowInfo(): Promise<WindowInfo | null> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        // 使用 @tauri-apps/api 替代 window.__TAURI__
        const { invoke } = await import('@tauri-apps/api/core');
        const windowInfo = await invoke<WindowInfo>('get_window_info');
        this.log(`获取窗口信息成功: ${JSON.stringify(windowInfo)}`);
        return windowInfo;
      } else {
        this.log('Tauri API不可用，使用浏览器窗口信息');
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          x: 0,
          y: 0,
          isVisible: true,
          isFocused: document.hasFocus(),
          scaleFactor: window.devicePixelRatio || 1
        };
      }
    } catch (error) {
      this.log(`获取窗口信息失败: ${error}`);
      return null;
    }
  }

  // 记录模型位置信息
  recordModelPosition(
    modelName: string,
    model: any,
    canvas: HTMLCanvasElement,
    projectionMatrix: number[],
    viewMatrix: number[]
  ): void {
    if (!this.isEnabled || !model) {
      return;
    }

    try {
      this.log(`开始记录模型位置信息: ${modelName}`);

      // 获取模型边界框
      const modelBounds = this.getModelBounds(model);

      // 获取模型矩阵
      const modelMatrix = this.getModelMatrix(model);

      const positionInfo: ModelPositionInfo = {
        modelName,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        modelBounds,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        modelMatrix,
        projectionMatrix,
        viewMatrix,
        timestamp: new Date().toISOString()
      };

      this.diagnosticData.push(positionInfo);

      this.log(`模型位置信息已记录:
        - 模型名称: ${modelName}
        - 窗口尺寸: ${positionInfo.windowWidth}x${positionInfo.windowHeight}
        - 画布尺寸: ${positionInfo.canvasWidth}x${positionInfo.canvasHeight}
        - 模型边界: (${positionInfo.modelBounds.x}, ${positionInfo.modelBounds.y}) ${positionInfo.modelBounds.width}x${positionInfo.modelBounds.height}
        - 模型矩阵: [${modelMatrix.slice(0, 4).join(', ')}...]
        - 时间戳: ${positionInfo.timestamp}
      `);

      // 分析位置问题
      this.analyzePositionIssues(positionInfo);

    } catch (error) {
      this.log(`记录模型位置信息失败: ${error}`);
    }
  }

  // 获取模型边界框
  private getModelBounds(model: any): { x: number; y: number; width: number; height: number } {
    try {
      // 尝试从Live2D模型获取边界框
      const live2DModel = model.getModel();
      if (!live2DModel) {
        this.log('无法获取Live2D模型实例');
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      // 获取模型尺寸信息
      const canvasWidth = live2DModel.getCanvasWidth();
      const canvasHeight = live2DModel.getCanvasHeight();

      this.log(`Live2D模型画布尺寸: ${canvasWidth}x${canvasHeight}`);

      // 计算模型在标准化坐标系中的边界框
      const modelWidth = canvasWidth;
      const modelHeight = canvasHeight;
      const modelX = -modelWidth / 2;
      const modelY = -modelHeight / 2;

      return {
        x: modelX,
        y: modelY,
        width: modelWidth,
        height: modelHeight
      };
    } catch (error) {
      this.log(`获取模型边界框失败: ${error}`);
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  // 获取模型矩阵
  private getModelMatrix(model: any): number[] {
    try {
      const modelMatrix = model.getModelMatrix();
      if (modelMatrix && modelMatrix.getArray) {
        return modelMatrix.getArray();
      }
      return Array(16).fill(0);
    } catch (error) {
      this.log(`获取模型矩阵失败: ${error}`);
      return Array(16).fill(0);
    }
  }

  // 分析位置问题
  private analyzePositionIssues(positionInfo: ModelPositionInfo): void {
    this.log('开始分析模型位置问题...');

    const issues: string[] = [];

    // 检查1: 模型是否在画布范围内
    const canvas = {
      left: -positionInfo.canvasWidth / 2,
      right: positionInfo.canvasWidth / 2,
      top: -positionInfo.canvasHeight / 2,
      bottom: positionInfo.canvasHeight / 2
    };

    const model = {
      left: positionInfo.modelBounds.x,
      right: positionInfo.modelBounds.x + positionInfo.modelBounds.width,
      top: positionInfo.modelBounds.y,
      bottom: positionInfo.modelBounds.y + positionInfo.modelBounds.height
    };

    // 检查模型是否完全在画布外
    if (model.right < canvas.left || model.left > canvas.right ||
        model.bottom < canvas.top || model.top > canvas.bottom) {
      issues.push(`模型完全在画布范围外！模型边界: (${model.left.toFixed(2)}, ${model.top.toFixed(2)}) - (${model.right.toFixed(2)}, ${model.bottom.toFixed(2)})，画布边界: (${canvas.left.toFixed(2)}, ${canvas.top.toFixed(2)}) - (${canvas.right.toFixed(2)}, ${canvas.bottom.toFixed(2)})`);
    }

    // 检查2: 窗口与画布尺寸匹配
    if (Math.abs(positionInfo.windowWidth - positionInfo.canvasWidth) > 10 ||
        Math.abs(positionInfo.windowHeight - positionInfo.canvasHeight) > 10) {
      issues.push(`窗口尺寸与画布尺寸不匹配！窗口: ${positionInfo.windowWidth}x${positionInfo.windowHeight}, 画布: ${positionInfo.canvasWidth}x${positionInfo.canvasHeight}`);
    }

    // 检查3: 模型尺寸是否合理
    if (positionInfo.modelBounds.width <= 0 || positionInfo.modelBounds.height <= 0) {
      issues.push(`模型尺寸异常！宽度: ${positionInfo.modelBounds.width}, 高度: ${positionInfo.modelBounds.height}`);
    }

    // 检查4: 模型是否过小或过大
    const modelArea = positionInfo.modelBounds.width * positionInfo.modelBounds.height;
    const canvasArea = positionInfo.canvasWidth * positionInfo.canvasHeight;
    const modelRatio = modelArea / canvasArea;

    if (modelRatio < 0.01) {
      issues.push(`模型相对于画布过小！模型面积占比: ${(modelRatio * 100).toFixed(2)}%`);
    } else if (modelRatio > 2.0) {
      issues.push(`模型相对于画布过大！模型面积占比: ${(modelRatio * 100).toFixed(2)}%`);
    }

    // 检查5: 矩阵变换是否正确
    const hasInvalidMatrixValues = positionInfo.modelMatrix.some(val => isNaN(val) || !isFinite(val));
    if (hasInvalidMatrixValues) {
      issues.push('模型矩阵包含无效值(NaN或Infinity)');
    }

    // 输出分析结果
    if (issues.length > 0) {
      this.log(`🚨 发现 ${issues.length} 个位置问题:`);
      issues.forEach((issue, index) => {
        this.log(`  ${index + 1}. ${issue}`);
      });
    } else {
      this.log(`✅ 未发现明显的位置问题`);
    }
  }

  // 获取所有诊断数据
  getDiagnosticData(): ModelPositionInfo[] {
    return [...this.diagnosticData];
  }

  // 清除诊断数据
  clearDiagnosticData(): void {
    this.diagnosticData = [];
    this.log('诊断数据已清除');
  }

  // 生成诊断报告
  generateReport(): string {
    if (this.diagnosticData.length === 0) {
      return '暂无诊断数据';
    }

    let report = `=== Live2D模型定位诊断报告 ===\n`;
    report += `生成时间: ${new Date().toISOString()}\n`;
    report += `诊断记录数量: ${this.diagnosticData.length}\n\n`;

    this.diagnosticData.forEach((data, index) => {
      report += `--- 记录 ${index + 1}: ${data.modelName} ---\n`;
      report += `时间: ${data.timestamp}\n`;
      report += `窗口尺寸: ${data.windowWidth}x${data.windowHeight}\n`;
      report += `画布尺寸: ${data.canvasWidth}x${data.canvasHeight}\n`;
      report += `模型边界: (${data.modelBounds.x.toFixed(2)}, ${data.modelBounds.y.toFixed(2)}) ${data.modelBounds.width.toFixed(2)}x${data.modelBounds.height.toFixed(2)}\n`;
      report += `模型矩阵前4个值: [${data.modelMatrix.slice(0, 4).map(v => v.toFixed(4)).join(', ')}]\n\n`;
    });

    return report;
  }

  // 导出诊断数据为JSON
  exportToJSON(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      recordCount: this.diagnosticData.length,
      data: this.diagnosticData
    }, null, 2);
  }
}

// 创建全局诊断实例
export const modelPositionDiagnostic = new ModelPositionDiagnostic();

// 导出类型和工具函数
export default ModelPositionDiagnostic;