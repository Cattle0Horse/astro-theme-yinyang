import { useRef, useState, type MouseEvent } from "react"
import { Scene, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import styles from "./constellation.css?inline"

export default function Constellation({ home }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const playRef = useRef<HTMLButtonElement>(null)
  const starsGroupRef = useRef<SVGGElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const [message, setMessage] = useState("")
  const [active, setActive] = useState(false)
  const activate = useRef<(event: MouseEvent<HTMLButtonElement>) => void>(null)

  useSceneMotion(svgRef, (tools) => {
    const play = playRef.current!
    const starsGroup = starsGroupRef.current!
    const trail = trailRef.current!
    const stars = Array.from(starsGroup.children) as SVGCircleElement[]
    const visited = new Set<SVGCircleElement>()
    let complete = false
    stars.forEach(function (star, index) {
      star.style.setProperty("--delay", -index * 0.37 + "s")
      star.style.setProperty("--twinkle", 2 + (index % 4) * 0.6 + "s")
    })

    function reveal() {
      complete = true
      setActive(true)
      tools.emit(200, 120, 18)
      setMessage("找到啦，是一座 404 星座")
    }

    tools.listen(play, "pointermove", function (event) {
      if (complete) return
      const p = tools.point(event)
      const star = stars.find(function (node) {
        return !visited.has(node) && Math.hypot(p.x - Number(node.getAttribute("cx")), p.y - Number(node.getAttribute("cy"))) < 18
      })
      if (!star) return
      visited.add(star)
      star.classList.add("nf-visited")
      trail.setAttribute(
        "d",
        Array.from(visited)
          .map(function (node, index) {
            return (index ? "L" : "M") + node.getAttribute("cx") + " " + node.getAttribute("cy")
          })
          .join(" ")
      )
      tools.emit(Number(star.getAttribute("cx")), Number(star.getAttribute("cy")), 4)
      if (visited.size >= 6) reveal()
    })
    activate.current = (event) => {
      if (!tools.canActivate(event)) return
      if (!complete) reveal()
      else {
        complete = false
        visited.clear()
        trail.setAttribute("d", "")
        stars.forEach(function (star) {
          star.classList.remove("nf-visited")
        })
        setActive(false)
        setMessage("星星散开了，沿星光再找一次")
      }
    }
    tools.drag(
      play,
      function () {},
      function () {},
      function () {}
    )
  })

  return (
    <Scene name="constellation" title="星图走失" styles={styles}>
      <div className="nf-constellation-stage">
        <button
          ref={playRef}
          type="button"
          className={`nf-art nf-play nf-reference-play${active ? " nf-complete" : ""}`}
          aria-label="划过星星连出 404，点击或按回车揭晓，再次点击重玩"
          aria-pressed={active}
          onClick={(event) => activate.current?.(event)}
        >
          <svg ref={svgRef} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <path ref={trailRef} className="nf-star-trail" />
            <g className="nf-constellation-lines nf-line nf-accent-stroke">
              <path d="m91 47-50 92h87m-28-92v142M168 54l-17 19v91l17 19h39l17-19V73l-17-19zM299 47l-50 92h87m-28-92v142" />
            </g>
            <g ref={starsGroupRef} className="nf-fill-accent">
              <circle className="nf-star" cx="91" cy="47" r="3" />
              <circle className="nf-star" cx="41" cy="139" r="3" />
              <circle className="nf-star" cx="128" cy="139" r="3" />
              <circle className="nf-star" cx="100" cy="189" r="3" />
              <circle className="nf-star" cx="100" cy="96" r="3" />
              <circle className="nf-star" cx="168" cy="54" r="3" />
              <circle className="nf-star" cx="151" cy="73" r="3" />
              <circle className="nf-star" cx="151" cy="164" r="3" />
              <circle className="nf-star" cx="168" cy="183" r="3" />
              <circle className="nf-star" cx="207" cy="183" r="3" />
              <circle className="nf-star" cx="224" cy="164" r="3" />
              <circle className="nf-star" cx="224" cy="73" r="3" />
              <circle className="nf-star" cx="207" cy="54" r="3" />
              <circle className="nf-star" cx="299" cy="47" r="3" />
              <circle className="nf-star" cx="249" cy="139" r="3" />
              <circle className="nf-star" cx="336" cy="139" r="3" />
              <circle className="nf-star" cx="308" cy="189" r="3" />
              <circle className="nf-star" cx="308" cy="96" r="3" />
            </g>
            <g className="nf-muted" opacity=".5">
              <circle cx="40" cy="35" r="1.5" />
              <circle cx="183" cy="27" r="1.5" />
              <circle cx="267" cy="26" r="1.5" />
              <circle cx="350" cy="74" r="1.5" />
              <circle cx="44" cy="194" r="1.5" />
              <circle cx="126" cy="220" r="1.5" />
              <circle cx="248" cy="209" r="1.5" />
              <circle cx="365" cy="176" r="1.5" />
              <circle cx="267" cy="80" r="1.5" />
            </g>
            <path d="m344 214 4-10 4 10-4-3z" className="nf-muted" />
            <text className="nf-muted" x="348" y="233" fontSize="9" textAnchor="middle">
              N
            </text>
          </svg>
        </button>
        <p role="status" className="nf-constellation-status">
          {message}
        </p>
      </div>
      <a className="nf-constellation-home" href={home} data-nf-home>
        ✧ ─ ─ ⌂ 归航
      </a>
    </Scene>
  )
}
