/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'dev-dist', 'node_modules'],
  rules: {
    // CLAUDE.md: žádné `any`.
    '@typescript-eslint/no-explicit-any': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
