import { getCollection, type CollectionEntry } from "astro:content"
import { basePath, tagId } from "./content-format"

export type Section = "posts" | "notes"

export type Entry = CollectionEntry<Section>

const publishedBySection = new Map<Section, Promise<Entry[]>>()

export function published<T extends Section>(section: T): Promise<CollectionEntry<T>[]>

export function published(section: Section) {
  if (import.meta.env.DEV) return loadPublished(section)
  const cached = publishedBySection.get(section)
  if (cached) return cached
  const entries = loadPublished(section)
  publishedBySection.set(section, entries)
  return entries
}

async function loadPublished(section: Section) {
  const entries = await getCollection(section, ({ data }) => !data.draft)
  return entries.sort((a, b) => Date.parse(b.data.date) - Date.parse(a.data.date) || b.id.localeCompare(a.id))
}

export function entryPath(entry: Entry) {
  return basePath(`${entry.collection}/${entry.id.split("/").map(encodeURIComponent).join("/")}/`)
}

export function entryTags(entry: Entry): string[] {
  return entry.collection === "posts" ? entry.data.tags : entry.data.note_tags
}

export function tagsPath(section: Section, id?: string) {
  const root = section === "posts" ? "tags/" : "notes/tags/"
  return basePath(id ? `${root}${id}/` : root)
}

export function tagsFor<T extends Entry>(entries: readonly T[]) {
  const tags = new Map<string, { label: string; entries: T[] }>()
  for (const entry of entries) {
    const seen = new Set<string>()
    for (const label of entryTags(entry)) {
      const id = tagId(label)
      if (seen.has(id)) continue
      seen.add(id)
      const group = tags.get(id) ?? { label, entries: [] }
      group.entries.push(entry)
      tags.set(id, group)
    }
  }
  return Array.from(tags, ([id, group]) => ({ id, ...group })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"))
}

export function entryTitle(entry: Entry) {
  return (
    entry.data.title ||
    entry.body
      ?.replace(/<!--[^]*?-->/gu, "")
      .trim()
      .split(/\r?\n/u)[0]
      ?.replace(/^[#>\s]+/u, "")
      .slice(0, 72) ||
    "短记"
  )
}

export function sourcesFor(source?: string | string[]) {
  return (Array.isArray(source) ? source : source ? [source] : [])
    .map((value) => {
      const source = value.trim()
      const match = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/u.exec(source)
      const url = match?.[2] ?? source
      if (/^https?:\/\//u.test(url)) {
        const parsed = URL.parse(url)
        if (parsed) return { label: match?.[1] ?? parsed.host, url }
      }
      return { label: source, url: undefined }
    })
    .filter(({ label }) => label.trim())
}
