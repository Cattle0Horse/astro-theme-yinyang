interface ScrollPosition {
  scrollX: number
  scrollY: number
}

const interruptedPositions = new Map<string, ScrollPosition>()
let nextEntry = 0

function position(): ScrollPosition {
  return { scrollX, scrollY }
}

export function pushReadingFragment(link: HTMLAnchorElement) {
  if (link.hash === location.hash) return
  const state = { ...history.state, ...position() }
  history.replaceState(state, "")
  const next = { ...state, index: (state.index ?? 0) + 1, yinyangReadingEntry: newEntryKey() }
  history.pushState(next, "", link.href)
  // Update Astro's router without triggering the browser's immediate anchor scroll.
  window.dispatchEvent(new PopStateEvent("popstate", { state: next }))
}

function newEntryKey() {
  return performance.timeOrigin + ":" + ++nextEntry
}

window.addEventListener(
  "popstate",
  (event) => {
    if (!event.isTrusted) return
    const state = history.state
    const saved = interruptedPositions.get(state?.yinyangReadingEntry)
    if (!saved) return
    const key = state.yinyangReadingEntry
    interruptedPositions.delete(key)
    history.replaceState({ ...state, ...saved }, "")
    // The router may already have read the original position for this traversal.
    requestAnimationFrame(() => {
      if (history.state?.yinyangReadingEntry === key) window.scrollTo({ left: saved.scrollX, top: saved.scrollY, behavior: "instant" })
    })
  },
  // Astro reads history.state in its bubble-phase listener.
  { capture: true }
)

export function trackReadingHistory(signal: AbortSignal, stop: () => void) {
  const state = history.state
  const entry = state?.yinyangReadingEntry ?? newEntryKey()
  if (state && !state.yinyangReadingEntry) history.replaceState({ ...state, yinyangReadingEntry: entry }, "")
  let last = position()
  window.addEventListener(
    "scrollend",
    (event) => {
      // The instant steps of an ongoing animation can each emit scrollend.
      if (event.target === document) event.stopImmediatePropagation()
    },
    { capture: true, signal }
  )
  window.addEventListener(
    "popstate",
    (event) => {
      if (!event.isTrusted) return
      interruptedPositions.set(entry, last)
      stop()
    },
    { capture: true, signal }
  )
  return {
    record() {
      last = position()
    },
    save() {
      const current = history.state
      if (current?.yinyangReadingEntry === entry && (current.scrollX !== last.scrollX || current.scrollY !== last.scrollY)) {
        history.replaceState({ ...current, ...last }, "")
      }
    }
  }
}
