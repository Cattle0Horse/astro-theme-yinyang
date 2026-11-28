import { expect, test } from "@playwright/test"
import { waitForPageEntrance } from "./page-entrance"

test("Notes and its example tag link to later pages and back", async ({ page }) => {
  for (const root of ["/notes/", "/notes/tags/分页示例/"]) {
    await page.goto(root)
    const pages = page.getByRole("navigation", { name: "分页" })
    const next = pages.getByRole("link", { name: "下一页" })
    await expect(next).toHaveAttribute("href", root + "page/2/")
    await next.click()
    const previous = pages.getByRole("link", { name: "上一页" })
    await expect(previous).toHaveAttribute("href", root)
    await expect(page.locator(".note-entry").first()).toBeVisible()
    await waitForPageEntrance(page)
    await previous.click()
    await expect(next).toHaveAttribute("href", root + "page/2/")
  }
})

test("legacy first-page URLs resolve to the canonical Notes listings without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    for (const root of ["/notes/", "/notes/tags/" + encodeURIComponent("分页示例") + "/"]) {
      await page.goto(root + "page/1/")
      await expect(page).toHaveURL((url) => url.pathname === root)
      await expect(page.locator(".note-entry").first()).toBeVisible()
    }
  } finally {
    await context.close()
  }
})
