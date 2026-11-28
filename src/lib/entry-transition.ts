import { navigate, supportsViewTransitions, type TransitionBeforePreparationEvent, type TransitionBeforeSwapEvent } from "astro:transitions/client"
import { animateEntrance, cancelSharedEntryMotion, prepareEntryMotion } from "./entry-motion"
import { clearHeadingFeedback } from "./heading-feedback"
import { clearFootnoteFeedback } from "./footnote-feedback"
import { closeHeaderMenu, openHeaderMenu } from "../components/header-menu"

const interruptEvents = ["wheel", "touchmove", "keydown"] as const
let pendingNavigation: { href: string } | undefined
let loadingTimer = 0
let stopEntrance: (() => void) | undefined
let pressedDuringEntrance = false

function isEnteringContent(target: EventTarget | null) {
  return Boolean(stopEntrance && target instanceof Element && target.closest("#main") && !target.closest(".toc-desktop, .toc-mobile"))
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.isPrimary || event.button !== 0) return
    pressedDuringEntrance = isEnteringContent(event.target)
    if (pressedDuringEntrance) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  },
  { capture: true }
)

document.addEventListener(
  "pointercancel",
  (event) => {
    if (event.isPrimary) pressedDuringEntrance = false
  },
  { capture: true }
)

// Stop pointer activation before the document's fragment and route handlers.
window.addEventListener(
  "click",
  (event) => {
    if (event.detail === 0) return
    // A press may begin on the animation and end after the new page settles.
    const pressedTooEarly = pressedDuringEntrance
    pressedDuringEntrance = false
    if (pressedTooEarly || isEnteringContent(event.target)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  },
  { capture: true }
)

document.addEventListener(
  "click",
  (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null
    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("data-astro-reload") || link.hasAttribute("download") || (link.target && link.target !== "_self")) return
    if (pendingNavigation?.href === link.href) {
      event.preventDefault()
      return
    }
    if (link.href.includes("#") || link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search) return
    event.preventDefault()
    stopEntrance?.()
    if (location.hash) history.replaceState(history.state, "", link.href)
    clearHeadingFeedback()
    clearFootnoteFeedback()
    closeHeaderMenu(link.closest<HTMLDetailsElement>(openHeaderMenu), true)
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    if (pendingNavigation) {
      // Astro aborts the pending preparation for same-document fragment navigation.
      const cancellation = new URL("#yinyang-cancel-navigation", link.href)
      void navigate(cancellation.href, { history: "replace" }).then(() => {
        if (location.href === cancellation.href) history.replaceState(history.state, "", link.href)
      })
    }
  },
  { capture: true }
)

function setNavigationLoading(active: boolean) {
  window.clearTimeout(loadingTimer)
  const loading = document.querySelector(".navigation-loading")
  if (!loading || (active && loading.hasAttribute("data-loading"))) return
  // A replacement navigation can take over the indicator before it starts closing.
  loadingTimer = window.setTimeout(() => loading.toggleAttribute("data-loading", active), active ? 150 : 0)
}

document.addEventListener("astro:before-swap", (event) => {
  const { viewTransition, signal, to } = event as TransitionBeforeSwapEvent
  if (signal.aborted) return
  let animations: Animation[] = []
  const listeners = new AbortController()
  const cleanup = () => {
    listeners.abort()
    signal.removeEventListener("abort", stop)
    if (stopEntrance === stop) stopEntrance = undefined
  }
  const stop = () => {
    animations.forEach((animation) => animation.cancel())
    viewTransition.skipTransition()
    cleanup()
  }
  stopEntrance = stop
  signal.addEventListener("abort", stop, { once: true })
  for (const type of interruptEvents) document.addEventListener(type, stop, { capture: true, passive: true, signal: listeners.signal })
  document.addEventListener(
    "click",
    (event) => {
      if (event.detail === 0) stop()
    },
    { capture: true, passive: true, signal: listeners.signal }
  )
  window.addEventListener("popstate", stop, { signal: listeners.signal })
  document.addEventListener(
    "astro:after-swap",
    () => {
      // Let the other swap handlers mark the shared elements before choosing what slides in.
      queueMicrotask(() => {
        if (listeners.signal.aborted) return
        if (!to.hash) animations = animateEntrance()
        void Promise.allSettled([viewTransition.finished, ...animations.map((animation) => animation.finished)]).then(cleanup)
      })
    },
    { once: true, signal: listeners.signal }
  )
})

document.addEventListener("astro:before-preparation", (event) => {
  stopEntrance?.()
  cancelSharedEntryMotion()
  const preparation = event as TransitionBeforePreparationEvent
  const { signal, to } = preparation
  const load = preparation.loader
  preparation.loader = async () => {
    const pending = { href: to.href }
    pendingNavigation = pending
    const finish = () => {
      if (pendingNavigation === pending) {
        pendingNavigation = undefined
        setNavigationLoading(false)
      }
      signal.removeEventListener("abort", finish)
      document.removeEventListener("astro:after-swap", finish)
    }
    signal.addEventListener("abort", finish, { once: true })
    document.addEventListener("astro:after-swap", finish, { once: true, signal })
    setNavigationLoading(true)
    try {
      await load()
      if (supportsViewTransitions && !signal.aborted && !preparation.defaultPrevented) {
        prepareEntryMotion(preparation)
      }
    } catch (error) {
      finish()
      throw error
    } finally {
      if (preparation.defaultPrevented) finish()
    }
  }
})
