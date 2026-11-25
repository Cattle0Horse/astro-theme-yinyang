import { expect, test } from "@playwright/test"
import type { TransitionBeforeSwapEvent } from "astro:transitions/client"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("astro:before-swap", (event) => {
      const { viewTransition } = event as TransitionBeforeSwapEvent
      void viewTransition.ready.then(
        () => {
          const snapshots = ["title", "time"].filter((part) => {
            const name = "entry-" + part
            return ["old", "new"].every((phase) => getComputedStyle(document.documentElement, "::view-transition-" + phase + "(" + name + ")").animationName !== "none")
          })
          document.body.dataset.sharedSnapshots = snapshots.join(" ")
        },
        () => {}
      )
    })
  })
})

test("Blog title and date are shared on opening an article and returning to its list", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.getByRole("link", { name: "阅读与记录之间" }).click()
  await expect(page.getByRole("heading", { name: "阅读与记录之间", exact: true })).toBeVisible()
  await expect(page.locator(".article-heading time")).toHaveText(/^\d{4}\.\d{2}\.\d{2}/u)
  await expect(page.locator("body")).toHaveAttribute("data-shared-snapshots", "title time")
  await expect(page.locator(".article-title span")).toHaveCSS("view-transition-name", "none")
  await page.goBack()
  await expect(page.getByRole("link", { name: "阅读与记录之间" })).toBeVisible()
  await expect(page.locator("body")).toHaveAttribute("data-shared-snapshots", "title time")
})

test("untitled Notes share the date only and unrelated pages use the regular transition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/notes/")
  const note = page.locator('a[href="/notes/2026-11/001/"]').first()
  await note.click()
  await expect(page).toHaveURL(/\/notes\/2026-11\/001\/$/u)
  await expect(page.locator("body")).toHaveAttribute("data-shared-snapshots", "time")
  await page.locator(".site-name").click()
  await expect(page.getByRole("link", { name: "阅读与记录之间" })).toBeVisible()
  await expect(page.locator("body")).toHaveAttribute("data-shared-snapshots", "")
})

test("repeated Notes navigation loads once and reselecting Notes returns to the top", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route("**/notes/", async (route) => {
    requests++
    await pending
    await route.continue()
  })
  await page.goto("/")
  const notes = page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "Notes" })
  try {
    await notes.click()
    await expect(page.getByRole("status").filter({ hasText: "正在加载" })).toBeVisible()
    await notes.click()
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/notes\/$/u)
  await expect(notes).toHaveAttribute("aria-current", "page")
  await page.evaluate(() => window.scrollTo(0, 72))
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await notes.click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await notes.click()
  expect(requests).toBe(1)
  await page.goBack()
  await expect(page).toHaveURL(new URL("/", page.url()).href)
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible()
})

test("reselecting Notes from the mobile menu clears the fragment and restores menu focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 750 })
  await page.goto("/notes/#main")
  const historyLength = await page.evaluate(() => history.length)
  const trigger = page.locator("summary[aria-label='主导航']")
  await trigger.press("Enter")
  const notes = page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "Notes" })
  await notes.press("Enter")
  await expect(page).toHaveURL(/\/notes\/$/u)
  await expect(notes).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
})

test("reselecting the current page cancels a slow navigation without remounting it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto("/notes/")
  await page.locator("body").evaluate((body) => {
    body.dataset.original = "true"
  })
  let reloads = 0
  await page.route("**/notes/", async (route) => {
    reloads++
    await route.continue()
  })
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let complete!: () => void
  const settled = new Promise<void>((resolve) => {
    complete = resolve
  })
  await page.route("**/notes/2026-11/001/", async (route) => {
    await pending
    try {
      await route.continue()
    } finally {
      complete()
    }
  })
  const loading = page.getByRole("status").filter({ hasText: "正在加载" })
  try {
    await page.locator('a[href="/notes/2026-11/001/"]').first().click()
    await expect(loading).toBeVisible()
    await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "Notes" }).click()
    await expect(loading).toBeHidden()
  } finally {
    release()
  }
  await settled
  await expect(page).toHaveURL(/\/notes\/$/u)
  await expect(page.locator("body")).toHaveAttribute("data-original", "true")
  expect(reloads).toBe(0)
})

test("shows loading on a slow navigation then staggers the entrance until reading input", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const article = "/posts/reading/markdown/"
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**" + article, async (route) => {
    await pending
    await route.continue()
  })
  await page.goto("/")
  try {
    await page.getByRole("link", { name: "阅读与记录之间" }).click()
    await expect(page.getByRole("status").filter({ hasText: "正在加载" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Blog" })).toBeAttached()
  } finally {
    release()
  }
  await expect(page).toHaveURL(new RegExp(article + "$", "u"))
  const result = await page.evaluate(async () => {
    const until = performance.now() + 2000
    let entrance: Animation[] = []
    let indicator: Animation | undefined
    while (performance.now() < until) {
      entrance = Array.from(document.querySelectorAll(".reading > *")).flatMap((node) =>
        node.getAnimations().filter((animation) => (animation.effect as KeyframeEffect).getKeyframes().some((frame) => frame.translate === "0px 24px"))
      )
      indicator = document
        .querySelector(".toc-desktop .toc-indicator")
        ?.getAnimations()
        .find((animation) => (animation.effect as KeyframeEffect).getKeyframes().some((frame) => frame.scale === "1 0"))
      if (entrance.length > 1 && indicator) break
      await new Promise(requestAnimationFrame)
    }
    const delays = entrance.map((animation) => animation.effect!.getTiming().delay)
    const indicatorTiming = indicator?.effect?.getTiming()
    document.dispatchEvent(new WheelEvent("wheel"))
    return {
      delays,
      indicatorTiming,
      interrupted: [...entrance, indicator].every((animation) => animation?.playState === "idle")
    }
  })
  expect(result.delays.length).toBeGreaterThan(1)
  expect(result.delays.slice(0, 2)).toEqual([80, 125])
  expect(result.indicatorTiming).toMatchObject({ delay: 275, duration: 220 })
  expect(result.interrupted).toBe(true)
  await expect(page.locator(".toc-desktop .toc-indicator")).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "正在加载" })).toBeHidden()
})
