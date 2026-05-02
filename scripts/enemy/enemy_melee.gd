# ============================================================
# enemy_melee.gd - 近战敌人
# 继承敌人基类，添加近战攻击和冲锋技能
# ============================================================
class_name EnemyMelee
extends "enemy_base.gd"

## 冲锋攻击参数
@export var charge_speed: float = 400.0
@export var charge_cooldown: float = 5.0
@export var charge_damage_mult: float = 2.0
@export var charge_range: float = 200.0

## 冲锋状态
var is_charging: bool = false
var charge_direction: Vector2 = Vector2.ZERO
var charge_timer: float = 0.0
var can_charge: bool = true
var charge_cooldown_timer: float = 0.0

## 冲锋持续时间
const CHARGE_DURATION: float = 0.5

## 攻击动画冷却（近战特有）
var melee_attack_cooldown: float = 0.8


func _ready() -> void:
	super._ready()
	# 近战敌人参数微调
	attack_range = 60.0
	attack_cooldown = melee_attack_cooldown


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# 冲锋冷却
	if not can_charge:
		charge_cooldown_timer -= delta
		if charge_cooldown_timer <= 0.0:
			can_charge = true

	# 冲锋中
	if is_charging:
		_update_charge(delta)
		return

	super._physics_process(delta)


## 重写追逐AI：增加冲锋判断
func _ai_chase(delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	var dist: float = _distance_to_target()

	# 进入攻击范围
	if dist <= attack_range:
		current_state = AIState.ATTACK
		return

	# 检查是否可以冲锋
	if can_charge and dist <= charge_range and dist > attack_range:
		_start_charge()
		return

	# 普通追逐
	var direction: Vector2 = (target.global_position - global_position).normalized()
	velocity = direction * speed

	if sprite:
		sprite.flip_h = direction.x < 0


## 重写攻击：近距离猛击
func _perform_attack() -> void:
	if not can_attack:
		return

	can_attack = false
	attack_timer = attack_cooldown

	# 近战攻击动画
	if anim_player and anim_player.has_animation("attack"):
		anim_player.play("attack")

	# 对范围内所有玩家造成伤害
	if target and target.has_method("take_damage"):
		var dist: float = _distance_to_target()
		if dist <= attack_range * 1.2:
			target.take_damage(damage)
			print("[近战敌人] 近战攻击！造成 %.1f 伤害" % damage)

	# 攻击后略微后退
	var back_dir: Vector2 = (global_position - target.global_position).normalized()
	velocity = back_dir * speed * 0.5
	get_tree().create_timer(0.3).timeout.connect(
		func() -> void: velocity = Vector2.ZERO
	)


## 开始冲锋
func _start_charge() -> void:
	if target == null:
		return

	is_charging = true
	can_charge = false
	charge_cooldown_timer = charge_cooldown

	# 冲锋方向锁定为当前到目标的方向
	charge_direction = (target.global_position - global_position).normalized()

	if sprite:
		sprite.flip_h = charge_direction.x < 0

	# 冲锋前摇动画
	if anim_player and anim_player.has_animation("charge_prepare"):
		anim_player.play("charge_prepare")

	print("[近战敌人] 开始冲锋！")


## 更新冲锋状态
func _update_charge(delta: float) -> void:
	charge_timer += delta

	# 冲锋移动
	velocity = charge_direction * charge_speed

	# 冲锋持续时间结束
	if charge_timer >= CHARGE_DURATION:
		_end_charge()

	move_and_slide()

	# 冲锋过程中检测碰撞
	if target and _distance_to_target() <= attack_range:
		var charge_damage: float = damage * charge_damage_mult
		if target.has_method("take_damage"):
			target.take_damage(charge_damage)
			print("[近战敌人] 冲锋命中！造成 %.1f 伤害" % charge_damage)
		_end_charge()


## 结束冲锋
func _end_charge() -> void:
	is_charging = false
	charge_timer = 0.0
	velocity = Vector2.ZERO * 0.2  # 冲锋后短暂减速

	if anim_player and anim_player.has_animation("charge_end"):
		anim_player.play("charge_end")

	print("[近战敌人] 冲锋结束")
