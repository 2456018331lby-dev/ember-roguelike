## card_curse.gd
## 诅咒卡 - 无法正常丢弃的特殊卡牌
## 既有负面效果，也可能在满足条件时触发隐藏的正面效果
## 诅咒卡是roguelike游戏中的核心风险/收益机制
class_name CardCurse
extends CardBase

## ==================== 信号 ====================

## 隐藏正面效果触发时发出信号
signal hidden_effect_triggered(card: CardCurse, effect: Dictionary)

## ==================== 属性 ====================

## 隐藏的正面效果列表 - 满足条件时激活
## 每个字典: {type: String, value: float, condition: String, condition_param: float}
var hidden_effects: Array[Dictionary] = []

## 是否已发现隐藏效果(首次触发后标记)
var hidden_effect_discovered: bool = false

## ==================== 方法 ====================

func _init() -> void:
	card_type = CardType.CURSE
	is_cursed = true  # 诅咒卡默认标记为诅咒状态

## 重写执行方法 - 诅咒卡专用逻辑
## 先执行负面效果，再检查是否触发隐藏正面效果
## @param user: 使用者
## @param target: 目标
func execute(user, target) -> void:
	# 诅咒卡不消耗费用(强制触发)
	# 第一步：应用负面效果
	_apply_curse_effects(user, target)

	# 第二步：检查隐藏正面效果的触发条件
	_check_hidden_effects(user, target)

## 应用诅咒卡的负面效果
## @param user: 使用者
## @param target: 目标
func _apply_curse_effects(user, target) -> void:
	for effect: Dictionary in effects:
		var effect_type: String = effect.get("type", "")
		var value: float = effect.get("value", 0.0)
		var effect_target_str: String = effect.get("target", "self")
		var actual_target = _resolve_target(effect_target_str, user, target)

		# 负面效果通常以减益形式出现
		match effect_type:
			"damage_self":
				# 对自己造成伤害
				if user.has_method("take_damage"):
					user.take_damage(abs(value))
					print("诅咒卡 [%s] 对使用者造成 %.1f 点伤害" % [card_name, abs(value)])

			"reduce_stat":
				# 降低属性值
				var stat_name: String = effect.get("stat", "")
				if not stat_name.is_empty() and user.has_method("modify_stat"):
					user.modify_stat(stat_name, -abs(value))
					print("诅咒卡 [%s] 降低 %s %.1f" % [card_name, stat_name, abs(value)])

			"lose_energy":
				# 失去能量
				if user.has_method("modify_stat"):
					user.modify_stat("energy", -abs(value))
					print("诅咒卡 [%s] 失去 %.1f 能量" % [card_name, abs(value)])

			"add_weakness":
				# 施加虚弱状态
				if actual_target != null and actual_target.has_method("add_status_effect"):
					var debuff: Dictionary = {
						"type": "weakness",
						"value": value,
						"duration": int(effect.get("duration", 2)),
						"remaining_turns": int(effect.get("duration", 2)),
						"source_card": card_name
					}
					actual_target.add_status_effect(debuff)

			_:
				push_warning("诅咒卡 [%s] 未识别的负面效果类型: %s" % [card_name, effect_type])

## 检查并触发隐藏正面效果
## @param user: 使用者
## @param target: 目标
func _check_hidden_effects(user, target) -> void:
	if hidden_effects.is_empty():
		return

	for hidden_effect: Dictionary in hidden_effects:
		if _evaluate_condition(hidden_effect, user, target):
			_trigger_hidden_effect(hidden_effect, user, target)

## 评估隐藏效果的触发条件
## @param effect: 隐藏效果字典
## @param user: 使用者
## @param target: 目标
## @return: 条件是否满足
func _evaluate_condition(effect: Dictionary, user, target) -> bool:
	var condition: String = effect.get("condition", "")
	var param: float = effect.get("condition_param", 0.0)

	match condition:
		"low_hp":
			# 生命值低于指定百分比时触发
			if user.has_method("get_stat"):
				var current_hp: float = user.get_stat("hp")
				var max_hp: float = user.get_stat("max_hp")
				if max_hp > 0:
					return (current_hp / max_hp) <= param
			return false

		"turn_count":
			# 持有指定回合数后触发
			return ticks_active >= int(param)

		"card_count":
			# 手牌数量满足条件时触发
			if user.has_method("get_hand_count"):
				return user.get_hand_count() <= int(param)
			return false

		"enemy_count":
			# 剩余敌人数量满足条件时触发
			var scene_tree: SceneTree = Engine.get_main_loop() as SceneTree
			if scene_tree:
				var enemies: Array[Node] = scene_tree.get_nodes_in_group("enemies")
				return enemies.size() >= int(param)
			return false

		"always":
			# 无条件触发(但只触发一次)
			return not hidden_effect_discovered

		_:
			return false

## 触发隐藏正面效果
## @param effect: 隐藏效果字典
## @param user: 使用者
## @param target: 目标
func _trigger_hidden_effect(effect: Dictionary, user, target) -> void:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)

	hidden_effect_discovered = true

	match effect_type:
		"heal":
			# 回复生命值
			if user.has_method("heal"):
				user.heal(value)
				print("诅咒卡 [%s] 触发隐藏效果: 回复 %.1f 生命值!" % [card_name, value])

		"buff_stat":
			# 提升属性值
			var stat_name: String = effect.get("stat", "")
			if not stat_name.is_empty() and user.has_method("modify_stat"):
				user.modify_stat(stat_name, value)
				print("诅咒卡 [%s] 触发隐藏效果: %s +%.1f!" % [card_name, stat_name, value])

		"extra_damage":
			# 对目标造成额外伤害
			if target != null and target.has_method("take_damage"):
				target.take_damage(value)
				print("诅咒卡 [%s] 触发隐藏效果: 对目标造成 %.1f 点伤害!" % [card_name, value])

		"cleanse":
			# 移除自身所有诅咒卡
			if user.has_method("remove_cursed_cards"):
				user.remove_cursed_cards()
				print("诅咒卡 [%s] 触发隐藏效果: 清除所有诅咒!" % card_name)

		"double_next":
			# 下一张卡效果翻倍
			if user.has_method("add_status_effect"):
				var buff: Dictionary = {
					"type": "double_effect",
					"value": 2.0,
					"duration": 1,
					"remaining_turns": 1,
					"source_card": card_name
				}
				user.add_status_effect(buff)
				print("诅咒卡 [%s] 触发隐藏效果: 下一张卡效果翻倍!" % card_name)

		_:
			push_warning("诅咒卡 [%s] 未识别的隐藏效果类型: %s" % [card_name, effect_type])

	# 发出隐藏效果触发信号
	hidden_effect_triggered.emit(self, effect)

## 重写: 诅咒卡不能被正常丢弃
## @return: 是否允许丢弃
func can_discard() -> bool:
	return false

## 尝试强制丢弃(需要特殊条件)
## @param user: 使用者
## @param force_method: 强制丢弃的方式("cleanse"|"sacrifice"|"event")
## @return: 是否成功丢弃
func try_force_discard(user, force_method: String = "cleanse") -> bool:
	match force_method:
		"cleanse":
			# 净化可以移除诅咒
			print("诅咒卡 [%s] 被净化移除" % card_name)
			return true
		"sacrifice":
			# 献祭足够的属性可以移除
			print("诅咒卡 [%s] 被献祭移除" % card_name)
			return true
		"event":
			# 特殊事件移除
			print("诅咒卡 [%s] 被事件移除" % card_name)
			return true
		_:
			push_warning("诅咒卡 [%s] 不支持的强制丢弃方式: %s" % [card_name, force_method])
			return false

## 重写工具提示 - 诅咒卡有独特的显示格式
## @return: 格式化的工具提示文本
func get_tooltip() -> String:
	var tooltip: String = ""

	# 诅咒卡用特殊标记
	tooltip += "☠【%s】(诅咒)\n" % card_name
	tooltip += "稀有度: %s\n" % _get_rarity_name()

	# 不显示费用(诅咒卡强制触发)
	tooltip += "————————————\n"

	# 诅咒效果描述
	tooltip += "⚠ 诅咒效果:\n"
	tooltip += "%s\n" % description

	# 效果详情
	if not effects.is_empty():
		tooltip += "————————————\n"
		for effect: Dictionary in effects:
			tooltip += "· %s\n" % _format_effect(effect)

	# 隐藏效果提示(已发现则显示详情)
	tooltip += "————————————\n"
	if hidden_effect_discovered:
		tooltip += "✦ 已发现隐藏效果:\n"
		for hidden: Dictionary in hidden_effects:
			tooltip += "· %s\n" % _format_hidden_effect(hidden)
	else:
		tooltip += "✦ 存在未知的隐藏效果...\n"

	tooltip += "⚠ 无法正常丢弃\n"

	return tooltip

## 格式化隐藏效果描述
## @param effect: 隐藏效果字典
## @return: 格式化的描述字符串
func _format_hidden_effect(effect: Dictionary) -> String:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)
	var condition: String = effect.get("condition", "")
	var param: float = effect.get("condition_param", 0.0)

	var condition_text: String = ""
	match condition:
		"low_hp":
			condition_text = "生命值低于 %.0f%%" % (param * 100.0)
		"turn_count":
			condition_text = "持有 %d 回合后" % int(param)
		"card_count":
			condition_text = "手牌 ≤ %d 张时" % int(param)
		"enemy_count":
			condition_text = "敌人 ≥ %d 个时" % int(param)
		"always":
			condition_text = "无条件"

	var effect_text: String = ""
	match effect_type:
		"heal":
			effect_text = "回复 %.1f 生命" % value
		"buff_stat":
			effect_text = "%s +%.1f" % [effect.get("stat", "???"), value]
		"extra_damage":
			effect_text = "造成 %.1f 伤害" % value
		"cleanse":
			effect_text = "清除所有诅咒"
		"double_next":
			effect_text = "下一张卡效果翻倍"
		_:
			effect_text = "%s: %.1f" % [effect_type, value]

	return "当%s时: %s" % [condition_text, effect_text]
