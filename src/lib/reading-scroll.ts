let cancelScroll: (() => void) | undefined

type ReadingPosition = "start" | "center" | number

export function scrollToReadingTarget(event: MouseEvent, link: HTMLAnchorElement, target: HTMLElement, align: ReadingPosition, arrived?: () => void) {
  event.preventDefault()
  scrollToReadingPosition(target, align, arrived, link)
}

export function scrollToReadingPosition(target: HTMLElement, align: ReadingPosition, arrived?: () => void, link?: HTMLAnchorElement) {
  cancelScroll?.()
  const root = document.documentElement
  if (link && link.hash !== location.hash) {
    const state = { ...history.state, scrollX, scrollY }
    history.replaceState(state, "")
    const next = { ...state, index: (state.index ?? 0) + 1 }
    history.pushState(next, "", link.href)
    // Synchronize Astro without letting the browser jump to the new fragment.
    window.dispatchEvent(new PopStateEvent("popstate", { state: next }))
  }
  const controller = new AbortController()
  let frame = requestAnimationFrame(start)

  function stop() {
    cancelAnimationFrame(frame)
    controller.abort()
    if (cancelScroll === stop) {
      cancelScroll = undefined
      if (root.hasAttribute("data-reading-scroll")) {
        root.removeAttribute("data-reading-scroll")
        document.dispatchEvent(new Event("yinyang:reading-scroll-end"))
      }
    }
  }

  function start(now: number) {
    if (!target.isConnected) {
      stop()
      return
    }
    const { top, height } = target.getBoundingClientRect()
    const from = scrollY
    const padding = parseFloat(getComputedStyle(root).scrollPaddingBlockStart) || 0
    const headingMargin = parseFloat(getComputedStyle(target).scrollMarginBlockStart) || 0
    const offset = align === "center" ? (innerHeight - height) / 2 : padding + headingMargin
    const position = typeof align === "number" ? align : from + top - offset
    const to = Math.max(0, Math.min(position, root.scrollHeight - root.clientHeight))
    const distance = to - from
    if (Math.abs(distance) < 1) {
      stop()
      arrived?.()
      return
    }
    root.setAttribute("data-reading-scroll", "")
    const duration = Math.min(900, 280 + Math.sqrt(Math.abs(distance)) * 10)

    function step(time: number) {
      const progress = Math.min(1, (time - now) / duration)
      const eased = progress ** 3 * (10 + progress * (-15 + 6 * progress))
      window.scrollTo({ top: from + distance * eased, behavior: "instant" })
      if (progress < 1) frame = requestAnimationFrame(step)
      else {
        stop()
        arrived?.()
      }
    }

    frame = requestAnimationFrame(step)
  }

  cancelScroll = stop
  const { signal } = controller
  for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(type, stop, { passive: true, signal })
  document.addEventListener("astro:before-swap", stop, { signal })
  window.addEventListener(
    "popstate",
    (event) => {
      if (event.isTrusted) stop()
    },
    { signal }
  )
  return stop
}
