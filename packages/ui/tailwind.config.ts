import type { Config } from 'tailwindcss';
import globalConfig from './tailwind-global.config';

const config: Config = {
  content: ['lib/**/*.tsx'],
  presets: [globalConfig],
};

export default config;
