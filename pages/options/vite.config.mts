import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { readFileSync } from 'node:fs';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'));

function versionReplacePlugin() {
  return {
    name: 'html-version-replace',
    transformIndexHtml(html) {
      return html.replace(/__EXT_VERSION__/g, pkg.version);
    },
  };
}

export default {
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'options'),
    sourcemap: true,
    minify: true,
    reportCompressedSize: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['chrome', 'unenv/node/process', 'unenv/polyfill/globalthis'],
    },
  },
  plugins: [react(), versionReplacePlugin()],
};
