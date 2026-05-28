# Ember 下一阶段执行计划

最后更新：2026-05-23（Web 优先平台铺路）

这个文件不是长期维护百科，而是“下一阶段怎么继续干”的执行摘要。

---

## 当前阶段目标

把项目从“当前可玩的 Web/PWA 原型”推进到：
- 有可靠的 `web -> docs` 发布镜像链
- 有可接力的 Android APK 包装脚手架
- 有为未来桌面 / Steam 扩展预留的清晰边界
- 同时不破坏现有玩法测试与开发效率

---

## 当前阶段已经做完

### 文档与平台路线
- 已明确 `web/` 是当前唯一玩法主线
- 已补 `RELEASE_PLAN.md`，把 Web → Android → 桌面路线拆开说明
- 已把 `MAINTENANCE.md` 改成真实接手文档

### 工程入口
- `package.json` 已统一常用入口：
  - `npm test`
  - `npm run check`
  - `npm run serve`
  - `npm run sync:web`
  - `npm run android:sync`
  - `npm run android:open`
  - `npm run build:android:debug`
- 已补 `scripts/sync-web.mjs`
- 已补 `capacitor.config.json`

### 玩法基础
- `tests/game_core.test.mjs` 仍是当前核心回归安全网
- `web/src/game_core.mjs` 继续是纯逻辑主边界
- `web/src/presentation.mjs` 已保留为未来 UI 展示结构边界

---

## 当前阶段没做完

### Android
- 还未确认本机是否已完成 `npm install`
- 还未确认 `assembleDebug` 是否能通过
- 还需要根据本机环境继续确认 Android Studio / SDK / Gradle 路线

### 桌面 / Steam
- 还没有真正接入桌面壳
- 还没有手柄输入抽象
- 还没有桌面存档路径方案

### 前端 / 玩法
- `presentation.mjs` 还没有被 `main.mjs` 完整接上
- 第 5 波 Boss 断点与奖励页诱惑感仍是后续重点

---

## 下一步优先顺序

### 1. 先跑通同步与校验
```bash
npm install
npm test
npm run sync:web
npm run serve
```

确认：
- `docs/` 中的发布镜像与 `web/` 一致
- 本地页面仍可玩
- 核心测试没有被平台铺路改动破坏

### 2. 继续推进 Android 包装脚手架
先确认本机环境是否具备：
- Android Studio
- Android SDK
- Gradle / Android Studio 自带 JDK

如果环境就绪，继续：
```bash
npm run android:sync
npm run android:open
npm run build:android:debug
```

如果失败，必须明确记录失败点属于哪一类：
- 依赖未安装
- Android SDK / JDK 环境缺失
- Gradle 构建失败
- Web 资源同步错误

### 3. 补最小 CI
目标：
- push / pull_request 至少自动跑 `npm test`
- 后续如果同步脚本稳定，再把 `sync:web` 校验加入 CI

### 4. 开始整理桌面预留边界
优先写清：
- 横屏与 16:9 / 16:10 安全区
- 键鼠 / 手柄输入集中在 `web/src/main.mjs`
- 玩法推导继续留在 `web/src/game_core.mjs`
- 展示结构继续走 `web/src/presentation.mjs`

### 5. 回到玩法与前端表现
平台链跑通后，再继续：
- 第 5 波 Boss 曲线
- HUD 信息层
- 奖励页推荐理由和诱惑感
- 结束页复盘能力

---

## 接手者提醒

- 优先维护 `web/`，不要直接手改 `docs/`
- Android 铺路的首要目标是“让后续人能接着跑”，不是一次性把所有平台细节做完
- 如果 Android 卡住，先记录环境问题，不要立刻回退整条路线
- 如果要继续做桌面版，也先做输入/显示/存档边界，不要马上接 Steamworks
