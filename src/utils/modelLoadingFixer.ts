/**
 * Live2D模型加载修复工具
 * 解决模型加载失败和时序问题
 */

import { getLive2DCorePath, getLive2DAssetPath, getEnvironmentInfo } from './tauriPathUtils';

console.log('🔧 模型加载修复工具加载...');

/**
 * 等待模型加载完成的Promise包装
 */
function waitForModelLoad(): Promise<boolean> {
    return new Promise((resolve) => {
        const checkModel = () => {
            try {
                if (typeof window !== 'undefined' && window.LAppDelegate) {
                    const appDelegate = window.LAppDelegate.getInstance();
                    if (appDelegate) {
                        const subdelegate = appDelegate.getSubdelegate().at(0);
                        if (subdelegate) {
                            const live2dManager = subdelegate.getLive2DManager();
                            if (live2dManager && live2dManager._models && live2dManager._models.getSize() > 0) {
                                const model = live2dManager._models.at(0);
                                if (model && model.getModel()) {
                                    console.log('✅ 模型加载完成！');
                                    resolve(true);
                                    return;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                    console.warn('检查模型状态时出错:', error);
                }

                // 继续等待
                setTimeout(checkModel, 500);
            };

            checkModel();
        });
    }

/**
 * 检查模型文件是否可访问
 */
function checkModelFiles(): void {
    console.log('🔍 检查模型文件可访问性...');

    console.log('🔧 环境信息:', getEnvironmentInfo());

    // 使用统一的路径处理函数
    const corePath = getLive2DCorePath();
    const modelPaths = [
        corePath,
        getLive2DAssetPath('characters/free/HaruGreeter/HaruGreeter.model3.json'),
        getLive2DAssetPath('characters/free/HaruGreeter/Haru.moc3')
    ];

    modelPaths.forEach((path, index) => {
        fetch(path)
            .then(response => {
                if (response.ok) {
                    console.log(`✅ 文件${index + 1}可访问: ${path}`);
                } else {
                    console.error(`❌ 文件${index + 1}不可访问: ${path} (${response.status})`);
                }
            })
            .catch(error => {
                console.error(`❌ 文件${index + 1}加载失败: ${path}`, error);
            });
    });
}

/**
 * 修复参数映射器的初始化时机
 */
function fixParameterMapper(): void {
    console.log('🔧 修复参数映射器...');

    // 等待模型加载完成后重新初始化参数映射器
    waitForModelLoad().then(() => {
        if (window.ParameterMapper) {
            const mapper = window.ParameterMapper.getInstance();
            if (mapper) {
                console.log('🔄 重新初始化参数映射器...');
                mapper.reset(); // 重置状态
                mapper.initializeParameterMapping(); // 重新初始化

                // 等待参数映射完成
                setTimeout(() => {
                    const availableParams = mapper.getAvailableParameters();
                    console.log('✅ 参数映射修复完成，可用参数:', availableParams);
                }, 2000);
            }
        }
    });
}

/**
 * 增强LAppLive2DManager的错误处理
 */
function enhanceLive2DManager(): void {
    console.log('🔧 增强Live2D Manager...');

    // 重写LAppLive2DManager.onUpdate以提供更好的错误信息
    if (typeof window !== 'undefined' && window.LAppDelegate) {
        const appDelegate = window.LAppDelegate.getInstance();
        if (appDelegate) {
            const subdelegate = appDelegate.getSubdelegate().at(0);
            if (subdelegate) {
                const live2dManager = subdelegate.getLive2DManager();
                if (live2dManager) {
                    // 添加模型状态检查方法
                    live2dManager.isModelLoaded = function(): boolean {
                        try {
                            return this._models.getSize() > 0 &&
                                   this._models.at(0) &&
                                   this._models.at(0).getModel() !== null;
                        } catch (error) {
                            return false;
                        }
                    };

                    console.log('✅ 增强的Live2D Manager已就绪');
                }
            }
        }
    }
}

/**
 * 启动所有修复
 */
function startFixes(): void {
    console.log('🚀 开始模型加载修复...');

    // 1. 检查模型文件
    checkModelFiles();

    // 2. 增强Live2D Manager
    enhanceLive2DManager();

    // 3. 等待模型加载并修复参数映射器
    fixParameterMapper();

    // 4. 提供手动修复方法
    window.fixLive2D = {
        waitForModelLoad,
        fixParameterMapper,
        checkModelFiles
    };

    console.log('✅ 修复工具已启动');
    console.log('💡 手动修复方法: window.fixLive2D.waitForModelLoad()');
}

// 立即启动修复
startFixes();

// 暴露到全局
(window as any).startLive2DFixes = startFixes;

console.log('✅ 模型加载修复工具已准备就绪');