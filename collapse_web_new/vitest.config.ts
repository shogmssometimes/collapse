import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // only include .test.ts files (exclude Playwright .spec.ts files)
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
