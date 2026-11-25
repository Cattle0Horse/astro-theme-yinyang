import { render } from "astro:content"
import type { Entry } from "./content"

export async function renderEntry(entry: Entry) {
  const { Content, headings, remarkPluginFrontmatter } = await render(entry)
  return { Content, headings, hasKatex: remarkPluginFrontmatter.hasKatex === true }
}

export type RenderedEntry = Awaited<ReturnType<typeof renderEntry>>
