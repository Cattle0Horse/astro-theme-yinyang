import { useEffect, useRef } from "react"

const trigger = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>("[data-tooltip]") : null)

export default function Tooltip() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bubble = ref.current
    if (!bubble) return
    let active: HTMLElement | null = null
    let timeout = 0
    const refresh = () => {
      if (!active || !active.isConnected) return
      bubble.textContent = active.dataset.tooltip || active.getAttribute("aria-label") || ""
      if (!bubble.matches(":popover-open")) bubble.showPopover()
      const { width, height } = bubble.getBoundingClientRect()
      const anchor = active.getBoundingClientRect()
      const center = anchor.left + anchor.width / 2
      const left = Math.max(8, Math.min(center - width / 2, document.documentElement.clientWidth - width - 8))
      const below = anchor.top < height + 12
      bubble.style.left = left + "px"
      bubble.style.top = (below ? anchor.bottom + 4 : anchor.top - height - 4) + "px"
      bubble.style.setProperty("--tooltip-arrow", center - left + "px")
      bubble.toggleAttribute("data-below", below)
    }
    const observer = new MutationObserver(refresh)
    const hide = () => {
      window.clearTimeout(timeout)
      observer.disconnect()
      active = null
      if (bubble.matches(":popover-open")) bubble.hidePopover()
    }
    const show = (target: HTMLElement, delay: number) => {
      hide()
      active = target
      timeout = window.setTimeout(() => {
        refresh()
        observer.observe(target, { attributes: true, attributeFilter: ["data-tooltip", "aria-label"] })
      }, delay)
    }
    const pointer = (event: PointerEvent) => {
      const target = trigger(event.target)
      if (!target || event.pointerType === "touch" || target === trigger(event.relatedTarget)) return
      if (event.type === "pointerover") show(target, 300)
      else if (active === target && !target.matches(":focus-visible")) hide()
    }
    const focus = (event: FocusEvent) => {
      const target = trigger(event.target)
      if (event.type === "focusin" && target?.matches(":focus-visible")) show(target, 0)
      else if (event.type === "focusout" && active === target) hide()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide()
    }
    const pointerDown = (event: PointerEvent) => {
      const target = trigger(event.target)
      if (target && event.pointerType !== "touch" && !target.hasAttribute("popovertarget")) {
        if (active !== target) show(target, 0)
      } else hide()
    }
    const scroll = () => {
      if (active && bubble.matches(":popover-open")) hide()
    }
    document.addEventListener("pointerover", pointer)
    document.addEventListener("pointerout", pointer)
    document.addEventListener("focusin", focus)
    document.addEventListener("focusout", focus)
    document.addEventListener("pointerdown", pointerDown)
    document.addEventListener("keydown", key)
    window.addEventListener("scroll", scroll, true)
    window.addEventListener("resize", hide)
    return () => {
      hide()
      document.removeEventListener("pointerover", pointer)
      document.removeEventListener("pointerout", pointer)
      document.removeEventListener("focusin", focus)
      document.removeEventListener("focusout", focus)
      document.removeEventListener("pointerdown", pointerDown)
      document.removeEventListener("keydown", key)
      window.removeEventListener("scroll", scroll, true)
      window.removeEventListener("resize", hide)
    }
  }, [])
  return <div ref={ref} className="ui-tooltip" popover="manual" role="tooltip" />
}
