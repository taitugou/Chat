import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const ipv6Only = env.IPV6_ONLY === 'true' || process.env.IPV6_ONLY === 'true';
  const backendProxyTarget = env.BACKEND_PROXY_TARGET
    || process.env.BACKEND_PROXY_TARGET
    || (ipv6Only ? 'https://[::1]:888' : 'https://127.0.0.1:888');

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['f.ico', 'favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'default-avatar.svg'],
        manifest: {
          name: 'TTG Chat',
          short_name: 'TTG',
          description: 'A modern chat application',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\/uploads\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'uploads-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\/api\/(?!auth\/|chat\/).*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                networkTimeoutSeconds: 10,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      devSourcemap: true,
    },
    server: {
      port: 8888,
      host: ipv6Only ? '::' : '0.0.0.0',
      allowedHosts: true,
      https: {
        key: fs.readFileSync(path.resolve(__dirname, '../certs/localhost-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '../certs/localhost.pem')),
      },
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: backendProxyTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'socket-vendor': ['socket.io-client'],
          },
        },
      },
    },
  };
});
