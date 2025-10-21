import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = __dirname;
const srcDir = resolve(rootDir, 'src');
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));

function versionReplacePlugin() {
  return {
    name: 'html-version-replace',
    transformIndexHtml(html) {
      return html.replace(/__EXT_VERSION__/g, pkg.version);
    },
  };
}

export default {
  base: './', // <--- ВАЖНО для Chrome Extension!
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
