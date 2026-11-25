const defaults = {
  title: "YinYang",
  description: "在日常里阅读、思考和记录。",
  author: "YinYang",
  language: "zh-CN",
  timeZone: "Asia/Shanghai",
  favicon: "logo.png",
  postsPerPage: 30,
  originalMarkdown: true,
  notFound: { available: [] as readonly string[] },
  editPage: {
    repository: process.env.SITE_EDIT_REPOSITORY || process.env.GITHUB_REPOSITORY,
    branch: process.env.SITE_EDIT_BRANCH || "main"
  },
  defaultPalette: "indigo",
  palettes: [
    { id: "indigo", name: "靛蓝" },
    { id: "violet", name: "紫罗兰" },
    { id: "teal", name: "青绿" },
    { id: "amber", name: "琥珀" },
    { id: "rose", name: "玫瑰" },
    { id: "graphite", name: "石墨" }
  ]
} as const

export interface ThemeOptions {
  title?: string
  description?: string
  author?: string
  language?: string
  timeZone?: string
  favicon?: string
  postsPerPage?: number
  originalMarkdown?: boolean
  defaultPalette?: (typeof defaults.palettes)[number]["id"]
  notFound?: { available: readonly string[] }
  editPage?: { repository?: string; branch?: string }
}

declare const __YINYANG_OPTIONS__: ThemeOptions | undefined

const options = typeof __YINYANG_OPTIONS__ === "undefined" ? {} : __YINYANG_OPTIONS__

export const site = { ...defaults, ...options, editPage: { ...defaults.editPage, ...options.editPage } }
