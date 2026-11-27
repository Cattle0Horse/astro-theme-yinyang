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
    const positions = headingsByPosition.map(({ element }) => element.getBoundingClientRect().top)
    let index = 0
    for (let i = 0; i < positions.length && positions[i] <= 66; i++) index = i
    const root = document.documentElement
    const readingY = lockedScroll ?? scrollY
    if (lockedScroll === null && readingY + root.clientHeight >= root.scrollHeight - 2) index = positions.length - 1
    const active = headingsByPosition[index].slug
    for (const link of mobileLinks) {
      if (link.hash === active) link.setAttribute("aria-current", "location")
      else link.removeAttribute("aria-current")
    }
    const visible: HTMLAnchorElement[] = []
    for (const [i, { link }] of headingsByPosition.entries()) {
      if (i === index) link.setAttribute("aria-current", "location")
      else link.removeAttribute("aria-current")
      const inView = wide.matches && positions[i] < innerHeight && (positions[i + 1] ?? Infinity) > 0
      link.toggleAttribute("data-toc-visible", inView)
      if (inView) visible.push(link)
    }
    const first = visible[0]?.parentElement
    const last = visible.at(-1)?.parentElement
    indicator?.toggleAttribute("data-toc-active", Boolean(first))
    if (indicator && scroller && first && last) {
      const top = first.getBoundingClientRect().top
      indicator.style.top = top - scroller.getBoundingClientRect().top + scroller.scrollTop + "px"
      indicator.style.height = last.getBoundingClientRect().bottom - top + "px"
      if (revealedHeading !== active && !pointerOverList && !root.hasAttribute("data-reading-scroll")) {
        revealTocItem(scroller, headingsByPosition[index].link.parentElement)
        revealedHeading = active
      }
    }
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
