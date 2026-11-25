import { useRef, useState, type MouseEvent } from "react"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Pose } from "../scene-runtime"
import styles from "./receipt.css?inline"

export default function Receipt({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const ticketRef = useRef<SVGGElement>(null)
  const feedRef = useRef<SVGGElement>(null)
  const [message, setMessage] = useState("")
  const [dragging, setDragging] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [reason, setReason] = useState("页面被猫叼走了")
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const ticket = ticketRef.current!
    const feed = feedRef.current!
    let busy = false
    let count = 0
    let cancelReturn: (() => void) | null = null
    const reasons = ["页面被猫叼走了", "服务器去喝奶茶了", "这一页提前下班了", "内容正在环游宇宙", "作者忘了带这一页"]

    function finishPrint() {
      busy = false
      setPrinting(false)
      feed.removeAttribute("clip-path")
      setMessage("已重新开票")
    }

    function pose() {
      const matrix = new DOMMatrix(getComputedStyle(ticket).transform)
      return { x: matrix.e, y: matrix.f, angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI }
    }

    function writePose(value: Pose) {
      ticket.style.transform = "translate(" + value.x + "px," + value.y + "px) rotate(" + value.angle + "deg)"
    }

    function feedTicket() {
      setReason(reasons[++count % reasons.length])
      ticket.style.transform = ""
      feed.setAttribute("clip-path", "url(#nf-receipt-feed)")
      tools.animate(
        ticket,
        [
          { transform: "translateY(-130px)", opacity: 0 },
          { transform: "translateY(4px)", opacity: 1, offset: 0.8 },
          { transform: "translateY(0)", opacity: 1 }
        ],
        { duration: 650, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" },
        finishPrint
      )
    }

    function print() {
      if (busy) return
      busy = true
      setPrinting(true)
      const from = getComputedStyle(ticket).transform
      const position = new DOMMatrix(from)
      if (cancelReturn) cancelReturn()
      feed.removeAttribute("clip-path")
      setMessage("")
      tools.animate(
        ticket,
        [
          { transform: from, opacity: 1 },
          { transform: "translate(" + position.e + "px," + (position.f + 135) + "px) rotate(12deg)", opacity: 0 }
        ],
        { duration: 420, easing: "cubic-bezier(.4,0,.7,1)", fill: "both" },
        feedTicket
      )
    }

    tools.drag(
      ticket,
      function () {
        if (busy) return false
        if (cancelReturn) cancelReturn()
        feed.removeAttribute("clip-path")
        setMessage("")
        setDragging(true)
      },
      function (p, origin) {
        ticket.style.transform = "translate(" + (p.x - origin.x) + "px," + (p.y - origin.y) + "px) rotate(" + Math.max(-12, Math.min(12, (p.x - origin.x) / 15)) + "deg)"
      },
      function (p, origin, moved, cancelled, releaseVelocity) {
        setDragging(false)
        if (!moved && !cancelled) return
        if (!cancelled && p.y - origin.y > 38) print()
        else {
          const speed = releaseVelocity || { x: 0, y: 0 }
          cancelReturn = tools.springTo(
            pose,
            writePose,
            { x: 0, y: 0, angle: 0 },
            {
              stiffness: 0.2,
              damping: 0.62,
              velocity: { x: (speed.x || 0) * 16.67, y: (speed.y || 0) * 16.67, angle: 0 },
              threshold: 0.12,
              speedThreshold: 0.02
            },
            function () {
              cancelReturn = null
            }
          )
        }
      }
    )
    activate.current = (event) => {
      if (tools.canActivate(event)) print()
    }
  })

  return (
    <Scene name="receipt" title="缺页小票" styles={styles}>
      <div className="nf-receipt-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play${dragging ? " nf-dragging" : ""}${printing ? " nf-printing" : ""}`}
          aria-label="下拉撕走小票，或点击重新打印"
          aria-busy={printing}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <rect x="99" y="20" width="202" height="27" rx="8" className="nf-soft" />
            <rect x="110" y="33" width="180" height="4" rx="2" className="nf-fill" opacity=".25" />
            <defs>
              <clipPath id="nf-receipt-feed">
                <rect x="90" y="35" width="240" height="210" />
              </clipPath>
            </defs>
            <g ref={feedRef} className="nf-ticket-feed">
              <g className="nf-ticket-idle">
                <g ref={ticketRef} className="nf-ticket">
                  <path className="nf-paper" stroke="var(--rule)" d="M116 36h168v184l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6z" />
                  <text className="nf-fill" textAnchor="middle" x="200" y="72" fontSize="11" letterSpacing="3">
                    YINYANG STORE
                  </text>
                  <text className="nf-fill-accent" x="200" y="117" textAnchor="middle" fontSize="43" fontWeight="600">
                    404
                  </text>
                  <path className="nf-border-stroke nf-line" strokeDasharray="2 5" d="M132 130h136" />
                  <text className="nf-muted" x="134" y="150" fontSize="10">
                    页面 × 0
                  </text>
                  <text className="nf-muted" x="266" y="150" textAnchor="end" fontSize="10">
                    ¥ 0.00
                  </text>
                  <text className="nf-ticket-reason nf-fill" textAnchor="middle" x="200" y="175" fontSize="11">
                    原因：{reason}
                  </text>
                  <path
                    className="nf-ink-stroke"
                    strokeWidth="2"
                    d="M155 188v15m5-15v15m8-15v15m4-15v15m8-15v15m5-15v15m8-15v15m7-15v15m4-15v15m8-15v15m5-15v15m7-15v15m5-15v15m9-15v15m5-15v15"
                  />
                </g>
              </g>
            </g>
          </svg>
        </button>
        <SceneStatus className="nf-receipt-status" aria-label={message ? "已重新开票，原因：" + reason : undefined}>
          {message}
        </SceneStatus>
      </div>
      <a className="nf-receipt-home" href={home} data-nf-home>
        离店 → 首页
      </a>
    </Scene>
  )
}
