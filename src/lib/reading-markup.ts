import type { Element } from "hast"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ChevronDown, ListOrdered, WrapText } from "lucide-react"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"
import { CopyFeedback } from "../components/ui/CopyFeedback.ts"
import { IconButton } from "../components/ui/IconButton.ts"

import { codeFoldThreshold } from "./code-block.ts"

function codeLanguage(pre: Element) {
  if (typeof pre.properties.dataLanguage === "string") return pre.properties.dataLanguage
  const code = pre.children.find((node): node is Element => node.type === "element" && node.tagName === "code")
  const classes = code?.properties.className
  return Array.isArray(classes)
    ? classes
        .find((value) => typeof value === "string" && value.startsWith("language-"))
        ?.toString()
        .slice(9)
    : undefined
}

function actionButton(label: string, action: "copy" | "lines" | "wrap", icon: ReturnType<typeof createElement>) {
  const attributes = { "data-reading-action": action, "aria-pressed": action === "copy" ? undefined : false }
  return createElement(IconButton, { label, ...attributes }, icon)
}

function copyControl(label: string) {
  return createElement(
    "span",
    { className: "inline-flex items-center" },
    actionButton(label, "copy", createElement(CopyFeedback)),
    createElement("span", { role: "status", className: "sr-only" })
  )
}

function mathSource(display: Element) {
  let source = ""
  visit(display, "element", (node) => {
    if (node.tagName !== "annotation" || node.properties.encoding !== "application/x-tex") return
    visit(node, "text", ({ value }) => {
      source += value
    })
    return "skip"
  })
  return source
}

export function addMathControls(display: Element) {
  if (display.properties.dataMathControls !== undefined) return false
  const formula = display.children.find((child): child is Element => child.type === "element" && Array.isArray(child.properties.className) && child.properties.className.includes("katex"))
  if (!formula) return false
  const source = mathSource(formula)
  if (!source) return false
  display.properties.dataMathBlock = ""
  display.properties.dataMathSource = source
  formula.children.push(...renderMarkup(createElement("span", { className: "math-actions", "data-enhancement": "" }, copyControl("复制公式"))))
  display.properties.dataMathControls = ""
  return true
}

function renderMarkup(node: ReturnType<typeof createElement>) {
  return fromHtml(renderToStaticMarkup(node), { fragment: true }).children.filter((child): child is Element => child.type === "element")
}

export function addCodeControls(block: Element, pre: Element, index: number) {
  const language = codeLanguage(pre)
  let code = ""
  visit(pre, "text", ({ value }) => {
    code += value
  })
  const lines = code.trimEnd().split("\n").length
  const toolbar = createElement(
    "div",
    { className: language ? "code-actions code-toolbar" : "code-actions", "data-code-actions": "" },
    language && createElement("span", { className: "code-language" }, language),
    createElement(
      "div",
      { "data-code-controls": "" },
      actionButton("显示行号", "lines", createElement(ListOrdered, { "aria-hidden": true })),
      actionButton("开启自动换行", "wrap", createElement(WrapText, { "aria-hidden": true })),
      copyControl("复制代码")
    )
  )
  block.children.unshift(...renderMarkup(toolbar))
  if (lines <= codeFoldThreshold) return false
  pre.properties.dataCollapsed = ""
  pre.properties.dataCodeIndex = index
  block.children.push({
    type: "element",
    tagName: "div",
    properties: { className: ["code-fold"], dataCodeFold: "" },
    children: renderMarkup(
      createElement(
        "button",
        {
          type: "button",
          className: "code-fold-button icon-button",
          "data-code-lines": lines,
          "aria-expanded": false,
          "aria-label": "展开代码"
        },
        createElement(ChevronDown, { "aria-hidden": true }),
        createElement("span", null, "展开全部 (" + lines + " 行)")
      )
    )
  })
  return true
}

export function addTableControls(table: Element) {
  if (table.properties.dataTableControls !== undefined) return
  if (typeof table.properties.dataTableMarkdown !== "string") {
    const rows: Element[] = []
    visit(table, "element", (node) => {
      if (node !== table && node.tagName === "table") return "skip"
      if (node.tagName === "tr") rows.push(node)
    })
    const width = Math.max(0, ...rows.map((row) => row.children.filter((cell) => cell.type === "element").length))
    if (!width) return false
    const cells = (row: Element) => row.children.filter((cell): cell is Element => cell.type === "element" && (cell.tagName === "td" || cell.tagName === "th"))
    const format = (values: string[]) => "| " + values.join(" | ") + " |"
    const data = rows.map((row) => {
      const values = cells(row)
      return format(
        Array.from({ length: width }, (_, index) => {
          let value = ""
          if (values[index])
            visit(values[index], "text", (text) => {
              value += text.value
            })
          return value
            .replaceAll("|", "\\|")
            .replace(/\s*\r?\n\s*/gu, " ")
            .trim()
        })
      )
    })
    const heading = cells(rows[0])
    data.splice(
      1,
      0,
      format(
        Array.from({ length: width }, (_, index) => {
          const properties = heading[index]?.properties
          const alignment = typeof properties?.style === "string" ? /(?:^|;)\s*text-align:\s*(left|center|right)\b/u.exec(properties.style)?.[1] : undefined
          const value = alignment ?? properties?.align
          return value === "center" ? ":---:" : value === "right" ? "---:" : value === "left" ? ":---" : "---"
        })
      )
    )
    table.properties.dataTableMarkdown = data.join("\n")
  }
  let caption = table.children.find((child): child is Element => child.type === "element" && child.tagName === "caption")
  if (!caption) {
    caption = { type: "element", tagName: "caption", properties: {}, children: [] }
    table.children.unshift(caption)
  }
  caption.children.unshift(...renderMarkup(createElement("div", { className: "table-actions", "data-enhancement": "" }, copyControl("复制 Markdown 表格"))))
  table.properties.dataTableControls = ""
}
