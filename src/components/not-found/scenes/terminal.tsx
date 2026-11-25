import { useId, useLayoutEffect, useRef, useState, type SubmitEvent } from "react"
import { navigate } from "astro:transitions/client"
import { CornerDownLeft } from "lucide-react"
import { IconButton } from "../../ui/IconButton"
import { Scene, SceneStatus, type SceneProps } from "../Scene"
import styles from "./terminal.css?inline"

interface Line {
  text: string
  href?: string
}

export default function Terminal({ home, articles }: SceneProps) {
  const inputId = useId()
  const output = useRef<HTMLDivElement>(null)
  const [command, setCommand] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  useLayoutEffect(() => {
    const log = output.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lines])

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const entered = command.trim()
    setCommand("")
    if (!entered) return
    const [verb, ...args] = entered.split(/\s+/u)
    const name = verb.toLowerCase()
    if (name === "clear") {
      setLines([])
      return
    }
    const next: Line[] = [{ text: "❯ " + entered }]
    const line = (text: string) => next.push({ text })
    if (name === "home") void navigate(home)
    else if (name === "cd") {
      if (args.length > 1) line("cd: too many arguments")
      else if (!args.length || ["~", "~/", "/"].includes(args[0])) void navigate(home)
      else line("cd: no such directory: " + args[0])
    } else if (name === "pwd") line(home)
    else if (name === "help") line("cd / cd ~ 回家 · pwd 当前目录\nls 文章列表 · clear 清屏\nhome 回家 · random 随机文章")
    else if (name === "ls") {
      if (!articles.length) line("这里还没有文章，试试 home")
      for (const article of articles.slice(0, 4)) next.push({ text: "↗ " + article.title, href: article.url })
    } else if (name === "random") {
      if (articles.length) void navigate(articles[Math.floor(Math.random() * articles.length)].url)
      else line("还没有文章可以探索，试试 home")
    } else if (name === "sudo") line("好奇心不需要管理员权限")
    else if (name === "404") line("你找到了：没找到")
    else line("command not found，试试 help")
    setLines((previous) => [...previous, ...next].slice(-12))
  }

  return (
    <Scene name="terminal" title="迷路终端" styles={styles}>
      <div className="nf-terminal">
        <div className="nf-terminal-bar">
          <span>● ● ●</span>
          <span>lost@wherever: ~</span>
        </div>
        <div className="nf-terminal-screen">
          <p>
            <span className="nf-muted">$</span> find this-page
          </p>
          <p className="nf-terminal-error">
            404: page not found<span className="nf-caret">_</span>
          </p>
          <div className="nf-terminal-output" role="log" ref={output}>
            {lines.map(({ text, href }, index) =>
              href ? (
                <a key={index} href={href}>
                  {text}
                </a>
              ) : (
                <p key={index}>{text}</p>
              )
            )}
          </div>
          <form className="nf-terminal-form" onSubmit={submit}>
            <label htmlFor={inputId}>❯</label>
            <input
              id={inputId}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="终端命令：help、cd ~、pwd、ls、clear、home、random"
              placeholder="help / cd ~ / ls"
              value={command}
              onChange={(event) => setCommand(event.currentTarget.value)}
            />
            <IconButton type="submit" label="执行命令">
              <CornerDownLeft aria-hidden="true" />
            </IconButton>
          </form>
          <div className="nf-terminal-footer">
            <SceneStatus className="nf-terminal-status">路径不存在，好奇心仍可执行</SceneStatus>
            <a className="nf-terminal-home" href={home} data-nf-home>
              $ cd ~ <span aria-hidden="true">↵</span>
            </a>
          </div>
        </div>
      </div>
    </Scene>
  )
}
