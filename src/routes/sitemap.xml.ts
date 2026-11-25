import type { APIRoute } from "astro"
import { entryPath, published, tagsFor, tagsPath } from "../lib/content"
import { basePath } from "../lib/content-format"

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL("https://example.com")
  const posts = await published("posts")
  const notes = await published("notes")
  const urls = [
    basePath(""),
    basePath("notes/"),
    tagsPath("posts"),
    tagsPath("notes"),
    ...posts.map(entryPath),
    ...notes.map(entryPath),
    ...tagsFor(posts).map(({ id }) => tagsPath("posts", id)),
    ...tagsFor(notes).map(({ id }) => tagsPath("notes", id))
  ]
  const unique = [...new Set(urls)]
  const body = unique.map((path) => "  <url><loc>" + escapeXml(new URL(path, origin).href) + "</loc></url>").join("\n")
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>", {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  })
}
