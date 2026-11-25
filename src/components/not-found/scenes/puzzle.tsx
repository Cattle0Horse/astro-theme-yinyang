import { useRef, useState, type MouseEvent } from "react"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Pose, Point } from "../scene-runtime"
import styles from "./puzzle.css?inline"

export default function Puzzle({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pieceRef = useRef<SVGGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const [message, setMessage] = useState("")
  const [dragging, setDragging] = useState(false)
  const [active, setActive] = useState(false)
  const [nearSlot, setNearSlot] = useState(false)
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const piece = pieceRef.current!
    const play = playRef.current!
    let solved = false
    let cancelSnap: (() => void) | null = null
    let base: Pose

    function pose() {
      const matrix = new DOMMatrix(getComputedStyle(piece).transform)
      return { x: matrix.e, y: matrix.f, angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI }
    }

    function writePose(value: Pose) {
      piece.style.transform = "translate(" + value.x + "px," + value.y + "px) rotate(" + value.angle + "deg)"
    }

    function place(on: boolean, releaseVelocity?: Point) {
      if (cancelSnap) cancelSnap()
      solved = on
      setActive(on)
      setNearSlot(false)
      const target = { x: on ? -61 : 0, y: on ? -87 : 0, angle: 0 }
      const speed = releaseVelocity || { x: 0, y: 0 }
      cancelSnap = tools.springTo(
        pose,
        writePose,
        target,
        {
          stiffness: on ? 0.18 : 0.22,
          damping: on ? 0.6 : 0.64,
          velocity: { x: (speed.x || 0) * 16.67, y: (speed.y || 0) * 16.67, angle: 0 },
          threshold: 0.12,
          speedThreshold: 0.02
        },
        function () {
          cancelSnap = null
        }
      )
      if (on) {
        tools.emit(200, 102, 18)
        tools.animate(play, [{ scale: "1" }, { scale: "1.035 .965", offset: 0.25 }, { scale: ".985 1.02", offset: 0.6 }, { scale: "1" }], { duration: 650, easing: "ease-out" })
      }
      setMessage(on ? "拼好了，还是 404" : "就差这最后一块")
    }

    tools.drag(
      piece,
      function () {
        base = pose()
        if (cancelSnap) cancelSnap()
        writePose(base)
        setDragging(true)
      },
      function (p, origin) {
        const x = base.x + p.x - origin.x,
          y = base.y + p.y - origin.y
        piece.style.transform = "translate(" + x + "px," + y + "px) rotate(" + Math.max(-8, Math.min(8, (p.x - origin.x) / 15)) + "deg)"
        setNearSlot(Math.hypot(x + 61, y + 87) < 48)
      },
      function (p, origin, moved, cancelled, releaseVelocity) {
        setDragging(false)
        if (!moved && !cancelled) return
        place(cancelled ? solved : Math.hypot(base.x + p.x - origin.x + 61, base.y + p.y - origin.y + 87) < 55, releaseVelocity)
      }
    )
    activate.current = (event) => {
      if (!tools.canActivate(event)) return
      place(!solved)
    }
  })

  return (
    <Scene name="puzzle" title="少了一块拼图" styles={styles}>
      <div className="nf-puzzle-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play${dragging ? " nf-dragging" : ""}${active ? " nf-complete" : ""}${nearSlot ? " nf-near-slot" : ""}`}
          aria-label="拖回数字零，或点击拼好，再次点击取出"
          aria-pressed={active}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <text className="nf-fill" x="40" y="145" fontSize="120" fontWeight="600">
              4
            </text>
            <text className="nf-fill" x="270" y="145" fontSize="120" fontWeight="600">
              4
            </text>
            <rect x="157" y="54" width="86" height="99" rx="9" className="nf-puzzle-slot nf-soft" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 6" />
            <path className="nf-line nf-accent-stroke" d="M235 199q-37-5-33-32m-7 9 7-9 6 10" opacity=".5" />
            <g className="nf-piece-idle">
              <g ref={pieceRef} className="nf-piece" aria-label="拖动放回数字零">
                <rect x="218" y="141" width="86" height="99" rx="9" className="nf-paper" stroke="var(--accent)" strokeWidth="2" />
                <text x="261" y="216" textAnchor="middle" fontSize="84" fontWeight="600" className="nf-fill-accent">
                  0
                </text>
                <circle cx="290" cy="155" r="2" className="nf-fill-accent" />
                <circle cx="290" cy="163" r="2" className="nf-fill-accent" />
              </g>
            </g>
          </svg>
        </button>
        <SceneStatus className="nf-puzzle-status">{message}</SceneStatus>
      </div>
      <a className="nf-puzzle-home" href={home} data-nf-home>
        ⌂ 回到完整的一页
      </a>
    </Scene>
  )
}
