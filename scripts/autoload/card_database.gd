## 卡牌数据库（全局单例）
## 管理所有卡牌数据的加载和查询
extends Node

## 卡牌类型枚举
enum CardType { ATTACK, DEFENSE, PASSIVE, CURSE, JOKER, FUSION }

## 稀有度枚举
enum Rarity { WHITE, GREEN, BLUE, PURPLE, GOLD }

## 所有卡牌数据 {id: CardData}
var cards: Dictionary = {}

## 内置备用卡牌（JSON 加载失败时使用）
var _fallback_cards: Array[Dictionary] = [
	{
		"id": "strike", "name": "斩击", "type": "ATTACK", "rarity": "WHITE",
		"cost": 1, "description": "造成 8 点伤害",
		"effects": [{"type": "direct_damage", "value": 8, "target": "enemy"}],
		"sacrifice_cost": {}
	},
	{
		"id": "defend", "name": "防御", "type": "DEFENSE", "rarity": "WHITE",
		"cost": 1, "description": "获得 5 点护盾",
		"effects": [{"type": "shield", "value": 5, "target": "self"}],
		"sacrifice_cost": {}
	},
	{
		"id": "fireball", "name": "火球术", "type": "ATTACK", "rarity": "GREEN",
		"cost": 2, "description": "造成 15 点伤害，附带 3 点灼烧",
		"effects": [
			{"type": "direct_damage", "value": 15, "target": "enemy"},
			{"type": "dot_damage", "value": 3, "target": "enemy"}
		],
		"sacrifice_cost": {"stat": "attack_speed", "amount": 0.1}
	},
	{
		"id": "iron_wall", "name": "铁壁", "type": "DEFENSE", "rarity": "GREEN",
		"cost": 2, "description": "获得 12 点护盾",
		"effects": [{"type": "shield", "value": 12, "target": "self"}],
		"sacrifice_cost": {"stat": "speed", "amount": 0.15}
	},
	{
		"id": "thorns", "name": "荆棘", "type": "PASSIVE", "rarity": "GREEN",
		"cost": 0, "description": "受到伤害时反弹 3 点",
		"effects": [{"type": "thorns", "value": 3, "target": "self"}],
		"sacrifice_cost": {"stat": "health", "amount": 0.1}
	},
	{
		"id": "blood_pact", "name": "血之契约", "type": "CURSE", "rarity": "BLUE",
		"cost": 0, "description": "每波开始失去 5% 最大生命，但攻击 +20%",
		"effects": [
			{"type": "reduce_stat", "value": 0.05, "target": "self"},
			{"type": "buff_attack", "value": 0.2, "target": "self"}
		],
		"sacrifice_cost": {"stat": "health", "amount": 0.15}
	},
	{
		"id": "flame_sword", "name": "烈焰剑", "type": "ATTACK", "rarity": "BLUE",
		"cost": 2, "description": "造成 20 点火焰伤害",
		"effects": [
			{"type": "direct_damage", "value": 20, "target": "enemy"},
			{"type": "dot_damage", "value": 5, "target": "enemy"}
		],
		"sacrifice_cost": {"stat": "speed", "amount": 0.2}
	},
	# 小丑牌
	{
		"id": "joker_blood_debt", "name": "血债", "type": "JOKER", "rarity": "PURPLE",
		"cost": 0, "description": "每次受伤时，下次攻击伤害 x1.5（可叠加）",
		"effects": [{"type": "multiplier", "value": 1.5, "target": "next_attack_on_hit"}],
		"sacrifice_cost": {}
	},
	{
		"id": "joker_gambler", "name": "赌徒", "type": "JOKER", "rarity": "PURPLE",
		"cost": 0, "description": "每张牌 50% 概率效果翻倍，50% 概率无效",
		"effects": [{"type": "conditional", "value": 0.5, "target": "all_cards"}],
		"sacrifice_cost": {}
	},
	{
		"id": "joker_collector", "name": "收藏家", "type": "JOKER", "rarity": "PURPLE",
		"cost": 0, "description": "每拥有 10 张牌，所有牌效果 +5%",
		"effects": [{"type": "multiplier", "value": 0.05, "target": "per_10_cards"}],
		"sacrifice_cost": {}
	},
	{
		"id": "joker_countdown", "name": "倒计时", "type": "JOKER", "rarity": "GOLD",
		"cost": 0, "description": "战斗开始时倒计 10 秒，到 0 时秒杀所有敌人",
		"effects": [{"type": "rule_change", "value": 10, "target": "countdown_kill"}],
		"sacrifice_cost": {}
	},
	# 融合牌
	{
		"id": "fusion_flame_slash", "name": "火焰旋风", "type": "FUSION", "rarity": "GOLD",
		"cost": 3, "description": "融合技：造成 35 点范围火焰伤害",
		"effects": [
			{"type": "aoe_damage", "value": 35, "target": "all_enemies"},
			{"type": "dot_damage", "value": 8, "target": "all_enemies"}
		],
		"sacrifice_cost": {},
		"components": ["strike", "fireball"]
	},
	# 更多普通牌
	{
		"id": "quick_slash", "name": "快斩", "type": "ATTACK", "rarity": "WHITE",
		"cost": 1, "description": "造成 5 点伤害，抽 1 张牌",
		"effects": [
			{"type": "direct_damage", "value": 5, "target": "enemy"},
			{"type": "draw", "value": 1, "target": "self"}
		],
		"sacrifice_cost": {}
	},
	{
		"id": "heal", "name": "治愈", "type": "DEFENSE", "rarity": "GREEN",
		"cost": 1, "description": "恢复 8 点生命",
		"effects": [{"type": "heal", "value": 8, "target": "self"}],
		"sacrifice_cost": {"stat": "attack", "amount": 0.05}
	},
	{
		"id": "rage", "name": "狂暴", "type": "PASSIVE", "rarity": "BLUE",
		"cost": 0, "description": "生命低于 30% 时攻击翻倍",
		"effects": [{"type": "conditional_buff", "value": 2.0, "target": "self", "condition": "low_hp"}],
		"sacrifice_cost": {"stat": "health", "amount": 0.2}
	},
	{
		"id": "vampiric_strike", "name": "吸血斩", "type": "ATTACK", "rarity": "BLUE",
		"cost": 2, "description": "造成 12 点伤害，恢复等量生命",
		"effects": [
			{"type": "direct_damage", "value": 12, "target": "enemy"},
			{"type": "lifesteal", "value": 12, "target": "self"}
		],
		"sacrifice_cost": {"stat": "speed", "amount": 0.1}
	},
]

func _ready() -> void:
	_load_cards()

## 从 JSON 加载卡牌，失败则使用内置数据
func _load_cards() -> void:
	var file = FileAccess.open("res://data/cards.json", FileAccess.READ)
	if file:
		var json = JSON.new()
		var err = json.parse(file.get_as_text())
		if err == OK and json.data is Array:
			for card_data in json.data:
				cards[card_data["id"]] = card_data
			print("[CardDatabase] 从 JSON 加载了 ", cards.size(), " 张卡牌")
			return
	
	# 使用内置数据
	for card_data in _fallback_cards:
		cards[card_data["id"]] = card_data
	print("[CardDatabase] 使用内置数据加载了 ", cards.size(), " 张卡牌")

## 根据 ID 获取卡牌
func get_card(id: String) -> Dictionary:
	return cards.get(id, {})

## 按类型获取所有卡牌
func get_cards_by_type(type_str: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for card in cards.values():
		if card.get("type", "") == type_str:
			result.append(card)
	return result

## 按稀有度获取所有卡牌
func get_cards_by_rarity(rarity_str: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for card in cards.values():
		if card.get("rarity", "") == rarity_str:
			result.append(card)
	return result

## 获取随机卡牌
func get_random_cards(count: int, filters: Dictionary = {}) -> Array[Dictionary]:
	var pool: Array[Dictionary] = []
	for card in cards.values():
		var match = true
		if filters.has("type") and card.get("type", "") != filters["type"]:
			match = false
		if filters.has("rarity") and card.get("rarity", "") != filters["rarity"]:
			match = false
		if filters.has("exclude") and card["id"] in filters["exclude"]:
			match = false
		if match:
			pool.append(card)
	
	pool.shuffle()
	var result: Array[Dictionary] = []
	for i in mini(count, pool.size()):
		result.append(pool[i])
	return result

## 获取所有卡牌数量
func get_card_count() -> int:
	return cards.size()
