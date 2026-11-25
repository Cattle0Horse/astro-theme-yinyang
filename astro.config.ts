import { defineConfig } from "astro/config"
import yinyang from "./src/integration"

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  base: process.env.SITE_BASE || "/",
  devToolbar: { enabled: false },
  integrations: [yinyang()]
})
