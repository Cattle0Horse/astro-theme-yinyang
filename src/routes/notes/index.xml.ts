import type { APIRoute } from "astro"
import { feed } from "../../lib/static-output"

export const GET: APIRoute = ({ site, url }) => feed("notes", site ?? url)
