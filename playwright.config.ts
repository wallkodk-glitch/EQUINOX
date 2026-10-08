import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/EQUINOX/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/EQUINOX/",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        launchOptions: process.env.EQUINOX_CHROMIUM_EXECUTABLE
          ? {
              executablePath: process.env.EQUINOX_CHROMIUM_EXECUTABLE,
              args: ["--disable-gpu", "--no-zygote"],
            }
          : undefined,
      },
    },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
