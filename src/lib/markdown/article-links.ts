import type { Root } from "hast"
import { visit } from "unist-util-visit"
import { imageCandidates } from "./resources.ts"

export function resolveArticleLinks(root: Root, canonical: URL, namespace: string | undefined, base: string) {
  const ids = new Set<string>()
  const prefix = base.replace(/\/$/u, "")
  const scoped = (id: string) => (namespace && ids.has(id) ? namespace + "-" + id : id)
  if (namespace) {
    visit(root, "element", ({ tagName, properties }) => {
      if (typeof properties.id === "string") ids.add(properties.id)
      if (tagName === "a" && typeof properties.name === "string") ids.add(properties.name)
    })
  }
  const resolve = (value: string, fragment = false) => {
    if (value.startsWith("#")) {
      if (!namespace || !fragment) return value
      return ids.has(decodeFragment(value.slice(1))) ? "#" + namespace + "-" + value.slice(1) : canonical.pathname + value
    }
    if (/^(?:\/\/|[a-z][a-z+\d.-]*:)/iu.test(value)) return value
    const path = value.startsWith("/") && prefix && !value.startsWith(prefix + "/") && value.split(/[?#]/u, 1)[0] !== prefix ? prefix + value : value
    const url = new URL(path, canonical)
    if (fragment && namespace && url.pathname === canonical.pathname && !url.search && url.hash && ids.has(decodeFragment(url.hash.slice(1)))) {
      return "#" + namespace + "-" + url.hash.slice(1)
    }
    return url.pathname + url.search + url.hash
  }
  visit(root, "element", ({ tagName, properties }) => {
    if (typeof properties.id === "string") properties.id = scoped(properties.id)
    if (tagName === "a" && typeof properties.name === "string") properties.name = scoped(properties.name)
    if (namespace) {
      for (const key of [
        "ariaDescribedBy",
        "ariaLabelledBy",
        "ariaControls",
        "ariaDetails",
        "ariaOwns",
        "ariaActiveDescendant",
        "ariaErrorMessage",
        "htmlFor",
        "headers",
        "list",
        "form"
      ]) {
        const values = properties[key]
        if (Array.isArray(values)) properties[key] = values.map((value) => (typeof value === "string" ? scoped(value) : value))
        else if (typeof values === "string") properties[key] = values.split(/\s+/u).map(scoped).join(" ")
      }
    }
    for (const key of ["href", "src", "poster", "xLinkHref"]) {
      const value = properties[key]
      if (typeof value === "string" && value) properties[key] = resolve(value, key === "href" || key === "xLinkHref")
    }
    if (typeof properties.srcSet === "string") {
      let result = properties.srcSet
      for (const { source } of imageCandidates(result).reverse()) {
        result = result.slice(0, source.startOffset) + resolve(source.value) + result.slice(source.startOffset + source.value.length)
      }
      properties.srcSet = result
    }
  })
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
