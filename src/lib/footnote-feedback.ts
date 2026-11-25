const links = "a[data-footnote-ref], a[data-footnote-backref]"
let current: HTMLElement | undefined
let clear: (() => void) | undefined
let frame = 0

function targetFor(hash: string) {
  try {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (target?.matches(".reading [data-footnote-ref], .reading [data-footnotes] li")) return target
  } catch {
    // A malformed fragment is left to native navigation.
  }
}

function highlightClause(reference: HTMLElement) {
  const marker = reference.closest("sup") ?? reference
  const block = marker.parentElement?.closest<HTMLElement>("p, li, div, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, section")
  if (!block) return
  const start = reference.dataset.footnoteClauseStart
  const anchor = start ? document.getElementById(start) : null
  const range = document.createRange()
  range.selectNodeContents(marker)
  if (anchor && block.contains(anchor)) {
    range.setStartAfter(anchor)
    range.setEndBefore(marker)
  }
  const origin = block.getBoundingClientRect()
  const overlay = document.createElement("span")
  overlay.className = "footnote-clause-overlay"
  overlay.setAttribute("aria-hidden", "true")
  for (const rect of range.getClientRects()) {
    if (!rect.width || !rect.height) continue
    const bar = document.createElement("span")
    bar.style.left = rect.left - origin.left - block.clientLeft - 2 + "px"
    bar.style.top = rect.top - origin.top - block.clientTop - 2 + "px"
    bar.style.width = rect.width + 4 + "px"
    bar.style.height = rect.height + 4 + "px"
    overlay.append(bar)
  }
  if (!overlay.childElementCount) return
  block.setAttribute("data-footnote-clause", "")
  block.append(overlay)
  return () => {
    overlay.remove()
    block.removeAttribute("data-footnote-clause")
  }
}

export function clearFootnoteFeedback() {
  cancelAnimationFrame(frame)
  clear?.()
  clear = undefined
  current = undefined
}

function highlight(target: HTMLElement, center: boolean) {
  clearFootnoteFeedback()
  current = target
  const reference = target.hasAttribute("data-footnote-ref")
  let remove: (() => void) | undefined
  if (reference) {
    const sidenote = target.closest<HTMLDetailsElement>("details[data-sidenote]")
    if (sidenote) {
      sidenote.dispatchEvent(new Event("sidenote:reveal", { bubbles: true }))
      sidenote.hidden = false
      sidenote.open = true
    }
    remove = highlightClause(target)
  } else {
    // Replay the CSS animation on repeated clicks to the same footnote.
    void target.offsetWidth
    target.setAttribute("data-footnote-highlight", "")
    remove = () => target.removeAttribute("data-footnote-highlight")
  }
  if (center) {
    frame = requestAnimationFrame(() => {
      if (target.getClientRects().length) {
        const { top, height } = target.getBoundingClientRect()
        window.scrollTo({ top: scrollY + top - (innerHeight - height) / 2, behavior: "instant" })
      }
    })
  }
  const timeout = window.setTimeout(clearFootnoteFeedback, reference ? 3500 : 3000)
  clear = () => {
    window.clearTimeout(timeout)
    remove?.()
  }
}

function highlightCurrentFragment() {
  const target = targetFor(location.hash)
  if (target === current) return
  if (target) highlight(target, false)
  else clearFootnoteFeedback()
}

document.addEventListener(
  "click",
  (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(links) : null
    if (!link || !link.getAttribute("href")?.startsWith("#")) return
    const target = targetFor(link.hash)
    if (target) highlight(target, true)
  },
  { capture: true }
)
window.addEventListener("hashchange", highlightCurrentFragment)
document.addEventListener("astro:page-load", highlightCurrentFragment)
document.addEventListener("astro:before-swap", clearFootnoteFeedback)
