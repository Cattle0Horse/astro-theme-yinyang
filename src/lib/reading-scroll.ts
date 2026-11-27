let cancelScroll: ((replaced?: boolean) => number) | undefined

type ReadingPosition = "start" | "center" | number

export function scrollToReadingTarget(event: MouseEvent, link: HTMLAnchorElement, target: HTMLElement, align: ReadingPosition, arrived?: () => void) {
  event.preventDefault()
  scrollToReadingPosition(target, align, arrived, link)
}

export function scrollToReadingPosition(target: HTMLElement, align: ReadingPosition, arrived?: () => void, link?: HTMLAnchorElement) {
  const incomingVelocity = cancelScroll?.(true) ?? 0
  const requestedAt = performance.now()
  let velocity = incomingVelocity
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
    finish()
  }

  function finish(replaced = false) {
    cancelAnimationFrame(frame)
    controller.abort()
    if (cancelScroll === finish) {
      cancelScroll = undefined
      if (!replaced && root.hasAttribute("data-reading-scroll")) {
        root.removeAttribute("data-reading-scroll")
        document.dispatchEvent(new Event("yinyang:reading-scroll-end"))
      }
    }
    return velocity
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
    const maxScroll = root.scrollHeight - root.clientHeight
    const to = Math.max(0, Math.min(position, maxScroll))
    const distance = to - from
    if (Math.abs(distance) < 1 && !incomingVelocity) {
      stop()
      arrived?.()
      return
    }
    root.setAttribute("data-reading-scroll", "")
    const duration = Math.min(900, 280 + Math.sqrt(Math.abs(distance)) * 10)
    const sameDirection = distance * incomingVelocity > 0
    // Carry the previous velocity across the handoff, then dissipate it over a short distance.
    const carryDistance = sameDirection ? Math.abs(distance) : 96
    const carryTime = Math.min(95, duration / 5, carryDistance / Math.abs(incomingVelocity))
    const startedAt = incomingVelocity ? Math.max(requestedAt, now - 24) : now

    function step(time: number) {
      const elapsed = Math.max(0, time - startedAt)
      const progress = Math.min(1, elapsed / duration)
      const eased = progress ** 3 * (10 + progress * (-15 + 6 * progress))
      const remainingVelocity = Math.exp(-elapsed / carryTime)
      const carried = incomingVelocity * carryTime * (1 - remainingVelocity)
      const desired = from + carried + (distance - carried) * eased
      const easeVelocity = (30 * progress ** 2 * (1 - progress) ** 2) / duration
      velocity = desired < 0 || desired > maxScroll ? 0 : incomingVelocity * remainingVelocity * (1 - eased) + (distance - carried) * easeVelocity
      window.scrollTo({ top: desired, behavior: "instant" })
      if (progress < 1) frame = requestAnimationFrame(step)
      else {
        stop()
        arrived?.()
      }
    }

    step(now)
  }

  cancelScroll = finish
  const { signal } = controller
  for (const type of ["wheel", "touchmove"]) window.addEventListener(type, stop, { passive: true, signal })
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Element && event.target.closest("a[href]"))) stop()
    },
    { passive: true, signal }
  )
  window.addEventListener(
    "keydown",
    (event) => {
      if (!(event.key === "Enter" && event.target instanceof Element && event.target.closest("a[href]"))) stop()
    },
    { signal }
  )
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
