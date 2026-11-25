import { useRef, useState, type MouseEvent } from "react"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Pose } from "../scene-runtime"
import styles from "./cat.css?inline"

export default function Cat({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zeroRef = useRef<SVGGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const pawRef = useRef<SVGGElement>(null)
  const [message, setMessage] = useState("")
  const [dragging, setDragging] = useState(false)
  const [active, setActive] = useState(false)
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const zero = zeroRef.current!
    const paw = pawRef.current!
    let moved = false
    let cancelRoll: (() => void) | undefined
    let base: Pose

    function pose() {
      const matrix = new DOMMatrix(getComputedStyle(zero).transform)
      return { x: matrix.e, y: matrix.f, angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI }
    }

    function transform(p: Pose) {
      return "translate(" + p.x + "px," + p.y + "px) rotate(" + p.angle + "deg)"
    }

    function roll(on: boolean, velocity: number) {
      const from = pose()
      if (cancelRoll) cancelRoll()
      moved = on
      setActive(on)
      const to = { x: on ? 88 : 0, y: on ? 50 : 0, angle: on ? 34 : 0 }
      zero.style.transform = transform(to)
      cancelRoll = tools.animate(
        zero,
        [
          { transform: transform(from) },
          { transform: "translate(" + (to.x + velocity * 12) + "px," + (to.y - 14) + "px) rotate(" + (on ? 40 : -8) + "deg)", offset: 0.65 },
          { transform: transform(to) }
        ],
        { duration: 900, easing: "cubic-bezier(.2,.7,.25,1)", fill: "both" }
      )
      tools.animate(paw, [{ translate: "0 0" }, { translate: "-14px 13px", offset: 0.35 }, { translate: "0 0" }], { duration: 520, easing: "ease-out" })
      if (on) tools.emit(259, 148, 8)
      setMessage(on ? "它推了，还装作没看见" : "把零悄悄放回来了")
    }

    activate.current = (event) => {
      if (!tools.canActivate(event)) return
      roll(!moved, 0)
    }
    tools.drag(
      zero,
      function () {
        base = pose()
        if (cancelRoll) cancelRoll()
        zero.style.transform = transform(base)
        setDragging(true)
      },
      function (p, origin) {
        zero.style.transform = transform({ x: base.x + p.x - origin.x, y: base.y + (p.y - origin.y) * 0.5, angle: base.angle + (p.x - origin.x) * 0.6 })
      },
      function (p, origin, dragged, cancelled, velocity) {
        setDragging(false)
        if (cancelled) {
          roll(moved, 0)
          return
        }
        if (!dragged) return
        roll(base.x + p.x - origin.x + velocity.x * 80 > 15, velocity.x)
      }
    )
  })

  return (
    <Scene name="cat" title="是猫干的" styles={styles}>
      <div className="nf-cat-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play${dragging ? " nf-dragging" : ""}${active ? " nf-pushed" : ""}`}
          aria-label="拨动中间的零，或点击让猫爪推一下"
          aria-pressed={active}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <text className="nf-fill nf-reference-digit" x="27" y="179">
              4
            </text>
            <text className="nf-fill nf-reference-digit" x="283" y="179">
              4
            </text>
            <ellipse className="nf-cat-shadow nf-soft" cx="200" cy="214" rx="43" ry="4" />
            <g ref={zeroRef} className="nf-cat-zero">
              <circle cx="200" cy="134" r="48" className="nf-soft" />
              <circle cx="200" cy="134" r="33" fill="none" stroke="var(--accent)" strokeWidth="11" />
            </g>
            <path className="nf-line nf-border-stroke" d="M30 210h340" />
            <g ref={pawRef} className="nf-cat-paw">
              <path className="nf-soft" d="M294 20q-14 26-41 48l-17 23q-10 20 7 24 18 1 27-10l28-24q31-18 34-46z" />
              <path className="nf-line nf-accent-stroke" d="M294 20q-14 26-41 48l-17 23q-10 20 7 24 18 1 27-10l28-24q31-18 34-46" />
              <path className="nf-line nf-accent-stroke" d="m243 93-5 12m16-15-4 13m17-19-6 12" />
            </g>
            <path className="nf-line nf-border-stroke" d="m90 43 5-12m-24 23-10-4m37 2 9-6" />
          </svg>
        </button>
        <SceneStatus className="nf-cat-status">{message}</SceneStatus>
      </div>
      <a className="nf-cat-home" href={home} data-nf-home>
        ⌂ 趁猫没注意，回家
      </a>
    </Scene>
  )
}
