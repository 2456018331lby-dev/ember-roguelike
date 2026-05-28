# 余烬 Ember

融合卡牌构筑、献祭代价和肉鸽生存的小游戏原型。

## 当前定位

当前唯一持续演进的玩法主线是 `web/` 下的 Web/PWA 版本。

这条主线同时承担：
- Web/PWA 测试版
- Android APK 的第一阶段内容来源
- 未来桌面 / Steam 扩展的逻辑基底

在线测试版：

https://2456018331lby-dev.github.io/ember-roguelike/

手机打开后可以通过浏览器菜单“添加到主屏幕”，像 App 一样全屏启动。

## 当前测试版内容

- 献祭模式 MVP
- 左下虚拟摇杆移动
- 键盘 WASD / 方向键移动
- 自动攻击最近敌人
- 每波清空后 3 选 1 卡牌奖励
- 每张卡牌都有献祭代价
- 连续牺牲同一属性 3 次触发极端化效果
- 小丑牌 / 被动牌 / 攻击牌基础体系
- PWA 离线缓存

## 本地运行与校验

```bash
npm install
npm test
npm run serve
```

打开：

```text
http://127.0.0.1:5173
```

常用命令：

```bash
npm run check
npm run sync:web
npm run android:sync
npm run android:open
```

## 平台路线

1. **Web / PWA**：继续作为玩法验证主线。
2. **Android APK**：通过 Capacitor 包装现有 Web 版本，不额外复制一套玩法代码。
3. **桌面 / Steam 预留**：当前先做输入、分辨率、存档与发布边界预留，不在第一批直接接 Steamworks。
4. **Godot 骨架保留**：如未来 Web 壳在性能、原生输入或桌面功能上成为瓶颈，再重新评估是否切回 Godot 主线。

更完整的平台路线见 [RELEASE_PLAN.md](RELEASE_PLAN.md)。

## 目录说明

- `web/`：当前源码主目录与可玩主线
- `docs/`：GitHub Pages 发布镜像，由 `npm run sync:web` 同步
- `tests/`：核心玩法逻辑测试
- `scripts/sync-web.mjs`：把 `web/` 的发布资产同步到 `docs/`
- `capacitor.config.json`：Android 包装配置，直接以 `web/` 为原生包体来源
- `GDD.md`：长期设计文档
- `MAINTENANCE.md`：维护与接手文档
- `RELEASE_PLAN.md`：Web → Android → 桌面路线文档
- `scripts/`, `scenes/`, `data/`：保留中的 Godot 4 骨架
