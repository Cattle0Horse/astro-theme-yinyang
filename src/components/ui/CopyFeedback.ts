import { createElement } from "react"
import { Check, CircleAlert, Copy, LoaderCircle } from "lucide-react"

export function CopyFeedback() {
  return createElement(
    "span",
    { className: "copy-feedback", "aria-hidden": true },
    createElement(Copy, { className: "copy-idle" }),
    createElement(LoaderCircle, { className: "copy-pending" }),
    createElement(Check, { className: "copy-success" }),
    createElement(CircleAlert, { className: "copy-error" })
  )
}
