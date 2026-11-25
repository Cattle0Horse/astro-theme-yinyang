import type { Root } from "mdast"
import { gfmToMarkdown } from "mdast-util-gfm"
import { mathToMarkdown } from "mdast-util-math"
import { toMarkdown } from "mdast-util-to-markdown"
import { visit } from "unist-util-visit"

export function remarkTableSource() {
  return (tree: Root) => {
    visit(tree, "table", (table) => {
      const markdown = toMarkdown(table, { extensions: [gfmToMarkdown({ tablePipeAlign: false }), mathToMarkdown()] }).trimEnd()
      table.data = { ...table.data, hProperties: { dataTableMarkdown: markdown } }
    })
  }
}
