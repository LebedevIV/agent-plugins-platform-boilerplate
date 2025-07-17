import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default {
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'side-panel'),
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
