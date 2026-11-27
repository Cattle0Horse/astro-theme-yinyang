# YinYang Astro

用 Astro、React、TypeScript 和 Tailwind CSS 构建的静态 Blog 与 Notes。

## 创建自己的站点

使用 Node 24 和 pnpm，从 GitHub 的 `main` 分支创建站点。

```sh
pnpm create astro@latest my-blog --template Cattle0Horse/astro-theme-yinyang/starter
cd my-blog
pnpm dev
```

在 `astro.config.ts` 的 `yinyang()` 中设置标题、描述和作者。

## 主题仓库开发

使用 Node 24 和 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## 写作

- Blog 放在 `src/content/posts/<slug>/index.md`，支持多级目录。填写 `title` 和 `date`，描述和标签可选。
- Notes 放在 `src/content/notes/YYYY-MM/NNN.md`。填写 `date`，标题可省略，标签使用 `note_tags`。来源可写在 `source`。
- 附件放在内容目录内，通过相对路径引用。草稿将 `draft` 设为 `true`。

## 构建与检查

```sh
pnpm check
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
```

`pnpm build` 生成可直接托管的静态目录 `dist/`。部署时用 `SITE_URL` 设置站点地址，子目录部署再用 `SITE_BASE` 设置路径，例如 `/blog-theme`。主题选项见 `src/site.config.ts` 的 `ThemeOptions`。

设置 `SITE_EDIT_REPOSITORY`（`owner/repo`）和可选的 `SITE_EDIT_BRANCH`（默认 `main`）后，所有详情页都会用 Astro 提供的源文件路径生成编辑按钮和文末纠错链接。GitHub Actions 默认提供 `GITHUB_REPOSITORY`，也可用于生成链接。

## LICENSE

[MIT](./LICENSE)
