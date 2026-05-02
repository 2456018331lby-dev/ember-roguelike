## card_fusion.gd
## 融合卡 - 由两张卡牌合成而成的特殊卡牌
## 融合卡继承组件卡的特性，并获得独特的强化效果
class_name CardFusion
extends CardBase

## ==================== 属性 ====================

## 组件卡牌A的ID
var component_a_id: String = ""

## 组件卡牌B的ID
var component_b_id: String = ""

## 融合配方表 - 静态数据
## 键: "id_a+id_b"(排序后), 值: 融合结果数据
static var fusion_recipes: Dictionary = {
	# 攻击 + 防御 = 战术打击(伤害+护盾)
	"attack_slam+defense_wall": {
		"card_name": "战术打击",
		"description": "造成伤害的同时获得护盾",
		"card_type": CardBase.CardType.FUSION,
		"rarity": CardBase.Rarity.BLUE,
		"cost": 3,
		"effects": [
			{"type": "direct_damage", "value": 15.0, "target": "enemy"},
			{"type": "shield", "value": 10.0, "target": "self"}
		]
	},
	# 攻击 + 攻击 = 毁灭打击(高伤害AOE)
	"attack_slam+attack_slash": {
		"card_name": "毁灭打击",
		"description": "对所有敌人造成大量伤害",
		"card_type": CardBase.CardType.FUSION,
		"rarity": CardBase.Rarity.PURPLE,
		"cost": 4,
		"effects": [
			{"type": "aoe_damage", "value": 25.0, "target": "all_enemies"}
		]
	},
	# 防御 + 被动 = 坚韧(护盾+回复)
	"defense_wall+passive_regen": {
		"card_name": "坚韧",
		"description": "获得护盾并在每回合回复生命",
		"card_type": CardBase.CardType.FUSION,
		"rarity": CardBase.Rarity.PURPLE,
		"cost": 3,
		"effects": [
			{"type": "shield", "value": 8.0, "target": "self"},
			{"type": "regen", "value": 3.0, "target": "self"}
		]
	}
}

## ==================== 信号 ====================

## 融合成功时发出信号
signal fusion_completed(result_card: CardFusion)

## ==================== 静态方法 ====================

## 检查两张卡牌是否可以融合
## @param card_a: 第一张卡牌
## @param card_b: 第二张卡牌
## @param recipes: 融合配方表(可选，使用默认表传 null)
## @return: 是否可以融合
static func can_fuse(card_a: CardBase, card_b: CardBase, recipes: Dictionary = {}) -> bool:
	# 空卡牌不能融合
	if card_a == null or card_b == null:
		return false

	# 诅咒卡不能参与融合
	if card_a.is_cursed or card_b.is_cursed:
		return false

	# 使用自定义配方表或默认表
	var recipe_table: Dictionary = recipes if not recipes.is_empty() else fusion_recipes

	# 生成配方键(排序后确保双向匹配)
	var recipe_key: String = _get_recipe_key(card_a.id, card_b.id)

	# 检查配方是否存在
	if recipe_table.has(recipe_key):
		return true

	# 也检查通用融合规则(相同类型+相同稀有度)
	if card_a.card_type == card_b.card_type and card_a.rarity == card_b.rarity:
		return true

	return false

## 执行融合，创建新的融合卡
## @param card_a: 第一张卡牌(不会被修改)
## @param card_b: 第二张卡牌(不会被修改)
## @param recipes: 融合配方表(可选)
## @return: 融合后的卡牌，失败返回 null
static func fuse(card_a: CardBase, card_b: CardBase, recipes: Dictionary = {}) -> CardFusion:
	if not can_fuse(card_a, card_b, recipes):
		push_warning("融合失败: [%s] 和 [%s] 无法融合" % [card_a.card_name, card_b.card_name])
		return null

	# 使用自定义配方表或默认表
	var recipe_table: Dictionary = recipes if not recipes.is_empty() else fusion_recipes

	# 生成配方键
	var recipe_key: String = _get_recipe_key(card_a.id, card_b.id)

	# 创建融合卡
	var fused_card: CardFusion = CardFusion.new()

	# 记录组件卡牌ID
	fused_card.component_a_id = card_a.id
	fused_card.component_b_id = card_b.id

	if recipe_table.has(recipe_key):
		# 使用预定义配方
		var recipe: Dictionary = recipe_table[recipe_key]
		fused_card.id = "fusion_%s" % recipe_key
		fused_card.card_name = recipe.get("card_name", "融合卡")
		fused_card.description = recipe.get("description", "")
		fused_card.card_type = recipe.get("card_type", CardBase.CardType.FUSION)
		fused_card.rarity = recipe.get("rarity", CardBase.Rarity.BLUE)
		fused_card.cost = recipe.get("cost", _calculate_fusion_cost(card_a, card_b))
		fused_card.effects = recipe.get("effects", [])
	else:
		# 通用融合: 合并两张卡的效果并强化
		fused_card.id = "fusion_%s" % recipe_key
		fused_card.card_name = "%s + %s" % [card_a.card_name, card_b.card_name]
		fused_card.description = "融合卡: %s" % [
			card_a.description + " & " + card_b.description
		]
		fused_card.card_type = CardBase.CardType.FUSION
		fused_card.rarity = _get_fused_rarity(card_a, card_b)
		fused_card.cost = _calculate_fusion_cost(card_a, card_b)
		fused_card.effects = _merge_effects(card_a.effects, card_b.effects)

	print("融合成功: [%s] + [%s] → [%s]" % [
		card_a.card_name, card_b.card_name, fused_card.card_name
	])

	return fused_card

## ==================== 静态辅助方法 ====================

## 生成融合配方键(排序保证唯一性)
## @param id_a: 第一张卡牌ID
## @param id_b: 第二张卡牌ID
## @return: 排序后的配方键
static func _get_recipe_key(id_a: String, id_b: String) -> String:
	if id_a < id_b:
		return "%s+%s" % [id_a, id_b]
	else:
		return "%s+%s" % [id_b, id_a]

## 计算融合后的卡牌费用
## @param card_a: 组件卡A
## @param card_b: 组件卡B
## @return: 融合卡费用
static func _calculate_fusion_cost(card_a: CardBase, card_b: CardBase) -> int:
	# 融合卡费用 = 两卡费用之和 × 0.8(向下取整，最少1)
	var combined_cost: int = card_a.cost + card_b.cost
	var fused_cost: int = maxi(1, int(combined_cost * 0.8))
	return fused_cost

## 获取融合后的稀有度(取较高稀有度+1)
## @param card_a: 组件卡A
## @param card_b: 组件卡B
## @return: 融合后稀有度
static func _get_fused_rarity(card_a: CardBase, card_b: CardBase) -> CardBase.Rarity:
	var higher_rarity: int = maxi(card_a.rarity, card_b.rarity)
	# 稀有度提升一级，但不超过GOLD
	return mini(higher_rarity + 1, CardBase.Rarity.GOLD) as CardBase.Rarity

## 合并两组效果并强化
## @param effects_a: 组件卡A的效果列表
## @param effects_b: 组件卡B的效果列表
## @return: 合并后的效果列表
static func _merge_effects(effects_a: Array[Dictionary], effects_b: Array[Dictionary]) -> Array[Dictionary]:
	var merged: Array[Dictionary] = []

	# 添加A的效果(数值×1.2强化)
	for effect: Dictionary in effects_a:
		var enhanced: Dictionary = effect.duplicate()
		enhanced["value"] = enhanced.get("value", 0.0) * 1.2
		merged.append(enhanced)

	# 添加B的效果(数值×1.2强化)
	for effect: Dictionary in effects_b:
		var enhanced: Dictionary = effect.duplicate()
		enhanced["value"] = enhanced.get("value", 0.0) * 1.2
		merged.append(enhanced)

	return merged

## ==================== 实例方法 ====================

## 重写执行方法 - 融合卡同时应用所有组件效果
## @param user: 使用者
## @param target: 目标
func execute(user, target) -> void:
	if effects.is_empty():
		push_warning("融合卡 [%s] 没有配置任何效果" % card_name)
		return

	# 检查并扣除献祭消耗
	if not sacrifice_cost.is_empty():
		if not _pay_sacrifice_cost(user):
			return

	# 融合卡执行时触发特效(可扩展为动画/音效)
	print("✦✦✦ 融合卡 [%s] 发动! ✦✦✦" % card_name)

	# 遍历所有效果并应用
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		var value: float = effect.get("value", 0.0)
		var effect_target_str: String = effect.get("target", "enemy")
		var actual_target = _resolve_target(effect_target_str, user, target)

		# 委托给基类的_apply_effect
		_apply_effect(effect, user, actual_target)

## 注册新的融合配方(可用于游戏运行时动态添加配方)
## @param id_a: 组件卡A的ID
## @param id_b: 组件卡B的ID
## @param recipe_data: 配方数据字典
static func register_recipe(id_a: String, id_b: String, recipe_data: Dictionary) -> void:
	var key: String = _get_recipe_key(id_a, id_b)
	fusion_recipes[key] = recipe_data

## 获取所有可用的融合配方(供UI显示)
## @return: 配方字典
static func get_all_recipes() -> Dictionary:
	return fusion_recipes.duplicate()

## 检查某张卡牌是否有可用的融合配方
## @param card_id: 卡牌ID
## @return: 可融合的卡牌ID列表
static func get_fusion_partners(card_id: String) -> Array[String]:
	var partners: Array[String] = []

	for recipe_key: String in fusion_recipes:
		var parts: PackedStringArray = recipe_key.split("+")
		if parts.size() == 2:
			if parts[0] == card_id:
				partners.append(parts[1])
			elif parts[1] == card_id:
				partners.append(parts[0])

	return partners

## 重写工具提示
## @return: 格式化的工具提示文本
func get_tooltip() -> String:
	var tooltip: String = ""

	tooltip += "✦【%s】(融合)\n" % card_name
	tooltip += "稀有度: %s\n" % _get_rarity_name()
	tooltip += "费用: %d\n" % cost
	tooltip += "————————————\n"
	tooltip += "%s\n" % description

	# 效果详情
	if not effects.is_empty():
		tooltip += "————————————\n"
		for effect: Dictionary in effects:
			tooltip += "· %s\n" % _format_effect(effect)

	# 组件信息
	tooltip += "————————————\n"
	tooltip += "✦ 组件: [%s] + [%s]\n" % [component_a_id, component_b_id]

	return tooltip
