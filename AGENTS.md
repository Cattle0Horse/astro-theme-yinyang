# blog-theme

这是面向 GitHub Pages 的静态博客主题。内容范围为 Blog 和 Notes，使用普通 `.md`。Astro 在构建期生成站点，TypeScript 描述内容和组件接口，React 负责需要客户端状态的 UI，Tailwind CSS 负责通用样式。发布产物由静态文件服务器直接提供。

按本次改动读取对应规范：

- **实现**：改动源码、依赖、内容处理、公开 URL、构建或验证时，阅读 [实现规范](docs/IMPLEMENTATION.md)。
- **界面**：改动布局、组件、视觉样式或交互时，阅读 [设计系统](DESIGN_SYSTEM.md)，先查找 `src/components/` 和 `src/styles/` 中对应的共用实现。

工作前查看现有代码和检查命令。修改共用规则时同步更新其定义文件和相关使用处。交付时说明实际验证了哪些行为，以及哪些检查仍待完成。
