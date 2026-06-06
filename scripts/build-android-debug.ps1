Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-JavaMajorVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$JavaHome
  )

  $javac = Join-Path $JavaHome 'bin\javac.exe'
  $jlink = Join-Path $JavaHome 'bin\jlink.exe'
  if (!(Test-Path $javac) -or !(Test-Path $jlink)) {
    return $null
  }

  $versionOutput = & $javac -version 2>&1
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  if ($versionOutput -match 'javac\s+(\d+)') {
    return [int]$Matches[1]
  }

  return $null
}

function Resolve-WorkspaceJdk {
  $candidates = @()

  if ($env:JAVA_HOME) {
    $candidates += $env:JAVA_HOME
  }

  $workspaceJdks = Get-ChildItem (Join-Path $PSScriptRoot '..\.tools\microsoft-jdk-21') -Directory -ErrorAction SilentlyContinue
  $candidates += $workspaceJdks.FullName

  $programFilesJdks = Get-ChildItem 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue
  $candidates += $programFilesJdks.FullName

  foreach ($candidate in $candidates | Where-Object { $_ } | Select-Object -Unique) {
    $major = Get-JavaMajorVersion -JavaHome $candidate
    if ($major -ge 21) {
      return $candidate
    }
  }

  throw "No JDK 21+ with jlink was found. Install one under .tools\microsoft-jdk-21 or set JAVA_HOME to a full JDK 21+."
}

function Get-FileSha256Hex {
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

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$javaHome = Resolve-WorkspaceJdk
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

if (-not $env:GRADLE_USER_HOME) {
  $env:GRADLE_USER_HOME = 'C:\tmp\gradle-ember'
}
if (!(Test-Path $env:GRADLE_USER_HOME)) {
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME | Out-Null
}

Write-Host "Using JAVA_HOME=$javaHome"
Write-Host "Using GRADLE_USER_HOME=$($env:GRADLE_USER_HOME)"
Write-Host "Syncing web assets into docs and Android..."

Set-Location $repoRoot
& node scripts/sync-web.mjs
if ($LASTEXITCODE -ne 0) {
  throw "web/android asset sync failed."
}

Set-Location (Join-Path $repoRoot 'android')
& .\gradlew.bat assembleDebug --no-daemon --max-workers=1 --console=plain
if ($LASTEXITCODE -ne 0) {
  throw "Gradle assembleDebug failed."
}

Set-Location $repoRoot
$apkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (!(Test-Path $apkPath)) {
  throw "Expected debug APK was not found at $apkPath"
}

Write-Host "Verifying APK web payload..."
$apkEntries = & tar -tf $apkPath
if ($LASTEXITCODE -ne 0) {
  throw "Failed to list APK contents."
}

$requiredEntries = @(
  'assets/public/index.html',
  'assets/public/styles.css',
  'assets/public/sw.js',
  'assets/public/src/main.mjs',
  'assets/public/src/game_core.mjs',
  'assets/public/src/save.mjs',
  'assets/public/assets/ember-characters-spritesheet.png',
  'assets/public/assets/ember-enemies-spritesheet.png',
  'assets/public/assets/arena-ember-fortress.png'
)

foreach ($entry in $requiredEntries) {
  if ($apkEntries -notcontains $entry) {
    throw "APK is missing required web asset: $entry"
  }
}

function Read-ApkEntryText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApkPath,
    [Parameter(Mandatory = $true)]
    [string]$Entry
  )

  $lines = & tar -xOf $ApkPath $Entry
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read APK entry: $Entry"
  }
  return [string]::Join("`n", $lines)
}

$mainText = Read-ApkEntryText -ApkPath $apkPath -Entry 'assets/public/src/main.mjs'
$coreText = Read-ApkEntryText -ApkPath $apkPath -Entry 'assets/public/src/game_core.mjs'
$swText = Read-ApkEntryText -ApkPath $apkPath -Entry 'assets/public/sw.js'

$mainNeedles = @(
  'applyForgeChoice',
  'applyShopChoice',
  'getDifficultyPresets',
  'difficulty-option',
  'ember-enemies-spritesheet.png',
  'buildCardDecision',
  'card-recommended'
)
foreach ($needle in $mainNeedles) {
  if (!$mainText.Contains($needle)) {
    throw "APK main.mjs is missing marker: $needle"
  }
}

$coreNeedles = @(
  'needsBossDamagePrep',
  'buildEventRewardCard',
  'riskyBossMultiplier',
  'extraCards = buildRewardChoices'
)
foreach ($needle in $coreNeedles) {
  if (!$coreText.Contains($needle)) {
    throw "APK game_core.mjs is missing marker: $needle"
  }
}

$swCachePattern = "const CACHE = 'ember-v\d+'"
if ($swText -notmatch $swCachePattern) {
  throw "APK sw.js is missing versioned cache marker: $swCachePattern"
}

$swNeedles = @(
  './src/audio.mjs',
  './src/save.mjs',
  './src/characters.mjs',
  './src/presentation.mjs',
  './assets/arena-ember-fortress.png',
  './assets/ember-enemies-spritesheet.png',
  'url.origin !== self.location.origin',
  "new Response('', { status: 504"
)
foreach ($needle in $swNeedles) {
  if (!$swText.Contains($needle)) {
    throw "APK sw.js is missing marker: $needle"
  }
}

$apkHash = Get-FileSha256Hex -Path $apkPath
Write-Host "APK verified: $apkPath"
Write-Host "APK SHA256=$apkHash"
