import { annotationTextRects } from "./annotation-contour"
import { clearAnnotationFeedback, playAnnotationOutline } from "./annotation-outline"
import { scrollToReadingTarget } from "./reading-scroll"
import type { SidenoteReveal } from "./sidenotes-reader"

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

function textRange(target: HTMLElement) {
  const range = document.createRange()
  if (!target.hasAttribute("data-footnote-ref")) {
    range.selectNodeContents(target)
    return range
  }
  const reference = target
  const marker = reference.closest("sup") ?? reference
  const start = reference.dataset.footnoteClauseStart
  const anchor = start ? document.getElementById(start) : null
  if (!anchor) return
  range.setStartAfter(anchor)
  range.setEndBefore(marker)
  if (/[\p{L}\p{N}\p{S}]/u.test(range.toString())) return range
}

export function clearFootnoteFeedback() {
  cancelAnimationFrame(frame)
  clear?.()
  clear = undefined
  current = undefined
}

function prepareTarget(target: HTMLElement) {
  clearAnnotationFeedback()
  clearFootnoteFeedback()
  current = target
  if (target.hasAttribute("data-footnote-ref")) {
    const sidenote = target.closest<HTMLDetailsElement>("details[data-sidenote]")
    if (sidenote) {
      const request: SidenoteReveal = { reference: target }
      sidenote.dispatchEvent(new CustomEvent<SidenoteReveal>("sidenote:reveal", { bubbles: true, detail: request }))
      if (request.open) return request
      sidenote.hidden = false
      sidenote.open = true
    }
  }
}

function highlight(target: HTMLElement) {
  if (current !== target || !target.isConnected) return
  const range = textRange(target)
  if (range) {
    clear = playAnnotationOutline([annotationTextRects(range)], "text", { dialog: target.closest<HTMLDialogElement>("dialog[data-sidenote-dialog][open]") })
  }
}

function highlightCurrentFragment() {
  const target = targetFor(location.hash)
  if (target === current) return
  if (target) {
    const request = prepareTarget(target)
    frame = requestAnimationFrame(() => {
      request?.open?.()
      highlight(target)
    })
  } else clearFootnoteFeedback()
}

document.addEventListener(
  "click",
  (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(links) : null
    if (!link || !link.getAttribute("href")?.startsWith("#") || link.hasAttribute("download") || (link.target && link.target.toLowerCase() !== "_self")) return
    const target = targetFor(link.hash)
    if (!target) return
    link.dispatchEvent(new Event("sidenote:suspend", { bubbles: true }))
    const request = prepareTarget(target)
    scrollToReadingTarget(event, link, target, request?.open ? (request.position ?? scrollY) : "center", () => {
      request?.open?.()
      highlight(target)
    })
  },
  { capture: true }
)
window.addEventListener("hashchange", highlightCurrentFragment)
document.addEventListener("astro:page-load", highlightCurrentFragment)
document.addEventListener("astro:before-swap", clearFootnoteFeedback)
