import { expect, test } from "@playwright/test"

test("the ten 404 scenes respond to their main controls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const errors: Error[] = []
  page.on("pageerror", (error) => errors.push(error))
  const controls = [
    ["sleep", /眼球跟随/u, /醒了醒了/u],
    ["black-hole", /黑洞吸走/u, /被吸进去了/u],
    ["flashlight", /寻找小幽灵/u, /找到一只幽灵/u],
    ["receipt", /重新打印/u, /已重新开票/u],
    ["constellation", /星星连出/u, /404 星座/u],
    ["puzzle", /点击拼好/u, /拼好了/u],
    ["cat", /猫爪推一下/u, /装作没看见/u]
  ] as const
  for (const [name, label, feedback] of controls) {
    await page.goto("/404.html?scene=" + name)
    await page.getByRole("button", { name: label }).press("Enter")
    await expect(page.locator(".nf-scene").getByRole("status")).toHaveText(feedback)
    await expect(page.locator(".nf-scene a[data-nf-home]")).toHaveAttribute("href", "/")
    if (name === "black-hole") await expect(page.locator(".nf-hole-orbit")).toHaveCSS("animation-name", "nf-numbers-orbit")
  }
  await page.goto("/404.html?scene=terminal")
  const terminal = page.getByRole("textbox", { name: /^终端命令/u })
  await terminal.fill("ls")
  await terminal.press("Enter")
  await expect(page.getByRole("log").getByRole("link").first()).toHaveAttribute("href", /^\/posts\//u)

  await page.goto("/404.html?scene=channel")
  const tuner = page.getByRole("slider", { name: "调节频道频率" })
  await tuner.fill("90")
  await expect(page.locator(".nf-station")).toHaveAttribute("href", /^\/posts\//u)
  await tuner.press("End")
  await expect(page.locator(".nf-scene").getByRole("status")).toContainText("到家频道")

  await page.goto("/404.html?scene=draw-home")
  await page.getByRole("link", { name: /沿虚线回家/u }).click()
  await expect(page.locator(".nf-scene").getByRole("status")).toHaveText("沿着你画的路，出发啦")
  await page.getByRole("button", { name: "清空路线，重新画" }).click()
  await expect(page.locator(".nf-scene").getByRole("status")).toBeHidden()
  await page.getByRole("link", { name: /沿虚线回家/u }).click()
  await expect(page).toHaveURL(new URL("/", page.url()).href)
  expect(errors).toEqual([])
})

test("404 uses only the selected scene and falls back on unsupported devices or failed assets", async ({ page }) => {
  const assets: string[] = []
  page.on("request", (request) => assets.push(new URL(request.url()).pathname))
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/404.html?scene=terminal")
  const home = page.getByRole("link", { name: "返回首页" })
  await expect(home).toBeVisible()
  expect(assets.some((path) => /\/terminal\.|404-articles\.json/u.test(path))).toBe(false)
  await page.goto("/404.html?scene=cat")
  await page.getByRole("button", { name: /猫爪推一下/u }).click()
  await expect(page.locator(".nf-scene").getByRole("status")).toContainText("装作没看见")
  expect(assets.some((path) => /\/cat\.[^/]+\.js$/u.test(path))).toBe(true)
  expect(assets.some((path) => /\/(?:sleep|channel|terminal)\.|404-articles\.json/u.test(path))).toBe(false)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.getByRole("button", { name: /猫爪推一下/u })).toHaveAttribute("aria-pressed", "true")
  await page.route(/\/_astro\/puzzle\.[^/]+\.js$/u, (route) => route.abort())
  await page.goto("/404.html?scene=puzzle")
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute("href", "/")
})

test("a slow 404 scene cannot mount after leaving the page", async ({ page }) => {
  let requested!: () => void
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve
  })
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/\/_astro\/receipt\.[^/]+\.js$/u, async (route) => {
    requested()
    await pending
    await route.continue()
  })
  try {
    await page.goto("/404.html?scene=receipt", { waitUntil: "domcontentloaded" })
    await requestStarted
    await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible()
    await page.getByRole("link", { name: "YinYang" }).click()
    await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible()
  } finally {
    release()
  }
  await expect(page.getByRole("button", { name: /重新打印/u })).toHaveCount(0)
})

test("draw-home ignores header controls and allows resetting an active drag", async ({ page }) => {
  const errors: Error[] = []
  page.on("pageerror", (error) => errors.push(error))
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/404.html?scene=draw-home")
  const home = page.getByRole("link", { name: /沿虚线回家/u })
  const reset = page.getByRole("button", { name: "清空路线，重新画" })
  const menu = page.locator(".header-menu > summary")
  await expect(home).toBeVisible()
  await home.click()
  await menu.click({ timeout: 3000 })
  await expect(home).toHaveAttribute("aria-busy", "true")
  await menu.click()
  await reset.click()
  await reset.focus()
  const canvas = page.getByRole("group", { name: /从任意位置画到小屋/u })
  const bounds = (await canvas.boundingBox())!
  const x = bounds.x + bounds.width / 3
  const y = bounds.y + bounds.height / 3
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 28, y + 30, { steps: 4 })
  await page.keyboard.press("Enter")
  await page.mouse.up()
  await expect(home).not.toHaveAttribute("aria-busy", "true")
  expect(errors).toEqual([])
})

test("the puzzle piece follows the pointer and snaps into its slot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/404.html?scene=puzzle")
  const piece = page.getByRole("button", { name: /拖回数字零/u }).locator(".nf-piece")
  await expect(piece).toBeVisible()
  const bounds = (await piece.boundingBox())!
  const range = await piece.evaluate((element) => (element as SVGGraphicsElement).getScreenCTM()!.a)
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 61 * range, y - 87 * range, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator(".nf-scene").getByRole("status")).toHaveText("拼好了，还是 404")
  await expect.poll(() => piece.evaluate((element) => Math.round(new DOMMatrix(getComputedStyle(element).transform).e))).toBe(-61)
})

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("the static 404 shows its home link without waiting", async ({ page }) => {
    for (const path of ["/post", "/post/"]) {
      const response = await page.goto(path + "?scene=cat")
      expect(response?.status()).toBe(404)
      await expect(page.getByRole("heading", { name: "404 · 页面未找到" })).toBeVisible()
      await expect(page.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/")
    }
  })
})
