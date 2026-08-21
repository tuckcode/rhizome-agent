import { defineConfig } from '@playwright/test'

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:41741'
const port = new URL(baseURL).port || '41741'
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER
  ? process.env.PLAYWRIGHT_REUSE_SERVER === '1'
  : process.env.CI !== 'true'
const claudeCodeOnboardingStorageState = {
  cookies: [],
  origins: [
    {
      origin: baseURL,
      localStorage: [
        { name: 'tolaria:claude-code-onboarding-dismissed', value: '1' },
      ],
    },
  ],
}

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  // One worker meant 26 tests ran strictly one at a time — ~110s of the
  // pre-push wall clock on a 15-core machine. Each test copies its own
  // fixture vault (`createFixtureVaultCopy`) and gets its own browser context,
  // so they do not share state; the server they share only serves the app.
  // Tunable for a machine where the contention is not worth it.
  workers: Number(process.env.PLAYWRIGHT_SMOKE_WORKERS ?? 4),
  grep: /@smoke/,
  use: {
    baseURL,
    headless: true,
    storageState: claudeCodeOnboardingStorageState,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node scripts/playwright-smoke-server.mjs ${port}`,
    url: baseURL,
    reuseExistingServer,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
