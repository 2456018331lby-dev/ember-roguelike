# 余烬 (Ember) - 维护文档

> 给后续开发者的完整接手指南  
> 最后更新：2026-05-04

---

## 一、项目概览

余烬是一个融合卡牌构筑 + 献祭代价 + 肉鸽生存的 2D 俯视角竞技场游戏。

**核心玩法**：
- 玩家在竞技场中自动攻击敌人，击杀获得经验和掉落
- 每波清空后选择卡牌奖励，每张卡牌都有"献祭代价"（永久牺牲某项属性）
- 连续牺牲同一属性 3 次触发"极端化"效果，大幅改变玩法
- 共 25 波，每 5 波出现 Boss 战
- 存档系统保留永久进度和角色解锁

**技术栈**：纯 HTML5 Canvas + 原生 JavaScript (ES Modules)，零依赖，零构建工具。

**部署方式**：GitHub Pages 静态托管，`docs/` 目录即网站根目录。

**线上地址**：https://245601831by-dev.github.io/ember-roguelike/

**GitHub 仓库**：https://github.com/245601831lby-dev/ember-roguelike

---

## 二、文件结构

```
roguelike-game/
├── web/                          # 开发目录（主源码）
│   ├── index.html                # 入口页面 + DOM 结构
│   ├── styles.css                # 全部样式
│   ├── manifest.webmanifest      # PWA 配置
│   ├── sw.js                     # Service Worker（离线缓存）
│   ├── icons/icon.svg            # 应用图标
│   └── src/
│       ├── game_core.mjs         # ★ 游戏逻辑核心（无 DOM 依赖）
│       ├── main.mjs              # ★ 渲染层 + 输入系统 + UI 管理
│       ├── audio.mjs             # ★ 程序化音效引擎 (Web Audio API)
│       ├── save.mjs              # ★ 存档系统 (localStorage)
│       └── characters.mjs        # ★ 角色定义
├── docs/                         # GitHub Pages 发布目录（web/ 的副本）
├── tests/
│   └── game_core.test.mjs        # 核心逻辑单元测试（11 个）
├── data/                         # Godot 项目数据（当前 Web 版未使用）
│   ├── cards.json
│   ├── enemies.json
│   └── hosts.json
├── scripts/                      # Godot GDScript（当前 Web 版未使用）
├── scenes/                       # Godot 场景文件（当前 Web 版未使用）
├── GDD.md                        # 完整游戏设计文档
├── RELEASE_PLAN.md               # 发布路线图
├── MAINTENANCE.md                # 本文件
├── package.json                  # npm 脚本（test / serve）
└── capacitor.config.json         # Android 封装配置（未来用）
```

---

## 三、核心架构

### 3.1 game_core.mjs（纯逻辑层）

**不依赖任何 DOM / Canvas API**，可被 Node.js 直接测试。

#### 关键导出函数

| 函数 | 用途 |
|------|------|
| `createRun(seed, character)` | 创建新游戏实例，返回 run 对象。支持传入角色配置 |
| `updateRun(run, input, dt)` | 每帧更新游戏状态 |
| `applyCardChoice(run, card)` | 应用卡牌选择（奖励阶段） |
| `rollCardChoices(run, count)` | 随机抽取卡牌（带稀有度权重） |
| `getPlayerStats(run)` | 计算玩家当前属性（含所有加成/牺牲/极端化） |
| `resolveAutoAttack(run, dt)` | 自动攻击逻辑（含暴击/链击/吸血/减速/中毒/流血） |
| `dash(run, dx, dy)` | 冲刺（无敌帧 + 残影） |
| `restart(run, seed)` | 重新开始 |
| `updateWaveState(run, dt)` | 波次状态检查 |

#### run 对象结构

```javascript
run = {
  seed: Number,              // 随机种子
  rand: Function,            // 确定性随机函数 (mulberry32)
  state: 'playing' | 'reward' | 'gameover' | 'victory' | 'wave_transition',
  wave: Number,              // 当前波次 (1-25)
  totalWaves: 25,            // 总波次数
  gameTime: Number,          // 总游戏时间（秒）
  waveTime: Number,          // 当前波次时间

  // 战斗
  kills: Number,             // 击杀数
  score: Number,             // 分数
  combo: Number,             // 当前连击
  maxCombo: Number,          // 最高连击
  comboTimer: Number,        // 连击计时器（2.5秒断连）
  reviveUsed: Boolean,       // 全局复活标记（整个run只能复活一次）
  characterId: String,       // 角色ID

  // 视觉反馈
  screenShake: Number,       // 屏幕震动强度
  screenFlash: Number,       // 屏幕闪白强度
  messages: Array,           // 消息日志（最多5条）
  events: Array,             // 音效/UI事件队列

  // 冲刺
  dashCooldown: Number,
  dashTimer: Number,

  // 玩家
  player: {
    x, y, radius, hp, maxHp,
    baseSpeed, baseAttack, baseAttackCooldown,
    attackTimer, invuln, barrier, regen, facingAngle,
    deck: Array,             // 已装备的卡牌列表
  },

  // 献祭系统
  sacrifices: {
    speed: { count, amount },
    attack: { count, amount },
    health: { count, amount },
    attack_speed: { count, amount },
  },
  extremes: Array,           // 已触发的极端化名称

  // 战场实体
  jokers: Array,             // 装备的小丑牌
  enemies: Array,            // 活着的敌人列表
  projectiles: Array,        // 敌方弹幕
  telegraphs: Array,         // 攻击预警区域
  particles: Array,          // 视觉粒子
  pickups: Array,            // 掉落物
  waveEnemyQueue: Array,     // 待生成的敌人队列
  spawnTimer: Number,        // 敌人生成计时器
  rewardChoices: Array,      // 当前奖励卡牌选择
  waveTransitionTimer: Number,
}
```

### 3.2 main.mjs（渲染 + 输入层）

负责：
- Canvas 2D 渲染（所有视觉效果）
- 键盘输入处理 (WASD / 方向键 / 空格)
- 虚拟摇杆 (触摸)
- 双击冲刺 (移动端)
- HUD 更新 (DOM 操作)
- 波次过渡动画
- 奖励/游戏结束 UI
- 角色选择界面
- 新手引导系统
- 音效事件分发
- 存档读取/记录

**渲染层次**（从底到顶）：
1. 竞技场背景（石砖地板 + 环境粒子 + 边框 + 角落火把）
2. 攻击预警区域（红色半透明圆圈）
3. 拾取物（恢复球 + 余烬星）
4. 弹幕（敌方子弹，带尾迹和发光）
5. 敌人（精灵化，各类型独立绘制）
6. 玩家（精灵化，角色颜色系统）
7. 粒子特效（伤害数字、挥砍弧线、死亡碎片等）
8. 小地图（右下角，显示敌人/弹幕/拾取物）
9. 新手引导提示条
10. 屏幕闪白叠加层

### 3.3 audio.mjs（程序化音效引擎）

使用 Web Audio API 算法生成所有音效，**零外部音频文件**。

| 函数 | 音效 | 实现方式 |
|------|------|---------|
| `sfxAttack()` | 挥砍声 | 噪音 + 带通滤波器频率扫掠 |
| `sfxCrit()` | 暴击声 | 挥砍 + 锯齿波高频 + 正弦波 |
| `sfxHit()` | 受伤声 | 锯齿波低频下降 |
| `sfxDeath()` | 玩家死亡 | 低频锯齿波轰鸣 + 噪音 |
| `sfxEnemyDeath()` | 敌人死亡 | 三段正弦波递减（泡泡破裂） |
| `sfxBossDeath()` | Boss 死亡 | 8段锯齿波和弦 + 噪音爆炸 |
| `sfxDash()` | 冲刺声 | 正弦波频率上升（嗖） |
| `sfxPickup()` | 拾取声 | 双段正弦波叮声 |
| `sfxHeal()` | 治愈声 | C-E-G 三和弦上升 |
| `sfxRevive()` | 复活声 | C-E-G-C 四和弦上升 |
| `sfxWaveComplete()` | 波次完成 | G-C-E 方波胜利音 |
| `sfxCardSelect()` | 选牌声 | 双段正弦波确认音 |
| `sfxExtreme()` | 极端化觉醒 | 不和谐锯齿波和弦 |
| `sfxBulletShot()` | 弹幕发射 | 方波频率下降 |
| `sfxBulletHit()` | 弹幕命中 | 方波短击 |
| `sfxCombo(n)` | 连击音 | 正弦波频率随连击数上升 |
| `startBGM()` | 背景音乐 | Am-F-C-G 进行，三角波+正弦波八度点缀 |
| `stopBGM()` | 停止 BGM | 清除定时器 |
| `resumeAudio()` | 恢复上下文 | 用户交互后调用 |

### 3.4 save.mjs（存档系统）

使用 localStorage 持久化，key 为 `ember_save_v2`。

| 函数 | 用途 |
|------|------|
| `getSave()` | 读取存档 |
| `updateSave(patch)` | 更新存档字段 |
| `recordRun(score, wave, kills, maxCombo, won, character)` | 记录一局结果并检查解锁 |
| `completeTutorial()` | 标记教程完成 |
| `selectCharacter(id)` | 保存选中角色 |
| `isCharacterUnlocked(id)` | 检查角色是否已解锁 |
| `resetSave()` | 重置所有存档 |

存档字段：

```javascript
{
  version: 2,
  bestScore: Number,         // 历史最高分
  bestWave: Number,          // 最远波次
  totalRuns: Number,         // 总局数
  totalWins: Number,         // 胜利局数
  totalKills: Number,        // 总击杀
  highCombo: Number,         // 最高连击
  tutorialDone: Boolean,     // 教程是否完成
  unlockedCharacters: Array, // 已解锁角色ID列表
  selectedCharacter: String, // 当前选中角色
  sfxVolume: Number,
  bgmVolume: Number,
  masterVolume: Number,
}
```

角色解锁条件：

| 角色 | 解锁条件 |
|------|---------|
| 战士 | 默认 |
| 法师 | 通关一次 |
| 游侠 | 累计 5 局 |
| 死灵法师 | 到达第 15 波 |

### 3.5 characters.mjs（角色定义）

| 角色 | ID | 生命 | 速度 | 攻击 | 攻速 | 颜色 | 特点 |
|------|-----|------|------|------|------|------|------|
| 战士 | warrior | 120 | 230 | 18 | 0.55s | #42a5f5 蓝 | 高血高甲，近身肉搏 |
| 法师 | mage | 70 | 260 | 12 | 0.35s | #ce93d8 紫 | 高攻速暴击，血量低 |
| 游侠 | rogue | 80 | 300 | 14 | 0.42s | #ffab40 橙 | 极高暴击闪避，走位流 |
| 死灵法师 | necro | 90 | 220 | 10 | 0.60s | #90a4ae 灰 | 吸血反伤诅咒，持续输出 |

每个角色有 3 张独特的起始卡牌。

---

## 四、游戏内容清单

### 4.1 卡牌系统（40 张）

| 类型 | 数量 | 稀有度分布 | 特点 |
|------|------|-----------|------|
| 攻击牌 | 10 | 3普通/3精良/4史诗 | 直接伤害、攻速、链击、暴击、中毒、流血、减速 |
| 防御牌 | 8 | 2普通/3精良/3史诗 | 护甲、闪避、反射、护盾、反伤、回血、石肤、相位 |
| 被动牌 | 6 | 2普通/2精良/0史诗/0传说 | 攻击加成、速度加成、暴击率、暴击伤害、射程、破甲 |
| 小丑牌 | 9 | 1普通/2精良/3史诗/3传说 | 血之契约、玻璃炮、吸血刃、收藏家、凤凰余烬、双倍或归零、时间扭曲、贪婪、狂战士 |
| 诅咒牌 | 3 | 0普通/1精良/2史诗 | 末日（限时爆发）、衰败（持续扣血换攻击）、悖论（攻击换护甲） |

**小丑牌特殊机制**：
- 凤凰余烬：整个 run 只能复活一次（全局 reviveUsed 标记）
- 狂战士：生命越低伤害越高（满血 x1，空血 x3）
- 玻璃炮：总伤害 x2，但最大生命 -40%
- 双倍或归零：伤害 x2.2，但 15% 几率自伤 20%
- 收藏家：每 4 张牌，伤害 +8%

**卡牌稀有度抽取权重**：

| 稀有度 | 权重 |
|--------|------|
| 普通 | 4 |
| 精良 | 3 |
| 史诗 | 1.5 |
| 传说 | 0.5 |

### 4.2 敌人系统（8 种 + 3 种 Boss）

| 敌人 | 行为 | 攻击方式 | 血量倍率 | 伤害倍率 | 速度倍率 | 解锁波次 |
|------|------|---------|---------|---------|---------|---------|
| 史莱姆 | 直线追踪 | 近战碰撞 | 1.0 | 1.0 | 0.9 | 第 1 波 |
| 蝙蝠 | 正弦摆动追踪 | 近战碰撞 | 0.5 | 0.7 | 2.0 | 第 1 波 |
| 骷髅 | 直线追踪 | 近战碰撞 | 1.3 | 1.2 | 0.85 | 第 1 波 |
| 石像鬼 | 慢速追踪 | 近战碰撞 | 4.0 | 2.5 | 0.35 | 第 4 波 |
| 弓箭手 | 保持距离+横向移动 | 单发弹幕 (320px/s) | 0.7 | 1.0 | 0.65 | 第 4 波 |
| 火焰法师 | 保持距离 | 扇形 3 发弹幕 (250px/s) | 0.8 | 1.5 | 0.55 | 第 7 波 |
| 治疗者 | 保持距离 | 治愈光环（治疗附近友军） | 0.6 | 0.4 | 0.75 | 第 7 波 |
| 召唤者 | 缓慢靠近 | 召唤 2 只史莱姆 | 1.8 | 0.3 | 0.45 | 第 10 波 |

**敌人攻击机制**：
- 每种敌人都有 `attackCooldown`（攻击冷却）和 `attackRange`（攻击范围）
- 近战敌人在范围内按冷却时间触发攻击，显示预警后造成伤害
- 远程敌人发射弹幕（projectile），弹幕有速度、伤害、生命时间
- 攻击前会显示红色预警圆圈（telegraph），持续 0.25 秒
- 碰撞伤害和攻击伤害是分开的系统

| Boss | 弹幕模式 | 阶段 1 (>60%HP) | 阶段 2 (>30%HP) | 阶段 3 (<30%HP) |
|------|---------|----------------|----------------|----------------|
| 幼龙·烈焰 | 火焰系 | 圆形弹幕 12发 | 螺旋弹幕 3波×8发 | 瞄准连射 5发 |
| 巫妖王·寒冰 | 冰霜系 | 双层环形 16发×2 | 十字旋转 4方向×4发 | 随机弹雨 20发 |
| 恶魔领主·混沌 | 混沌系 | 圆形弹幕 20发 | 螺旋弹幕 3波×12发 | 瞄准连射 8发 |

**Boss 数值缩放**：
- 血量 = 基础 × hpMult × (1 + wave × 0.18)
- 伤害 = 基础 × dmgMult × (1 + wave × 0.08)

### 4.3 属性系统（完整清单）

| 属性 | 来源 | 说明 |
|------|------|------|
| hp / maxHp | 基础+卡牌+牺牲 | 当前/最大生命值 |
| attack | 基础+卡牌+牺牲 | 基础攻击伤害 |
| attackCooldown | 基础+卡牌+牺牲 | 攻击间隔（秒） |
| speed | 基础+卡牌+牺牲 | 移动速度 (px/s) |
| armor | 卡牌 | 护甲（减少受到的伤害） |
| thorns | 卡牌 | 反伤（受击时对敌人造成固定伤害） |
| lifesteal | 卡牌 | 吸血比例（造成伤害的百分比回血） |
| damageMultiplier | 卡牌+极端化 | 总伤害乘数 |
| critChance | 卡牌 | 暴击率（上限 80%） |
| critDamageBonus | 卡牌 | 暴击伤害加成（基础 +50%） |
| dodgeChance | 卡牌 | 闪避率（上限 65%） |
| reflect | 卡牌 | 反射比例（反弹受到伤害的百分比） |
| rangeBonus | 卡牌 | 攻击范围加成 |
| attackSpeedBonus | 卡牌 | 攻速加成（减少 cooldown） |
| chain | 卡牌 | 链式攻击目标数 |
| slow | 卡牌 | 减速比例（持续 2 秒） |
| dot | 卡牌 | 每秒持续伤害（中毒） |
| bleed | 卡牌 | 每秒持续伤害（流血，和 dot 叠加） |
| regen | 卡牌 | 每秒回血 |
| barrier | 卡牌 | 战斗开始时的护盾值 |
| armorPierce | 卡牌 | 无视敌方护甲值 |
| scoreBonus | 卡牌 | 击杀得分加成比例 |
| selfDamageChance | 卡牌 | 自伤几率 |
| doomTimer | 卡牌 | 末日倒计时（秒） |
| decayRate | 卡牌 | 每秒自动扣血 |
| revive | 卡牌 | 复活次数（全局限制一次） |

### 4.4 极端化系统

| 牺牲属性 | 触发次数 | 极端化名称 | 效果 |
|---------|---------|-----------|------|
| 移速 (speed) | 3 次 | 磐石之躯 | 伤害 x2.8，移速降低 70% |
| 攻击 (attack) | 3 次 | 诅咒之王 | 攻击降低 60%，伤害 x2.2，链击 +2 |
| 生命 (health) | 3 次 | 幽灵血脉 | 最大生命降至 35%，移速 +120，闪避 +15% |
| 攻速 (attack_speed) | 3 次 | 巨炮节奏 | 攻速降低 50%，伤害 x2.5 |

---

## 五、已知问题 & 待改进

### 游戏性
- [ ] 缺少暂停功能（Escape 键预留了但未实现）
- [ ] 缺少卡牌移除/升级机制
- [ ] 没有无尽模式（通关 25 波后结束）
- [ ] 没有多人/排行榜
- [ ] 狂战士小丑牌的伤害公式可以更精细

### 视觉
- [ ] 美术仍是程序化绘制（Canvas API），不是真正的像素美术资产
- [ ] 缺少敌人死亡动画（只是粒子爆发后消失）
- [ ] Boss 没有独立的详细精灵（只有角+眼睛+嘴）
- [ ] 缺少背景音乐变化（Boss 战应有不同 BGM）
- [ ] 波次过渡动画可以更华丽

### 技术
- [ ] `docs/` 是 `web/` 的手动副本，容易不同步
- [ ] 没有 CI/CD 自动部署（token 缺 workflow 权限）
- [ ] Service Worker 缓存策略简单（应改为版本化）
- [ ] `updateRun` 在 `wave_transition` 状态下不处理战斗，可能导致敌人在波次过渡时"暂停"
- [ ] 音频在 iOS Safari 上首次需要用户交互才能播放

### 数值
- [ ] 后期波次（20+）敌人数量过多可能导致性能问题
- [ ] 玻璃炮 + 狂战士 + 极端化组合可能过于强力
- [ ] Boss 血量在高波次下可能过于膨胀

---

## 六、构建 & 部署

### 本地开发

```bash
npm test              # 运行核心逻辑测试（11 个）
npm run serve         # 启动本地服务器 http://127.0.0.1:5173
```

### 部署到 GitHub Pages

```bash
rm -rf docs
cp -r web docs
# 然后通过 GitHub API 推送（git push 需要 workflow 权限）
```

GitHub Pages 配置：Settings → Pages → Source: `main` branch `/docs` folder。

### 生成 Android APK（需要 Android Studio）

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap sync android
cd android
# Windows:
gradlew.bat assembleDebug
# 输出: android/app/build/outputs/apk/debug/app-debug.apk
```

注意：需要 ANDROID_HOME 环境变量指向 Android SDK。Java 17+ 必需。

---

## 七、测试策略

测试文件 `tests/game_core.test.mjs` 覆盖了核心系统（11 个测试）：

| 测试 | 覆盖内容 |
|------|---------|
| 开局基础属性和初始卡牌 | createRun、初始 hp/deck/state |
| 波次过渡后进入 playing | wave_transition → playing 状态转换 |
| 献祭卡牌增加能力并记录代价 | applyCardChoice、sacrifices 计数 |
| 连续牺牲 3 次同属性触发极端化 | 极端化检测、damageMultiplier |
| 同 seed 抽卡结果相同 | mulberry32 随机数确定性 |
| 自动攻击伤害近距离敌人 | resolveAutoAttack、enemy hp 减少 |
| 冲刺消耗冷却并提供无敌帧 | dash、dashCooldown、invuln |
| 凤凰余烬只能复活一次 | reviveUsed 全局标记、二次死亡 gameover |
| 卡牌稀有度权重 | rollCardChoices 输出包含多种稀有度 |
| 弹幕系统 - Boss 生成弹幕 | Boss 弹幕攻击、projectiles 数组 |
| 敌人有攻击冷却和攻击行为 | enemy attackTimer/attackCooldown/attackType |

**添加新功能时**：先写测试（RED），再写实现（GREEN），再重构（REFACTOR）。

---

## 八、音效系统详细说明

### 架构

```
audio.mjs
├── AudioContext (单例)
├── masterGain (总音量 0.6)
│   ├── sfxGain (音效音量 0.5)
│   └── bgmGain (背景音乐音量 0.12)
├── 16 个音效函数
└── BGM 播放器 (setTimeout 循环)
```

### 事件驱动

音效通过 `run.events` 数组触发：
1. `game_core.mjs` 在关键动作时 push 事件字符串
2. `main.mjs` 在每帧循环中遍历 events 数组，调用对应音效函数
3. 清空 events 数组

事件类型：`attack`, `crit`, `hit`, `enemy_death`, `boss_death`, `dash`, `pickup`, `heal`, `revive`, `extreme`, `bullet_shot`, `bullet_hit`

---

## 九、角色系统详细说明

### 角色数据结构

```javascript
{
  id: String,              // 唯一标识
  name: String,            // 中文名
  subtitle: String,        // 副标题
  desc: String,            // 描述
  unlockDesc: String,      // 解锁条件描述
  color: String,           // 主颜色 (hex)
  accentColor: String,     // 强调色 (hex)
  baseHp: Number,          // 基础生命
  baseSpeed: Number,       // 基础速度
  baseAttack: Number,      // 基础攻击
  baseAttackCooldown: Number, // 基础攻速
  startCards: Array,       // 3 张起始卡牌
}
```

### 角色视觉

每个角色在 `drawPlayerSprite` 中使用 `character.color` 和 `character.accentColor` 渲染：
- 身体渐变：accentColor → color → 亮色
- 斗篷：accentColor
- 眼睛发光：color 亮化版
- 护盾光环：使用原色

---

## 十、性能注意事项

- Canvas 2D 渲染，目标 60fps
- 环境粒子固定 55 个，不会增长
- 粒子系统通过 life 自动清理
- 敌人超过 55 个时注意帧率
- `getPlayerStats()` 每帧调用多次，卡牌超过 50 张可能需要缓存
- BGM 使用 setTimeout 循环而非 AudioBufferSource（简单但可能有轻微延迟）

---

## 十一、跨平台路线

| 平台 | 方案 | 状态 |
|------|------|------|
| 手机浏览器 | 当前 Web 版 | ✅ 已上线 |
| Android App | Capacitor 封装 Web | 📋 已配置，需 Android SDK 构建 |
| iOS App | Capacitor + Xcode | 📋 未开始 |
| PC (Steam) | Tauri / Electron 封装 Web | 📋 未开始 |
| PC (原生) | Godot 4 项目 (scripts/scenes) | 📋 骨架已有 |

---

## 十二、关键设计决策记录

1. **为什么用纯 Canvas 而不是 DOM**：需要大量精灵和粒子，DOM 操作开销太大
2. **为什么逻辑和渲染分离**：方便测试，方便未来迁移到 Godot/Unity
3. **为什么 25 波而非无尽**：有明确终点更有成就感，后续可加无尽模式
4. **为什么自动攻击而非手动**：手机触屏操作精确度不够，自动攻击+走位是更好的手游体验
5. **为什么牺牲系统用百分比而非固定值**：保证后期仍然有选择压力
6. **为什么音效用程序化生成**：零外部文件、零加载时间、体积小、可参数化调整
7. **为什么复活限制为全局一次**：避免无限复活导致游戏无挑战性
8. **为什么卡牌稀有度用权重而非等概率**：传说卡稀有才有收集价值

---

## 十三、版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1 | 2026-05-03 | 初始项目骨架，基础献祭模式，色块敌人 |
| v2 | 2026-05-03 | 重写渲染层，精灵化角色/敌人，扩充卡牌到 30+，8 种敌人，3 种 Boss |
| v3 | 2026-05-04 | 精灵化细节（斗篷/面罩/武器动画），维护文档，修复 regen bug |
| v3.1 | 2026-05-04 | 修复 regen/barrier stats 计算，Service Worker 缓存更新 |
| v4 | 2026-05-04 | 完整重写核心：敌人攻击 AI、弹幕系统、Boss 三阶段弹幕、攻击预警、连击系统、复活限制、40 张卡牌、25 波 |
| v5 | 2026-05-04 | 4 个可选角色、存档系统、程序化音效引擎、新手引导、角色颜色系统、角色解锁机制 |

---

## 十四、后续开发优先级

### P0（必须）
1. 暂停功能
2. 无尽模式
3. 存档同步到云端（需要后端）

### P1（重要）
4. 真正的像素美术资产替换程序化绘制
5. Boss 战独立 BGM
6. 敌人死亡动画
7. 更多卡牌（目标 80+）

### P2（锦上添花）
8. 排行榜
9. 成就系统
10. 每日挑战（固定种子）
11. 卡牌升级/移除机制
12. 更多角色
