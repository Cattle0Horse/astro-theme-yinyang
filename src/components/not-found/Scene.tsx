import type { ReactNode } from "react"

export interface ArticleLink {
  title: string
  url: string
}

export interface SceneProps {
  home: string
  articles: ArticleLink[]
}

export function Scene({ name, title, styles, children }: { name: string; title: string; styles: string; children: ReactNode }) {
  return (
    <section className={`nf-scene nf-${name}-scene`} data-nf-scene={name}>
      <style>{styles}</style>
      <h1 className="sr-only">{title}</h1>
      {children}
    </section>
  )
}
