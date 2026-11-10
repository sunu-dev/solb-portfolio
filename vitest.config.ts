import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Independent Node test runner; never mix the quality service into app tests.
    exclude: [...configDefaults.exclude, 'quality-lab/**', 'artifacts/**', 'scripts/market-cause-health.test.cjs'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
