import type { Element } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"
import type { Entry } from "./content"
import { imageCandidates } from "./markdown/resources.ts"
import { addCodeControls, addMathControls, addTableControls } from "./reading-markup.ts"
import { markFootnoteClauses } from "./footnote-markup.ts"

export function articleScope(entry: Entry) {
  return "entry-" + encodeURIComponent(entry.collection + "/" + entry.id).replaceAll("%", "_")
}

export function articleMarkup(html: string, canonical: URL, namespace?: string, base = "/") {
  const root = fromHtml(html, { fragment: true })
  const ids = new Set<string>()
  let hasImages = false
  let hasReader = false
  let hasSidenotes = false
  let hasCode = false
  let codeIndex = 0
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
    if (properties.dataSidenote !== undefined) hasSidenotes = true
    if (properties.dataCodeBlock !== undefined || properties.dataTable !== undefined) hasReader = true
  })
  visit(root, "element", (node, index, parent) => {
    if (node.tagName !== "img" || !parent || index === undefined || (parent.type === "element" && parent.tagName === "picture")) return
    const src = node.properties.src
    if (typeof src !== "string" || /\.svg(?:[?#]|$)/iu.test(src) || src.startsWith("data:image/svg")) return
    const width = Number(node.properties.width)
    const height = Number(node.properties.height)
    const sized = width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)
    const frame: Element = {
      type: "element",
      tagName: "span",
      properties: {
        className: sized ? ["loading-image-frame", "is-loading"] : ["loading-image-frame", "is-loading", "size-unknown"],
        ...(sized && { style: "--image-width:" + width + "px;--image-ratio:" + width + "/" + height })
      },
      children: [node]
    }
    hasImages = true
    parent.children[index] = frame
    return "skip"
  })
  visit(root, "element", (link, index, parent) => {
    if (link.tagName !== "a" || !parent || index === undefined || link.children.length !== 1) return
    const [frame] = link.children
    if (frame?.type !== "element" || !Array.isArray(frame.properties.className) || !frame.properties.className.includes("loading-image-frame")) return
    // The retry button belongs beside the linked image, outside its anchor.
    link.children = frame.children
    frame.children = [link]
    parent.children[index] = frame
    return "skip"
  })
  visit(root, "element", (node) => {
    if (node.properties.dataCodeBlock !== undefined) {
      const pre = node.children.find((child): child is Element => child.type === "element" && child.tagName === "pre")
      if (pre) {
        hasCode = addCodeControls(node, pre, codeIndex++) || hasCode
      }
    }
    if (node.tagName === "table" && typeof node.properties.dataTableMarkdown === "string") addTableControls(node)
    else if (node.properties.dataTable !== undefined) {
      const table = node.children.find((child): child is Element => child.type === "element" && child.tagName === "table")
      if (table) addTableControls(table)
    }
    if (node.tagName === "span" && Array.isArray(node.properties.className) && node.properties.className.includes("katex-display")) {
      hasReader = addMathControls(node) || hasReader
    }
    if (node.tagName === "a") {
      const { dataFootnoteRef, dataFootnoteBackref } = node.properties
      if (dataFootnoteRef !== undefined || dataFootnoteBackref !== undefined) {
        const number = node.children.map((child) => (child.type === "text" ? child.value : "")).join("")
        const label = dataFootnoteBackref !== undefined ? "返回引用处" : "查看脚注 " + number
        node.properties.dataTooltip = label
        node.properties.ariaLabel = label
      }
    }
    if (node.tagName === "section" && node.properties.dataFootnotes !== undefined) {
      node.children.unshift({ type: "element", tagName: "hr", properties: {}, children: [] })
    }
    const { id } = node.properties
    if (!/^h[1-6]$/u.test(node.tagName) || typeof id !== "string" || id.endsWith("footnote-label") || node.properties.ariaHidden === "true") return
    node.children.push({
      type: "element",
      tagName: "a",
      properties: { className: ["heading-permalink"], href: "#" + encodeURIComponent(id), ariaLabel: "章节链接", dataAstroReload: "" },
      children: []
    })
  })
  markFootnoteClauses(root)
  return { html: toHtml(root), hasImages, hasSidenotes, hasCode, hasReader }
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
