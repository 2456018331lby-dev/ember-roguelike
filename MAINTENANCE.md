# 余烬 Ember - 维护与接手文档

最后更新：2026-06-06（本轮继续修高波 Boss 前 safety 和读招可读性：极低最大生命的脆皮构筑现在会在压力模型中记录 `fragilityDebt`，第 25 波等高波 Boss 前选择 `烟幕疾行` 时可附带 1 次 `残影保命`；临时防死现在记录来源，护符仍显示金色 `护符 1`，烟幕残影显示蓝色 `残影 1`，触发文案也会区分“余烬护符碎裂”和“烟幕残影散尽”。本轮新增高波 Boss 左上读招面板，会显示当前阶段技能名和蓄力百分比；debug snapshot 同步暴露 `bossPatternLabel` / `bossCharge`，视觉 smoke 会断言这些字段存在；service worker 预缓存改为逐资源容错，避免 Android WebView 因 `Cache.addAll` 内部错误产生启动期 fatal log。对应已跑过 core 回归、Boss checkpoint、Web smoke、视觉回归、Playwright 高波读招检查、Android debug APK 构建和 `NightRunner35` 模拟器点击 smoke，并已同步 `web -> docs -> android`；当前 `boss-checkpoints` 最新结果为 `baseline avgWave 18.68`、`smart avgWave 23.75`，其中 smart 第 5 波 `60/60` 通过、第 25 波到达 `51/60`、通关 `48/60`，且 smart 已无 max-tick 卡局。最新 debug APK SHA256 为 `8D104114BB89AA0E3AB5BC19FA5233383257B3195D42835D7ACC22E222F758C2`。前序记录中的职业身份、早期敌压、阶段压力环、延迟 `aimed_burst`、Boss 前营火链路、护符 HUD、竖屏布局、视觉像素回归、参考图竞技场背景、沉浸式 Android 外壳与 Web smoke / APK 内容校验仍继续成立）

本文件给下一个继续维护的人或 AI，用来快速判断三件事：

- 这个项目当前已经稳定到什么程度
- 哪些链路已经有实证，哪些仍然只是方向
- 下一步应该优先动哪里，避免重复踩坑

---

## 1. 项目目标

当前目标不是“做个能跑的 demo”，而是持续把它推进成一个可直接玩、可继续扩展、可继续封装 Android 的 Arena Roguelike。

目标标准：

- 核心卖点是“献祭构筑 + 波次风险 + Boss 前准备”
- `web/` 作为主开发面长期存在
- 前端需要持续从原型感往正式游戏界面推进
- `web/src/game_core.mjs` 继续保持纯逻辑、可被 Node 驱动验证
- Android 端通过 Capacitor 打包为 APK

---

## 2. 当前仓库结构

```text
roguelike-game/
├── web/                          # 源码主目录，优先改这里
│   ├── index.html
│   ├── styles.css
│   └── src/
│       ├── game_core.mjs         # 纯玩法逻辑
│       ├── main.mjs              # UI 渲染、菜单、HUD、奖励页
│       ├── presentation.mjs      # 结构化展示接口
│       ├── audio.mjs
│       ├── save.mjs
│       └── characters.mjs
├── docs/                         # 发布镜像，来自 web/
├── android/                      # Capacitor Android 工程
├── scripts/
│   ├── sync-web.mjs              # web -> docs -> android 资源同步
│   ├── serve-web.mjs             # 本地 Node 静态服务，正确返回 .mjs MIME
│   ├── web-smoke.mjs             # 无依赖 Web/PWA 资源、缓存、MIME smoke test
│   ├── visual-smoke.mjs          # 无 npm 依赖 Chrome CDP 桌面/移动端视觉 smoke
│   ├── visual-regression.mjs     # 解码 visual-smoke PNG 并和像素基线对比
│   ├── build-android-debug.ps1   # 自动同步资源 + 选择 JDK 21 + 构建 APK + 校验 APK Web 资源
│   └── verify-android-debug.ps1  # adb 安装/启动 APK + 进程、截图和 logcat fatal scan
├── tests/
│   ├── baseline_sim.mjs
│   ├── smart_sim.mjs
│   └── game_core.test.mjs
├── package.json
├── RELEASE_PLAN.md
└── docs/next-phase-plan.md
```

重要原则：

- 永远先改 `web/`，不要先手改 `docs/`
- `docs/` 和 Android 资源应通过同步脚本得到
- UI 可以继续大改，但不要把玩法推导逻辑塞回 `main.mjs`
- Android 链路的问题优先区分是“资源同步问题”还是“JDK/Gradle 环境问题”

---

## 3. 当前已经完成的关键工作

### 玩法和波次

- 修掉了近战敌人前摇与重复伤害的关键 bug
- 修掉了生命献祭重复吞最大生命的基线 bug
- Boss 延时弹幕已改成模拟内调度，不再依赖真实 `setTimeout`
- 第 20 / 25 波恶魔领主第三阶段 `aimed_burst` 现在先预警后释放，并把连射间隔从 `1.4s` 拉到 `1.5s`
- 奖励阶段已有重随机制 `rerollRewardChoices(run)`
- 波次已经档案化，至少包含 `kind / label / danger / rewardBias / risk / summary` 等字段
- 非 Boss 波次已经有更多层次：`hunt / recovery / onslaught / elite / siege`
- 波次 3 与之后每 8 波会出现“余烬锻造”事件波
- 已加入 `稳健 / 标准 / 试炼` 三档难度；标准保持当前模拟基线，稳健降低敌压并提高角色容错，试炼提高压迫感和分数回报
- 角色自动攻击已按职业拆开：战士 `melee_lunge`、法师 `arcane_orb`、游侠 `knife_fan`、死灵 `soul_bolt`
- 早中期部分小怪已从纯贴脸改成 `skirmish / hybrid / lobber` 行为，能在保留近战威胁的同时给出远程弹幕压力
- 首个 Boss 前奖励推荐已从“只补生存”调整为“同时检查单体输出缺口和生存缺口”
- 早期高风险自毁牌（例如 `末日`、首个 Boss 前的 `玻璃炮`）不再被自动推荐为最优解，仍保留为玩家主动豪赌选项
- `末日` 诅咒的倒计时现在从拿牌时开始，避免中后期拿到后因为整局 `gameTime` 已超过 45 秒而立刻死亡
- 波中“诅咒商人”事件奖励已改为走统一奖励筛选，并明确给无献祭代价的事件奖励，避免隐藏代价和状态不同步
- `tests/game_core.test.mjs` 已加入核心状态机无出口回归检查，覆盖所有难度、seed 1..30、至少推进到第 10 波；奖励、锻造、商店、营火等决策状态必须有可点击/可选择出口
- `simulateAutoRun()` 不再静默跳过空的锻造、商店、营火或奖励选择；如果决策状态没有选择项，测试会直接失败，避免同类卡死被自动模拟掩盖
- 默认战士已补上中距离追击能力，首个 Boss 不再因为“接敌判定断层”长时间罚站
- Boss 当前位置现在会被限制在场内，避免站桩近战把首领拖出可战斗区域造成无伤拉扯
- 普通远程敌人已加入“入场后场内约束”：刚从场外刷出时仍保留自然入场节奏，但已入场或异常场外超时后会被拉回可战斗区域，避免弓箭手等 ranged AI 在边界处退到近战永远够不到的位置
- 首个 Boss 前如果单体输出缺口极大，奖励保底会从 1 张可靠输出提高到 2 张，避免生存保底挤掉全部输出补强

### Boss 前流程

- 第 4/9/14/24 波奖励后会进入 `rest`
- 第 19 波事件锻造结束后，如果下一波是 Boss，也会补一个战前营火，避免直接裸进第 20 波
- `rest` 已真实接进主循环，不再是代码里悬空状态
- Boss 前奖励点击卡住的根因是：`applyCardChoice(run, card)` 已把核心状态切到 `rest`，但前端按钮只隐藏奖励层，没有立刻渲染战前营火；现在所有覆盖层点击后统一走 `syncOverlayForRunState`
- 余烬锻造点击卡住已修复：前端现在正确导入并绑定 `applyForgeChoice`，商店同理补齐 `applyShopChoice`
- 战前营火已加入 6 个方向：
  - 治疗
  - 冥想
  - 训练
  - 余烬护符
  - 烟幕疾行
  - 豪赌
- `余烬护符` 只在第 15 波以后 Boss 前且 safety 缺口明显时出现，给下一波临时护盾和一次致命伤保底；每次新波次开始会清理旧护符，避免永久堆叠
- `烟幕疾行` 在第 20 波以后、Boss 前如果 safety 缺口极大，或机动性短板明显时都会出现，给下一波临时移速、闪避和 Boss 开场迟滞；第 25 波等高波脆皮构筑会额外给 1 次 `残影保命`，来源写入 `tempDeathWardSource = 'smoke'`
- 战前营火选项现在也会带 `fitScore / fitHint / decisionLabel`，前端会直接把 `本轮首选 / 保命 / 高分豪赌` 等建议打到卡面上
- 护符生效时 HUD 会显示 `护符 1`，玩家身上会出现金色护符环；烟幕残影会显示 `残影 1` 和蓝色残影环，避免玩家把两种临时防死来源混淆
- “豪赌”会在下一波开战前真实扣血，再给一张更契合下一波的高品质卡

### 构筑解释与前端信息层

- `presentation.mjs` 已承担展示边界
- HUD 已从密集文本墙重构为更容易扫读的 chips/pills
- 奖励页、锻造页、商店页、营火页都有更完整的卡片结构
- 奖励页已能突出最高契合选项，并区分“本轮首选 / 豪赌 / 稳血线 / 备选”等决策标签；卡片底部固定展示风险代价，减少只看单卡名字误选
- 构筑短板阈值已从固定开局阈值升级为随波次成长的压力目标；`singleTarget / aoe / sustain / safety` 会保存当前强度、目标和缺口，奖励提示与死亡复盘共用这套解释
- 奖励、锻造、商店和 Boss 前营火选择会写入 `decisionLog`，结算页显示最后几次关键选择，方便回看阵亡前路线是否误选
- 主菜单、角色选择页、结算页已有更明确的视觉层次
- 移动端主菜单首屏已压缩信息密度，`开始远征` 按钮在 390x844 视口下无需滚动即可点击
- 角色选择页和战斗内玩家模型已改用 AI 生成的 4 角色 x 2 动作帧 spritesheet，不再使用圆形/豆形占位角色
- 角色选择页现在会直接展示职业职责、武器、战斗备注和起手流派，锁定职业不再被压到几乎不可读
- HUD 右上角已从单块文本墙整理成分区式“战术读板”，生命条、波次、构筑倾向和危险提示更容易扫读
- 战斗内敌人与 Boss 已接入本地生成的 4x4 spritesheet，普通敌人、远程/支援敌人和三种 Boss 都有独立轮廓；本轮继续加强了 slime / bat / skeleton / golem / archer / fire_mage / healer / summoner 的 silhouette 和细节
- 敌人即将近战、远程射击、支援/召唤和 Boss 蓄力时已有画面提示；核心逻辑发出的链击、爆炸、子弹命中、护盾吸收、自伤、冲刺残影、复活和死亡爆裂等粒子也已接入绘制
- Boss 战已增加根据当前阶段 `pattern` 绘制的危险可见性：竞技场压力环、边界压迫、瞄准 / 环形 / 螺旋 / 十字 / 随机弹雨预览、左上读招面板，以及 Boss 血条阶段阈值刻度；读招面板会显示当前技能名和蓄力百分比
- 顶部生命 HUD 改为紧凑版，减少对第 5 波 Boss 上半身和读招环的遮挡
- 竖屏手机渲染不再把 16:9 竞技场严格居中，而是将战斗区域上移到屏幕中段；这让活跃 Boss、玩家和读招环更靠近 HUD 与消息之间的可视区
- `createDebugBossFight()` 已加入 core，可构造固定第 20 波 Boss 场景，回归高波护盾、护符、侧翼火力与首领阶段压迫感
- 奖励排序已开始考虑：
  - 当前 build 倾向
  - 当前/下一波风险
  - 生存缺口与输出缺口

### 平台链路

- `scripts/sync-web.mjs` 已可稳定同步 `web -> docs -> android`
- 之前 Python 静态服务的 `.mjs` MIME 问题已绕开
- `scripts/serve-web.mjs` 已提供正确的本地 Node 静态服务
- `scripts/web-smoke.mjs` 已建立无依赖 smoke test，可验证 spritesheet 尺寸/内容、敌人图集格子、service worker 预缓存覆盖和离线 fallback、本地 MIME、UI 状态路由，以及 `game_core.mjs` 发出的粒子类型是否都有 `drawParticles` 覆盖
- `scripts/visual-smoke.mjs` 已建立无 npm 依赖视觉 smoke，可用本机 Chrome/Edge 验证桌面/移动端菜单、角色选择、战斗 canvas 非空、奖励选择页推荐卡渲染、Boss 前奖励点击后进入营火、营火选择后进入第 5 波 Boss，并额外保存桌面和移动端活跃首领战 `boss-fight-*.png`，以及固定的高波桌面场景 `boss-fight-highwave-desktop.png`；高波样本会断言 debug snapshot 中存在当前 `bossPatternLabel` 和 `bossCharge`
- `scripts/visual-regression.mjs` 已建立 PNG 解码后的像素回归：角色选择等稳定界面使用严格 RGBA 哈希，菜单和动画界面使用亮度、RGB 均值、暗/亮/饱和像素比例容差；基线在 `tests/visual-regression-baseline.json`，包含桌面/移动端活跃 Boss 战截图和高波桌面样本
- `scripts/generate-art-assets.mjs` 默认保留现有角色 spritesheet，避免误运行后覆盖 AI 人物资源；同时会重生成参考图风格竞技场背景和敌人 / Boss spritesheet
- `web/src/main.mjs` 会按背景图原始比例居中裁切绘制竞技场 PNG，因此后续直接替换 `web/assets/arena-ember-fortress.png` 不会被拉伸；它也会优先使用敌人 spritesheet，加载失败时仍回退到 SVG 符号和圆形占位
- `web/sw.js` 已预缓存 `main.mjs` 的静态模块依赖和核心美术资源；替换同名 PNG 或修改核心脚本后必须提升 `CACHE` 版本，避免 PWA/Android WebView 继续命中旧缓存；预缓存必须逐资源容错，不能使用 `cache.addAll()`，否则 Android WebView 可能因单个 Cache 内部错误产生启动期 fatal log；fetch handler 只拦截同源 GET，离线 cache miss 会返回明确 Response，避免 WebView console 噪声
- `web/index.html` 不再依赖 Google Fonts 外链，Android / PWA 离线环境不会因为外部字体请求污染 logcat 或首屏加载
- Android `assembleDebug` 已在本机成功跑通过一次
- `scripts/build-android-debug.ps1` 已建立，负责选择可用 JDK 21、同步资源、构建 APK，并校验 APK 内关键 Web 资源和代码标记
- `scripts/verify-android-debug.ps1` 已建立，负责解析 `adb`、安装 debug APK、启动 `MainActivity`、确认进程仍在、保存首屏截图，并扫描启动后的 WebView/JS 致命错误
- `npm run verify:android:debug` 现在会在没有在线设备且本机只有一个 AVD 时自动启动该 AVD，并在验证后关闭；`npm run verify:android:smoke` 会额外点击进入角色选择和局内战斗
- Android 原生外壳已改为沉浸式游戏窗口：`MainActivity` 会重复应用深色/隐藏系统栏，Android 启动主题和窗口背景也已设为游戏黑色，避免首屏顶部残留浅色系统栏

---

## 4. 2026-06-06 当前实证状态

### 已验证命令

```bash
npm test
npm run test:boss-checkpoints
npm run test:web-smoke
npm run test:visual-smoke
npm run test:visual-regression
npm run verify:android:debug
npm run verify:android:smoke
npm run assets:generate
node tests/baseline_sim.mjs
node tests/smart_sim.mjs
node scripts/sync-web.mjs
npm run build:android:debug
npm run serve
```

### 当前验证结果

- `baseline_sim`：
  - `avgWave = 18.45`
  - `wave5failSeeds = 1 / 60`（seed 39，站桩 baseline 仍会在第 5 波输出/容错双缺口时失败）
  - 站桩 baseline 仍是保守压力参考，不等同真实玩家操作；smart 策略已稳定通过首个 Boss
- `smart_sim`：
  - `avgWave = 22.68`
  - `wave5failSeeds = 0 / 60`
- `npm run test:boss-checkpoints`：
  - baseline：第 5 波 `59/60` 通过；第 10/15/20 波 Boss 死亡分别为 `0 / 2 / 13`
  - smart：第 5 波 `60/60` 通过；第 10/15/20/25 波 Boss 死亡分别为 `1 / 1 / 1 / 3`，第 25 波到达 `51/60`，通关 `48/60`
  - smart `maxTickStops = []`，历史 seed 59 场外弓箭手卡局已消失，当前该 seed 可推进到胜利
  - 当前最集中的短板标签仍是 `safety`；第 20/25 波 Boss 仍是下一轮主要平衡对象，不建议为站桩 baseline 的单个第 5 波失败继续削弱首个 Boss
- `npm test`：
  - `tests/game_core.test.mjs` 全部通过
  - 已新增覆盖：高压 `aimed_burst` 必须先出现预警，再延迟发射弹幕
  - 已覆盖 `末日` 诅咒从拿牌时开始倒计时，中后期拿牌不会因整局时间已超过 45 秒而立刻判死
  - 已覆盖中后期 Boss 前 safety 缺口会生成 `余烬护符`，并验证护符能抵消一次致命伤且触发后会消耗
  - 已覆盖第 19 波事件锻造若下一波是 Boss，会转入战前营火而不是直接裸进第 20 波
  - 已覆盖高压 Boss 前 `烟幕疾行` 的生成、移速/闪避增益和首个生成敌人的开场减速
  - 已覆盖第 15 波满血高安全缺口时，营火推荐应偏向 `余烬护符` 而不是 `战斗训练`
  - 已覆盖第 20 波低机动高压场景时，`烟幕疾行` 评分应压过 `战斗训练`
  - 已覆盖第 20 波即使 safety 缺口不大、但机动性明显不足时，也应出现 `烟幕疾行`
  - 已覆盖中后期压力目标会随波次提高，并验证死亡复盘会输出数值缺口和最后决策
  - 已覆盖中后期 Boss safety 缺口较大时，复活安全网应压过继续堆输出，同时不破坏首个 Boss 输出缺口优先级
  - 已覆盖早期 `末日` 降权，以及中后期 Boss / survival 场景里 `末日` 不应压过 `凤凰余烬` 这类安全网牌；首个 Boss 前输出缺口推荐、极大单体缺口双输出保底、`玻璃炮` 与吸血续航排序、历史第 5 波失败 seed 回归也仍保留
  - 已覆盖普通远程敌人不能退到场外导致波次无法结束
  - 已覆盖核心状态机无出口检查：`reward / forge / shop / rest` 必须有选择项或离开项，并能在 `steady / standard / trial`、seed 1..30 下至少推进到第 10 波
  - `simulateAutoRun()` 会断言锻造、商店、营火和奖励选择非空，不再把空状态当成可继续的自动流程
- `npm run test:web-smoke`：
  - spritesheet 尺寸、非空像素和敌人图集关键格子通过
  - service worker 预缓存覆盖所有静态导入模块和美术资源
  - service worker 只拦截同源 GET，离线 cache miss 会返回 `Response`，不会让 `respondWith()` 收到 `undefined`
  - service worker 不再使用 `cache.addAll()`；Web smoke 会断言逐资源 `cache.add(asset)`、install 容错和 runtime cache write 容错，避免 Android WebView cache 内部错误变成 fatal log
  - 前端 UI handler 依赖的 `applyForgeChoice`、`applyShopChoice`、`getDifficultyPresets` 等 core 绑定通过
  - 奖励 / 锻造 / 商店 / 营火点击 handler 必须走 `syncOverlayForRunState({ resumeIfPlaying: true })`，防止核心状态变化后 UI 覆盖层不刷新
  - `game_core.mjs` 发出的核心战斗粒子类型均有 `drawParticles` case 覆盖
  - 本地 Node 服务 MIME 返回通过
- `npm run test:visual-smoke`：
  - 桌面菜单、角色选择、局内 canvas、奖励选择页、Boss 前营火、第 5 波 Boss 进入、桌面/移动端活跃 Boss 读招画面，以及固定第 20 波高波 Boss 桌面场景渲染通过
  - 固定第 20 波高波样本会断言 debug snapshot 中存在 `bossPatternLabel` 和 `bossCharge`
  - 移动端菜单、角色选择、局内 canvas、奖励选择页和 Boss 前营火渲染通过，无水平溢出
  - 移动端局内摇杆与闪避按钮可见
  - 参考图风格竞技场背景已在桌面/移动端局内截图中渲染；移动端角色选择底部按钮不再在“标准”中间断行
  - 奖励选择页会通过本地 `?debug=1` 测试钩子固定进入 Boss 前奖励场景，验证最高契合卡有 `card-recommended` 样式、决策标签和风险代价；随后点击奖励必须出现战前营火，再点击营火必须进入第 5 波 Boss；该钩子仅在 localhost / 127.0.0.1 / ::1 启用
  - 已输出截图到 `output/visual-smoke/`
- `npm run test:visual-regression`：
  - 会先执行视觉 smoke 生成截图，再读取 PNG 像素与 `tests/visual-regression-baseline.json` 对比
  - 当前结果通过；稳定界面用严格像素哈希，动态界面用像素指标容差以避免动画帧误报
- `npm run assets:generate`：
  - 默认保留 `web/assets/ember-characters-spritesheet.png`
  - 生成 `web/assets/ember-enemies-spritesheet.png`
  - 生成参考图风格 `web/assets/arena-ember-fortress.png`，包含中心法阵、熔岩裂隙、边缘城墙、台阶、角塔和冷热光源
  - 已验证角色 spritesheet hash 在运行前后不变
- 本地静态服务：
  - `http://127.0.0.1:5173/src/main.mjs`
  - 返回 `200`
  - `Content-Type = text/javascript; charset=utf-8`
- 浏览器可视验证：
  - 1365x768 菜单首屏按钮可见
  - 390x844 移动端菜单首屏按钮可见
  - 角色选择页已显示稳健 / 标准 / 试炼三档难度，开始按钮可见
  - 角色选择页载入 AI spritesheet
  - 局内 canvas 已显示新战士模型
  - 局内 canvas 已显示敌人 spritesheet，资源请求包含 `ember-enemies-spritesheet.png`
  - 局内 combat feedback 检查 5 秒无 console error，canvas 非空，截图保存到 `output/playwright/ember-combat-feedback-live.png`
  - Playwright 加速跑到第 3 波锻造，点击锻造卡后已进入第 4 波，截图保存到 `output/playwright/ember-forge-click-fixed.png`
  - Playwright MCP 验证 `开始远征 -> 开始战斗 · 标准 -> 局内 HUD/canvas`：`hudVisible = true`，`hpText = 120 / 120`，`waveText = 第 1 / 25 波`，canvas 非空采样 `1031`，无水平溢出；截图保存为 `.playwright-mcp/ember-arena-gameplay-after-background.png`
  - Playwright MCP 通过 `?debug=1` 跳转第 20 波高波 Boss：snapshot 返回 `bossPatternLabel = 螺旋弹幕`、`bossCharge ≈ 0.89`，canvas 非空采样 `920`；截图保存到 `output/playwright/boss-readout-highwave-desktop.png`
- 难度抽样（30 seeds，自动选牌）：
  - `steady`：`avgWave = 19.00`，`worst = 10`，`wave5Fails = 0`
  - `standard`：`avgWave = 18.20`，`worst = 9`，`wave5Fails = 0`
  - `trial`：`avgWave = 16.90`，`worst = 5`，`wave5Fails = 3`
- Android 资源同步：
  - `node scripts/sync-web.mjs` 可正常执行
  - `cap sync android` 已在同步链里完成
- Android 构建：
  - `npm run build:android:debug` 当前返回成功
  - APK 路径：`android/app/build/outputs/apk/debug/app-debug.apk`
  - 当前 APK SHA256：`8D104114BB89AA0E3AB5BC19FA5233383257B3195D42835D7ACC22E222F758C2`
  - 构建脚本会自动验证 APK 内容，避免 Web 修复没有同步进 Android 包
  - 已验证 APK 内包含当前 Web 资源关键标记：
    - `assets/public/index.html` 含 `Arena Roguelike`
    - `assets/public/styles.css` 含 `signal-chip` 与 `card-score`
    - `assets/public/src/main.mjs` 含 `renderBuildSummary`
    - `assets/public/src/main.mjs` 含 `applyForgeChoice`、`applyShopChoice` 与难度 UI
    - `assets/public/src/main.mjs` 含 `syncOverlayForRunState` 和 `card-recommended`
    - `assets/public/sw.js` 含 versioned `ember-vN` cache、静态模块预缓存清单和逐资源 cache 容错
    - `assets/public/sw.js` 含同源 fetch guard、runtime cache write 容错和离线 504 fallback
    - `assets/public/assets/ember-enemies-spritesheet.png` 存在
- Android 模拟器安装 / 启动 / 点击流：
  - 命令：`npm run verify:android:smoke`
  - 当前验证 APK SHA256：`8D104114BB89AA0E3AB5BC19FA5233383257B3195D42835D7ACC22E222F758C2`
  - 结果：APK 安装成功，`com.ember.roguelike/.MainActivity` 冷启动成功
  - 没有在线设备时，脚本已自动发现唯一 AVD `NightRunner35` 并启动，验证后自动关闭
  - emulator `sys.boot_completed` 后会额外等待 8 秒再启动验证，减少冷启动期误报 `ActivityManager` ANR
  - 焦点窗口确认属于 `com.ember.roguelike`
  - 应用进程启动后仍在运行
  - Android 点击流已到局内战斗
  - logcat fatal-error scan 通过；扫描保留本应用 ANR/FATAL 和 JS console 错误，忽略无包名的系统 Chromium/Cronet 外部网络噪声
  - 首屏截图：`output/android-smoke/app-launch.png`
  - 角色选择截图：`output/android-smoke/character-select.png`
  - 局内截图：`output/android-smoke/gameplay.png`

### 当前明确未作为完成证据的项

- 已有 Android 模拟器安装 / 启动 / 点击流证据，但还没有实体真机复测
- 浏览器视觉 smoke 和初版像素回归都已接入；后续可继续把更多动态界面收紧成更细粒度的区域基线

---

## 5. Android 构建的真实情况

这部分很重要，因为之前文档已经过时。

### 之前踩到的问题

- Gradle transform cache 在较深路径下移动失败
- 系统 JDK 只有 17，导致 `invalid source release: 21`
- PyCharm 自带的 JBR 21 缺 `jlink`，导致 `JdkImageTransform` 失败

### 当前可行方案

- 优先使用完整 JDK 21+
- 本仓库已存在本地候选目录：
  - `.tools/microsoft-jdk-21/...`
- 构建脚本会检查：
  - `javac.exe`
  - `jlink.exe`
  - Java 主版本是否 `>= 21`
- 构建完成后还会检查 APK 中的 Web payload：
  - `index.html`、`styles.css`、`sw.js`
  - `src/main.mjs`、`src/game_core.mjs`、`src/save.mjs`
  - 角色、敌人和竞技场核心 PNG 资源
  - 锻造/商店 handler、三档难度 UI、敌人图集和 service worker 预缓存标记
  - 首个 Boss 奖励推荐、波中事件奖励筛选等 `game_core.mjs` 平衡标记
- Gradle 用户目录使用较短路径：
  - 默认 `C:\tmp\gradle-ember`

### Android 安装 / 启动验证

新增命令：

```bash
npm run verify:android:debug
```

脚本会自动从这些位置找 `adb.exe`：

- PATH
- `android/local.properties` 中的 `sdk.dir`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `%LOCALAPPDATA%\Android\Sdk`

验证内容：

- debug APK 是否存在
- 是否存在在线设备或模拟器
- `adb install -r -d` 是否成功
- `com.ember.roguelike/.MainActivity` 是否能启动
- 启动后 `pidof com.ember.roguelike` 是否仍有进程
- `output/android-smoke/app-launch.png` 是否能保存首屏截图
- 当前焦点窗口是否属于 `com.ember.roguelike`，避免系统弹窗截图被误判为成功
- 启动后的 logcat 是否出现 `FATAL EXCEPTION`、JS `TypeError/ReferenceError/SyntaxError`、资源加载失败或 WebView 致命错误

如果没有在线设备，可以传入 AVD 名称：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-android-debug.ps1 -AvdName <你的AVD名称>
```

### 维护要求

- 不要再假设“装了任意 Java 就能打包 Android”
- 如果以后构建重新失败，先查 JDK 是否完整，再查 Gradle 缓存路径
- 如果 `web/` 有改动，确保先同步资源，再看 APK 内容
- Android 外壳如果再次出现浅色系统栏，先检查 `android/app/src/main/java/com/ember/roguelike/MainActivity.java` 的 `applyGameSystemBars()` 和 `android/app/src/main/res/values/styles.xml` 的启动主题背景

---

## 6. 现在最值得继续推进的事情

### 高优先级

1. 继续用 `npm run test:boss-checkpoints` 观察第 10/15/20/25 波 Boss 和中后期构筑失控，不要再把第 5 波当成唯一问题
2. 继续增强“构筑解释力 -> 奖励推荐 -> 死亡复盘”的闭环
3. 继续扩展 `npm run test:visual-regression` 的区域级基线；现阶段它已覆盖视觉 smoke 截图的严格哈希和像素指标回归
4. 在实体真机上复测 APK 安装启动和点击进入局内战斗；模拟器点击流 smoke 已接入
5. 后续如果再新增覆盖层或决策状态，先补 `game_core.test.mjs` 的无出口状态机检查，再接 `web-smoke` 的 UI 路由静态守卫

### 中优先级

1. 继续提高奖励页稀有卡、协同触发和高风险高回报选择的动态反馈
2. 让结算页更像复盘，不只是结果罗列
3. 扩更多非 Boss 岔路，而不是继续补基础框架
4. 让图鉴从数据列表升级为内容页

### 低优先级

1. Steam / PC 打包路线
2. 更重的美术资源替换
3. 更完整的动画、音效分层与手柄支持

---

## 7. 下一步建议顺序

1. 如果是继续玩法维护：
   - 先看 `web/src/game_core.mjs`
   - 然后跑 `node tests/smart_sim.mjs`
   - 再用固定失败 seed 定向排查
2. 如果是继续前端维护：
   - 先看 `web/src/main.mjs` 和 `web/styles.css`
   - 保持 `presentation.mjs` 作为结构化数据边界
   - 优先改“可解释性”和“可读性”，不是纯装饰
3. 如果是继续平台维护：
   - 先跑 `node scripts/sync-web.mjs`
   - 再跑 `npm run build:android:debug`
   - 读取脚本输出里的 `APK verified` 和 `APK SHA256`，确认 APK 里资源是最新的
   - 最后跑 `npm run verify:android:debug`，确认 APK 能在设备或模拟器上安装启动
   - 需要证明可进入局内时跑 `npm run verify:android:smoke`

---

## 8. 常用命令

```bash
# 逻辑模拟
node tests/baseline_sim.mjs
node tests/smart_sim.mjs

# 同步资源
node scripts/sync-web.mjs

# 本地浏览器验证
npm run serve

# 桌面/移动端视觉 smoke
npm run test:visual-smoke
npm run test:visual-regression

# 中后期 Boss 检查点模拟
npm run test:boss-checkpoints

# Android Debug APK
npm run build:android:debug
npm run verify:android:debug
npm run verify:android:smoke
```

---

## 9. 接手提醒

- `web/` 是源码，`docs/` 是镜像
- `MAINTENANCE.md` 和 `docs/next-phase-plan.md` 每次大改后都要同步
- 不要回退无关改动
- 不要把 Android 构建失败直接归因到 JS；先检查 JDK 与 Gradle
- 目前最真实的剩余平台风险，不是“构建不了”，而是“每次重大改动后都要重新跑一次真机或模拟器安装验证”
