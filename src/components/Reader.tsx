import { useEffect } from "react"
import { mountReadingActions } from "../lib/reading-actions"

function revealTocItem(scroller: HTMLElement | null, item: HTMLElement | null) {
  if (!scroller || !item) return
  const bounds = scroller.getBoundingClientRect()
  const entry = item.getBoundingClientRect()
  if (entry.top < bounds.top || entry.bottom > bounds.bottom) {
    scroller.scrollTop += entry.top - bounds.top - 8
  }
}

export default function Reader({ scope }: { scope: string }) {
  useEffect(() => {
    const article = document.getElementById(scope)
    if (!article) return
    const mobile = document.querySelector<HTMLElement>(`[data-toc-for="${CSS.escape(scope)}"]`)
    const dialog = mobile?.querySelector<HTMLDialogElement>("dialog")
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
        else if (target instanceof Element && target.closest("a") && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
          closeDialog()
      },
      { signal }
    )

    let frame = 0
    const wide = matchMedia("(min-width: 84rem)")
    const sidebar = article.closest(".article")?.querySelector<HTMLElement>(".toc-desktop")
    const scroller = sidebar?.querySelector<HTMLElement>("[data-toc-scroll]") ?? null
    const links = [...(scroller?.querySelectorAll<HTMLAnchorElement>("a[href^='#']") ?? [])]
    const indicator = scroller?.querySelector<HTMLElement>(".toc-indicator")
    let previous = ""
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
        if (!link) continue
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
        if (previous !== active) revealTocItem(scroller, headingsByPosition[index].link?.parentElement ?? null)
      }
      previous = active
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
      wide.addEventListener("change", onWide)
      refreshHeading()
      window.addEventListener("scroll", schedule, { passive: true })
      window.addEventListener("resize", schedule)
    }
    const cleanupActions = mountReadingActions(article)
    return () => {
      controller.abort()
      closeDialog()
      wide.removeEventListener("change", onWide)
      indicator?.removeAttribute("data-toc-active")
      cleanupActions()
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [scope])

  return null
}
