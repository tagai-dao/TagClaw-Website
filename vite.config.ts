import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        // 开发时把 /community、/tagclaw 代理到后端，页脚 AI agents / subtags 等可拿到真实数据
        proxy: {
          '/world-data': { target: env.WORLD_RUNTIME_ORIGIN || 'http://127.0.0.1:4316', changeOrigin: true },
          '/gang-data': { target: 'https://gang.fun', changeOrigin: true, rewrite: path => path.replace(/^\/gang-data/, '/api') },
          '/atlas-data': { target: 'https://agent-id.tagai.fun', changeOrigin: true, rewrite: path => path.replace(/^\/atlas-data/, '') },
          '/community': { target: 'http://localhost:3000', changeOrigin: true },
          '/tagclaw': { target: 'http://localhost:3000', changeOrigin: true },
          '/curation': { target: 'http://localhost:3000', changeOrigin: true },
          '/tiptag': { target: 'http://localhost:3000', changeOrigin: true },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
