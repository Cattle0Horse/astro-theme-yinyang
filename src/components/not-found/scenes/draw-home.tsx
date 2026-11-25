import { useRef, useState } from "react"
import { navigate } from "astro:transitions/client"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Point } from "../scene-runtime"
import styles from "./draw-home.css?inline"

export default function DrawHome({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const ballRef = useRef<SVGCircleElement>(null)
  const houseRef = useRef<SVGAElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const guideRef = useRef<SVGPathElement>(null)
  const [message, setMessage] = useState("")
  const [running, setRunning] = useState(false)
  const [arrived, setArrived] = useState(false)
  const resetAction = useRef<() => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const path = pathRef.current!
    const ball = ballRef.current!
    const house = houseRef.current!
    const status = statusRef.current!
    const guide = guideRef.current!
    const svg = tools.svg
    let drawing = false
    let route: Point[] = []
    let frame = 0
    let homeTimer = 0
    let cancelReset: (() => void) | null = null
    let screenMatrix = svg.getScreenCTM()
    let viewport = { width: innerWidth, height: innerHeight }

    function measureStatus() {
      screenMatrix = svg.getScreenCTM()
      viewport = { width: innerWidth, height: innerHeight }
      positionStatus()
    }

    function positionStatus() {
      if (!screenMatrix) return
      const screen = new DOMPoint(Number(ball.getAttribute("cx")), Number(ball.getAttribute("cy"))).matrixTransform(screenMatrix)
      const width = Math.min(220, viewport.width - 32)
      const x = Math.max(16, Math.min(viewport.width - width - 16, screen.x + 16))
      const y = Math.max(16, Math.min(viewport.height - 75, screen.y - 48))
      status.style.transform = `translate(${x}px, ${y}px)`
    }

    function notify(text: string) {
      setMessage(text)
      if (text) measureStatus()
    }

    function moveBall(p: Point) {
      ball.setAttribute("cx", String(p.x))
      ball.setAttribute("cy", String(p.y))
      positionStatus()
    }

    function resetRoute(options?: { instant: boolean }) {
      tools.cancelAnimationFrame(frame)
      tools.clearTimeout(homeTimer)
      if (cancelReset) cancelReset()
      drawing = false
      route = []
      path.setAttribute("d", "")
      const start = { x: 95, y: 85 }
      const current = { x: Number(ball.getAttribute("cx")) || start.x, y: Number(ball.getAttribute("cy")) || start.y }
      if (options && options.instant) moveBall(start)
      else
        cancelReset = tools.springTo(
          function () {
            return current
          },
          moveBall,
          start,
          {
            stiffness: 0.22,
            damping: 0.58,
            threshold: 0.12,
            speedThreshold: 0.02
          },
          function () {
            cancelReset = null
          }
        )
      setRunning(false)
      setArrived(false)
      notify("")
    }

    function addPoint(p: Point) {
      const last = route.at(-1)
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) < 3) return
      route.push(p)
      path.setAttribute("d", path.getAttribute("d") + "L" + p.x + " " + p.y)
    }

    tools.listen(window, "resize", measureStatus)
    tools.listen(window, "scroll", measureStatus)

    tools.drag(
      document,
      function (p, event) {
        if (event.target instanceof Element && event.target.closest("header, a, button, input, textarea, select, summary, [role='button'], [contenteditable]")) return false
        resetRoute({ instant: true })
        drawing = true
        route = [p]
        moveBall(p)
        path.setAttribute("d", "M" + p.x + " " + p.y)
      },
      function (p) {
        if (!drawing) return
        addPoint(p)
      },
      function (p, _origin, moved, cancelled) {
        if (!drawing) return
        drawing = false
        if (cancelled) resetRoute()
        else if (moved) {
          addPoint(p)
          run()
        }
      },
      { captureTarget: svg }
    )
    tools.listen(house, "click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      resetRoute({ instant: true })
      const line = guide
      path.setAttribute("d", line.getAttribute("d") ?? "")
      const length = line.getTotalLength()
      route = [line.getPointAtLength(0), line.getPointAtLength(length)]
      run()
    })
    resetAction.current = () => resetRoute()

    function run() {
      if (route.length < 2) {
        notify("先画一条路，小球才知道怎么走")
        return
      }
      setRunning(true)
      setArrived(false)
      const length = path.getTotalLength()
      const duration = Math.max(900, Math.min(3500, length * 3))
      let began: number | null = null
      notify("沿着你画的路，出发啦")

      function tick(time: number) {
        if (began === null) began = time
        const progress = Math.min(1, (time - began) / duration)
        const p = path.getPointAtLength(length * progress)
        moveBall(p)
        if (progress < 1) frame = tools.requestAnimationFrame(tick)
        else {
          const arrived = p.x >= 495 && p.x <= 559 && p.y >= 223 && p.y <= 290
          setArrived(arrived)
          if (arrived) {
            notify("到家了，正在返回首页")
            homeTimer = tools.setTimeout(function () {
              void navigate(home)
            }, 220)
          } else {
            setRunning(false)
            notify("还没到家，再画近一些吧")
          }
        }
      }

      frame = tools.requestAnimationFrame(tick)
    }
  })

  return (
    <Scene name="draw-home" title="画一条回家的路" styles={styles}>
      <div className={`nf-art nf-drawing-field${running ? " nf-running" : ""}${arrived ? " nf-complete" : ""}`}>
        <button className="nf-draw-home-reset" onClick={() => resetAction.current?.()} type="button" aria-label="清空路线，重新画" title="重画">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10a8 8 0 1 1 .8 7.5" />
            <path d="M4 4v6h6" />
          </svg>
        </button>
        <svg ref={svgRef} className="nf-drawing-canvas" viewBox="0 0 640 360" role="group" aria-label="从任意位置画到小屋，重新下笔即可重画">
          <text x="320" y="234" className="nf-digits nf-ghost" aria-hidden="true">
            404
          </text>
          <path ref={guideRef} d="M95 85C155 85 166 238 300 205S425 200 527 272" className="nf-guide nf-line nf-muted" strokeDasharray="3 8" />
          <path ref={pathRef} className="nf-drawn-path nf-line nf-accent" />
          <a
            ref={(element) => {
              houseRef.current = element instanceof SVGAElement ? element : null
            }}
            className="nf-draw-home-house"
            aria-busy={running || undefined}
            href={home}
            data-nf-home
            aria-label="沿虚线回家，抵达后返回首页"
          >
            <rect x="484" y="220" width="86" height="94" fill="transparent" />
            <g className="nf-house">
              <path d="M503 282v-30l24-21 24 21v30z" className="nf-paper nf-line" />
              <path d="M520 282v-19h14v19" className="nf-line nf-accent" />
              <rect x="536" y="250" width="7" height="7" className="nf-house-window nf-soft" />
            </g>
            <text x="527" y="305" className="nf-small nf-fill-accent">
              回家 ↗
            </text>
          </a>
          <circle
            ref={ballRef}
            className="nf-ball nf-fill-accent"
            onClick={() => resetAction.current?.()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                resetAction.current?.()
              }
            }}
            cx="95"
            cy="85"
            r="9"
            role="button"
            tabIndex={0}
            aria-label="重新画一条路"
          />
        </svg>
      </div>
      <SceneStatus ref={statusRef} className="nf-draw-home-status">
        {message}
      </SceneStatus>
    </Scene>
  )
}
