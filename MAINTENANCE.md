# 余烬 (Ember) - 维护文档

> 给后续开发者的完整接手指南

## 一、项目概览

余烬是一个融合卡牌构筑 + 献祭代价 + 肉鸽生存的 2D 俯视角竞技场游戏。

**核心玩法**：玩家在竞技场中自动攻击敌人，击杀敌人获得经验。每波清空后选择卡牌奖励，每张卡牌都有"献祭代价"（永久牺牲某项属性）。连续牺牲同一属性 3 次触发"极端化"效果，大幅改变玩法。

**技术栈**：纯 HTML5 Canvas + 原生 JavaScript (ES Modules)，零依赖，零构建工具。

**部署方式**：GitHub Pages 静态托管，`docs/` 目录即网站根目录。

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
│       └── main.mjs              # ★ 渲染层 + 输入系统 + UI 管理
├── docs/                         # GitHub Pages 发布目录（web/ 的副本）
├── tests/
│   └── game_core.test.mjs        # 核心逻辑单元测试
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

## 三、核心架构

### game_core.mjs（纯逻辑层）

**不依赖任何 DOM / Canvas API**，可被 Node.js 直接测试。

关键导出函数：

| 函数 | 用途 |
|------|------|
| `createRun(seed)` | 创建新游戏实例，返回 run 对象 |
| `updateRun(run, input, dt)` | 每帧更新游戏状态 |
| `applyCardChoice(run, card)` | 应用卡牌选择（奖励阶段） |
| `rollCardChoices(run, count)` | 随机抽取卡牌选择 |
| `getPlayerStats(run)` | 计算玩家当前属性（含所有加成） |
| `resolveAutoAttack(run, dt)` | 自动攻击逻辑 |
| `dash(run, dx, dy)` | 冲刺 |
| `restart(run, seed)` | 重新开始 |

**run 对象**是整个游戏状态的容器：

```javascript
run = {
  state: 'playing' | 'reward' | 'gameover' | 'victory' | 'wave_transition',
  wave: 1,           // 当前波次
  totalWaves: 20,    // 总波次数
  player: { x, y, hp, maxHp, deck: [...], ... },
  enemies: [...],    // 活着的敌人列表
  projectiles: [...], // 敌人弹幕
  pickups: [...],    // 掉落物
  particles: [...],  // 视觉粒子（逻辑层生成，渲染层消费）
  sacrifices: { speed: {count, amount}, attack: {...}, ... },
  extremes: [],      // 已触发的极端化名称
  jokers: [],        // 装备的小丑牌
  // ... 更多字段见源码
}
```

### main.mjs（渲染 + 输入层）

负责：
- Canvas 2D 渲染（所有视觉效果）
- 键盘输入处理 (WASD / 方向键 / 空格)
- 虚拟摇杆 (触摸)
- 双击冲刺 (移动端)
- HUD 更新 (DOM 操作)
- 波次过渡动画
- 奖励/游戏结束 UI

**渲染层次**（从底到顶）：
1. 竞技场背景（石砖地板 + 环境粒子 + 边框）
2. 拾取物
3. 弹幕
4. 敌人（含血条、状态特效）
5. 玩家（含护盾、再生光环）
6. 粒子特效（伤害数字、挥砍弧线等）
7. 小地图

## 四、添加新内容指南

### 添加新卡牌

在 `game_core.mjs` 的 `CARD_POOL` 数组中添加条目：

```javascript
{
  id: 'unique_id',        // 唯一标识
  name: '显示名称',        // 中文名
  type: 'attack',         // attack | defense | passive | joker | curse
  rarity: 'rare',         // common | rare | epic | legendary
  damage: 15,             // 攻击牌：直接伤害加成
  attackSpeedBonus: 0.2,  // 攻速加成（0.2 = 20%）
  armorBonus: 5,          // 护甲加成
  critChance: 0.15,       // 暴击率（0.15 = 15%）
  dodgeChance: 0.1,       // 闪避率
  lifesteal: 0.1,         // 吸血比例
  thorns: 5,              // 反伤固定值
  chain: 2,               // 链式弹射目标数
  slow: 0.4,              // 减速比例
  dot: 3,                 // 每秒持续伤害
  bleed: 5,               // 流血每秒伤害
  revive: 1,              // 复活次数（0或1）
  damageMultiplier: 1.5,  // 总伤害乘数
  barrier: 20,            // 初始护盾值
  regen: 2,               // 每秒回血
  rangeBonus: 60,         // 攻击范围加成
  scoreBonus: 0.3,        // 击杀得分加成
  desc: '描述文字',
  sacrifice: { stat: 'health', amount: 0.1 },  // 献祭代价
}
```

**重要**：添加后运行 `npm test` 确保不影响现有逻辑。

### 添加新敌人类型

在 `game_core.mjs` 的 `ENEMY_TYPES` 对象中添加：

```javascript
new_type: {
  name: '名称',
  color: '#hex',          // 基础颜色
  radius: 14,             // 碰撞半径
  hpMult: 1.5,            // 血量倍率（基于波次缩放）
  dmgMult: 1.2,           // 伤害倍率
  spdMult: 0.8,           // 速度倍率
  behavior: 'chase',      // 行为模式（见下表）
  // ranged 专用
  attackRange: 250,
  shootCooldown: 2,
  // healer 专用
  healAmount: 5,
  healCooldown: 3,
  // summoner 专用
  summonCooldown: 5,
  // ghost 专用
  phaseCooldown: 3,
}
```

**行为模式**：

| behavior | 说明 |
|----------|------|
| chase | 直线追踪玩家 |
| slow_chase | 慢速追踪 |
| zigzag | 追踪 + 正弦摆动 |
| ranged | 保持距离，发射弹幕 |
| healer | 治疗附近敌人 |
| summoner | 定期召唤小怪 |
| phase | 周期性隐身/显形 |
| boss_charge | Boss 冲锋 |
| boss_summon | Boss 召唤小怪群 |
| boss_aoe | Boss 范围攻击 |

添加新行为：在 `game_core.mjs` 的 `updateEnemies()` 函数 switch 块中添加 case，同时在 `main.mjs` 的 `drawEnemySprite()` 函数中添加对应渲染。

### 添加新极端化效果

1. 在 `game_core.mjs` 的 `applySacrifice()` 函数 `extremeMap` 中添加映射
2. 在 `getPlayerStats()` 函数中添加对应的属性修改逻辑

## 五、已知问题 & 待改进

### 游戏性
- [ ] 波次间没有"跳过"按钮（需要等敌人全部生成完才能进入下一波）
- [ ] 缺少暂停功能
- [ ] 缺少卡牌移除/升级机制
- [ ] 敌人 AI 比较简单，没有寻路和躲避
- [ ] 没有音效和音乐
- [ ] 连击系统只计数，没有连击奖励

### 视觉
- [ ] Boss 没有独立的详细精灵（共用敌人绘制）
- [ ] 缺少死亡动画（敌人死亡只是消失）
- [ ] 缺少背景音乐可视化
- [ ] 波次过渡可以更华丽

### 技术
- [ ] `docs/` 是 `web/` 的手动副本，容易不同步
- [ ] 没有 CI/CD 自动部署
- [ ] 没有性能测试（大量敌人时可能掉帧）
- [ ] Service Worker 缓存策略简单（应改为版本化）
- [ ] 缺少存档功能（localStorage 只存了最高分）

## 六、构建 & 部署

### 本地开发

```bash
npm test              # 运行核心逻辑测试
npm run serve         # 启动本地服务器 http://127.0.0.1:5173
```

### 部署到 GitHub Pages

```bash
rm -rf docs
cp -r web docs
git add -A
git commit -m "更新内容"
git push
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

## 七、测试策略

测试文件 `tests/game_core.test.mjs` 覆盖了核心系统：
- 开局状态
- 波次过渡
- 献祭系统
- 极端化触发
- 随机确定性（同 seed 同结果）
- 自动攻击
- 冲刺机制

**添加新功能时**：先写测试（RED），再写实现（GREEN），再重构（REFACTOR）。

## 八、性能注意事项

- Canvas 2D 渲染，目标 60fps
- 敌人超过 50 个时注意帧率（可以加对象池）
- 粒子系统会累积，已用 life 自动清理
- `getPlayerStats()` 每帧调用多次，如果卡牌数量超过 50 可能需要缓存
- 环境粒子 (ambientParticles) 是固定的 40 个，不会增长

## 九、跨平台路线

| 平台 | 方案 | 状态 |
|------|------|------|
| 手机浏览器 | 当前 Web 版 | ✅ 已上线 |
| Android App | Capacitor 封装 Web | 📋 已配置，需 Android SDK 构建 |
| iOS App | Capacitor + Xcode | 📋 未开始 |
| PC (Steam) | Tauri / Electron 封装 Web | 📋 未开始 |
| PC (原生) | Godot 4 项目 (scripts/scenes) | 📋 骨架已有 |

## 十、关键设计决策记录

1. **为什么用纯 Canvas 而不是 DOM**：需要大量精灵和粒子，DOM 操作开销太大
2. **为什么逻辑和渲染分离**：方便测试，方便未来迁移到 Godot/Unity
3. **为什么 20 波而非无尽**：有明确终点更有成就感，后续可加无尽模式
4. **为什么自动攻击而非手动**：手机触屏操作精确度不够，自动攻击+走位是更好的手游体验
5. **为什么牺牲系统用百分比而非固定值**：保证后期仍然有选择压力
