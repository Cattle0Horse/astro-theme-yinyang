import { expect, test } from "@playwright/test"

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
    await previous.click()
    await expect(next).toHaveAttribute("href", root + "page/2/")
  }
})
