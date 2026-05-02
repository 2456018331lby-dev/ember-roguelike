# ============================================================
# enemy_base.gd - 敌人基类
# 提供所有敌人共有的属性和行为：生命值、AI、受伤、死亡
# ============================================================
class_name EnemyBase
extends CharacterBody2D

## 信号：敌人死亡
signal died()
## 信号：生命值变化
signal health_changed(current_hp: float, max_hp: float)

## 基础属性
@export var max_hp: float = 50.0
@export var speed: float = 120.0
@export var damage: float = 10.0
@export var attack_range: float = 50.0
@export var attack_cooldown: float = 1.0

## 当前状态
var hp: float = 50.0
var is_dead: bool = false
var can_attack: bool = true
var attack_timer: float = 0.0

## AI状态
enum AIState { IDLE, CHASE, ATTACK, DEAD }
var current_state: AIState = AIState.IDLE

## 目标（玩家）
var target: Node2D = null

## 难度倍率（由波次管理器设置）
var hp_multiplier: float = 1.0
var damage_multiplier: float = 1.0
var speed_multiplier: float = 1.0

## 节点引用
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var anim_player: AnimationPlayer = $AnimationPlayer if has_node("AnimationPlayer") else null
@onready var detection_area: Area2D = $DetectionArea if has_node("DetectionArea") else null


func _ready() -> void:
	# 应用难度倍率
	max_hp *= hp_multiplier
	hp = max_hp
	damage *= damage_multiplier
	speed *= speed_multiplier

	# 默认目标为场景中的玩家
	_find_player()

	if detection_area:
		detection_area.body_entered.connect(_on_detection_entered)
		detection_area.body_exited.connect(_on_detection_exited)


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# 攻击冷却
	if not can_attack:
		attack_timer -= delta
		if attack_timer <= 0.0:
			can_attack = true

	# AI状态机
	match current_state:
		AIState.IDLE:
			_ai_idle(delta)
		AIState.CHASE:
			_ai_chase(delta)
		AIState.ATTACK:
			_ai_attack(delta)

	move_and_slide()


## 寻找玩家
func _find_player() -> void:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		target = players[0] as Node2D


## ============================================================
## AI行为（子类可重写）
## ============================================================

## 空闲状态
func _ai_idle(_delta: float) -> void:
	# 检测范围内发现玩家则切换到追逐
	if target and _distance_to_target() < 500.0:
		current_state = AIState.CHASE


## 追逐状态
func _ai_chase(_delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	var dist: float = _distance_to_target()

	# 进入攻击范围
	if dist <= attack_range:
		current_state = AIState.ATTACK
		return

	# 向玩家移动
	var direction: Vector2 = (target.global_position - global_position).normalized()
	velocity = direction * speed

	# 翻转朝向
	if sprite:
		sprite.flip_h = direction.x < 0


## 攻击状态（基类简单实现，子类应重写）
func _ai_attack(_delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	velocity = Vector2.ZERO

	var dist: float = _distance_to_target()

	# 离开攻击范围则回到追逐
	if dist > attack_range * 1.5:
		current_state = AIState.CHASE
		return

	# 执行攻击
	if can_attack:
		_perform_attack()


## 执行攻击（子类重写具体实现）
func _perform_attack() -> void:
	if not can_attack:
		return

	can_attack = false
	attack_timer = attack_cooldown

	# 简单接触伤害
	if target and target.has_method("take_damage"):
		target.take_damage(damage)
		print("[敌人] 攻击玩家，造成 %.1f 伤害" % damage)

	if anim_player and anim_player.has_animation("attack"):
		anim_player.play("attack")


## ============================================================
## 受伤与死亡
## ============================================================

## 受到伤害
func take_damage(amount: float) -> void:
	if is_dead:
		return

	var final_damage: float = maxi(1.0, amount)
	hp -= final_damage
	hp = maxf(hp, 0.0)

	health_changed.emit(hp, max_hp)
	print("[敌人] 受到 %.1f 伤害，剩余 HP: %.1f/%.1f" % [final_damage, hp, max_hp])

	# 受击闪烁效果
	_flash_hit()

	if hp <= 0.0:
		die()


## 受击闪烁
func _flash_hit() -> void:
	if sprite:
		sprite.modulate = Color.RED
		get_tree().create_timer(0.1).timeout.connect(
			func() -> void: sprite.modulate = Color.WHITE if sprite else null
		)


## 死亡
func die() -> void:
	if is_dead:
		return

	is_dead = true
	current_state = AIState.DEAD
	velocity = Vector2.ZERO

	print("[敌人] 死亡")
	died.emit()

	if anim_player and anim_player.has_animation("death"):
		anim_player.play("death")
		await anim_player.animation_finished

	# 延迟删除节点
	queue_free()


## ============================================================
## 工具方法
## ============================================================

## 到目标的距离
func _distance_to_target() -> float:
	if target == null:
		return INF
	return global_position.distance_to(target.global_position)


## 设置难度倍率
func set_difficulty(hp_mult: float, dmg_mult: float, spd_mult: float) -> void:
	hp_multiplier = hp_mult
	damage_multiplier = dmg_mult
	speed_multiplier = spd_mult


## 检测区域回调
func _on_detection_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		target = body
		current_state = AIState.CHASE


func _on_detection_exited(body: Node2D) -> void:
	if body == target:
		current_state = AIState.IDLE
