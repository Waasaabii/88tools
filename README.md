<div align="center">
  <img src="https://www.88code.ai/assets/logo-BCIlXRt9.png" width="120" height="120" alt="88tools Logo" />
  <h1>88code 助手 (88tools)</h1>
  <p>
    <b>为专业开发者打造的极致 88code.ai 体验增强工具</b>
  </p>
  <p>
    <a href="https://github.com/authwang/88tools/stargazers"><img src="https://img.shields.io/github/stars/authwang/88tools?style=flat-square&logo=github" alt="GitHub stars"></a>
    <a href="https://github.com/authwang/88tools/network/members"><img src="https://img.shields.io/github/forks/authwang/88tools?style=flat-square&logo=github" alt="GitHub forks"></a>
    <a href="https://github.com/authwang/88tools/blob/main/LICENSE"><img src="https://img.shields.io/github/license/authwang/88tools?style=flat-square" alt="License"></a>
  </p>
</div>

---

<!-- 在这里写你的独白 -->
<!-- [Your Monologue Here] -->

## ✨ 主要功能 (Features)

- **📊 服务状态监控 (Service Status)**
  - 实时整合并展示平台各项服务的健康状态。
  - 快速识别服务异常，并在界面显眼位置提示。
  - **可视化时间线**：完整渲染过去 60 分钟的服务健康度。

- **🔄 自动刷新 (Auto Refresh)**
  - 智能自动刷新机制，确保页面数据（如任务状态、资源配额）始终保持最新。
  - 可配置刷新间隔和触发条件。

- **⏰ 定时重置 (Scheduled Reset)**
  - 支持自动化定时重置任务，帮助用户更高效地利用每日/每周期配额。
  - **双模调度算法**：<30min 进入精准检查模式，>30min 保持低功耗待机。

- **💳 订阅管理增强 (Enhanced Subscriptions)**
  - 提供更直观的订阅信息展示。
  - 精确计算冷却时间 (`nextResetAvailableAt`)，防止无效点击。
  - 自动识别并过滤不可重置的套餐。

- **⚙️ 集中控制面板 (Control Panel)**
  - 统一的配置入口，可随时开启/关闭特定功能。
  - 悬浮球/Header 图标快速呼出。

## 🛠️ 技术栈 (Tech Stack)

- **核心框架**: [React 19](https://react.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **Userscript 插件**: [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- **样式**: CSS Variables + Inline Styles (无 Tailwind 依赖，体积更小)

## 🚀 开发指南 (Development)

### 1. 环境准备
确保已安装 Node.js 和包管理器 (推荐 pnpm 或 npm)。

### 2. 安装依赖
```bash
npm install
```

### 3. 启动开发模式
```bash
npm run dev
```
启动后，Vite 会输出一个本地开发脚本链接。在浏览器中安装 Tampermonkey 扩展，并点击终端输出的链接即可安装开发脚本。代码修改可通过 HMR (热更新) 实时生效。

### 4. 构建生产版本
```bash
npm run build
```
构建完成后，生成的 `.user.js` 文件将位于 `dist/` 目录下。

## 📈 Star History

<a href="https://star-history.com/#Waasaabii/88tools&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Waasaabii/88tools&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Waasaabii/88tools&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Waasaabii/88tools&type=Date" />
 </picture>
</a>

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。
