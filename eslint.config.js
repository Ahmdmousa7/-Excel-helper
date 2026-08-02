// ESLint 9 flat config.
//
// Calibrated to land as a *useful* gate on an existing codebase rather than a
// wall of 2,000 pre-existing errors nobody reads. The rules that catch real
// defects (hooks correctness, keyboard accessibility, unhandled promises) are
// errors; the stylistic ones are warnings, and `--max-warnings` is deliberately
// not set in CI so warnings inform without blocking.
//
// Tighten the warn→error line as the existing violations get paid down.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.apexyard/**',
      // Ad-hoc scratch scripts. Not application code, not shipped, not linted.
      'test-site*.js',
      'test-puppeteer*.js',
      'test-jina*.js',
      'app/applet/test-*.js',
      'check_hidden.cjs',
      'replace_export.cjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // --- Security guard rails --------------------------------------------
      // TD-022. `xlsx-js-style` is built on the vulnerable SheetJS 0.18.5 base
      // (CVE-2023-30533, prototype pollution via a crafted file). It is kept
      // only because every current call site writes — `utils`, `write`,
      // `writeFile` — and the advisory does not apply to export-only paths.
      //
      // The moment someone parses with it, that reasoning collapses silently
      // and the app is vulnerable again. This makes that a build failure
      // instead of a discovery. Parse with `xlsx` (aliased to the patched
      // @e965/xlsx); use `xlsx-js-style` only to write.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='XLSX_STYLE'][property.name=/^(read|readFile)$/]",
          message:
            'xlsx-js-style is built on vulnerable SheetJS 0.18.5 and must never parse input (TD-022). ' +
            'Read with `xlsx` — it is aliased to the patched @e965/xlsx. See docs/quality/dependency-analysis-xlsx.md.',
        },
      ],

      // --- Correctness: these catch bugs, so they fail the build -----------
      'react-hooks/rules-of-hooks': 'error',
      'no-cond-assign': 'error',
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-template-curly-in-string': 'error',
      'require-atomic-updates': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',

      // --- Accessibility: a keyboard-unreachable control is a real defect --
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',

      // --- Stylistic: from the recommended presets, demoted per the policy
      //     in this file's header. All are safely auto-fixable — run
      //     `npm run lint:fix` to clear them in a dedicated cleanup PR
      //     rather than mixing a codebase-wide reformat into feature work.
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-useless-escape': 'warn',
      '@typescript-eslint/no-array-constructor': 'warn',

      // --- Known-debt: real findings, but too many to gate on today --------
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: false }],
    },
  },

  // Node-side config and tooling files.
  {
    files: ['*.config.{ts,js,mjs}', 'scripts/**/*.{ts,js,mjs}', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off', // Node globals are provided above; TS handles the rest.
    },
  },

  // Tests get more rope: `any` in a fixture is fine, and non-null assertions
  // on a locator you just asserted exists are idiomatic.
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
