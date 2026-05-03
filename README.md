# 余烬 Ember

融合卡牌构筑、献祭代价和肉鸽生存的小游戏原型。

## 当前可玩版本

Web / 手机浏览器测试版：

https://2456018331lby-dev.github.io/ember-roguelike/

手机打开后可以通过浏览器菜单“添加到主屏幕”，会像 App 一样全屏启动。

## 当前测试版内容

- 献祭模式 MVP
- 左下虚拟摇杆移动
- 自动攻击最近敌人
- 每波清空后 3 选 1 卡牌奖励
- 每张卡牌都有献祭代价
- 连续牺牲同一属性 3 次触发极端化效果
- 小丑牌 / 被动牌 / 攻击牌基础体系
- PWA 离线缓存

## 本地运行

```bash
npm test
npm run serve
```

打开：

```text
http://127.0.0.1:5173
```

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
