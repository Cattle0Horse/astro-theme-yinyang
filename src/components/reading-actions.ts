import { animateCodeHeight } from "../lib/code-block"
import { copyStatus, createCopyFeedback } from "../lib/copy-state"

export function mountReadingActions(article: HTMLElement) {
  const controller = new AbortController()
  const { signal } = controller
  const copyButtons = new Map<HTMLButtonElement, ReturnType<typeof createCopyFeedback>>()
  let openTable: Element | null = null

  function copy(button: HTMLButtonElement, text: string) {
    let feedback = copyButtons.get(button)
    if (!feedback) {
      const message = button.parentElement?.querySelector('[role="status"]')
      feedback = createCopyFeedback((state) => {
        const status = state ? copyStatus[state] : ""
        if (state) button.dataset.copyState = state
        else delete button.dataset.copyState
        button.dataset.tooltip = status || button.getAttribute("aria-label") || ""
        if (message) message.textContent = status
      })
      copyButtons.set(button, feedback)
    }
    void feedback.copy(() => navigator.clipboard.writeText(text))
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
        if (text !== undefined && text !== null) copy(button, text)
        return
      }
      if (!pre) return
      if (action === "lines") {
        const enabled = pre.toggleAttribute("data-line-numbers")
        button.setAttribute("aria-pressed", String(enabled))
        button.setAttribute("aria-label", enabled ? "隐藏行号" : "显示行号")
      } else if (action === "wrap") {
        animateCodeHeight(
          pre,
          () => {
            const enabled = pre.toggleAttribute("data-wrap")
            if (enabled) pre.scrollLeft = 0
            button.setAttribute("aria-pressed", String(enabled))
            button.setAttribute("aria-label", enabled ? "关闭自动换行" : "开启自动换行")
          },
          220
        )
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
    copyButtons.forEach((feedback) => feedback.reset())
    article.querySelectorAll("[data-code-motion]").forEach((pre) => {
      pre
        .getAnimations()
        .filter((animation) => animation.id === "code-motion")
        .forEach((animation) => animation.cancel())
    })
  }
}
