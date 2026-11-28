import { readFile, realpath, stat } from "node:fs/promises"
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path"
import { render } from "astro:content"
import rss from "@astrojs/rss"
import { entryPath, entryTags, entryTitle, published } from "./content"
import type { Entry, Section } from "./content"
import { basePath } from "./content-format"
import { isRelativeResource } from "./markdown/resources"
import { site } from "../site.config"

const types: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
}

export async function feed(section: Section, origin: URL) {
  const entries = await published(section)
  return rss({
    site: new URL(basePath(section === "notes" ? "notes/" : ""), origin),
    title: section === "notes" ? site.title + " · Notes" : site.title,
    description: site.description,
    customData: "<language>" + site.language + "</language>",
    items: entries.map((entry) => {
      const title = entryTitle(entry)
      return {
        title,
        description: entry.data.description || title,
        link: new URL(entryPath(entry), origin).href,
        pubDate: new Date(entry.data.date),
        categories: entryTags(entry)
      }
    })
  })
}

type StaticAsset = { file: string } | { body: string }

export async function staticFiles() {
  const paths = new Map<string, { params: { section: Section; asset: string }; props: { source: StaticAsset } }>()
  const entries = [...(await published("posts")), ...(await published("notes"))]
  for (const entry of entries) {
    if (entry.body) add(entry, "body.md", { body: entry.body })
    if (!entry.filePath) continue
    const source = resolve(entry.filePath)
    if (site.originalMarkdown) add(entry, "index.md", { file: source })
    const metadata = entry.rendered?.metadata?.frontmatter
    const references = metadata && typeof metadata === "object" && "assetReferences" in metadata ? metadata.assetReferences : (await render(entry)).remarkPluginFrontmatter.assetReferences
    for (const href of [...(Array.isArray(references) ? references : []), entry.data.cover]) {
      if (!isRelativeResource(href)) continue
      const asset = await localAttachment(source, href)
      if (asset) add(entry, asset.path, { file: asset.file })
    }
  }
  return [...paths.values()]

  function add(entry: Entry, name: string, source: StaticAsset) {
    const asset = entry.id + "/" + name
    const key = entry.collection + "/" + asset
    const existing = paths.get(key)
    if (existing && !("file" in existing.props.source && "file" in source && existing.props.source.file === source.file)) throw new Error("Conflicting static resource: " + key)
    paths.set(key, { params: { section: entry.collection, asset }, props: { source } })
  }
}

async function localAttachment(source: string, href: string) {
  let path: string
  try {
    path = decodeURIComponent(href.split(/[?#]/u, 1)[0]).replaceAll("\\", "/")
  } catch {
    return
  }
  const segments = path.split("/").filter((segment) => segment !== ".")
  if (!path || isAbsolute(path) || segments.some((part) => !part || part === ".." || part.startsWith(".") || part.includes("\0"))) return
  // A Markdown entry is published only through the collection's own route.
  if (extname(path).toLowerCase() === ".md") return
  const root = dirname(source)
  const candidate = resolve(root, ...segments)
  try {
    const file = await realpath(candidate)
    const physicalPath = relative(await realpath(root), file)
    if (!physicalPath || physicalPath.startsWith(".." + sep) || isAbsolute(physicalPath) || !(await stat(file)).isFile()) return
    return { path: segments.join("/"), file }
  } catch {
    return
  }
}

export async function staticResponse(source: StaticAsset) {
  if ("body" in source) return new Response(source.body, { headers: { "Content-Type": types[".md"] } })
  const { file } = source
  return new Response(new Uint8Array(await readFile(file)), {
    headers: { "Content-Type": types[extname(file).toLowerCase()] ?? "application/octet-stream" }
  })
}
