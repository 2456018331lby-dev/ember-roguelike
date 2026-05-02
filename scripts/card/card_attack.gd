## card_attack.gd
## 攻击卡 - 对敌人造成伤害
## 支持: 直接伤害、范围伤害、持续伤害(DoT)
class_name CardAttack
extends CardBase

## ==================== 效果类型常量 ====================

## 直接伤害 - 立即对单个目标造成伤害
const EFFECT_DIRECT_DAMAGE: String = "direct_damage"

## 范围伤害 - 对所有敌人造成伤害(通常数值较低)
const EFFECT_AOE_DAMAGE: String = "aoe_damage"

## 持续伤害 - 每回合对目标造成伤害(DOT)
const EFFECT_DOT_DAMAGE: String = "dot_damage"

## ==================== 方法 ====================

func _init() -> void:
	card_type = CardType.ATTACK

## 重写执行方法 - 攻击卡专用逻辑
## @param user: 使用者
## @param target: 目标(敌人)
func execute(user, target) -> void:
	if effects.is_empty():
		push_warning("攻击卡 [%s] 没有配置任何效果" % card_name)
		return

	# 检查并扣除献祭消耗
	if not sacrifice_cost.is_empty():
		if not _pay_sacrifice_cost(user):
			return

	# 遍历所有效果并应用
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		var value: float = effect.get("value", 0.0)
		var effect_target: String = effect.get("target", "enemy")

		match effect_type:
			EFFECT_DIRECT_DAMAGE:
				# 直接伤害 - 对单个目标造成即时伤害
				_apply_direct_damage(user, target, value)

			EFFECT_AOE_DAMAGE:
				# 范围伤害 - 对所有敌人造成伤害
				_apply_aoe_damage(user, target, value)

			EFFECT_DOT_DAMAGE:
				# 持续伤害 - 添加DOT效果
				_apply_dot_damage(user, target, value, effect)

			_:
				push_warning("攻击卡 [%s] 未识别的效果类型: %s" % [card_name, effect_type])

## 应用直接伤害
## @param user: 使用者(用于计算攻击力加成)
## @param target: 受伤目标
## @param base_damage: 基础伤害值
func _apply_direct_damage(user, target, base_damage: float) -> void:
	if target == null:
		push_warning("攻击卡: 目标为空，无法造成伤害")
		return

	var final_damage: float = base_damage

	# 如果使用者有攻击力属性，可以加成
	if user.has_method("get_stat"):
		var attack_power: float = user.get_stat("attack")
		final_damage += attack_power * 0.5  # 攻击力提供50%加成

	# 应用伤害到目标
	if target.has_method("take_damage"):
		target.take_damage(final_damage)
		print("攻击卡 [%s] 对目标造成 %.1f 点伤害" % [card_name, final_damage])
	else:
		push_warning("攻击卡: 目标没有 take_damage 方法")

## 应用范围伤害(AOE)
## @param user: 使用者
## @param target: 主目标(用于获取敌人列表上下文)
## @param base_damage: 基础伤害值(通常低于直接伤害)
func _apply_aoe_damage(user, target, base_damage: float) -> void:
	var final_damage: float = base_damage

	# 攻击力加成
	if user.has_method("get_stat"):
		var attack_power: float = user.get_stat("attack")
		final_damage += attack_power * 0.3  # AOE的攻击力加成较低(30%)

	# 获取所有敌人并造成伤害
	# 优先使用场景树中的敌人组
	var enemies: Array[Node] = []
	var scene_tree: SceneTree = Engine.get_main_loop() as SceneTree
	if scene_tree:
		enemies = scene_tree.get_nodes_in_group("enemies")

	if enemies.is_empty() and target != null:
		# 如果没有找到敌人组，至少攻击主目标
		enemies = [target]

	for enemy in enemies:
		if enemy.has_method("take_damage"):
			enemy.take_damage(final_damage)

	print("攻击卡 [%s] 对 %d 个敌人造成 %.1f 点AOE伤害" % [card_name, enemies.size(), final_damage])

## 应用持续伤害(DOT)
## @param user: 使用者
## @param target: 受影响的目标
## @param tick_damage: 每次tick的伤害值
## @param effect: 完整效果字典(可包含额外参数如持续回合数)
func _apply_dot_damage(user, target, tick_damage: float, effect: Dictionary) -> void:
	if target == null:
		push_warning("攻击卡: 目标为空，无法施加DOT")
		return

	# 获取持续回合数(默认3回合)
	var duration: int = int(effect.get("duration", 3))
	# 获取tick间隔(默认每回合触发)
	var tick_interval: float = effect.get("tick_interval", 1.0)

	# 创建DOT效果字典
	var dot_effect: Dictionary = {
		"type": "dot",
		"damage_per_tick": tick_damage,
		"duration": duration,
		"remaining_ticks": duration,
		"tick_interval": tick_interval,
		"source_card": card_name
	}

	# 将DOT效果添加到目标
	if target.has_method("add_status_effect"):
		target.add_status_effect(dot_effect)
		print("攻击卡 [%s] 对目标施加DOT: %.1f伤害/回合，持续%d回合" % [
			card_name, tick_damage, duration
		])
	else:
		push_warning("攻击卡: 目标没有 add_status_effect 方法，无法施加DOT")

## 重写效果描述格式化(攻击卡专用)
## @param effect: 效果字典
## @return: 格式化的攻击效果描述
func _format_effect(effect: Dictionary) -> String:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)

	match effect_type:
		EFFECT_DIRECT_DAMAGE:
			return "造成 %.1f 点伤害" % value
		EFFECT_AOE_DAMAGE:
			return "对所有敌人造成 %.1f 点伤害" % value
		EFFECT_DOT_DAMAGE:
			var duration: int = int(effect.get("duration", 3))
			return "每回合造成 %.1f 点伤害，持续 %d 回合" % [value, duration]
		_:
			return super._format_effect(effect)
