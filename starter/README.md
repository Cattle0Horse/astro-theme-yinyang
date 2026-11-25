# 我的 YinYang 博客

使用 Node 24 和 pnpm。`pnpm install` 安装依赖，`pnpm dev` 启动本地预览。

- 在 `astro.config.ts` 的 `yinyang()` 中设置标题、描述、作者等选项。自定义标签页图标时，将文件放在 `public/`，例如 `public/favicon.svg`，再设置 `favicon: "favicon.svg"`。
- Blog 文章放在 `src/content/posts/<slug>/index.md`，填写 `title` 和 `date`。可以编辑或删除模板里的 `hello`。
- Notes 放在 `src/content/notes/YYYY-MM/NNN.md`，填写 `date`。附件放在条目目录内，在 Markdown 中用相对路径引用。
- `pnpm build` 生成 `dist/`。部署时设置 `SITE_URL`，GitHub Pages 项目站点再设置 `SITE_BASE=/仓库名`。

升级主题时运行 `pnpm add -E astro-theme-yinyang@<版本>`，重新构建并提交依赖声明和锁文件。
