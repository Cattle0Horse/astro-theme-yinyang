import { useRef, useState, type MouseEvent } from "react"
import { navigate } from "astro:transitions/client"
import { Scene, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { Point } from "../scene-runtime"
import styles from "./sleep.css?inline"

export default function Sleep({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const faceRef = useRef<SVGGElement>(null)
  const homeLinkRef = useRef<HTMLAnchorElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const dreamsRef = useRef<SVGGElement>(null)
  const leftPupilRef = useRef<SVGCircleElement>(null)
  const rightPupilRef = useRef<SVGCircleElement>(null)
  const [message, setMessage] = useState("")
  const [awake, setAwake] = useState(false)
  const [closing, setClosing] = useState(false)
  const [leavingPage, setLeavingPage] = useState(false)
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const play = playRef.current!
    const face = faceRef.current!
    const homeLink = homeLinkRef.current!
    const eyes = eyesRef.current!
    const dreams = dreamsRef.current!
    const leftPupil = leftPupilRef.current!
    const rightPupil = rightPupilRef.current!
    let timer = 0
    let cancelWake: (() => void) | null = null
    let cancelClose: (() => void) | null = null
    let cancelDreams: (() => void) | null = null
    let falling = false
    let afterSleep: (() => void) | null = null
    let leaving = false
    let motionOrigin: Point | null = null
    let lastPointer: Point | null = null
    let motionStarted = 0
    let isAwake = false

    function wake() {
      if (leaving) return
      const changed = !isAwake || falling
      tools.clearTimeout(timer)
      if (cancelClose) cancelClose()
      if (cancelDreams) cancelDreams()
      cancelClose = cancelDreams = null
      falling = false
      afterSleep = null
      isAwake = true
      setAwake(true)
      setClosing(false)
      if (changed) setMessage("嗯？有人在找我吗？")
    }

    function nap() {
      if (leaving || falling || !isAwake) return
      tools.clearTimeout(timer)
      timer = tools.setTimeout(fallAsleep, 1800)
    }

    function finishSleep() {
      cancelDreams = null
      falling = false
      setClosing(false)
      setMessage("呼……睡着了")
      const done = afterSleep
      afterSleep = null
      if (done) done()
    }

    function showDreams() {
      cancelClose = null
      isAwake = false
      setAwake(false)
      cancelDreams = tools.animate(dreams, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: "ease-out", fill: "both" }, finishSleep)
    }

    function fallAsleep(complete?: () => void) {
      if (complete) afterSleep = complete
      if (falling) return
      falling = true
      motionOrigin = lastPointer
      motionStarted = performance.now()
      setMessage(leaving ? "嘘，慢慢睡着吧" : "困了，慢慢闭上眼睛")
      const from = getComputedStyle(eyes).scale
      setClosing(true)
      if (isAwake) {
        cancelClose = tools.animate(eyes, [{ scale: from }, { scale: "1 .05" }], { duration: 420, easing: "ease-in-out", fill: "both" }, showDreams)
      } else showDreams()
    }

    tools.listen(document, "pointermove", function (event) {
      const point = { x: event.clientX, y: event.clientY }
      const now = performance.now()
      if (leaving) {
        lastPointer = point
        return
      }
      if (isAwake && !falling) {
        tools.clearTimeout(timer)
        motionOrigin = point
        motionStarted = now
      } else {
        if (!motionOrigin || now - motionStarted > 700) {
          motionOrigin = lastPointer || point
          motionStarted = now
        }
        if (Math.hypot(point.x - motionOrigin.x, point.y - motionOrigin.y) >= 36) {
          wake()
          motionOrigin = point
          motionStarted = now
        }
      }
      lastPointer = point
    })
    tools.listen(document, "pointerleave", nap)
    tools.listen(play, "focus", wake)
    tools.listen(play, "blur", nap)
    activate.current = (event) => {
      if (!tools.canActivate(event)) return
      if (leaving) return
      wake()
      const from = getComputedStyle(face).transform
      if (cancelWake) cancelWake()
      cancelWake = tools.animate(
        face,
        [
          { transform: from },
          { transform: "translateY(8px) scale(1.08,.9)", offset: 0.2 },
          { transform: "translateY(-12px) scale(.95,1.06)", offset: 0.5 },
          { transform: "translateY(0) scale(1)" }
        ],
        { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" }
      )
      tools.emit(200, 106, 9)
      setMessage("醒了醒了……你找哪一页？")
      if (window.matchMedia("(hover: none)").matches) nap()
    }
    tools.follow(document, function (state) {
      if (leaving) return
      ;[leftPupil, rightPupil].forEach(function (pupil) {
        pupil.style.transform = "translate(" + state.x * 7 + "px," + state.y * 7 + "px)"
      })
    })
    tools.listen(homeLink, "click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      if (leaving) return
      leaving = true
      setLeavingPage(true)
      tools.clearTimeout(timer)
      fallAsleep(function () {
        void navigate(home)
      })
    })
  })

  return (
    <Scene name="sleep" title="404 睡着了" styles={styles}>
      <div className="nf-sleep-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play${awake ? " nf-awake" : " nf-asleep"}${closing ? " nf-falling-asleep" : ""}`}
          aria-label="眼球跟随窗口内的光标，点击轻轻戳一下"
          aria-pressed={awake}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <text className="nf-fill nf-reference-digit" x="20" y="177">
              4
            </text>
            <text className="nf-fill nf-reference-digit" x="285" y="177">
              4
            </text>
            <g ref={faceRef} className="nf-sleep-face">
              <rect className="nf-soft" x="137" y="58" width="126" height="137" rx="63" />
              <g className="nf-eye-shut nf-line nf-accent-stroke">
                <path d="M160 116q12 12 24 0m32 0q12 12 24 0" />
              </g>
              <g ref={eyesRef} className="nf-eye-open">
                <ellipse className="nf-paper" cx="171" cy="120" rx="18" ry="23" />
                <ellipse className="nf-paper" cx="229" cy="120" rx="18" ry="23" />
                <circle ref={leftPupilRef} className="nf-fill nf-pupil" cx="171" cy="122" r="7" />
                <circle ref={rightPupilRef} className="nf-fill nf-pupil" cx="229" cy="122" r="7" />
              </g>
              <path className="nf-line nf-accent-stroke" d="M190 153q10 8 20 0" />
            </g>
            <g ref={dreamsRef} className="nf-dreams nf-fill-accent" fontSize="18">
              <text x="266" y="76">
                z
              </text>
              <text x="287" y="52" fontSize="24">
                z
              </text>
              <text x="315" y="27" fontSize="30">
                z
              </text>
            </g>
            <ellipse className="nf-soft" cx="200" cy="216" rx="110" ry="7" />
          </svg>
        </button>
        <p role="status" className="nf-sleep-status">
          {message}
        </p>
      </div>
      <a ref={homeLinkRef} className="nf-sleep-home" aria-disabled={leavingPage || undefined} href={home} data-nf-home>
        ☾ 让它睡吧，回家
      </a>
    </Scene>
  )
}
