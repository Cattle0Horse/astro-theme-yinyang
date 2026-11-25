# YinYang Astro

用 Astro、React、TypeScript 和 Tailwind CSS 构建的静态 Blog 与 Notes。

## 创建自己的站点

主题发布到 npm、模板推送到 GitHub 后，用 Astro CLI 从仓库的 `starter/` 目录创建项目。将 `OWNER/REPO` 替换为主题仓库名。

~~~sh
pnpm create astro@latest my-blog --template OWNER/REPO/starter
cd my-blog
pnpm dev
~~~

在 `astro.config.ts` 的 `yinyang()` 中设置标题、描述和作者。模板内有一篇可删的入门文章。完整演示文章随主题仓库的演示站构建。

升级时在站点仓库运行 `pnpm add -E astro-theme-yinyang@<版本>`，检查构建并提交更新后的依赖和锁文件。站点仓库持有自己的文章、附件和配置。

## 主题仓库开发

使用 Node 24 和 pnpm。

~~~sh
pnpm install --frozen-lockfile
pnpm dev
~~~

发布前可以用 `pnpm pack` 生成本地 `.tgz`，再在模板副本中运行 `pnpm add <主题包绝对路径>`。`pnpm test:distribution` 会在临时目录验证主题包安装、构建和升级。

## 写作

- Blog 放在 `src/content/posts/<slug>/index.md`，支持多级目录。填写 `title` 和 `date`，描述和标签可选。
- Notes 放在 `src/content/notes/YYYY-MM/NNN.md`。填写 `date`，标题可省略，标签使用 `note_tags`。来源可写在 `source`。
- 附件放在内容目录内，通过相对路径引用。草稿将 `draft` 设为 `true`。

正文使用普通 Markdown。公式、脚注、代码和旁注可参考[示例文章](src/content/posts/reading/markdown/index.md)。

互动 404 从已启用的场景中按设备随机选择。可在 [site.config.ts](src/site.config.ts) 的 `notFound.available` 中配置场景，留空启用全部十款。桌面专属场景为 `flashlight`、`constellation` 和 `terminal`。本地可打开 `/404.html?scene=cat` 体验已启用的指定场景。

演示站也包含[表格](src/content/posts/markdown-table-demo/index.md)、[代码高亮](src/content/posts/syntax-highlighting-test/index.md)、[公式](src/content/posts/math-demo/index.md)、[脚注](src/content/posts/footnote-highlight-demo/index.md)、[旁注](src/content/posts/sidenote-demo/index.md)和[图片请求失败](src/content/posts/test-image-fail/index.md)场景。来源示例的 Markdown 与附件随仓库保存。

## 构建与检查

~~~sh
pnpm check
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
~~~

`pnpm build` 生成可直接托管的静态目录 `dist/`。部署时用 `SITE_URL` 设置站点地址，子目录部署再用 `SITE_BASE` 设置路径，例如 `/blog-theme`。主题选项见 `src/site.config.ts` 的 `ThemeOptions`。

设置 `SITE_EDIT_REPOSITORY`（`owner/repo`）和可选的 `SITE_EDIT_BRANCH`（默认 `main`）后，所有详情页都会用 Astro 提供的源文件路径生成编辑按钮和文末纠错链接。GitHub Actions 默认提供 `GITHUB_REPOSITORY`，也可用于生成链接。

示例图片来自 [Hugo YinYang 示例站](https://github.com/Cattle0Horse/hugo-theme-yinyang)，保留 [MIT 许可](LICENSE)。
