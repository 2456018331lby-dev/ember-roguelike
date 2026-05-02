## HUD 场景脚本 - 战斗界面
extends CanvasLayer

@onready var hp_bar: ProgressBar = %HPBar
@onready var hp_label: Label = %HPLabel
@onready var wave_label: Label = %WaveLabel
@onready var card_container: HBoxContainer = %CardContainer
@onready var joker_container: HBoxContainer = %JokerContainer
@onready var timer_label: Label = %TimerLabel
@onready var ember_label: Label = %EmberLabel
@onready var btn_pause: Button = %BtnPause

var player_ref: Node = null

func _ready() -> void:
	btn_pause.pressed.connect(_on_pause_pressed)

## 绑定玩家
func bind_player(player: Node) -> void:
	player_ref = player
	player.health_changed.connect(_on_health_changed)
	_update_hp(player.current_hp, player.max_hp)

## 更新血量显示
func _on_health_changed(current: int, maximum: int) -> void:
	_update_hp(current, maximum)

func _update_hp(current: int, maximum: int) -> void:
	if hp_bar:
		hp_bar.max_value = maximum
		hp_bar.value = current
	if hp_label:
		hp_label.text = "%d / %d" % [current, maximum]

## 更新波次显示
func set_wave(wave_num: int, total: int = 20) -> void:
	if wave_label:
		wave_label.text = "第 %d / %d 波" % [wave_num, total]

## 更新计时器
func set_timer(seconds: float) -> void:
	if timer_label:
		var mins = int(seconds) / 60
		var secs = int(seconds) % 60
		timer_label.text = "%02d:%02d" % [mins, secs]

## 更新手牌显示（简单版本 - 文字显示）
func update_hand(hand: Array) -> void:
	# 清除旧卡牌
	for child in card_container.get_children():
		child.queue_free()
	# 显示新手牌
	for i in hand.size():
		var card = hand[i]
		var btn = Button.new()
		btn.text = card.get("name", "?")
		btn.custom_minimum_size = Vector2(80, 100)
		btn.pressed.connect(_on_card_played.bind(i))
		card_container.add_child(btn)

## 更新小丑牌显示
func update_jokers(jokers: Array) -> void:
	for child in joker_container.get_children():
		child.queue_free()
	for joker in jokers:
		var btn = Button.new()
		btn.text = joker.get("name", "?")
		btn.custom_minimum_size = Vector2(60, 60)
		btn.disabled = true
		joker_container.add_child(btn)

## 卡牌打出回调
func _on_card_played(index: int) -> void:
	if player_ref and player_ref.has_method("play_card"):
		player_ref.play_card(index)

## 暂停
func _on_pause_pressed() -> void:
	GameManager.pause_game()

## 显示伤害数字
func show_damage_number(pos: Vector2, amount: int, color: Color = Color.WHITE) -> void:
	var label = Label.new()
	label.text = str(amount)
	label.position = pos
	label.add_theme_font_size_override("font_size", 24)
	label.modulate = color
	add_child(label)
	# 浮动动画
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", pos.y - 50, 0.8)
	tween.tween_property(label, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tween.chain().tween_callback(label.queue_free)
