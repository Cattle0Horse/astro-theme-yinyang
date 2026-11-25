import { useEffect, useRef, useState } from "react"
import { CopyFeedback } from "./ui/CopyFeedback"
import { IconButton } from "./ui/IconButton"

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export default function CopyText({ source, label = "复制正文 Markdown" }: { source: string; label?: string }) {
  const [state, setState] = useState<"pending" | "success" | "error">()
  const status = state === "pending" ? "正在复制" : state === "success" ? "已复制" : state === "error" ? "复制失败" : ""
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
      const response = fetch(source).then((result) => {
        if (!result.ok) throw new Error("Could not load Markdown")
        return result.blob()
      })
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        const text = response.then(async (blob) => new Blob([await blob.text()], { type: "text/plain" }))
        void text.catch(() => {})
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })])
      } else await copyText(await (await response).text())
      result = "success"
    } catch {
      result = "error"
    }
    if (current !== operation.current) return
    setState(result)
    timer.current = window.setTimeout(() => setState(undefined), 1800)
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
