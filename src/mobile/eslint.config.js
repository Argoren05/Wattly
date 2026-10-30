// ESLint configuration: Expo defaults + mandatory JSDoc for application code.
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const jsdoc = require('eslint-plugin-jsdoc');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*'],
  },
  {
    // Every function, component, exported constant, interface and type alias must be documented.
    files: ['src/**/*.{ts,tsx}', 'app.config.ts'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: false,
        require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
        contexts: [
          'TSInterfaceDeclaration',
          'TSTypeAliasDeclaration',
          'ExportNamedDeclaration:has(VariableDeclaration)',
          'Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        ],
      }],
    },
  },
]);
