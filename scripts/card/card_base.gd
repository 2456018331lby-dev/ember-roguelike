## card_base.gd
## 卡牌基础类 - 所有卡牌类型的基类
## 定义卡牌通用属性、效果系统和执行逻辑
class_name CardBase
extends Resource

## ==================== 枚举定义 ====================

## 卡牌类型枚举
enum CardType {
	ATTACK,   ## 攻击卡
	DEFENSE,  ## 防御卡
	PASSIVE,  ## 被动卡
	CURSE,    ## 诅咒卡
	JOKER,    ## 小丑卡(万能卡)
	FUSION    ## 融合卡
}

## 卡牌稀有度枚举
enum Rarity {
	WHITE,  ## 白色 - 普通
	GREEN,  ## 绿色 - 优秀
	BLUE,   ## 蓝色 - 稀有
	PURPLE, ## 紫色 - 史诗
	GOLD    ## 金色 - 传说
}

## ==================== 导出变量(可在编辑器中配置) ====================

## 卡牌唯一标识符
@export var id: String = ""

## 卡牌显示名称
@export var card_name: String = ""

## 卡牌类型
@export var card_type: CardType = CardType.ATTACK

## 卡牌稀有度
@export var rarity: Rarity = Rarity.WHITE

## 卡牌费用(法力值消耗)
@export var cost: int = 1

## 卡牌描述文本
@export var description: String = ""

## 卡牌图标
@export var icon: Texture2D

## ==================== 普通变量 ====================

## 效果列表 - 每个字典包含: {type: String, value: float, target: String}
## target: "self"=自己, "enemy"=敌人, "all_enemies"=所有敌人, "all_allies"=所有队友
var effects: Array[Dictionary] = []

## 献祭消耗 - 使用卡牌时需要献祭的属性 {stat: String, amount: float}
## stat: "hp"=生命值, "shield"=护盾, "energy"=能量 等
var sacrifice_cost: Dictionary = {}

## 是否为诅咒状态(诅咒卡无法正常丢弃)
var is_cursed: bool = false

## ==================== 核心方法 ====================

## 执行卡牌效果
## @param user: 使用者(拥有此卡牌的角色)
## @param target: 目标(被施加效果的对象)
func execute(user, target) -> void:
	if effects.is_empty():
		push_warning("卡牌 [%s] 没有配置任何效果" % card_name)
		return

	# 检查并扣除献祭消耗
	if not sacrifice_cost.is_empty():
		if not _pay_sacrifice_cost(user):
			return

	# 遍历所有效果并应用
	for effect: Dictionary in effects:
		_apply_effect(effect, user, target)

## 获取卡牌工具提示文本(用于UI显示)
## @return: 格式化的描述字符串
func get_tooltip() -> String:
	var tooltip: String = ""

	# 卡牌名称和类型
	tooltip += "【%s】" % card_name
	tooltip += " (%s)\n" % _get_type_name()

	# 稀有度标识
	tooltip += "稀有度: %s\n" % _get_rarity_name()

	# 费用
	tooltip += "费用: %d\n" % cost

	# 分隔线
	tooltip += "————————————\n"

	# 效果描述
	tooltip += "%s\n" % description

	# 效果详情
	if not effects.is_empty():
		tooltip += "————————————\n"
		for effect: Dictionary in effects:
			tooltip += "· %s\n" % _format_effect(effect)

	# 献祭消耗
	if not sacrifice_cost.is_empty():
		tooltip += "————————————\n"
		tooltip += "献祭: %s -%.1f\n" % [
			sacrifice_cost.get("stat", "???"),
			sacrifice_cost.get("amount", 0.0)
		]

	# 诅咒标记
	if is_cursed:
		tooltip += "⚠ 此卡为诅咒卡，无法正常丢弃\n"

	return tooltip

## ==================== 内部方法 ====================

## 应用单个效果
## @param effect: 效果字典 {type, value, target}
## @param user: 使用者
## @param target: 目标
func _apply_effect(effect: Dictionary, user, target) -> void:
	var effect_type: String = effect.get("type", "")
	var value: float = effect.get("value", 0.0)
	var effect_target: String = effect.get("target", "enemy")

	# 根据目标类型选择实际目标对象
	var actual_target = _resolve_target(effect_target, user, target)

	# 子类应重写此方法来处理具体效果类型
	# 基类只做日志记录
	match effect_type:
		_:
			push_warning("卡牌 [%s] 未处理的效果类型: %s" % [card_name, effect_type])

## 解析目标对象
## @param target_str: 目标字符串标识
## @param user: 使用者
## @param target: 默认目标
## @return: 实际目标节点
func _resolve_target(target_str: String, user, target):
	match target_str:
		"self":
			return user
		"enemy", "target":
			return target
		"all_enemies":
			# 返回所有敌人(需要游戏管理器配合)
			return target
		"all_allies":
			return user
		_:
			return target

## 支付献祭消耗
## @param user: 使用者
## @return: 是否支付成功
func _pay_sacrifice_cost(user) -> bool:
	var stat: String = sacrifice_cost.get("stat", "")
	var amount: float = sacrifice_cost.get("amount", 0.0)

	if stat.is_empty() or amount <= 0:
		return true

	# 检查使用者是否有足够的属性值
	if user.has_method("get_stat"):
		var current_value: float = user.get_stat(stat)
		if current_value < amount:
			push_warning("献祭失败: %s 不足 (需要 %.1f, 当前 %.1f)" % [stat, amount, current_value])
			return false

		# 扣除消耗
		if user.has_method("modify_stat"):
			user.modify_stat(stat, -amount)
			return true

	# 没有对应方法时默认允许
	return true

## 获取卡牌类型的中文名称
## @return: 类型名称字符串
func _get_type_name() -> String:
	match card_type:
		CardType.ATTACK:
			return "攻击"
		CardType.DEFENSE:
			return "防御"
		CardType.PASSIVE:
			return "被动"
		CardType.CURSE:
			return "诅咒"
		CardType.JOKER:
			return "小丑"
		CardType.FUSION:
			return "融合"
		_:
			return "未知"

## 获取稀有度的中文名称
## @return: 稀有度名称字符串
func _get_rarity_name() -> String:
	match rarity:
		Rarity.WHITE:
			return "普通"
		Rarity.GREEN:
			return "优秀"
		Rarity.BLUE:
			return "稀有"
		Rarity.PURPLE:
			return "史诗"
		Rarity.GOLD:
			return "传说"
		_:
			return "未知"

## 格式化效果描述(子类可重写)
## @param effect: 效果字典
## @return: 格式化的效果描述
func _format_effect(effect: Dictionary) -> String:
	return "%s: %.1f (目标: %s)" % [
		effect.get("type", "???"),
		effect.get("value", 0.0),
		effect.get("target", "enemy")
	]
