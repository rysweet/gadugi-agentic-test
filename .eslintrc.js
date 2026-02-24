module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    jest: true,
    es2020: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    // Downgrade type-checked rules that produce too many false positives
    // with existing any-typed code. These remain as warnings not errors.
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/require-await': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error'
  },
  overrides: [
    {
      // Test files are excluded from tsconfig.json so cannot use project-based
      // type-aware linting. Disable rules that require type information and
      // relax style rules common in test code.
      files: [
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/__tests__/**/*.ts',
        'src/**/__tests__/**/*.ts'
      ],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-misused-promises': 'off',
        '@typescript-eslint/require-await': 'off',
        // require() imports are common in Jest mocks and dynamic requires
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        // Tests often use Function type for mock callbacks (v6 name and v8 name)
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
        // Tests may use empty catch blocks intentionally
        'no-empty': 'off',
        // Tests may use string concatenation for readability
        'prefer-template': 'off',
        // Tests may have unused expressions (expect.assertions, etc.)
        '@typescript-eslint/no-unused-expressions': 'off',
      }
    },
    {
      // Example files are illustrative and may have unused imports/expressions
      files: ['src/**/examples/**/*.ts', 'src/**/*.example.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
      }
    }
  ]
};
