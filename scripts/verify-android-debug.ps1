param(
  [string]$ApkPath = '',
  [string]$PackageName = '',
  [string]$ActivityName = '.MainActivity',
  [string]$DeviceSerial = '',
  [string]$AvdName = '',
  [int]$BootTimeoutSeconds = 180,
  [int]$LaunchWaitSeconds = 8,
  [switch]$AllowMissingDevice,
  [switch]$AutoStartSingleAvd,
  [switch]$SkipInstall,
  [switch]$SkipLogcat,
  [switch]$SmokeTapFlow,
  [switch]$ShutdownStartedEmulator
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  return Resolve-Path (Join-Path $PSScriptRoot '..')
}

function Read-AndroidSdkFromLocalProperties {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $localPropertiesPath = Join-Path $RepoRoot 'android\local.properties'
  if (!(Test-Path $localPropertiesPath)) {
    return $null
  }

  $line = Get-Content $localPropertiesPath | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
  if (!$line) {
    return $null
  }

  $rawValue = $line.Substring('sdk.dir='.Length).Trim()
  $rawValue = $rawValue -replace '\\\\', '\'
  if ($rawValue -and (Test-Path $rawValue)) {
    return (Resolve-Path $rawValue).Path
  }

  return $null
}

function Resolve-AndroidSdkRoots {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $roots = @()
  $localSdk = Read-AndroidSdkFromLocalProperties -RepoRoot $RepoRoot
  if ($localSdk) {
    $roots += $localSdk
  }
  if ($env:ANDROID_HOME) {
    $roots += $env:ANDROID_HOME
  }
  if ($env:ANDROID_SDK_ROOT) {
    $roots += $env:ANDROID_SDK_ROOT
  }
  if ($env:LOCALAPPDATA) {
    $roots += (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
  }

  return $roots | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

function Resolve-AdbPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $command = Get-Command adb -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  foreach ($sdkRoot in Resolve-AndroidSdkRoots -RepoRoot $RepoRoot) {
    $candidate = Join-Path $sdkRoot 'platform-tools\adb.exe'
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "adb was not found. Add Android SDK platform-tools to PATH, set ANDROID_HOME/ANDROID_SDK_ROOT, or ensure android\local.properties points to an SDK with platform-tools."
}

function Resolve-EmulatorPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $command = Get-Command emulator -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  foreach ($sdkRoot in Resolve-AndroidSdkRoots -RepoRoot $RepoRoot) {
    $candidate = Join-Path $sdkRoot 'emulator\emulator.exe'
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "emulator.exe was not found. Install Android Emulator or pass an already running device instead of -AvdName."
}

function Read-CapacitorPackageName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $configPath = Join-Path $RepoRoot 'capacitor.config.json'
  if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    if ($config.appId) {
      return [string]$config.appId
    }
  }

  $gradlePath = Join-Path $RepoRoot 'android\app\build.gradle'
  if (Test-Path $gradlePath) {
    $gradleText = Get-Content $gradlePath -Raw
    if ($gradleText -match 'applicationId\s+"([^"]+)"') {
      return $Matches[1]
    }
  }

  throw "Could not resolve Android package name from capacitor.config.json or android\app\build.gradle."
}

function Invoke-Adb {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string[]]$AdbArgs,
    [switch]$IgnoreExitCode
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $AdbPath @AdbArgs 2>&1 | ForEach-Object { "$_" }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0 -and !$IgnoreExitCode) {
    $joinedArgs = $AdbArgs -join ' '
    $joinedOutput = ($output | Out-String).Trim()
    throw "adb $joinedArgs failed with exit code $exitCode. $joinedOutput"
  }

  return @($output)
}

function Invoke-DeviceAdb {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [string[]]$AdbArgs,
    [switch]$IgnoreExitCode
  )

  $argsWithSerial = @('-s', $Serial) + $AdbArgs
  return Invoke-Adb -AdbPath $AdbPath -AdbArgs $argsWithSerial -IgnoreExitCode:$IgnoreExitCode
}

function Get-OnlineDevices {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath
  )

  $deviceLines = Invoke-Adb -AdbPath $AdbPath -AdbArgs @('devices', '-l')
  $devices = @()
  foreach ($line in $deviceLines) {
    if ($line -match '^(\S+)\s+device\b') {
      $devices += [PSCustomObject]@{
        Serial = $Matches[1]
        Raw = $line
      }
    }
  }

  return @($devices)
}

function Resolve-TargetDevice {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [string]$RequestedSerial = ''
  )

  $devices = @(Get-OnlineDevices -AdbPath $AdbPath)
  if ($RequestedSerial) {
    $match = $devices | Where-Object { $_.Serial -eq $RequestedSerial } | Select-Object -First 1
    if (!$match) {
      throw "Requested Android device '$RequestedSerial' is not online. Run adb devices -l to inspect device state."
    }
    return $match
  }

  if ($devices.Count -eq 0) {
    return $null
  }

  return $devices[0]
}

function Wait-ForBootCompleted {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $boot = Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'getprop', 'sys.boot_completed') -IgnoreExitCode
    $bootText = (($boot | Out-String).Trim())
    if ($bootText -eq '1') {
      return
    }
    Start-Sleep -Seconds 3
  }

  throw "Android device '$Serial' did not finish booting within $TimeoutSeconds seconds."
}

function Get-AvailableAvds {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $emulatorPath = Resolve-EmulatorPath -RepoRoot $RepoRoot
  $lines = & $emulatorPath -list-avds
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list Android AVDs with $emulatorPath"
  }

  return @($lines | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Start-AvdIfNeeded {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$RequestedAvdName,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSeconds
  )

  $existingDevice = Resolve-TargetDevice -AdbPath $AdbPath -RequestedSerial $DeviceSerial
  if ($existingDevice) {
    return [PSCustomObject]@{
      Device = $existingDevice
      Process = $null
      Started = $false
    }
  }

  $emulatorPath = Resolve-EmulatorPath -RepoRoot $RepoRoot
  Write-Host "Starting Android emulator AVD '$RequestedAvdName'..."
  $process = Start-Process -FilePath $emulatorPath -ArgumentList @(
    '-avd', $RequestedAvdName,
    '-no-window',
    '-no-audio',
    '-no-boot-anim',
    '-gpu', 'swiftshader_indirect'
  ) -WindowStyle Hidden -PassThru

  try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $device = $null
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 3
      $device = Resolve-TargetDevice -AdbPath $AdbPath -RequestedSerial $DeviceSerial
      if ($device) {
        break
      }
      if ($process.HasExited) {
        throw "Android emulator '$RequestedAvdName' exited before exposing an adb device."
      }
    }

    if (!$device) {
      throw "Android emulator '$RequestedAvdName' did not expose an adb device within $TimeoutSeconds seconds."
    }

    Wait-ForBootCompleted -AdbPath $AdbPath -Serial $device.Serial -TimeoutSeconds $TimeoutSeconds
    # Some emulator images report boot complete before system services settle.
    Start-Sleep -Seconds 8
    Invoke-DeviceAdb -AdbPath $AdbPath -Serial $device.Serial -AdbArgs @('shell', 'input', 'keyevent', '82') -IgnoreExitCode | Out-Null

    return [PSCustomObject]@{
      Device = $device
      Process = $process
      Started = $true
    }
  } catch {
    if ($process -and !$process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    throw
  }
}

function Test-LogcatForFatalErrors {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$LogLines,
    [Parameter(Mandatory = $true)]
    [string]$PackageName
  )

  $badLines = @()
  $escapedPackageName = [regex]::Escape($PackageName)
  $logText = [string]::Join("`n", $LogLines)
  if ($logText -match "(?s)FATAL EXCEPTION.*?Process:\s+$escapedPackageName\b.*?(?=`n\S|$)") {
    $badLines += ($Matches[0] -split "`n" | Select-Object -First 20) -join "`n"
  }

  foreach ($line in $LogLines) {
    $isPackageRelated = $line.Contains($PackageName) -or $line -match 'Capacitor|CONSOLE'
    if (!$isPackageRelated) {
      continue
    }

    if (
      $line -match "ANR in $([regex]::Escape($PackageName))" -or
      $line -match 'CONSOLE.*(TypeError|ReferenceError|SyntaxError|Failed to load resource|net::ERR_)' -or
      $line -match 'chromium.*(Uncaught|TypeError|ReferenceError|SyntaxError|net::ERR_|ERR_FILE_NOT_FOUND)' -or
      $line -match 'Capacitor.*(Unable to load|Bridge.*failed|RuntimeException)'
    ) {
      $badLines += $line
    }
  }

  return @($badLines)
}

function Get-AndroidFocusSummary {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial
  )

  $windowLines = Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'dumpsys', 'window') -IgnoreExitCode
  $focusLines = @($windowLines | Where-Object { $_ -match 'mCurrentFocus|mFocusedApp|mTopApp|topApp' })
  return [string]::Join("`n", $focusLines)
}

function Assert-AppFocused {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [string]$PackageName,
    [Parameter(Mandatory = $true)]
    [string]$ActivityComponent
  )

  for ($attempt = 1; $attempt -le 2; $attempt++) {
    $focusSummary = Get-AndroidFocusSummary -AdbPath $AdbPath -Serial $Serial
    if ($focusSummary.IndexOf($PackageName, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      Write-Host "Focused Android window belongs to $PackageName."
      return
    }

    if ($attempt -lt 2) {
      Write-Warning "Focused Android window is not the game yet. Current focus:`n$focusSummary`nDismissing dialogs and relaunching once..."
      Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'input', 'keyevent', '4') -IgnoreExitCode | Out-Null
      Start-Sleep -Seconds 1
      Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'am', 'start', '-W', '-n', $ActivityComponent) -IgnoreExitCode | Out-Null
      Start-Sleep -Seconds 4
    } else {
      $screenshotPath = Save-LaunchScreenshot -RepoRoot $RepoRoot -AdbPath $AdbPath -Serial $Serial
      if ($screenshotPath) {
        Write-Warning "Saved non-game focus screenshot to $screenshotPath"
      }
      throw "Focused Android window is not $PackageName after launch. Current focus:`n$focusSummary"
    }
  }
}

function Save-LaunchScreenshot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [string]$FileName = 'app-launch.png'
  )

  $outputDir = Join-Path $RepoRoot 'output\android-smoke'
  if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  }

  $remotePath = '/sdcard/ember-android-launch.png'
  $localPath = Join-Path $outputDir $FileName
  Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'screencap', '-p', $remotePath) -IgnoreExitCode | Out-Null
  Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('pull', $remotePath, $localPath) -IgnoreExitCode | Out-Null
  Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'rm', $remotePath) -IgnoreExitCode | Out-Null

  if (Test-Path $localPath) {
    return $localPath
  }

  return $null
}

function Get-DeviceDisplaySize {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial
  )

  $sizeOutput = Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'wm', 'size')
  $sizeText = ($sizeOutput | Out-String).Trim()
  if ($sizeText -match 'Physical size:\s*(\d+)x(\d+)') {
    return [PSCustomObject]@{
      Width = [int]$Matches[1]
      Height = [int]$Matches[2]
    }
  }

  throw "Could not parse Android display size from: $sizeText"
}

function Invoke-DeviceTapRatio {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [int]$Width,
    [Parameter(Mandatory = $true)]
    [int]$Height,
    [Parameter(Mandatory = $true)]
    [double]$XRatio,
    [Parameter(Mandatory = $true)]
    [double]$YRatio
  )

  $x = [int][Math]::Round($Width * $XRatio)
  $y = [int][Math]::Round($Height * $YRatio)
  Write-Host "Tapping x=$x y=$y"
  Invoke-DeviceAdb -AdbPath $AdbPath -Serial $Serial -AdbArgs @('shell', 'input', 'tap', "$x", "$y") | Out-Null
}

function Get-FileSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $bytes = $sha.ComputeHash($stream)
      return (($bytes | ForEach-Object { $_.ToString('X2') }) -join '')
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Invoke-TapUntilScreenshotChanges {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [string]$PackageName,
    [Parameter(Mandatory = $true)]
    [string]$ActivityComponent,
    [Parameter(Mandatory = $true)]
    [int]$Width,
    [Parameter(Mandatory = $true)]
    [int]$Height,
    [Parameter(Mandatory = $true)]
    [string]$BaselineHash,
    [Parameter(Mandatory = $true)]
    [long]$BaselineFileBytes,
    [Parameter(Mandatory = $true)]
    [string]$FileName,
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [object[]]$Ratios,
    [int]$WaitSeconds = 2,
    [long]$MinFileBytesDelta = 0
  )

  foreach ($ratio in $Ratios) {
    Invoke-DeviceTapRatio -AdbPath $AdbPath -Serial $Serial -Width $Width -Height $Height -XRatio $ratio.X -YRatio $ratio.Y
    Start-Sleep -Seconds $WaitSeconds
    Assert-AppFocused -RepoRoot $RepoRoot -AdbPath $AdbPath -Serial $Serial -PackageName $PackageName -ActivityComponent $ActivityComponent
    $screenshotPath = Save-LaunchScreenshot -RepoRoot $RepoRoot -AdbPath $AdbPath -Serial $Serial -FileName $FileName
    if (!$screenshotPath) {
      throw "Could not save Android $Description screenshot."
    }
    $hash = Get-FileSha256 -Path $screenshotPath
    $fileBytes = (Get-Item $screenshotPath).Length
    if ($hash -ne $BaselineHash -and [Math]::Abs($fileBytes - $BaselineFileBytes) -ge $MinFileBytesDelta) {
      Write-Host "$Description screenshot=$screenshotPath"
      return [PSCustomObject]@{
        Path = $screenshotPath
        Hash = $hash
        FileBytes = $fileBytes
        XRatio = $ratio.X
        YRatio = $ratio.Y
      }
    }
  }

  throw "Android tap smoke did not reach a new $Description screen after trying all tap candidates."
}

function Invoke-AndroidTapSmoke {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$AdbPath,
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [Parameter(Mandatory = $true)]
    [string]$PackageName,
    [Parameter(Mandatory = $true)]
    [string]$ActivityComponent,
    [Parameter(Mandatory = $true)]
    [string]$LaunchScreenshotPath
  )

  $display = Get-DeviceDisplaySize -AdbPath $AdbPath -Serial $Serial
  Write-Host "Android tap smoke display=$($display.Width)x$($display.Height)"

  $launchHash = Get-FileSha256 -Path $LaunchScreenshotPath
  $launchFileBytes = (Get-Item $LaunchScreenshotPath).Length

  # Menu: try a small cluster of taps around the primary "开始远征" button so
  # minor UI layout shifts do not break Android smoke.
  $characterResult = Invoke-TapUntilScreenshotChanges `
    -RepoRoot $RepoRoot `
    -AdbPath $AdbPath `
    -Serial $Serial `
    -PackageName $PackageName `
    -ActivityComponent $ActivityComponent `
    -Width $display.Width `
    -Height $display.Height `
    -BaselineHash $launchHash `
    -BaselineFileBytes $launchFileBytes `
    -FileName 'character-select.png' `
    -Description 'character-select' `
    -Ratios @(
      @{ X = 0.50; Y = 0.542 },
      @{ X = 0.50; Y = 0.52 },
      @{ X = 0.50; Y = 0.56 }
    ) `
    -MinFileBytesDelta 20000
  $characterScreenshotPath = $characterResult.Path
  $characterHash = $characterResult.Hash
  $characterFileBytes = $characterResult.FileBytes

  # Character select: try the sticky bottom action area with a few nearby taps.
  $gameplayResult = Invoke-TapUntilScreenshotChanges `
    -RepoRoot $RepoRoot `
    -AdbPath $AdbPath `
    -Serial $Serial `
    -PackageName $PackageName `
    -ActivityComponent $ActivityComponent `
    -Width $display.Width `
    -Height $display.Height `
    -BaselineHash $characterHash `
    -BaselineFileBytes $characterFileBytes `
    -FileName 'gameplay.png' `
    -Description 'gameplay' `
    -Ratios @(
      @{ X = 0.27; Y = 0.924 },
      @{ X = 0.27; Y = 0.95 },
      @{ X = 0.29; Y = 0.91 }
    ) `
    -WaitSeconds 4 `
    -MinFileBytesDelta 20000
  $gameplayScreenshotPath = $gameplayResult.Path
  Write-Host "Android tap smoke reached gameplay."
}

$repoRoot = (Get-RepoRoot).Path
if (!$ApkPath) {
  $ApkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
}
if (!(Test-Path $ApkPath)) {
  throw "Debug APK was not found at $ApkPath. Run npm run build:android:debug first."
}
$ApkPath = (Resolve-Path $ApkPath).Path

if (!$PackageName) {
  $PackageName = Read-CapacitorPackageName -RepoRoot $repoRoot
}
if (!$ActivityName.StartsWith('.')) {
  $activityComponent = "$PackageName/$ActivityName"
} else {
  $activityComponent = "$PackageName/$ActivityName"
}

$adbPath = Resolve-AdbPath -RepoRoot $repoRoot
Write-Host "Using adb=$adbPath"
Write-Host "Using APK=$ApkPath"
Write-Host "Using package=$PackageName"

$startedEmulator = $null
try {
  if ($AvdName) {
    $startedEmulator = Start-AvdIfNeeded -RepoRoot $repoRoot -AdbPath $adbPath -RequestedAvdName $AvdName -TimeoutSeconds $BootTimeoutSeconds
    $device = $startedEmulator.Device
  } else {
    $device = Resolve-TargetDevice -AdbPath $adbPath -RequestedSerial $DeviceSerial
    if (!$device -and $AutoStartSingleAvd -and !$DeviceSerial) {
      $availableAvds = @(Get-AvailableAvds -RepoRoot $repoRoot)
      if ($availableAvds.Count -eq 1) {
        Write-Host "No online Android device was found. Auto-starting the only available AVD '$($availableAvds[0])'..."
        $startedEmulator = Start-AvdIfNeeded -RepoRoot $repoRoot -AdbPath $adbPath -RequestedAvdName $availableAvds[0] -TimeoutSeconds $BootTimeoutSeconds
        $device = $startedEmulator.Device
      } elseif ($availableAvds.Count -gt 1) {
        Write-Host "Available AVDs: $($availableAvds -join ', ')"
      }
    }
  }

  if (!$device) {
    $message = "No online Android device was found. Connect a phone with USB debugging, start an emulator, pass -AvdName <name>, or pass -AutoStartSingleAvd when exactly one AVD is available."
    if ($AllowMissingDevice) {
      Write-Warning $message
      exit 0
    }
    throw $message
  }

  $serial = $device.Serial
  Write-Host "Using device=$($device.Raw)"

  if ($serial.StartsWith('emulator-')) {
    Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('shell', 'am', 'force-stop', 'com.google.android.apps.wellbeing') -IgnoreExitCode | Out-Null
    Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('shell', 'input', 'keyevent', '4') -IgnoreExitCode | Out-Null
  }

  if (!$SkipLogcat) {
    Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('logcat', '-c') -IgnoreExitCode | Out-Null
  }

  if (!$SkipInstall) {
    Write-Host "Installing APK..."
    Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('install', '-r', '-d', $ApkPath) | Out-Null
  }

  Write-Host "Launching app..."
  Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('shell', 'am', 'force-stop', $PackageName) -IgnoreExitCode | Out-Null
  $startOutput = Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('shell', 'am', 'start', '-W', '-n', $activityComponent)
  $startText = ($startOutput | Out-String).Trim()
  if ($startText -match 'Error|Exception|does not exist|not found') {
    throw "Android launch failed. $startText"
  }
  Write-Host $startText

  Start-Sleep -Seconds $LaunchWaitSeconds

  $pidOutput = Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('shell', 'pidof', $PackageName) -IgnoreExitCode
  $pidText = ($pidOutput | Out-String).Trim()
  if (!$pidText) {
    throw "App process is not running after launch."
  }
  Write-Host "App process pid=$pidText"
  Assert-AppFocused -RepoRoot $repoRoot -AdbPath $adbPath -Serial $serial -PackageName $PackageName -ActivityComponent $activityComponent

  $screenshotPath = Save-LaunchScreenshot -RepoRoot $repoRoot -AdbPath $adbPath -Serial $serial -FileName 'app-launch.png'
  if ($screenshotPath) {
    Write-Host "Launch screenshot=$screenshotPath"
  } else {
    Write-Warning "Could not save launch screenshot."
  }

  if ($SmokeTapFlow) {
    if (!$screenshotPath) {
      throw "Android tap smoke requires a launch screenshot."
    }
    Invoke-AndroidTapSmoke -RepoRoot $repoRoot -AdbPath $adbPath -Serial $serial -PackageName $PackageName -ActivityComponent $activityComponent -LaunchScreenshotPath $screenshotPath
  }

  if (!$SkipLogcat) {
    $logLines = Invoke-DeviceAdb -AdbPath $adbPath -Serial $serial -AdbArgs @('logcat', '-d', '-t', '1500') -IgnoreExitCode
    $badLines = @(Test-LogcatForFatalErrors -LogLines $logLines -PackageName $PackageName)
    if ($badLines.Count -gt 0) {
      $sample = ($badLines | Select-Object -First 20 | Out-String).Trim()
      throw "Fatal Android/WebView logcat errors were found after launch:`n$sample"
    }
    Write-Host "Logcat fatal-error scan passed."
  }

  Write-Host "Android debug APK install/launch verification passed."
} finally {
  if ($ShutdownStartedEmulator -and $startedEmulator -and $startedEmulator.Started -and $startedEmulator.Device) {
    Write-Host "Shutting down emulator $($startedEmulator.Device.Serial)..."
    Invoke-DeviceAdb -AdbPath $adbPath -Serial $startedEmulator.Device.Serial -AdbArgs @('emu', 'kill') -IgnoreExitCode | Out-Null
  }
}
