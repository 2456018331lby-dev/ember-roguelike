# ============================================================
# arena.gd - 祭祀模式竞技场管理
# 管理战场、生成敌人、处理波次过渡
# ============================================================
class_name Arena
extends Node2D

## 波次开始信号
signal wave_started(wave_num: int)
## 波次结束信号
signal wave_ended(wave_num: int)
## 竞技场通关信号
signal arena_cleared()

## 当前波次
var current_wave: int = 0
## 最大波次数
var max_waves: int = 20
## 当前波次的敌人列表
var active_enemies: Array[Node] = []
## 是否正在战斗
var is_combat_active: bool = false
## 是否暂停
var is_paused: bool = false

## 波次管理器引用
@onready var wave_manager: WaveManager = $WaveManager
## 敌人生成点容器
@onready var spawn_points: Node2D = $SpawnPoints
## 玩家引用
@onready var player: Node = $Player

## 敌人场景预加载（根据项目实际路径调整）
var enemy_melee_scene: PackedScene = preload("res://scenes/enemies/enemy_melee.tscn")
var enemy_ranged_scene: PackedScene = preload("res://scenes/enemies/enemy_ranged.tscn")
var enemy_boss_scene: PackedScene = preload("res://scenes/enemies/enemy_boss.tscn")

## 敌人类型与场景的映射
var enemy_scene_map: Dictionary = {}


func _ready() -> void:
	# 初始化敌人场景映射
	enemy_scene_map = {
		"melee": enemy_melee_scene,
		"ranged": enemy_ranged_scene,
		"boss": enemy_boss_scene,
	}
	print("[竞技场] 初始化完成，最大波次: ", max_waves)


func _process(_delta: float) -> void:
	if is_paused or not is_combat_active:
		return

	# 检查当前波次是否结束（所有敌人已清除）
	if active_enemies.size() == 0 and is_combat_active:
		_on_wave_cleared()


## 开始竞技场战斗
func start_arena() -> void:
	current_wave = 0
	_start_next_wave()


## 开始下一波
func _start_next_wave() -> void:
	current_wave += 1

	if current_wave > max_waves:
		# 所有波次通关
		is_combat_active = false
		arena_cleared.emit()
		print("[竞技场] 全部波次通关！")
		return

	print("[竞技场] 开始第 ", current_wave, " 波")
	is_combat_active = true

	# 获取当前波次配置
	var config: Dictionary = wave_manager.get_wave_config(current_wave)

	# 发送波次开始信号
	wave_started.emit(current_wave)

	# 生成敌人
	_spawn_wave_enemies(config)


## 根据波次配置生成敌人
func _spawn_wave_enemies(config: Dictionary) -> void:
	var enemy_list: Array = config.get("enemies", [])
	var spawn_pattern: String = config.get("spawn_pattern", "circle")

	# 获取可用的生成点
	var points: Array[Vector2] = _get_spawn_positions(spawn_pattern, enemy_list.size())

	for i in range(enemy_list.size()):
		var enemy_type: String = enemy_list[i]
		var pos: Vector2 = points[i] if i < points.size() else Vector2.ZERO

		# 延迟生成，制造节奏感
		var delay: float = i * 0.3
		get_tree().create_timer(delay).timeout.connect(
			_spawn_single_enemy.bind(enemy_type, pos)
		)


## 生成单个敌人
func _spawn_single_enemy(enemy_type: String, pos: Vector2) -> void:
	if not enemy_scene_map.has(enemy_type):
		push_warning("[竞技场] 未知敌人类型: " + enemy_type)
		return

	var enemy_scene: PackedScene = enemy_scene_map[enemy_type]
	var enemy: Node = enemy_scene.instantiate()
	enemy.global_position = pos

	# 监听敌人死亡
	if enemy.has_signal("died"):
		enemy.died.connect(_on_enemy_died.bind(enemy))

	add_child(enemy)
	active_enemies.append(enemy)


## 获取生成位置
func _get_spawn_positions(pattern: String, count: int) -> Array[Vector2]:
	var positions: Array[Vector2] = []
	var center: Vector2 = Vector2(512, 300)  # 竞技场中心
	var radius: float = 300.0

	match pattern:
		"circle":
			# 圆形分布
			for i in range(count):
				var angle: float = (TAU / count) * i
				positions.append(center + Vector2(cos(angle), sin(angle)) * radius)
		"line":
			# 线形分布
			var start_x: float = center.x - (count * 60.0) / 2.0
			for i in range(count):
				positions.append(Vector2(start_x + i * 60.0, center.y - radius))
		"random":
			# 随机分布
			for i in range(count):
				var offset: Vector2 = Vector2(
					randf_range(-radius, radius),
					randf_range(-radius, radius)
				)
				positions.append(center + offset)
		_:
			# 默认使用生成点节点
			for point in spawn_points.get_children():
				positions.append(point.global_position)

	return positions


## 敌人死亡回调
func _on_enemy_died(enemy: Node) -> void:
	if enemy in active_enemies:
		active_enemies.erase(enemy)
		print("[竞技场] 敌人被消灭，剩余: ", active_enemies.size())


## 当前波次清除
func _on_wave_cleared() -> void:
	is_combat_active = false
	wave_ended.emit(current_wave)
	print("[竞技场] 第 ", current_wave, " 波清除")

	# 短暂等待后开始下一波
	await get_tree().create_timer(2.0).timeout
	_start_next_wave()


## 暂停/恢复竞技场
func toggle_pause() -> void:
	is_paused = !is_paused
	get_tree().paused = is_paused


## 获取当前进度
func get_progress() -> Dictionary:
	return {
		"current_wave": current_wave,
		"max_waves": max_waves,
		"enemies_alive": active_enemies.size(),
		"is_active": is_combat_active,
	}
