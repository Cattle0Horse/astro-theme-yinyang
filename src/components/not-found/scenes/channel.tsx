import { useRef, useState } from "react"
import { Scene, type SceneProps } from "../Scene"
import { useSceneMotion } from "../useSceneMotion"
import styles from "./channel.css?inline"

export default function Channel({ home, articles }: SceneProps) {
  const svg = useRef<SVGSVGElement>(null)
  const dial = useRef<SVGGElement>(null)
  const [frequency, setFrequency] = useState(96)
  const homeFrequency = frequency >= 107.4
  const index = Math.round((frequency - 90) / 4)
  const station = !homeFrequency && index >= 0 && index < 5 && Math.abs(frequency - (90 + index * 4)) <= 0.6 ? articles[index] : undefined
  const message = homeFrequency ? "到家频道，随时欢迎回来" : station ? "信号清晰，有一个故事在等你" : articles.length ? "沙沙……再往旁边调一点" : "电台还没有故事，先回家看看吧"

  useSceneMotion(svg, (tools) => {
    if (!dial.current) return
    tools.drag(
      dial.current,
      () => {},
      ({ x, y }) => {
        const angle = (Math.atan2(x - 453, 226 - y) * 180) / Math.PI
        setFrequency(Math.round(Math.max(88, Math.min(108, 98 + angle / 14)) * 10) / 10)
      },
      () => {}
    )
  })

  return (
    <Scene name="channel" title="调到另一个频道" styles={styles}>
      <div className={`nf-art nf-radio-field${!station && !homeFrequency ? " nf-noise" : ""}`}>
        <div className="nf-channel-display">
          <svg ref={svg} viewBox="0 0 640 360" aria-hidden="true">
            <path d="m198 102 68-63" className="nf-line" />
            <rect x="126" y="103" width="388" height="203" rx="18" className="nf-paper nf-line" />
            <rect x="151" y="130" width="238" height="52" rx="5" className="nf-soft" />
            <text x="269" y="163" className="nf-small nf-muted">
              88　 92　 96　 100　 108
            </text>
            <path d="M270 135v39" className="nf-line nf-accent nf-tuner-needle" style={{ transform: `translateX(${(frequency - 98) * 10}px)` }} />
            <g className="nf-line nf-muted">
              <path d="M155 208h230m-230 12h230m-230 12h230m-230 12h230m-230 12h230m-230 12h230" />
            </g>
            <g ref={dial} className="nf-knob" style={{ transform: `rotate(${(frequency - 98) * 14}deg)` }}>
              <circle cx="453" cy="226" r="33" className="nf-paper nf-line" />
              <path d="M453 226v-22" className="nf-line nf-accent" />
            </g>
            <text x="453" y="285" className="nf-small nf-muted">
              FM 404
            </text>
          </svg>
          <p role="status" className="nf-channel-status">
            {message}
          </p>
        </div>
        <label className="nf-tuner-label">
          <span className="nf-frequency">{frequency.toFixed(1)} MHz</span>
          <input type="range" min={88} max={108} step={0.1} value={frequency} onChange={(event) => setFrequency(event.currentTarget.valueAsNumber)} aria-label="调节频道频率" />
        </label>
        <div className="nf-station-slot">
          {station && (
            <a className="nf-station" href={station.url}>
              ♫ {station.title} ↗
            </a>
          )}
        </div>
        <a className={`nf-channel-home${homeFrequency ? " nf-channel-tuned-home" : ""}`} href={home} data-nf-home>
          ⌂ HOME <span>108.0 MHz</span>
        </a>
      </div>
    </Scene>
  )
}
