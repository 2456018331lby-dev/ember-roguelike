# Ember 平台发布路线

## 当前定位

当前唯一持续演进的玩法主线是 `web/` 下的 Web/PWA 版本。

这条主线同时承担三件事：
- 玩法快速验证
- GitHub Pages 在线试玩发布
- Android APK 与未来桌面版的共同内容来源

`docs/` 是发布镜像，不是源码真源。

---

## 阶段 1：Web / PWA 持续验证

当前阶段目标：
- 继续在 `web/` 中迭代玩法与前端表现
- 通过 `docs/` 输出 GitHub Pages 可玩的测试版
- 保持 `tests/game_core.test.mjs` 作为核心回归安全网

当前入口：
- 本地运行：`npm run serve`
- 本地校验：`npm test`
- 发布镜像同步：`npm run sync:web`

约束：
- 玩法逻辑尽量留在 [web/src/game_core.mjs](web/src/game_core.mjs)
- 展示结构继续通过 [web/src/presentation.mjs](web/src/presentation.mjs)
- 平台相关输入和界面接线尽量收口在 [web/src/main.mjs](web/src/main.mjs)

---

## 阶段 2：Android APK（Capacitor 路线）

目标：
- 以现有 Web 版本为壳内容，输出 Android APK
- 不额外复制一套玩法代码

脚手架约定：
- Capacitor 配置文件：`capacitor.config.json`
- Android 工程目录：`android/`
- Android 同步命令：`npm run android:sync`
- Android Studio 打开命令：`npm run android:open`
- Debug 构建命令：`npm run build:android:debug`

前置条件：
- 已安装 Node.js
- 已安装 Android Studio
- 已配置 Android SDK
- 首次同步前完成 `npm install`

当前已知风险：
- 当前仓库是静态 Web 项目，不依赖 bundler；GitHub Pages 走 `web -> docs`，而 Capacitor 原生包体直接读取 `web/`
- 若本机缺少 Android SDK / Gradle 环境，`android:sync` 或 `assembleDebug` 会失败
- 若后续引入原生插件，需要同步更新 Android 权限与生命周期说明

APK 路线完成标准：
1. `npm install`
2. `npm run sync:web`
3. `npm run android:sync`
4. `npm run android:open`
5. 在 Android Studio 中能运行 Debug 包，或 `./android/gradlew assembleDebug` 通过

---

## 阶段 3：桌面 / Steam 预留

第一批先只做预留，不直接接 Steamworks 或桌面壳。

### 需要提前守住的边界
- 横屏优先，UI 默认按 16:9 设计，并兼容 16:10 安全区
- 键鼠输入继续是一级支持目标
- 未来手柄输入应集中收口在 [web/src/main.mjs](web/src/main.mjs)
- 本地存档策略需要与浏览器存档解耦，便于未来桌面落盘
- 玩法、UI 展示、平台接线继续分层，避免未来桌面封装时重拆结构

### 未来 Steam 准备项
- 输入抽象：键鼠 / 手柄 / 触屏分层
- 窗口模式与 UI 缩放策略
- 本地存档路径与多存档位设计
- 成就、排行榜、云存档接口预留
- 桌面壳方案二选一：Tauri 或 Electron（后续再定）

当前不做：
- 不接 Steamworks SDK
- 不做成就与排行榜
- 不做桌面特化发包流程

---

## 路线选择说明

当前仓库仍保留 Godot 骨架，但第一批不把 Godot 重新扶正为主运行面。

原因：
- 当前可玩的真实主线在 `web/`
- 现有测试也围绕 Web 逻辑建立
- 先把 Web → Android → Desktop 的单一内容链跑通，能更快得到可交付 APK

如果未来出现以下条件，再考虑重新评估 Godot 主线：
- Web 壳在 Android 性能或输入上成为明确瓶颈
- 需要更深的原生渲染/粒子/控制器支持
- Steam 版对桌面性能与原生功能的要求超过 Web 壳承载范围
