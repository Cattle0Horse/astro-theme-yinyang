import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"

export function prepareImageFrames(root: Root) {
  let hasImages = false
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
  return hasImages
}
