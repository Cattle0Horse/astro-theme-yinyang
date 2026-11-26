import { annotationTextRects, createAnnotationContour, type OutlineRect } from "./annotation-contour"
import { scrollToReadingPosition } from "./reading-scroll"

export interface SidenoteOutline {
  kind: "text" | "blocks"
  targets: HTMLElement[]
  source?: HTMLElement
}

interface OutlineGroup {
  target: HTMLElement
  rects: readonly OutlineRect[]
  key?: symbol
}

interface PlayingOutline {
  target: HTMLElement
  path: Path2D
  length: number
  pace: ReturnType<typeof outlinePace>
  duration: number
  startedAt?: number
  closedAt?: number
}

const layers = new Map<HTMLElement, { paths: Map<HTMLElement | symbol, PlayingOutline>; stop: () => void }>()
const returnKeys = new WeakMap<HTMLElement, symbol>()
const pendingSidenotes = new Set<number>()
let cancelSidenoteScroll: (() => void) | undefined

function outlinePace(length: number, turns: number[]) {
  const count = Math.ceil(length / 4)
  const step = length / count
  const samples = [0]
  for (let index = 0; index < count; index++) {
    const midpoint = (index + 0.5) * step
    const distance = Math.min(...turns.map((turn) => Math.abs(turn - midpoint)))
    const nearCorner = Math.max(0, 1 - distance / 20)
    samples.push(samples[index] + step * (1 + 0.8 * nearCorner ** 2))
  }
  return { step, samples, travel: samples.at(-1)! }
}

function distanceAt(pace: ReturnType<typeof outlinePace>, time: number) {
  const ramp = 0.19
  let fraction = (time - ramp / 2) / (1 - ramp)
  if (time < ramp) fraction = time ** 2 / (2 * ramp * (1 - ramp))
  if (time > 1 - ramp) fraction = 1 - (1 - time) ** 2 / (2 * ramp * (1 - ramp))
  const desired = fraction * pace.travel
  let left = 0
  let right = pace.samples.length - 1
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2)
    if (pace.samples[middle] <= desired) left = middle
    else right = middle
  }
  const part = (desired - pace.samples[left]) / (pace.samples[right] - pace.samples[left])
  return (left + part) * pace.step
}

export function isAnnotationOutlinePlaying(key: HTMLElement | symbol) {
  for (const { paths } of layers.values()) {
    if (paths.has(key)) return true
  }
  return false
}

export function playAnnotationOutline(groups: readonly OutlineGroup[], kind: "text" | "blocks" | "rail", dialog?: HTMLDialogElement | null) {
  const fresh = groups.filter(({ target, key, rects }) => target.isConnected && rects.length && !isAnnotationOutlinePlaying(key ?? target))
  if (!fresh.length) return
  const host = dialog ?? document.body
  const layer = layers.get(host) ?? createOutlineLayer(host, dialog)
  if (!layer) return
  const x = dialog ? 0 : scrollX
  const y = dialog ? 0 : scrollY
  const padding = kind === "rail" ? 0 : kind === "text" ? 3 : 4
  const radius = kind === "rail" ? 0 : kind === "text" ? 5 : 7
  for (const { target, key, rects } of fresh) {
    const documentRects = rects.map(({ left, top, right, bottom }) => ({ left: left + x, right: right + x, top: top + y, bottom: bottom + y }))
    const { path, length, turns } = createAnnotationContour(documentRects, padding, radius)
    const pace = outlinePace(length, turns)
    layer.paths.set(key ?? target, { target, path, length, pace, duration: Math.min(1000, Math.max(285, 155 + pace.travel * 0.76)) })
  }
}

function createOutlineLayer(host: HTMLElement, dialog?: HTMLDialogElement | null) {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return
  const surface = context
  canvas.dataset.annotationOutline = ""
  canvas.setAttribute("aria-hidden", "true")
  host.append(canvas)
  const { left, top, width, height } = canvas.getBoundingClientRect()
  if (!width || !height) {
    canvas.remove()
    return
  }
  const scale = Math.min(devicePixelRatio, 2)
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const scaleX = canvas.width / width
  const scaleY = canvas.height / height
  surface.lineWidth = 1.5
  surface.lineCap = "round"
  surface.lineJoin = "round"
  surface.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
  const controller = new AbortController()
  const paths = new Map<HTMLElement | symbol, PlayingOutline>()
  let frame = requestAnimationFrame(animate)

  function stop() {
    if (controller.signal.aborted) return
    cancelAnimationFrame(frame)
    controller.abort()
    canvas.remove()
    layers.delete(host)
  }

  function animate(now: number) {
    surface.resetTransform()
    surface.clearRect(0, 0, canvas.width, canvas.height)
    surface.setTransform(scaleX, 0, 0, scaleY, -(left + (dialog ? 0 : scrollX)) * scaleX, -(top + (dialog ? 0 : scrollY)) * scaleY)
    for (const [key, outline] of paths) {
      const { target, path, length, pace, duration } = outline
      outline.startedAt ??= now
      const drawing = (now - outline.startedAt) / duration
      if (drawing >= 1) outline.closedAt ??= now
      const erasing = Math.max(0, (now - (outline.closedAt ?? now) - 140) / (duration * 0.88))
      if (!target.isConnected || target.hidden || erasing >= 1) {
        paths.delete(key)
        continue
      }
      if (drawing < 1) {
        surface.setLineDash([Math.max(0.01, distanceAt(pace, drawing)), length + 1])
        surface.lineDashOffset = 0
      } else if (erasing === 0) {
        surface.setLineDash([])
        surface.lineDashOffset = 0
      } else {
        surface.setLineDash([length, length])
        surface.lineDashOffset = -distanceAt(pace, erasing)
      }
      surface.stroke(path)
    }
    if (paths.size) frame = requestAnimationFrame(animate)
    else stop()
  }

  window.addEventListener("resize", stop, { signal: controller.signal })
  dialog?.addEventListener("close", stop, { signal: controller.signal })
  if (dialog) dialog.addEventListener("scroll", stop, { capture: true, signal: controller.signal })
  const layer = { paths, stop }
  layers.set(host, layer)
  return layer
}

function clearPendingSidenotes() {
  for (const frame of pendingSidenotes) cancelAnimationFrame(frame)
  pendingSidenotes.clear()
  cancelSidenoteScroll?.()
  cancelSidenoteScroll = undefined
}

document.addEventListener("sidenote:outline", (event) => {
  const { kind, source, targets } = (event as CustomEvent<SidenoteOutline>).detail
  if (!targets.length) {
    clearPendingSidenotes()
    return
  }
  let key = source && returnKeys.get(source)
  if (source && !key) {
    key = Symbol()
    returnKeys.set(source, key)
  }
  const fresh = kind === "blocks" ? targets.filter((target) => !isAnnotationOutlinePlaying(target)) : targets
  if (!fresh.length || (kind === "text" && isAnnotationOutlinePlaying(key ?? fresh[0]))) return
  const frame = requestAnimationFrame(() => {
    pendingSidenotes.delete(frame)
    if (!fresh.every((target) => target.isConnected)) return
    const first = fresh[0]
    const dialog = first.closest<HTMLDialogElement>("dialog[data-sidenote-dialog][open]")
    const draw = () => {
      if (kind === "blocks") {
        const sharesRail = first.hasAttribute("data-sidenote-card")
        const blocks = fresh.flatMap((target) => {
          const { left, right, top, bottom, width, height } = target.getBoundingClientRect()
          if (!width || !height) return []
          if (!sharesRail) return [{ target, rects: [{ left, right, top, bottom }] }]
          const style = getComputedStyle(target)
          const halfRail = parseFloat(style.borderInlineStartWidth) / 2
          // The contour follows the center of the existing border.
          if (style.direction === "rtl") {
            return [{ target, rects: [{ left: left - 1, right: right - halfRail, top, bottom }] }]
          }
          return [{ target, rects: [{ left: left + halfRail, right: right + 1, top, bottom }] }]
        })
        playAnnotationOutline(blocks, sharesRail ? "rail" : "blocks", dialog)
      } else {
        const rects = fresh.flatMap((target) => {
          const range = document.createRange()
          range.selectNodeContents(target)
          return annotationTextRects(range)
        })
        playAnnotationOutline([{ target: first, key, rects }], "text", dialog)
      }
    }
    if (dialog) {
      draw()
      return
    }
    const rect = first.getBoundingClientRect()
    const header = document.querySelector(".site-header")
    const stickyHeaderBottom = header && getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().bottom : 0
    if (rect.top < stickyHeaderBottom || rect.top > innerHeight - Math.min(rect.height, 56)) {
      cancelSidenoteScroll = scrollToReadingPosition(first, "center", draw)
    } else draw()
  })
  pendingSidenotes.add(frame)
})

document.addEventListener("astro:before-swap", () => {
  clearPendingSidenotes()
  for (const layer of layers.values()) layer.stop()
})
