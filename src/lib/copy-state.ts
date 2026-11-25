export const copyStatus = {
  pending: "正在复制",
  success: "已复制",
  error: "复制失败"
}

export type CopyState = keyof typeof copyStatus

const copyFeedbackDuration = 1800

export function createCopyFeedback(onChange: (state: CopyState | undefined) => void) {
  let state: CopyState | undefined
  let timer = 0
  let generation = 0

  function expireAfterDelay() {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      state = undefined
      onChange(undefined)
    }, copyFeedbackDuration)
  }

  async function copy(write: () => Promise<void>) {
    if (state) {
      if (state !== "pending") expireAfterDelay()
      return
    }

    const operation = generation
    state = "pending"
    onChange(state)
    let result: "success" | "error"
    try {
      await write()
      result = "success"
    } catch {
      result = "error"
    }
    if (operation !== generation) return
    state = result
    onChange(state)
    expireAfterDelay()
  }

  function reset() {
    generation++
    window.clearTimeout(timer)
    state = undefined
  }

  return { copy, reset }
}
