import type { Element, Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"
import { imageCandidates } from "./resources"

export function rehypeReading() {
  return (tree: Root, file: { data: { astro?: { frontmatter?: Record<string, unknown> } } }) => {
    const assets = new Set<string>()
    const collect = ({ properties }: Element) => {
      const candidates = typeof properties.srcSet === "string" ? imageCandidates(properties.srcSet).map(({ source }) => source.value) : []
      for (const value of [properties.src, properties.href, properties.poster, ...candidates]) {
        if (typeof value === "string" && !/^(?:#|\?|\/|[a-z][a-z+\d.-]*:)/iu.test(value)) assets.add(value)
      }
    }
    visit(tree, (node: Element | { type: string; value?: unknown }) => {
      if ("properties" in node) collect(node)
      if (node.type === "raw" && "value" in node && typeof node.value === "string") {
        visit(fromHtml(node.value, { fragment: true }), "element", collect)
      }
    })
    if (file.data.astro?.frontmatter) file.data.astro.frontmatter.assetReferences = [...assets]
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined) return
      const properties = node.tagName === "table" ? { className: ["table-scroll"], dataTable: "" } : node.tagName === "pre" ? { dataCodeBlock: "" } : undefined
      if (!properties) return
      const code = node.children[0]
      if (node.tagName === "pre" && code?.type === "element" && code.tagName === "code" && code.children.every((child) => child.type === "text")) {
        const source = code.children
          .map((child) => child.value)
          .join("")
          .replace(/\n$/u, "")
        code.children = source
          .split("\n")
          .flatMap((line, index) => [
            ...(index > 0 ? [{ type: "text" as const, value: "\n" }] : []),
            { type: "element" as const, tagName: "span", properties: { className: ["line"] }, children: [{ type: "text" as const, value: line }] }
          ])
      }
      const wrapper: Element = { type: "element", tagName: "div", properties, children: [node] }
      parent.children[index] = wrapper
      return ["skip", index + 1]
    })
  }
}
