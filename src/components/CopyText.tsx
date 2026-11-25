import { useEffect, useRef, useState } from "react"
import { copyFeedbackDuration, copyStatus, type CopyState } from "../lib/copy-state"
import { CopyFeedback } from "./ui/CopyFeedback"
import { IconButton } from "./ui/IconButton"

export default function CopyText({ source }: { source: string }) {
  const label = "复制正文 Markdown"
  const [state, setState] = useState<CopyState>()
  const status = state ? copyStatus[state] : ""
  const timer = useRef(0)
  const operation = useRef(0)
  useEffect(
    () => () => {
      operation.current++
      window.clearTimeout(timer.current)
    },
    []
  )

  async function copy() {
    const current = ++operation.current
    window.clearTimeout(timer.current)
    setState("pending")
    let result: "success" | "error"
    try {
      const markdown = fetch(source).then((response) => {
        if (!response.ok) throw new Error("Could not load Markdown")
        return response.text()
      })
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        const text = markdown.then((value) => new Blob([value], { type: "text/plain" }))
        void text.catch(() => {})
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })])
      } else await navigator.clipboard.writeText(await markdown)
      result = "success"
    } catch {
      result = "error"
    }
    if (current !== operation.current) return
    setState(result)
    timer.current = window.setTimeout(() => setState(undefined), copyFeedbackDuration)
  }

  return (
    <span className="inline-flex items-center" data-enhancement>
      <IconButton label={label} tooltip={status || label} data-copy-state={state} onClick={copy}>
        <CopyFeedback />
      </IconButton>
      <span role="status" className="sr-only">
        {status}
      </span>
    </span>
  )
}
