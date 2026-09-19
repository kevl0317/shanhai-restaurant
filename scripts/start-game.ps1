param(
    [ValidateRange(1024, 65535)][int]$Port = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = "http://127.0.0.1:$Port"
$serverProcess = $null
$previousPort = $env:PORT

function Test-GameReady {
    try {
        $page = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 1
        return $page.Content -match '<title>山海食谱铺(?:\s|·|</title>)'
    } catch { return $false }
}

try {
    if (Test-GameReady) {
        Write-Host "游戏已在运行：$gameUrl"
        if (-not $NoBrowser) { Start-Process $gameUrl }
        exit 0
    }

    $installedNode = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $candidates = @()
    if ($installedNode) { $candidates += $installedNode.Source }
    if ($env:USERPROFILE) {
        $candidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    $nodePath = $null
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $version = & $candidate --version 2>$null
            if ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20) {
                $nodePath = $candidate
                break
            }
        }
    }
    if (-not $nodePath) { throw '没有找到 Node.js 20 或以上版本。请安装 Node.js 后重新双击启动游戏.cmd。' }

    $logDir = Join-Path $projectRoot 'logs'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $outputLog = Join-Path $logDir "server-$PID.log"
    $errorLog = Join-Path $logDir "server-$PID-error.log"
    $serverScript = Join-Path $projectRoot 'server.mjs'
    $env:PORT = [string]$Port
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"{0}"' -f $serverScript) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ($serverProcess.HasExited) { break }
        if (Test-GameReady) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) {
        $detail = if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { '' }
        throw "游戏服务未能启动。端口 $Port 可能已被占用。`n$detail"
    }
    Write-Host ''
    Write-Host "山海食谱铺已启动：$gameUrl" -ForegroundColor Green
    Write-Host '请保持这个窗口打开。按 Ctrl+C 可停止游戏服务。'
    Write-Host '游戏进度会自动保存在当前浏览器中。'
    if (-not $NoBrowser) { Start-Process $gameUrl }
    while (-not $serverProcess.HasExited) { Start-Sleep -Seconds 1 }
    if ($serverProcess.ExitCode -ne 0) { throw "游戏服务意外停止，详情见 $errorLog" }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    $env:PORT = $previousPort
    if ($serverProcess -and -not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue }
}
