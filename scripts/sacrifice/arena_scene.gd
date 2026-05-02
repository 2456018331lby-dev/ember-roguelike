## 献祭模式 - 竞技场场景脚本
extends Node2D

## 预加载场景
const ENEMY_MELEE_SCENE = preload("res://scenes/common/enemy_melee.tscn") if ResourceLoader.exists("res://scenes/common/enemy_melee.tscn") else null
const HUD_SCENE = preload("res://scenes/common/hud.tscn")

@onready var player: CharacterBody2D = $Player
@onready var enemy_container: Node2D = $EnemyContainer
@onready var wall_container: Node2D = $Walls

## HUD 引用
var hud: CanvasLayer = null

## 当前波次
var current_wave: int = 0
## 波次中的敌人列表
var wave_enemies: Array[Node] = []
## 战斗计时器
var battle_timer: float = 0.0
## 波次间休息
var is_resting: bool = false
## 总波次数
const TOTAL_WAVES: int = 20

## 波次配置（从 wave_manager 获取）
var wave_configs: Array[Dictionary] = []

func _ready() -> void:
	# 设置玩家
	if player:
		player.position = Vector2(640, 360)  # 屏幕中央
	
	# 创建 HUD
	hud = HUD_SCENE.instantiate()
	add_child(hud)
	if player:
		hud.bind_player(player)
	
	# 生成竞技场墙壁
	_spawn_arena_walls()
	
	# 开始第一波
	call_deferred("_start_wave", 1)

func _process(delta: float) -> void:
	if GameManager.current_state != GameManager.GameState.PLAYING:
		return
	
	battle_timer += delta
	if hud:
		hud.set_timer(battle_timer)
	
	# 检查当前波次是否清除
	if not is_resting and wave_enemies.size() == 0 and current_wave > 0:
		_on_wave_cleared()

## 生成竞技场墙壁（矩形边界）
func _spawn_arena_walls() -> void:
	var arena_rect = Rect2(50, 50, 1180, 620)  # 竞技场范围
	var wall_color = Color(0.3, 0.25, 0.2)
	
	# 用 StaticBody2D 创建四面墙
	for i in 4:
		var wall = StaticBody2D.new()
		var col = CollisionShape2D.new()
		var shape = RectangleShape2D.new()
		match i:
			0:  # 上
				shape.size = Vector2(arena_rect.size.x + 20, 20)
				wall.position = Vector2(arena_rect.get_center().x, arena_rect.position.y - 10)
			1:  # 下
				shape.size = Vector2(arena_rect.size.x + 20, 20)
				wall.position = Vector2(arena_rect.get_center().x, arena_rect.end.y + 10)
			2:  # 左
				shape.size = Vector2(20, arena_rect.size.y + 20)
				wall.position = Vector2(arena_rect.position.x - 10, arena_rect.get_center().y)
			3:  # 右
				shape.size = Vector2(20, arena_rect.size.y + 20)
				wall.position = Vector2(arena_rect.end.x + 10, arena_rect.get_center().y)
		col.shape = shape
		wall.add_child(col)
		
		# 可视化
		var visual = ColorRect.new()
		visual.size = shape.size
		visual.position = -shape.size / 2
		visual.color = wall_color
		wall.add_child(visual)
		
		wall_container.add_child(wall)

## 开始一波
func _start_wave(wave_num: int) -> void:
	current_wave = wave_num
	is_resting = false
	GameManager.complete_wave(wave_num)
	
	if hud:
		hud.set_wave(wave_num, TOTAL_WAVES)
	
	# 生成敌人
	_spawn_wave_enemies(wave_num)

## 生成波次敌人
func _spawn_wave_enemies(wave_num: int) -> void:
	var enemy_count = 3 + wave_num * 2
	var arena_center = Vector2(640, 360)
	
	# Boss 波
	if wave_num % 5 == 0:
		enemy_count = 2 + wave_num / 5  # 少量杂兵
		_spawn_boss(wave_num)
	
	for i in enemy_count:
		var enemy = _create_enemy(wave_num)
		if enemy:
			# 在竞技场边缘随机位置生成
			var angle = randf() * TAU
			var spawn_pos = arena_center + Vector2.from_angle(angle) * randf_range(200, 300)
			spawn_pos.x = clampf(spawn_pos.x, 80, 1200)
			spawn_pos.y = clampf(spawn_pos.y, 80, 640)
			enemy.position = spawn_pos
			enemy_container.add_child(enemy)
			wave_enemies.append(enemy)
			# 连接死亡信号
			if enemy.has_signal("died"):
				enemy.died.connect(_on_enemy_died.bind(enemy))

## 创建普通敌人
func _create_enemy(wave_num: int) -> Node:
	# 根据波次选择敌人类型
	var enemy_scene_path = "res://scenes/common/enemy_melee.tscn"
	var speed_mult = 1.0 + wave_num * 0.05
	var hp_mult = GameManager.get_difficulty_multiplier()["enemy_hp"] * (1.0 + wave_num * 0.1)
	var dmg_mult = GameManager.get_difficulty_multiplier()["enemy_damage"] * (1.0 + wave_num * 0.08)
	
	# 后期波次出现远程敌人
	if wave_num >= 5 and randf() > 0.6:
		enemy_scene_path = "res://scenes/common/enemy_ranged.tscn"
	
	if ResourceLoader.exists(enemy_scene_path):
		var enemy = load(enemy_scene_path).instantiate()
		if enemy.has_method("set_difficulty"):
			enemy.set_difficulty(hp_mult, dmg_mult, speed_mult)
		return enemy
	else:
		# 简易敌人占位
		return _create_simple_enemy(wave_num)

## 创建简易敌人（场景文件不存在时的后备）
func _create_simple_enemy(wave_num: int) -> CharacterBody2D:
	var enemy = CharacterBody2D.new()
	enemy.set_meta("hp", 30 + wave_num * 10)
	enemy.set_meta("max_hp", 30 + wave_num * 10)
	enemy.set_meta("damage", 5 + wave_num * 2)
	enemy.set_meta("speed", 100.0 + wave_num * 5)
	
	# 碰撞
	var col = CollisionShape2D.new()
	var shape = CircleShape2D.new()
	shape.radius = 15
	col.shape = shape
	enemy.add_child(col)
	
	# 可视化
	var visual = ColorRect.new()
	visual.size = Vector2(24, 24)
	visual.position = Vector2(-12, -12)
	visual.color = Color(0.8, 0.2, 0.2)
	enemy.add_child(visual)
	
	# 简单 AI 脚本
	var script = GDScript.new()
	script.source_code = """
extends CharacterBody2D
var target: Node2D
var hp: int = 30
var damage: int = 5
var move_speed: float = 100.0
signal died

func _ready():
	hp = get_meta('hp', 30)
	damage = get_meta('damage', 5)
	move_speed = get_meta('speed', 100.0)
	target = get_tree().get_first_node_in_group('player')

func _physics_process(delta):
	if not target: return
	var dir = (target.global_position - global_position).normalized()
	velocity = dir * move_speed
	move_and_slide()

func take_damage(amount: int):
	hp -= amount
	if hp <= 0:
		died.emit()
		queue_free()
"""
	script.reload()
	enemy.set_script(script)
	enemy.add_to_group("enemy")
	return enemy

## 生成 Boss
func _spawn_boss(wave_num: int) -> void:
	var boss = _create_simple_enemy(wave_num)
	if boss:
		# Boss 更大更强
		var boss_hp = (100 + wave_num * 50) * GameManager.get_difficulty_multiplier()["enemy_hp"]
		boss.set_meta("hp", int(boss_hp))
		boss.set_meta("max_hp", int(boss_hp))
		boss.set_meta("damage", 15 + wave_num * 3)
		boss.position = Vector2(640, 150)
		
		# Boss 可视化
		for child in boss.get_children():
			if child is ColorRect:
				child.color = Color(0.6, 0.1, 0.1)
				child.size = Vector2(48, 48)
				child.position = Vector2(-24, -24)
		
		boss.add_to_group("boss")
		enemy_container.add_child(boss)
		wave_enemies.append(boss)
		if boss.has_signal("died"):
			boss.died.connect(_on_enemy_died.bind(boss))

## 敌人死亡回调
func _on_enemy_died(enemy: Node) -> void:
	wave_enemies.erase(enemy)
	# 掉落余烬碎片（视觉效果可以后面加）

## 波次清除
func _on_wave_cleared() -> void:
	is_resting = true
	
	if current_wave >= TOTAL_WAVES:
		# 通关！
		GameManager.end_run(true)
		return
	
	# 进入商店/献祭阶段
	GameManager.enter_shop()
	# TODO: 显示献祭选择界面
	# 暂时直接开始下一波
	await get_tree().create_timer(2.0).timeout
	GameManager.exit_shop()
	_start_wave(current_wave + 1)
