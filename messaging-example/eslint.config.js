// messaging-example/eslint.config.js
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        chrome: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
