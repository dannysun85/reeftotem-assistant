/**
 * Live2D系统诊断工具 (TypeScript版本)
 * 统一的Live2D系统状态检查和调试工具
 */

import { LAppDelegate } from '../lib/live2d/src/lappdelegate';

console.log('🔍 Live2D诊断工具已加载...');

// 延迟检查，等待系统完全初始化
setTimeout(() => {
    runCompleteDiagnosis();
}, 3000);

/**
 * 运行完整的Live2D诊断
 */
function runCompleteDiagnosis(): void {
    console.log('\n🚀 === Live2D系统完整诊断开始 ===');

    // 1. 基础环境检查
    checkBasicEnvironment();

    // 2. Live2D Core检查
    checkLive2DCore();

    // 3. LAppDelegate检查
    checkLAppDelegate();

    // 4. 模型状态检查
    checkModelStatus();

    // 5. 参数系统检查
    checkParameterSystem();

    // 6. 功能测试
    testBasicFunctions();

    console.log('\n✅ === Live2D系统完整诊断完成 ===');
    console.log('💡 如需重新诊断，请运行: window.runDiagnosis()');
}

/**
 * 检查基础环境
 */
function checkBasicEnvironment(): void {
    console.log('\n📋 1. 基础环境检查:');

    console.log(`  - 浏览器: ${navigator.userAgent}`);
    console.log(`  - 当前URL: ${window.location.href}`);
    console.log(`  - DOM就绪: ${document.readyState}`);
    console.log(`  - Canvas存在: ${!!document.querySelector('canvas')}`);

    const canvases = document.querySelectorAll('canvas');
    console.log(`  - Canvas数量: ${canvases.length}`);

    if (canvases.length > 0) {
        const canvas = canvases[0];
        console.log(`  - 主Canvas尺寸: ${canvas.width}x${canvas.height}`);
        console.log(`  - Canvas可见: ${isElementVisible(canvas)}`);
    }
}

/**
 * 检查Live2D Core
 */
function checkLive2DCore(): void {
    console.log('\n📋 2. Live2D Core检查:');

    try {
        if (typeof window !== 'undefined') {
            // 检查不同的可能的全局变量名
            const coreVars = ['Live2DCubismCore', 'LIVE2DCUBISM_CORE', 'Live2DCore'];
            let coreFound = false;

            coreVars.forEach(varName => {
                if ((window as any)[varName]) {
                    console.log(`✅ 找到Live2D Core: ${varName}`);
                    console.log(`  - 类型: ${typeof (window as any)[varName]}`);

                    if (typeof (window as any)[varName].csmGetVersion === 'function') {
                        const version = (window as any)[varName].csmGetVersion();
                        console.log(`  - 版本: ${version}`);
                    }

                    coreFound = true;
                }
            });

            if (!coreFound) {
                console.error('❌ 未找到Live2D Core');

                // 尝试检查脚本是否已加载
                const scripts = document.querySelectorAll('script');
                let coreScriptLoaded = false;
                scripts.forEach(script => {
                    if ((script as HTMLScriptElement).src && (script as HTMLScriptElement).src.includes('live2dcubismcore')) {
                        console.log(`📦 Core脚本已加载: ${(script as HTMLScriptElement).src}`);
                        coreScriptLoaded = true;
                    }
                });

                if (!coreScriptLoaded) {
                    console.error('❌ Core脚本未加载');
                }
            }
        }
    } catch (error) {
        console.error('❌ 检查Live2D Core时出错:', error);
    }
}

/**
 * 检查LAppDelegate
 */
function checkLAppDelegate(): void {
    console.log('\n📋 3. LAppDelegate检查:');

    try {
        if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
            console.log('✅ LAppDelegate已全局暴露');

            // 测试获取实例
            const appDelegate = (window as any).LAppDelegate.getInstance();
            if (appDelegate) {
                console.log('✅ LAppDelegate实例获取成功');

                // 检查方法
                const methods = [
                    'getSubdelegate',
                    'initialize',
                    'release',
                    'getView'
                ];

                methods.forEach(method => {
                    console.log(`  - ${method}: ${typeof appDelegate[method]}`);
                });

                // 检查Subdelegate
                try {
                    const subdelegate = appDelegate.getSubdelegate();
                    if (subdelegate) {
                        console.log(`✅ Subdelegate获取成功`);

                        if (subdelegate.getSize) {
                            const count = subdelegate.getSize();
                            console.log(`  - Subdelegate数量: ${count}`);

                            if (count > 0 && subdelegate.at) {
                                const firstSub = subdelegate.at(0);
                                if (firstSub) {
                                    console.log('✅ 第一个Subdelegate可用');

                                    // 检查Live2D Manager
                                    if (firstSub.getLive2DManager) {
                                        const manager = firstSub.getLive2DManager();
                                        if (manager) {
                                            console.log('✅ Live2D Manager可用');
                                        } else {
                                            console.warn('⚠️ Live2D Manager为空');
                                        }
                                    } else {
                                        console.warn('⚠️ Subdelegate没有getLive2DManager方法');
                                    }
                                }
                            }
                        }
                    } else {
                        console.warn('⚠️ Subdelegate为空');
                    }
                } catch (e) {
                    console.error('❌ Subdelegate检查失败:', e);
                }
            } else {
                console.error('❌ 无法获取LAppDelegate实例');
            }
        } else {
            console.error('❌ LAppDelegate未全局暴露');
        }
    } catch (error) {
        console.error('❌ 检查LAppDelegate时出错:', error);
    }
}

/**
 * 检查模型状态
 */
function checkModelStatus(): void {
    console.log('\n📋 4. 模型状态检查:');

    try {
        if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
            const appDelegate = (window as any).LAppDelegate.getInstance();
            if (appDelegate) {
                const subdelegate = appDelegate.getSubdelegate().at(0);
                if (subdelegate) {
                    const live2dManager = subdelegate.getLive2DManager();
                    if (live2dManager && live2dManager._models && live2dManager._models.getSize() > 0) {
                        const model = live2dManager._models.at(0);
                        if (model) {
                            console.log('✅ 第一个模型可用');

                            // 检查模型Core
                            const coreModel = model.getModel();
                            if (coreModel) {
                                console.log('✅ 模型Core已加载');

                                if (typeof coreModel.getParameterCount === 'function') {
                                    const paramCount = coreModel.getParameterCount();
                                    console.log(`✅ 模型参数数量: ${paramCount}`);

                                    // 尝试获取模型信息
                                    try {
                                        const canvasInfo = coreModel.getCanvasInfo();
                                        if (canvasInfo) {
                                            console.log(`  - 画布信息:`, canvasInfo);
                                        }
                                    } catch (e) {
                                        console.log('  - 无法获取画布信息');
                                    }
                                } else {
                                    console.warn('⚠️ getParameterCount方法不可用');
                                }
                            } else {
                                console.error('❌ 模型Core未加载');
                            }
                        } else {
                            console.error('❌ 无法获取第一个模型');
                        }
                    } else {
                        console.warn('⚠️ 没有已加载的模型');
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 检查模型状态时出错:', error);
    }
}

/**
 * 检查参数系统
 */
function checkParameterSystem(): void {
    console.log('\n📋 5. 参数系统检查:');

    try {
        if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
            const appDelegate = (window as any).LAppDelegate.getInstance();
            if (appDelegate) {
                const subdelegate = appDelegate.getSubdelegate().at(0);
                if (subdelegate) {
                    const live2dManager = subdelegate.getLive2DManager();
                    if (live2dManager && live2dManager._models && live2dManager._models.getSize() > 0) {
                        const model = live2dManager._models.at(0);
                        if (model && model.getModel) {
                            const coreModel = model.getModel();
                            if (coreModel && typeof coreModel.getParameterCount === 'function') {
                                const paramCount = coreModel.getParameterCount();

                                if (paramCount > 0) {
                                    console.log(`📊 检查前${Math.min(5, paramCount)}个参数:`);

                                    for (let i = 0; i < Math.min(5, paramCount); i++) {
                                        try {
                                            const paramId = coreModel.getParameterId(i);
                                            const defaultValue = coreModel.getParameterDefaultValue(i);
                                            const maxValue = coreModel.getParameterMaximumValue(i);
                                            const minValue = coreModel.getParameterMinimumValue(i);
                                            let currentValue;
                                            try {
                                                currentValue = coreModel.getParameterValueByIndex(i);
                                            } catch (e) {
                                                currentValue = coreModel.getParameterValue(i);
                                            }

                                            console.log(`  参数${i}:`);
                                            console.log(`    ID: ${paramId}`);
                                            console.log(`    当前值: ${currentValue?.toFixed(3) || 'N/A'}`);
                                            console.log(`    默认值: ${defaultValue?.toFixed(3) || 'N/A'}`);
                                            console.log(`    范围: [${minValue?.toFixed(3) || 'N/A'}, ${maxValue?.toFixed(3) || 'N/A'}]`);

                                            // 尝试识别参数类型
                                            const range = maxValue - minValue;
                                            const paramType = identifyParameterType(i, defaultValue, minValue, maxValue, range);
                                            if (paramType) {
                                                console.log(`    推测类型: ${paramType}`);
                                            }
                                        } catch (e: any) {
                                            console.warn(`    ❌ 无法读取参数${i}:`, e.message);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 检查参数系统时出错:', error);
    }
}

/**
 * 测试基础功能
 */
function testBasicFunctions(): void {
    console.log('\n📋 6. 基础功能测试:');

    try {
        if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
            const appDelegate = (window as any).LAppDelegate.getInstance();
            if (appDelegate) {
                const subdelegate = appDelegate.getSubdelegate().at(0);
                if (subdelegate) {
                    const live2dManager = subdelegate.getLive2DManager();
                    if (live2dManager && live2dManager._models && live2dManager._models.getSize() > 0) {
                        const model = live2dManager._models.at(0);
                        if (model && model.getModel) {
                            const coreModel = model.getModel();
                            if (coreModel && typeof coreModel.getParameterCount === 'function') {
                                const paramCount = coreModel.getParameterCount();

                                if (paramCount > 0) {
                                    console.log('🧪 测试参数设置:');

                                    // 尝试设置第一个参数
                                    try {
                                        let originalValue;
                                        try {
                                            originalValue = coreModel.getParameterValueByIndex(0);
                                        } catch (e) {
                                            originalValue = coreModel.getParameterValue(0);
                                        }
                                        console.log(`  - 参数0原始值: ${originalValue?.toFixed(3) || 'N/A'}`);

                                        // 尝试设置一个新值
                                        coreModel.setParameterValueByIndex(0, 0.5);
                                        let newValue;
                                        try {
                                            newValue = coreModel.getParameterValueByIndex(0);
                                        } catch (e) {
                                            newValue = coreModel.getParameterValue(0);
                                        }
                                        console.log(`  - 参数0新值: ${newValue?.toFixed(3) || 'N/A'}`);

                                        // 恢复原始值
                                        coreModel.setParameterValueByIndex(0, originalValue);
                                        console.log('✅ 参数设置功能正常');
                                    } catch (e: any) {
                                        console.error('❌ 参数设置功能异常:', e.message);
                                    }

                                    // 检查其他重要方法
                                    const methods = [
                                        'getParameterId',
                                        'getParameterValueByIndex',
                                        'getParameterValue',
                                        'setParameterValueByIndex',
                                        'setParameterValueById'
                                    ];

                                    methods.forEach(method => {
                                        console.log(`  - ${method}: ${typeof coreModel[method]}`);
                                    });
                                } else {
                                    console.warn('⚠️ 模型没有参数，无法测试参数功能');
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 测试基础功能时出错:', error);
    }
}

/**
 * 简单的参数类型识别
 */
function identifyParameterType(index: number, defaultValue: number, minValue: number, maxValue: number, range: number): string | null {
    if (!defaultValue || !minValue || !maxValue) return null;

    // HaruGreeter模型参数映射 - 基于实际的参数索引和特征
    if (index === 0 && range >= 25 && range <= 35) {
        return 'ParamAngleX (头部X轴旋转)';
    }
    if (index === 1 && range >= 25 && range <= 35) {
        return 'ParamAngleY (头部Y轴旋转)';
    }
    if (index === 2 && range >= 25 && range <= 35) {
        return 'ParamAngleZ (头部Z轴旋转)';
    }
    if (index === 12 && range >= 1.5 && range <= 2.5) {
        return 'ParamEyeBallX (眼球X轴)';
    }
    if (index === 13 && range >= 1.5 && range <= 2.5) {
        return 'ParamEyeBallY (眼球Y轴)';
    }
    if (index === 25 && range >= 15 && range <= 25) {
        return 'ParamBodyAngleX (身体X轴倾斜)';
    }
    if (index === 26 && range >= 15 && range <= 25) {
        return 'ParamBodyAngleY (身体Y轴倾斜)';
    }
    if (index === 29 && range >= 0.8 && range <= 1.2) {
        return 'ParamBreath (呼吸)';
    }
    if (index === 23 && range >= 0.8 && range <= 1.2) {
        return 'ParamMouthOpenY (嘴部开合)';
    }
    if (index === 5 && range >= 0.8 && range <= 1.2) {
        return 'ParamEyeLOpen (左眼开合)';
    }
    if (index === 7 && range >= 0.8 && range <= 1.2) {
        return 'ParamEyeROpen (右眼开合)';
    }

    return '未知类型';
}

/**
 * 检查元素是否可见
 */
function isElementVisible(element: Element): boolean {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
}

/**
 * 暴露到全局供手动调用
 */
(window as any).runDiagnosis = runCompleteDiagnosis;

console.log('✅ Live2D诊断工具准备就绪，3秒后自动开始诊断...');
console.log('💡 也可以手动调用 window.runDiagnosis() 来重新检查');