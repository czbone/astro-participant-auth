import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
          env: {
            REDIS_URL: 'redis://127.0.0.1:6379'
          }
        }
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          globalSetup: ['./src/test/integration-global-setup.ts'],
          setupFiles: ['./src/test/integration-setup.ts'],
          fileParallelism: false,
          isolate: true,
          hookTimeout: 30_000,
          testTimeout: 30_000
        }
      }
    ]
  }
})
