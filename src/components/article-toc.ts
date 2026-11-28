import { followHeading } from "../lib/heading-feedback"

function revealTocItem(scroller: HTMLElement | null, item: HTMLElement | null) {
  if (!scroller || !item) return
  const bounds = scroller.getBoundingClientRect()
  const entry = item.getBoundingClientRect()
  if (entry.top < bounds.top || entry.bottom > bounds.bottom) {
    scroller.scrollTop += entry.top - bounds.top - 8
  }
}

function mountToc(mobile: HTMLElement, article: HTMLElement) {
  const dialog = mobile.querySelector<HTMLDialogElement>("dialog")
  const trigger = mobile?.querySelector<HTMLButtonElement>(".toc-open")
  const mobileLinks = [...(dialog?.querySelectorAll<HTMLAnchorElement>("a[href^='#']") ?? [])]
  const controller = new AbortController()
  const { signal } = controller
  let lockedScroll: number | null = null

  function unlockPage() {
    if (lockedScroll === null) return
    const y = lockedScroll
    lockedScroll = null
    document.documentElement.removeAttribute("data-toc-open")
    document.body.style.removeProperty("position")
    document.body.style.removeProperty("top")
    document.body.style.removeProperty("width")
    window.scrollTo({ top: y, behavior: "instant" })
  }

  function closeDialog() {
    if (dialog?.open) dialog.close()
    unlockPage()
  }

  trigger?.addEventListener(
    "click",
    () => {
      if (!dialog || dialog.open) return
      lockedScroll = window.scrollY
      document.documentElement.setAttribute("data-toc-open", "")
      document.body.style.position = "fixed"
      document.body.style.top = "-" + lockedScroll + "px"
      document.body.style.width = "100%"
      dialog.showModal()
      revealTocItem(dialog.querySelector("[data-toc-scroll]"), dialog.querySelector('[aria-current="location"]'))
    },
    { signal }
  )
  dialog?.addEventListener(
    "close",
    () => {
      unlockPage()
      if (trigger?.getClientRects().length) trigger.focus({ preventScroll: true })
    },
    { signal }
  )
  dialog?.addEventListener(
    "click",
    (event) => {
      const target = event.target
      if (target === dialog || (target instanceof Element && target.closest(".toc-dialog-header button"))) closeDialog()
      else if (target instanceof Element) {
        const link = target.closest<HTMLAnchorElement>("a[href^='#']")
        if (link) followHeading(event, link, closeDialog)
      }
    },
    { signal }
  )

  let frame = 0
  const wide = matchMedia("(min-width: 84rem)")
  const sidebar = mobile.closest(".article")?.querySelector<HTMLElement>(".toc-desktop")
  const scroller = sidebar?.querySelector<HTMLElement>("[data-toc-scroll]") ?? null
  const links = [...(scroller?.querySelectorAll<HTMLAnchorElement>("a[href^='#']") ?? [])]
  const indicator = scroller?.querySelector<HTMLElement>(".toc-indicator")
  let revealedHeading = ""
  let pointerOverList = false
  let activeIndex = -1
  let firstVisible = -1
  let lastVisible = -1
  let indicatorTransform = ""
  const headingsByPosition = links.flatMap((link) => {
    let id: string
    try {
      id = decodeURIComponent(link.hash.slice(1))
    } catch {
      return []
    }
    const element = document.getElementById(id)
    return element && article.contains(element) ? [{ element, slug: link.hash, link }] : []
  })
  const refreshHeading = () => {
    frame = 0
    if (!headingsByPosition.length) return

    function boundary(edge: number, includeEdge: boolean) {
      let low = 0
      let high = headingsByPosition.length
      while (low < high) {
        const middle = (low + high) >>> 1
        const top = headingsByPosition[middle].element.getBoundingClientRect().top
        if (top < edge || (includeEdge && top === edge)) low = middle + 1
        else high = middle
      }
      return low
    }

    const root = document.documentElement
    const readingY = lockedScroll ?? scrollY
    const atBottom = lockedScroll === null && readingY + root.clientHeight >= root.scrollHeight - 2
    const index = atBottom ? headingsByPosition.length - 1 : Math.max(0, boundary(66, true) - 1)
    const active = headingsByPosition[index].slug
    const last = wide.matches ? boundary(innerHeight, false) - 1 : -1
    const first = last >= 0 ? Math.max(0, boundary(0, true) - 1) : -1
    const start = headingsByPosition[first]?.link.parentElement
    const end = headingsByPosition[last]?.link.parentElement
    let transform = ""
    let revealAt: number | undefined
    if (indicator && scroller && start && end) {
      const bounds = scroller.getBoundingClientRect()
      const top = start.getBoundingClientRect().top
      const bottom = end.getBoundingClientRect().bottom
      const scrollTop = scroller.scrollTop
      transform = `translateY(${top - bounds.top + scrollTop}px) scaleY(${bottom - top})`
      if (revealedHeading !== active && !pointerOverList && !root.hasAttribute("data-reading-scroll")) {
        const item = headingsByPosition[index].link.parentElement?.getBoundingClientRect()
        if (item && (item.top < bounds.top || item.bottom > bounds.bottom)) revealAt = scrollTop + item.top - bounds.top - 8
        revealedHeading = active
      }
    }
    if (index !== activeIndex) {
      headingsByPosition[activeIndex]?.link.removeAttribute("aria-current")
      headingsByPosition[index].link.setAttribute("aria-current", "location")
      for (const link of mobileLinks) {
        if (link.hash === active) link.setAttribute("aria-current", "location")
        else link.removeAttribute("aria-current")
      }
      activeIndex = index
    }
    if (first !== firstVisible || last !== lastVisible) {
      for (let i = Math.max(0, firstVisible); i <= lastVisible; i++) {
        if (i < first || i > last) headingsByPosition[i].link.removeAttribute("data-toc-visible")
      }
      for (let i = Math.max(0, first); i <= last; i++) {
        if (i < firstVisible || i > lastVisible) headingsByPosition[i].link.setAttribute("data-toc-visible", "")
      }
      firstVisible = first
      lastVisible = last
    }
    indicator?.toggleAttribute("data-toc-active", Boolean(transform))
    if (indicator && indicatorTransform !== transform) {
      indicator.style.transform = transform
      indicatorTransform = transform
    }
    if (scroller && revealAt !== undefined) scroller.scrollTop = revealAt
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(refreshHeading)
  }
  const onWide = () => {
    if (wide.matches && dialog?.open) {
      closeDialog()
      links.find((link) => link.getAttribute("aria-current") === "location")?.focus({ preventScroll: true })
    }
    schedule()
  }
  if (headingsByPosition.length) {
    scroller?.addEventListener(
      "pointerenter",
      (event) => {
        pointerOverList = event.pointerType !== "touch"
      },
      { signal }
    )
    scroller?.addEventListener(
      "pointerleave",
      () => {
        pointerOverList = false
        schedule()
      },
      { signal }
    )
    wide.addEventListener("change", onWide, { signal })
    refreshHeading()
    window.addEventListener("scroll", schedule, { passive: true, signal })
    window.addEventListener("resize", schedule, { signal })
    document.addEventListener("yinyang:reading-scroll-end", schedule, { signal })
  }
  return () => {
    controller.abort()
    closeDialog()
    indicator?.removeAttribute("data-toc-active")
    if (frame) cancelAnimationFrame(frame)
  }
}

let cleanupToc: (() => void) | undefined

function initializeToc() {
  const mobile = document.querySelector<HTMLElement>("[data-toc-for]")
  const scope = mobile?.dataset.tocFor
  const article = scope && document.getElementById(scope)
  if (mobile && article) cleanupToc = mountToc(mobile, article)
}

document.addEventListener("astro:before-swap", () => {
  cleanupToc?.()
  cleanupToc = undefined
})
document.addEventListener("astro:after-swap", initializeToc)
initializeToc()
