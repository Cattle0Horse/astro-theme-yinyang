import { expect, test } from "@playwright/test"

const article = "/posts/reading/markdown/"

test("restores the article scroll position and copies its code", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.setViewportSize({ width: 1000, height: 500 })
  await page.goto(article)
  const code = page.locator(".reading pre")
  await expect(code).toHaveAttribute("data-collapsed", "")
  await page.getByRole("button", { name: "显示行号" }).click()
  await expect(code).toHaveAttribute("data-line-numbers", "")
  await page.getByRole("button", { name: "开启自动换行" }).click()
  await expect(code).toHaveCSS("white-space", "pre-wrap")
  await page.getByRole("button", { name: "展开代码" }).click()
  await expect(code).not.toHaveAttribute("data-collapsed", "")
  await page.getByRole("button", { name: "复制代码", exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("const observation")
  await page.evaluate(() => window.scrollTo(0, 420))
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(420)
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>(".site-name")?.click())
  await expect(page).toHaveURL(/\/$/u)
  await expect(page.getByRole("heading", { name: "Blog", exact: true })).toBeAttached()
  await page.goBack()
  await expect(page).toHaveURL(/\/posts\/reading\/markdown\/$/u)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(420)
  await expect(page.getByRole("button", { name: "折叠代码" })).toBeVisible()
})

test("refresh uses the saved dark canvas while styles load and paints without waiting for the font CDN", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.addInitScript(() => localStorage.setItem("yinyang:appearance", JSON.stringify({ mode: "dark", palette: "indigo", size: 15 })))
  let releaseTheme!: () => void
  let releaseFont!: () => void
  const theme = new Promise<void>((resolve) => {
    releaseTheme = resolve
  })
  const font = new Promise<void>((resolve) => {
    releaseFont = resolve
  })
  let fontRequested = false
  await page.route(/\/_astro\/[^/]+\.css$/u, async (route) => {
    await theme
    await route.continue()
  })
  await page.route(/cdn\.jsdelivr\.net\/npm\/lxgw-wenkai-gb-web@[^/]+\/[^/]+\/result\.css$/u, async (route) => {
    fontRequested = true
    await font
    await route.fulfill({ status: 503 })
  })
  try {
    await page.goto(article, { waitUntil: "commit" })
    await expect.poll(() => fontRequested).toBe(true)
    const root = page.locator("html")
    await expect(root).toHaveCSS("color-scheme", "dark")
    const canvas = await root.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(canvas).toBe("oklch(0.22 0.005 298)")
    releaseTheme()
    await expect(page.getByRole("heading", { name: "阅读与记录之间" })).toBeVisible()
    await expect.poll(() => page.evaluate(() => performance.getEntriesByName("first-contentful-paint").length)).toBe(1)
    await expect(root).toHaveCSS("background-color", canvas)
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(root).toHaveCSS("background-color", canvas)
    await expect.poll(() => page.evaluate(() => performance.getEntriesByName("first-contentful-paint").length)).toBe(1)
  } finally {
    releaseTheme()
    releaseFont()
  }
})

test("all five typography groups survive client navigation and reload", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const size = page.getByRole("slider", { name: "全站字号" })
  const fontTrigger = page.getByRole("button", { name: "调整字号" })
  const paletteTrigger = page.getByRole("button", { name: "选择主题色" })
  const teal = page.getByRole("button", { name: "青绿" })
  await expect(size).toBeHidden()
  await expect(teal).toBeHidden()
  await fontTrigger.click()
  await expect(size).toBeFocused()
  await size.press("Home")
  for (const [index, title] of [26, 28, 30, 32, 34].entries()) {
    await expect(size).toHaveValue(String(index + 14))
    await expect(page.locator(".site-name")).toHaveCSS("font-size", title + "px")
    if (index < 4) await size.press("ArrowRight")
  }
  await paletteTrigger.click()
  await expect(size).toBeHidden()
  await expect(page.getByRole("button", { name: "靛蓝" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(paletteTrigger).toBeFocused()
  await page.getByRole("button", { name: "明暗模式：跟随系统" }).click()
  await page.getByRole("button", { name: "明暗模式：浅色" }).click()
  await paletteTrigger.click()
  await teal.click()
  await expect(teal).toBeHidden()
  await page.evaluate(() => {
    document.addEventListener(
      "astro:after-swap",
      () => {
        document.body.dataset.swapSize = document.documentElement.dataset.fontSize
      },
      { once: true }
    )
  })
  await page.getByRole("link", { name: "阅读与记录之间" }).click()
  await expect(page).toHaveURL(/\/posts\/reading\/markdown\/$/u)
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "18")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await expect(page.locator("html")).toHaveAttribute("data-palette", "teal")
  await expect(page.locator("body")).toHaveAttribute("data-swap-size", "18")
  await expect(page.locator(".reading")).toHaveCSS("font-size", "18px")
  await expect(page.locator(".reading pre")).toHaveCSS("font-size", "17px")
  await page.reload()
  await expect(page.locator(".reading")).toHaveCSS("font-size", "18px")
  await paletteTrigger.click()
  await expect(teal).toHaveAttribute("aria-pressed", "true")
  expect(errors).toEqual([])
})

test("wide sidenotes stack and appearance remains usable when storage throws", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        value: () => {
          throw new DOMException("Storage disabled", "SecurityError")
        }
      })
    }
  })
  await page.goto(article)
  const panel = page.getByRole("complementary", { name: "旁注", includeHidden: true })
  await expect(panel).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "15")
  await page.getByRole("button", { name: "调整字号" }).click()
  await page.getByRole("slider").press("End")
  await expect(page.locator(".reading")).toHaveCSS("font-size", "18px")
  await page.locator('[data-sidenote-refs="1 2"]').click()
  await expect(panel).toBeVisible()
  const [first, second] = await panel.locator("section").all()
  expect((await first.boundingBox())!.y).toBeLessThan((await second.boundingBox())!.y)
  await page.setViewportSize({ width: 390, height: 812 })
  await expect(panel).toBeHidden()
  await expect(page.getByText("有些线索", { exact: false })).toBeVisible()
})

test("sidenotes stack on desktop and footnote backlinks reopen the mobile sidenote", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/posts/sidenote-demo/")
  const panel = page.getByRole("complementary", { name: "旁注" })
  const separation = () =>
    panel.evaluate((element) => {
      const [first, second] = element.querySelectorAll(":scope > section")
      if (!first || !second) return -1
      return second.getBoundingClientRect().top - first.getBoundingClientRect().bottom
    })
  await expect.poll(separation).toBeGreaterThanOrEqual(10)
  await page.getByRole("button", { name: "调整字号" }).click()
  await page.getByRole("slider", { name: "全站字号" }).press("End")
  await page.keyboard.press("Escape")
  await expect(page.locator(".reading")).toHaveCSS("font-size", "18px")
  await expect.poll(separation).toBeGreaterThanOrEqual(10)

  await page.setViewportSize({ width: 390, height: 812 })
  await page.getByRole("button", { name: "多字节整数的", exact: true }).click()
  const note = page.locator('details[data-sidenote="1"]')
  const reference = note.getByRole("link", { name: "查看脚注 1" })
  const referenceHash = await reference.getAttribute("id")
  await reference.click()
  const footer = page.locator("#user-content-fn-source")
  await expect(footer).toBeVisible()
  await note.locator("summary").click()
  await expect(note).toBeHidden()
  const trigger = page.getByRole("button", { name: "多字节整数的", exact: true })
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await trigger.click()
  await expect(reference).toBeVisible()
  await note.locator("summary").click()
  await footer.locator(`a[href="#${referenceHash}"]`).click()
  await expect(reference).toBeVisible()
  await expect(page).toHaveURL(new RegExp("#" + referenceHash + "$", "u"))
})

test("sidenotes are readable in the sidebar when external scripts fail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  let blocked = false
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "script") return route.fallback()
    blocked = true
    await route.fulfill({ status: 503 })
  })
  await page.goto("/posts/sidenote-demo/")
  await expect.poll(() => blocked).toBe(true)
  const panel = page.getByRole("complementary", { name: "旁注" })
  await expect(panel.getByText("两个字节表示的无符号整数", { exact: false })).toBeVisible()
  await expect(page.locator('details[data-sidenote="1"]')).toBeHidden()
})

test("the saved theme and code toolbar are usable while external scripts are delayed on refresh", async ({ page }) => {
  const path = "/posts/syntax-highlighting-test/"
  await page.addInitScript(() => localStorage.setItem("yinyang:appearance", JSON.stringify({ mode: "dark", palette: "indigo", size: 15 })))
  await page.goto(path)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "script") return route.fallback()
    await pending
    await route.continue()
  })
  await page.reload({ waitUntil: "commit" })
  const block = page.locator("[data-code-block]").first()
  const code = block.locator("pre")
  const toolbar = block.locator(".code-toolbar")
  let before = 0
  let codeOffset = 0
  try {
    await expect(page.locator('[data-mode-icon="dark"]')).toBeVisible()
    await expect(page.locator('[data-mode-icon="system"]')).toBeHidden()
    await expect(page.getByRole("button", { name: "调整字号" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "选择主题色" })).toBeDisabled()
    await expect(toolbar).toContainText("markdown")
    await expect(toolbar.locator("svg:visible")).toHaveCount(3)
    const bounds = (await toolbar.boundingBox())!
    before = bounds.height
    codeOffset = (await code.boundingBox())!.y - bounds.y
    const long = page.locator("[data-code-fold]").first()
    const expand = long.getByRole("button", { name: "展开代码" })
    await expand.click()
    await expect(long.getByRole("button", { name: "折叠代码" })).toBeVisible()
  } finally {
    release()
  }
  await page.waitForLoadState("load")
  await expect(page.getByRole("button", { name: "明暗模式：深色" })).toBeVisible()
  await expect(page.getByRole("button", { name: "调整字号" })).toBeEnabled()
  await toolbar.getByRole("button", { name: "显示行号" }).click()
  await expect(toolbar.getByRole("button", { name: "隐藏行号" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-code-fold]").first().getByRole("button", { name: "折叠代码" })).toHaveCount(1)
  expect((await toolbar.boundingBox())!.height).toBeCloseTo(before, 0)
  expect((await code.boundingBox())!.y - (await toolbar.boundingBox())!.y).toBeCloseTo(codeOffset, 0)
})

test("appearance and copy icons blend between states", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto(article)
  const theme = page.getByRole("button", { name: "明暗模式：跟随系统" })
  const copy = page.getByRole("button", { name: "复制正文 Markdown" })

  for (const [button, outgoing, incoming] of [
    [theme, page.locator('[data-mode-icon="system"]'), page.locator('[data-mode-icon="light"]')],
    [copy, copy.locator(".copy-idle"), copy.locator(".copy-success")]
  ] as const) {
    await expect(outgoing).toHaveCSS("opacity", "1")
    await outgoing.evaluate((icon) => {
      icon.addEventListener("transitionrun", (event) => {
        if (event instanceof TransitionEvent && event.propertyName === "filter") icon.setAttribute("data-test-blur-transition", "")
      })
    })
    await button.click()
    await expect(outgoing).toHaveAttribute("data-test-blur-transition", "")
    await expect(outgoing).toBeHidden()
    await expect(incoming).toHaveCSS("opacity", "1")
  }
})

test("copy buttons suppress repeat writes and extend their feedback on each click", async ({ page }) => {
  await page.addInitScript(() => {
    let writes = 0
    const write = () =>
      new Promise<void>((resolve) => {
        document.body.dataset.clipboardWrites = String(++writes)
        document.addEventListener("finish-copy", () => resolve(), { once: true })
      })

    Object.defineProperty(navigator.clipboard, "write", { value: write })
    Object.defineProperty(navigator.clipboard, "writeText", { value: write })
  })
  await page.goto(article)
  await page.clock.install()
  const finishCopy = () => page.evaluate(() => document.dispatchEvent(new Event("finish-copy")))
  let writes = 0
  for (const label of ["复制正文 Markdown", "复制代码"]) {
    const copy = page.getByRole("button", { name: label, exact: true }).first()
    await copy.click()
    await expect(copy).toHaveAttribute("data-copy-state", "pending")
    await copy.click()
    await expect(page.locator("body")).toHaveAttribute("data-clipboard-writes", String(++writes))
    await finishCopy()
    await expect(copy).toHaveAttribute("data-copy-state", "success")

    await page.clock.runFor(950)
    await copy.click()
    await page.clock.runFor(1000)
    await expect(copy).toHaveAttribute("data-copy-state", "success")
    await expect(page.locator("body")).toHaveAttribute("data-clipboard-writes", String(writes))
    await page.clock.runFor(850)
    await expect(copy).not.toHaveAttribute("data-copy-state")
    await copy.click()
    await expect(page.locator("body")).toHaveAttribute("data-clipboard-writes", String(++writes))
    await finishCopy()
  }
})

test("fetches only the Markdown body when the reader copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const path = "/posts/reading/markdown/body.md"
  const requests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".md")) requests.push(new URL(request.url()).pathname)
  })
  await page.goto(article)
  expect(requests).toEqual([])
  const actions = page.getByRole("group", { name: "原文操作" })
  await actions.getByRole("button", { name: "复制正文 Markdown" }).click()
  await expect(actions.getByRole("status")).toHaveText("已复制")
  expect(requests).toEqual([path])
  const body = await page.evaluate(() => navigator.clipboard.readText())
  expect(body).toContain("const observation")
  expect(body.trimStart()).toMatch(/^##/u)
})

test("sidenotes initialize on the first client navigation to a sidenote page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.evaluate(() => Reflect.set(window, "sidenoteNavigationTest", true))
  await page.getByRole("link", { name: "旁注示例" }).click()
  await expect(page).toHaveURL(/\/posts\/sidenote-demo\/$/u)
  expect(await page.evaluate(() => Reflect.get(window, "sidenoteNavigationTest"))).toBe(true)
  await expect(page.getByRole("complementary", { name: "旁注" })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole("link", { name: "旁注示例" })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole("complementary", { name: "旁注" })).toBeVisible()
})

test("mobile TOC restores focus and sidenotes work with keyboard or pointer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(article)
  await page.getByRole("button", { name: "明暗模式：跟随系统" }).click()
  await page.getByRole("button", { name: "选择主题色" }).click()
  await page.getByRole("button", { name: "青绿" }).click()
  await page.getByRole("button", { name: "调整字号" }).click()
  await page.getByRole("slider", { name: "全站字号" }).press("End")
  await page.keyboard.press("Escape")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  await expect(page.locator("html")).toHaveAttribute("data-palette", "teal")
  await expect(page.locator(".reading")).toHaveCSS("font-size", "18px")
  const trigger = page.getByRole("button", { name: "打开目录" })
  await trigger.click()
  const toc = page.getByRole("dialog")
  await expect(toc).toBeVisible()
  await expect.poll(() => toc.evaluate((element) => getComputedStyle(element).transform)).toBe("none")
  const panel = (await toc.boundingBox())!
  expect(panel.x).toBe(16)
  expect(375 - panel.x - panel.width).toBe(16)
  expect(812 - panel.y - panel.height).toBe(20)
  expect((await toc.getByRole("link").first().boundingBox())!.height).toBeGreaterThanOrEqual(40)
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole("dialog").getByRole("link", { name: "表达与结构" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page).toHaveURL(new RegExp(encodeURIComponent("表达与结构") + "$", "u"))
  await expect(page.locator("html")).not.toHaveAttribute("data-toc-jump", "")
  const first = page.locator('details[data-sidenote="1"]')
  const second = page.locator('details[data-sidenote="2"]')
  await page.locator('[data-sidenote-refs="1"]').first().press("Enter")
  await expect(first).toHaveAttribute("open", "")
  await page.locator('[data-sidenote-refs="1 2"]').click()
  await expect(second).toHaveAttribute("open", "")
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)
})

test("chemistry arrows, fraction bars, and root indices render with the KaTeX stylesheet", async ({ page }) => {
  const hasKatexFont = () => page.evaluate(() => Array.from(document.fonts).some(({ family }) => family === "KaTeX_Main"))
  await page.goto("/")
  await expect.poll(hasKatexFont).toBe(false)
  await page.getByRole("link", { name: "数学公式示例" }).click()
  await expect(page).toHaveURL(/\/posts\/math-demo\/$/u)
  await expect.poll(hasKatexFont).toBe(true)
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const formulas = page.locator(".katex")
    const chemistry = formulas.filter({ has: page.locator("annotation").filter({ hasText: /^\\ce\{/u }) })
    await expect(chemistry).toHaveCount(2)
    for (const reaction of await chemistry.all()) {
      const visual = reaction.locator(".katex-html")
      await expect(visual).not.toContainText("\\ce")
      await expect(visual.locator("svg path").first()).toBeVisible()
    }

    const nestedFraction = formulas.filter({ has: page.locator("annotation").filter({ hasText: /^\\frac\{1\}\{1 \+/u }) })
    const bars = nestedFraction.locator(".katex-html .frac-line")
    await expect(bars).toHaveCount(3)
    for (const bar of await bars.all()) {
      const bounds = await bar.boundingBox()
      expect(bounds?.height ?? 0).toBeGreaterThan(0)
      expect(bounds?.width ?? 0).toBeGreaterThan(0)
      await expect(bar).toHaveCSS("border-bottom-style", "solid")
    }

    const root = formulas.filter({ has: page.locator("annotation").filter({ hasText: /\\sqrt\[3\]/u }) })
    const scale = await root.locator(".katex-html").evaluate((element) => {
      const index = Array.from(element.querySelectorAll(".sqrt span")).find((span) => span.childElementCount === 0 && span.textContent === "3")
      return index ? parseFloat(getComputedStyle(index).fontSize) / parseFloat(getComputedStyle(element).fontSize) : 1
    })
    expect(scale).toBeLessThan(0.7)
  }
})

test("selecting a chemical equation highlights the entire formula and clears on deselection", async ({ page }) => {
  await page.goto("/posts/math-demo/")
  const formula = page.locator(".katex-display").filter({ has: page.locator("annotation").filter({ hasText: /\\ce\{2H2/u }) })
  const visual = formula.locator(".katex-html")
  const glyph = visual.locator(".mord").first()
  await visual.scrollIntoViewIfNeeded()
  const { x, y, width, height } = (await visual.boundingBox())!
  await page.mouse.move(x + 1, y + height / 2)
  await page.mouse.down()
  await page.mouse.move(x + width - 1, y + height / 2, { steps: 8 })
  await page.mouse.up()

  await expect(visual).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  expect(await glyph.evaluate((element) => getComputedStyle(element, "::selection").backgroundColor)).toBe("rgba(0, 0, 0, 0)")
  await expect(visual.locator("svg path").first()).toBeVisible()
  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(visual).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
})

test("display math reveals a ghost copy button and copies its TeX source", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/posts/math-demo/")
  const source = "\\sqrt{2} \\approx 1.414 \\qquad \\sqrt[3]{27} = 3"
  const display = page.locator(".katex-display").filter({ has: page.locator("annotation").filter({ hasText: source }) })
  const copy = display.getByRole("button", { name: "复制公式" })
  const formulaText = display.locator(".katex-html")
  await expect(display.locator(".math-actions")).toHaveCSS("opacity", "0")
  await formulaText.hover()
  await expect(display.locator(".math-actions")).toHaveCSS("opacity", "1")
  await expect(copy).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  const icon = copy.locator(".copy-idle")
  await expect(icon).toHaveCSS("fill", "none")
  await expect(icon.locator("path")).not.toHaveCSS("stroke", "none")
  const iconBounds = (await icon.boundingBox())!
  const formula = await formulaText.boundingBox()
  const button = await copy.boundingBox()
  expect(formula).not.toBeNull()
  expect(button).not.toBeNull()
  const gap = button!.x - (formula!.x + formula!.width)
  expect(gap).toBeGreaterThanOrEqual(0)
  expect(gap).toBeLessThan(12)
  expect(Math.abs(button!.y - formula!.y)).toBeLessThan(6)
  expect(iconBounds.x + iconBounds.width / 2).toBeCloseTo(button!.x + button!.width / 2)
  expect(iconBounds.y + iconBounds.height / 2).toBeCloseTo(button!.y + button!.height / 2)
  await copy.click()
  await expect(copy).toHaveAttribute("data-copy-state", "success")
  await expect(copy.locator(".copy-success")).toHaveCSS("opacity", "1")
  await expect(copy.locator(".copy-success path")).not.toHaveCSS("stroke", "none")
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(source)
})

test("formula copy stays centered after returning by link or browser history", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/posts/math-demo/")
  const blog = page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "Blog" })
  const source = "\\sqrt{2} \\approx 1.414 \\qquad \\sqrt[3]{27} = 3"
  const formula = page.locator(".katex-display").filter({ has: page.locator("annotation").filter({ hasText: source }) })

  for (const byHistory of [false, true]) {
    await blog.click()
    await expect(page.getByRole("link", { name: "数学公式示例" })).toBeVisible()
    if (byHistory) await page.goBack()
    else await page.getByRole("link", { name: "数学公式示例" }).click()

    await formula.locator(".katex-html").hover()
    await expect(formula.locator(".math-actions")).toHaveCSS("opacity", "1")
    const copy = formula.getByRole("button", { name: "复制公式" })
    const icon = copy.locator(".copy-idle")
    await expect(icon).toHaveCSS("width", "16px")
    await expect(icon).toHaveCSS("height", "16px")
    const box = (await copy.boundingBox())!
    const glyph = (await icon.boundingBox())!
    expect(glyph.x + glyph.width / 2).toBeCloseTo(box.x + box.width / 2)
    expect(glyph.y + glyph.height / 2).toBeCloseTo(box.y + box.height / 2)
    await copy.click()
    await expect(copy).toHaveAttribute("data-copy-state", "success")
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(source)
  }
})

test("formula copy displays one icon when clipboard states change quickly", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => new Promise<void>((resolve) => window.setTimeout(resolve, 65))
    })
  })
  await page.goto("/posts/math-demo/")
  const formula = page.locator(".katex-display").first()
  await formula.locator(".katex-html").hover()
  const copy = formula.getByRole("button", { name: "复制公式" })
  const visibleIcons = await copy.evaluate(async (button) => {
    const counts: number[] = []
    return new Promise<number[]>((resolve) => {
      const observer = new MutationObserver(() => {
        counts.push([...button.querySelectorAll("svg")].filter((icon) => getComputedStyle(icon).visibility === "visible").length)
        if (button.getAttribute("data-copy-state") === "success") {
          observer.disconnect()
          resolve(counts)
        }
      })
      observer.observe(button, { attributes: true, attributeFilter: ["data-copy-state"] })
      if (button instanceof HTMLButtonElement) button.click()
    })
  })
  expect(visibleIcons).toEqual([1, 1])
})

test("wide math keeps its copy button within the viewport while scrolling", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto("/posts/math-demo/")
  const formula = page.locator(".katex-display").filter({ has: page.locator("annotation").filter({ hasText: /pmatrix/u }) })
  const copy = formula.getByRole("button", { name: "复制公式" })
  await formula.locator(".katex-html").hover()
  await expect(formula.locator(".math-actions")).toHaveCSS("opacity", "1")
  expect(await formula.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await formula.evaluate((element) => element.clientWidth))
  const viewport = (await formula.boundingBox())!
  const atStart = (await copy.boundingBox())!
  expect(atStart.x + atStart.width).toBeLessThanOrEqual(viewport.x + viewport.width + 1)

  await formula.evaluate((element) => (element.scrollLeft = element.scrollWidth))
  const atEnd = (await copy.boundingBox())!
  expect(atEnd.x).toBeCloseTo(atStart.x, 0)
  await copy.hover()
  await expect(formula.locator(".math-actions")).toHaveCSS("opacity", "1")
  await copy.click()
  const source = await formula.locator("annotation").textContent()
  await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n")).toBe(source)
})

test("mobile TOC locks the background scroll and restores it on close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto("/posts/math-demo/#错误兜底")
  await page.evaluate(() => window.scrollTo(0, 420))
  const before = await page.evaluate(() => scrollY)
  await page.getByRole("button", { name: "打开目录" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-toc-open", "")
  await page.mouse.wheel(0, 650)
  expect(await page.evaluate(() => ({ scrollY, top: document.body.style.top }))).toEqual({ scrollY: 0, top: `-${before}px` })
  await page.keyboard.press("Escape")
  await expect(page.locator("html")).not.toHaveAttribute("data-toc-open", "")
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before)
})

test("desktop TOC keeps its page inset at the sidebar breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1344, height: 800 })
  await page.goto("/posts/math-demo/")
  const toc = page.getByRole("navigation", { name: "文章目录" })
  await expect(toc).toBeVisible()
  const sidebar = (await toc.boundingBox())!
  const content = (await page.locator(".reading").boundingBox())!
  expect(sidebar.x).toBeGreaterThanOrEqual(16)
  expect(sidebar.y).toBe(48)
  expect(content.x - sidebar.x - sidebar.width).toBe(32)
  expect(800 - sidebar.y - sidebar.height).toBe(48)
})

test("TOC scrolls the article smoothly and hides its own scrollbar after use", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto("/posts/math-demo/")
  await page.getByRole("button", { name: "打开目录" }).click()
  const toc = page.getByRole("dialog").getByRole("navigation")
  await expect(toc).toHaveCSS("scrollbar-color", "rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)")
  await toc.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(toc).toHaveCSS("scrollbar-color", "rgba(128, 128, 128, 0.28) rgba(0, 0, 0, 0)")
  await expect(toc).toHaveCSS("scrollbar-color", "rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)")
  const journey = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const positions: number[] = []
        window.addEventListener("scroll", () => positions.push(scrollY), { passive: true })
        window.addEventListener("scrollend", () => resolve(positions), { once: true })
      })
  )
  await toc.getByRole("link", { name: "化学式" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page).toHaveURL(new RegExp(encodeURIComponent("化学式") + "$", "u"))
  const positions = await journey
  expect(positions.some((position) => position > 0 && position < positions.at(-1)!)).toBe(true)
})

test("heading fragments point to their destination and replay after another activation", async ({ page }) => {
  const id = "表达与结构"
  const fragment = "#" + encodeURIComponent(id)
  const heading = page.locator('[id="' + id + '"]')
  const arrowOpacity = () => heading.evaluate((element) => Number(getComputedStyle(element, "::before").opacity) * (getComputedStyle(element, "::before").content !== "none" ? 1 : 0))

  await page.goto(article + fragment)
  await expect.poll(arrowOpacity).toBeGreaterThan(0)
  await expect(heading).toBeInViewport()

  await page.goto(article)
  await page.getByRole("button", { name: "记录", exact: true }).click()
  await page.getByRole("link", { name: id, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(fragment + "$", "u"))
  await expect.poll(arrowOpacity).toBeGreaterThan(0)
  await expect(heading).toBeInViewport()
  await expect.poll(arrowOpacity).toBe(0)

  await heading.getByRole("link", { name: "章节链接" }).press("Enter")
  await expect.poll(arrowOpacity).toBeGreaterThan(0)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(article + "$", "u"))
  await expect.poll(arrowOpacity).toBe(0)
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(fragment + "$", "u"))
  await expect.poll(arrowOpacity).toBeGreaterThan(0)
})

test("footnotes highlight the entry and return to the annotated clause", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 440 })
  await page.goto("/posts/footnote-highlight-demo/")
  const reference = page.getByRole("link", { name: "查看脚注 2", exact: true })
  const paragraph = page.locator("p").filter({ has: reference })
  const height = (await paragraph.boundingBox())!.height
  await reference.click()
  await expect(page).toHaveURL(/#user-content-fn-2$/u)
  const note = page.locator("#user-content-fn-2")
  await expect.poll(() => note.evaluate((element) => getComputedStyle(element, "::after").boxShadow)).toContain("inset")
  await note.getByRole("link", { name: "返回引用处" }).click()
  await expect(page).toHaveURL(/#user-content-fnref-2$/u)
  const overlay = paragraph.locator(".footnote-clause-overlay > span")
  await expect(overlay.first()).toBeVisible()
  const alignment = await paragraph.evaluate((element) => {
    const nodes = [...element.childNodes].filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    const text = nodes.find((node) => node.data.startsWith("角标标注括号内文本"))!
    const selected = document.createRange()
    selected.setStart(text, 0)
    selected.setEnd(text, text.length)
    const expected = selected.getBoundingClientRect()
    const actual = element.querySelector(".footnote-clause-overlay > span")!.getBoundingClientRect()
    return Math.abs(actual.left + 2 - expected.left) + Math.abs(actual.width - 4 - expected.width)
  })
  expect(alignment).toBeLessThan(2)
  expect((await paragraph.boundingBox())!.height).toBe(height)
  await expect
    .poll(() =>
      reference.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return Math.abs(rect.top + rect.height / 2 - innerHeight / 2)
      })
    )
    .toBeLessThan(3)
})

test("the header stays in place when navigation adds a document scrollbar", async ({ page }) => {
  for (const width of [1000, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto("/posts/time-to-read/")
    const header = page.locator(".site-header")
    const before = (await header.boundingBox())!
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false)

    await header.getByRole("link", { name: "YinYang" }).click()
    await page.waitForURL(/\/$/u)
    await expect(page.getByRole("link", { name: "阅读与记录之间" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true)
    const after = (await header.boundingBox())!
    expect(after.x).toBe(before.x)
    expect(after.width).toBe(before.width)
  }
})

test("article dividers have consistent spacing and the correction link appears below them", async ({ page }) => {
  const path = "ai-engineering-probabilistic-model-feedback-system"
  await page.goto("/posts/" + path + "/")
  const rule = page.locator(".reading hr").first()
  await expect(rule).toHaveCSS("border-top-width", "1px")
  await expect(rule).toHaveCSS("border-top-style", "solid")
  await expect(rule).toHaveCSS("margin-top", "16px")
  await expect(rule).toHaveCSS("margin-bottom", "16px")
  const repository = process.env.SITE_EDIT_REPOSITORY || process.env.GITHUB_REPOSITORY
  const branch = process.env.SITE_EDIT_BRANCH ?? "main"
  const edit = page.getByRole("link", { name: "有错误？欢迎提交 Pull Request" })
  if (repository) {
    const prefix = repository.replace(/^https:\/\/github\.com\//u, "").replace(/\/+$/u, "") + "/edit/" + branch + "/src/content/posts/"
    await expect(edit).toHaveAttribute("href", "https://github.com/" + prefix + path + "/index.md")
    expect((await edit.boundingBox())!.y).toBeGreaterThan((await rule.boundingBox())!.y)
  } else await expect(edit).toHaveCount(0)
})

test("Blog and Notes details expose edit, view, and copy actions", async ({ page }) => {
  const repository = process.env.SITE_EDIT_REPOSITORY || process.env.GITHUB_REPOSITORY
  for (const path of ["/posts/math-demo/", "/posts/reading/markdown/", "/notes/2026-08/006/", "/notes/2026-11/001/"]) {
    await page.goto(path)
    const actions = page.getByRole("group", { name: "原文操作" })
    const correction = page.getByRole("link", { name: "有错误？欢迎提交 Pull Request" })
    const edit = actions.getByRole("link", { name: "编辑原文" })
    if (repository) {
      await expect(edit).toHaveAttribute("href", /\/edit\/.+\/src\/content\/.+\.md$/u)
      await expect(correction).toHaveAttribute("href", (await edit.getAttribute("href"))!)
    } else {
      await expect(correction).toHaveCount(0)
      await expect(edit).toHaveCount(0)
    }
    await expect(actions.getByRole("link", { name: "查看原始 Markdown" })).toHaveAttribute("href", path + "index.md")
    await expect(actions.getByRole("button", { name: "复制正文 Markdown" })).toBeVisible()
  }
})

test("serves the original asset and lets a no-script reader open a sidenote", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 812 } })
  try {
    const page = await context.newPage()
    await page.goto(baseURL + article)
    await expect(page.getByRole("navigation", { name: "文章目录" })).toBeVisible()
    const note = page.locator('details[data-sidenote="1"]')
    await note.locator("summary").click()
    await expect(note.getByText("有些线索", { exact: false })).toBeVisible()
    expect((await context.request.get(baseURL + article + "index.md")).ok()).toBe(true)
    expect((await context.request.get(baseURL + article + "附件/阅读背景.png")).ok()).toBe(true)
    await expect(page.getByRole("heading", { name: "阅读与记录之间" })).toBeVisible()
  } finally {
    await context.close()
  }
})

test("cycles the single theme icon and shows a viewport-safe custom tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" })
  await page.goto("/")
  const theme = page.getByRole("button", { name: /^明暗模式：/u })
  const tooltip = page.getByRole("tooltip")
  await theme.hover()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText("跟随系统")
  const bounds = (await tooltip.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
  for (const mode of ["浅色", "深色", "跟随系统"]) {
    await theme.click()
    await expect(theme).toHaveAccessibleName("明暗模式：" + mode)
    if (mode === "深色") {
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-new(root)").clipPath)).toMatch(/^circle\(/u)
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-new(root)").clipPath)).toBe("none")
    }
  }
})

test("matches the source timeline proportions and reveals theme scrollbars on scroll", async ({ page }) => {
  await page.goto("/")
  const title = page.getByRole("link", { name: "阅读与记录之间" })
  await expect(title).toHaveCSS("font-size", "15px")
  await expect(page.getByRole("heading", { name: "2026" })).toHaveCSS("font-size", "18px")
  await page.setViewportSize({ width: 390, height: 480 })
  await expect(title).toHaveCSS("font-size", "14px")
  await title.click()
  await expect(page.locator(".reading")).toHaveCSS("font-size", "15px")
  await expect(page.locator(".reading h2").first()).toHaveCSS("line-height", "29.9px")
  await expect(page.locator(".reading pre")).toHaveCSS("scrollbar-width", "thin")
  await page.evaluate(() => window.scrollTo(0, 300))
  await expect(page.locator("html")).toHaveAttribute("data-scrollbar-visible", "")
  await expect(page.locator("html")).not.toHaveAttribute("data-scrollbar-visible", "", { timeout: 3000 })
})

test("code controls update in both directions and keep code visible", async ({ page }) => {
  await page.goto(article)
  const code = page.locator(".reading pre")
  for (const [enable, disable, attribute] of [
    ["显示行号", "隐藏行号", "data-line-numbers"],
    ["开启自动换行", "关闭自动换行", "data-wrap"]
  ]) {
    await page.getByRole("button", { name: enable }).click()
    await expect(code).toHaveAttribute(attribute, "")
    const control = page.getByRole("button", { name: disable })
    await expect(control).toHaveAttribute("aria-pressed", "true")
    await control.hover()
    await expect(page.getByRole("tooltip")).toHaveText(disable)
    await expect(code).toHaveCSS("opacity", "1")
    await control.click()
    await expect(page.getByRole("button", { name: enable })).toHaveAttribute("aria-pressed", "false")
    await expect(code).not.toHaveAttribute(attribute, "")
    await expect(code).toHaveCSS("opacity", "1")
  }
})

test("code wrapping preserves source blank lines and only adds rows for long lines", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto("/posts/syntax-highlighting-test/")
  const block = page
    .locator("[data-code-block]")
    .filter({ has: page.locator("pre[data-language=python]") })
    .first()
  const code = block.locator("pre")
  await block.getByRole("button", { name: "展开代码" }).click()
  const height = () => code.evaluate((element) => element.scrollHeight)
  const originalHeight = await height()
  await block.getByRole("button", { name: "开启自动换行" }).click()
  await expect.poll(height).toBe(originalHeight)
  await block.getByRole("button", { name: "显示行号" }).click()
  await expect.poll(height).toBe(originalHeight)

  await page.setViewportSize({ width: 390, height: 800 })
  await expect.poll(height).toBeGreaterThan(originalHeight)
  const layout = await code.evaluate((element) => {
    const rows = Array.from(element.querySelectorAll("code > .line"))
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
    const blankRows = rows.filter((row) => !row.textContent?.trim())
    return {
      hasBlankRows: blankRows.length > 0,
      blanksStaySingle: blankRows.every((row) => Math.abs(row.getBoundingClientRect().height - lineHeight) < 1),
      hasGaps: rows.some((row, index) => index > 0 && row.getBoundingClientRect().top - rows[index - 1].getBoundingClientRect().bottom > 1),
      overflows: element.scrollWidth > element.clientWidth
    }
  })
  expect(layout).toEqual({ hasBlankRows: true, blanksStaySingle: true, hasGaps: false, overflows: false })
})

test("code line numbers reverse in flight and expanding code hides its scrollbar", async ({ page }) => {
  await page.goto(article)
  const numbers = page.getByRole("button", { name: "显示行号" })
  await expect(numbers).toBeVisible()
  const result = await page.locator("[data-code-block]").evaluate(async (block) => {
    const gutter = block.querySelector(".line")!
    const button = block.querySelector<HTMLButtonElement>('[aria-label="显示行号"]')!
    const readWidth = () => parseFloat(getComputedStyle(gutter, "::before").width)
    button.click()
    let transition: Animation | undefined
    for (let i = 0; i < 8 && !transition; i++) {
      await new Promise(requestAnimationFrame)
      transition = gutter.getAnimations({ subtree: true }).find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "width")
    }
    if (!transition) throw new Error("Missing gutter width transition")
    transition.pause()
    transition.currentTime = 60
    const midway = readWidth()
    button.click()
    await new Promise(requestAnimationFrame)
    const afterReverse = readWidth()
    return { midway, afterReverse }
  })
  expect(result.midway).toBeGreaterThan(0)
  expect(result.afterReverse).toBeGreaterThan(0)
  expect(result.afterReverse).toBeLessThanOrEqual(result.midway + 1)
  await expect(numbers).toHaveAttribute("aria-pressed", "false")
  await expect
    .poll(() =>
      page
        .locator("pre .line")
        .first()
        .evaluate((line) => getComputedStyle(line, "::before").width)
    )
    .toBe("0px")
  const expand = page.getByRole("button", { name: "展开代码" })
  await expand.hover()
  await expect(expand).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expand.click()
  const code = page.locator(".reading pre")
  await expect(code).toHaveCSS("scrollbar-width", "none")
  await expect(code).toHaveCSS("scrollbar-width", "thin")
})

test("the missing local image keeps a full-width placeholder when external scripts fail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 })
  await page.route("**/*", (route) => (route.request().resourceType() === "script" ? route.abort() : route.fallback()))
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/does-not-exist.png", async (route) => {
    await pending
    await route.fulfill({ status: 404, body: "" })
  })
  const article = page.locator(".reading")
  const image = page.getByAltText("本地不存在的图片", { exact: true })
  const frame = article.locator(".loading-image-frame").filter({ has: image })
  let before: { width: number; height: number } | null = null
  try {
    await page.goto("/posts/test-image-fail/", { waitUntil: "domcontentloaded" })
    await expect(frame).toBeVisible()
    await expect(image).toHaveCSS("visibility", "hidden")
    before = await frame.boundingBox()
    expect(before?.width).toBe((await article.boundingBox())?.width)
    await expect(frame).toHaveCSS("height", "112px")
  } finally {
    release()
  }
  const retry = frame.getByRole("button", { name: "点击重试" })
  await expect(retry).toBeVisible()
  await expect(image).toBeHidden()
  const after = await frame.boundingBox()
  expect(after?.width).toBe(before?.width)
  expect(after?.height).toBe(before?.height)
  await retry.press("Enter")
  await expect(retry).toBeVisible()
  await expect(retry).toBeFocused()
})

test("a pending remote image keeps its placeholder into a failed request and supports retry", async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let retried = false
  await page.route("https://invalid.example.com/not-found.png*", async (route) => {
    if (new URL(route.request().url()).searchParams.has("retry")) {
      retried = true
      const image = await page.request.get("/logo.png")
      await route.fulfill({ response: image })
    } else {
      await pending
      await route.fulfill({ status: 404, body: "" })
    }
  })
  await page.goto("/posts/test-image-fail/", { waitUntil: "domcontentloaded" })
  const failedStrip = page.locator(".loading-image-frame").filter({ has: page.getByAltText("窄幅加载失败的图片") })
  const stripRetry = failedStrip.getByRole("button", { name: "点击重试" })
  await expect(stripRetry).toBeVisible()
  expect(await stripRetry.evaluate((button) => button.scrollHeight <= button.clientHeight)).toBe(true)
  const image = page.getByAltText("远程加载失败的图片")
  const frame = page.locator(".loading-image-frame").filter({ has: image })
  try {
    await frame.scrollIntoViewIfNeeded()
    await expect(image).toHaveCSS("opacity", "0")
    const { height, width } = (await frame.boundingBox())!
    expect(height).toBeGreaterThan(100)
    expect(width).toBeGreaterThan(250)
  } finally {
    release()
  }
  const retry = frame.getByRole("button", { name: "点击重试" })
  await expect(retry).toBeVisible()
  await expect(retry.locator("svg")).toBeVisible()
  await expect(image).toBeHidden()
  await retry.click()
  await expect.poll(() => retried).toBe(true)
  await expect(retry).toBeHidden()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await expect(frame.getByRole("link")).toHaveAttribute("href", "/notes/")
  await expect(page).toHaveURL(/\/posts\/test-image-fail\/$/u)
})

test("positions appearance menus and tooltips within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto("/")
  const button = page.getByRole("button", { name: "选择主题色" })
  await button.hover()
  const tooltip = page.getByRole("tooltip")
  await expect(tooltip).toBeVisible()
  const anchor = (await button.boundingBox())!
  const tip = (await tooltip.boundingBox())!
  expect(Math.abs(tip.y - (anchor.y + anchor.height) - 4)).toBeLessThan(1)
  expect(tip.x).toBeGreaterThanOrEqual(8)
  expect(tip.x + tip.width).toBeLessThanOrEqual(312)
  await button.click()
  const menu = page.getByRole("group", { name: "主题色" })
  await expect(menu).toBeVisible()
  await expect(async () => {
    const panel = (await menu.boundingBox())!
    expect(Math.abs(panel.y - (anchor.y + anchor.height) - 6)).toBeLessThan(1)
    expect(panel.x + panel.width).toBeLessThanOrEqual(312)
  }).toPass({ timeout: 2000 })
})

test("the palette menu fits in a short landscape viewport", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 200 })
  await page.goto("/")
  await page.getByRole("button", { name: "选择主题色" }).click()
  const menu = page.getByRole("group", { name: "主题色" })
  await expect(async () => {
    const panel = (await menu.boundingBox())!
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.y + panel.height).toBeLessThanOrEqual(200)
  }).toPass({ timeout: 2000 })
})

test("copies a rendered table with its alignment", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/posts/markdown-table-demo/")
  const wrapper = page.locator(".table-scroll").filter({ hasText: "默认居左" })
  const cells = wrapper.locator("tbody tr").first().locator("td")
  await expect(cells.nth(1)).toHaveCSS("text-align", "center")
  await expect(cells.nth(2)).toHaveCSS("text-align", "right")
  const copy = wrapper.getByRole("button", { name: "复制 Markdown 表格" })
  await expect(copy).toHaveCSS("pointer-events", "none")
  await cells.first().hover()
  await expect(copy).toHaveCSS("pointer-events", "auto")
  await copy.click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/\| :-+ \| :-+: \| -+: \|/u)
  expect(copied).toContain("| 默认居左 | 居中显示 | 数字右对齐 |")
  const codeTable = page.locator(".table-scroll").filter({ hasText: "2 + 3" })
  await codeTable.getByText("2 + 3", { exact: true }).hover()
  await codeTable.getByRole("button", { name: "复制 Markdown 表格" }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("`2 + 3`")
})

test("terminal accepts home directory aliases and reports missing directories", async ({ page, baseURL }) => {
  for (const command of [" cd ", "cd  ~", "cd ~/", "cd /"]) {
    await page.goto("/missing-terminal/?scene=terminal")
    const terminal = page.getByRole("textbox", { name: /^终端命令/u })
    await terminal.fill(command)
    await terminal.press("Enter")
    await expect(page).toHaveURL(new URL("/", baseURL).href)
  }
  await page.goto("/missing-terminal/?scene=terminal")
  const terminal = page.getByRole("textbox", { name: /^终端命令/u })
  await terminal.fill("pwd")
  await terminal.press("Enter")
  await expect(page.getByRole("log").getByText("/", { exact: true })).toBeVisible()
  await terminal.fill("cd unknown")
  await terminal.press("Enter")
  await expect(page.getByRole("log")).toContainText("unknown")
  await expect(page).toHaveURL(/missing-terminal/u)
})
