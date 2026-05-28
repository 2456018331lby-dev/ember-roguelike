# Android / Steam 发布路线

当前第一版采用 Web/PWA + Capacitor 封装路线。

## 为什么先这么做

- 当前核心是轻量 2D 肉鸽原型，Web Canvas 足够跑。
- 手机可以直接浏览器玩，也能添加到桌面，验证最快。
- Capacitor 后续可以把同一套 `web/` 打成 Android APK。
- PC/Steam 后续可以用 Tauri/Electron 封装同一套 Web 核心，或迁移到 Godot。

## 当前可玩地址

https://2456018331lby-dev.github.io/ember-roguelike/

## Android APK 后续构建步骤

本机需要安装 Android Studio 或 Android SDK Command-line Tools。

安装后执行：

```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

生成 APK：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Steam / PC 预留方向

路线 A：Web 核心继续发展

- `web/src/game_core.mjs` 保持纯逻辑，不依赖 DOM
- PC 用 Tauri/Electron 包装
- 加入键鼠、手柄、全屏、存档、成就接口

路线 B：Godot 正式版

- 当前仓库已保留 Godot 4 项目骨架
- 当玩法稳定后，把 Web MVP 验证过的数值/卡牌/敌人迁移到 Godot
- Godot 更适合 Steam：粒子、手柄、性能、导出平台更完整

## 维护原则

- 玩法逻辑优先放在纯模块里，方便测试。
- 卡牌/敌人/宿主尽量数据驱动。
- 新增局内随机属性时先写测试，再扩展 UI。
