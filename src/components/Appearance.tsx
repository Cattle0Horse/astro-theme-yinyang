import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type MouseEvent, type PointerEvent, type ToggleEvent } from "react"
import { ALargeSmall, Moon, Sun, Monitor } from "lucide-react"
import type { Appearance as Preference, FontSize } from "../lib/appearance"
import { createFontPreviewLayout } from "./font-preview-layout"
import { IconButton } from "./ui/IconButton"

interface Props {
  initial: Preference
  palettes: readonly { id: string; name: string }[]
}

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
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
  { id: "system", label: "跟随系统", icon: Monitor }
] as const

const subscribe = (listener: () => void) => window.yinyangAppearance?.subscribe(listener) ?? (() => {})
const subscribeHydration = () => () => {}

function placeMenu({ currentTarget: trigger }: MouseEvent<HTMLButtonElement>) {
  const menu = document.getElementById(trigger.getAttribute("popovertarget") ?? "")
  if (!menu) return
  const bounds = trigger.getBoundingClientRect()
  menu.style.setProperty("--menu-left", bounds.left + "px")
  menu.style.setProperty("--menu-top", bounds.bottom + 6 + "px")
  menu.style.setProperty("--menu-anchor-top", bounds.top + "px")
}

function focusMenu({ currentTarget: menu, newState }: ToggleEvent<HTMLDivElement>) {
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

export default function Appearance({ initial, palettes }: Props) {
  const drag = useRef<SizeDrag | null>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const previewLayout = useRef<ReturnType<typeof createFontPreviewLayout> | null>(null)
  const clearSizeDrag = useCallback(() => {
    const session = drag.current
    if (!session) return
    drag.current = null
    const { slider, pointerId, committedSize, frame } = session
    if (pointerId !== null && slider.hasPointerCapture(pointerId)) slider.releasePointerCapture(pointerId)
    cancelAnimationFrame(frame)
    slider.value = String(window.yinyangAppearance?.read().size ?? committedSize)
    slider.step = "1"
    document.documentElement.style.removeProperty("--font-preview")
    previewLayout.current?.restore()
  }, [])

  useEffect(() => {
    function clearPreview() {
      clearSizeDrag()
      previewLayout.current?.clear()
    }

    document.addEventListener("astro:before-swap", clearPreview)
    return () => {
      document.removeEventListener("astro:before-swap", clearPreview)
      clearPreview()
    }
  }, [clearSizeDrag])

  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false
  )
  const current = useSyncExternalStore(
    subscribe,
    () => window.yinyangAppearance?.read() ?? initial,
    () => initial
  )
  useLayoutEffect(() => {
    if (sliderRef.current && !drag.current) sliderRef.current.value = String(current.size)
  }, [current.size])
  const update = (value: Partial<Preference>) => window.yinyangAppearance?.update(value)
  const index = modes.findIndex(({ id }) => id === current.mode)
  const { label: modeLabel } = modes[index]
  const nextMode = modes[(index + 1) % modes.length]

  function startSizeDrag({ currentTarget: slider, pointerId, button, isPrimary, clientX }: PointerEvent<HTMLInputElement>) {
    if (button !== 0 || !isPrimary) return
    const startSize = slider.valueAsNumber
    clearSizeDrag()
    const layout = (previewLayout.current ??= createFontPreviewLayout())
    layout.prepare()
    drag.current = { slider, pointerId, startX: clientX, startSize, committedSize: current.size, targetSize: startSize, moved: false, frame: 0 }
    slider.step = "any"
    slider.setPointerCapture(pointerId)
    previewSize(slider, startSize)
  }

  function moveSizeDrag({ pointerId, clientX }: PointerEvent<HTMLInputElement>) {
    const session = drag.current
    if (session?.pointerId !== pointerId || session.moved || Math.abs(clientX - session.startX) < 3) return
    session.moved = true
    previewSize(session.slider, session.targetSize)
  }

  function endSizeDrag({ pointerId, type }: PointerEvent<HTMLInputElement>) {
    const session = drag.current
    if (session?.pointerId !== pointerId) return
    session.pointerId = null
    const { slider } = session
    const from = session.moved ? slider.valueAsNumber : session.startSize
    const commit = type === "pointerup"
    const to = commit ? (Math.round(session.targetSize) as FontSize) : session.committedSize
    previewSize(slider, from)
    if (commit) update({ size: to })
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

  function switchMode(event: MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement
    const resolved = nextMode.id === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : nextMode.id
    if (!document.startViewTransition || root.dataset.theme === resolved || root.classList.contains("theme-revealing")) {
      update({ mode: nextMode.id })
      return
    }
    let { clientX: x, clientY: y } = event
    if (!event.detail) {
      const bounds = event.currentTarget.getBoundingClientRect()
      x = bounds.x + bounds.width / 2
      y = bounds.y + bounds.height / 2
    }
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    root.classList.add("theme-revealing")
    const transition = document.startViewTransition(() => {
      update({ mode: nextMode.id })
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

  return (
    <div className="appearance" data-enhancement>
      <IconButton label={"明暗模式：" + modeLabel} tooltip={"当前：" + modeLabel + "，切换为" + nextMode.label} disabled={!hydrated} onClick={switchMode}>
        {modes.map(({ id, icon: ModeIcon }) => (
          <ModeIcon key={id} data-mode-icon={id} aria-hidden="true" />
        ))}
      </IconButton>
      <IconButton label="选择主题色" className="palette-toggle" popoverTarget="palette-menu" disabled={!hydrated} onClick={placeMenu} />
      <div id="palette-menu" className="appearance-menu palette-menu" role="group" aria-label="主题色" popover="auto" onToggle={focusMenu}>
        {palettes.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            className="palette-option"
            data-swatch={id}
            data-tooltip={name}
            aria-label={name}
            aria-pressed={current.palette === id}
            onClick={(event) => {
              update({ palette: id })
              event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover()
            }}
          />
        ))}
      </div>
      <IconButton label="调整字号" popoverTarget="font-menu" disabled={!hydrated} onClick={placeMenu}>
        <ALargeSmall aria-hidden="true" />
      </IconButton>
      <div id="font-menu" className="appearance-menu font-menu" role="group" aria-label="字号" popover="auto" onToggle={focusMenu}>
        <input
          ref={sliderRef}
          type="range"
          min="14"
          max="18"
          step="1"
          aria-label="全站字号"
          defaultValue={initial.size}
          onPointerDown={startSizeDrag}
          onPointerMove={moveSizeDrag}
          onPointerUp={endSizeDrag}
          onPointerCancel={endSizeDrag}
          onLostPointerCapture={endSizeDrag}
          onKeyDown={clearSizeDrag}
          onInput={({ currentTarget }) => {
            const size = currentTarget.valueAsNumber
            const session = drag.current
            if (session) {
              session.targetSize = size
              previewSize(currentTarget, session.moved ? size : session.startSize)
            } else {
              update({ size: size as FontSize })
            }
          }}
        />
      </div>
    </div>
  )
}
