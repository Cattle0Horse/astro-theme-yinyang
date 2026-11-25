export const scenes = {
  sleep: { mobile: true, load: () => import("./scenes/sleep") },
  "black-hole": { mobile: true, load: () => import("./scenes/black-hole") },
  flashlight: { mobile: false, load: () => import("./scenes/flashlight") },
  receipt: { mobile: true, load: () => import("./scenes/receipt") },
  constellation: { mobile: false, load: () => import("./scenes/constellation") },
  puzzle: { mobile: true, load: () => import("./scenes/puzzle") },
  terminal: { mobile: false, articles: true, load: () => import("./scenes/terminal") },
  channel: { mobile: true, articles: true, load: () => import("./scenes/channel") },
  cat: { mobile: true, load: () => import("./scenes/cat") },
  "draw-home": { mobile: true, load: () => import("./scenes/draw-home") }
}

export type SceneName = keyof typeof scenes

function isSceneName(name: unknown): name is SceneName {
  return typeof name === "string" && Object.hasOwn(scenes, name)
}

export function selectScene(enabled: readonly string[], mobile: boolean, requested: string | null, random = Math.random) {
  const configured = [...new Set(enabled.map((name) => name.toLowerCase()).filter(isSceneName))]
  const candidates = (configured.length ? configured : Object.keys(scenes).filter(isSceneName)).filter((name) => !mobile || scenes[name].mobile)
  if (requested !== null) return isSceneName(requested) && candidates.includes(requested) ? requested : undefined
  return candidates[Math.floor(random() * candidates.length)]
}
