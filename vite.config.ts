import { defineConfig } from "vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * Vite 配置
 * 
 * 注意：为了避免 @vitejs/plugin-react 的 preamble 检测 bug，
 * 我们使用 Vite 内置的 esbuild 来处理 JSX，而不是使用 React 插件。
 * 这意味着没有 React Fast Refresh，但可以避免复杂组件的编译错误。
 */
export default defineConfig(async () => ({
  plugins: [],
  
  // 使用 esbuild 处理 JSX
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },

  // 配置静态资源
  publicDir: 'public',

  // Vite options tailored for Tauri development
  clearScreen: false,
  
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

