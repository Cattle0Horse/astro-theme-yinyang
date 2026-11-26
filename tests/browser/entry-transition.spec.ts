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

test("short and long navigation underlines sweep at the same speed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const navigation = page.getByRole("navigation", { name: "主导航" })
  const speeds: number[] = []

  for (const name of ["Blog", "Notes"]) {
    const link = navigation.getByRole("link", { name, exact: true })
    for (const entering of [true, false]) {
      if (entering) await link.hover()
      else await page.mouse.move(0, 0)

      const { width, duration, midpoint } = await link.evaluate((element, entering) => {
        const property = entering ? "--link-underline-end" : "--link-underline-start"
        const animation = element.getAnimations().find((entry) => entry.effect instanceof KeyframeEffect && property in entry.effect.getKeyframes()[0])!
        const duration = Number(animation.effect!.getComputedTiming().activeDuration)
        animation.pause()
        animation.currentTime = duration / 2
        const midpoint = parseFloat(getComputedStyle(element).getPropertyValue(property))
        animation.finish()
        return { width: element.getBoundingClientRect().width, duration, midpoint }
      }, entering)
      expect(midpoint).toBeCloseTo(50)
      speeds.push(width / duration)
    }
  }

  for (const speed of speeds.slice(1)) expect(speed).toBeCloseTo(speeds[0], 5)
})

test("desktop navigation keeps the hovered underline through the page swap", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  const navigation = page.getByRole("navigation", { name: "主导航" })
  const notes = navigation.getByRole("link", { name: "Notes" })
  await notes.hover()
  await expect(notes).toHaveCSS("--link-underline-end", "100%")

  await notes.evaluate((link) => {
    document.addEventListener(
      "astro:after-swap",
      () => {
        const selector = `.header-desktop a[href="${CSS.escape(link.getAttribute("href")!)}"]`
        const startedAt = performance.now()
        let minimum = 100

        function sample(now: number) {
          const current = document.querySelector(selector)!
          const style = getComputedStyle(current)
          const start = parseFloat(style.getPropertyValue("--link-underline-start"))
          const end = parseFloat(style.getPropertyValue("--link-underline-end"))
          minimum = Math.min(minimum, end - start)
          if (now - startedAt < 250) requestAnimationFrame(sample)
          else document.body.dataset.navUnderlineMinimum = String(minimum)
        }

        sample(startedAt)
      },
      { once: true }
    )
  })

  await notes.click()
  await expect(page).toHaveURL(/\/notes\/$/u)
  await expect(notes).toHaveAttribute("aria-current", "page")
  await expect(navigation.getByRole("link", { name: "Blog" })).not.toHaveAttribute("aria-current")
  await expect(page.locator("body")).toHaveAttribute("data-nav-underline-minimum", "100")

  await page.goBack()
  await expect(navigation.getByRole("link", { name: "Blog" })).toHaveAttribute("aria-current", "page")
  await expect(notes).not.toHaveAttribute("aria-current")
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

test("quick navigation keeps the loading notice hidden", async ({ page }) => {
  await page.goto("/")
  const href = "/posts/footnote-highlight-demo/"
  const body = await page.content()
  await page.route("**" + href, (route) => route.fulfill({ body, contentType: "text/html" }))
  const shown = await page.evaluate(async (href) => {
    const loading = document.querySelector(".navigation-loading")!
    let shown = false
    const observer = new MutationObserver(() => {
      shown ||= getComputedStyle(loading).visibility === "visible"
    })
    observer.observe(loading, { attributes: true })
    const link = document.createElement("a")
    link.href = href
    document.body.append(link)
    await new Promise<void>((resolve) => {
      document.addEventListener("astro:page-load", () => resolve(), { once: true })
      link.click()
    })
    observer.disconnect()
    return shown
  }, href)
  expect(shown).toBe(false)
})

test("loading notice shrinks smoothly and reopens from its current size", async ({ page }) => {
  await page.goto("/")
  const loading = page.getByRole("status", { includeHidden: true }).filter({ hasText: "正在加载" })
  const label = loading.locator(".navigation-loading-label")
  const width = () => label.evaluate((element) => parseFloat(getComputedStyle(element).width))
  let release!: () => void
  const first = new Promise<void>((resolve) => {
    release = resolve
  })
  const article = "/posts/reading/markdown/"
  await page.route("**" + article, async (route) => {
    await first
    await route.continue()
  })
  let releaseNotes!: () => void
  const second = new Promise<void>((resolve) => {
    releaseNotes = resolve
  })
  await page.route("**/notes/", async (route) => {
    await second
    await route.continue()
  })
  try {
    await page.getByRole("link", { name: "阅读与记录之间" }).click()
    await expect.poll(width).toBeGreaterThan(100)
    const sampling = page.evaluate(async () => {
      const notice = document.querySelector<HTMLElement>(".navigation-loading")!
      const label = notice.querySelector(".navigation-loading-label")!
      const text = notice.querySelector(".navigation-loading-text")!
      const frames: { width: number; textOpacity: number }[] = []
      await new Promise<void>((resolve) => {
        let reopening = false

        function sample() {
          const width = parseFloat(getComputedStyle(label).width)
          frames.push({ width, textOpacity: Number(getComputedStyle(text).opacity) })
          if (reopening && frames.length > 2 && width > 100 && frames.at(-2)!.width <= 100) return resolve()
          if (!reopening && width < 95 && width > 40) {
            reopening = true
            document.querySelector<HTMLAnchorElement>('.header-desktop a[href="/notes/"]')!.click()
          }
          requestAnimationFrame(sample)
        }

        requestAnimationFrame(sample)
      })
      return frames
    })
    release()
    const samples = await sampling
    expect(samples.some(({ width, textOpacity }) => width > 100 && textOpacity < 0.5)).toBe(true)
    const frameChanges = samples.slice(1).map(({ width }, index) => Math.abs(width - samples[index].width))
    expect(Math.max(...frameChanges)).toBeLessThan(35)
  } finally {
    release()
    releaseNotes()
  }
  await expect(page).toHaveURL(/\/notes\/$/u)
  await expect(loading).toBeHidden()
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

test("an immediate footnote activation skips the entrance and restores the correct history entries", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener(
      "astro:after-swap",
      () => {
        const reference = document.querySelector<HTMLAnchorElement>(".reading a[data-footnote-ref]")
        if (!reference) return
        reference.click()
        requestAnimationFrame(() => {
          const motion = document.getAnimations().some((animation) => {
            const effect = animation.effect
            return effect instanceof KeyframeEffect && (effect.target?.matches(".reading > *") || effect.pseudoElement?.startsWith("::view-transition"))
          })
          document.body.dataset.interruptedEntrance = String(!motion)
        })
      },
      { capture: true, once: true }
    )
  })
  await page.goto("/")
  await page.evaluate(() => {
    const link = document.createElement("a")
    link.href = "/posts/footnote-highlight-demo/"
    document.body.append(link)
    link.click()
  })
  const article = /\/posts\/footnote-highlight-demo\/$/u
  const fragment = /#user-content-fn-1$/u
  const note = page.locator("#user-content-fn-1")
  await expect(page).toHaveURL(fragment)
  await expect(page.locator("body")).toHaveAttribute("data-interrupted-entrance", "true")
  await expect(note).toBeInViewport()
  await page.goBack()
  await expect(page).toHaveURL(article)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.goForward()
  await expect(page).toHaveURL(fragment)
  await expect(note).toBeInViewport()
})

test("the mobile TOC button and visible tags join the page entrance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/")
  await page.locator('a[href="/posts/reading/markdown/"]').first().click()
  const toc = page.getByRole("button", { name: "打开目录" })
  await expect.poll(() => toc.evaluate((element) => element.getAnimations().some((animation) => animation.effect?.getTiming().delay === 215))).toBe(true)
  await toc.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.evaluate(() => {
    const tags = document.createElement("a")
    tags.href = "/tags/"
    document.body.append(tags)
    tags.click()
  })
  await expect(page).toHaveURL(/\/tags\/$/u)
  const timing = await page.locator(".tag-link").evaluateAll((tags) =>
    tags.slice(0, 3).map((tag) =>
      tag.parentElement
        ?.getAnimations()
        .find((animation) => (animation.effect as KeyframeEffect).getKeyframes().some((frame) => frame.translate === "0px 24px"))
        ?.effect?.getTiming()
    )
  )
  expect(timing.map((item) => item?.delay)).toEqual([125, 170, 215])
})
