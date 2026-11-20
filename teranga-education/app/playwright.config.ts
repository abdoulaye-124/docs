import { defineConfig, devices } from '@playwright/test';

// Les tests de bout en bout tournent contre la pile LOCALE (dev/local-stack.sh),
// réinitialisée avant chaque exécution : uniquement des données fictives.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'off',
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173/connexion',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
