import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default {
  base: './', // <--- ВАЖНО для Chrome Extension!
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'chrome-extension', 'public', 'side-panel'),
    sourcemap: true,
    minify: true,
    reportCompressedSize: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['chrome', 'unenv/node/process', 'unenv/polyfill/globalthis'],
    },
  },
  plugins: [react()],
};
