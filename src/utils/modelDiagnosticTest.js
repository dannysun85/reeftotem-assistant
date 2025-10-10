// 模型定位诊断测试脚本
// 用于验证模型定位诊断工具的功能

import { modelPositionDiagnostic } from './modelPositionDiagnostic';

// 测试函数
export function runModelDiagnosticTest() {
  console.log('🧪 开始运行模型定位诊断测试...');

  // 启用诊断
  modelPositionDiagnostic.setEnabled(true);

  // 模拟测试数据
  const testCases = [
    {
      name: '正常位置模型',
      data: {
        modelName: 'TestModel_Normal',
        windowWidth: 400,
        windowHeight: 500,
        modelBounds: { x: -100, y: -150, width: 200, height: 300 },
        canvasWidth: 400,
        canvasHeight: 500,
        modelMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        projectionMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        viewMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        timestamp: new Date().toISOString()
      }
    },
    {
      name: '画布外模型',
      data: {
        modelName: 'TestModel_Offscreen',
        windowWidth: 400,
        windowHeight: 500,
        modelBounds: { x: 500, y: 600, width: 200, height: 300 }, // 完全在画布外
        canvasWidth: 400,
        canvasHeight: 500,
        modelMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        projectionMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        viewMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        timestamp: new Date().toISOString()
      }
    },
    {
      name: '过小模型',
      data: {
        modelName: 'TestModel_TooSmall',
        windowWidth: 400,
        windowHeight: 500,
        modelBounds: { x: -1, y: -1, width: 2, height: 3 }, // 非常小
        canvasWidth: 400,
        canvasHeight: 500,
        modelMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        projectionMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        viewMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        timestamp: new Date().toISOString()
      }
    },
    {
      name: '窗口画布不匹配',
      data: {
        modelName: 'TestModel_SizeMismatch',
        windowWidth: 800, // 窗口尺寸与画布不匹配
        windowHeight: 600,
        modelBounds: { x: -100, y: -150, width: 200, height: 300 },
        canvasWidth: 400, // 画布尺寸
        canvasHeight: 500,
        modelMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        projectionMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        viewMatrix: Array(16).fill(0).map((_, i) => i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0),
        timestamp: new Date().toISOString()
      }
    }
  ];

  // 运行测试用例
  testCases.forEach((testCase, index) => {
    console.log(`\n📋 测试用例 ${index + 1}: ${testCase.name}`);

    // 创建模拟模型对象
    const mockModel = {
      getModel: () => ({
        getCanvasWidth: () => testCase.data.canvasWidth,
        getCanvasHeight: () => testCase.data.canvasHeight
      })
    };

    // 创建模拟画布
    const mockCanvas = {
      width: testCase.data.canvasWidth,
      height: testCase.data.canvasHeight
    };

    // 记录测试数据
    modelPositionDiagnostic.recordModelPosition(
      testCase.data.modelName,
      mockModel,
      mockCanvas,
      testCase.data.projectionMatrix,
      testCase.data.viewMatrix
    );
  });

  // 生成测试报告
  console.log('\n📊 生成测试报告...');
  const report = modelPositionDiagnostic.generateReport();
  console.log(report);

  // 导出JSON数据
  console.log('\n💾 导出JSON数据...');
  const jsonData = modelPositionDiagnostic.exportToJSON();
  console.log(jsonData);

  console.log('\n✅ 模型定位诊断测试完成！');

  return {
    report,
    jsonData: JSON.parse(jsonData)
  };
}

// 在浏览器环境中自动运行测试
if (typeof window !== 'undefined') {
  // 延迟运行测试，确保Live2D系统已加载
  setTimeout(() => {
    console.log('🔧 自动运行模型定位诊断测试...');
    try {
      runModelDiagnosticTest();
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
    }
  }, 3000);
}

export default runModelDiagnosticTest;