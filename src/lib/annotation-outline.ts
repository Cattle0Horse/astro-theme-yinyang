import { annotationTextRects, createAnnotationContour, type OutlineRect } from "./annotation-contour"
import { scrollToReadingPosition } from "./reading-scroll"

export interface SidenoteOutline {
  kind: "text" | "blocks"
  targets: HTMLElement[]
}

interface OutlineOptions {
  dialog?: HTMLDialogElement | null
  onStop?: () => void
}

let clearOutline: (() => void) | undefined
let pendingSidenote = 0
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

export function playAnnotationOutline(groups: readonly (readonly OutlineRect[])[], kind: "text" | "blocks", { dialog, onStop }: OutlineOptions = {}) {
  clearOutline?.()
  const x = dialog ? 0 : scrollX
  const y = dialog ? 0 : scrollY
  const paths = groups
    .filter((rects) => rects.length)
    .map((rects) => {
      const documentRects = rects.map(({ left, top, right, bottom }) => ({ left: left + x, right: right + x, top: top + y, bottom: bottom + y }))
      const { path, length, turns } = createAnnotationContour(documentRects, kind === "text" ? 3 : 4, kind === "text" ? 5 : 7)
      const pace = outlinePace(length, turns)
      return { path, length, pace, duration: Math.min(1000, Math.max(285, 155 + pace.travel * 0.76)), closedAt: undefined as number | undefined }
    })
  if (!paths.length) return

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return
  const surface = context
  const width = document.documentElement.clientWidth
  const height = document.documentElement.clientHeight
  const scale = Math.min(devicePixelRatio, 2)
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  canvas.dataset.annotationOutline = ""
  canvas.setAttribute("aria-hidden", "true")
  surface.lineWidth = 1.5
  surface.lineCap = "round"
  surface.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
  const host = dialog ?? document.body
  host.append(canvas)
  const controller = new AbortController()
  let frame = requestAnimationFrame(animate)
  let start: number | undefined

  function stop() {
    if (controller.signal.aborted) return
    cancelAnimationFrame(frame)
    controller.abort()
    canvas.remove()
    if (clearOutline === stop) clearOutline = undefined
    onStop?.()
  }

  function animate(now: number) {
    start ??= now
    surface.resetTransform()
    surface.clearRect(0, 0, canvas.width, canvas.height)
    surface.setTransform(scale, 0, 0, scale, dialog ? 0 : -scrollX * scale, dialog ? 0 : -scrollY * scale)
    let running = false
    for (const outline of paths) {
      const { path, length, pace, duration } = outline
      const drawing = (now - start) / duration
      if (drawing >= 1) outline.closedAt ??= now
      const erasing = Math.max(0, (now - (outline.closedAt ?? now) - 140) / (duration * 0.88))
      if (erasing >= 1) continue
      running = true
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
    if (running) frame = requestAnimationFrame(animate)
    else stop()
  }

  window.addEventListener("resize", stop, { signal: controller.signal })
  dialog?.addEventListener("close", stop, { signal: controller.signal })
  if (dialog && kind === "text") dialog.addEventListener("scroll", stop, { capture: true, signal: controller.signal })
  clearOutline = stop
  return stop
}

export function clearAnnotationFeedback() {
  cancelAnimationFrame(pendingSidenote)
  cancelSidenoteScroll?.()
  cancelSidenoteScroll = undefined
  clearOutline?.()
}

document.addEventListener("sidenote:outline", (event) => {
  const { kind, targets } = (event as CustomEvent<SidenoteOutline>).detail
  clearAnnotationFeedback()
  if (!targets.length) return
  pendingSidenote = requestAnimationFrame(() => {
    if (!targets.every((target) => target.isConnected)) return
    const first = targets[0]
    const dialog = first.closest<HTMLDialogElement>("dialog[data-sidenote-dialog][open]")
    const draw = () => {
      if (kind === "blocks") {
        const blocks = targets.map((target) => ({ target, rect: target.getBoundingClientRect() })).filter(({ rect }) => rect.width > 0 && rect.height > 0)
        const cards = blocks.map(({ target }) => target).filter((target) => target.hasAttribute("data-sidenote-card"))
        const stop = playAnnotationOutline(
          blocks.map(({ rect }) => [rect]),
          "blocks",
          {
            dialog,
            onStop: () => cards.forEach((card) => card.removeAttribute("data-outline-active"))
          }
        )
        if (stop) for (const card of cards) card.setAttribute("data-outline-active", "")
      } else {
        const rects = targets.flatMap((target) => {
          const range = document.createRange()
          range.selectNodeContents(target)
          return annotationTextRects(range)
        })
        playAnnotationOutline([rects], "text", { dialog })
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
})

document.addEventListener("astro:before-swap", clearAnnotationFeedback)
