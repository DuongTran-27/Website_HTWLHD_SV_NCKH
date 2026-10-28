param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$taskName = 'ResearchHubNCKH-Daily'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ($Remove) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false; Write-Output "Removed $taskName"; exit }
$scriptPath = Join-Path $projectRoot 'app/scripts/run-daily.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $scriptPath + '"') -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '09:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Research Hub: reminders, orphan cleanup, database and document backup; keeps seven generated backups.' -Force | Select-Object TaskName,State
Start-ScheduledTask -TaskName $taskName
