import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Split node_modules besar jadi vendor chunks:
          //  - Vendor jarang berubah → cacheable lebih lama
          //  - Bundle utama kecil → first-load cepat
          //  - Page yang tidak pakai exceljs/recharts tidak ikut download
          manualChunks: {
            exceljs: ['exceljs'],
            recharts: ['recharts'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
          // Tambahkan timestamp untuk force reload setiap build baru
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'index.css') {
              return 'assets/index.[hash].css';
            }
            return 'assets/[name].[hash][extname]';
          },
          chunkFileNames: 'assets/[name].[hash].js',
          entryFileNames: 'assets/[name].[hash].js',
        },
      },
    },
  };
});
