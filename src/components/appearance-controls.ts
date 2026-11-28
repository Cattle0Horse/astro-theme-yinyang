import type { FontSize } from "../lib/appearance"
import { createFontPreviewLayout } from "./font-preview-layout"

interface SizeDrag {
  slider: HTMLInputElement
  pointerId: number | null
  startX: number
  startSize: number
  committedSize: FontSize
  targetSize: number
  moved: boolean
  frame: number
}

const modes = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "跟随系统" }
] as const

function placeMenu(trigger: HTMLButtonElement) {
  const menu = document.getElementById(trigger.getAttribute("popovertarget") ?? "")
  if (!menu) return
  const bounds = trigger.getBoundingClientRect()
  menu.style.setProperty("--menu-left", bounds.left + "px")
  menu.style.setProperty("--menu-top", bounds.bottom + 6 + "px")
  menu.style.setProperty("--menu-anchor-top", bounds.top + "px")
}

function focusMenu(menu: HTMLElement, newState: string) {
  if (newState !== "open") return
  const top = Number.parseFloat(menu.style.getPropertyValue("--menu-top"))
  const anchorTop = Number.parseFloat(menu.style.getPropertyValue("--menu-anchor-top"))
  const height = menu.offsetHeight
  const above = anchorTop - 6 - height
  const limit = Math.max(8, innerHeight - height - 8)
  if (Number.isFinite(top) && Number.isFinite(above)) {
    const aligned = top <= limit ? top : above >= 8 ? above : top
    menu.style.setProperty("--menu-top", Math.min(limit, Math.max(8, aligned)) + "px")
  }
  menu.querySelector<HTMLElement>('[aria-pressed="true"], input')?.focus({ preventScroll: true })
}

function previewSize(slider: HTMLInputElement, size: number) {
  const value = String(size)
  const style = document.documentElement.style
  if (slider.value !== value) slider.value = value
  if (style.getPropertyValue("--font-preview") !== value) style.setProperty("--font-preview", value)
}

function mountAppearance(appearance: HTMLElement) {
  const preferences = window.yinyangAppearance
  const modeButton = appearance.querySelector<HTMLButtonElement>("[data-appearance-mode]")
  const slider = appearance.querySelector<HTMLInputElement>('input[type="range"]')
  if (!preferences || !modeButton || !slider) return
  const controller = new AbortController()
  const { signal } = controller
  const triggers = appearance.querySelectorAll<HTMLButtonElement>("button[popovertarget]")
  const swatches = appearance.querySelectorAll<HTMLButtonElement>("button[data-swatch]")
  let drag: SizeDrag | null = null
  let previewLayout: ReturnType<typeof createFontPreviewLayout> | undefined

  const clearSizeDrag = () => {
    const session = drag
    if (!session) return
    drag = null
    const { pointerId, frame } = session
    if (pointerId !== null && slider.hasPointerCapture(pointerId)) slider.releasePointerCapture(pointerId)
    cancelAnimationFrame(frame)
    slider.value = String(preferences.read().size)
    slider.step = "1"
    document.documentElement.style.removeProperty("--font-preview")
    previewLayout?.restore()
  }

  const sync = () => {
    const current = preferences.read()
    const index = modes.findIndex(({ id }) => id === current.mode)
    const label = modes[index].label
    modeButton.setAttribute("aria-label", "明暗模式：" + label)
    modeButton.dataset.tooltip = "当前：" + label + "，切换为" + modes[(index + 1) % modes.length].label
    for (const swatch of swatches) swatch.setAttribute("aria-pressed", String(swatch.dataset.swatch === current.palette))
    if (!drag) slider.value = String(current.size)
  }

  const startSizeDrag = ({ pointerId, button, isPrimary, clientX }: PointerEvent) => {
    if (button !== 0 || !isPrimary) return
    const startSize = slider.valueAsNumber
    clearSizeDrag()
    const layout = (previewLayout ??= createFontPreviewLayout())
    layout.prepare()
    drag = { slider, pointerId, startX: clientX, startSize, committedSize: preferences.read().size, targetSize: startSize, moved: false, frame: 0 }
    slider.step = "any"
    slider.setPointerCapture(pointerId)
    previewSize(slider, startSize)
  }

  const moveSizeDrag = ({ pointerId, clientX }: PointerEvent) => {
    const session = drag
    if (session?.pointerId !== pointerId || session.moved || Math.abs(clientX - session.startX) < 3) return
    session.moved = true
    previewSize(session.slider, session.targetSize)
  }

  const endSizeDrag = ({ pointerId, type }: PointerEvent) => {
    const session = drag
    if (session?.pointerId !== pointerId) return
    session.pointerId = null
    const { slider } = session
    const from = session.moved ? slider.valueAsNumber : session.startSize
    const commit = type === "pointerup"
    const to = commit ? (Math.round(session.targetSize) as FontSize) : session.committedSize
    previewSize(slider, from)
    if (commit) preferences.update({ size: to })
    if (from === to) {
      clearSizeDrag()
      return
    }

    const releasedAt = performance.now()

    const settle = (now: number) => {
      const progress = Math.max(0, (now - releasedAt) / 140)
      if (progress >= 1) {
        clearSizeDrag()
        return
      }
      previewSize(slider, from + (to - from) * (1 - (1 - progress) ** 2))
      session.frame = requestAnimationFrame(settle)
    }

    session.frame = requestAnimationFrame(settle)
  }

  const switchMode = (event: MouseEvent) => {
    const index = modes.findIndex(({ id }) => id === preferences.read().mode)
    const nextMode = modes[(index + 1) % modes.length]
    const root = document.documentElement
    const resolved = nextMode.id === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : nextMode.id
    if (!document.startViewTransition || root.dataset.theme === resolved || root.classList.contains("theme-revealing")) {
      preferences.update({ mode: nextMode.id })
      return
    }
    let { clientX: x, clientY: y } = event
    if (!event.detail) {
      const bounds = modeButton.getBoundingClientRect()
      x = bounds.x + bounds.width / 2
      y = bounds.y + bounds.height / 2
    }
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    root.classList.add("theme-revealing")
    const transition = document.startViewTransition(() => {
      preferences.update({ mode: nextMode.id })
    })
    void transition.ready
      .then(() => {
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
          { duration: 450, easing: "ease-in-out", fill: "both", pseudoElement: "::view-transition-new(root)" }
        )
      })
      .catch(() => transition.skipTransition())
    const cleanup = () => root.classList.remove("theme-revealing")
    void transition.finished.then(cleanup, cleanup)
  }

  modeButton.addEventListener("click", switchMode, { signal })
  for (const trigger of triggers) {
    trigger.addEventListener("click", () => placeMenu(trigger), { signal })
  }
  for (const menu of appearance.querySelectorAll<HTMLElement>("[popover]")) {
    menu.addEventListener("toggle", (event) => focusMenu(menu, (event as ToggleEvent).newState), { signal })
  }
  for (const swatch of swatches) {
    swatch.addEventListener(
      "click",
      () => {
        preferences.update({ palette: swatch.dataset.swatch })
        swatch.closest<HTMLElement>("[popover]")?.hidePopover()
      },
      { signal }
    )
  }
  slider.addEventListener("pointerdown", startSizeDrag, { signal })
  slider.addEventListener("pointermove", moveSizeDrag, { signal })
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    slider.addEventListener(type, endSizeDrag, { signal })
  }
  slider.addEventListener("keydown", clearSizeDrag, { signal })
  slider.addEventListener(
    "input",
    () => {
      const size = slider.valueAsNumber
      if (drag) {
        drag.targetSize = size
        previewSize(slider, drag.moved ? size : drag.startSize)
      } else {
        preferences.update({ size: size as FontSize })
      }
    },
    { signal }
  )
  const unsubscribe = preferences.subscribe(sync)
  sync()
  for (const button of [modeButton, ...triggers]) button.disabled = false
  return () => {
    controller.abort()
    unsubscribe()
    clearSizeDrag()
    previewLayout?.clear()
  }
}

let cleanup: (() => void) | undefined

function initialize() {
  const appearance = document.querySelector<HTMLElement>(".appearance")
  if (appearance) cleanup = mountAppearance(appearance)
}

document.addEventListener("astro:before-swap", () => {
  cleanup?.()
  cleanup = undefined
})
document.addEventListener("astro:after-swap", initialize)
initialize()
