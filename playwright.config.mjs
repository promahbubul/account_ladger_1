// Browser tests for the web app: `npm run test:e2e`. Starts the API on a throwaway JSON store and the
// Vite dev server pointed at it, so nothing touches the production database.
import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.E2E_API_PORT || '5056';
const webPort = process.env.E2E_WEB_PORT || '5010';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  // On CI the github reporter turns each failure into an annotation on the run.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `http://localhost:${apiPort}/health`,
      env: { E2E_API_PORT: apiPort, E2E_WEB_PORT: webPort },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${webPort} --strictPort`,
      cwd: './frontend',
      url: `http://localhost:${webPort}/login`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
