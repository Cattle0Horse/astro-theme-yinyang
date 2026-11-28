import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from "astro:transitions/client"

const partNames = ["title", "time"] as const
const root = document.documentElement
let cleanupShared: (() => void) | undefined

function visibleBounds(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const viewport = document.documentElement
  if (rect.width && rect.height && rect.right > 0 && rect.left < viewport.clientWidth && rect.bottom > 0 && rect.top < viewport.clientHeight) return rect
}

function entryPair(outgoing: Document, incoming: Document) {
  const oldDetail = outgoing.querySelector<HTMLElement>("[data-entry-detail]")
  const newDetail = incoming.querySelector<HTMLElement>("[data-entry-detail]")
  if (oldDetail && newDetail) return
  const detail = oldDetail ?? newDetail
  const key = detail?.dataset.entryDetail
  if (!detail || !key) return
  const previews = (oldDetail ? incoming : outgoing).querySelectorAll<HTMLElement>("[data-entry-preview]")
  const preview = Array.from(previews).find((entry) => entry.dataset.entryPreview === key)
  if (!preview) return
  return oldDetail ? { from: detail, to: preview } : { from: preview, to: detail }
}

function prepareOutgoingContent(signal: AbortSignal) {
  const content = document.querySelector<HTMLElement>("#main")
  if (!content) return
  // Separate the captures so the old content keeps its own viewport position.
  content.style.viewTransitionName = "reading-outgoing"
  const cleanup = () => {
    content.style.removeProperty("view-transition-name")
    signal.removeEventListener("abort", cleanup)
    document.removeEventListener("astro:after-swap", cleanup)
  }
  signal.addEventListener("abort", cleanup, { once: true })
  document.addEventListener("astro:after-swap", cleanup, { once: true })
}

function prepareEntryTransition({ newDocument, signal }: TransitionBeforePreparationEvent) {
  const pair = entryPair(document, newDocument)
  if (!pair) return
  const parts = partNames.flatMap((part) => {
    const from = pair.from.querySelector<HTMLElement>('[data-entry-part="' + part + '"]')
    const to = pair.to.querySelector<HTMLElement>('[data-entry-part="' + part + '"]')
    const before = from && visibleBounds(from)
    return from && to && before ? [{ from, to, before, name: "entry-" + part }] : []
  })
  if (!parts.length) return

  const cleanup = () => {
    if (cleanupShared !== cleanup) return
    cleanupShared = undefined
    signal.removeEventListener("abort", cleanup)
    for (const { from, to } of parts) {
      from.style.removeProperty("view-transition-name")
      to.style.removeProperty("view-transition-name")
    }
    if (parts.some(({ to }) => to.isConnected)) root.style.removeProperty("--entry-transition-duration")
  }
  cleanupShared = cleanup
  signal.addEventListener("abort", cleanup, { once: true })
  for (const { from, name } of parts) from.style.viewTransitionName = name

  document.addEventListener(
    "astro:before-swap",
    (event) => {
      const { viewTransition } = event as TransitionBeforeSwapEvent
      // Astro restores the destination scroll position before capturing its snapshot.
      document.addEventListener(
        "astro:after-swap",
        () => {
          let distance = 0
          for (const { to, before, name } of parts) {
            const after = visibleBounds(to)
            if (!after) continue
            to.style.viewTransitionName = name
            distance = Math.max(distance, Math.hypot(after.left - before.left, after.top - before.top))
          }
          root.style.setProperty("--entry-transition-duration", Math.min(420, Math.round(180 + distance * 0.8)) + "ms")
        },
        { once: true, signal }
      )
      void viewTransition.finished.then(cleanup, cleanup)
    },
    { once: true, signal }
  )
}

export function animateEntrance() {
  const candidates = document.querySelectorAll<HTMLElement>(
    "#main .article-heading, #main .article > .reading > *, #main .article-edit, #main .timeline-heading, #main .timeline-item, #main .section-title, #main .notes-pagination, #main .tag-list > li"
  )
  const animations: Animation[] = []
  for (const element of candidates) {
    if (!visibleBounds(element) || element.closest("[hidden]")) continue
    if (element.matches("[data-entry-part]") || [...element.querySelectorAll<HTMLElement>("[data-entry-part]")].some((part) => part.style.viewTransitionName)) continue
    const delay = 80 + Math.min(animations.length * 45, 240)
    animations.push(
      element.animate(
        [
          { opacity: 0, translate: "0 24px" },
          { opacity: 1, translate: "0 0" }
        ],
        { delay, duration: 420, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }
      )
    )
  }
  for (const toc of document.querySelectorAll<HTMLElement>("#main :is(.toc-desktop, .toc-open)")) {
    if (!visibleBounds(toc)) continue
    animations.push(
      toc.animate(
        [
          { opacity: 0, translate: "0 24px" },
          { opacity: 1, translate: "0 0" }
        ],
        { delay: 215, duration: 420, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }
      )
    )
    if (!toc.matches(".toc-desktop")) continue
    const scroller = toc.querySelector("[data-toc-scroll]")?.getBoundingClientRect()
    let index = 0
    for (const link of toc.querySelectorAll<HTMLElement>(".toc-links a")) {
      const bounds = visibleBounds(link)
      if (!bounds || !scroller || bounds.bottom <= scroller.top || bounds.top >= scroller.bottom) continue
      animations.push(
        link.animate(
          [
            { opacity: 0, translate: "12px 8px" },
            { opacity: 1, translate: "0 0" }
          ],
          { delay: 215 + Math.min(index++ * 35, 240), duration: 360, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }
        )
      )
    }
    const indicator = toc.querySelector<HTMLElement>(".toc-indicator")
    if (indicator)
      animations.push(
        indicator.animate(
          [
            { opacity: 0, scale: "1 0" },
            { opacity: 1, scale: "1 1" }
          ],
          { delay: 275, duration: 220, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }
        )
      )
  }
  return animations
}

export function prepareEntryMotion(preparation: TransitionBeforePreparationEvent) {
  prepareOutgoingContent(preparation.signal)
  if (!preparation.to.hash) prepareEntryTransition(preparation)
}

export function cancelSharedEntryMotion() {
  cleanupShared?.()
}
