import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Эта секция нужна для `npm run dev`
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Эта секция добавляет плагин для копирования файлов в `dist`
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.' 
        },
        {
          src: 'favicon.ico',
          dest: '.'
        },
        {
          // Копируем всю папку public целиком
          src: 'public',
          dest: '.'
        },
        {
          // Копируем все файлы Pyodide
          src: 'node_modules/pyodide/*',
          dest: 'pyodide'
        }
      ]
    })
  ],
  
  // --- ▼▼▼ САМАЯ ВАЖНАЯ СЕКЦИЯ ▼▼▼ ---
  // Эта секция нужна для `npm run build`
  build: {
    // Настройки сборщика Rollup, который использует Vite
    rollupOptions: {
      // Здесь мы перечисляем ВСЕ точки входа нашего расширения
      input: {
        // Первая точка входа - наш popup
        main: resolve(__dirname, 'index.html'),
        
        // Вторая, не менее важная точка входа - наш фоновый скрипт
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        // Говорим Rollup, как называть выходные файлы.
        // [name] будет заменено на ключи из `input` (т.е. 'main' и 'background')
        entryFileNames: '[name].js',
        
        // Как называть остальные куски JS кода, если они появятся
        chunkFileNames: 'assets/js/[name].js',

        // Как называть CSS, картинки и другие ресурсы
        assetFileNames: 'assets/[name].[ext]',
      }
    },
    // Куда складывать итоговую сборку
    outDir: 'dist',
    // Очищать ли папку `dist` перед каждой новой сборкой (да, это хорошо)
    emptyOutDir: true,
  },
});