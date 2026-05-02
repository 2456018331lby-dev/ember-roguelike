# ============================================================
# player_sacrifice.gd - 祭祀模式玩家
# 继承基础玩家，集成祭祀系统修改属性计算
# ============================================================
class_name PlayerSacrifice
extends "player.gd"

## 祭祀系统引用
@onready var sacrifice_sys: Node = $SacrificeSystem if has_node("SacrificeSystem") else null

## 临时的祭祀系统引用（如果未挂载为子节点）
var _sacrifice_sys_external: Node = null


func _ready() -> void:
	super._ready()
	print("[祭祀玩家] 初始化")


## 设置外部祭祀系统引用
func set_sacrifice_system(sys: Node) -> void:
	_sacrifice_sys_external = sys


## 获取祭祀系统引用（优先子节点，其次外部）
func _get_sacrifice_system() -> Node:
	if sacrifice_sys:
		return sacrifice_sys
	return _sacrifice_sys_external


## 重写属性计算，包含祭祀系统的修改量
func get_modified_speed() -> float:
	var mod: Dictionary = _get_all_sacrifice_modifiers()
	return speed + mod.get("speed", 0.0)


func get_modified_attack() -> float:
	var mod: Dictionary = _get_all_sacrifice_modifiers()
	return attack_power + mod.get("attack", 0.0)


func get_modified_max_hp() -> float:
	var mod: Dictionary = _get_all_sacrifice_modifiers()
	return max_hp + mod.get("health", 0.0)


func get_modified_attack_speed() -> float:
	var mod: Dictionary = _get_all_sacrifice_modifiers()
	return 1.0 + mod.get("attack_speed", 0.0)


## 获取所有祭祀修改量
func _get_all_sacrifice_modifiers() -> Dictionary:
	var sys: Node = _get_sacrifice_system()
	if sys and sys.has_method("get_all_modifiers"):
		return sys.get_all_modifiers()
	return {}


## 重写移动速度（使用修改后的值）
func _handle_movement(_delta: float) -> void:
	var input_dir: Vector2 = Vector2.ZERO

	if is_using_joystick and joystick_input.length() > 0.1:
		input_dir = joystick_input.normalized()
	else:
		input_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	var modified_speed: float = get_modified_speed()
	velocity = input_dir * modified_speed

	if input_dir.x != 0 and sprite:
		sprite.flip_h = input_dir.x < 0


## 重写伤害计算（使用修改后的攻击力）
func get_attack_damage() -> float:
	return get_modified_attack()


## 重写受伤处理（使用修改后的最大生命值）
func take_damage(amount: float) -> void:
	if is_dead or is_invincible:
		return

	var final_damage: float = maxi(1.0, amount)
	hp -= final_damage
	hp = maxf(hp, 0.0)

	var current_max_hp: float = get_modified_max_hp()
	health_changed.emit(hp, current_max_hp)
	print("[祭祀玩家] 受到 %.1f 伤害，HP: %.1f/%.1f" % [final_damage, hp, current_max_hp])

	_set_invincible(0.5)

	if anim_player and anim_player.has_animation("hit"):
		anim_player.play("hit")

	if hp <= 0.0:
		die()


## 重写治疗（不超过修改后的最大值）
func heal(amount: float) -> void:
	if is_dead:
		return

	var current_max_hp: float = get_modified_max_hp()
	hp = minf(hp + amount, current_max_hp)
	health_changed.emit(hp, current_max_hp)
	print("[祭祀玩家] 恢复 %.1f HP: %.1f/%.1f" % [amount, hp, current_max_hp])


## 执行献祭
func perform_sacrifice(card: Resource) -> void:
	var sys: Node = _get_sacrifice_system()
	if sys and sys.has_method("apply_sacrifice"):
		sys.apply_sacrifice(card)
		print("[祭祀玩家] 完成献祭，当前修改量: ", sys.get_all_modifiers())
	else:
		push_warning("[祭祀玩家] 祭祀系统不可用")
