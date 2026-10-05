import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8000'

  if (mode === 'production' && !env.VITE_API_ORIGIN) {
    throw new Error('VITE_API_ORIGIN wajib diisi untuk production build.')
  }

  return {
    plugins: [vue(), vueDevTools(), tailwindcss()],
    optimizeDeps: {
      include: [
        'apexcharts/core',
        'apexcharts/area',
        'apexcharts/bar',
        'apexcharts/features/keyboard',
      ],
    },
    build: {
      // ApexCharts is already route/component-lazy and modular; its shared area runtime is ~521 kB minified.
      chunkSizeWarningLimit: 600,
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/health': { target, changeOrigin: true },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
