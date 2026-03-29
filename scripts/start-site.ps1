$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not (Get-Command hugo -ErrorAction SilentlyContinue)) {
  throw "未检测到 hugo。请先安装 Hugo Extended，再运行本脚本。"
}

hugo server -s (Join-Path $repoRoot "site") --baseURL "http://localhost:1313/"
