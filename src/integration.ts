import type { AstroIntegration } from "astro"
import { unified } from "@astrojs/markdown-remark"
import react from "@astrojs/react"
import tailwind from "@tailwindcss/vite"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/contrib/mhchem"
import { remarkLegacyMath } from "./lib/markdown/legacy-math.ts"
import { remarkSidenotes } from "./lib/markdown/sidenotes.ts"
import { rehypeReading } from "./lib/markdown/reading.ts"
import { remarkTableSource } from "./lib/markdown/tables.ts"
import type { ThemeOptions } from "./site.config.ts"

export type { ThemeOptions } from "./site.config.ts"

const routes = {
  "/": "index.astro",
  "/404": "404.astro",
  "/404-articles.json": "404-articles.json.ts",
  "/logo.png": "logo.png.ts",
  "/index.xml": "index.xml.ts",
  "/sitemap.xml": "sitemap.xml.ts",
  "/posts/[...id]": "posts/[...id]/index.astro",
  "/tags": "tags/index.astro",
  "/tags/[tag]": "tags/[tag].astro",
  "/notes": "notes/index.astro",
  "/notes/index.xml": "notes/index.xml.ts",
  "/notes/page/[page]": "notes/page/[page].astro",
  "/notes/[month]/[id]": "notes/[month]/[id]/index.astro",
  "/notes/tags": "notes/tags/index.astro",
  "/notes/tags/[tag]": "notes/tags/[tag]/index.astro",
  "/notes/tags/[tag]/page/[page]": "notes/tags/[tag]/page/[page].astro",
  "/[section]/[...asset]": "[section]/[...asset].ts"
}

export default function yinyang(options: ThemeOptions = {}): AstroIntegration[] {
  return [
    react(),
    {
      name: "astro-theme-yinyang",
      hooks: {
        "astro:config:setup": ({ injectRoute, updateConfig }) => {
          for (const [pattern, file] of Object.entries(routes)) {
            if (pattern !== "/logo.png" || !options.favicon) injectRoute({ pattern, entrypoint: new URL("./routes/" + file, import.meta.url) })
          }
          updateConfig({
            output: "static",
            trailingSlash: "always",
            build: { format: "directory" },
            vite: {
              plugins: [tailwind()],
              define: { __YINYANG_OPTIONS__: JSON.stringify(options) }
            },
            markdown: {
              syntaxHighlight: { type: "shiki", excludeLangs: ["math", "plaintext"] },
              shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
              processor: unified({
                remarkPlugins: [remarkMath, remarkLegacyMath, remarkSidenotes, remarkTableSource],
                rehypePlugins: [rehypeKatex, rehypeReading]
              })
            }
          })
        }
      }
    }
  ]
}
