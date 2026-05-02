## card_passive.gd
## 被动卡 - 装备后持续生效的被动效果
## 支持: 生命回复、荆棘反伤、速度提升
## 被动卡装备在专用槽位中，每回合自动触发
class_name CardPassive
extends CardBase

## ==================== 效果类型常量 ====================

## 生命回复 - 每回合恢复生命值
const EFFECT_REGEN: String = "regen"

## 荆棘 - 受到攻击时反弹伤害给攻击者
const EFFECT_THORNS: String = "thorns"

## 速度提升 - 提高行动速度
const EFFECT_SPEED_BOOST: String = "speed_boost"

## ==================== 属性 ====================

## 是否已装备到被动槽位
var is_equipped: bool = false

## 装备槽位索引(-1表示未装备)
var slot_index: int = -1

## 累计生效回合数
var ticks_active: int = 0

## ==================== 方法 ====================

func _init() -> void:
	card_type = CardType.PASSIVE

## 装备被动卡到指定槽位
## @param slot: 槽位索引
## @param user: 装备者
func equip(slot: int, user) -> void:
	if is_equipped:
		push_warning("被动卡 [%s] 已经装备在槽位 %d" % [card_name, slot_index])
		return

	is_equipped = true
	slot_index = slot
	ticks_active = 0

	# 如果有立即生效的效果(如速度提升)，立即应用
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		if effect_type == EFFECT_SPEED_BOOST:
			_apply_speed_boost(user, effect.get("value", 0.0))

	print("被动卡 [%s] 已装备到槽位 %d" % [card_name, slot])

## 卸下被动卡
## @param user: 卸下者(用于移除持续效果)
func unequip(user) -> void:
	if not is_equipped:
		return

	# 移除持续性效果
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		if effect_type == EFFECT_SPEED_BOOST:
			_remove_speed_boost(user, effect.get("value", 0.0))

	is_equipped = false
	slot_index = -1
	ticks_active = 0
	print("被动卡 [%s] 已卸下" % card_name)

## 重写执行方法 - 被动卡每回合自动触发
## @param user: 装备者
## @param target: 攻击者(荆棘效果需要知道谁攻击了装备者)
func execute(user, target) -> void:
	if not is_equipped:
		return

	ticks_active += 1

	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		var value: float = effect.get("value", 0.0)

		match effect_type:
			EFFECT_REGEN:
				_apply_regen(user, value)

			EFFECT_THORNS:
				# 荆棘只在被攻击时触发，这里记录效果激活状态
				# 实际触发在 on_damage_taken 中处理
				pass

			EFFECT_SPEED_BOOST:
				# 速度提升在装备时立即生效，每回合刷新
				_apply_speed_boost(user, value)

			_:
				push_warning("被动卡 [%s] 未识别的效果类型: %s" % [card_name, effect_type])

## 处理受到攻击时的被动效果(荆棘)
## @param user: 装备者(被攻击方)
## @param attacker: 攻击者
## @param damage_taken: 受到的伤害值
## @return: 额外反弹伤害值
func on_damage_taken(user, attacker, damage_taken: float) -> float:
	if not is_equipped:
		return 0.0

	var total_reflect: float = 0.0

	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		if effect_type == EFFECT_THORNS:
			var thorns_damage: float = effect.get("value", 0.0)
			# 荆棘伤害可以是固定值或百分比
			if effect.get("is_percentage", false):
				thorns_damage = damage_taken * effect.get("value", 0.0)

			total_reflect += thorns_damage
			print("被动卡 [%s] 荆棘反弹 %.1f 点伤害给攻击者" % [card_name, thorns_damage])

	return total_reflect

## 应用生命回复
## @param user: 装备者
## @param heal_amount: 每回合回复量
func _apply_regen(user, heal_amount: float) -> void:
	if user == null:
		return

	if user.has_method("heal"):
		user.heal(heal_amount)
		print("被动卡 [%s] 回复 %.1f 生命值" % [card_name, heal_amount])
	else:
		push_warning("被动卡: 使用者没有 heal 方法")

## 应用速度提升(永久生效直到卸下)
## @param user: 装备者
## @param speed_bonus: 速度加成值
func _apply_speed_boost(user, speed_bonus: float) -> void:
	if user == null:
		return

	if user.has_method("add_stat_modifier"):
		var modifier: Dictionary = {
			"stat": "speed",
			"value": speed_bonus,
			"source": "passive_%s" % id,
			"type": "flat"  # 固定值加成，也可为 "percentage"
		}
		user.add_stat_modifier(modifier)

## 移除速度提升效果
## @param user: 装备者
## @param speed_bonus: 要移除的速度加成值
func _remove_speed_boost(user, speed_bonus: float) -> void:
	if user == null:
		return

	if user.has_method("remove_stat_modifier"):
		user.remove_stat_modifier("speed", "passive_%s" % id)

## 重写效果描述格式化(被动卡专用)
## @param effect: 效果字典
## @return: 格式化的被动效果描述
func _format_effect(effect: Dictionary) -> String:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)

	match effect_type:
		EFFECT_REGEN:
			return "每回合回复 %.1f 生命值" % value
		EFFECT_THORNS:
			if effect.get("is_percentage", false):
				return "荆棘: 反弹受到伤害的 %.0f%%" % (value * 100.0)
			else:
				return "荆棘: 受击时反弹 %.1f 点伤害" % value
		EFFECT_SPEED_BOOST:
			return "速度 +%.1f" % value
		_:
			return super._format_effect(effect)
