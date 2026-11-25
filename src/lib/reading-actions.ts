export function mountReadingActions(article: HTMLElement) {
  const controller = new AbortController()
  const { signal } = controller
  const pending = new WeakMap<HTMLButtonElement, number>()
  const timers = new Map<HTMLButtonElement, number>()
  let openTable: Element | null = null

  async function copy(button: HTMLButtonElement, text: string) {
    const operation = (pending.get(button) ?? 0) + 1
    pending.set(button, operation)
    window.clearTimeout(timers.get(button))
    let status: string
    try {
      await navigator.clipboard.writeText(text)
      status = "已复制"
    } catch {
      status = "复制失败"
    }
    if (signal.aborted || pending.get(button) !== operation) return
    const message = button.parentElement?.querySelector('[role="status"]')
    button.dataset.tooltip = status
    button.toggleAttribute("data-copy-done", status === "已复制")
    if (message) message.textContent = status
    timers.set(
      button,
      window.setTimeout(() => {
        timers.delete(button)
        button.dataset.tooltip = button.getAttribute("aria-label") ?? ""
        button.removeAttribute("data-copy-done")
        if (message) message.textContent = ""
      }, 1800)
    )
  }

  article.addEventListener(
    "click",
    (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-reading-action]") : null
      if (!button) return
      const pre = button.closest("[data-code-block]")?.querySelector<HTMLPreElement>(":scope > pre")
      const action = button.dataset.readingAction
      if (action === "copy") {
        const text = pre?.textContent ?? button.closest("table")?.dataset.tableMarkdown ?? button.closest("[data-math-block]")?.getAttribute("data-math-source")
        if (text !== undefined && text !== null) void copy(button, text)
        return
      }
      if (!pre) return
      if (action === "lines") {
        const enabled = pre.toggleAttribute("data-line-numbers")
        button.setAttribute("aria-pressed", String(enabled))
        button.setAttribute("aria-label", enabled ? "隐藏行号" : "显示行号")
      } else if (action === "wrap") {
        const height = pre.getBoundingClientRect().height
        pre
          .getAnimations()
          .filter((animation) => animation.id === "code-motion")
          .forEach((animation) => animation.cancel())
        const enabled = pre.toggleAttribute("data-wrap")
        if (enabled) pre.scrollLeft = 0
        button.setAttribute("aria-pressed", String(enabled))
        button.setAttribute("aria-label", enabled ? "关闭自动换行" : "开启自动换行")
        const next = pre.getBoundingClientRect().height
        if (height !== next && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const animation = pre.animate({ height: [height + "px", next + "px"], maxHeight: [height + "px", next + "px"] }, { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" })
          animation.id = "code-motion"
          pre.setAttribute("data-code-motion", "")
          const clean = () => {
            if (!pre.getAnimations().some((other) => other.id === "code-motion" && other.playState === "running")) pre.removeAttribute("data-code-motion")
          }
          void animation.finished.then(clean, clean)
        }
      }
      button.dataset.tooltip = button.getAttribute("aria-label") ?? ""
    },
    { signal }
  )

  if (article.querySelector(".table-actions")) {
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse") return
        const table = event.target instanceof Element ? event.target.closest(".table-scroll") : null
        if (openTable === table) return
        openTable?.removeAttribute("data-actions-open")
        openTable = table && article.contains(table) ? table : null
        openTable?.setAttribute("data-actions-open", "")
      },
      { signal }
    )
  }

  return () => {
    controller.abort()
    openTable?.removeAttribute("data-actions-open")
    timers.forEach((timer) => window.clearTimeout(timer))
    article.querySelectorAll("[data-code-motion]").forEach((pre) => {
      pre
        .getAnimations()
        .filter((animation) => animation.id === "code-motion")
        .forEach((animation) => animation.cancel())
    })
  }
}
