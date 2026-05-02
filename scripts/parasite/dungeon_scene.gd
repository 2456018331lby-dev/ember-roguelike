## 寄生模式 - 地牢场景脚本
extends Node2D

@onready var player: CharacterBody2D = $Player
@onready var room_container: Node2D = $RoomContainer

## HUD
var hud: CanvasLayer = null
const HUD_SCENE = preload("res://scenes/common/hud.tscn")

## 地牢状态
var current_floor: int = 0
var current_room_index: int = 0
var rooms: Array[Dictionary] = []

## 房间类型
enum RoomType { COMBAT, TREASURE, ELITE, BOSS, REST, SHOP }

## 房间颜色
var room_colors = {
	RoomType.COMBAT: Color(0.6, 0.2, 0.2),
	RoomType.TREASURE: Color(0.8, 0.7, 0.1),
	RoomType.ELITE: Color(0.7, 0.1, 0.5),
	RoomType.BOSS: Color(0.9, 0.1, 0.1),
	RoomType.REST: Color(0.2, 0.6, 0.3),
	RoomType.SHOP: Color(0.2, 0.4, 0.8),
}

func _ready() -> void:
	# 创建 HUD
	hud = HUD_SCENE.instantiate()
	add_child(hud)
	if player:
		hud.bind_player(player)
		player.position = Vector2(640, 360)
	
	# 生成第一层地牢
	call_deferred("_generate_floor")

## 生成地牢层
func _generate_floor() -> void:
	current_floor += 1
	current_room_index = 0
	rooms.clear()
	
	# 生成 8-12 个房间
	var room_count = randi_range(8, 12)
	
	for i in room_count:
		var room_type = _pick_room_type(i, room_count)
		rooms.append({
			"type": room_type,
			"cleared": false,
			"index": i,
		})
	
	# 最后一个房间一定是 Boss
	rooms[room_count - 1]["type"] = RoomType.BOSS
	
	# 显示地图概览
	_show_floor_map()

## 选择房间类型（加权随机）
func _pick_room_type(index: int, total: int) -> int:
	# 第一个房间一定是战斗
	if index == 0:
		return RoomType.COMBAT
	
	var weights = {
		RoomType.COMBAT: 40,
		RoomType.TREASURE: 15,
		RoomType.ELITE: 15,
		RoomType.REST: 15,
		RoomType.SHOP: 15,
	}
	
	# 确保至少有 1 个商店和 1 个休息室
	# （简化处理，后续可以更精确）
	var total_weight = 0
	for w in weights.values():
		total_weight += w
	
	var roll = randi() % total_weight
	var cumulative = 0
	for type in weights:
		cumulative += weights[type]
		if roll < cumulative:
			return type
	return RoomType.COMBAT

## 显示楼层地图
func _show_floor_map() -> void:
	# 清除旧房间显示
	for child in room_container.get_children():
		child.queue_free()
	
	# 在屏幕上绘制房间节点
	var start_x = 100
	var spacing = (1080.0) / (rooms.size() + 1)
	
	for i in rooms.size():
		var room = rooms[i]
		var node = Button.new()
		node.text = _get_room_icon(room["type"]) + "\n" + _get_room_name(room["type"])
		node.position = Vector2(start_x + spacing * (i + 1) - 40, 150)
		node.size = Vector2(80, 60)
		node.modulate = room_colors.get(room["type"], Color.WHITE)
		
		# 只能进入当前或下一个房间
		if i == current_room_index:
			node.pressed.connect(_enter_room.bind(i))
		else:
			node.disabled = true
		
		room_container.add_child(node)

## 进入房间
func _enter_room(room_index: int) -> void:
	current_room_index = room_index
	var room = rooms[room_index]
	
	match room["type"]:
		RoomType.COMBAT:
			_start_combat_room()
		RoomType.TREASURE:
			_start_treasure_room()
		RoomType.ELITE:
			_start_elite_room()
		RoomType.BOSS:
			_start_boss_room()
		RoomType.REST:
			_start_rest_room()
		RoomType.SHOP:
			_start_shop_room()

## 战斗房间
func _start_combat_room() -> void:
	# 生成 3-5 个敌人
	var count = randi_range(3, 5)
	for i in count:
		var enemy = _create_enemy()
		if enemy:
			var angle = randf() * TAU
			enemy.position = Vector2(640, 360) + Vector2.from_angle(angle) * randf_range(150, 250)
			room_container.add_child(enemy)

## 精英房间
func _start_elite_room() -> void:
	# 1 个精英 + 2 个杂兵
	var elite = _create_enemy()
	if elite:
		elite.position = Vector2(640, 250)
		# 精英更大更强
		for child in elite.get_children():
			if child is ColorRect:
				child.color = Color(0.5, 0.1, 0.7)
				child.size = Vector2(36, 36)
				child.position = Vector2(-18, -18)
		elite.set_meta("hp", elite.get_meta("hp", 30) * 3)
		elite.set_meta("damage", elite.get_meta("damage", 5) * 2)
		room_container.add_child(elite)

## Boss 房间
func _start_boss_room() -> void:
	var boss = _create_enemy()
	if boss:
		boss.position = Vector2(640, 200)
		for child in boss.get_children():
			if child is ColorRect:
				child.color = Color(0.8, 0.05, 0.05)
				child.size = Vector2(60, 60)
				child.position = Vector2(-30, -30)
		boss.set_meta("hp", boss.get_meta("hp", 30) * 8)
		boss.set_meta("damage", boss.get_meta("damage", 5) * 3)
		room_container.add_child(boss)

## 宝箱房间
func _start_treasure_room() -> void:
	# 给予随机卡牌奖励
	# TODO: 显示卡牌选择界面
	_on_room_cleared()

## 休息房间
func _start_rest_room() -> void:
	# 恢复 30% 生命
	if player and player.has_method("heal"):
		player.heal(int(player.max_hp * 0.3))
	_on_room_cleared()

## 商店房间
func _start_shop_room() -> void:
	GameManager.enter_shop()
	# TODO: 显示商店界面
	# 暂时直接清除
	await get_tree().create_timer(1.0).timeout
	GameManager.exit_shop()
	_on_room_cleared()

## 房间清除
func _on_room_cleared() -> void:
	rooms[current_room_index]["cleared"] = true
	GameManager.complete_room(current_room_index)
	
	# 检查是否整层清除
	if current_room_index >= rooms.size() - 1:
		# 进入下一层
		GameManager.next_floor()
		if current_floor >= 5:
			GameManager.end_run(true)
		else:
			_generate_floor()
	else:
		current_room_index += 1
		_show_floor_map()

## 创建敌人（临时简易版本）
func _create_enemy() -> CharacterBody2D:
	var enemy = CharacterBody2D.new()
	enemy.set_meta("hp", 30 + current_floor * 15)
	enemy.set_meta("max_hp", 30 + current_floor * 15)
	enemy.set_meta("damage", 5 + current_floor * 3)
	enemy.set_meta("speed", 100.0 + current_floor * 10)
	
	var col = CollisionShape2D.new()
	var shape = CircleShape2D.new()
	shape.radius = 15
	col.shape = shape
	enemy.add_child(col)
	
	var visual = ColorRect.new()
	visual.size = Vector2(24, 24)
	visual.position = Vector2(-12, -12)
	visual.color = Color(0.8, 0.2, 0.2)
	enemy.add_child(visual)
	
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

## 房间图标
func _get_room_icon(type: RoomType) -> String:
	match type:
		RoomType.COMBAT: return "⚔️"
		RoomType.TREASURE: return "📦"
		RoomType.ELITE: return "💀"
		RoomType.BOSS: return "👑"
		RoomType.REST: return "🏕️"
		RoomType.SHOP: return "🛒"
	return "?"

## 房间名称
func _get_room_name(type: RoomType) -> String:
	match type:
		RoomType.COMBAT: return "战斗"
		RoomType.TREASURE: return "宝箱"
		RoomType.ELITE: return "精英"
		RoomType.BOSS: return "Boss"
		RoomType.REST: return "休息"
		RoomType.SHOP: return "商店"
	return "未知"
