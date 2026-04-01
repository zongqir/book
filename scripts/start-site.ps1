$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$astroRoot = Join-Path $repoRoot "astro-site"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "未检测到 npm。请先安装 Node.js，再运行本脚本。"
}

Push-Location $astroRoot
try {
  npm run dev -- --host 0.0.0.0
}
finally {
  Pop-Location
}
