# Ember 下一阶段执行计划

最后更新：2026-06-08（本轮继续推进“构筑缺口 -> 奖励推荐 -> 战前准备”的前置解释闭环：`presentation.mjs` 新增 `decisionPlanLabel/decisionPlanPriority/decisionPlanDetail/decisionPlanTone/decisionPlanChips`，按下一波类型、危险度和 `singleTarget / aoe / sustain / safety` 最大压力缺口输出“下一波作战计划”。`main.mjs` 新增 `renderDecisionPlan()`，奖励页和 Boss 前营火会在玩家选择前显示下一波标签、危险度 chip、最大缺口和具体建议；Boss 前安全网不足会提示优先拿余烬护符、烟幕疾行、凤凰余烬、屏障或闪避。`styles.css` 补齐 boss/danger/event/elite/normal 状态和移动端堆叠；visual smoke 现在断言奖励页与营火页存在作战计划、压力优先级、chips、无水平溢出，并继续覆盖奖励卡读板、结果页崩盘诱因和时间线；visual regression 通过。PWA cache 提升到 `ember-v23`，并已同步 `web -> docs -> android`。当前 checkpoint 仍为 `baseline avgWave 19.12`、`smart avgWave 23.42`，smart 第 5 波 `60/60` 通过，第 20 波到达 `53/60`，第 25 波到达 `48/60`，通关 `45/60`，无 max-tick 卡局；本轮未改平衡，只把既有压力模型前置到决策界面。本轮 Android debug APK 构建和 payload 校验通过，当前 APK SHA256 为 `7C2C952857949CBBD3CDBDFC1D0D8DE64C48AC43D3BB238DAA8C7B91CE2F97EB`；临时 PATH 可解析 `adb.exe`，但本机仍找不到 `emulator.exe` 且无在线设备，当前 APK 点击流 smoke 需要恢复 Android Emulator 或接入真机后重跑，最近一次通过的模拟器点击流仍是前序 APK `1BCDFAF64F2EDEC1C1C1731E353629C4C6F873024C6CA3FC348B8B5204386D51`。下一步继续补更多波中事件类型、受击/走位来源统计和卡组路线对比，并恢复 Android Emulator 或接入真机后重跑安装/启动/点击流验证。）

这个文件只回答一个问题：下一阶段最值得继续做什么。

---

## 当前阶段已经做完

### 玩法

- 波次已经结构化，奖励开始围绕下一波风险与构筑缺口做提示
- 第 4/9/14/24 波奖励后会进入 Boss 前战前营火；第 19 波事件锻造若下一波是 Boss，也会转入营火
- 战前营火已支持治疗、冥想、训练、余烬护符、烟幕疾行、豪赌
- 第 10 波 Boss 前如果 safety 缺口极高，会提前提供 `余烬护符`；第 15 波以后 Boss 前夜如果 safety 缺口明显，会以更低门槛提供护符
- 第 15 波以后 Boss 前夜如果 safety 缺口明显，会额外提供 `余烬护符`，为下一波提供临时护盾和一次致命伤保底
- 第 20 波以后如果 safety 缺口极大，或机动性短板明显，会额外提供 `烟幕疾行`，为下一波提供临时移速、闪避和 Boss 开场迟滞；第 25 波等高波脆皮构筑还会附带 1 次 `残影保命`
- 护符和烟幕残影生效时 HUD 与玩家身上都有来源明确的可见反馈，护符为金色 `护符 1`，残影为蓝色 `残影 1`
- 豪赌会在开战前真实结算生命代价，并给更契合下一波的高品质卡
- Boss 前奖励点击后会立刻渲染战前营火，不再因为前端覆盖层没跟随 `run.state = rest` 而卡住
- 第 5 波 Boss 已不再是“几乎所有局都卡死”的唯一断点
- 首个 Boss 前如果单体输出缺口极大，奖励会保底两张可靠输出选择，避免生存保底把输出补强全部挤掉
- 普通远程敌人已加入入场后场内约束，避免已入场弓箭手在边界风筝时退到场外造成近战无法收尾
- 第 3 波事件后的余烬锻造点击卡住已修复，并加了回归测试
- 已有稳健 / 标准 / 试炼三档难度，标准保持当前模拟基线
- 首个 Boss 前奖励推荐已同时检查输出缺口和生存缺口，早期 `末日` / `玻璃炮` 这类高风险牌不再被自动当成最优解
- `末日` 诅咒倒计时现在从拿牌时开始，避免中后期拿到后因为整局时间已超过 45 秒而立即死亡
- 波中“诅咒商人”事件奖励已改为统一筛选路径，避免早期绕过评分直接塞入自毁牌
- 核心状态机已加无出口回归检查：奖励、锻造、商店、营火等决策状态在所有难度和 seed 1..30 下必须有选择项或离开项，并能继续推进到第 10 波以上
- 自动模拟不再吞掉空的决策选择；空奖励、空锻造、空商店或空营火会直接让测试失败
- 构筑压力目标会随波次成长，`singleTarget / aoe / sustain / safety` 都会记录当前强度、目标和缺口，避免第 15/20 波仍沿用开局阈值
- 第 8 波以后奖励会额外检查最大压力缺口；当 `singleTarget / aoe / sustain` 的某个短板足够突出时，奖励池会保底出现一张对应修复牌，同时不挤掉已要求的生存牌或首个 Boss 输出保底
- 极低最大生命现在会形成 `fragilityDebt`，降低续航和 safety 评估，避免高闪避/护盾构筑掩盖高波被斩杀风险
- 奖励、锻造、商店和 Boss 前营火选择已进入 `decisionLog`，死亡复盘会显示最后几次关键路线选择；本轮路线影响会解释这些选择补了什么、最终又漏了什么短板
- 奖励页和 Boss 前营火现在会在选择前显示“下一波作战计划”，把下一波标签、危险度、最大压力缺口和具体行动建议直接前置到奖励/营火决策界面
- 低血线、救场、复活、Boss 终局弹幕、首领倒下和高伤害命中来源会进入有界 `combatLog`，结算页会把这些波中转折和路线选择一起展示，并用独立的崩盘诱因卡片前置最关键的一次转折
- 战前营火卡片现在也会显示基于压力模型的推荐标签与建议文案，方便玩家区分补输出、补容错和高风险豪赌

### 前端

- 菜单、角色选择、HUD、奖励页、锻造页、商店页、营火页都已完成一轮视觉重构
- HUD 不再是文本墙，开始能更快解释 build 和风险
- 奖励卡片已经能展示适配度、标签、建议方向和首选/豪赌/稳血线等决策标签；本轮新增结构化读板，可显示协同点亮、短板修复、高危爆发、成长引擎等机会说明和风险脚注
- 奖励 / 锻造 / 商店 / 营火点击后的 UI 状态同步已集中到 `syncOverlayForRunState`
- 角色选择页和局内玩家模型已换成 AI 生成 spritesheet，明显弱化了原先的占位感
- 角色选择页现在会直接展示职业职责、武器、战斗备注和起手流派，锁定职业也保持基本可读
- HUD 右上角已从单块文本墙整理成分区式战术读板，波次 / 血线 / 构筑 / 风险的层级更清晰
- 普通敌人、远程/支援敌人和三种 Boss 已接入本地生成 spritesheet，原 SVG 符号保留为资源兜底
- 敌人本地图集继续加强了 slime / bat / skeleton / golem / archer / fire_mage / healer / summoner 的 silhouette，缩小到战场里也更容易读类别
- 敌人近战、远程射击、支援/召唤和 Boss 蓄力已有基础画面提示；链击、爆炸、子弹命中、护盾吸收、自伤、冲刺残影、复活和死亡爆裂等核心粒子都已有绘制路径
- Boss 阶段危险已经能在画面里读到：活跃 Boss 战会显示竞技场压力环、阶段读招环、不同弹幕形状预览、左上读招面板和血条阶段刻度；读招面板会显示当前技能名与蓄力百分比
- 顶部生命 HUD 已压缩，避免第 5 波 Boss 入场和读招环被界面遮住
- 竖屏手机战斗画面已把 16:9 竞技场上移，让玩家、Boss 和读招环更靠近 HUD 与底部消息之间的可视区
- 已有固定的第 20 波高压桌面样本，能稳定回归高波护盾、护符、侧翼火力和首领阶段压迫感
- 竞技场背景已按参考图方向重做：中心法阵、熔岩裂隙、边缘城墙、上下台阶、角塔火/蓝光源和破碎石板都进入生成管线
- 移动端主菜单首屏已压缩，390x844 下开始按钮无需滚动即可点击
- 结算页已重构为“战报复盘”：关键数值卡、路线概览、构筑诊断、阵亡复盘、崩盘诱因和下一把优先级分区展示；移动端结果页底部操作按钮保持可见，复盘内容独立滚动
- 结算页已新增复盘时间线：奖励、锻造、商店、营火等关键选择会按波次展示，并用“路线影响”副行说明该选择和最终短板之间的关系；低血线、Boss 终局弹幕和高伤害命中来源等战斗事件会插入时间线，并在末尾追加崩盘节点，崩盘诱因卡会把最关键的波中转折前置出来，帮助玩家把路线选择、波中转折和死亡原因连起来

### 平台

- `scripts/sync-web.mjs` 已可同步 `web -> docs -> android`
- `scripts/serve-web.mjs` 已能正确以 `text/javascript` 提供 `.mjs`
- `scripts/web-smoke.mjs` 已可验证 spritesheet、service worker 预缓存清单、UI 状态路由、离线 fallback 和本地 MIME
- `scripts/visual-smoke.mjs` 已可用本机 Chrome/Edge 做桌面/移动端视觉 smoke 并输出截图，覆盖菜单、角色选择、局内 canvas、奖励选择页读板、Boss 前营火、第 5 波 Boss 进入、桌面/移动端活跃 Boss 战读招画面、固定的第 20 波高压桌面样本、桌面/移动端结算复盘，以及桌面/移动端时间线区域；高波样本还会断言 debug snapshot 中存在当前 `bossPatternLabel` 和 `bossCharge`，奖励/营火样本会断言存在“下一波作战计划”、压力优先级和 chips，每张奖励卡有 `card-readout`、机会标签、风险等级且没有内部裁切，结果页样本会断言崩盘诱因包含具体高伤害命中，结果时间线样本会断言存在路线影响、具体高伤害命中来源、战斗事件和崩盘节点
- `scripts/visual-regression.mjs` 已可解码 visual-smoke PNG，稳定界面做严格 RGBA 哈希，动画界面做像素指标容差回归，当前基线包含 `reward-desktop.png`、`reward-mobile.png`、`boss-fight-desktop.png`、`boss-fight-mobile.png`、`boss-fight-highwave-desktop.png`、`result-desktop.png`、`result-mobile.png`、`result-timeline-desktop.png` 和 `result-timeline-mobile.png`
- `tests/sim_harness.mjs` 已抽出 baseline / smart 共用模拟 harness；`npm run test:boss-checkpoints` 会输出第 5/10/15/20/25 波 Boss 检查点与死亡短板
- `npm run build:android:debug` 当前已可在本机返回成功
- `npm run build:android:debug` 会自动校验 APK 内当前关键前端资源、锻造/商店 handler、三档难度标记和 PWA 预缓存清单
- `npm run verify:android:debug` 已接入，可用 `adb` 安装 debug APK、启动 App、保存首屏截图并扫描启动后的 WebView/JS 致命错误
- `npm run verify:android:smoke` 已接入，可自动启动本机唯一 AVD、安装 APK、点击进入角色选择与局内战斗、保存三张截图、扫描 logcat fatal 错误并关闭模拟器
- `verify-android-debug.ps1` 在 emulator 报告 `sys.boot_completed` 后会额外等待 8 秒再开始验证，减少冷启动期误报 `ActivityManager` ANR
- `NightRunner35` Android 模拟器已完成 debug APK 安装、冷启动、焦点窗口、点击进入角色选择、点击进入局内战斗、截图和 logcat fatal scan
- Android 外壳已改成沉浸式游戏窗口，启动主题和窗口背景使用游戏黑色
- 本轮 `npm run verify:android:smoke` 未能重跑：临时 PATH 可解析 `adb.exe`，但当前本机找不到 `emulator.exe`，且 `adb devices` 无在线设备；需要恢复 Android Emulator 组件或接入真机后再验证当前 APK

### 已验证数据

- `node tests/baseline_sim.mjs`：前序单脚本样本为 `avgWave 18.45`，本轮 checkpoint 口径为 `avgWave 19.12`
- `node tests/smart_sim.mjs`：前序单脚本样本为 `avgWave 22.68`，本轮 checkpoint 口径为 `avgWave 23.42`
- `smart_sim` 第 5 波失败样本：`0 / 60`
- `baseline_sim` 第 5 波失败样本：`1 / 60`（seed 39，站桩 baseline 仅作保守压力参考）
- `npm run test:boss-checkpoints`：baseline 第 5 波 `59/60` 通过，第 10/15/20 波 Boss 死亡 `0 / 0 / 10`；smart 第 5 波 `60/60` 通过，第 10/15/20/25 波 Boss 死亡 `2 / 1 / 3 / 3`，第 20 波到达 `53/60`，第 25 波到达 `48/60`，通关 `45/60`；smart 无 max-tick 卡局，短板标签仍以 `safety` 最集中
- `npm test`：核心逻辑测试全部通过；已覆盖早期卡牌推荐回归、奖励读板协同机会和高风险文案、首个 Boss 极大单体缺口双输出保底、普通远程敌人场外卡局回归、Boss 前营火链路、第 10 波极高 safety 缺口提前护符、中后期压力目标成长、中后期奖励按 `singleTarget / aoe / sustain` 最大短板保底修复、脆皮烟幕残影保命、低血线/救场战斗事件记录、高伤害命中来源记录、崩盘诱因提炼、死亡复盘缺口/决策展示、下一把优先级跟随最大压力缺口、复盘时间线合并波中战斗事件、关键选择路线影响，以及 `reward / forge / shop / rest` 无出口状态机检查
- `npm run test:web-smoke`：资源、缓存清单、UI 状态路由、离线 fallback、本地 MIME 和核心粒子绘制覆盖检查全部通过
- `npm run test:visual-smoke`：桌面/移动端菜单、角色选择、局内 canvas、奖励选择页、Boss 前营火、第 5 波 Boss 进入、桌面/移动端活跃 Boss 战读招画面、固定第 20 波高压桌面样本、桌面/移动端结算复盘，以及桌面/移动端时间线区域渲染通过；高波样本已断言 `bossPatternLabel` / `bossCharge`；结果页会断言摘要标题/说明未被裁切、底部按钮在视口内、崩盘诱因显示具体高伤害命中；时间线会断言存在路线影响、具体高伤害命中来源、战斗事件和崩盘节点；截图已输出到 `output/visual-smoke/`
- `npm run test:visual-regression`：视觉 smoke 截图像素回归通过；基线文件为 `tests/visual-regression-baseline.json`
- Playwright MCP：`开始远征 -> 开始战斗 · 标准 -> 局内 HUD/canvas` 交互通过，canvas 非空采样 `1031`，无水平溢出；前序另用 `?debug=1` 跳转第 20 波高波 Boss，snapshot 返回 `bossPatternLabel = 螺旋弹幕`、`bossCharge ≈ 0.89`、canvas 非空采样 `920`，截图保存到 `output/playwright/boss-readout-highwave-desktop.png`；本轮用 `?debug=1` 触发 `showResult(false)`，确认结果时间线含 2 条路线影响、具体“被瞄准连射命中”危险节点、低血线事件、无水平溢出且底部操作可见
- `npm run build:android:debug`：Android debug APK 构建和 APK Web payload 校验通过；当前构建 APK SHA256 为 `7C2C952857949CBBD3CDBDFC1D0D8DE64C48AC43D3BB238DAA8C7B91CE2F97EB`
- `npm run verify:android:debug`：前序曾通过临时 PATH 使用 `C:\Users\24560\Desktop\study\kaoyandemo\.android-sdk\platform-tools\adb.exe`，自动启动唯一 AVD `NightRunner35`，APK 安装、冷启动、焦点窗口、首屏截图和 logcat fatal-error scan 通过；本轮当前 APK 未能重跑 debug/smoke，因为缺 `emulator.exe` 且无在线设备
- `npm run verify:android:smoke`：本轮用临时 PATH 解析到可用 `adb.exe` 后仍未能启动模拟器；当前本机缺 `emulator.exe` 且 `adb devices` 无在线设备。最近一次通过记录仍为前序 APK：自动启动唯一 AVD `NightRunner35`，模拟器安装/启动通过，焦点窗口属于 `com.ember.roguelike`，点击流已到局内战斗，`output/android-smoke/app-launch.png` / `character-select.png` / `gameplay.png` 已保存，logcat fatal-error scan 通过，验证后自动关闭模拟器
- 最近一次模拟器点击流验证 APK SHA256：`1BCDFAF64F2EDEC1C1C1731E353629C4C6F873024C6CA3FC348B8B5204386D51`
- 难度抽样：`steady avgWave 19.00 / standard 18.20 / trial 16.90`
- 浏览器验证：锻造选择后可进入第 4 波，不再卡在锻造层
- 浏览器验证：菜单首屏按钮、角色选择页 AI 头像、局内 AI 玩家模型和敌人 spritesheet 已确认渲染

---

## 当前阶段没做完

### 玩法

- 标准档 smart 策略第 5 波已无 60 seed 早期失败；站桩 baseline 仍有 1 个第 5 波失败 seed，下一步不要为该单点过度削弱首个 Boss，应优先观察玩家实际操作和试炼档压力
- 第 10/15/20/25 波 Boss 已有 checkpoint 统计；第 20 波前现在已有真实营火窗口，但 safety 仍是最集中的高波短板
- 奖励系统已经开始按最大构筑缺口做保底修复；下一步要继续观察它是否会过度干预玩家路线，尤其是高波 safety 与清场缺口同时存在时的取舍
- 结算复盘已完成一轮信息架构、崩盘诱因、复盘时间线、基础波中战斗事件、关键选择路线影响、具体高伤害命中来源和视觉回归；下一步仍可继续补更多事件类型、受击/走位来源统计和卡组路线对比

### 前端

- 奖励页已有首选/豪赌层级和结构化读板；下一步可以继续强化稀有卡、协同触发和高风险高回报选择的动画反馈
- HUD 的信息可读性和职业辨识度又提升了一截，但整体视觉完成度还没到真正成品级
- 背景危险感和第 5 波 Boss 读招可见性已增强，但中后期 Boss 多阶段压迫还需要继续做更强的阶段特效
- 敌人 / Boss 已有静态图集、状态环、阶段压力环、形状预览和核心粒子反馈，也有固定的第 20 波高压样本，但还缺更完整的多帧攻击、受击、死亡动画，以及更高波次或更多阶段的固定视觉样本

### 平台

- 已有前序自动化模拟器安装/启动/点击流证据；本轮当前 APK 还未完成安装/点击流复测，因为本机缺 `emulator.exe` 且无在线设备，实体真机复测仍未完成
- 浏览器视觉 smoke 和初版像素回归已接入，并已覆盖结算复盘；动态界面仍是整体像素指标容差，不是区域级精确回归

---

## 下一步优先顺序

### 1. 继续观察中后期 Boss 与构筑误选

重点文件：

- `web/src/game_core.mjs`

重点方向：

- 继续用 `npm run test:boss-checkpoints` 观察第 10/15/20/25 波 Boss 的失败原因
- 继续压低 Boss 前高风险牌的误选概率，但保留主动豪赌空间
- 继续校准奖励保底：它应该修复最大短板，但不能让每次奖励都变成同质化最优解
- 后续平衡改动要同时看 `steady / standard / trial`，不要只优化单一难度
- 新增奖励、事件、商店、营火或 Boss 前决策时，先把无出口状态机测试补上，再做 UI 接线

### 2. 继续补“危险感可见性”

重点文件：

- `web/src/main.mjs`
- `web/styles.css`
- `web/src/presentation.mjs`

重点方向：

- 让玩家不只在 HUD 上读到危险，也能在画面里看见危险
- 继续强化高波 Boss 压迫感、敌人动画帧、奖励诱惑感和高波活跃 Boss 战可读性
- 继续把死亡复盘从“结果解释”推进到更细的“时间线解释”，让玩家知道哪一次选择、哪一段 Boss 处理或哪一类命中导致路线崩盘
- 保持结构化展示边界，不把玩法判断塞回 UI

### 3. 做可复用的平台验证

命令：

```bash
npm run test:web-smoke
npm run test:boss-checkpoints
npm run test:visual-smoke
npm run test:visual-regression
node scripts/sync-web.mjs
npm run build:android:debug
npm run verify:android:debug
npm run verify:android:smoke
npm run serve
```

目标：

- 确认每次前端改动后都能同步到 `docs/` 与 Android 资源
- 确认 PWA 预缓存不会漏掉静态模块和核心美术资源
- 确认桌面/移动端关键界面可见、canvas 非空、移动端触控按钮可见
- 确认 APK 构建和 APK 内 Web payload 校验继续可用
- 恢复 `emulator.exe` 或接入在线设备后，确认当前 APK 能在真机或模拟器上安装、启动并通过 logcat fatal scan
- 后续补上实体真机复测，并把动态界面像素回归继续收紧到区域级基线

---

## 当前阶段的判断

现在最该继续补的，不再是单纯“把某个数值再砍一点”，而是把这条链做得更完整：

`构筑缺口 -> 奖励推荐 -> 战前准备 -> 波次风险提示 -> 路线影响/命中来源/战斗转折复盘`

如果这条链成立，后续不论继续做高级前端、内容扩展，还是移动端交付，都会更顺。
