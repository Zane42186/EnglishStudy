import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/* 英语学习平台前端工程（Vue 3 + Vite）
 * 约定：
 *   - **全站唯一前端**：原生站 `review/` 已于 2026-10-02 退役（frontend-plan §14），本工程独立承担全站页面；
 *   - dev server 固定 5173（strictPort），不占用后端 4000；
 *   - 后端已开 CORS（回显任意 Origin），dev 可直连 4000，无需 proxy。
 *     如需切换后端地址：在 .env.local 里设 VITE_API_BASE。
 */
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});
