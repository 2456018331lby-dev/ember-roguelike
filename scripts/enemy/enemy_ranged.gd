# ============================================================
# enemy_ranged.gd - 远程敌人
# 继承敌人基类，添加远程射击和保持距离AI
# ============================================================
class_name EnemyRanged
extends "enemy_base.gd"

## 射击参数
@export var projectile_speed: float = 300.0
@export var projectile_damage: float = 8.0
@export var optimal_distance: float = 250.0  # 最佳射击距离
@export var min_distance: float = 150.0      # 最小安全距离
@export var shoot_cooldown: float = 1.5

## 射击状态
var can_shoot: bool = true
var shoot_timer: float = 0.0

## 弹幕场景
var projectile_scene: PackedScene = null


func _ready() -> void:
	super._ready()
	# 远程敌人参数
	attack_range = 300.0
	attack_cooldown = shoot_cooldown
	speed = 100.0  # 远程敌人较慢

	# 尝试加载弹幕场景
	if ResourceLoader.exists("res://scenes/projectiles/enemy_bullet.tscn"):
		projectile_scene = load("res://scenes/projectiles/enemy_bullet.tscn")


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# 射击冷却
	if not can_shoot:
		shoot_timer -= delta
		if shoot_timer <= 0.0:
			can_shoot = true

	super._physics_process(delta)


## 重写追逐AI：保持最佳距离
func _ai_chase(_delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	var dist: float = _distance_to_target()
	var direction: Vector2 = (target.global_position - global_position).normalized()

	# 在最佳距离范围内时切换到攻击
	if dist <= attack_range and dist >= min_distance:
		current_state = AIState.ATTACK
		velocity = Vector2.ZERO
		return

	# 太近了，后退
	if dist < min_distance:
		velocity = -direction * speed
		if sprite:
			sprite.flip_h = direction.x < 0
		return

	# 太远了，靠近
	if dist > attack_range:
		velocity = direction * speed
		if sprite:
			sprite.flip_h = direction.x < 0
		return

	velocity = Vector2.ZERO


## 重写攻击：远程射击
func _ai_attack(_delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	var dist: float = _distance_to_target()

	# 距离不合适时回到追逐
	if dist > attack_range * 1.3 or dist < min_distance * 0.8:
		current_state = AIState.CHASE
		return

	# 面朝目标
	var direction: Vector2 = (target.global_position - global_position).normalized()
	if sprite:
		sprite.flip_h = direction.x < 0

	# 微调位置（保持最佳距离同时横向移动）
	var lateral: Vector2 = Vector2(-direction.y, direction.x)
	velocity = lateral * speed * 0.3

	# 射击
	if can_shoot:
		_shoot()


## 射击
func _shoot() -> void:
	if target == null:
		return

	can_shoot = false
	shoot_timer = shoot_cooldown

	var direction: Vector2 = (target.global_position - global_position).normalized()

	if anim_player and anim_player.has_animation("shoot"):
		anim_player.play("shoot")

	# 创建弹幕
	if projectile_scene:
		var bullet: Node2D = projectile_scene.instantiate() as Node2D
		bullet.global_position = global_position
		bullet.setup(direction, projectile_speed, projectile_damage)
		get_tree().current_scene.add_child(bullet)
	else:
		# 简化射击：直接对目标造成伤害
		if target.has_method("take_damage"):
			target.take_damage(projectile_damage)
			print("[远程敌人] 射击命中！造成 %.1f 伤害" % projectile_damage)

	print("[远程敌人] 射击！方向: ", direction)
