# ============================================================
# fusion_sys.gd - 卡牌融合系统
# 管理卡牌融合配方、执行融合、查询可用融合
# ============================================================
class_name FusionSystem
extends Node

## 融合配方数据
## 格式: { "card_a_id+card_b_id": { result_id, result_name, ... } }
var fusion_recipes: Dictionary = {}

## 融合结果卡牌场景
var card_base_script: Script = preload("res://scripts/cards/card_base.gd") if ResourceLoader.exists("res://scripts/cards/card_base.gd") else null


func _ready() -> void:
	_load_fusion_recipes()
	print("[融合系统] 加载了 ", fusion_recipes.size(), " 个融合配方")


## 从数据文件加载融合配方
func _load_fusion_recipes() -> void:
	# 尝试从JSON文件加载
	var file_path: String = "res://data/fusion_recipes.json"

	if ResourceLoader.exists(file_path):
		var file: FileAccess = FileAccess.open(file_path, FileAccess.READ)
		if file:
			var json_text: String = file.get_as_text()
			file.close()
			var json: JSON = JSON.new()
			var error: Error = json.parse(json_text)
			if error == OK:
				fusion_recipes = json.data
				return

	# 如果文件不存在，使用内置配方
	_load_builtin_recipes()


## 内置默认融合配方
func _load_builtin_recipes() -> void:
	fusion_recipes = {
		# 攻击类融合
		"fire_slash+ice_slash": {
			"id": "elemental_slash",
			"name": "元素斩击",
			"description": "融合火焰与冰霜的双重斩击",
			"type": "attack",
			"damage": 35,
			"effects": ["burn", "freeze"],
		},
		"thunder_bolt+wind_blade": {
			"id": "storm_strike",
			"name": "风暴突袭",
			"description": "雷电与风刃的组合攻击",
			"type": "attack",
			"damage": 40,
			"effects": ["stun", "bleed"],
		},
		# 防御类融合
		"iron_wall+heal_light": {
			"id": "holy_shield",
			"name": "圣光护盾",
			"description": "铁壁与治愈的融合防御",
			"type": "defense",
			"shield": 50,
			"heal": 20,
		},
		# 辅助类融合
		"speed_up+power_up": {
			"id": "adrenaline",
			"name": "肾上腺素",
			"description": "同时提升速度与力量",
			"type": "buff",
			"speed_bonus": 30,
			"attack_bonus": 20,
			"duration": 8.0,
		},
	}


## 检查两张卡牌是否可以融合
func can_fuse(card_a: Resource, card_b: Resource) -> bool:
	if card_a == null or card_b == null:
		return false

	var key_a: String = _get_card_id(card_a)
	var key_b: String = _get_card_id(card_b)

	# 检查两个方向
	var recipe_key: String = key_a + "+" + key_b
	if recipe_key in fusion_recipes:
		return true

	recipe_key = key_b + "+" + key_a
	if recipe_key in fusion_recipes:
		return true

	return false


## 执行融合，返回融合后的卡牌
func perform_fusion(card_a: Resource, card_b: Resource) -> Resource:
	if not can_fuse(card_a, card_b):
		push_warning("[融合系统] 这两张卡牌无法融合")
		return null

	var key_a: String = _get_card_id(card_a)
	var key_b: String = _get_card_id(card_b)

	var recipe_key: String = key_a + "+" + key_b
	if recipe_key not in fusion_recipes:
		recipe_key = key_b + "+" + key_a

	var recipe: Dictionary = fusion_recipes[recipe_key]

	# 创建融合后的卡牌
	var fused_card: Resource = _create_fused_card(recipe)

	print("[融合系统] 融合成功: %s + %s -> %s" % [
		key_a, key_b, recipe.get("name", "未知")
	])

	return fused_card


## 获取手牌中所有可能的融合组合
func get_possible_fusions(hand: Array) -> Array:
	var possible: Array = []  # Array of [card_a, card_b]

	for i in range(hand.size()):
		for j in range(i + 1, hand.size()):
			if can_fuse(hand[i], hand[j]):
				possible.append([hand[i], hand[j]])

	return possible


## 获取卡牌ID
func _get_card_id(card: Resource) -> String:
	if "card_id" in card:
		return card.card_id
	elif "id" in card:
		return card.id
	elif "card_name" in card:
		return card.card_name
	return ""


## 根据融合配方创建新卡牌
func _create_fused_card(recipe: Dictionary) -> Resource:
	# 如果有卡牌基础脚本，用它创建
	if card_base_script != null:
		var card: Resource = card_base_script.new()
		if "id" in recipe:
			card.card_id = recipe["id"]
		if "name" in recipe:
			card.card_name = recipe["name"]
		if "description" in recipe:
			card.description = recipe["description"]
		if "type" in recipe:
			card.card_type = recipe["type"]
		if "damage" in recipe:
			card.damage = recipe["damage"]
		if "effects" in recipe:
			card.effects = recipe["effects"]
		if "shield" in recipe:
			card.shield = recipe["shield"]
		if "heal" in recipe:
			card.heal_amount = recipe["heal"]
		card.is_fused = true
		return card

	# 退化为字典数据
	return recipe as Resource


## 获取融合配方的显示信息
func get_recipe_display(card_a: Resource, card_b: Resource) -> String:
	var key_a: String = _get_card_id(card_a)
	var key_b: String = _get_card_id(card_b)

	var recipe_key: String = key_a + "+" + key_b
	if recipe_key not in fusion_recipes:
		recipe_key = key_b + "+" + key_a

	if recipe_key in fusion_recipes:
		var recipe: Dictionary = fusion_recipes[recipe_key]
		return "%s + %s → %s" % [key_a, key_b, recipe.get("name", "???")]

	return "无法融合"
