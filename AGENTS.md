# blog-theme

这是面向 GitHub Pages 的静态博客主题，支持使用 Markdown 写作的 Blog 和 Notes。Astro 在构建期生成站点，React 负责需要客户端状态的 UI。

- 改动源码、依赖、内容处理、公开 URL、构建或验证时，阅读 [实现规范](docs/IMPLEMENTATION.md)。
- 改动布局、组件、视觉样式或交互时，先查找 `src/components/` 和 `src/styles/` 中的共用实现，并阅读 [设计系统](DESIGN_SYSTEM.md)。

工作前查看现有代码和检查命令。修改共用规则时同步更新其定义文件和相关使用处。交付时说明实际验证了哪些行为，以及哪些检查仍待完成。
