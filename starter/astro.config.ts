import { defineConfig } from "astro/config"
import yinyang from "astro-theme-yinyang"

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  base: process.env.SITE_BASE || "/",
  integrations: [
    yinyang({
      title: "我的博客",
      description: "记录阅读与生活",
      author: "作者"
    })
  ]
})
