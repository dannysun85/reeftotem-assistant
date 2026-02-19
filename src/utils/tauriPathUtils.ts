/**
 * Tauri 环境路径工具
 * 解决开发环境和生产环境的资源路径差异问题
 *
 * 修复要点：
 * 1. 生产环境需要确保资源文件正确打包
 * 2. Tauri 资源路径在生产环境中的正确解析
 * 3. 开发和生产环境路径的一致性
 */

/**
 * 获取Live2D模型资源路径
 */
export function getLive2DModelPath(modelName: string): string {
  const basePath = getLive2DBasePath();
  return `${basePath}/characters/free/${modelName}/${modelName}.model3.json`;
}

/**
 * 获取Live2D核心库路径
 * Tauri 2 生产环境资源访问解决方案
 */
export function getLive2DCorePath(): string {
  const basePath = getLive2DBasePath();
  return `${basePath}/core/live2dcubismcore.min.js`;
}

/**
 * 获取通用的Live2D资源路径
 */
export function getLive2DAssetPath(...pathSegments: string[]): string {
  const basePath = getLive2DBasePath();
  const path = pathSegments.join('/');
  return `${basePath}/${path}`;
}

/**
 * 检查当前运行环境信息
 */
export function getEnvironmentInfo() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const live2dBasePath = `${normalizedBaseUrl}assets/live2d`;

  return {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    baseUrl: normalizedBaseUrl,
    assetBasePath: normalizedBaseUrl,
    live2dBasePath,
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  };
}

/**
 * 测试资源路径是否可访问
 */
export async function testResourcePath(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn('资源路径测试失败:', path, error);
    return false;
  }
}

/**
 * 获取可用的Live2D模型路径（带回退机制）
 */
export function getLive2DModelPathWithFallback(modelName: string): string {
  return getLive2DModelPath(modelName);
}

function getLive2DBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}assets/live2d`;
}
