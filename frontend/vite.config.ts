import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Vite only exposes .env values through import.meta.env, which does not exist
  // at config time. loadEnv reads the same files by hand so the dev-server
  // proxy target can live in frontend/.env instead of a shell export.
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env };

  return {
    plugins: [reactRouter()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://app.127.0.0.1.sslip.io',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
