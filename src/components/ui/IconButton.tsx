import type { ComponentPropsWithoutRef } from "react"

type Props = ComponentPropsWithoutRef<"button"> & { label: string; tooltip?: string }

export function IconButton({ label, tooltip = label, children, className, ...props }: Props) {
  return (
    <button type="button" aria-label={label} data-tooltip={tooltip} className={["icon-button", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </button>
  )
}
