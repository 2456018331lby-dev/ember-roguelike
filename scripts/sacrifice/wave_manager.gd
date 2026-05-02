# ============================================================
# wave_manager.gd - 波次管理器
# 管理20波战斗的敌人配置、难度递增、Boss波次
# ============================================================
class_name WaveManager
extends Node

## Boss波次列表
const BOSS_WAVES: Array[int] = [5, 10, 15, 20]

## 总波次数
const TOTAL_WAVES: int = 20

## 敌人类型枚举
const ENEMY_MELEE: String = "melee"
const ENEMY_RANGED: String = "ranged"
const ENEMY_BOSS: String = "boss"

## 生成模式
const SPAWN_CIRCLE: String = "circle"
const SPAWN_LINE: String = "line"
const SPAWN_RANDOM: String = "random"


## 获取指定波次的配置
func get_wave_config(wave_num: int) -> Dictionary:
	if wave_num < 1 or wave_num > TOTAL_WAVES:
		push_error("[波次管理] 无效波次: " + str(wave_num))
		return {}

	# Boss波次单独处理
	if wave_num in BOSS_WAVES:
		return _get_boss_wave_config(wave_num)

	# 普通波次
	return _get_normal_wave_config(wave_num)


## 获取普通波次配置
func _get_normal_wave_config(wave_num: int) -> Dictionary:
	var config: Dictionary = {}

	# 根据波次计算敌人数量（3-12个，逐渐增加）
	var base_count: int = 3 + int(wave_num * 0.5)
	base_count = mini(base_count, 12)

	# 根据波次计算敌人类型比例
	var enemies: Array[String] = []
	var ranged_ratio: float = 0.0

	if wave_num >= 3:
		ranged_ratio = 0.2
	if wave_num >= 7:
		ranged_ratio = 0.3
	if wave_num >= 12:
		ranged_ratio = 0.4
	if wave_num >= 17:
		ranged_ratio = 0.5

	# 生成敌人列表
	var ranged_count: int = int(base_count * ranged_ratio)
	var melee_count: int = base_count - ranged_count

	for i in range(melee_count):
		enemies.append(ENEMY_MELEE)
	for i in range(ranged_count):
		enemies.append(ENEMY_RANGED)

	# 打乱顺序
	enemies.shuffle()

	# 生成模式
	var spawn_pattern: String = SPAWN_CIRCLE
	if wave_num >= 8:
		spawn_pattern = [SPAWN_CIRCLE, SPAWN_LINE, SPAWN_RANDOM].pick_random()

	# 难度倍率
	var difficulty_mult: float = 1.0 + (wave_num - 1) * 0.1

	config = {
		"wave_num": wave_num,
		"enemies": enemies,
		"spawn_pattern": spawn_pattern,
		"difficulty_mult": difficulty_mult,
		"is_boss": false,
		"enemy_hp_mult": difficulty_mult,
		"enemy_damage_mult": 1.0 + (wave_num - 1) * 0.08,
		"enemy_speed_mult": 1.0 + (wave_num - 1) * 0.03,
	}

	return config


## 获取Boss波次配置
func _get_boss_wave_config(wave_num: int) -> Dictionary:
	var boss_phase: int = BOSS_WAVES.find(wave_num) + 1  # 1-4

	# Boss前的小怪数量随阶段增加
	var minion_count: int = 2 + boss_phase * 2
	var enemies: Array[String] = []

	# 添加小怪
	for i in range(minion_count):
		if i % 3 == 0:
			enemies.append(ENEMY_RANGED)
		else:
			enemies.append(ENEMY_MELEE)

	# 添加Boss
	enemies.append(ENEMY_BOSS)

	# Boss波难度
	var difficulty_mult: float = 1.0 + boss_phase * 0.5

	var config: Dictionary = {
		"wave_num": wave_num,
		"enemies": enemies,
		"spawn_pattern": SPAWN_CIRCLE,
		"difficulty_mult": difficulty_mult,
		"is_boss": true,
		"boss_phase": boss_phase,
		"enemy_hp_mult": difficulty_mult,
		"enemy_damage_mult": 1.0 + boss_phase * 0.3,
		"enemy_speed_mult": 1.0 + boss_phase * 0.1,
	}

	return config


## 获取波次摘要信息（用于UI显示）
func get_wave_summary(wave_num: int) -> String:
	var config: Dictionary = get_wave_config(wave_num)
	if config.is_empty():
		return "无效波次"

	var is_boss: bool = config.get("is_boss", false)
	var count: int = config.get("enemies", []).size()

	if is_boss:
		return "第 %d 波 - BOSS战！（%d 个敌人）" % [wave_num, count]
	else:
		return "第 %d 波（%d 个敌人）" % [wave_num, count]


## 判断是否为Boss波
func is_boss_wave(wave_num: int) -> bool:
	return wave_num in BOSS_WAVES


## 获取下一波倒计时（秒）
func get_intermission_time(wave_num: int) -> float:
	# Boss波前的休息时间更长
	if wave_num + 1 in BOSS_WAVES:
		return 4.0
	return 2.0
