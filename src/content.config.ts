import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"
import { contentId, validDate } from "./lib/content-format"

const date = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value))
  .refine(validDate, "Use YYYY-MM-DD or an ISO timestamp with a timezone")
const common = {
  date,
  draft: z.boolean().default(false),
  description: z.string().optional(),
  toc: z.boolean().default(true),
  ai: z.enum(["none", "assisted", "generated"]).optional(),
  cover: z.string().optional()
}
const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/index.md", generateId: ({ entry }) => contentId(entry) }),
  schema: z.object({ ...common, title: z.string().trim().min(1), tags: z.array(z.string().trim().min(1)).default([]) })
})
const notes = defineCollection({
  loader: glob({ base: "./src/content/notes", pattern: "[0-9][0-9][0-9][0-9]-{01,02,03,04,05,06,07,08,09,10,11,12}/[0-9][0-9][0-9].md", generateId: ({ entry }) => contentId(entry) }),
  schema: z.object({
    ...common,
    title: z.string().trim().optional(),
    note_tags: z.array(z.string().trim().min(1)).default([]),
    source: z.union([z.string(), z.array(z.string())]).optional()
  })
})

export const collections = { posts, notes }
