## 音频管理器（全局单例）
## 管理背景音乐和音效
extends Node

## BGM 播放器
var _bgm_player: AudioStreamPlayer = AudioStreamPlayer.new()
## SFX 播放器池
var _sfx_players: Array[AudioStreamPlayer] = []
const MAX_SFX_PLAYERS: int = 8

## 音量设置
var bgm_volume: float = 0.8
var sfx_volume: float = 1.0
var master_volume: float = 1.0

var _settings_path: String = "user://audio_settings.json"

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	
	# 初始化 BGM 播放器
	_bgm_player.bus = "Music"
	_bgm_player.name = "BGMPlayer"
	add_child(_bgm_player)
	
	# 初始化 SFX 播放器池
	for i in MAX_SFX_PLAYERS:
		var player = AudioStreamPlayer.new()
		player.bus = "SFX"
		player.name = "SFXPlayer_%d" % i
		add_child(player)
		_sfx_players.append(player)
	
	_load_settings()

## 播放背景音乐
func play_bgm(path: String, fade_time: float = 0.5) -> void:
	if _bgm_player.stream and _bgm_player.playing:
		# 淡出当前 BGM
		var tween = create_tween()
		tween.tween_property(_bgm_player, "volume_db", -40.0, fade_time)
		await tween.finished
	
	if ResourceLoader.exists(path):
		_bgm_player.stream = load(path)
		_bgm_player.volume_db = linear_to_db(bgm_volume * master_volume)
		_bgm_player.play()
	else:
		push_warning("[AudioManager] BGM 文件不存在: " + path)

## 停止背景音乐
func stop_bgm(fade_time: float = 0.5) -> void:
	if _bgm_player.playing:
		var tween = create_tween()
		tween.tween_property(_bgm_player, "volume_db", -40.0, fade_time)
		await tween.finished
		_bgm_player.stop()

## 播放音效
func play_sfx(path: String, volume_offset: float = 0.0) -> void:
	if not ResourceLoader.exists(path):
		push_warning("[AudioManager] SFX 文件不存在: " + path)
		return
	
	# 找一个空闲的播放器
	for player in _sfx_players:
		if not player.playing:
			player.stream = load(path)
			player.volume_db = linear_to_db(sfx_volume * master_volume) + volume_offset
			player.play()
			return
	
	# 所有播放器都在忙，强制复用第一个
	_sfx_players[0].stream = load(path)
	_sfx_players[0].volume_db = linear_to_db(sfx_volume * master_volume) + volume_offset
	_sfx_players[0].play()

## 设置音量
func set_volume(bus_name: String, linear: float) -> void:
	match bus_name:
		"Music", "BGM":
			bgm_volume = clampf(linear, 0.0, 1.0)
			_bgm_player.volume_db = linear_to_db(bgm_volume * master_volume)
		"SFX":
			sfx_volume = clampf(linear, 0.0, 1.0)
		"Master":
			master_volume = clampf(linear, 0.0, 1.0)
	_save_settings()

## 淡出 BGM
func fade_out_bgm(duration: float = 1.0) -> void:
	if _bgm_player.playing:
		var tween = create_tween()
		tween.tween_property(_bgm_player, "volume_db", -40.0, duration)
		await tween.finished
		_bgm_player.stop()

## 保存音频设置
func _save_settings() -> void:
	var data = {
		"bgm_volume": bgm_volume,
		"sfx_volume": sfx_volume,
		"master_volume": master_volume,
	}
	var file = FileAccess.open(_settings_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

## 加载音频设置
func _load_settings() -> void:
	if not FileAccess.file_exists(_settings_path):
		return
	var file = FileAccess.open(_settings_path, FileAccess.READ)
	if not file:
		return
	var json = JSON.new()
	if json.parse(file.get_as_text()) == OK and json.data is Dictionary:
		bgm_volume = json.data.get("bgm_volume", 0.8)
		sfx_volume = json.data.get("sfx_volume", 1.0)
		master_volume = json.data.get("master_volume", 1.0)
	file.close()
