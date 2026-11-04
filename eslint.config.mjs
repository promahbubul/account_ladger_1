import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const sharedRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-empty': ['error', { allowEmptyCatch: true }],
};

const jsxPlugins = { react, 'react-hooks': reactHooks };
const jsxRules = {
  'react/jsx-uses-vars': 'error',
  'react/jsx-uses-react': 'error',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', 'mobile/android/**', '.cph/**', '*.c'],
  },
  js.configs.recommended,
  {
    files: ['backend/**/*.js', '*.mjs'],
    languageOptions: { globals: globals.node },
    rules: sharedRules,
  },
  {
    files: ['mobile/**/*.js', 'mobile/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: jsxPlugins,
    rules: { ...sharedRules, ...jsxRules },
  },
  {
    files: ['frontend/src/**/*.js', 'frontend/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: sharedRules,
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: jsxPlugins,
    rules: {
      ...jsxRules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  }
);
