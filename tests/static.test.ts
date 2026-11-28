import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { createMarkdownProcessor } from "@astrojs/markdown-remark"
import type { Element } from "hast"
import { fromHtml } from "hast-util-from-html"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"
import { remarkLegacyMath } from "../src/lib/markdown/legacy-math.ts"
import { articleMarkup } from "../src/lib/markup.ts"

const dist = process.env.TEST_DIST ?? "dist"
const file = (name: string) => readFile(dist + "/" + name, "utf8")
const article = "posts/reading/markdown/"
const base = process.env.SITE_BASE?.replace(/\/$/u, "") ?? ""

test("resolves embedded reading resources and keeps local references with their entry", () => {
  const { html } = articleMarkup(
    '<label for="field">Label</label><input id="field"><a name="legacy"></a><a href="#legacy">Anchor</a><a href="./#field">Field</a>' +
      '<img src="/logo.png" srcset="data:image/png;base64,A 1x, ./cover.png 2x, /blog/icon.png 3x"><a href="//example.org/docs">External</a>',
    new URL("https://example.com/blog/notes/2026-11/003/"),
    "note",
    "/blog/"
  )
  assert.match(html, /for="note-field"/u)
  assert.match(html, /id="note-field"/u)
  assert.match(html, /name="note-legacy"/u)
  assert.match(html, /href="#note-legacy"/u)
  assert.match(html, /href="#note-field"/u)
  assert.match(html, /src="\/blog\/logo\.png"/u)
  assert.match(html, /srcset="data:image\/png;base64,A 1x, \/blog\/notes\/2026-11\/003\/cover\.png 2x, \/blog\/icon\.png 3x"/u)
  assert.match(html, /href="\/\/example\.org\/docs"/u)
})

test("renders nested content, original Markdown and the referenced source image", async () => {
  const home = await file("index.html")
  const html = await file(article + "index.html")
  const source = await file(article + "index.md")
  const body = await file(article + "body.md")
  assert.ok(home.includes('href="' + base + "/" + article + '"'))
  assert.match(html, /<strong><span data-sidenote-refs="1">阅读<\/span><\/strong>/u)
  assert.match(html, /data-sidenote-refs="1 2">记录/u)
  assert.match(html, /<details data-sidenote="1">/u)
  assert.match(html, /class="katex-display"/u)
  assert.match(html, /data-footnote-ref/u)
  assert.ok(html.includes(base + "/_astro/"))
  assert.ok(source.includes("<!-- sidenote:1 -->**阅读**"))
  assert.ok(source.includes("./附件/阅读背景.png"))
  assert.ok(source.startsWith("---"))
  assert.ok(body.startsWith("##"))
  assert.ok(source.includes(body))
  assert.ok(!html.includes(body.slice(0, 100)))
  const attachment = await readFile(dist + "/" + article + "附件/阅读背景.png")
  assert.equal(attachment.subarray(1, 4).toString(), "PNG")
})

test("preserves straight quotes and double hyphens in Chinese prose", async () => {
  const [post, note] = await Promise.all([file("posts/ai-engineering-probabilistic-model-feedback-system/index.html"), file("notes/2026-10/001/index.html")])
  assert.match(post, /类似"理解"的能力/u)
  assert.match(note, /原因--LLM/u)
})

test("only pages with the corresponding reading feature include its bootstrap", async () => {
  const homepage = await file("index.html")
  const fallback = await file("404.html")
  const code = await file("posts/syntax-highlighting-test/index.html")
  const sidenotes = await file("posts/sidenote-demo/index.html")
  const inlineScripts = (html: string) => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)].map((match) => match[1]).join("\n")
  for (const html of [homepage, fallback]) assert.doesNotMatch(inlineScripts(html), /\[data-has-(sidenotes|code-folds)\]/u)
  assert.match(inlineScripts(code), /\[data-has-code-folds\]/u)
  assert.doesNotMatch(inlineScripts(code), /\[data-has-sidenotes\]/u)
  assert.match(inlineScripts(sidenotes), /\[data-has-sidenotes\]/u)
})

test("keeps Blog and Notes feeds separate and scopes repeated Notes IDs", async () => {
  const blog = await file("index.xml")
  const notes = await file("notes/index.xml")
  assert.ok(notes.split("<item>", 1)[0]?.includes(base + "/notes/</link>"))
  const timeline = await file("notes/index.html")
  assert.ok(timeline.includes('src="' + base + '/logo.png"'))
  const tree = fromHtml(timeline)
  const ids = new Set<string>()
  visit(tree, "element", ({ properties }) => {
    if (typeof properties.id !== "string") return
    assert.ok(!ids.has(properties.id), "duplicate ID " + properties.id)
    ids.add(properties.id)
  })
  assert.equal(Array.from(ids).filter((id) => id.endsWith("-摘录")).length, 2)
  assert.match(blog, /<guid[^>]*>https:\/\/[^<]+\/posts\/reading\/markdown\/<\/guid>/u)
  assert.match(notes, /<guid[^>]*>https:\/\/[^<]+\/notes\/2026-11\/001\/<\/guid>/u)
  assert.doesNotMatch(blog, /\/notes\/2026-11\//u)
  assert.doesNotMatch(notes, /\/posts\//u)
  assert.match(await file("404.html"), /返回首页/u)
})

test("sidenotes and body share a numbered footnote list in each published entry", async () => {
  for (const path of ["posts/sidenote-demo/", "notes/2026-11/003/", "notes/"]) {
    const page = fromHtml(await file(path + "index.html"))
    let checked = false
    visit(page, "element", (reading) => {
      if (!Array.isArray(reading.properties.className) || !reading.properties.className.includes("reading")) return
      const references: Element[] = []
      const sidenoteReferences: Element[] = []
      const lists: Element[] = []
      let hasMath = false
      visit(reading, "element", (node) => {
        if (node.properties.dataFootnotes !== undefined) lists.push(node)
        if (node.properties.dataFootnoteRef !== undefined) references.push(node)
        if (node.tagName !== "details" || node.properties.dataSidenote === undefined) return
        visit(node, "element", (child) => {
          assert.equal(child.properties.dataFootnotes, undefined)
          if (child.tagName === "math") hasMath = true
          if (child.properties.dataFootnoteRef !== undefined) sidenoteReferences.push(child)
        })
      })
      if (!sidenoteReferences.length) return
      checked = true
      assert.ok(hasMath, "Expected rendered math in the sidenote")
      assert.equal(lists.length, 1)
      const list = lists[0]
      assert.ok(list)
      const hasParent = (reference: Element) => sidenoteReferences.includes(reference)
      const number = (reference: Element) => reference.children.map((node) => (node.type === "text" ? node.value : "")).join("")
      for (const side of sidenoteReferences) {
        const body = references.find((reference) => !hasParent(reference) && reference.properties.href === side.properties.href)
        assert.ok(body, "body and sidenote link to the same footnote")
        assert.equal(number(body), number(side))
        const id = decodeURIComponent(String(side.properties.href).slice(1))
        const backlinks = new Set<string>()
        visit(list, "element", (item) => {
          if (item.properties.id !== id) return
          visit(item, "element", ({ properties }) => {
            if (properties.dataFootnoteBackref !== undefined) backlinks.add(String(properties.href))
          })
        })
        assert.ok(backlinks.has("#" + body.properties.id) && backlinks.has("#" + side.properties.id))
      }
    })
    assert.ok(checked, "Expected a shared footnote on " + path)
  }
})

test("publishes a sitemap with content, taxonomy, and feed routes", async () => {
  const sitemap = await file("sitemap.xml")
  assert.match(sitemap, /<urlset[^>]+sitemaps\.org\/schemas\/sitemap\/0\.9/u)
  assert.match(sitemap, /\/posts\/math-demo\//u)
  assert.match(sitemap, /\/notes\//u)
  assert.match(sitemap, /\/tags\/math\//u)
  assert.doesNotMatch(sitemap, /unpublished/u)
  assert.equal((sitemap.match(/<url>/gu) ?? []).length, new Set(sitemap.match(/<loc>([^<]+)/gu)).size)
})

test("renders Hugo display math and chemistry without swallowing later sections", async () => {
  const page = fromHtml(await file("posts/math-demo/index.html"))
  const headings = new Set<string>()
  const chemistry: string[] = []
  const errors: string[] = []
  let display = 0
  let tables = 0
  visit(page, "element", (element) => {
    if (element.tagName === "h2" && typeof element.properties.id === "string") headings.add(element.properties.id)
    if (element.tagName === "mtable") tables++
    const classes = element.properties.className
    if (Array.isArray(classes) && classes.includes("katex-display")) display++
    const text = element.children.map((node) => (node.type === "text" ? node.value : "")).join("")
    if (element.tagName === "annotation" && text.startsWith("\\ce{")) chemistry.push(text)
    if (element.tagName === "mstyle" && (element.properties.mathcolor ?? element.properties.mathColor) === "#cc0000") {
      visit(element, "text", (node) => {
        errors.push(node.value)
      })
    }
  })
  for (const id of ["矩阵", "分段函数", "多行对齐", "希腊字母与运算符", "化学式", "错误兜底"]) assert.ok(headings.has(id), "Missing section: " + id)
  assert.equal(display, 13)
  assert.ok(tables >= 3, "Expected rendered matrix, cases, and aligned rows")
  assert.equal(chemistry.length, 2)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /\\notacommand/u)
  assert.equal(await file("posts/math-demo/index.md"), await readFile("src/content/posts/math-demo/index.md", "utf8"))
})

test("excludes non-entry documents, drafts, and draft-only attachments", async () => {
  await assert.rejects(file("posts/reading/markdown/workspace/index.html"), { code: "ENOENT" })
  for (const path of ["index.html", "index.md", "draft-only.txt"]) {
    await assert.rejects(file("posts/unpublished/" + path), { code: "ENOENT" })
  }
  assert.doesNotMatch(await file("index.xml"), /unpublished/u)
})

test("keeps text and later formulas after an unclosed legacy display", async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkMath, remarkLegacyMath], rehypePlugins: [rehypeKatex] })
  for (const tail of ["", "\n\n$$2+2$$"]) {
    const { code } = await processor.render("$$x = 1\n\n## Heading\n\nFollowing paragraph" + tail)
    assert.match(code, /<p>\$\$x = 1<\/p>/u)
    assert.match(code, /<h2\b[^>]*>Heading<\/h2>/u)
    assert.match(code, /<p>Following paragraph<\/p>/u)
    assert.equal((code.match(/class="katex-display"/gu) ?? []).length, tail ? 1 : 0)
  }
})
