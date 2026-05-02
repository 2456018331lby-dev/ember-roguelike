# ============================================================
# player_parasite.gd - 寄生模式玩家
# 继承基础玩家，集成宿主系统、裸体模式、卡牌继承
# ============================================================
class_name PlayerParasite
extends "player.gd"

## 宿主系统引用
@onready var host_sys: Node = $HostSystem if has_node("HostSystem") else null

## 临时的宿主系统引用（如果未挂载为子节点）
var _host_sys_external: Node = null

## 裸体模式相关
var is_naked_mode: bool = false
var naked_invincible: bool = false

## 裸体模式属性削弱比例
const NAKED_HP_RATIO: float = 0.3
const NAKED_SPEED_RATIO: float = 0.6
const NAKED_ATTACK_RATIO: float = 0.3


func _ready() -> void:
	super._ready()
	print("[寄生玩家] 初始化")


func _process(delta: float) -> void:
	super._process(delta)


## 设置外部宿主系统引用
func set_host_system(sys: Node) -> void:
	_host_sys_external = sys
	# 连接信号
	if sys.has_signal("naked_mode_expired"):
		sys.naked_mode_expired.connect(_on_naked_mode_expired)
	if sys.has_signal("parasitized"):
		sys.parasitized.connect(_on_parasitized)


## 获取宿主系统引用
func _get_host_system() -> Node:
	if host_sys:
		return host_sys
	return _host_sys_external


## 进入裸体寄生模式（5秒脆弱状态）
func enter_naked_mode() -> void:
	is_naked_mode = true
	naked_invincible = true  # 短暂无敌保护

	print("[寄生玩家] 进入裸体模式！属性大幅削弱")
	print("[寄生玩家] HP: %.0f%%, 速度: %.0f%%, 攻击: %.0f%%" % [
		NAKED_HP_RATIO * 100, NAKED_SPEED_RATIO * 100, NAKED_ATTACK_RATIO * 100
	])

	# 通知宿主系统
	var sys: Node = _get_host_system()
	if sys and sys.has_method("enter_naked_mode"):
		sys.enter_naked_mode()

	# 1秒后取消保护无敌
	await get_tree().create_timer(1.0).timeout
	naked_invincible = false


## 尝试寄生到目标
func attempt_parasitize(target: Node) -> bool:
	if target == null:
		return false

	# 检查目标是否有宿主数据
	if not "host_data" in target and not target.has_method("get_host_data"):
		push_warning("[寄生玩家] 目标没有宿主数据")
		return false

	var host_data: Resource = target.host_data if "host_data" in target else target.get_host_data()

	var sys: Node = _get_host_system()
	if sys and sys.has_method("parasitize"):
		sys.parasitize(host_data)
		is_naked_mode = false

		# 继承卡牌
		var inherited: Array = _calculate_inheritance()
		_inherit_cards(inherited)

		print("[寄生玩家] 寄生成功！继承了 %d 张卡牌" % inherited.size())
		return true

	return false


## 计算继承的卡牌
func _calculate_inheritance() -> Array:
	var sys: Node = _get_host_system()
	if sys and sys.has_method("calculate_inheritance"):
		var duration: float = sys.parasite_duration if "parasite_duration" in sys else 0.0
		return sys.calculate_inheritance(duration)
	return []


## 将继承的卡牌加入卡组
func _inherit_cards(card_types: Array) -> void:
	for card_type in card_types:
		# 根据卡牌类型创建对应卡牌
		var card: Resource = _create_card_by_type(card_type)
		if card:
			draw_pile.append(card)
			print("[寄生玩家] 继承卡牌: ", card_type)

	draw_pile.shuffle()


## 根据类型创建卡牌（简化实现，实际项目中应从数据驱动）
func _create_card_by_type(card_type: String) -> Resource:
	# 这里返回一个简单的卡牌字典，实际项目应使用卡牌工厂
	var card_data: Dictionary = {
		"card_id": "inherited_" + card_type,
		"card_name": "继承·" + card_type,
		"card_type": card_type,
		"damage": 15,
		"description": "从上一个宿主继承的卡牌",
	}
	return card_data as Resource


## 获取寄生后的属性
func _get_parasite_stats() -> Dictionary:
	var sys: Node = _get_host_system()
	if sys and sys.has_method("get_current_stats"):
		return sys.get_current_stats()
	return {}


## 重写移动速度（考虑宿主和裸体模式）
func _handle_movement(_delta: float) -> void:
	var input_dir: Vector2 = Vector2.ZERO

	if is_using_joystick and joystick_input.length() > 0.1:
		input_dir = joystick_input.normalized()
	else:
		input_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	var current_speed: float = speed

	# 裸体模式速度削弱
	if is_naked_mode:
		current_speed *= NAKED_SPEED_RATIO
	# 有宿主时使用宿主速度
	elif not _get_parasite_stats().get("is_naked", true):
		current_speed = _get_parasite_stats().get("speed", speed)

	velocity = input_dir * current_speed

	if input_dir.x != 0 and sprite:
		sprite.flip_h = input_dir.x < 0


## 重写受伤处理
func take_damage(amount: float) -> void:
	if is_dead or is_invincible or naked_invincible:
		return

	# 裸体模式受伤加重
	var final_damage: float = amount
	if is_naked_mode:
		final_damage *= 1.5  # 裸体模式受到150%伤害

	super.take_damage(final_damage)


## 重写治疗
func heal(amount: float) -> void:
	if is_dead:
		return

	# 裸体模式治疗减半
	var heal_amount: float = amount
	if is_naked_mode:
		heal_amount *= 0.5

	super.heal(heal_amount)


## 重写攻击伤害
func get_attack_damage() -> float:
	var base_dmg: float = attack_power

	if is_naked_mode:
		return base_dmg * NAKED_ATTACK_RATIO
	elif not _get_parasite_stats().get("is_naked", true):
		return _get_parasite_stats().get("attack", base_dmg)

	return base_dmg


## 信号回调：裸体模式超时
func _on_naked_mode_expired() -> void:
	print("[寄生玩家] 裸体模式超时，玩家死亡！")
	die()


## 信号回调：寄生成功
func _on_parasitized(_host: Resource) -> void:
	is_naked_mode = false
	print("[寄生玩家] 寄生完成，恢复正常状态")
