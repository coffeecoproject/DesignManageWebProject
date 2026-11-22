import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'node',
    expect: { requireAssertions: true },
    include: ['src/**/*.test.ts']
  }
});
