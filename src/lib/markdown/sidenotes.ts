import type { Blockquote, Html, Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from "mdast"
import { visit } from "unist-util-visit"
import GithubSlugger from "github-slugger"

const marker = /^<!--[ \t]*(\/?)sidenote:(\d+)[ \t]*-->$/u
const definition = /^<!--[ \t]*sidenote:(\d+)[ \t]*\r?\n([^]*?)\r?\n[ \t]*-->$/u
const prefix = "\uE001"

interface Note {
  opens: Html[]
  closes: Html[]
  definitions: Html[]
  body?: { source: string; tree: Root }
}

function span(children: PhrasingContent[], ids: string[]): PhrasingContent {
  return { type: "emphasis", children, data: { hName: "span", hProperties: { dataSidenoteRefs: ids.join(" ") } } }
}

function disclosure(id: string, body: RootContent[]): Blockquote {
  const summary: Paragraph = { type: "paragraph", children: [{ type: "text", value: "旁注 " + id }], data: { hName: "summary" } }
  return {
    type: "blockquote",
    children: [summary, ...(body as Blockquote["children"])],
    data: { hName: "details", hProperties: { dataSidenote: id } }
  }
}

function scopeHeadings(note: Root, id: string) {
  const slugger = new GithubSlugger()
  const headings = new Map<string, string>()
  visit(note, "heading", (heading) => {
    const parts: string[] = []
    visit(heading, (node) => {
      if ("value" in node && typeof node.value === "string") parts.push(node.value)
    })
    const slug = slugger.slug(parts.join(""))
    const target = "sidenote-" + id + "-" + slug
    headings.set("#" + slug, "#" + target)
    heading.data = { ...heading.data, hProperties: { id: target } }
  })
  visit(note, "link", (link) => {
    link.url = headings.get(link.url) ?? link.url
  })
}

function footnoteLabels(tree: Root, source: string) {
  const labels = new Map<string, string>()
  visit(tree, "footnoteDefinition", ({ identifier, position }) => {
    const offset = position?.start.offset
    if (offset === undefined) return
    const declaration = /^\[\^(?:\\.|[^\r\n\\\]])+\]:/u.exec(source.slice(offset))?.[0]
    if (declaration) labels.set(identifier, declaration)
  })
  return labels
}

export function remarkSidenotes(this: { parse: (source: string) => unknown }) {
  const parse = (source: string) => this.parse(source) as Root
  return (tree: Root, file: { toString: () => string; message: (message: string, node: Html) => unknown }) => {
    // CommonMark consumes the entire line as HTML when a range marker starts it.
    const lineStarts: number[] = []
    visit(tree, "html", (node) => {
      if (/^<!--[ \t]*\/?sidenote:\d+[ \t]*-->./u.test(node.value) && node.position?.start.offset !== undefined) {
        lineStarts.push(node.position.start.offset)
      }
    })
    let source = file.toString()
    if (lineStarts.length) {
      for (const offset of lineStarts.sort((a, b) => b - a)) source = source.slice(0, offset) + prefix + source.slice(offset)
      tree.children = parse(source).children
    }

    const notes = new Map<string, Note>()
    const get = (id: string) => {
      const note = notes.get(id) ?? { opens: [], closes: [], definitions: [] }
      notes.set(id, note)
      return note
    }
    visit(tree, "html", (node) => {
      const boundary = marker.exec(node.value)
      const content = definition.exec(node.value)
      if (boundary) get(boundary[2])[boundary[1] ? "closes" : "opens"].push(node)
      if (content) get(content[1]).definitions.push(node)
    })
    for (const [id, note] of notes) {
      const opening = note.opens[0]
      const closing = note.closes[0]
      const text = note.definitions[0] && definition.exec(note.definitions[0].value)?.[2]?.trim()
      if (note.opens.length === 1 && note.closes.length === 1 && note.definitions.length === 1 && text && (opening.position?.start.offset ?? 0) < (closing.position?.start.offset ?? 0)) {
        note.body = { source: text, tree: parse(text) }
      } else {
        file.message("旁注 " + id + " 需要一组起止标记和一份非空定义。", opening ?? closing ?? note.definitions[0])
      }
    }

    const bodies = [...notes.values()].flatMap(({ body }) => (body ? [body] : []))
    if (bodies.length) {
      const documents = [{ tree, source }, ...bodies].map((document) => ({ ...document, labels: footnoteLabels(document.tree, document.source) }))
      const shared = new Map(documents.flatMap(({ labels }) => [...labels]))
      for (const document of documents) {
        const external = [...shared].filter(([id]) => !document.labels.has(id)).map(([, declaration]) => declaration + " reference")
        if (!external.length) continue
        // GFM recognizes references only when their definitions are visible during parsing.
        const prelude = external.join("\n\n") + "\n\n<!-- -->\n\n"
        document.tree.children = parse(prelude + document.source).children.filter((node) => (node.position?.start.offset ?? 0) >= prelude.length)
      }
      for (const [id, { body }] of notes) {
        if (body) scopeHeadings(body.tree, id)
      }
    }

    const active = new Set<string>()
    const pending: string[] = []

    function walk(parent: Parent, flow: boolean) {
      const output: RootContent[] = []
      for (const child of parent.children as RootContent[]) {
        if (child.type === "html") {
          const boundary = marker.exec(child.value)
          if (boundary) {
            const id = boundary[2]
            if (notes.get(id)?.body) {
              if (boundary[1]) active.delete(id)
              else {
                active.add(id)
                pending.push(id)
              }
            }
            if (flow) {
              output.push(...pending.splice(0).map((id) => disclosure(id, notes.get(id)!.body!.tree.children)))
            }
            continue
          }
          if (definition.test(child.value)) continue
        }
        if (child.type === "text") {
          const node = child as Text
          if (lineStarts.length) node.value = node.value.replaceAll(prefix, "")
          if (!node.value) continue
          const ids = [...active]
          output.push((ids.length ? span([node], ids) : node) as RootContent)
          continue
        }
        if ("children" in child) {
          walk(child as Parent, child.type === "blockquote" || child.type === "listItem")
        } else if (active.size && (child.type as string) === "inlineCode") {
          output.push(span([child as PhrasingContent], [...active]) as RootContent)
          continue
        }
        output.push(child)
        if (flow) {
          output.push(...pending.splice(0).map((id) => disclosure(id, notes.get(id)!.body!.tree.children)))
        }
      }
      parent.children = output
    }

    walk(tree, true)
  }
}
