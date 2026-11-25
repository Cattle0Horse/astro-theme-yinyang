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
  document.documentElement.removeAttribute("data-toc-jump")
}

function highlight(target: HTMLElement, smooth = false) {
  clearHeadingFeedback()
  if (smooth) document.documentElement.setAttribute("data-toc-jump", "")
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

document.addEventListener(
  "click",
  (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
    if (!link?.hash || link.hasAttribute("download") || (link.target && link.target.toLowerCase() !== "_self")) return
    if (link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search) return
    const heading = headingFor(link.hash)
    if (heading) highlight(heading, true)
  },
  // Start the feedback before Astro or the browser scrolls to the fragment.
  { capture: true }
)
window.addEventListener("hashchange", highlightCurrentFragment)
document.addEventListener("astro:page-load", highlightCurrentFragment)
document.addEventListener("astro:before-swap", clearHeadingFeedback)
