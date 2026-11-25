import type { APIRoute } from "astro"
import { entryPath, entryTitle, published } from "../lib/content"

export const GET: APIRoute = async () => {
  const posts = await published("posts")
  return Response.json(posts.slice(0, 30).map((entry) => ({ title: entryTitle(entry), url: entryPath(entry) })))
}
