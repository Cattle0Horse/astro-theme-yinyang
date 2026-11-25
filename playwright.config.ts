import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:4382", browserName: "chromium" },
  webServer: { command: "pnpm preview --ignore-lock --host 127.0.0.1 --port 4382", url: "http://127.0.0.1:4382", reuseExistingServer: false }
})
