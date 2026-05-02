## 游戏状态管理器 (全局单例)
## 管理游戏模式、运行状态、波次/房间进度
extends Node

## 游戏模式
enum GameMode { SACRIFICE, PARASITE }

## 游戏状态
enum GameState { MENU, PLAYING, SHOP, GAME_OVER, PAUSED, VICTORY }

## 当前游戏模式
var current_mode: GameMode = GameMode.SACRIFICE
## 当前游戏状态
var current_state: GameState = GameState.MENU
## 当前波次（献祭模式）
var current_wave: int = 0
## 当前房间索引（寄生模式）
var current_room: int = 0
## 当前楼层（寄生模式）
var current_floor: int = 0
## 当前难度等级
var difficulty: int = 1
## 本次运行开始时间
var run_start_time: float = 0.0

## 信号
signal run_started(mode: GameMode)
signal run_ended(won: bool, mode: GameMode)
signal wave_completed(wave_num: int)
signal room_completed(room_index: int)
signal floor_completed(floor_num: int)
signal state_changed(old_state: GameState, new_state: GameState)
signal difficulty_changed(new_difficulty: int)

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

## 开始一次新运行
func start_run(mode: GameMode, diff: int = 1) -> void:
	current_mode = mode
	current_state = GameState.PLAYING
	current_wave = 0
	current_room = 0
	current_floor = 0
	difficulty = diff
	run_start_time = Time.get_unix_time_from_system()
	run_started.emit(mode)

## 结束运行
func end_run(won: bool) -> void:
	var old_state = current_state
	current_state = GameState.VICTORY if won else GameState.GAME_OVER
	state_changed.emit(old_state, current_state)
	
	# 计算运行时长
	var duration = Time.get_unix_time_from_system() - run_start_time
	
	# 余烬奖励
	var ember_reward = _calculate_ember_reward(won, duration)
	MetaProgress.add_ember(ember_reward)
	MetaProgress.total_runs += 1
	if won:
		MetaProgress.total_wins += 1
	MetaProgress.save_data()
	
	run_ended.emit(won, current_mode)

## 完成一波（献祭模式）
func complete_wave(wave_num: int) -> void:
	current_wave = wave_num
	wave_completed.emit(wave_num)

## 完成一个房间（寄生模式）
func complete_room(room_index: int) -> void:
	current_room = room_index
	room_completed.emit(room_index)

## 进入下一层（寄生模式）
func next_floor() -> void:
	current_floor += 1
	current_room = 0
	floor_completed.emit(current_floor)

## 切换到商店状态
func enter_shop() -> void:
	var old_state = current_state
	current_state = GameState.SHOP
	state_changed.emit(old_state, current_state)

## 从商店返回战斗
func exit_shop() -> void:
	var old_state = current_state
	current_state = GameState.PLAYING
	state_changed.emit(old_state, current_state)

## 暂停
func pause_game() -> void:
	if current_state == GameState.PLAYING:
		var old_state = current_state
		current_state = GameState.PAUSED
		get_tree().paused = true
		state_changed.emit(old_state, current_state)

## 恢复
func resume_game() -> void:
	if current_state == GameState.PAUSED:
		var old_state = current_state
		current_state = GameState.PLAYING
		get_tree().paused = false
		state_changed.emit(old_state, current_state)

## 设置难度
func set_difficulty(diff: int) -> void:
	difficulty = clampi(diff, 1, 6)
	difficulty_changed.emit(difficulty)

## 获取难度倍率
func get_difficulty_multiplier() -> Dictionary:
	return {
		"enemy_hp": 1.0 + (difficulty - 1) * 0.2,
		"enemy_damage": 1.0 + (difficulty - 1) * 0.15,
		"enemy_speed": 1.0 + (difficulty - 1) * 0.05,
		"shop_price": 1.0 + (difficulty - 1) * 0.15,
		"enemy_count": 1.0 + (difficulty - 1) * 0.1,
	}

## 计算余烬奖励
func _calculate_ember_reward(won: bool, duration: float) -> int:
	var base = 10
	if current_mode == GameMode.SACRIFICE:
		base += current_wave * 2
	else:
		base += current_floor * 5 + current_room
	if won:
		base *= 2
	# 时间奖励（越快越多）
	if duration < 600:  # 10分钟内
		base += 5
	return base
