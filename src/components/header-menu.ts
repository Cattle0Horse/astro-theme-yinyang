export const openHeaderMenu = ".header-menu[open]"

export function closeHeaderMenu(menu: HTMLDetailsElement | null, returnFocus: boolean) {
  if (!menu) return
  menu.open = false
  if (returnFocus) menu.querySelector("summary")?.focus({ preventScroll: true })
}
