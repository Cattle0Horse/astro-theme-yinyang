import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react"
import { scenes, selectScene } from "./catalog"
import type { ArticleLink, SceneProps } from "./Scene"

interface Props {
  home: string
  articles: string
  enabled: readonly string[]
}

interface LoadedScene {
  View: ComponentType<SceneProps>
  articles: ArticleLink[]
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

async function loadArticles(url: string, signal: AbortSignal): Promise<ArticleLink[]> {
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return []
    const entries: unknown = await response.json()
    if (!Array.isArray(entries)) return []
    return entries.filter(
      (entry): entry is ArticleLink => entry && typeof entry.title === "string" && typeof entry.url === "string" && entry.url.startsWith("/") && !entry.url.startsWith("//")
    )
  } catch {
    return []
  }
}

export default function NotFound({ home, articles, enabled }: Props) {
  const [scene, setScene] = useState<LoadedScene>()

  useEffect(() => {
    const name = selectScene(enabled, matchMedia("(max-width: 600px)").matches, new URL(location.href).searchParams.get("scene"))
    if (!name) return
    const controller = new AbortController()
    const leave = () => controller.abort()
    document.addEventListener("astro:before-swap", leave, { once: true, signal: controller.signal })
    const timeout = window.setTimeout(leave, 8000)
    const config = scenes[name]
    void Promise.all([config.load(), "articles" in config ? loadArticles(articles, controller.signal) : []])
      .then(([module, links]) => {
        if (!controller.signal.aborted) setScene({ View: module.default, articles: links })
      })
      .catch(() => {
        controller.abort()
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [articles, enabled])

  if (!scene) return null
  return (
    <SceneBoundary>
      <scene.View home={home} articles={scene.articles} />
    </SceneBoundary>
  )
}
