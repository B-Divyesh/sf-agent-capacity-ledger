import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'env PORT=4173 DATA_DIR=/tmp/agent-capacity-ledger-tests ./target/debug/agent-capacity-ledger',
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
