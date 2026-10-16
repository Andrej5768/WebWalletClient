import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Pages are loaded lazily; the first import of a page with charts takes a while in jsdom,
      // and much longer when every core transforms the chart modules at once.
      testTimeout: 30_000,
      maxWorkers: '50%',
    },
  }),
);
