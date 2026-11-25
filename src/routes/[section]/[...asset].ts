import type { APIRoute } from "astro"
import { staticFiles, staticResponse } from "../../lib/static-output"

export const getStaticPaths = staticFiles

export const GET: APIRoute = ({ props }) => staticResponse(props.source)
