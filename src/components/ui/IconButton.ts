import { createElement, type ComponentPropsWithoutRef } from "react"

type Props = ComponentPropsWithoutRef<"button"> & { label: string; tooltip?: string }

export function IconButton({ label, tooltip = label, children, className, ...props }: Props) {
  return createElement("button", { type: "button", "aria-label": label, "data-tooltip": tooltip, className: className ? `icon-button ${className}` : "icon-button", ...props }, children)
}
