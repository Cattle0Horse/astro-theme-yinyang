export const codeFoldThreshold = 15

export function animateCodeHeight(pre: HTMLElement, update: () => void, duration: number) {
  const height = pre.getBoundingClientRect().height
  const fold = pre.parentElement?.querySelector<HTMLElement>(":scope > [data-code-fold]")
  const foldMargin = fold ? getComputedStyle(fold).marginBlockStart : undefined
  for (const element of [pre, fold]) {
    for (const animation of element?.getAnimations() ?? []) {
      if (animation.id === "code-motion") animation.cancel()
    }
  }
  update()
  const nextHeight = pre.getBoundingClientRect().height
  const nextFoldMargin = fold ? getComputedStyle(fold).marginBlockStart : undefined
  if (height === nextHeight) return
  const heights = [height + "px", nextHeight + "px"]
  const timing = { duration, easing: "cubic-bezier(.42,0,.58,1)" }
  const animation = pre.animate({ height: heights, maxHeight: heights }, timing)
  animation.id = "code-motion"
  if (fold && foldMargin && nextFoldMargin && foldMargin !== nextFoldMargin) {
    fold.animate({ marginBlockStart: [foldMargin, nextFoldMargin] }, timing).id = "code-motion"
  }
  pre.setAttribute("data-code-motion", "")
  const clean = () => {
    if (!pre.getAnimations().some((other) => other.id === "code-motion" && other.playState === "running")) pre.removeAttribute("data-code-motion")
  }
  void animation.finished.then(clean, clean)
}

export function mountCodeFolds(article: HTMLElement) {
  const controller = new AbortController()

  function apply(pre: Element, collapsed: boolean) {
    const button = pre.parentElement?.querySelector<HTMLButtonElement>("[data-code-fold] > button")
    if (!button) return
    pre.toggleAttribute("data-collapsed", collapsed)
    button.setAttribute("aria-expanded", String(!collapsed))
    button.setAttribute("aria-label", collapsed ? "展开代码" : "折叠代码")
    const label = button.querySelector("span")
    if (label) label.textContent = collapsed ? "展开全部 (" + button.dataset.codeLines + " 行)" : "收起代码"
  }

  const saved = history.state?.yinyangExpandedCode?.[article.id]
  if (Array.isArray(saved)) {
    article.querySelectorAll("[data-code-index]").forEach((pre) => {
      if (saved.includes(Number(pre.getAttribute("data-code-index")))) apply(pre, false)
    })
  }

  article.addEventListener(
    "click",
    (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-code-fold] > button") : null
      const pre = button?.closest("[data-code-block]")?.querySelector<HTMLPreElement>(":scope > pre")
      if (!pre) return
      const index = Number(pre.getAttribute("data-code-index"))
      const collapsed = !pre.hasAttribute("data-collapsed")
      const open = history.state?.yinyangExpandedCode
      const indexes: number[] = Array.isArray(open?.[article.id]) ? open[article.id] : []
      const next = indexes.filter((value) => value !== index)
      if (!collapsed) next.push(index)
      history.replaceState({ ...history.state, yinyangExpandedCode: { ...open, [article.id]: next } }, "")
      animateCodeHeight(pre, () => apply(pre, collapsed), 360)
    },
    { signal: controller.signal }
  )
  return () => controller.abort()
}
