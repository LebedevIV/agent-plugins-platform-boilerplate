import env, { IS_DEV, IS_PROD } from '@extension/env';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react';
import deepmerge from 'deepmerge';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { UserConfig } from 'vite';

export const watchOption = IS_DEV
  ? {
      chokidar: {
        awaitWriteFinish: true,
      },
    }
  : undefined;

export const withPageConfig = (config: UserConfig) => {
  const base: UserConfig = {
    define: {
      'process.env': env,
    },
    base: '',
    plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true }), nodePolyfills()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    build: {
      sourcemap: IS_DEV,
      minify: IS_PROD,
      reportCompressedSize: IS_PROD,
      emptyOutDir: IS_PROD,
      watch: watchOption,
      rollupOptions: {
        external: ['chrome', 'unenv/node/process', 'unenv/polyfill/globalthis'],
      },
    },
  };

  // Всегда объединять массивы через spread
  const merged = deepmerge(base, config);

  return defineConfig(merged);
};
