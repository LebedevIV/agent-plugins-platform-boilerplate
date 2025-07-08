import { resolve } from 'path';

export default {
  resolve: {
    alias: {
      '@platform-core': resolve(__dirname, 'platform-core'),
      '@platform-public': resolve(__dirname, 'platform-core/public'),
    },
  },
}; 