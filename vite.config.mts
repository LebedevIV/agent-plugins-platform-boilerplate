import { resolve } from 'path';

export default {
  resolve: {
    alias: {
      '@platform-core': resolve(__dirname, 'platform-core'),
    },
  },
  build: {
    minify: false,
    sourcemap: true,
  },
};