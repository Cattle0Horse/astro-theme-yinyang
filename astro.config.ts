import { defineConfig } from "astro/config"
import { unified } from "@astrojs/markdown-remark"
import react from "@astrojs/react"
import tailwind from "@tailwindcss/vite"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/contrib/mhchem"
import { remarkLegacyMath } from "./src/lib/markdown/legacy-math"
import { remarkSidenotes } from "./src/lib/markdown/sidenotes"
import { rehypeReading } from "./src/lib/markdown/reading"
import { remarkTableSource } from "./src/lib/markdown/tables"

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  base: process.env.SITE_BASE || "/",
  output: "static",
  trailingSlash: "always",
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: { plugins: [tailwind()] },
  markdown: {
    syntaxHighlight: { type: "shiki", excludeLangs: ["math", "plaintext"] },
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
    processor: unified({
      remarkPlugins: [remarkMath, remarkLegacyMath, remarkSidenotes, remarkTableSource],
      rehypePlugins: [rehypeKatex, rehypeReading]
    })
  }
})
