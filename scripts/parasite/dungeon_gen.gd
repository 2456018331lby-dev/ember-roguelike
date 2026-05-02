# ============================================================
# dungeon_gen.gd - 地牢生成器（寄生模式）
# 生成地牢楼层布局，基于图的房间连通性
# ============================================================
class_name DungeonGenerator
extends Node

## 房间类型枚举
enum RoomType {
	COMBAT,    # 战斗房
	TREASURE,  # 宝箱房
	ELITE,     # 精英房
	BOSS,      # Boss房
	REST,      # 休息房
	SHOP,      # 商店房
}

## 房间数据类
class RoomData:
	var id: int = 0
	var room_type: RoomType = RoomType.COMBAT
	var position: Vector2 = Vector2.ZERO
	var connections: Array[int] = []  # 连接的房间ID列表
	var visited: bool = false
	var cleared: bool = false
	var floor_num: int = 1
	var enemy_count: int = 0
	var difficulty: float = 1.0

	func _init(p_id: int = 0, p_type: RoomType = RoomType.COMBAT) -> void:
		id = p_id
		room_type = p_type

## 房间数量范围
const MIN_ROOMS: int = 8
const MAX_ROOMS: int = 12

## 房间类型权重（基础）
const BASE_WEIGHTS: Dictionary = {
	RoomType.COMBAT: 50,
	RoomType.TREASURE: 15,
	RoomType.ELITE: 10,
	RoomType.REST: 15,
	RoomType.SHOP: 10,
}

## 信号：楼层生成完成
signal floor_generated(rooms: Array)


## 生成一个楼层的房间布局
func generate_floor(floor_num: int) -> Array[RoomData]:
	var room_count: int = randi_range(MIN_ROOMS, MAX_ROOMS)
	var rooms: Array[RoomData] = []

	# 第一个房间：起始房间（战斗房）
	var start_room: RoomData = RoomData.new(0, RoomType.COMBAT)
	start_room.position = Vector2(0, 0)
	start_room.floor_num = floor_num
	rooms.append(start_room)

	# 中间房间
	for i in range(1, room_count - 1):
		var room_type: RoomType = _pick_room_type(floor_num, i, room_count)
		var room: RoomData = RoomData.new(i, room_type)
		room.floor_num = floor_num
		room.difficulty = _calculate_difficulty(floor_num, room_type)

		# 计算房间位置（基于图的布局）
		room.position = _calculate_room_position(i, room_count)

		# 设置敌人数量
		if room_type == RoomType.COMBAT or room_type == RoomType.ELITE:
			room.enemy_count = _get_enemy_count(floor_num, room_type)

		rooms.append(room)

	# 最后一个房间：Boss房
	var boss_room: RoomData = RoomData.new(room_count - 1, RoomType.BOSS)
	boss_room.floor_num = floor_num
	boss_room.difficulty = 1.0 + floor_num * 0.5
	boss_room.enemy_count = 1
	boss_room.position = _calculate_room_position(room_count - 1, room_count)
	rooms.append(boss_room)

	# 建立房间之间的连通关系
	_build_connections(rooms)

	floor_generated.emit(rooms)
	print("[地牢生成] 第 %d 层生成完成，共 %d 个房间" % [floor_num, rooms.size()])

	return rooms


## 根据权重选择房间类型
func _pick_room_type(floor_num: int, index: int, total: int) -> RoomType:
	var weights: Dictionary = BASE_WEIGHTS.duplicate()

	# 根据楼层调整权重
	weights[RoomType.ELITE] += floor_num * 2
	weights[RoomType.TREASURE] = maxi(5, 15 - floor_num)

	# 确保第一个房间之后有商店或休息房
	if index == 1:
		weights[RoomType.SHOP] += 20
		weights[RoomType.REST] += 20

	# 靠近Boss房时增加精英房概率
	if index >= total - 3:
		weights[RoomType.ELITE] += 15

	# 加权随机选择
	var total_weight: int = 0
	for w in weights.values():
		total_weight += w

	var roll: int = randi() % total_weight
	var cumulative: int = 0

	for type in weights.keys():
		cumulative += weights[type]
		if roll < cumulative:
			return type

	return RoomType.COMBAT


## 计算房间位置（基于图的布局算法）
func _calculate_room_position(index: int, total: int) -> Vector2:
	# 使用分层布局：水平分层，垂直随机偏移
	var layer_count: int = ceili(sqrt(float(total)))
	var layer: int = index / maxi(1, layer_count)
	var pos_in_layer: int = index % maxi(1, layer_count)

	var x: float = layer * 200.0 + randf_range(-30, 30)
	var y: float = pos_in_layer * 150.0 + randf_range(-20, 20)

	# 垂直居中
	var layer_size: int = mini(layer_count, total - layer * layer_count)
	y -= (layer_size * 150.0) / 2.0

	return Vector2(x, y)


## 建立房间之间的连通关系
func _build_connections(rooms: Array[RoomData]) -> void:
	if rooms.size() < 2:
		return

	# 确保线性主线连通（每个房间至少连接前一个）
	for i in range(1, rooms.size()):
		_connect_rooms(rooms[i - 1], rooms[i])

	# 添加额外的随机连接（形成分支路径）
	var extra_connections: int = randi_range(1, rooms.size() / 3)
	for _i in range(extra_connections):
		var a_idx: int = randi_range(0, rooms.size() - 3)
		var b_idx: int = randi_range(a_idx + 2, rooms.size() - 1)

		if b_idx not in rooms[a_idx].connections:
			_connect_rooms(rooms[a_idx], rooms[b_idx])


## 连接两个房间（双向）
func _connect_rooms(room_a: RoomData, room_b: RoomData) -> void:
	if room_b.id not in room_a.connections:
		room_a.connections.append(room_b.id)
	if room_a.id not in room_b.connections:
		room_b.connections.append(room_a.id)


## 计算房间难度
func _calculate_difficulty(floor_num: int, room_type: RoomType) -> float:
	var base: float = 1.0 + floor_num * 0.3
	match room_type:
		RoomType.ELITE:
			return base * 1.5
		RoomType.BOSS:
			return base * 2.0
		_:
			return base


## 获取敌人数量
func _get_enemy_count(floor_num: int, room_type: RoomType) -> int:
	var base_count: int = 2 + floor_num
	if room_type == RoomType.ELITE:
		base_count = maxi(1, base_count / 2)  # 精英房少而强
	return mini(base_count, 8)
