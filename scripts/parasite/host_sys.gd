# ============================================================
# host_sys.gd - 宿主系统（寄生模式）
# 管理寄生宿主、属性继承、裸体寄生倒计时
# ============================================================
class_name HostSystem
extends Node

## 宿主数据类
class HostData:
	var name: String = ""
	var base_hp: float = 100.0
	var base_speed: float = 200.0
	var base_attack: float = 10.0
	var card倾向: Array[String] = []  # 该宿主倾向于获得的卡牌类型
	var special_ability: String = ""   # 宿主特殊能力名称
	var sprite_path: String = ""       # 宿主精灵图路径

	func _init(
		p_name: String = "",
		p_hp: float = 100.0,
		p_speed: float = 200.0,
		p_attack: float = 10.0,
		p_card倾向: Array[String] = [],
		p_ability: String = "",
		p_sprite: String = ""
	) -> void:
		name = p_name
		base_hp = p_hp
		base_speed = p_speed
		base_attack = p_attack
		card倾向 = p_card倾向
		special_ability = p_ability
		sprite_path = p_sprite


## 裸体寄生倒计时（秒）
const NAKED_MODE_DURATION: float = 5.0

## 继承卡牌的概率基础值
const BASE_INHERIT_RATE: float = 0.3
## 寄生时长每秒增加的继承率
const INHERIT_RATE_PER_SECOND: float = 0.02

## 当前宿主
var current_host: HostData = null
## 裸体模式计时器
var naked_timer: float = 0.0
## 是否处于裸体寄生模式
var is_naked: bool = false
## 寄生持续时间（用于计算继承）
var parasite_duration: float = 0.0
## 历史宿主列表
var host_history: Array[HostData] = []

## 信号：寄生成功
signal parasitized(host: HostData)
## 信号：进入裸体模式
signal naked_mode_entered()
## 信号：裸体模式超时死亡
signal naked_mode_expired()
## 信号：裸体模式倒计时更新
signal naked_mode_tick(time_left: float)


func _ready() -> void:
	# 初始化所有预定义宿主
	_init_hosts()


func _process(delta: float) -> void:
	if is_naked:
		naked_timer -= delta
		naked_mode_tick.emit(naked_timer)

		if naked_timer <= 0.0:
			is_naked = false
			naked_mode_expired.emit()
			print("[宿主系统] 裸体模式超时！")
	elif current_host != null:
		parasite_duration += delta


## 预定义的5个宿主数据
var all_hosts: Dictionary = {}


func _init_hosts() -> void:
	# 战士宿主
	all_hosts["warrior"] = HostData.new(
		"铁壁战士", 150.0, 160.0, 15.0,
		["attack", "defense"],
		"铁壁防御",
		"res://assets/sprites/hosts/warrior.png"
	)

	# 法师宿主
	all_hosts["mage"] = HostData.new(
		"奥术法师", 80.0, 180.0, 25.0,
		["magic", "attack_speed"],
		"奥术爆发",
		"res://assets/sprites/hosts/mage.png"
	)

	# 野兽宿主
	all_hosts["beast"] = HostData.new(
		"狂暴野兽", 200.0, 220.0, 20.0,
		["attack", "speed"],
		"狂暴冲锋",
		"res://assets/sprites/hosts/beast.png"
	)

	# 盗贼宿主
	all_hosts["thief"] = HostData.new(
		"暗影盗贼", 90.0, 250.0, 18.0,
		["speed", "attack_speed"],
		"暗影突袭",
		"res://assets/sprites/hosts/thief.png"
	)

	# 牧师宿主
	all_hosts["priest"] = HostData.new(
		"圣光牧师", 120.0, 170.0, 12.0,
		["health", "defense"],
		"圣光治愈",
		"res://assets/sprites/hosts/priest.png"
	)


## 获取指定宿主数据
func get_host(host_key: String) -> HostData:
	return all_hosts.get(host_key, null)


## 获取所有宿主列表
func get_all_hosts() -> Array[HostData]:
	var result: Array[HostData] = []
	for host in all_hosts.values():
		result.append(host)
	return result


## 执行寄生
func parasitize(host: HostData) -> void:
	if host == null:
		push_warning("[宿主系统] 尝试寄生空宿主")
		return

	# 如果之前有宿主，记录到历史
	if current_host != null:
		host_history.append(current_host)

	current_host = host
	is_naked = false
	naked_timer = 0.0
	parasite_duration = 0.0

	parasitized.emit(host)
	print("[宿主系统] 寄生成功: %s (HP:%.0f SPD:%.0f ATK:%.0f)" % [
		host.name, host.base_hp, host.base_speed, host.base_attack
	])


## 进入裸体寄生模式（宿主死亡或离开时触发）
func enter_naked_mode() -> void:
	current_host = null
	is_naked = true
	naked_timer = NAKED_MODE_DURATION
	naked_mode_entered.emit()
	print("[宿主系统] 进入裸体模式！%.1f秒内必须找到新宿主" % NAKED_MODE_DURATION)


## 计算可继承的卡牌
func calculate_inheritance(duration: float) -> Array:
	# 继承概率 = 基础值 + 寄生时长 * 每秒增量
	var inherit_rate: float = BASE_INHERIT_RATE + duration * INHERIT_RATE_PER_SECOND
	inherit_rate = clampf(inherit_rate, 0.0, 1.0)

	var inherited_cards: Array = []

	# 根据宿主的卡牌倾向生成继承卡牌
	if current_host == null:
		return inherited_cards

	for card_type in current_host.card倾向:
		if randf() < inherit_rate:
			inherited_cards.append(card_type)
			print("[宿主系统] 继承卡牌类型: %s (概率: %.1f%%)" % [
				card_type, inherit_rate * 100
			])

	return inherited_cards


## 检查两张卡牌是否可以融合
func check_fusion(card_a: Resource, card_b: Resource) -> Variant:
	# 检查两张卡牌是否有融合配方
	if card_a == null or card_b == null:
		return null

	# 委托给融合系统处理
	var fusion_sys: Node = get_node_or_null("/root/FusionSystem")
	if fusion_sys == null:
		push_warning("[宿主系统] 未找到融合系统节点")
		return null

	if fusion_sys.can_fuse(card_a, card_b):
		return fusion_sys.perform_fusion(card_a, card_b)

	return null


## 获取当前宿主的属性
func get_current_stats() -> Dictionary:
	if current_host == null:
		return {
			"hp": 50.0,
			"speed": 100.0,
			"attack": 5.0,
			"ability": "",
			"is_naked": true,
		}

	return {
		"hp": current_host.base_hp,
		"speed": current_host.base_speed,
		"attack": current_host.base_attack,
		"ability": current_host.special_ability,
		"is_naked": false,
	}
