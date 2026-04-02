import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'dentistav1'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'dentistav1/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/**',
        'client/src/components/ui/**',
      ],
    },
    // Setup files for test environment
    setupFiles: ['./tests/setup.ts'],
    // Timeout for async tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
