import type { Element, Root, Text } from "hast"
import { EXIT, visit } from "unist-util-visit"

const punctuation = /[。；：？！….;:!?]/u
const delimiters = new Map(Object.entries({ "(": ")", "[": "]", "【": "】", "（": "）", "「": "」", "『": "』" }))
const closers = new Set(delimiters.values())
const blocks = new Set(["p", "li", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "td", "th", "section"])

function clauseStart(text: string, end: number) {
  const pending: string[] = []
  let start = 0
  for (let i = end - 1; i >= 0; i--) {
    const char = text.charAt(i)
    const close = delimiters.get(char)
    if (punctuation.test(char) || (close && close !== pending.at(-1))) {
      start = i + 1
      break
    }
    if (close) pending.pop()
    else if (closers.has(char)) pending.push(char)
  }
  while (start < end && (punctuation.test(text.charAt(start)) || /\s/u.test(text.charAt(start)))) start++
  return start
}

export function markFootnoteClauses(root: Root) {
  const parents = new Map<Element | Text, Element | Root>()
  const references: Element[] = []
  const usedIds = new Set<string>()
  visit(root, (node, _index, parent) => {
    if (parent && (node.type === "element" || node.type === "text")) parents.set(node, parent)
    if (node.type !== "element") return
    if (typeof node.properties.id === "string") usedIds.add(node.properties.id)
    if (node.properties.dataFootnoteRef !== undefined) references.push(node)
  })

  const insertions = new Map<Text, { offset: number; id: string }[]>()
  for (const reference of references) {
    const id = reference.properties.id
    if (typeof id !== "string") continue
    let ancestor = parents.get(reference)
    let marker = reference
    while (ancestor?.type === "element" && !blocks.has(ancestor.tagName)) {
      if (ancestor.tagName === "sup") marker = ancestor
      ancestor = parents.get(ancestor)
    }
    if (ancestor?.type !== "element") continue
    const nodes: Text[] = []
    let text = ""
    visit(ancestor, (node) => {
      if (node === marker) return EXIT
      if (node.type === "text") {
        nodes.push(node)
        text += node.value
      }
    })
    let end = text.length
    while (end && (punctuation.test(text.charAt(end - 1)) || /\s/u.test(text.charAt(end - 1)))) end--
    let offset = clauseStart(text, end)
    if (offset >= end) continue
    for (const node of nodes) {
      if (offset >= node.value.length) {
        offset -= node.value.length
        continue
      }
      let anchor = id + "-clause"
      while (usedIds.has(anchor)) anchor += "-"
      usedIds.add(anchor)
      reference.properties.dataFootnoteClauseStart = anchor
      const marks = insertions.get(node) ?? []
      marks.push({ offset, id: anchor })
      insertions.set(node, marks)
      break
    }
  }
  for (const [node, marks] of insertions) {
    const parent = parents.get(node)
    if (!parent) continue
    const children: (Text | Element)[] = []
    let start = 0
    for (const { offset, id } of marks.sort((a, b) => a.offset - b.offset)) {
      if (offset > start) children.push({ type: "text", value: node.value.slice(start, offset) })
      children.push({ type: "element", tagName: "span", properties: { id, ariaHidden: "true" }, children: [] })
      start = offset
    }
    children.push({ type: "text", value: node.value.slice(start) })
    parent.children.splice(parent.children.indexOf(node), 1, ...children)
  }
}
