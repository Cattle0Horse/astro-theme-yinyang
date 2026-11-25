export type ColorMode = "system" | "light" | "dark"

export type FontSize = 14 | 15 | 16 | 17 | 18

export interface Appearance {
  mode: ColorMode
  palette: string
  size: FontSize
}

export interface AppearanceStore {
  read: () => Appearance
  subscribe: (listener: () => void) => () => void
  update: (change: Partial<Appearance>) => void
}

declare global {
  interface Window {
    yinyangAppearance?: AppearanceStore
  }
}

interface SwapEvent extends Event {
  newDocument: Document
}

export function startAppearance(palettes: readonly string[], initial: Appearance) {
  if (window.yinyangAppearance) return
  const key = "yinyang:appearance"
  const media = matchMedia("(prefers-color-scheme: dark)")
  const listeners = new Set<() => void>()
  const modes = ["system", "light", "dark"]
  const sizes = [14, 15, 16, 17, 18]
  const stored = () => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
      if (value && typeof value === "object") return value as Partial<Appearance>
      return { mode: localStorage.getItem("theme") as ColorMode | undefined, palette: localStorage.getItem("palette") ?? undefined }
    } catch {
      return {}
    }
  }
  const normalize = (value: Partial<Appearance>): Appearance => ({
    mode: value.mode && modes.includes(value.mode) ? value.mode : initial.mode,
    palette: value.palette && palettes.includes(value.palette) ? value.palette : initial.palette,
    size: value.size && sizes.includes(value.size) ? value.size : initial.size
  })
  let current = normalize(stored())
  const apply = (root: HTMLElement) => {
    root.dataset.js = ""
    root.dataset.themeMode = current.mode
    root.dataset.theme = current.mode === "system" ? (media.matches ? "dark" : "light") : current.mode
    root.dataset.palette = current.palette
    root.dataset.fontSize = String(current.size)
  }
  window.yinyangAppearance = {
    read: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update: (change) => {
      current = normalize({ ...current, ...change })
      apply(document.documentElement)
      try {
        localStorage.setItem(key, JSON.stringify(current))
      } catch {
        /* The live preference remains usable. */
      }
      listeners.forEach((listener) => listener())
    }
  }
  media.addEventListener("change", () => apply(document.documentElement))
  document.addEventListener("astro:before-swap", (event) => apply((event as SwapEvent).newDocument.documentElement))
  apply(document.documentElement)
}
