## card_joker.gd
## 小丑卡(万能卡) - 全局规则修改器
## 不直接参与战斗，而是修改游戏规则、添加乘数、触发条件效果
## 最多装备5张小丑卡
class_name CardJoker
extends CardBase

## ==================== 常量 ====================

## 最大装备小丑卡数量
const MAX_JOKER_SLOTS: int = 5

## ==================== 效果类型常量 ====================

## 乘数效果 - 对某类数值乘以倍率
const EFFECT_MULTIPLIER: String = "multiplier"

## 规则修改 - 修改游戏基础规则
const EFFECT_RULE_CHANGE: String = "rule_change"

## 条件触发 - 满足条件时触发额外效果
const EFFECT_CONDITIONAL: String = "conditional"

## ==================== 信号 ====================

## 协同效果触发时发出信号
signal synergy_activated(card: CardJoker, synergy_data: Dictionary)

## ==================== 属性 ====================

## 小丑卡的修改器数据
## 例: {"damage_mult": 1.5, "target": "attack_cards"}
var modifier_data: Dictionary = {}

## 已激活的协同效果列表
var active_synergies: Array[Dictionary] = []

## ==================== 方法 ====================

func _init() -> void:
	card_type = CardType.JOKER

## 重写执行方法 - 小丑卡的执行逻辑
## 小丑卡通常在装备时就生效，execute 用于触发条件效果
## @param user: 使用者
## @param target: 上下文目标(通常不用)
func execute(user, target) -> void:
	# 小丑卡的被动效果通过 modifier_data 在装备时注册
	# execute 主要处理条件触发效果
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")

		match effect_type:
			EFFECT_MULTIPLIER:
				_apply_multiplier(user, effect)

			EFFECT_RULE_CHANGE:
				_apply_rule_change(user, effect)

			EFFECT_CONDITIONAL:
				_apply_conditional(user, target, effect)

			_:
				push_warning("小丑卡 [%s] 未识别的效果类型: %s" % [card_name, effect_type])

## 装备小丑卡(注册修改器)
## @param user: 使用者
func equip(user) -> void:
	if user.has_method("add_joker_modifier"):
		user.add_joker_modifier(modifier_data, card_name)
		print("小丑卡 [%s] 已装备，修改器已注册" % card_name)

## 卸下小丑卡(移除修改器)
## @param user: 使用者
func unequip(user) -> void:
	if user.has_method("remove_joker_modifier"):
		user.remove_joker_modifier(card_name)
		active_synergies.clear()
		print("小丑卡 [%s] 已卸下，修改器已移除" % card_name)

## 应用乘数效果
## @param user: 使用者
## @param effect: 效果字典
func _apply_multiplier(user, effect: Dictionary) -> void:
	var mult_type: String = effect.get("mult_type", "")
	var value: float = effect.get("value", 1.0)
	var target_category: String = effect.get("target_category", "all")

	# 存储乘数数据供外部系统查询
	modifier_data["multiplier"] = {
		"type": mult_type,
		"value": value,
		"category": target_category
	}

	print("小丑卡 [%s] 注册乘数: %s x%.2f (范围: %s)" % [
		card_name, mult_type, value, target_category
	])

## 应用规则修改效果
## @param user: 使用者
## @param effect: 效果字典
func _apply_rule_change(user, effect: Dictionary) -> void:
	var rule_name: String = effect.get("rule", "")
	var rule_value: float = effect.get("value", 0.0)

	# 存储规则修改数据
	if not modifier_data.has("rule_changes"):
		modifier_data["rule_changes"] = {}

	modifier_data["rule_changes"][rule_name] = rule_value

	print("小丑卡 [%s] 修改规则: %s = %.2f" % [card_name, rule_name, rule_value])

	# 常见规则修改示例
	match rule_name:
		"extra_draw":
			# 额外抽牌数
			if user.has_method("modify_draw_count"):
				user.modify_draw_count(int(rule_value))
		"cost_reduction":
			# 所有卡牌费用减少
			if user.has_method("add_cost_modifier"):
				user.add_cost_modifier(-int(rule_value), "joker_%s" % id)
		"free_reroll":
			# 免费重掷次数
			if user.has_method("add_free_rerolls"):
				user.add_free_rerolls(int(rule_value))

## 应用条件触发效果
## @param user: 使用者
## @param target: 目标/上下文
## @param effect: 效果字典
func _apply_conditional(user, target, effect: Dictionary) -> void:
	var trigger: String = effect.get("trigger", "")
	var trigger_value: float = effect.get("trigger_value", 0.0)
	var action: String = effect.get("action", "")
	var action_value: float = effect.get("action_value", 0.0)

	# 条件触发效果存储到modifier_data中供外部系统查询
	if not modifier_data.has("conditional_effects"):
		modifier_data["conditional_effects"] = []

	modifier_data["conditional_effects"].append({
		"trigger": trigger,
		"trigger_value": trigger_value,
		"action": action,
		"action_value": action_value
	})

## 检查与其他小丑卡的协同效果
## @param other_jokers: 已装备的其他小丑卡数组
## @return: 是否触发了新的协同效果
func check_synergy(other_jokers: Array) -> bool:
	var found_synergy: bool = false

	for other: CardJoker in other_jokers:
		if other == self:
			continue

		# 检查ID组合是否形成协同
		var synergy_key: String = _get_synergy_key(id, other.id)

		# 检查预定义协同组合
		if SYNERGY_TABLE.has(synergy_key):
			var synergy_data: Dictionary = SYNERGY_TABLE[synergy_key]

			# 避免重复激活
			if not _has_active_synergy(synergy_key):
				active_synergies.append({
					"key": synergy_key,
					"partner_id": other.id,
					"data": synergy_data
				})
				synergy_activated.emit(self, synergy_data)
				print("小丑卡 [%s] 与 [%s] 触发协同效果: %s" % [
					card_name, other.card_name, synergy_data.get("name", "???")
				])
				found_synergy = true

	# 检查套装效果(同类小丑卡数量)
	var type_count: int = 1  # 包含自身
	for other: CardJoker in other_jokers:
		if other != self and other.id.begins_with(id.get_slice("_", 0)):
			type_count += 1

	# 套装效果检查
	if SET_BONUS_TABLE.has(type_count):
		var set_bonus: Dictionary = SET_BONUS_TABLE[type_count]
		if not _has_active_synergy("set_%d" % type_count):
			active_synergies.append({
				"key": "set_%d" % type_count,
				"partner_id": "set",
				"data": set_bonus
			})
			print("小丑卡 [%s] 激活套装效果(%d件套)" % [card_name, type_count])
			found_synergy = true

	return found_synergy

## 获取协同键(排序保证唯一性)
## @param id_a: 第一张小丑卡ID
## @param id_b: 第二张小丑卡ID
## @return: 协同键字符串
func _get_synergy_key(id_a: String, id_b: String) -> String:
	if id_a < id_b:
		return "%s+%s" % [id_a, id_b]
	else:
		return "%s+%s" % [id_b, id_a]

## 检查是否已有某协同效果
## @param key: 协同键
## @return: 是否已激活
func _has_active_synergy(key: String) -> bool:
	for synergy: Dictionary in active_synergies:
		if synergy.get("key", "") == key:
			return true
	return false

## 静态: 检查是否还能装备更多小丑卡
## @param current_count: 当前已装备小丑卡数量
## @return: 是否有空槽位
static func can_equip_more(current_count: int) -> bool:
	return current_count < MAX_JOKER_SLOTS

## 获取所有激活的协同效果的总乘数
## @return: 总乘数值
func get_total_synergy_multiplier() -> float:
	var total: float = 1.0
	for synergy: Dictionary in active_synergies:
		var data: Dictionary = synergy.get("data", {})
		total *= data.get("multiplier", 1.0)
	return total

## 重写工具提示
## @return: 格式化的工具提示文本
func get_tooltip() -> String:
	var tooltip: String = ""

	tooltip += "🃏【%s】(小丑)\n" % card_name
	tooltip += "稀有度: %s\n" % _get_rarity_name()
	tooltip += "————————————\n"
	tooltip += "%s\n" % description

	# 效果详情
	if not effects.is_empty():
		tooltip += "————————————\n"
		for effect: Dictionary in effects:
			tooltip += "· %s\n" % _format_effect(effect)

	# 协同效果
	if not active_synergies.is_empty():
		tooltip += "————————————\n"
		tooltip += "✦ 激活的协同:\n"
		for synergy: Dictionary in active_synergies:
			var data: Dictionary = synergy.get("data", {})
			tooltip += "  · %s\n" % data.get("name", "未知协同")

	tooltip += "————————————\n"
	tooltip += "最多装备 %d 张小丑卡\n" % MAX_JOKER_SLOTS

	return tooltip

## 重写效果描述格式化
## @param effect: 效果字典
## @return: 格式化描述
func _format_effect(effect: Dictionary) -> String:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)

	match effect_type:
		EFFECT_MULTIPLIER:
			return "%s x%.2f" % [effect.get("mult_type", "???"), value]
		EFFECT_RULE_CHANGE:
			return "规则: %s = %.2f" % [effect.get("rule", "???"), value]
		EFFECT_CONDITIONAL:
			return "当%s时: %s +%.1f" % [
				effect.get("trigger", "???"),
				effect.get("action", "???"),
				effect.get("action_value", 0.0)
			]
		_:
			return super._format_effect(effect)

## ==================== 静态数据: 协同效果表 ====================

## 预定义的协同效果组合
## 键为排序后的ID组合("id_a+id_b")
const SYNERGY_TABLE: Dictionary = {
	# 示例协同效果
	"joker_bleed+joker_poison": {
		"name": "剧毒之血",
		"description": "流血和中毒效果同时存在时，伤害提升50%",
		"multiplier": 1.5,
		"condition": "both_dot_active"
	},
	"joker_fire+joker_ice": {
		"name": "冰火两重天",
		"description": "同时拥有冰火效果时，触发融化伤害",
		"multiplier": 2.0,
		"condition": "elemental_conflict"
	},
	"joker_lucky+joker_greedy": {
		"name": "富贵险中求",
		"description": "金币获取翻倍，但商店价格+50%",
		"multiplier": 2.0,
		"condition": "always"
	}
}

## 套装效果表(同类小丑卡数量对应的效果)
const SET_BONUS_TABLE: Dictionary = {
	2: {
		"name": "双子之力",
		"description": "同类小丑卡2件套: 所有效果+25%",
		"multiplier": 1.25
	},
	3: {
		"name": "三位一体",
		"description": "同类小丑卡3件套: 所有效果+50%",
		"multiplier": 1.5
	},
	5: {
		"name": "王牌全满",
		"description": "同类小丑卡5件套: 所有效果翻倍",
		"multiplier": 2.0
	}
}
