export const site = {
  title: "YinYang",
  description: "在日常里阅读、思考和记录。",
  author: "YinYang",
  language: "zh-CN",
  timeZone: "Asia/Shanghai",
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
