import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const pm = process.env.npm_execpath ?? "pnpm"
const temp = await mkdtemp(join(tmpdir(), "yinyang-distribution-"))
const consumer = join(temp, "site")

function run(command: string, args: string[], cwd: string, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", windowsHide: true })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout
}

function pnpm(args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  return /\.[cm]?js$/u.test(pm) ? run(process.execPath, [pm, ...args], cwd, env) : run(pm, args, cwd, env)
}

function build(base: string) {
  pnpm(["build"], consumer, { ...process.env, SITE_BASE: base, SITE_URL: "https://example.com" })
}

const output = (path: string) => readFile(join(consumer, "dist", path), "utf8")

try {
  const initial = join(temp, "theme.tgz")
  pnpm(["pack", "--out", initial, "--silent"], root)
  const files = run("tar", ["-tf", initial], root).split(/\r?\n/u)
  assert.ok(!files.some((file) => /^package\/(?:src\/content\/|starter\/|tests\/)/u.test(file)))

  await cp(join(root, "starter"), consumer, { recursive: true })
  pnpm(["add", initial], consumer)
  build("/")
  assert.match(await output("index.html"), /我的博客/u)
  assert.match(await output("index.html"), /href="\/logo\.png"/u)
  assert.match(await output("posts/hello/index.html"), /第一篇文章/u)
  assert.deepEqual(await readdir(join(consumer, "dist/posts")), ["hello"])

  await rm(join(consumer, "src/content/posts/hello/index.md"))
  build("/")
  assert.doesNotMatch(await output("index.xml"), /<item>/u)

  const config = await readFile(join(consumer, "astro.config.ts"), "utf8")
  const filesToKeep = {
    "astro.config.ts": config.replace("我的博客", "我的独立博客"),
    "src/content/posts/nested/mine/index.md": '---\ntitle: "我的文章"\ndate: 2026-01-01\n---\n\n$\\ce{H2O}$ [附件](attachment.txt)\n',
    "src/content/posts/nested/mine/attachment.txt": "my attachment\n",
    "src/content/notes/2026-01/001.md": '---\ndate: 2026-01-01\ntitle: "我的笔记"\n---\n\nThis note belongs to the site.\n'
  }
  for (const [path, contents] of Object.entries(filesToKeep)) {
    const file = join(consumer, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, contents)
  }

  // Repack the same sources with a higher test version to exercise a dependency-only upgrade.
  run("tar", ["-xf", initial, "-C", temp], root)
  const unpacked = join(temp, "package")
  const manifestPath = join(unpacked, "package.json")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const [major, minor, patch] = manifest.version.split("-")[0].split(".").map(Number)
  const nextVersion = `${major}.${minor}.${patch + 1}`
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: nextVersion }))
  const next = join(temp, "theme-next.tgz")
  pnpm(["pack", "--out", next, "--silent"], unpacked)
  pnpm(["add", next], consumer)
  build("/my-blog")

  const installed = JSON.parse(await readFile(join(consumer, "node_modules/astro-theme-yinyang/package.json"), "utf8"))
  assert.equal(installed.version, nextVersion)
  for (const [path, contents] of Object.entries(filesToKeep)) assert.deepEqual(await readFile(join(consumer, path)), Buffer.from(contents), path)
  const article = await output("posts/nested/mine/index.html")
  assert.match(await output("index.html"), /我的独立博客/u)
  assert.match(article, /我的文章/u)
  assert.match(article, /class="katex"/u)
  assert.match(article, /href="\/my-blog\/posts\/nested\/mine\/attachment\.txt"/u)
  assert.equal(await output("posts/nested/mine/attachment.txt"), "my attachment\n")
  assert.match(await output("notes/2026-01/001/index.html"), /我的笔记/u)
  assert.match(await output("404.html"), /href="\/my-blog\/logo\.png"/u)
  assert.match(await output("sitemap.xml"), /https:\/\/example\.com\/my-blog\/posts\/nested\/mine\//u)
  assert.deepEqual(await readdir(join(consumer, "dist/posts")), ["nested"])
  console.log("Packed theme installed and upgraded in a standalone site. Root and subpath builds passed.")
} finally {
  await rm(temp, { recursive: true, force: true })
}
