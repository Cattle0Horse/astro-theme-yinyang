import type { SidenoteOutline } from "./annotation-outline"

export function enhanceSidenotes(article: HTMLElement) {
  if (article.hasAttribute("data-enhanced")) return
  const notes = [...article.querySelectorAll<HTMLDetailsElement>("details[data-sidenote]")]
  if (!notes.length) return
  const segments = [...article.querySelectorAll<HTMLElement>("[data-sidenote-refs]")]
  const wide = matchMedia("(min-width: 84rem)")
  const idsFor = (segment?: HTMLElement) => segment?.dataset.sidenoteRefs?.split(" ") ?? []
  const controls = segments.filter((segment) => !segment.closest("a, button, summary"))
  const mapped = new Set(controls.flatMap(idsFor))
  const panel = document.createElement("aside")
  panel.dataset.sidenotePanel = ""
  panel.setAttribute("aria-label", "旁注")
  panel.hidden = true
  article.append(panel)
  article.dataset.enhanced = ""
  let selection = notes.flatMap((note) => (note.open && note.dataset.sidenote ? [note.dataset.sidenote] : []))
  let anchor = controls.find((control) => idsFor(control).some((id) => selection.includes(id)))
  let hovered: HTMLElement | undefined
  let focused: HTMLElement | undefined
  let frame = 0
  let room = 0
  const moved: { note: HTMLDetailsElement; body: HTMLElement }[] = []
  const rail = new Map<string, { section: HTMLElement; source: HTMLElement | undefined }>()

  function outline(kind: SidenoteOutline["kind"], targets: HTMLElement[]) {
    article.dispatchEvent(new CustomEvent<SidenoteOutline>("sidenote:outline", { bubbles: true, detail: { kind, targets } }))
  }

  const restore = () => {
    for (const { note, body } of moved.splice(0)) note.append(...body.childNodes)
    rail.clear()
    panel.replaceChildren()
    panel.hidden = true
    article.style.removeProperty("padding-bottom")
    room = 0
  }

  const highlight = () => {
    const active = new Set([...selection, ...idsFor(hovered), ...idsFor(focused)])
    for (const segment of segments) {
      segment.toggleAttribute(
        "data-selected",
        idsFor(segment).some((id) => active.has(id))
      )
    }
    for (const [id, { section }] of rail) section.toggleAttribute("data-selected", active.has(id))
    for (const control of controls) {
      const expanded = wide.matches ? control === anchor : idsFor(control).some((id) => selection.includes(id))
      control.setAttribute(wide.matches ? "aria-pressed" : "aria-expanded", String(expanded))
    }
  }

  const layout = () => {
    frame = 0
    if (panel.hidden) return
    const origin = article.getBoundingClientRect().top
    let end = 0
    for (const { section, source } of rail.values()) {
      const reference = source?.getClientRects()[0]
      const top = Math.max(end, reference ? reference.top - origin : 0)
      section.style.top = top + "px"
      end = top + section.offsetHeight + 12
    }
    const height = Math.max(0, Math.ceil(end - 12))
    panel.style.height = height + "px"
    const nextRoom = Math.max(0, height - article.clientHeight + room)
    if (nextRoom !== room) {
      room = nextRoom
      article.style.paddingBottom = room + "px"
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(layout)
  }
  const observer = new ResizeObserver(schedule)

  const paint = () => {
    observer.disconnect()
    restore()
    for (const control of controls) control.removeAttribute(wide.matches ? "aria-expanded" : "aria-pressed")
    for (const note of notes) {
      const id = note.dataset.sidenote ?? ""
      if (wide.matches) {
        const section = document.createElement("section")
        section.dataset.sidenoteCard = id
        const body = document.createElement("div")
        body.append(...Array.from(note.childNodes).filter((node) => !(node instanceof HTMLElement && node.tagName === "SUMMARY")))
        moved.push({ note, body })
        section.append(body)
        panel.append(section)
        rail.set(id, { section, source: segments.find((segment) => idsFor(segment).includes(id)) })
        observer.observe(section)
        note.hidden = true
      } else {
        note.hidden = mapped.has(id) && !selection.includes(id)
        if (mapped.has(id)) note.open = !note.hidden
      }
    }
    panel.hidden = !wide.matches || !notes.length
    if (!panel.hidden) {
      observer.observe(article)
      layout()
    }
    highlight()
  }

  const selectNotes = (source: HTMLElement) => {
    const selected = !wide.matches && anchor === source && idsFor(source).every((id) => selection.includes(id))
    anchor = selected ? undefined : source
    selection = idsFor(anchor)
    if (wide.matches) {
      highlight()
      outline(
        "blocks",
        selection.flatMap((id) => rail.get(id)?.section ?? [])
      )
      return
    }
    for (const note of notes) {
      const id = note.dataset.sidenote ?? ""
      note.hidden = !selection.includes(id)
      note.open = selection.includes(id)
    }
    highlight()
    outline(
      "blocks",
      notes.filter((note) => selection.includes(note.dataset.sidenote ?? ""))
    )
  }
  const revealNote = (event: Event) => {
    const note = event.target
    if (wide.matches || !(note instanceof HTMLDetailsElement) || !notes.includes(note) || !note.dataset.sidenote) return
    const id = note.dataset.sidenote
    if (selection.includes(id)) return
    selection = [...selection, id]
    anchor = controls.find((control) => idsFor(control).includes(id))
    paint()
  }
  const controlFor = (target: EventTarget | null) => (target instanceof Element ? (target.closest<HTMLElement>("[data-sidenote-refs]") ?? undefined) : undefined)

  controls.forEach((control) => {
    control.tabIndex = 0
    control.setAttribute("role", "button")
  })
  const returnButtons = notes.map((note) => {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.sidenoteReturn = note.dataset.sidenote ?? ""
    button.textContent = "返回原文"
    button.setAttribute("aria-label", "返回旁注 " + note.dataset.sidenote + " 的原文")
    note.append(button)
    return button
  })
  const click = (event: MouseEvent) => {
    const target = event.target
    if (event.defaultPrevented || !(target instanceof Element) || getSelection()?.toString()) return
    const button = target.closest<HTMLElement>("[data-sidenote-return]")
    if (!button && target.closest("a, button, summary, input, select, textarea, label")) return
    const card = target.closest<HTMLElement>("[data-sidenote-card], details[data-sidenote]")
    const noteId = button?.dataset.sidenoteReturn ?? card?.dataset.sidenoteCard ?? card?.dataset.sidenote
    if (noteId) {
      const matching = segments.filter((segment) => idsFor(segment).includes(noteId))
      if (button && !event.detail) controls.find((control) => idsFor(control).includes(noteId))?.focus({ preventScroll: true })
      outline("text", matching)
      return
    }
    const segment = controlFor(target)
    if (segment) selectNotes(segment)
  }

  const toggle = (event: Event) => {
    const note = event.target
    if (wide.matches || !(note instanceof HTMLDetailsElement) || !note.hasAttribute("data-sidenote")) return
    if (selection.includes(note.dataset.sidenote ?? "") && !note.open) {
      selection = selection.filter((id) => id !== note.dataset.sidenote)
      if (anchor && !idsFor(anchor).some((id) => selection.includes(id))) anchor = undefined
      paint()
      outline("blocks", [])
    }
  }

  const key = (event: KeyboardEvent) => {
    const control = controlFor(event.target)
    if (control && controls.includes(control) && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      selectNotes(control)
    }
  }
  const track = (event: PointerEvent | FocusEvent) => {
    const control = controlFor(event.type.endsWith("out") ? event.relatedTarget : event.target)
    if (event.type.startsWith("focus")) focused = control
    else hovered = control
    highlight()
  }

  const readingPosition = window.scrollY
  paint()
  // Replacing the native disclosures can trigger scroll anchoring after Astro restores history.
  if (window.scrollY !== readingPosition) window.scrollTo({ top: readingPosition, behavior: "instant" })
  wide.addEventListener("change", paint)
  window.addEventListener("resize", schedule)
  article.addEventListener("load", schedule, true)
  article.addEventListener("keydown", key)
  article.addEventListener("click", click)
  article.addEventListener("toggle", toggle, true)
  article.addEventListener("sidenote:reveal", revealNote)
  for (const event of ["pointerover", "pointerout", "focusin", "focusout"] as const) article.addEventListener(event, track)
  const dispose = () => {
    if (article.isConnected) return
    document.removeEventListener("astro:after-swap", dispose)
    observer.disconnect()
    if (frame) cancelAnimationFrame(frame)
    restore()
    panel.remove()
    wide.removeEventListener("change", paint)
    window.removeEventListener("resize", schedule)
    article.removeEventListener("load", schedule, true)
    article.removeEventListener("keydown", key)
    article.removeEventListener("click", click)
    article.removeEventListener("toggle", toggle, true)
    article.removeEventListener("sidenote:reveal", revealNote)
    for (const event of ["pointerover", "pointerout", "focusin", "focusout"] as const) article.removeEventListener(event, track)
    for (const control of controls) {
      control.removeAttribute("tabindex")
      control.removeAttribute("role")
      control.removeAttribute("aria-pressed")
      control.removeAttribute("aria-expanded")
    }
    for (const note of notes) note.hidden = false
    for (const button of returnButtons) button.remove()
    delete article.dataset.enhanced
  }
  document.addEventListener("astro:after-swap", dispose)
}
