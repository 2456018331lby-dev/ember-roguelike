# 余烬 Ember

融合卡牌构筑、献祭代价和肉鸽生存的小游戏原型。

## 当前可玩版本

Web / 手机浏览器测试版：

https://2456018331lby-dev.github.io/ember-roguelike/

手机打开后可以通过浏览器菜单“添加到主屏幕”，会像 App 一样全屏启动。

## 当前测试版内容

- 献祭模式 MVP
- Boss 前战前营火：休整 / 训练 / 余烬护符 / 烟幕疾行 / 豪赌
- 左下虚拟摇杆移动
- 自动攻击最近敌人
- 每波清空后 3 选 1 卡牌奖励
- 每张卡牌都有献祭代价
- 连续牺牲同一属性 3 次触发极端化效果
- 小丑牌 / 被动牌 / 攻击牌基础体系
- 稳健 / 标准 / 试炼三档难度
- 事件波后的余烬锻造可升级、净化或重铸卡牌
- 四个角色现在已有明确自动战斗身份：战士近战突进、法师奥术球溅射、游侠飞刀扇射、死灵噬魂咒弹
- 小怪不再只靠贴脸吃伤害：史莱姆 / 蝙蝠 / 骷髅 / 石像鬼等早中期敌人已有 skirmish / hybrid / lobber 型弹幕压力
- 已重做菜单 / 角色选择 / HUD 信息层，角色页会直接展示职业职责、武器、战斗备注和起手流派
- 已替换 AI 生成角色 spritesheet，战斗与角色选择共用同一套人物图
- 已新增并继续强化本地生成的敌人 / Boss spritesheet：小怪 silhouette、法系/支援敌人和 Boss 的威胁轮廓更清晰，战斗中优先使用图集，保留 SVG 兜底
- 已重做参考图风格的城堡竞技场背景：石板裂隙、中心法阵、边缘墙体、台阶、角塔和冷热光源都由资源脚本稳定生成
- 已补全核心战斗粒子绘制：链击、爆炸、子弹命中、护盾吸收、自伤、冲刺残影、复活和死亡爆裂都有画面反馈
- 奖励页会突出本轮首选、豪赌/稳血线等决策标签，并把契合分、风险代价、标签和建议分层展示
- 战前营火现在也会基于下一波压力给出推荐标签与建议文案，避免满血时仍无脑偏向训练
- 构筑短板目标会随波次成长，奖励提示和死亡复盘会显示当前强度 / 目标强度 / 缺口，不再只用开局阈值判断中后期
- `末日` 等高风险诅咒保留强爆发路线，但倒计时从拿牌时开始结算，不会因中途拿牌立刻判死
- 结算页会记录最后几次关键选择，帮助判断是输出、清场、续航、安全网还是路线选择导致阵亡
- 第 15 波以后的 Boss 前夜如果安全网缺口明显，会出现 `余烬护符`，为下一波提供临时护盾和一次致命伤保底
- 第 20 波以后如果 safety 缺口极大，或机动性明显不足，还会出现 `烟幕疾行`，为下一波提供临时移速、闪避和开场控场；第 25 波这类高波脆皮构筑还会附带 `残影保命`，HUD 会用蓝色残影环和 `残影 1` 区分它与金色护符
- 中后期 Boss / survival 场景下，`末日`、`衰败` 这类高风险诅咒会被更明显地下调推荐权重，减少它们压过安全网牌的误导性推荐
- Boss 前奖励点击后会自动进入战前营火；第 19 波事件锻造在下一波是 Boss 时也会转入营火，再继续进入高波 Boss 链路
- 战士不会再像远程职业那样站桩白打：现在会主动追击中距离目标；Boss 与普通远程敌人都已纳入可战斗区域约束，避免首领或弓箭手退到场外导致近战无法收尾
- 首个 Boss 前如果单体输出缺口极大，奖励池会保底提供两张可靠输出选择，同时保留必要生存位，减少前 4 波误堆纯防御后进入第 5 波输出不足的概率
- Boss 战画面已补上阶段压力环、弹幕形状预览、分区式战术读板和更紧凑的顶部生命 HUD，减少首领读招被界面遮挡的问题
- 第 20 / 25 波恶魔领主第三阶段的 `aimed_burst` 现在会先给出真实预警，再延迟释放；高压连射间隔也略微拉长，减少“预警即命中”的不公平感
- 竖屏手机战斗画面已把 16:9 竞技场上移，减少 HUD 和战斗之间的空白区，保留底部消息和触控按钮空间
- 已加入固定的第 20 波 Boss 调试场景，用来回归高波护盾、护符、侧翼火力和首领阶段压迫感
- 核心状态机已有无出口回归检查，覆盖奖励 / 锻造 / 商店 / 营火在多难度和多 seed 下都能继续推进
- PWA 离线缓存

## 本地运行

```bash
npm test
npm run test:boss-checkpoints
npm run test:web-smoke
npm run test:visual-smoke
npm run test:visual-regression
npm run serve
npm run build:android:debug
npm run verify:android:debug
npm run verify:android:smoke
```

打开：

```text
http://127.0.0.1:5173
```

说明：

- `npm run serve` 现在使用仓库内的 Node 静态服务，`.mjs` MIME 正确，不再依赖 Python 的默认静态服务器行为。
- `npm test` 会验证核心玩法和平衡回归；其中包含奖励 / 锻造 / 商店 / 营火等决策状态不能进入无出口卡死状态的状态机检查。
- `npm run test:boss-checkpoints` 会跑 baseline / smart 两套 60 seed 模拟，输出第 5/10/15/20/25 波 Boss 检查点、死亡 seed、短板标签和少量死亡样本，方便继续调中后期节奏；当前最近一次结果为 `baseline avgWave 18.68`、`smart avgWave 23.75`，其中 smart 第 5 波 `60/60` 通过、第 25 波到达 `51/60`、通关 `48/60`，且没有 max-tick 卡局。
- `npm run test:web-smoke` 会验证 spritesheet 尺寸/内容、service worker 预缓存清单、本地服务 MIME、UI 状态路由，以及核心逻辑发出的粒子类型是否都被前端绘制，不需要新增浏览器测试依赖。
- `npm run test:visual-smoke` 会用本机 Chrome/Edge 做桌面和移动端视觉 smoke，覆盖菜单、角色选择、局内 canvas、奖励选择页、Boss 前营火、Boss 波进入、桌面/移动端活跃 Boss 战读招画面，以及固定的第 20 波高波 Boss 桌面场景，截图输出到 `output/visual-smoke/`，不需要新增 Playwright/Puppeteer 依赖。
- `npm run test:visual-regression` 会先跑视觉 smoke，再读取 PNG 像素并和 `tests/visual-regression-baseline.json` 对比；角色选择等稳定界面使用严格 RGBA 哈希，动画界面使用像素亮度/色彩比例容差。
- 如果要构建 Android，优先使用仓库脚本 `npm run build:android:debug`；它会同步资源、构建 APK，并校验 APK 内的关键 Web 资源与代码标记。
- `npm run verify:android:debug` 会用 `adb` 安装并启动 debug APK，检查应用进程、首屏截图和启动后的 WebView/JS 致命错误；没有在线设备且本机只有一个 AVD 时会自动启动并在结束后关闭。
- 自动启动 AVD 时，验证脚本会在 `sys.boot_completed` 后额外等待一小段时间再开始安装与启动，减少冷启动期误报 ANR。
- `npm run verify:android:smoke` 会在 `debug` 验证基础上继续点击 `开始远征 -> 开始战斗`，确认 APK 能进入局内战斗，并保存启动、角色选择、局内三张截图。
- `npm run assets:generate` 默认会保留现有角色 spritesheet，并重生成参考图风格竞技场与敌人 / Boss 图集；如确需恢复占位角色，显式传 `-- --force-placeholder-heroes`。替换同名竞技场 PNG 时，canvas 会按图片比例居中裁切铺满，不会拉伸变形。

## Android APK 构建

当前仓库已经验证过可在本机生成 debug APK，并在本机 `NightRunner35` Android 模拟器完成安装、冷启动、焦点窗口、点击进入角色选择、点击进入局内战斗、截图和 logcat 致命错误扫描。

最近一次验证 APK SHA256：`34BB211096BF2F963EB0ECD5EAA2FED0AC56FAEC87219C037C38A5FFCC7BC1FE`

```bash
npm run build:android:debug
npm run verify:android:debug
npm run verify:android:smoke
```

生成文件：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

补充说明：

- 构建脚本会优先寻找 `.tools/microsoft-jdk-21/` 下的完整 JDK 21。
- 若系统 `JAVA_HOME` 已经指向带 `jlink` 的 JDK 21+，也可直接使用系统环境。
- 构建成功后脚本会检查 APK 内是否包含当前 `index.html`、样式、核心 `.mjs`、PWA 缓存清单和关键美术资源，并输出 APK SHA256。
- 真机或模拟器启动验证依赖 Android SDK `platform-tools`。脚本会从 PATH、`android/local.properties`、`ANDROID_HOME`、`ANDROID_SDK_ROOT` 和常见本机 SDK 目录自动查找 `adb.exe`；如果没有在线设备但只有一个 AVD，npm 验证脚本会自动启动它。
- Android 外壳已改成沉浸式游戏窗口，启动主题和窗口背景使用游戏黑色，避免模拟器/真机顶部残留浅色系统栏。
- 如果当前没有在线设备，可以先手动启动模拟器，或直接运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -AvdName <你的AVD名称>
```

- 启动验证截图会保存到 `output/android-smoke/app-launch.png`。

## 长期方向

1. Web/PWA 继续用于快速验证玩法。
2. 后续可用 Capacitor/Tauri Mobile 把 Web 版本封装成 Android APK。
3. Godot 项目骨架已保留，后续如果需要更强性能、粒子、手柄、Steam 发布，可以继续迁移/并行开发。
4. Steam 方向预留：横屏、键鼠/手柄输入、成就、每日挑战、存档、排行榜。

## 项目结构

- `web/`：当前可玩的 Web/PWA 测试版
- `tests/`：核心玩法逻辑测试
- `GDD.md`：完整游戏设计文档
- `scripts/`, `scenes/`, `data/`：Godot 4 项目骨架
