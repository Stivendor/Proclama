import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  testDir: './tests',
  timeout: 45000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    // Mints a real session into tests/.auth/state.json before authenticated specs
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // Tests that don't need a login — independent of the service_role setup
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /auth\.authenticated\.spec\.ts/],
    },
    {
      // Authenticated tests — depend on the minted session
      name: 'chromium-auth',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: /auth\.authenticated\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
