# Android / Steam 发布路线

当前第一版采用 Web/PWA + Capacitor 封装路线。

## 为什么先这么做

- 当前核心是轻量 2D 肉鸽原型，Web Canvas 足够跑。
- 手机可以直接浏览器玩，也能添加到桌面，验证最快。
- Capacitor 已经可以把同一套 `web/` 打成 Android debug APK，后续继续推进签名发布包。
- PC/Steam 后续可以用 Tauri/Electron 封装同一套 Web 核心，或迁移到 Godot。

## 当前可玩地址

https://2456018331lby-dev.github.io/ember-roguelike/

## Android APK 当前构建与验证

本机需要安装 Android Studio 或 Android SDK Command-line Tools。

当前仓库已经补了稳定的默认构建入口：

```bash
npm run build:android:debug
```

它会：

- 优先使用 `.tools/microsoft-jdk-21/` 下的完整 JDK 21
- 自动把 `GRADLE_USER_HOME` 指到更稳的本地缓存目录
- 同步 `web/` 到 `docs/` 和 Android Web 资源
- 调用 `android/gradlew.bat assembleDebug`
- 校验 APK 内是否包含当前关键 Web payload、PWA 预缓存清单和代码标记

生成 APK：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

当前最近一次验证 APK SHA256：

```text
18AB40BBF01C2CA5D6DF776C41857566420CE09CDFB3AC326F419C720B9CF4CC
```

### 安装 / 启动验证

默认安装启动验证：

```bash
npm run verify:android:debug
```

它会：

- 自动解析 `adb`
- 没有在线设备且本机只有一个 AVD 时，自动启动该 AVD
- 安装 debug APK
- 冷启动 `com.ember.roguelike/.MainActivity`
- 确认应用进程仍在、焦点窗口属于游戏
- 保存首屏截图到 `output/android-smoke/app-launch.png`
- 扫描启动后的 WebView / JS / Capacitor 致命错误
- 如果脚本自动启动了模拟器，验证结束后自动关闭

本机当前 `android/local.properties` 指向的 SDK 缺 `adb.exe`；最近一次安装 / 冷启动验证通过临时把 `C:\Users\24560\Desktop\study\kaoyandemo\.android-sdk\platform-tools` 放入 PATH 完成，验证包 SHA256 为：

```text
18AB40BBF01C2CA5D6DF776C41857566420CE09CDFB3AC326F419C720B9CF4CC
```

完整点击流 smoke：

```bash
npm run verify:android:smoke
```

它会在默认启动验证基础上继续点击：

- `开始远征`
- `开始战斗`

并确认 APK 能进入局内战斗。截图会保存到：

```text
output/android-smoke/app-launch.png
output/android-smoke/character-select.png
output/android-smoke/gameplay.png
```

当前本机 `NightRunner35` Android 模拟器已经完成：

- APK 安装成功
- 冷启动成功
- 焦点窗口检查通过
- 点击进入角色选择和局内战斗通过
- logcat fatal-error scan 通过
- 当前验证包已包含第 19 波锻造后转入 Boss 前营火；`烟幕疾行` 现在除了高波极端 safety 缺口，也会在第 20 波以后机动性短板明显时出现
- 当前验证包也包含战前营火推荐标签与建议文案，且 verifier 会在 AVD `sys.boot_completed` 后额外等待 8 秒再启动检查
- verifier 的 Android 点击 smoke 现在会对菜单和角色选择页使用多候选点击点位，降低 HUD / 按钮布局微调后脚本立刻失效的概率

如果不走这个脚本，再手工执行时要注意：

- JDK 17 不够，当前 Android 链需要完整 JDK 21+
- 仅有 `javac` 但缺 `jlink` 的精简运行时也不够

手工备用流程：

```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

手工构建后仍建议回到仓库根目录执行 `npm run verify:android:debug` 或 `npm run verify:android:smoke`，避免只确认“能打包”但没有确认“能安装、能启动、能进局内”。

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
