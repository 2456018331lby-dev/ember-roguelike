# 余烬 Ember - 维护与接手文档

最后更新：2026-05-23（Web 优先平台路线整理）

本文件是给后续继续维护这个仓库的人或 AI 使用的。它记录当前真实主线、已经落地的能力、接手顺序，以及 Android / 桌面方向的边界。

---

## 1. 当前真实主线

当前唯一持续演进的玩法主线是 `web/` 下的 Web/PWA 版本。

它同时承担三件事：
- 当前可玩版本
- GitHub Pages 发布来源
- Android APK 与未来桌面版的共同内容来源

`docs/` 不是源码主目录，而是发布镜像。

Godot 目录当前保留为长期备选骨架，不是这一批工作的主运行面。

---

## 2. 当前仓库结构

```text
roguelike-game/
├── web/                    # 源码主目录，优先改这里
│   ├── index.html
│   ├── styles.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── icons/
│   └── src/
│       ├── game_core.mjs   # 核心玩法逻辑，无 DOM 依赖
│       ├── main.mjs        # 输入、主循环、HUD 接线、菜单与奖励页接线
│       └── presentation.mjs# 展示层结构边界，供未来 UI 扩展
├── docs/                   # GitHub Pages 发布镜像，由 sync-web 脚本生成
├── scripts/
│   └── sync-web.mjs        # web -> docs 同步脚本
├── tests/
│   └── game_core.test.mjs  # 当前核心回归测试
├── package.json            # 运行、同步、Android 入口脚本
├── capacitor.config.json   # Capacitor 配置
├── RELEASE_PLAN.md         # Web -> Android -> 桌面路线文档
├── README.md               # 项目入口说明
├── MAINTENANCE.md          # 当前文件
├── GDD.md                  # 长期设计文档
├── scripts/ scenes/ data/  # 保留中的 Godot 骨架
└── project.godot
```

---

## 3. 当前已落地的能力

### 玩法与运行
- 当前可玩版本在 `web/`
- 本地静态服务入口：`npm run serve`
- 核心回归入口：`npm test`
- PWA manifest 与 service worker 已存在

### 结构边界
- `web/src/game_core.mjs` 继续承担纯逻辑与规则推导
- `web/src/main.mjs` 继续承担平台输入和 UI 接线
- `web/src/presentation.mjs` 目前已作为展示层边界预留，但主循环还没有完全把展示结构都接进去

### 发布链
- `docs/` 当前是发布镜像目录
- `scripts/sync-web.mjs` 负责把 Web 发布资产同步到 `docs/`
- `npm run sync:web` 是统一同步入口

### Android 铺路
- `capacitor.config.json` 已加入仓库，原生包体直接读取 `web/`
- `package.json` 已预留：
  - `npm run android:sync`
  - `npm run android:open`
  - `npm run build:android:debug`
- 是否能真正产出 APK 仍取决于本机 Android Studio / SDK / Gradle 环境

---

## 4. 当前还没落地，但已经明确进入路线图的能力

### Android
以下内容是计划内方向，不应误写成“当前已稳定可用”：
- `android/` 原生工程初始化
- 首次 `npx cap add android`
- `assembleDebug` 打包通过
- 真机或模拟器安装验证

### 桌面 / Steam
当前只是预留边界，不做实际接入：
- 未来桌面壳方案（Tauri / Electron）尚未确定
- Steamworks、成就、排行榜、云存档尚未接入
- 手柄输入与桌面存档策略尚未实现

### Godot
Godot 骨架仍然存在，但当前没有把它作为玩法主线同步推进。

---

## 5. 当前最重要的维护原则

1. **先改 `web/`，不要先改 `docs/`。**
2. **把玩法逻辑留在 `web/src/game_core.mjs`。**
3. **把平台接线和输入留在 `web/src/main.mjs`。**
4. **如果要增强 HUD / 奖励页结构，优先扩 `web/src/presentation.mjs`。**
5. **改完发布相关内容后，先跑 `npm run sync:web` 再检查 `docs/`。**
6. **任何影响核心规则的改动都必须跑 `npm test`。**

---

## 6. 当前优先级顺序

### P0：平台与维护链打通
- 保持 README、MAINTENANCE、RELEASE_PLAN 三份文档与仓库现状一致
- 让 `web -> docs` 同步成为唯一发布镜像路径
- 让 Android 包装入口在仓库里可见、可复现、可继续接力

### P1：Android APK 真正跑起来
- `npm install`
- `npm run android:sync`
- 如环境允许，初始化 `android/`
- 在 Android Studio 中运行或完成 `assembleDebug`
- 把失败原因准确记录到文档，而不是口头记忆

### P2：继续打磨玩法与前端表现
- 第 5 波 Boss 断点
- HUD 信息层
- 奖励页诱惑感
- 结束页复盘能力

### P3：桌面 / Steam 预留继续细化
- 输入抽象
- 安全显示区
- 桌面存档路径策略
- 未来平台能力接口预留

---

## 7. 当前验证方式

### 已有验证
- `npm test`：核心逻辑回归
- `npm run serve`：本地静态预览
- `npm run sync:web`：发布镜像同步

### 本批建议的验证顺序
```bash
npm install
npm test
npm run sync:web
npm run serve
```

如本机已装好 Android Studio / SDK，再继续：

```bash
npm run android:sync
npm run android:open
npm run build:android:debug
```

---

## 8. 接手者最容易踩的坑

- 不要把 `docs/` 当源码主目录直接改。
- 不要把 GDD 里的长期目标当成仓库当前已实现状态。
- 不要把平台相关逻辑直接散落进玩法层。
- 不要在没有更新维护文档的情况下新增平台入口。
- 不要假设 Android 构建失败一定是 JS 问题，很多时候是本机 SDK / Gradle / 环境问题。

---

## 9. 文档分工

- [README.md](README.md)：项目入口与常用命令
- [MAINTENANCE.md](MAINTENANCE.md)：当前维护真相与接手顺序
- [RELEASE_PLAN.md](RELEASE_PLAN.md)：平台路线与阶段目标
- [NEXT_PHASE_PLAN.md](NEXT_PHASE_PLAN.md)：下一阶段执行清单
- [GDD.md](GDD.md)：长期设计愿景
