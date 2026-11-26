import { render } from "astro:content"
import type { Entry } from "./content"

export async function renderEntry(entry: Entry) {
  const { Content, headings, remarkPluginFrontmatter } = await render(entry)
  const hasKatex = remarkPluginFrontmatter.hasKatex
  return {
    Content,
    headings,
    hasKatex: typeof hasKatex === "boolean" ? hasKatex : /<span class="katex"/u.test(entry.rendered?.html ?? "")
  }
}

export type RenderedEntry = Awaited<ReturnType<typeof renderEntry>>
