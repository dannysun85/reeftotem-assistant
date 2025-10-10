/**
 * Tauri API Helper
 * 使用官方 @tauri-apps/api 包，而不是依赖 window.__TAURI__
 * 
 * 根据官方文档：https://tauri.app/zh-cn/concept/inter-process-communication/
 * 推荐使用 @tauri-apps/api 提供的函数，而不是直接访问 window.__TAURI__
 */

/**
 * 检查是否在 Tauri 环境中运行
 */
export function isTauriEnvironment(): boolean {
  // 检查多种 Tauri 标识
  return (
    typeof window !== 'undefined' &&
    (
      '__TAURI_INTERNALS__' in window ||
      '__TAURI__' in window ||
      '__TAURI_METADATA__' in window
    )
  );
}

/**
 * 动态导入 Tauri API
 * 这样可以避免在非 Tauri 环境中导入失败
 */
export async function getTauriAPI() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen, emit } = await import('@tauri-apps/api/event');
    
    console.log('✅ Tauri API 已导入');
    
    return {
      invoke,
      listen,
      emit
    };
  } catch (error) {
    console.error('❌ 无法导入 Tauri API:', error);
    return null;
  }
}

console.log('📦 Tauri Shim 已加载');
console.log('🔍 Tauri 环境:', isTauriEnvironment());
