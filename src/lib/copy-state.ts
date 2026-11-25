export const copyStatus = {
  pending: "正在复制",
  success: "已复制",
  error: "复制失败"
}

export type CopyState = keyof typeof copyStatus

export const copyFeedbackDuration = 1800
