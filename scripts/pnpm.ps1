# Prefer a normal installation; use Codex's bundled pnpm on this machine if absent.
$ErrorActionPreference = 'Stop'
$taskPnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($taskPnpmCommand) {
  $taskPnpmPath = $taskPnpmCommand.Source
} else {
  $taskRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
  $taskPnpmPath = Join-Path $taskRuntime 'bin/fallback/pnpm.cmd'
  if (!(Test-Path -LiteralPath $taskPnpmPath)) {
    throw 'pnpm not found. Install Node.js 24+ and pnpm 11.25.0, then retry.'
  }
  $env:PATH = (Join-Path $taskRuntime 'node/bin') + ';' + $env:PATH
}

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  & $taskPnpmPath @args
  $taskExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $taskExitCode
