## 主菜单场景脚本
extends Control

@onready var btn_sacrifice: Button = %BtnSacrifice
@onready var btn_parasite: Button = %BtnParasite
@onready var btn_settings: Button = %BtnSettings
@onready var btn_quit: Button = %BtnQuit
@onready var lbl_ember: Label = %LblEmber
@onready var lbl_stats: Label = %LblStats
@onready var title_label: Label = %TitleLabel
@onready var settings_panel: Panel = %SettingsPanel

func _ready() -> void:
	# 连接按钮信号
	btn_sacrifice.pressed.connect(_on_sacrifice_pressed)
	btn_parasite.pressed.connect(_on_parasite_pressed)
	btn_settings.pressed.connect(_on_settings_pressed)
	btn_quit.pressed.connect(_on_quit_pressed)
	
	# 连接 MetaProgress 信号
	MetaProgress.ember_changed.connect(_update_ember_display)
	
	# 更新显示
	_update_ember_display(MetaProgress.ember_currency, 0)
	_update_stats()
	
	# 隐藏设置面板
	if settings_panel:
		settings_panel.visible = false
	
	# 标题动画
	if title_label:
		title_label.modulate.a = 0.0
		var tween = create_tween()
		tween.tween_property(title_label, "modulate:a", 1.0, 1.0)

func _on_sacrifice_pressed() -> void:
	GameManager.start_run(GameManager.GameMode.SACRIFICE)
	get_tree().change_scene_to_file("res://scenes/sacrifice/arena.tscn")

func _on_parasite_pressed() -> void:
	GameManager.start_run(GameManager.GameMode.PARASITE)
	get_tree().change_scene_to_file("res://scenes/parasite/dungeon.tscn")

func _on_settings_pressed() -> void:
	if settings_panel:
		settings_panel.visible = !settings_panel.visible

func _on_quit_pressed() -> void:
	get_tree().quit()

func _update_ember_display(new_amount: int, _delta: int) -> void:
	if lbl_ember:
		lbl_ember.text = "余烬: %d" % new_amount

func _update_stats() -> void:
	if lbl_stats:
		var win_rate = 0.0
		if MetaProgress.total_runs > 0:
			win_rate = float(MetaProgress.total_wins) / float(MetaProgress.total_runs) * 100.0
		lbl_stats.text = "总运行: %d | 胜利: %d | 胜率: %.0f%%" % [
			MetaProgress.total_runs, MetaProgress.total_wins, win_rate
		]
