import { useRef, useState } from "react"
import { Scene, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import type { SceneMotion } from "../scene-runtime"
import styles from "./black-hole.css?inline"

export default function BlackHole({ home }: SceneProps) {
  const svg = useRef<SVGSVGElement>(null)
  const motion = useRef<SceneMotion>(null)
  const [swallowed, setSwallowed] = useState(false)
  const [message, setMessage] = useState("")
  useSceneMotion(svg, (tools) => {
    motion.current = tools
  })

  function toggle() {
    setSwallowed(!swallowed)
    if (!swallowed) motion.current?.emit(200, 128, 22)
    setMessage(swallowed ? "把数字捞回来了" : "连 404，也被吸进去了")
  }

  return (
    <Scene name="black-hole" title="页面掉进黑洞" styles={styles}>
      <div className="nf-black-hole-stage">
        <button
          type="button"
          className={`nf-art nf-play nf-reference-play${swallowed ? " nf-swallowed" : ""}`}
          aria-label="点击让黑洞吸走数字，再点击捞回来"
          aria-pressed={swallowed}
          onClick={toggle}
        >
          <svg ref={svg} className="nf-reference-art" aria-hidden="true" viewBox="0 0 400 245">
            <g className="nf-hole-disc">
              <ellipse className="nf-line nf-border-stroke" cx="200" cy="128" rx="132" ry="44" transform="rotate(-22 200 128)" />
              <ellipse className="nf-line nf-accent-stroke" cx="200" cy="128" rx="111" ry="29" transform="rotate(-22 200 128)" opacity=".6" />
              <circle className="nf-soft" cx="200" cy="128" r="61" />
              <circle fill="var(--nf-void)" cx="200" cy="128" r="41" />
              <circle fill="none" className="nf-accent-stroke" cx="200" cy="128" r="48" strokeWidth="3" strokeDasharray="180 125" transform="rotate(-40 200 128)" />
            </g>
            <g className="nf-hole-orbit">
              <g className="nf-hole-numbers nf-fill-accent" fontSize="74" fontWeight="600">
                <text x="45" y="126" transform="rotate(-18 72 100)">
                  4
                </text>
                <text x="190" y="49" fontSize="42" transform="rotate(22 204 32)">
                  0
                </text>
                <text x="301" y="195" transform="rotate(18 320 180)">
                  4
                </text>
              </g>
            </g>
            <g className="nf-muted">
              <circle cx="68" cy="41" r="2" />
              <circle cx="330" cy="53" r="2" />
              <circle cx="98" cy="204" r="1.5" />
              <path d="M326 100h10m-5-5v10" stroke="var(--muted)" />
            </g>
          </svg>
        </button>
        <p role="status" className="nf-black-hole-status">
          {message}
        </p>
      </div>
      <a className="nf-black-hole-exit" href={home} data-nf-home>
        ↗ 脱离引力
      </a>
    </Scene>
  )
}
