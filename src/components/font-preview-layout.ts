export function createFontPreviewLayout() {
  const deferred = new Set<HTMLElement>()
  let restoreFrame = 0

  function release(paragraph: HTMLElement) {
    paragraph.removeAttribute("data-font-preview-deferred")
    paragraph.style.removeProperty("--font-preview-block-size")
    deferred.delete(paragraph)
  }

  function prepare() {
    cancelAnimationFrame(restoreFrame)
    if (!CSS.supports("content-visibility", "auto")) return
    const paragraphs = document.querySelectorAll<HTMLElement>(".reading > p:not(:has(img))")
    if (paragraphs.length < 60) return

    // Read every box before enabling containment so measuring does not force a layout per paragraph.
    const offscreen: { paragraph: HTMLElement; height: number }[] = []
    for (const paragraph of paragraphs) {
      if (deferred.has(paragraph)) continue
      const { top, bottom, height } = paragraph.getBoundingClientRect()
      if (height > 0 && (bottom < -300 || top > innerHeight + 300)) offscreen.push({ paragraph, height })
    }
    for (const { paragraph, height } of offscreen) {
      paragraph.style.setProperty("--font-preview-block-size", `${height}px`)
      paragraph.setAttribute("data-font-preview-deferred", "")
      deferred.add(paragraph)
    }
  }

  function restoreBatch() {
    let restored = 0
    for (const paragraph of deferred) {
      release(paragraph)
      if (++restored === 8) break
    }
    if (deferred.size) restoreFrame = requestAnimationFrame(restoreBatch)
  }

  function restore() {
    cancelAnimationFrame(restoreFrame)
    if (deferred.size) restoreFrame = requestAnimationFrame(restoreBatch)
  }

  function clear() {
    cancelAnimationFrame(restoreFrame)
    for (const paragraph of deferred) release(paragraph)
  }

  return { prepare, restore, clear }
}
