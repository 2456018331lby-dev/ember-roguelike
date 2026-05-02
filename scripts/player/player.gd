# ============================================================
# player.gd - 基础玩家脚本
# 管理玩家属性、卡组系统、生命值、输入处理
# ============================================================
class_name Player
extends CharacterBody2D

## 信号：生命值变化
signal health_changed(current_hp: float, max_hp: float)
## 信号：卡牌打出
signal card_played(card: Resource, index: int)
## 信号：卡牌抽取
signal card_drawn(card: Resource, index: int)
## 信号：玩家死亡
signal died()

## 基础属性
@export var base_hp: float = 100.0
@export var base_speed: float = 200.0
@export var base_attack_power: float = 10.0

## 当前属性
var max_hp: float = 100.0
var hp: float = 100.0
var speed: float = 200.0
var attack_power: float = 10.0
var is_dead: bool = false
var is_invincible: bool = false
var invincible_timer: float = 0.0

## 卡组系统
var draw_pile: Array = []      # 抽牌堆
var hand: Array = []           # 手牌
var discard_pile: Array = []   # 弃牌堆
@export var max_hand_size: int = 7
@export var draw_per_turn: int = 5

## 触摸摇杆相关
var joystick_input: Vector2 = Vector2.ZERO
var is_using_joystick: bool = false

## 动画
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var anim_player: AnimationPlayer = $AnimationPlayer if has_node("AnimationPlayer") else null
@onready var hitbox: Area2D = $Hitbox if has_node("Hitbox") else null


func _ready() -> void:
	_init_stats()
	print("[玩家] 初始化完成 HP:%.0f SPD:%.0f ATK:%.0f" % [hp, speed, attack_power])


func _physics_process(delta: float) -> void:
	if is_dead:
		return

	# 处理无敌帧
	if is_invincible:
		invincible_timer -= delta
		if invincible_timer <= 0.0:
			is_invincible = false

	# 处理移动
	_handle_movement(delta)

	# 移动并处理碰撞
	move_and_slide()


## 处理移动输入
func _handle_movement(_delta: float) -> void:
	var input_dir: Vector2 = Vector2.ZERO

	# 优先使用触摸摇杆
	if is_using_joystick and joystick_input.length() > 0.1:
		input_dir = joystick_input.normalized()
	else:
		# 键盘输入（开发测试用）
		input_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	velocity = input_dir * speed

	# 翻转朝向
	if input_dir.x != 0 and sprite:
		sprite.flip_h = input_dir.x < 0


## 初始化属性
func _init_stats() -> void:
	max_hp = base_hp
	hp = max_hp
	speed = base_speed
	attack_power = base_attack_power


## 设置触摸摇杆输入（由UI层调用）
func set_joystick_input(input: Vector2) -> void:
	joystick_input = input
	is_using_joystick = input.length() > 0.05


## 受到伤害
func take_damage(amount: float) -> void:
	if is_dead or is_invincible:
		return

	var final_damage: float = maxi(1.0, amount)
	hp -= final_damage
	hp = maxf(hp, 0.0)

	health_changed.emit(hp, max_hp)
	print("[玩家] 受到 %.1f 伤害，剩余 HP: %.1f/%.1f" % [final_damage, hp, max_hp])

	# 激活无敌帧
	_set_invincible(0.5)

	# 播放受击动画
	if anim_player and anim_player.has_animation("hit"):
		anim_player.play("hit")

	# 检查死亡
	if hp <= 0.0:
		die()


## 治疗
func heal(amount: float) -> void:
	if is_dead:
		return

	hp = minf(hp + amount, max_hp)
	health_changed.emit(hp, max_hp)
	print("[玩家] 恢复 %.1f HP，当前: %.1f/%.1f" % [amount, hp, max_hp])


## 设置无敌时间
func _set_invincible(duration: float) -> void:
	is_invincible = true
	invincible_timer = duration


## 死亡处理
func die() -> void:
	if is_dead:
		return

	is_dead = true
	velocity = Vector2.ZERO

	if anim_player and anim_player.has_animation("death"):
		anim_player.play("death")

	died.emit()
	print("[玩家] 玩家死亡！")


## ============================================================
## 卡组系统
## ============================================================

## 初始化卡组
func init_deck(cards: Array) -> void:
	draw_pile.clear()
	hand.clear()
	discard_pile.clear()

	draw_pile.append_array(cards)
	draw_pile.shuffle()

	print("[玩家] 卡组初始化，共 %d 张卡牌" % draw_pile.size())


## 抽取卡牌
func draw_cards(count: int) -> void:
	for _i in range(count):
		if hand.size() >= max_hand_size:
			print("[玩家] 手牌已满（%d/%d）" % [hand.size(), max_hand_size])
			break

		# 如果抽牌堆空了，把弃牌堆洗入
		if draw_pile.is_empty():
			if discard_pile.is_empty():
				print("[玩家] 没有可抽的卡牌了")
				break
			_shuffle_discard_into_draw()

		var card: Resource = draw_pile.pop_front()
		hand.append(card)
		card_drawn.emit(card, hand.size() - 1)


## 将弃牌堆洗入抽牌堆
func _shuffle_discard_into_draw() -> void:
	draw_pile.append_array(discard_pile)
	discard_pile.clear()
	draw_pile.shuffle()
	print("[玩家] 弃牌堆洗入抽牌堆（%d 张）" % draw_pile.size())


## 打出卡牌
func play_card(index: int) -> void:
	if index < 0 or index >= hand.size():
		push_warning("[玩家] 无效的卡牌索引: " + str(index))
		return

	var card: Resource = hand[index]
	hand.remove_at(index)
	discard_pile.append(card)

	card_played.emit(card, index)
	print("[玩家] 打出卡牌: ", _get_card_name(card))


## 弃掉卡牌
func discard_card(index: int) -> void:
	if index < 0 or index >= hand.size():
		return

	var card: Resource = hand[index]
	hand.remove_at(index)
	discard_pile.append(card)


## 获取卡牌名称
func _get_card_name(card: Resource) -> String:
	if "card_name" in card:
		return card.card_name
	elif "name" in card:
		return card.name
	return "未知卡牌"


## 获取当前状态
func get_status() -> Dictionary:
	return {
		"hp": hp,
		"max_hp": max_hp,
		"speed": speed,
		"attack_power": attack_power,
		"hand_size": hand.size(),
		"draw_pile_size": draw_pile.size(),
		"discard_pile_size": discard_pile.size(),
		"is_dead": is_dead,
	}
