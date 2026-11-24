export default [
  { ignores: ['data/**', 'coverage/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module'},
    rules: {
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'valid-typeof': 'error',
      'no-eval': 'error',
      'no-new-func': 'error'
    }
  }
];
