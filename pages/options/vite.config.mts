import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';
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

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'options'),
  },
  plugins: [versionReplacePlugin()],
});
