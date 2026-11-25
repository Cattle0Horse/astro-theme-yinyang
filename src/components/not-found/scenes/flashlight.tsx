import { useRef, useState, type MouseEvent } from "react"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Point } from "../scene-runtime"
import styles from "./flashlight.css?inline"

export default function Flashlight({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const clipRef = useRef<SVGCircleElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const [message, setMessage] = useState("")
  const [active, setActive] = useState(false)
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const play = playRef.current!
    const status = statusRef.current!
    const clip = clipRef.current!
    const glow = glowRef.current!
    const ring = ringRef.current!
    const spots = [clip, glow, ring]
    let x = 199,
      y = 123,
      targetX = x,
      targetY = y
    let pinned = false
    let frame = 0,
      last = 0
    let ignoreClickUntil = 0

    function draw() {
      spots.forEach(function (circle) {
        circle.setAttribute("cx", String(x))
        circle.setAttribute("cy", String(y))
      })
      const anchor = tools.svg.createSVGPoint()
      anchor.x = x
      anchor.y = y + 65
      const screen = anchor.matrixTransform(tools.svg.getScreenCTM() ?? undefined)
      status.style.left = Math.max(16, Math.min(window.innerWidth - 236, screen.x - 110)) + "px"
      status.style.top = Math.max(16, Math.min(window.innerHeight - 70, screen.y + 8)) + "px"
    }

    function tick(time: number) {
      frame = 0
      const delta = last ? Math.min(3, (time - last) / 16.67) : 1
      last = time
      const factor = 1 - Math.pow(0.82, delta)
      x += (targetX - x) * factor
      y += (targetY - y) * factor
      draw()
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.1) request()
    }

    function request() {
      if (!frame && !document.hidden) frame = tools.requestAnimationFrame(tick)
    }

    function shine(p: Point) {
      if (pinned) return
      targetX = p.x
      targetY = p.y
      request()
    }

    tools.listen(document, "pointermove", function (event) {
      shine(tools.point(event))
    })
    tools.drag(
      document,
      function (p, event) {
        if (event.target instanceof Element && event.target.closest("header, a, button, input, textarea, select, summary")) return false
        shine(p)
      },
      shine,
      function (_p, _origin, moved) {
        if (moved) ignoreClickUntil = performance.now() + 400
      },
      { captureTarget: tools.svg }
    )

    function toggleGhost() {
      pinned = !pinned
      setActive(pinned)
      if (pinned) {
        targetX = 206
        targetY = 105
        tools.emit(206, 103, 9)
      }
      setMessage(pinned ? "找到一只幽灵，页面还没找到" : "放开它，继续找一找")
      request()
    }

    activate.current = (event) => {
      if (!tools.canActivate(event)) return
      event.stopPropagation()
      toggleGhost()
    }
    tools.listen(document, "click", function (event) {
      if (
        event.defaultPrevented ||
        performance.now() < ignoreClickUntil ||
        event.button !== 0 ||
        (event.target instanceof Element && (play.contains(event.target) || event.target.closest("header, a, button, input, textarea, select, summary")))
      )
        return
      toggleGhost()
    })
    tools.listen(play, "keydown", function (event) {
      const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }
      const delta = directions[event.key]
      if (!delta) return
      event.preventDefault()
      pinned = false
      setActive(false)
      shine({ x: targetX + delta[0], y: targetY + delta[1] })
    })
    tools.listen(document, "visibilitychange", function () {
      tools.cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (!document.hidden) request()
    })
  })

  return (
    <Scene name="flashlight" title="用光找一找" styles={styles}>
      <div className="nf-flashlight-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play`}
          aria-label="移动光圈寻找小幽灵，点击抓住或放开；方向键移动光圈"
          aria-pressed={active}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <defs>
              <clipPath id="spotclip">
                <circle ref={clipRef} className="nf-spot" cx="199" cy="123" r="65" />
              </clipPath>
            </defs>
            <text x="22" y="182" fontSize="155" fontWeight="600" className="nf-soft">
              404
            </text>
            <circle ref={glowRef} className="nf-spot nf-soft" cx="199" cy="123" r="65" />
            <g clipPath="url(#spotclip)">
              <text x="22" y="182" fontSize="155" fontWeight="600" className="nf-fill-accent">
                404
              </text>
              <path className="nf-paper" d="M184 96q0-25 22-25t22 25v55l-11-8-11 8-11-8-11 8z" />
              <ellipse className="nf-fill nf-ghost-eye" cx="199" cy="105" rx="3" ry="5" />
              <ellipse className="nf-fill nf-ghost-eye" cx="214" cy="105" rx="3" ry="5" />
            </g>
            <circle ref={ringRef} className="nf-spot" cx="199" cy="123" r="65" fill="none" stroke="var(--accent)" strokeWidth="1" opacity=".35" />
            <path className="nf-line nf-border-stroke" d="M77 28h9m-4.5-4.5v9m246 161h9m-4.5-4.5v9" />
          </svg>
        </button>
        <SceneStatus ref={statusRef} className="nf-flashlight-status">
          {message}
        </SceneStatus>
      </div>
      <a className="nf-flashlight-home" href={home} data-nf-home>
        ⌂ 出口在这里
      </a>
    </Scene>
  )
}
