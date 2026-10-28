$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $projectRoot
$databaseLine = Get-Content -LiteralPath (Join-Path $projectRoot '.env') | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$databaseHost = ([Uri]($databaseLine -replace '^DATABASE_URL=','')).Host
if ($databaseHost -in @('127.0.0.1','localhost')) {
  & (Join-Path $PSScriptRoot 'postgres.ps1') start
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
& $nodeExecutable --env-file=.env app/scripts/daily.js
exit $LASTEXITCODE
