# ============================================================
# enemy_boss.gd - Boss敌人
# 继承敌人基类，多攻击模式、阶段转换、特殊奖励掉落
# ============================================================
class_name EnemyBoss
extends "enemy_base.gd"

## Boss阶段枚举
enum BossPhase { PHASE_1, PHASE_2, PHASE_3 }

## 当前阶段
var current_phase: BossPhase = BossPhase.PHASE_1

## 阶段转换HP阈值（百分比）
@export var phase_2_threshold: float = 0.65  # 65% HP进入阶段2
@export var phase_3_threshold: float = 0.30  # 30% HP进入阶段3

## 攻击模式
enum AttackPattern { SLAM, SWEEP, SUMMON, RANGED_BARRAGE, ENRAGE }
var current_pattern: AttackPattern = AttackPattern.SLAM
var pattern_timer: float = 0.0
var pattern_interval: float = 3.0

## 召唤相关
@export var summon_count: int = 3
var minion_scene: PackedScene = null

## 奖励
var reward_drops: Array[String] = ["boss_card", "rare_relic", "gold_pile"]

## 信号：阶段转换
signal phase_changed(new_phase: int)
## 信号：Boss击败
signal boss_defeated(rewards: Array)


func _ready() -> void:
	super._ready()
	# Boss基础属性
	max_hp = 500.0 * hp_multiplier
	hp = max_hp
	damage = 20.0 * damage_multiplier
	speed = 80.0 * speed_multiplier
	attack_range = 100.0

	# 尝试加载小兵场景
	if ResourceLoader.exists("res://scenes/enemies/enemy_melee.tscn"):
		minion_scene = load("res://scenes/enemies/enemy_melee.tscn")

	print("[Boss] 初始化完成，HP: %.0f" % max_hp)


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# 攻击模式计时
	pattern_timer += delta

	super._physics_process(delta)


## 重写受伤：检查阶段转换
func take_damage(amount: float) -> void:
	super.take_damage(amount)

	if is_dead:
		return

	# 检查阶段转换
	var hp_ratio: float = hp / max_hp
	if hp_ratio <= phase_2_threshold and current_phase == BossPhase.PHASE_1:
		_transition_phase(BossPhase.PHASE_2)
	elif hp_ratio <= phase_3_threshold and current_phase == BossPhase.PHASE_2:
		_transition_phase(BossPhase.PHASE_3)


## 阶段转换
func _transition_phase(new_phase: BossPhase) -> void:
	current_phase = new_phase

	# 转换时短暂无敌
	is_invincible = true
	var old_speed: float = speed

	match new_phase:
		BossPhase.PHASE_2:
			speed *= 1.3
			damage *= 1.3
			pattern_interval = 2.5
			print("[Boss] ★★ 进入阶段2！速度和攻击力提升")
		BossPhase.PHASE_3:
			speed *= 1.5
			damage *= 1.5
			pattern_interval = 2.0
			print("[Boss] ★★★ 进入阶段3！狂暴模式激活")

	phase_changed.emit(new_phase)

	# 播放阶段转换动画
	if anim_player and anim_player.has_animation("phase_transition"):
		anim_player.play("phase_transition")
		await anim_player.animation_finished

	is_invincible = false

	# 召唤小兵
	_summon_minions()


## 重写攻击AI：多模式循环
func _ai_attack(_delta: float) -> void:
	if target == null:
		current_state = AIState.IDLE
		return

	var dist: float = _distance_to_target()

	# 距离过远回到追逐
	if dist > attack_range * 2.0:
		current_state = AIState.CHASE
		return

	# 选择攻击模式
	if pattern_timer >= pattern_interval:
		pattern_timer = 0.0
		_select_pattern(dist)
		_execute_pattern()


## 选择攻击模式
func _select_pattern(dist: float) -> void:
	var patterns: Array[AttackPattern] = []

	match current_phase:
		BossPhase.PHASE_1:
			if dist <= attack_range:
				patterns = [AttackPattern.SLAM, AttackPattern.SWEEP]
			else:
				patterns = [AttackPattern.RANGED_BARRAGE]
		BossPhase.PHASE_2:
			if dist <= attack_range:
				patterns = [AttackPattern.SLAM, AttackPattern.SWEEP, AttackPattern.SWEEP]
			else:
				patterns = [AttackPattern.RANGED_BARRAGE, AttackPattern.SUMMON]
		BossPhase.PHASE_3:
			patterns = [AttackPattern.SLAM, AttackPattern.SWEEP,
						AttackPattern.SUMMON, AttackPattern.RANGED_BARRAGE, AttackPattern.ENRAGE]

	current_pattern = patterns.pick_random()


## 执行攻击模式
func _execute_pattern() -> void:
	match current_pattern:
		AttackPattern.SLAM:
			_pattern_slam()
		AttackPattern.SWEEP:
			_pattern_sweep()
		AttackPattern.SUMMON:
			_pattern_summon()
		AttackPattern.RANGED_BARRAGE:
			_pattern_ranged_barrage()
		AttackPattern.ENRAGE:
			_pattern_enrage()


## 猛击模式：对前方大范围造成高额伤害
func _pattern_slam() -> void:
	print("[Boss] 攻击模式：猛击！")
	if anim_player and anim_player.has_animation("slam"):
		anim_player.play("slam")

	var slam_damage: float = damage * 2.0
	if target and _distance_to_target() <= attack_range * 1.5:
		if target.has_method("take_damage"):
			target.take_damage(slam_damage)
			print("[Boss] 猛击命中！造成 %.1f 伤害" % slam_damage)


## 横扫模式：对周围所有目标造成伤害
func _pattern_sweep() -> void:
	print("[Boss] 攻击模式：横扫！")
	if anim_player and anim_player.has_animation("sweep"):
		anim_player.play("sweep")

	# 对范围内所有玩家造成伤害
	var sweep_damage: float = damage * 1.5
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	for player in players:
		if player is Node2D:
			var dist: float = global_position.distance_to(player.global_position)
			if dist <= attack_range * 2.0:
				if player.has_method("take_damage"):
					player.take_damage(sweep_damage)
					print("[Boss] 横扫命中！造成 %.1f 伤害" % sweep_damage)


## 召唤模式：召唤小兵
func _pattern_summon() -> void:
	print("[Boss] 攻击模式：召唤小兵！")

	# 根据阶段决定召唤数量
	var count: int = summon_count
	if current_phase == BossPhase.PHASE_3:
		count = summon_count + 2

	_summon_minions(count)


## 召唤小兵
func _summon_minions(count: int = -1) -> void:
	if minion_scene == null:
		return

	if count < 0:
		count = summon_count

	for i in range(count):
		var angle: float = (TAU / count) * i
		var spawn_pos: Vector2 = global_position + Vector2(cos(angle), sin(angle)) * 80.0

		var minion: Node2D = minion_scene.instantiate() as Node2D
		minion.global_position = spawn_pos
		minion.set_difficulty(hp_multiplier * 0.5, damage_multiplier * 0.5, speed_multiplier)
		get_tree().current_scene.add_child(minion)

	print("[Boss] 召唤了 %d 个小兵" % count)


## 弹幕模式：向多方向发射弹幕
func _pattern_ranged_barrage() -> void:
	print("[Boss] 攻击模式：弹幕！")
	if anim_player and anim_player.has_animation("barrage"):
		anim_player.play("barrage")

	# 简化：对玩家造成多次小额伤害
	var barrage_count: int = 3
	if current_phase == BossPhase.PHASE_3:
		barrage_count = 5

	for i in range(barrage_count):
		get_tree().create_timer(i * 0.2).timeout.connect(
			func() -> void:
				if target and target.has_method("take_damage") and not is_dead:
					target.take_damage(damage * 0.4)
					print("[Boss] 弹幕命中！")
		)


## 狂暴模式：大幅提升自身属性
func _pattern_enrage() -> void:
	print("[Boss] 攻击模式：狂暴！所有属性临时提升！")
	if anim_player and anim_player.has_animation("enrage"):
		anim_player.play("enrage")

	# 临时提升
	var old_damage: float = damage
	var old_speed: float = speed
	damage *= 1.5
	speed *= 1.5

	# 持续5秒
	await get_tree().create_timer(5.0).timeout
	damage = old_damage
	speed = old_speed
	print("[Boss] 狂暴效果结束")


## 重写死亡：触发奖励掉落
func die() -> void:
	if is_dead:
		return

	print("[Boss] ★★★ Boss被击败！★★★")
	boss_defeated.emit(reward_drops)

	# 掉落奖励
	_drop_rewards()

	super.die()


## 掉落奖励
func _drop_rewards() -> void:
	for reward_type in reward_drops:
		print("[Boss] 掉落奖励: ", reward_type)
		# 实际项目中应实例化奖励对象
		# var reward: Node = _create_reward(reward_type)
		# reward.global_position = global_position + Vector2(randf_range(-50, 50), randf_range(-50, 50))
		# get_tree().current_scene.add_child(reward)


## 重写基础攻击（Boss不使用普通攻击）
func _perform_attack() -> void:
	# Boss的攻击由模式系统处理
	pass
