/**
 * Tauri 环境路径工具
 * 解决开发环境和生产环境的资源路径差异问题
 *
 * 重要修正：Tauri在所有环境中都应该使用绝对路径访问静态资源
 */

/**
 * 获取Live2D模型资源路径
 */
export function getLive2DModelPath(modelName: string): string {
  // 所有环境都使用绝对路径访问资源
  return `/assets/live2d/characters/free/${modelName}/${modelName}.model3.json`;
}

/**
 * 获取Live2D核心库路径
 */
export function getLive2DCorePath(): string {
  // 开发环境和生产环境都使用绝对路径访问public目录
  return '/assets/live2d/core/live2dcubismcore.min.js';
}

/**
 * 获取通用的Live2D资源路径
 */
export function getLive2DAssetPath(...pathSegments: string[]): string {
  const path = pathSegments.join('/');
  return `/assets/live2d/${path}`;
}

/**
 * 检查当前运行环境信息
 */
export function getEnvironmentInfo() {
  return {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    baseUrl: import.meta.env.BASE_URL || '/',
    assetBasePath: '/', // 所有环境都使用根路径
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown'
  };
}