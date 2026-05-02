# ============================================================
# sacrifice_sys.gd - 祭祀系统
# 管理献祭卡牌、追踪已献祭属性、触发极化效果
# ============================================================
class_name SacrificeSystem
extends Node

## 极化触发阈值（同一属性献祭次数）
const EXTREME_THRESHOLD: int = 3

## 已献祭的属性值（负值表示降低）
var sacrificed_stats: Dictionary = {
	"speed": 0.0,
	"attack": 0.0,
	"health": 0.0,
	"attack_speed": 0.0,
}

## 每个属性被献祭的次数
var sacrifice_count: Dictionary = {
	"speed": 0,
	"attack": 0,
	"health": 0,
	"attack_speed": 0,
}

## 已触发的极化效果列表
var triggered_extremes: Array[String] = []

## 隐藏配方数据（特殊组合触发）
var hidden_recipes: Dictionary = {
	# 格式：{属性组合: 触发效果名称}
	"speed+attack": "狂战士之怒",
	"health+attack_speed": "不朽脉动",
	"speed+health": "不死之躯",
	"attack+attack_speed": "毁灭风暴",
}

## 信号：献祭完成
signal sacrifice_applied(stat_type: String, amount: float)
## 信号：极化效果触发
signal extreme_triggered(effect_name: String)


## 执行献祭
func apply_sacrifice(card: Resource) -> void:
	# 卡牌需要有 sacrifice_cost 属性
	# 格式: {"speed": -10, "attack": -5, ...}
	if not card or not card.has_method("get") and not "sacrifice_cost" in card:
		push_warning("[祭祀系统] 卡牌缺少 sacrifice_cost 属性")
		return

	var cost: Dictionary = card.sacrifice_cost

	for stat_type in cost.keys():
		if stat_type in sacrificed_stats:
			var amount: float = cost[stat_type]
			sacrificed_stats[stat_type] += amount
			sacrifice_count[stat_type] += 1
			sacrifice_applied.emit(stat_type, amount)
			print("[祭祀系统] 献祭 %s: %.1f（累计: %.1f，次数: %d）" % [
				stat_type, amount, sacrificed_stats[stat_type], sacrifice_count[stat_type]
			])

	# 检查是否触发极化效果
	var extreme: Variant = check_extreme化()
	if extreme != null:
		extreme_triggered.emit(extreme)
		print("[祭祀系统] ★ 极化效果触发: ", extreme)

	# 检查隐藏配方
	_check_hidden_recipes(cost.keys())


## 检查极化效果是否触发（同一属性献祭3次）
func check_extreme化() -> String:
	for stat_type in sacrifice_count.keys():
		if sacrifice_count[stat_type] >= EXTREME_THRESHOLD:
			var effect_name: String = _get_extreme_name(stat_type)
			if effect_name not in triggered_extremes:
				triggered_extremes.append(effect_name)
				return effect_name
	return ""


## 获取极化效果名称
func _get_extreme_name(stat_type: String) -> String:
	var extreme_names: Dictionary = {
		"speed": "虚无疾行",
		"attack": "血刃暴走",
		"health": "不死祭品",
		"attack_speed": "时停脉冲",
	}
	return extreme_names.get(stat_type, "未知极化")


## 获取所有属性修改量（供玩家计算实际属性）
func get_all_modifiers() -> Dictionary:
	var modifiers: Dictionary = {}

	# 基础献祭修改
	for stat_type in sacrificed_stats.keys():
		modifiers[stat_type] = sacrificed_stats[stat_type]

	# 极化效果加成
	for extreme in triggered_extremes:
		var bonus: Dictionary = _get_extreme_bonus(extreme)
		for key in bonus.keys():
			if key in modifiers:
				modifiers[key] += bonus[key]
			else:
				modifiers[key] = bonus[key]

	return modifiers


## 获取极化效果的具体加成
func _get_extreme_bonus(effect_name: String) -> Dictionary:
	match effect_name:
		"虚无疾行":
			return {"speed": 50.0, "attack_speed": 0.3}
		"血刃暴走":
			return {"attack": 30.0, "speed": -10.0}
		"不死祭品":
			return {"health": 100.0, "speed": -20.0}
		"时停脉冲":
			return {"attack_speed": 0.5, "attack": 15.0}
		_:
			return {}


## 检查隐藏配方
func _check_hidden_recipes(sacrificed_types: Array) -> void:
	# 检查两两组合
	for i in range(sacrificed_types.size()):
		for j in range(i + 1, sacrificed_types.size()):
			var combo: String = sacrificed_types[i] + "+" + sacrificed_types[j]
			var reverse_combo: String = sacrificed_types[j] + "+" + sacrificed_types[i]

			if combo in hidden_recipes:
				var recipe_name: String = hidden_recipes[combo]
				if recipe_name not in triggered_extremes:
					triggered_extremes.append(recipe_name)
					extreme_triggered.emit(recipe_name)
					print("[祭祀系统] ★★ 隐藏配方触发: ", recipe_name)
			elif reverse_combo in hidden_recipes:
				var recipe_name: String = hidden_recipes[reverse_combo]
				if recipe_name not in triggered_extremes:
					triggered_extremes.append(recipe_name)
					extreme_triggered.emit(recipe_name)
					print("[祭祀系统] ★★ 隐藏配方触发: ", recipe_name)


## 重置祭祀系统
func reset() -> void:
	for key in sacrificed_stats.keys():
		sacrificed_stats[key] = 0.0
		sacrifice_count[key] = 0
	triggered_extremes.clear()
	print("[祭祀系统] 已重置")


## 获取当前状态摘要
func get_status_summary() -> String:
	var summary: String = "=== 祭祀状态 ===\n"
	for stat_type in sacrificed_stats.keys():
		summary += "%s: 献祭 %d 次，累计 %.1f\n" % [
			stat_type, sacrifice_count[stat_type], sacrificed_stats[stat_type]
		]
	if triggered_extremes.size() > 0:
		summary += "极化效果: " + ", ".join(triggered_extremes)
	return summary
