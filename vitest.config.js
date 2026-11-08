import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.js'],
    include: ['src/__test__/**/*.test.js'],
    fileParallelism: false,
    coverage: { provider: 'v8', include: ['src/**/*.js'], exclude: ['src/__test__/**'] }
  }
})
