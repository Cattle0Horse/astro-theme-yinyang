import { useEffect, useState } from "react"
import { copyStatus, createCopyFeedback, type CopyState } from "../lib/copy-state"
import { CopyFeedback } from "./ui/CopyFeedback"
import { IconButton } from "./ui/IconButton"

export default function CopyText({ source }: { source: string }) {
  const label = "复制正文 Markdown"
  const [state, setState] = useState<CopyState>()
  const [feedback] = useState(() => createCopyFeedback(setState))
  const status = state ? copyStatus[state] : ""
  useEffect(() => feedback.reset, [feedback])

  function copy() {
    void feedback.copy(async () => {
      const clipboard = navigator.clipboard
      if (!clipboard) throw new Error("Clipboard unavailable")
      const markdown = fetch(source).then((response) => {
        if (!response.ok) throw new Error("Could not load Markdown")
        return response.text()
      })
      if (typeof ClipboardItem !== "undefined" && clipboard.write) {
        const text = markdown.then((value) => new Blob([value], { type: "text/plain" }))
        void text.catch(() => {})
        await clipboard.write([new ClipboardItem({ "text/plain": text })])
      } else await clipboard.writeText(await markdown)
    })
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
