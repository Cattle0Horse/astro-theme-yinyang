export function startImageLoading() {
  const installed = Symbol.for("yinyang.images")
  if (Reflect.get(document, installed)) return
  Reflect.set(document, installed, true)
  const articles = new Map<Element, () => void>()

  function initialize(article: Element) {
    if (articles.has(article)) return
    const cleanup = enhanceImages(article)
    if (cleanup) articles.set(article, cleanup)
  }

  document.addEventListener("yinyang:reading", ({ target }) => {
    if (target instanceof Element && target.hasAttribute("data-has-images")) initialize(target)
  })
  document.addEventListener("astro:after-swap", () => {
    for (const [article, cleanup] of articles) {
      if (article.isConnected) continue
      cleanup()
      articles.delete(article)
    }
    document.querySelectorAll("[data-has-images]").forEach(initialize)
  })

  function enhanceImages(article: Element) {
    const retryTemplate = article.querySelector<HTMLTemplateElement>("[data-image-retry]")?.content.firstElementChild
    if (!(retryTemplate instanceof HTMLButtonElement)) return
    const images = [...article.querySelectorAll<HTMLImageElement>(".loading-image-frame > img, .loading-image-frame > a > img")]
    const cleanup: (() => void)[] = []
    for (const image of images) {
      const frame = image.closest(".loading-image-frame")!
      const original = new URL(image.src, location.href)
      let disposed = false
      const failed = retryTemplate.cloneNode(true) as HTMLButtonElement
      frame.append(failed)
      const showImage = () => {
        frame.classList.remove("is-loading", "is-failed", "is-retrying")
        frame.classList.add("is-loaded")
        failed.hidden = true
      }
      const complete = async () => {
        const src = image.currentSrc
        await image.decode().catch(() => undefined)
        if (!disposed && image.currentSrc === src && image.naturalWidth) showImage()
      }
      const error = () => {
        frame.classList.remove("is-loading", "is-loaded", "is-retrying")
        frame.classList.add("is-failed")
        failed.hidden = false
      }
      const retry = (event: MouseEvent) => {
        event.preventDefault()
        if (!/^https?:$/u.test(original.protocol)) return
        const url = new URL(image.currentSrc || original.href)
        url.searchParams.set("retry", String(Date.now()))
        frame.classList.remove("is-failed")
        frame.classList.add("is-loading", "is-retrying")
        failed.hidden = true
        image.removeAttribute("srcset")
        image.loading = "eager"
        image.src = url.href
      }
      image.addEventListener("load", complete)
      image.addEventListener("error", error)
      failed.addEventListener("click", retry)
      cleanup.push(() => {
        disposed = true
        image.removeEventListener("load", complete)
        image.removeEventListener("error", error)
        failed.removeEventListener("click", retry)
        failed.remove()
      })
      if (image.complete) {
        if (image.naturalWidth) showImage()
        else error()
      }
    }
    return () => {
      cleanup.forEach((dispose) => dispose())
    }
  }
}
