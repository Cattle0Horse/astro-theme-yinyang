import { scrollToReadingTarget } from "./reading-scroll"

let highlighted: HTMLElement | undefined
let timer = 0

function headingFor(hash: string) {
  if (!hash) return
  let id: string
  try {
    id = decodeURIComponent(hash.slice(1))
  } catch {
    return
  }
  const target = document.getElementById(id)
  if (target?.matches(".reading :is(h1, h2, h3, h4, h5, h6)") && target.querySelector(":scope > .heading-permalink")) return target
}

export function clearHeadingFeedback() {
  window.clearTimeout(timer)
  highlighted?.removeAttribute("data-heading-target")
  highlighted = undefined
}

function highlight(target: HTMLElement) {
  clearHeadingFeedback()
  // Flush the removal so another activation can replay the arrow on the same heading.
  void target.offsetWidth
  target.setAttribute("data-heading-target", "")
  highlighted = target
  timer = window.setTimeout(clearHeadingFeedback, 1450)
}

function highlightCurrentFragment() {
  const target = headingFor(location.hash)
  if (target === highlighted) return
  if (target) highlight(target)
  else clearHeadingFeedback()
}

export function followHeading(event: MouseEvent, link: HTMLAnchorElement, beforeScroll?: () => void) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  if (!link.hash || link.hasAttribute("download") || (link.target && link.target.toLowerCase() !== "_self")) return
  if (link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search) return
  const heading = headingFor(link.hash)
  if (!heading || heading.closest("dialog[data-sidenote-dialog][open]")) return
  beforeScroll?.()
  clearHeadingFeedback()
  scrollToReadingTarget(event, link, heading, "start", () => {
    highlight(heading)
    if (event.detail === 0) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  })
}

document.addEventListener(
  "click",
  (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
    // The mobile TOC restores the page scroll position before following the link.
    if (link && !link.closest(".toc-dialog")) followHeading(event, link)
  },
  { capture: true }
)
window.addEventListener("hashchange", highlightCurrentFragment)
document.addEventListener("astro:page-load", highlightCurrentFragment)
document.addEventListener("astro:before-swap", clearHeadingFeedback)
