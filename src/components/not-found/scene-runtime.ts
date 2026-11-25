export interface Point {
  x: number
  y: number
}

export interface Pose extends Point {
  angle: number
}

interface SpringOptions<T> {
  velocity?: Partial<T>
  stiffness?: number
  damping?: number
  threshold?: number
  speedThreshold?: number
}

export type SceneMotion = ReturnType<typeof createSceneMotion>

export function createSceneMotion(svg: SVGSVGElement) {
  const controller = new AbortController()
  const frames = new Set<number>()
  const timers = new Set<number>()
  const cleanups = new Set<() => void>()
  let ignoredUntil = 0
  let ignoredTarget: Element | undefined

  function listen<K extends keyof (HTMLElementEventMap & DocumentEventMap)>(target: EventTarget, type: K, callback: (event: (HTMLElementEventMap & DocumentEventMap)[K]) => void) {
    target.addEventListener(type, callback as EventListener, { signal: controller.signal })
  }

  function clearTimeout(id: number) {
    window.clearTimeout(id)
    timers.delete(id)
  }

  function setTimeout(callback: () => void, delay: number) {
    const id = window.setTimeout(() => {
      timers.delete(id)
      callback()
    }, delay)
    timers.add(id)
    return id
  }

  function cancelAnimationFrame(id: number) {
    window.cancelAnimationFrame(id)
    frames.delete(id)
  }

  function requestAnimationFrame(callback: FrameRequestCallback) {
    const id = window.requestAnimationFrame((time) => {
      frames.delete(id)
      callback(time)
    })
    frames.add(id)
    return id
  }

  function point(event: MouseEvent): Point {
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }

  function canActivate(event: { detail: number; target: EventTarget | null }) {
    return !event.detail || performance.now() >= ignoredUntil || !(event.target instanceof Node) || !ignoredTarget?.contains(event.target)
  }

  function drag(
    target: Element | Document,
    start: (p: Point, event: PointerEvent) => boolean | void,
    move: (p: Point, origin: Point) => void,
    end: (p: Point, origin: Point, moved: boolean, cancelled: boolean, velocity: Point) => void
  ) {
    const capture = target instanceof Element ? target : svg
    let dragState: { id: number; origin: Point; previous: Point; time: number; velocity: Point; moved: boolean } | undefined
    listen(target, "pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || dragState) return
      const origin = point(event)
      if (start(origin, event) === false) return
      event.preventDefault()
      dragState = { id: event.pointerId, origin, previous: origin, time: performance.now(), velocity: { x: 0, y: 0 }, moved: false }
      capture.setPointerCapture(event.pointerId)
    })
    listen(target, "pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.id) return
      const p = point(event)
      const now = performance.now()
      const elapsed = Math.max(1, now - dragState.time)
      dragState.velocity = { x: (p.x - dragState.previous.x) / elapsed, y: (p.y - dragState.previous.y) / elapsed }
      dragState.previous = p
      dragState.time = now
      dragState.moved ||= Math.hypot(p.x - dragState.origin.x, p.y - dragState.origin.y) > 5
      move(p, dragState.origin)
    })
    const finish = (event: PointerEvent) => {
      if (!dragState || event.pointerId !== dragState.id) return
      const { id, origin, moved, time, velocity } = dragState
      dragState = undefined
      if (capture.hasPointerCapture(id)) capture.releasePointerCapture(id)
      if (moved) {
        ignoredTarget = capture
        ignoredUntil = performance.now() + 400
      }
      end(point(event), origin, moved, event.type !== "pointerup", performance.now() - time > 100 ? { x: 0, y: 0 } : velocity)
    }

    listen(target, "pointerup", finish)
    listen(target, "pointercancel", finish)
    listen(capture, "lostpointercapture", finish)
    cleanups.add(() => {
      if (dragState && capture.hasPointerCapture(dragState.id)) capture.releasePointerCapture(dragState.id)
    })
  }

  function animate(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions, complete?: () => void) {
    const motion = element.animate(keyframes, options)
    const timer = setTimeout(finish, Number(options.duration) + (options.delay ?? 0) + 100)
    motion.addEventListener("finish", finish, { once: true, signal: controller.signal })
    cleanups.add(cancel)

    function cancel() {
      if (!cleanups.delete(cancel)) return
      clearTimeout(timer)
      motion.removeEventListener("finish", finish)
      motion.cancel()
    }

    function finish() {
      if (!cleanups.has(cancel)) return
      cancel()
      complete?.()
    }

    return cancel
  }

  function springTo<T extends Point>(from: T, write: (value: T) => void, target: T, options: SpringOptions<T>, complete?: () => void) {
    const keys = Object.keys(target) as (keyof T)[]
    const current = { ...from }
    const velocity = { ...options.velocity } as Partial<T>
    const { stiffness = 0.18, damping = 0.66, threshold = 0.15, speedThreshold = 0.02 } = options
    let frame = 0
    let previous = 0
    cleanups.add(cancel)
    frame = requestAnimationFrame(tick)

    function cancel() {
      if (cleanups.delete(cancel)) cancelAnimationFrame(frame)
    }

    function tick(time: number) {
      if (!cleanups.has(cancel)) return
      const delta = previous ? Math.min(2, Math.max(0.25, (time - previous) / 16.67)) : 1
      previous = time
      let settled = true
      for (const key of keys) {
        const value = Number(current[key])
        const destination = Number(target[key])
        const speed = (Number(velocity[key] ?? 0) + (destination - value) * stiffness * delta) * damping ** delta
        velocity[key] = speed as T[typeof key]
        current[key] = (value + speed * delta) as T[typeof key]
        if (Math.abs(Number(current[key]) - destination) > threshold || Math.abs(speed) > speedThreshold) settled = false
      }
      if (settled) {
        write(target)
        cancel()
        complete?.()
      } else {
        write(current)
        frame = requestAnimationFrame(tick)
      }
    }

    return cancel
  }

  function emit(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      dot.setAttribute("cx", String(x))
      dot.setAttribute("cy", String(y))
      dot.setAttribute("r", String(1.5 + Math.random() * 2))
      dot.setAttribute("class", "nf-particle nf-fill-accent")
      dot.style.transformOrigin = x + "px " + y + "px"
      svg.append(dot)
      const angle = (i / count) * Math.PI * 2
      const length = 24 + Math.random() * 40
      animate(
        dot,
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + Math.cos(angle) * length + "px," + (Math.sin(angle) * length - 12) + "px) scale(.15)", opacity: 0 }
        ],
        { duration: 650 + Math.random() * 300, easing: "cubic-bezier(.1,.7,.3,1)", fill: "both" },
        () => dot.remove()
      )
    }
  }

  function follow(target: Element | Document, callback: (position: Point) => void) {
    const position = { x: 0, y: 0 }
    const velocity = { x: 0, y: 0 }
    const destination = { x: 0, y: 0 }
    let frame = 0
    let previous = 0

    function request() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick)
    }

    function tick(time: number) {
      frame = 0
      const delta = previous ? Math.min(2, Math.max(0.25, (time - previous) / 16.67)) : 1
      previous = time
      for (const axis of ["x", "y"] as const) {
        velocity[axis] = (velocity[axis] + (destination[axis] - position[axis]) * 0.075 * delta) * 0.74 ** delta
        position[axis] += velocity[axis] * delta
      }
      callback(position)
      if (Math.abs(destination.x - position.x) + Math.abs(destination.y - position.y) + Math.abs(velocity.x) + Math.abs(velocity.y) > 0.005) request()
    }

    listen(target, "pointermove", (event) => {
      const p = point(event)
      destination.x = Math.max(-1, Math.min(1, (p.x - 200) / 180))
      destination.y = Math.max(-1, Math.min(1, (p.y - 122) / 110))
      request()
    })
    listen(target, "pointerleave", () => {
      destination.x = destination.y = 0
      request()
    })
    listen(document, "visibilitychange", () => {
      cancelAnimationFrame(frame)
      frame = previous = 0
      request()
    })
  }

  function dispose() {
    controller.abort()
    cleanups.forEach((cleanup) => cleanup())
    frames.forEach(cancelAnimationFrame)
    timers.forEach(clearTimeout)
  }

  return {
    listen,
    point,
    canActivate,
    drag,
    animate,
    springTo,
    emit,
    follow,
    svg,
    setTimeout,
    clearTimeout,
    requestAnimationFrame,
    cancelAnimationFrame,
    dispose
  }
}
