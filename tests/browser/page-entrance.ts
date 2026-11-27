import type { Page } from "@playwright/test"

export async function waitForPageEntrance(page: Page) {
  await page.waitForFunction(
    () =>
      !document.documentElement.matches(":active-view-transition") &&
      !document.getAnimations().some((animation) => animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime))
  )
}
