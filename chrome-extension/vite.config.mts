import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin.js';
import { watchPublicPlugin, watchRebuildPlugin } from '@extension/hmr';
import { watchOption } from '@extension/vite-config';
import env, { IS_DEV, IS_PROD } from '@extension/env';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

const outDir = resolve(rootDir, '..', 'dist');
export default defineConfig({
  define: {
    'process.env': env,
  },
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
      '@platform-core': resolve(rootDir, '../platform-core'),
    },
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as PluginOption,
    watchPublicPlugin(),
    makeManifestPlugin({ outDir }),
    IS_DEV && watchRebuildPlugin({ reload: true, id: 'chrome-extension-hmr' }),
    nodePolyfills(),
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      name: 'BackgroundScript',
      fileName: 'background',
      formats: ['es'],
      entry: resolve(srcDir, 'background', 'index.ts'),
    },
    outDir,
    emptyOutDir: false,
    sourcemap: IS_DEV,
    minify: false,
    reportCompressedSize: IS_PROD,
    // Отключаем terser минификацию для обеспечения читаемости
    terserOptions: {
      compress: {
        // Отключаем опасные оптимизации которые меняют функциональность
        drop_console: false,
        drop_debugger: false,
        pure_funcs: [],
        // Отключаем минификацию условий и выражений
        collapse_vars: false,
        reduce_vars: false,
        // Сохраняем читаемость
        keep_infinity: true,
        keep_fnames: true,
        keep_classnames: true,
      },
      mangle: {
        // Отключаем mangle имен функций и переменных
        keep_fnames: true,
        keep_classnames: true,
        // Не изменяем имена свойств
        properties: false,
      },
      format: {
        // Сохраняем читаемый формат
        beautify: true,
        indent_level: 2,
        keep_quoted_props: true,
        // Добавляем комментарии для лучшей читаемости
        comments: true,
        semicolons: true,
      },
    },
    cssMinify: false,
    watch: watchOption,
    rollupOptions: {
      external: ['chrome', 'unenv/node/process', 'unenv/polyfill/globalthis'],
      // Настройки для лучшей читабельности во всех режимах
      output: {
        // Сохраняем имена функций и переменных всегда
        compact: false,
        minifyInternalExports: false,
        // Дополнительные настройки preservation
        preserveModules: false,
      },
    },
  },
});
