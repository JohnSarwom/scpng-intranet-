param(
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [datetime]$StartAt = (Get-Date).Date.AddDays(1).AddHours(8),
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$staffConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
$staffNodePath = (Get-Command node -ErrorAction Stop).Source
$staffScriptPath = Join-Path $PSScriptRoot 'run.mjs'
$staffArguments = '"{0}" --config "{1}"' -f $staffScriptPath, $staffConfigPath
if ($Apply) { $staffArguments += ' --apply' }
$staffAction = New-ScheduledTaskAction -Execute $staffNodePath -Argument $staffArguments -WorkingDirectory $PSScriptRoot
$staffTrigger = New-ScheduledTaskTrigger -Daily -DaysInterval 5 -At $StartAt
$staffSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$staffPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
# No stored password. This PC must be running and this Windows account signed in.
Register-ScheduledTask -TaskName 'SCPNG Staff List Sync' -Action $staffAction -Trigger $staffTrigger -Settings $staffSettings -Principal $staffPrincipal -Description 'Refresh eligible Microsoft 365 staff in two SharePoint lists every five days.'
