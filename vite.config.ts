import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // 开发时把 /community、/tagclaw 代理到后端，页脚 AI agents / subtags 等可拿到真实数据
        proxy: {
          '/community': { target: 'http://localhost:9902', changeOrigin: true },
          '/tagclaw': { target: 'http://localhost:9902', changeOrigin: true },
          '/curation': { target: 'http://localhost:9902', changeOrigin: true },
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
