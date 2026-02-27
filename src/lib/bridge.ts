/**
 * Tauri Bridge Adapter Layer
 * Abstracts frontend-to-backend communication through Tauri invoke.
 * All channels routed via @tauri-apps/api/core invoke.
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface IBridge {
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, handler: (data: unknown) => void): () => void;
  platform: string;
  isDev: boolean;
}

function normalizeChannel(channel: string): string {
  return channel.replace(/:/g, '_');
}

export async function invoke<T>(channel: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    return Promise.reject(new Error(`Not in Tauri environment: ${channel}`));
  }
  const cmd = normalizeChannel(channel);
  return tauriInvoke<T>(cmd, args);
}

export function on(channel: string, handler: (data: unknown) => void): () => void {
  if (!isTauri) {
    return () => {};
  }
  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  const normalized = normalizeChannel(channel);

  tauriListen(normalized, (event) => {
    if (!disposed) {
      handler(event.payload);
    }
  }).then((fn) => {
    if (disposed) {
      // 清理已被调用，立即取消监听
      fn();
    } else {
      unlisten = fn;
    }
  });

  return () => {
    disposed = true;
    if (unlisten) {
      unlisten();
    }
    // 若 unlisten 仍为 null，说明 promise 未 resolve，
    // .then() 中的 disposed 检查会负责清理
  };
}

export const bridge: IBridge = {
  invoke,
  on,
  platform: isTauri ? 'tauri' : 'web',
  isDev: import.meta.env.DEV,
};

export default bridge;
