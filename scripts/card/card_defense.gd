## card_defense.gd
## 防御卡 - 为使用者提供护盾、闪避或反弹效果
## 支持: 护盾、闪避率、伤害反弹
class_name CardDefense
extends CardBase

## ==================== 效果类型常量 ====================

## 护盾 - 为使用者添加护盾值，吸收伤害
const EFFECT_SHIELD: String = "shield"

## 闪避率 - 提高闪避概率
const EFFECT_DODGE_CHANCE: String = "dodge_chance"

## 反弹 - 将受到的伤害反弹给攻击者
const EFFECT_REFLECT: String = "reflect"

## ==================== 方法 ====================

func _init() -> void:
	card_type = CardType.DEFENSE

## 重写执行方法 - 防御卡专用逻辑
## @param user: 使用者(施加防御效果)
## @param target: 目标(通常为自身或忽略)
func execute(user, target) -> void:
	if effects.is_empty():
		push_warning("防御卡 [%s] 没有配置任何效果" % card_name)
		return

	# 检查并扣除献祭消耗
	if not sacrifice_cost.is_empty():
		if not _pay_sacrifice_cost(user):
			return

	# 遍历所有效果并应用
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		var value: float = effect.get("value", 0.0)

		match effect_type:
			EFFECT_SHIELD:
				_apply_shield(user, value, effect)

			EFFECT_DODGE_CHANCE:
				_apply_dodge_chance(user, value, effect)

			EFFECT_REFLECT:
				_apply_reflect(user, value, effect)

			_:
				push_warning("防御卡 [%s] 未识别的效果类型: %s" % [card_name, effect_type])

## 应用护盾效果
## @param user: 使用者(护盾施加对象)
## @param base_shield: 基础护盾值
## @param effect: 完整效果字典(可包含额外参数)
func _apply_shield(user, base_shield: float, effect: Dictionary) -> void:
	if user == null:
		push_warning("防御卡: 使用者为空，无法施加护盾")
		return

	var final_shield: float = base_shield

	# 如果使用者有防御属性，可以加成护盾值
	if user.has_method("get_stat"):
		var defense_stat: float = user.get_stat("defense")
		final_shield += defense_stat * 0.4  # 防御力提供40%加成

	# 获取护盾持续回合数(默认1回合，0表示永久直到被打破)
	var duration: int = int(effect.get("duration", 1))

	# 施加护盾
	if user.has_method("add_shield"):
		user.add_shield(final_shield, duration)
		print("防御卡 [%s] 为使用者添加 %.1f 点护盾，持续 %d 回合" % [
			card_name, final_shield, duration
		])
	else:
		push_warning("防御卡: 使用者没有 add_shield 方法")

## 应用闪避率提升
## @param user: 使用者
## @param dodge_amount: 闪避率增量(百分比，如0.15=15%)
## @param effect: 完整效果字典
func _apply_dodge_chance(user, dodge_amount: float, effect: Dictionary) -> void:
	if user == null:
		push_warning("防御卡: 使用者为空，无法施加闪避效果")
		return

	# 获取闪避持续回合数(默认1回合)
	var duration: int = int(effect.get("duration", 1))

	# 创建闪避状态效果
	var dodge_effect: Dictionary = {
		"type": "dodge_chance",
		"value": dodge_amount,
		"duration": duration,
		"remaining_turns": duration,
		"source_card": card_name
	}

	# 添加状态效果
	if user.has_method("add_status_effect"):
		user.add_status_effect(dodge_effect)
		print("防御卡 [%s] 提升闪避率 %.0f%%，持续 %d 回合" % [
			card_name, dodge_amount * 100.0, duration
		])
	else:
		push_warning("防御卡: 使用者没有 add_status_effect 方法")

## 应用伤害反弹效果
## @param user: 使用者
## @param reflect_ratio: 反弹比例(如0.3=反弹30%受到的伤害)
## @param effect: 完整效果字典
func _apply_reflect(user, reflect_ratio: float, effect: Dictionary) -> void:
	if user == null:
		push_warning("防御卡: 使用者为空，无法施加反弹效果")
		return

	# 获取反弹持续回合数(默认1回合)
	var duration: int = int(effect.get("duration", 1))

	# 创建反弹状态效果
	var reflect_effect: Dictionary = {
		"type": "reflect",
		"reflect_ratio": reflect_ratio,
		"duration": duration,
		"remaining_turns": duration,
		"source_card": card_name
	}

	# 添加状态效果
	if user.has_method("add_status_effect"):
		user.add_status_effect(reflect_effect)
		print("防御卡 [%s] 激活伤害反弹 %.0f%%，持续 %d 回合" % [
			card_name, reflect_ratio * 100.0, duration
		])
	else:
		push_warning("防御卡: 使用者没有 add_status_effect 方法")

## 重写效果描述格式化(防御卡专用)
## @param effect: 效果字典
## @return: 格式化的防御效果描述
func _format_effect(effect: Dictionary) -> String:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)
	var duration: int = int(effect.get("duration", 1))

	match effect_type:
		EFFECT_SHIELD:
			return "获得 %.1f 点护盾（持续 %d 回合）" % [value, duration]
		EFFECT_DODGE_CHANCE:
			return "闪避率提升 %.0f%%（持续 %d 回合）" % [value * 100.0, duration]
		EFFECT_REFLECT:
			return "反弹 %.0f%% 受到的伤害（持续 %d 回合）" % [value * 100.0, duration]
		_:
			return super._format_effect(effect)
