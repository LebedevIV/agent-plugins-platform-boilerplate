import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default {
  plugins: [react()],
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'new-tab'),
  },
};
