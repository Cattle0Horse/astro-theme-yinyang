import type { SidenoteOutline } from "./annotation-outline"

export interface SidenoteReveal {
  reference: HTMLElement
  position?: number
  open?: () => void
}

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
  const dialog = document.createElement("dialog")
  dialog.dataset.sidenoteDialog = ""
  dialog.id = article.id + "-sidenote-dialog"
  const header = document.createElement("div")
  header.className = "sidenote-dialog-header"
  const title = document.createElement("h2")
  title.id = dialog.id + "-title"
  dialog.setAttribute("aria-labelledby", title.id)
  const dismiss = document.createElement("button")
  dismiss.type = "button"
  dismiss.textContent = "×"
  dismiss.setAttribute("aria-label", "关闭旁注")
  header.append(title, dismiss)
  const dialogBody = document.createElement("div")
  dialogBody.className = "sidenote-dialog-body"
  dialogBody.tabIndex = 0
  dialog.append(header, dialogBody)
  article.append(dialog)
  const modalAvailable = typeof dialog.showModal === "function"
  const useModal = () => modalAvailable && !wide.matches
  const suspended = new WeakMap<HTMLElement, { source: HTMLElement | undefined; position: number; bodyTop: number }>()
  let displayed: HTMLDetailsElement | undefined
  article.dataset.enhanced = ""
  let selection = notes.flatMap((note) => (note.open && note.dataset.sidenote ? [note.dataset.sidenote] : []))
  let anchor = controls.find((control) => idsFor(control).some((id) => selection.includes(id)))
  let hovered: HTMLElement | undefined
  let focused: HTMLElement | undefined
  let frame = 0
  let room = 0
  const moved: { note: HTMLDetailsElement; body: HTMLElement }[] = []
  const rail = new Map<string, { section: HTMLElement; source: HTMLElement | undefined }>()
  const cards = "[data-sidenote-card], details[data-sidenote][open]"

  function outline(kind: SidenoteOutline["kind"], targets: HTMLElement[], source?: HTMLElement) {
    article.dispatchEvent(new CustomEvent<SidenoteOutline>("sidenote:outline", { bubbles: true, detail: { kind, targets, source } }))
  }

  function locateOriginal(card: HTMLElement, focus: boolean) {
    const id = card.dataset.sidenoteCard ?? card.dataset.sidenote
    if (!id) return
    if (focus) controls.find((control) => idsFor(control).includes(id))?.focus({ preventScroll: true })
    outline(
      "text",
      segments.filter((segment) => idsFor(segment).includes(id)),
      card
    )
  }

  let dismissal: Promise<unknown> | undefined

  function closeNote(restoreFocus: boolean) {
    if (!displayed) return
    dismissal = undefined
    dialog.close()
    dialog.removeAttribute("data-closing")
    displayed.append(...dialogBody.childNodes)
    displayed = undefined
    if (restoreFocus) {
      anchor?.focus({ preventScroll: true })
      selection = []
      anchor = undefined
      highlight()
      outline("blocks", [])
    }
  }

  function dismissNote() {
    if (!displayed || dismissal) return
    dialog.setAttribute("data-closing", "")
    const motion = dialog.getAnimations().filter((animation) => animation instanceof CSSTransition && animation.transitionProperty === "opacity")
    if (!motion.length) {
      closeNote(true)
      return
    }
    const finished = Promise.allSettled(motion.map((animation) => animation.finished))
    dismissal = finished
    void finished.then(() => {
      if (dismissal === finished) closeNote(true)
    })
  }

  function openNote(note: HTMLDetailsElement, source: HTMLElement | undefined) {
    closeNote(false)
    displayed = note
    anchor = source
    selection = [note.dataset.sidenote ?? ""]
    title.textContent = note.querySelector("summary")?.textContent?.trim() || "旁注"
    dialogBody.append(...Array.from(note.childNodes).filter((node) => !(node instanceof HTMLElement && node.tagName === "SUMMARY")))
    dialog.showModal()
    dialogBody.scrollTop = 0
    dialogBody.focus({ preventScroll: true })
    highlight()
  }

  function fragmentTarget(hash: string) {
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)))
    } catch {
      return null
    }
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
      const expanded = wide.matches || useModal() ? control === anchor : idsFor(control).some((id) => selection.includes(id))
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
    const wasOpen = Boolean(displayed)
    closeNote(false)
    restore()
    for (const control of controls) {
      control.removeAttribute(wide.matches ? "aria-expanded" : "aria-pressed")
      if (useModal()) {
        control.setAttribute("aria-haspopup", "dialog")
        control.setAttribute("aria-controls", dialog.id)
      } else {
        control.removeAttribute("aria-haspopup")
        control.removeAttribute("aria-controls")
      }
    }
    for (const note of notes) {
      const id = note.dataset.sidenote ?? ""
      if (wide.matches) {
        const section = document.createElement("section")
        section.dataset.sidenoteCard = id
        section.tabIndex = 0
        section.setAttribute("aria-label", "旁注 " + id)
        section.setAttribute("aria-keyshortcuts", "Enter Space")
        const body = document.createElement("div")
        body.append(...Array.from(note.childNodes).filter((node) => !(node instanceof HTMLElement && node.tagName === "SUMMARY")))
        moved.push({ note, body })
        section.append(body)
        panel.append(section)
        rail.set(id, { section, source: segments.find((segment) => idsFor(segment).includes(id)) })
        observer.observe(section)
        note.hidden = true
      } else {
        note.hidden = mapped.has(id) && (useModal() || !selection.includes(id))
        if (mapped.has(id)) note.open = !note.hidden
        note.tabIndex = note.open ? 0 : -1
      }
    }
    panel.hidden = !wide.matches || !notes.length
    if (!panel.hidden) {
      observer.observe(article)
      layout()
    }
    if (useModal() && !wasOpen && anchor) {
      const first = notes.find((note) => note.dataset.sidenote === idsFor(anchor)[0])
      if (first) openNote(first, anchor)
    }
    highlight()
  }

  const selectNotes = (source: HTMLElement) => {
    if (useModal()) {
      const note = notes.find((candidate) => candidate.dataset.sidenote === idsFor(source)[0])
      if (note) {
        outline("blocks", [])
        openNote(note, source)
      }
      return
    }
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
    if (useModal()) {
      const request = (event as CustomEvent<SidenoteReveal>).detail
      const saved = suspended.get(request.reference)
      const source = saved?.source ?? controls.find((control) => idsFor(control).includes(id))
      request.position = saved?.position
      request.open = () => {
        if (wide.matches || !note.isConnected) return
        openNote(note, source)
        dialogBody.scrollTop = saved?.bodyTop ?? 0
        const viewport = dialogBody.getBoundingClientRect()
        const reference = request.reference.getBoundingClientRect()
        if (reference.top < viewport.top || reference.bottom > viewport.bottom) dialogBody.scrollTop += reference.top - viewport.top - 16
        request.reference.focus({ preventScroll: true })
      }
      return
    }
    if (selection.includes(id)) return
    selection = [...selection, id]
    anchor = controls.find((control) => idsFor(control).includes(id))
    paint()
  }
  const suspendNote = (event: Event) => {
    if (!displayed || !(event.target instanceof HTMLElement) || !dialog.contains(event.target)) return
    suspended.set(event.target, { source: anchor, position: scrollY, bodyTop: dialogBody.scrollTop })
    closeNote(true)
  }
  const controlFor = (target: EventTarget | null) => (target instanceof Element ? (target.closest<HTMLElement>("[data-sidenote-refs]") ?? undefined) : undefined)

  controls.forEach((control) => {
    control.tabIndex = 0
    control.setAttribute("role", "button")
  })
  for (const note of notes) note.setAttribute("aria-keyshortcuts", "Enter Space")
  const click = (event: MouseEvent) => {
    const target = event.target
    if (event.defaultPrevented || !(target instanceof Element) || getSelection()?.toString()) return
    if (target.closest("a, button, summary, input, select, textarea, label")) return
    const card = target.closest<HTMLElement>(cards)
    if (card) {
      locateOriginal(card, false)
      return
    }
    const segment = controlFor(target)
    if (segment) selectNotes(segment)
  }

  const toggle = (event: Event) => {
    const note = event.target
    if (wide.matches || useModal() || !(note instanceof HTMLDetailsElement) || !note.hasAttribute("data-sidenote")) return
    note.tabIndex = note.open ? 0 : -1
    if (selection.includes(note.dataset.sidenote ?? "") && !note.open) {
      selection = selection.filter((id) => id !== note.dataset.sidenote)
      if (anchor && !idsFor(anchor).some((id) => selection.includes(id))) anchor = undefined
      paint()
      outline("blocks", [])
    }
  }

  const key = (event: KeyboardEvent) => {
    if (event.defaultPrevented || (event.key !== "Enter" && event.key !== " ")) return
    const target = event.target
    if (target instanceof HTMLElement && target.matches(cards)) {
      event.preventDefault()
      locateOriginal(target, true)
      return
    }
    const control = controlFor(event.target)
    if (control && controls.includes(control)) {
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

  dismiss.addEventListener("click", dismissNote)
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault()
    dismissNote()
  })
  let outside = false
  dialog.addEventListener("pointerdown", (event) => {
    outside = event.target === dialog && isOutside(event)
  })
  dialog.addEventListener("pointercancel", () => {
    outside = false
  })
  dialog.addEventListener("click", (event) => {
    if (outside && event.target === dialog && isOutside(event)) {
      dismissNote()
    } else if (event.target instanceof Element && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const link = event.target.closest<HTMLAnchorElement>("a[href]")
      if (link && !link.hasAttribute("download") && (!link.target || link.target === "_self")) {
        const url = new URL(link.href)
        const samePage = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search
        if (!samePage || !dialog.contains(fragmentTarget(url.hash))) closeNote(true)
      }
    }
    outside = false
  })
  const closeOnFragmentChange = () => {
    if (dialog.open && !dialog.contains(fragmentTarget(location.hash))) closeNote(true)
  }

  function isOutside(event: MouseEvent) {
    const { left, top, right, bottom } = dialog.getBoundingClientRect()
    return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
  }

  const closeBeforeSwap = () => closeNote(false)
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
  article.addEventListener("sidenote:suspend", suspendNote)
  document.addEventListener("astro:before-swap", closeBeforeSwap)
  window.addEventListener("hashchange", closeOnFragmentChange)
  for (const event of ["pointerover", "pointerout", "focusin", "focusout"] as const) article.addEventListener(event, track)
  const dispose = () => {
    if (article.isConnected) return
    document.removeEventListener("astro:after-swap", dispose)
    observer.disconnect()
    if (frame) cancelAnimationFrame(frame)
    restore()
    panel.remove()
    dialog.remove()
    document.removeEventListener("astro:before-swap", closeBeforeSwap)
    window.removeEventListener("hashchange", closeOnFragmentChange)
    wide.removeEventListener("change", paint)
    window.removeEventListener("resize", schedule)
    article.removeEventListener("load", schedule, true)
    article.removeEventListener("keydown", key)
    article.removeEventListener("click", click)
    article.removeEventListener("toggle", toggle, true)
    article.removeEventListener("sidenote:reveal", revealNote)
    article.removeEventListener("sidenote:suspend", suspendNote)
    for (const event of ["pointerover", "pointerout", "focusin", "focusout"] as const) article.removeEventListener(event, track)
    for (const control of controls) {
      control.removeAttribute("tabindex")
      control.removeAttribute("role")
      control.removeAttribute("aria-pressed")
      control.removeAttribute("aria-expanded")
      control.removeAttribute("aria-haspopup")
      control.removeAttribute("aria-controls")
    }
    for (const note of notes) {
      note.hidden = false
      note.removeAttribute("tabindex")
      note.removeAttribute("aria-keyshortcuts")
    }
    delete article.dataset.enhanced
  }
  document.addEventListener("astro:after-swap", dispose)
}
