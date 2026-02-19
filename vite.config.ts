import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync } from "fs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
);
const appVersion = packageJson.version ?? '0.0.0';

/**
 * Vite 配置
 * 
 * 注意：为了避免 @vitejs/plugin-react 的 preamble 检测 bug，
 * 我们使用 Vite 内置的 esbuild 来处理 JSX，而不是使用 React 插件。
 * 这意味着没有 React Fast Refresh，但可以避免复杂组件的编译错误。
 */
import react from '@vitejs/plugin-react';

export default defineConfig(async () => ({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "/assets/live2d": resolve(__dirname, "./public/assets/live2d"),
    },
  },

  // 配置静态资源
  publicDir: 'public',

  // 多页面打包配置
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'live2d-window': resolve(__dirname, 'live2d-window.html'),
      },
    },
  },

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
