import type { Entry } from "./content"
import { site } from "../site.config"

function githubEdit(repository: string, branch: string, path: string) {
  return new URL(repository + "/edit/" + (branch + "/" + path).split("/").map(encodeURIComponent).join("/"), "https://github.com").href
}

export function articleEditUrl(entry: Entry) {
  const repository = site.editPage.repository?.replace(/^https:\/\/github\.com\//u, "").replace(/\/+$/u, "")
  const filePath = entry.filePath?.replaceAll("\\", "/")
  if (repository && /^[\w.-]+\/[\w.-]+$/u.test(repository) && filePath) return githubEdit(repository, site.editPage.branch, filePath)
}
