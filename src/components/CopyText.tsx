import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { IconButton } from "./ui/IconButton"

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export default function CopyText({ source, label = "复制正文 Markdown" }: { source: string; label?: string }) {
  const [status, setStatus] = useState("")
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
    let result: string
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
      result = "已复制"
    } catch {
      result = "复制失败"
    }
    if (current !== operation.current) return
    setStatus(result)
    timer.current = window.setTimeout(() => setStatus(""), 1800)
  }

  return (
    <span className="inline-flex items-center" data-enhancement>
      <IconButton label={label} tooltip={status || label} onClick={copy}>
        {status === "已复制" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </IconButton>
      <span role="status" className="sr-only">
        {status}
      </span>
    </span>
  )
}
