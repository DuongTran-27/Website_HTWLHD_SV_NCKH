param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pgBin = Join-Path $projectRoot '.local/pgsql/bin'
$pgData = Join-Path $projectRoot '.local/pgdata'
if (-not (Test-Path (Join-Path $pgBin 'pg_ctl.exe'))) { throw 'Download/extract PostgreSQL binaries into .local/pgsql first. See README.' }
if ($Action -eq 'stop') { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -m fast stop; exit $LASTEXITCODE }
if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
  $envLines = Get-Content -LiteralPath (Join-Path $projectRoot '.env')
  $databaseLine = $envLines | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  $uri = [Uri]($databaseLine -replace '^DATABASE_URL=','')
  $pgPassword = [Uri]::UnescapeDataString(($uri.UserInfo -split ':',2)[1])
  $pwPath = Join-Path $projectRoot '.local/.pg-init'
  [System.IO.File]::WriteAllText($pwPath, $pgPassword)
  try { & (Join-Path $pgBin 'initdb.exe') -D $pgData -U nckh --pwfile=$pwPath -A scram-sha-256 -E UTF8 --locale=C; if ($LASTEXITCODE -ne 0) { throw 'initdb failed' } }
  finally { Remove-Item -LiteralPath $pwPath -Force }
  Add-Content -LiteralPath (Join-Path $pgData 'postgresql.conf') -Value "`nport = 55432`nlisten_addresses = '127.0.0.1'`nmax_connections = 50"
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status | Out-Null
if ($LASTEXITCODE -ne 0) { & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l (Join-Path $projectRoot '.local/postgres.log') start; exit $LASTEXITCODE }
Write-Output 'PostgreSQL is running on 127.0.0.1:55432'
