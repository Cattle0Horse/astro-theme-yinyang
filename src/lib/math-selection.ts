const formulaSelector = ".reading .katex-html"
let selected = new Set<Element>()

document.addEventListener("selectionchange", () => {
  const selection = document.getSelection()
  const next = new Set<Element>()
  if (selection && !selection.isCollapsed) {
    for (let index = 0; index < selection.rangeCount; index++) {
      const range = selection.getRangeAt(index)
      const node = range.commonAncestorContainer
      const ancestor = node instanceof Element ? node : (node.parentElement ?? document.documentElement)
      const formula = ancestor.closest(formulaSelector)
      if (formula) next.add(formula)
      else {
        for (const candidate of ancestor.querySelectorAll(formulaSelector)) {
          if (range.intersectsNode(candidate)) next.add(candidate)
        }
      }
    }
  }
  for (const formula of selected) {
    if (!next.has(formula)) formula.removeAttribute("data-math-selected")
  }
  for (const formula of next) {
    if (!selected.has(formula)) formula.setAttribute("data-math-selected", "")
  }
  selected = next
})

document.addEventListener("astro:before-swap", () => {
  for (const formula of selected) formula.removeAttribute("data-math-selected")
  selected.clear()
})
