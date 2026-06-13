// ESLint 10 flat config
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    // `artifacts/**` holds gitignored throwaway build output — including the
    // AN-003 §5 `tsc` emit dir (`artifacts/diagnostics/tree-playability-build/`).
    // ESLint must never lint generated build artifacts.
    //
    // `.claude/**` holds transient agent git WORKTREES (full repo copies under
    // `.claude/worktrees/`) plus skills/agents docs — never source to lint. The
    // top-level `mcp-server/**` ignore does NOT match nested worktree copies
    // (`.claude/worktrees/X/mcp-server/`), so without this their tests leak into
    // the lint and fail on unrelated WIP. `.claude-tmp/**` is throwaway scratch.
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'artifacts/**',
      'mcp-server/**',
      '.claude/**',
      '.claude-tmp/**',
      '*.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/self-closing-comp': 'warn',
      // Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // General
      'no-console': 'warn',
      'no-debugger': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];
