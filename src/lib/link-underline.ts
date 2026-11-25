const desktopLinks = ".header-desktop .header-link"

interface UnderlineState {
  hover: boolean
  focus: boolean
  enter?: Animation
  exit?: Animation
}

const states = new WeakMap<HTMLAnchorElement, UnderlineState>()
const pixelsPerMillisecond = 0.5
const transitionDocument: Document & { activeViewTransition?: ViewTransition | null } = document
let observedTransition: ViewTransition | undefined

function sweepDuration(link: HTMLAnchorElement) {
  // Each line paints its own underline segment when an inline link wraps.
  let width = 0
  for (const fragment of link.getClientRects()) width = Math.max(width, fragment.width)
  return width / pixelsPerMillisecond
}

function showUnderline(link: HTMLAnchorElement, state: UnderlineState) {
  link.setAttribute("data-underline-visible", "")
  state.enter = link.animate([{ "--link-underline-end": "0%" }, { "--link-underline-end": "100%" }], { duration: sweepDuration(link), fill: "backwards" })
}

function update(link: HTMLAnchorElement, kind: "hover" | "focus", active: boolean) {
  const state = states.get(link) ?? { hover: false, focus: false }
  states.set(link, state)
  state[kind] = active
  const visible = state.hover || state.focus
  if (state.exit || visible === link.hasAttribute("data-underline-visible")) return
  if (visible) {
    showUnderline(link, state)
    return
  }

  const end = getComputedStyle(link).getPropertyValue("--link-underline-end")
  state.enter?.cancel()
  state.enter = undefined
  const exit = link.animate(
    [
      { "--link-underline-start": "0%", "--link-underline-end": end },
      { "--link-underline-start": "100%", "--link-underline-end": "100%" }
    ],
    { duration: sweepDuration(link), fill: "both" }
  )
  state.exit = exit
  const finish = () => {
    link.removeAttribute("data-underline-visible")
    exit.cancel()
    state.exit = undefined
    if (link.isConnected && (state.hover || state.focus)) showUnderline(link, state)
  }
  void exit.finished.then(finish, finish)
}

function pointerUnderline(event: PointerEvent) {
  if (event.pointerType === "touch") return
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(desktopLinks) : null
  if (!link || (event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) return
  const transition = transitionDocument.activeViewTransition
  if (transition && link.matches(desktopLinks)) {
    reconcileDesktopHover(transition, event)
    return
  }
  update(link, "hover", event.type === "pointerover")
}

function reconcileDesktopHover(transition: ViewTransition, event: PointerEvent) {
  if (observedTransition === transition) return
  observedTransition = transition
  let { clientX, clientY } = event

  function track(pointer: PointerEvent) {
    if (pointer.pointerType !== "touch") ({ clientX, clientY } = pointer)
  }

  function finish() {
    document.removeEventListener("pointermove", track)
    if (observedTransition !== transition) return
    observedTransition = undefined
    const hovered = document.elementFromPoint(clientX, clientY)?.closest(desktopLinks)
    for (const link of document.querySelectorAll<HTMLAnchorElement>(desktopLinks)) update(link, "hover", link === hovered)
  }

  // Native view transitions temporarily change pointer hit testing across the page.
  document.addEventListener("pointermove", track, { passive: true })
  void transition.finished.then(finish, finish)
}

function focusUnderline(event: FocusEvent) {
  const link = event.target
  if (!(link instanceof HTMLAnchorElement) || !link.matches(desktopLinks)) return
  update(link, "focus", event.type === "focusin" && link.matches(":focus-visible"))
}

document.addEventListener("pointerover", pointerUnderline)
document.addEventListener("pointerout", pointerUnderline)
document.addEventListener("focusin", focusUnderline)
document.addEventListener("focusout", focusUnderline)
