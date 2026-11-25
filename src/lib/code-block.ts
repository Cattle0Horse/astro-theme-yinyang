export const codeFoldThreshold = 15

export function startCodeFolds() {
  const installed = Symbol.for("yinyang.code-folds")
  if (Reflect.get(document, installed)) return
  Reflect.set(document, installed, true)

  function apply(pre: Element, collapsed: boolean) {
    const button = pre.parentElement?.querySelector<HTMLButtonElement>("[data-code-fold] > button")
    if (!button) return
    pre.toggleAttribute("data-collapsed", collapsed)
    button.setAttribute("aria-expanded", String(!collapsed))
    button.setAttribute("aria-label", collapsed ? "展开代码" : "折叠代码")
    const label = button.querySelector("span")
    if (label) label.textContent = collapsed ? "展开全部 (" + button.dataset.codeLines + " 行)" : "收起代码"
  }

  function restore() {
    const open = history.state?.yinyangExpandedCode
    if (!open || typeof open !== "object") return
    document.querySelectorAll(".reading[id]").forEach((article) => {
      const indexes = open[article.id]
      if (!Array.isArray(indexes)) return
      article.querySelectorAll("[data-code-index]").forEach((pre) => {
        if (indexes.includes(Number(pre.getAttribute("data-code-index")))) apply(pre, false)
      })
    })
  }

  document.addEventListener("astro:after-swap", restore)
  document.addEventListener("yinyang:reading", restore)
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-code-fold] > button") : null
    const article = button?.closest(".reading")
    const pre = button?.closest("[data-code-block]")?.querySelector(":scope > pre")
    if (!article || !pre) return
    const index = Number(pre.getAttribute("data-code-index"))
    const collapsed = !pre.hasAttribute("data-collapsed")
    const open = history.state?.yinyangExpandedCode
    const indexes: number[] = Array.isArray(open?.[article.id]) ? open[article.id] : []
    const next = indexes.filter((value) => value !== index)
    if (!collapsed) next.push(index)
    history.replaceState({ ...history.state, yinyangExpandedCode: { ...open, [article.id]: next } }, "")
    const height = pre.getBoundingClientRect().height
    pre
      .getAnimations()
      .filter((animation) => animation.id === "code-motion")
      .forEach((animation) => animation.cancel())
    apply(pre, collapsed)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const nextHeight = pre.getBoundingClientRect().height
    if (height === nextHeight) return
    const animation = pre.animate({ height: [height + "px", nextHeight + "px"], maxHeight: [height + "px", nextHeight + "px"] }, { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" })
    animation.id = "code-motion"
    pre.setAttribute("data-code-motion", "")
    const clean = () => {
      if (!pre.getAnimations().some((other) => other.id === "code-motion" && other.playState === "running")) pre.removeAttribute("data-code-motion")
    }
    void animation.finished.then(clean, clean)
  })
}
