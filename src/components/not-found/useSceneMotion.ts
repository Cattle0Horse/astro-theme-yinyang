import { useEffectEvent, useLayoutEffect, type RefObject } from "react"
import { createSceneMotion, type SceneMotion } from "./scene-runtime"

export function useSceneMotion(svg: RefObject<SVGSVGElement | null>, setup: (motion: SceneMotion) => void) {
  const initialize = useEffectEvent(setup)
  useLayoutEffect(() => {
    if (!svg.current) return
    const motion = createSceneMotion(svg.current)
    try {
      initialize(motion)
    } catch (error) {
      motion.dispose()
      throw error
    }
    document.addEventListener("astro:before-swap", motion.dispose, { once: true })
    return () => {
      document.removeEventListener("astro:before-swap", motion.dispose)
      motion.dispose()
    }
  }, [svg])
}
