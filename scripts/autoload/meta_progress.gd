## 永久进度系统（全局单例）
## 管理余烬货币、解锁内容、统计数据
extends Node

## 余烬货币
var ember_currency: int = 0
## 已解锁的卡牌
var unlocked_cards: Array[String] = []
## 已解锁的小丑牌
var unlocked_jokers: Array[String] = []
## 已解锁的宿主
var unlocked_hosts: Array[String] = ["warrior", "mage", "beast"]
## 最高通关难度
var highest_difficulty: int = 0
## 总运行次数
var total_runs: int = 0
## 总胜利次数
var total_wins: int = 0
## 已发现的隐藏配方
var discovered_recipes: Array[String] = []
## 每日挑战日期
var daily_challenge_date: String = ""
## 每日挑战最高分
var daily_high_score: int = 0

## 信号
signal ember_changed(new_amount: int, delta: int)
signal card_unlocked(card_id: String)
signal host_unlocked(host_id: String)
signal achievement_unlocked(name: String)

var _save_path: String = "user://meta_save.json"

func _ready() -> void:
	load_data()

## 添加余烬
func add_ember(amount: int) -> void:
	ember_currency += amount
	ember_changed.emit(ember_currency, amount)

## 消费余烬
func spend_ember(amount: int) -> bool:
	if ember_currency >= amount:
		ember_currency -= amount
		ember_changed.emit(ember_currency, -amount)
		return true
	return false

## 解锁卡牌
func unlock_card(card_id: String) -> bool:
	if card_id not in unlocked_cards:
		unlocked_cards.append(card_id)
		card_unlocked.emit(card_id)
		save_data()
		return true
	return false

## 卡牌是否已解锁
func is_card_unlocked(card_id: String) -> bool:
	return card_id in unlocked_cards

## 解锁宿主
func unlock_host(host_id: String) -> bool:
	if host_id not in unlocked_hosts:
		unlocked_hosts.append(host_id)
		host_unlocked.emit(host_id)
		save_data()
		return true
	return false

## 发现配方
func discover_recipe(recipe_id: String) -> bool:
	if recipe_id not in discovered_recipes:
		discovered_recipes.append(recipe_id)
		save_data()
		return true
	return false

## 保存数据
func save_data() -> void:
	var data = {
		"ember_currency": ember_currency,
		"unlocked_cards": unlocked_cards,
		"unlocked_jokers": unlocked_jokers,
		"unlocked_hosts": unlocked_hosts,
		"highest_difficulty": highest_difficulty,
		"total_runs": total_runs,
		"total_wins": total_wins,
		"discovered_recipes": discovered_recipes,
		"daily_challenge_date": daily_challenge_date,
		"daily_high_score": daily_high_score,
	}
	var file = FileAccess.open(_save_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data, "\t"))
		file.close()

## 加载数据
func load_data() -> void:
	if not FileAccess.file_exists(_save_path):
		return
	var file = FileAccess.open(_save_path, FileAccess.READ)
	if not file:
		return
	var json = JSON.new()
	var err = json.parse(file.get_as_text())
	file.close()
	if err != OK:
		return
	var data = json.data
	if data is Dictionary:
		ember_currency = data.get("ember_currency", 0)
		unlocked_cards.assign(data.get("unlocked_cards", []))
		unlocked_jokers.assign(data.get("unlocked_jokers", []))
		unlocked_hosts.assign(data.get("unlocked_hosts", ["warrior", "mage", "beast"]))
		highest_difficulty = data.get("highest_difficulty", 0)
		total_runs = data.get("total_runs", 0)
		total_wins = data.get("total_wins", 0)
		discovered_recipes.assign(data.get("discovered_recipes", []))
		daily_challenge_date = data.get("daily_challenge_date", "")
		daily_high_score = data.get("daily_high_score", 0)
	print("[MetaProgress] 加载完成：余烬=", ember_currency, " 运行=", total_runs)

## 重置所有进度
func reset_all() -> void:
	ember_currency = 0
	unlocked_cards.clear()
	unlocked_jokers.clear()
	unlocked_hosts = ["warrior", "mage", "beast"]
	highest_difficulty = 0
	total_runs = 0
	total_wins = 0
	discovered_recipes.clear()
	daily_challenge_date = ""
	daily_high_score = 0
	save_data()
