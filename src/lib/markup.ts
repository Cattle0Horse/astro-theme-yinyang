import type { Element } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"
import type { Entry } from "./content"
import { resolveArticleLinks } from "./markdown/article-links.ts"
import { prepareImageFrames } from "./image-markup.ts"
import { addCodeControls, addMathControls, addTableControls } from "./reading-markup.ts"
import { addFootnoteMarkup, markFootnoteClauses } from "./footnote-markup.ts"

export function articleScope(entry: Entry) {
  return "entry-" + encodeURIComponent(entry.collection + "/" + entry.id).replaceAll("%", "_")
}

export function articleMarkup(html: string, canonical: URL, namespace?: string, base = "/") {
  const root = fromHtml(html, { fragment: true })
  resolveArticleLinks(root, canonical, namespace, base)
  const hasImages = prepareImageFrames(root)

  let hasReadingActions = false
  let hasSidenotes = false
  let hasCodeFolds = false
  let codeIndex = 0
  visit(root, "element", (node) => {
    if (node.properties.dataSidenote !== undefined) hasSidenotes = true
    if (node.properties.dataCodeBlock !== undefined || node.properties.dataTable !== undefined) hasReadingActions = true
    if (node.properties.dataCodeBlock !== undefined) {
      const pre = node.children.find((child): child is Element => child.type === "element" && child.tagName === "pre")
      if (pre) {
        hasCodeFolds = addCodeControls(node, pre, codeIndex++) || hasCodeFolds
      }
    }
    if (node.tagName === "table" && typeof node.properties.dataTableMarkdown === "string") addTableControls(node)
    else if (node.properties.dataTable !== undefined) {
      const table = node.children.find((child): child is Element => child.type === "element" && child.tagName === "table")
      if (table) addTableControls(table)
    }
    if (node.tagName === "span" && Array.isArray(node.properties.className) && node.properties.className.includes("katex-display")) {
      hasReadingActions = addMathControls(node) || hasReadingActions
    }
    addFootnoteMarkup(node)
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
  return { html: toHtml(root), hasImages, hasSidenotes, hasCodeFolds, hasReadingActions }
}
