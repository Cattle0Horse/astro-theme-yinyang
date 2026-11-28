export function installReadingFeature(selector: string, mount: (article: HTMLElement) => (() => void) | undefined) {
  const installed = Symbol.for("yinyang.reading:" + selector)
  const existing = Reflect.get(document, installed)
  if (typeof existing === "function") {
    existing()
    return
  }
  const articles = new Map<HTMLElement, (() => void) | undefined>()

  function update() {
    for (const [article, dispose] of articles) {
      if (article.isConnected) continue
      dispose?.()
      articles.delete(article)
    }
    for (const article of document.querySelectorAll<HTMLElement>(selector)) {
      if (!articles.has(article)) articles.set(article, mount(article))
    }
  }

  Reflect.set(document, installed, update)
  document.addEventListener("astro:after-swap", update)
  update()
}
