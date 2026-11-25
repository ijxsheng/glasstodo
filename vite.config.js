import { defineConfig } from 'vite';
import { pwaBuild } from './scripts/pwa-build.js';

export default defineConfig({
  // 使用相对资源路径，避免构建产物依赖域名根目录。
  // PWA 和 GitHub Pages 的完整路径配置将在对应阶段验证。
  base: './',
  plugins: [pwaBuild()],
});
