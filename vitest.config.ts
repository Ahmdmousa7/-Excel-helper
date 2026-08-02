import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts on purpose: the app build pulls in the React
// plugin and a stack of Node polyfills that the unit suite has no use for, and
// loading them roughly triples cold start.
export default defineConfig({
  resolve: {
    // Must mirror the alias in vite.config.ts, or the unit suite would exercise
    // a different xlsx than the app ships. See TD-001.
    alias: { xlsx: '@e965/xlsx' },
  },
  test: {
    environment: 'node',
    include: ['{utils,services,hooks}/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/unit-junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Scoped to the pure-logic modules the suite actually covers. Pointing it
      // at the whole tree would report ~2% and make the number meaningless.
      include: ['utils/**/*.ts'],
      exclude: ['utils/translations.ts', '**/*.test.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
});
