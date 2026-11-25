import type { APIRoute } from "astro"
import logo from "../assets/logo.png?inline"

export const GET: APIRoute = () => new Response(Buffer.from(logo.split(",", 2)[1], "base64"), { headers: { "Content-Type": "image/png" } })
