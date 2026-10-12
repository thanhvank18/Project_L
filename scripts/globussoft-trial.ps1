[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$trialRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\globussoft-school-mis'
$runtimeRoot = Join-Path $trialRoot '.local'
$statePath = Join-Path $runtimeRoot 'processes.json'
$logRoot = Join-Path $runtimeRoot 'logs'
$databaseBin = Join-Path $runtimeRoot 'tools\mariadb-11.4.10-winx64\bin'
$databaseConfig = Join-Path $runtimeRoot 'mysql.ini'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
  Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}

$services = @(
  @{ Name = 'database'; Port = 3308; Executable = (Join-Path $databaseBin 'mariadbd.exe'); Identity = $databaseConfig; Arguments = "--defaults-file=`"$databaseConfig`" --console"; Directory = $trialRoot; Environment = @{} },
  @{ Name = 'storage'; Port = 9000; Executable = $nodePath; Identity = (Join-Path $runtimeRoot 'storage.cjs'); Directory = $trialRoot; Environment = @{} },
  @{ Name = 'api'; Port = 4002; Executable = $nodePath; Identity = (Join-Path $trialRoot 'packages\api\dist\main.js'); Directory = (Join-Path $trialRoot 'packages\api'); Environment = @{ HOST = '127.0.0.1'; PORT = '4002'; EMAIL_ENABLED = 'false'; NODE_ENV = 'production' } },
  @{ Name = 'web'; Port = 3001; Executable = $nodePath; Identity = (Join-Path $trialRoot 'packages\web\.next\standalone\packages\web\server.js'); Directory = (Join-Path $trialRoot 'packages\web'); Environment = @{ HOSTNAME = '127.0.0.1'; PORT = '3001'; NODE_ENV = 'production' } }
)
foreach ($service in $services) {
  if (!$service.ContainsKey('Arguments')) { $service.Arguments = '"' + $service.Identity + '"' }
}

$state = @{}
if (Test-Path -LiteralPath $statePath) {
  $savedState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  foreach ($property in $savedState.PSObject.Properties) { $state[$property.Name] = $property.Value }
}

function Save-State {
  $json = $state | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText($statePath, $json, [Text.UTF8Encoding]::new($false))
}

function Get-RecordedProcess($Service) {
  if (!$state.ContainsKey($Service.Name)) { return $null }
  $processId = [int]$state[$Service.Name]
  if ($processId -le 0) { throw "Invalid PID recorded for $($Service.Name)." }
  Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
}

function Test-Ownership($Service, $Process) {
  if (!$Process -or !$Process.ExecutablePath -or !$Process.CommandLine) { return $false }
  if (![string]::Equals($Process.ExecutablePath, $Service.Executable, [StringComparison]::OrdinalIgnoreCase)) { return $false }
  # Require the exact absolute script/config argument; relative scripts cannot prove ownership.
  $argument = if ($Service.Name -eq 'database') { '--defaults-file=' + $Service.Identity } else { $Service.Identity }
  $unquotedCommand = $Process.CommandLine.Replace('"', '')
  $pattern = '(?i)(?:^|\s)' + [regex]::Escape($argument) + '(?:\s|$)'
  return $unquotedCommand -match $pattern
}

function Get-Listeners($Service) {
  @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $Service.Port)
}

function Assert-ListenerOwnership($Service, $Process) {
  $listeners = @(Get-Listeners $Service)
  foreach ($listener in $listeners) {
    if (!$Process -or $listener.OwningProcess -ne $Process.ProcessId) {
      throw "Port $($Service.Port) is occupied by another process; no process was stopped."
    }
    if ($listener.LocalAddress -ne '127.0.0.1' -and $listener.LocalAddress -ne '::1') {
      throw "$($Service.Name) is listening beyond loopback. Review its local configuration before continuing."
    }
  }
  return $listeners.Count -gt 0
}

function Test-LocalPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync('127.0.0.1', $Port)
    if (!$connection.Wait(300)) { return $false }
    return $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-Ready($Service, [int]$ProcessId) {
  $timeoutSeconds = if ($Service.Name -eq 'api') { 180 } else { 60 }
  $deadline = [DateTime]::UtcNow.AddSeconds($timeoutSeconds)
  do {
    if (!(Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
      throw "$($Service.Name) exited. Read $logRoot\$($Service.Name).err.log."
    }
    if (Test-LocalPort $Service.Port) {
      $process = Get-RecordedProcess $Service
      if (!(Test-Ownership $Service $process)) { throw "Cannot verify ownership of $($Service.Name)." }
      if (Assert-ListenerOwnership $Service $process) { return }
    }
    Start-Sleep -Milliseconds 400
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "$($Service.Name) did not open port $($Service.Port) within $timeoutSeconds seconds. Read $logRoot."
}

function Start-ServiceProcess($Service) {
  $originalEnvironment = @{}
  try {
    foreach ($key in $Service.Environment.Keys) {
      $originalEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
      [Environment]::SetEnvironmentVariable($key, $Service.Environment[$key], 'Process')
    }
    $started = Start-Process -FilePath $Service.Executable -ArgumentList $Service.Arguments `
      -WorkingDirectory $Service.Directory -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $logRoot ($Service.Name + '.out.log')) `
      -RedirectStandardError (Join-Path $logRoot ($Service.Name + '.err.log'))
  } finally {
    foreach ($key in $originalEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $originalEnvironment[$key], 'Process')
    }
  }
  $state[$Service.Name] = $started.Id
  Save-State
  Wait-Ready $Service $started.Id
  Write-Host "$($Service.Name): ready on 127.0.0.1:$($Service.Port) (PID $($started.Id))"
}

function Stop-Database($Service, $Process) {
  $credentialsPath = Join-Path $runtimeRoot 'database-credentials.json'
  $adminPath = Join-Path $databaseBin 'mariadb-admin.exe'
  if (!(Test-Path -LiteralPath $credentialsPath) -or !(Test-Path -LiteralPath $adminPath)) {
    throw 'Cannot gracefully stop MariaDB: local credentials or mariadb-admin.exe is missing. Database was left running.'
  }
  $credentials = Get-Content -LiteralPath $credentialsPath -Raw | ConvertFrom-Json
  if (!$credentials.root) { throw 'Local database root credential is missing. Database was left running.' }
  $clientConfig = Join-Path $runtimeRoot ('shutdown-' + [guid]::NewGuid().ToString('N') + '.ini')
  $escapedPassword = ([string]$credentials.root).Replace('\', '\\').Replace('"', '\"')
  $configText = "[client]`nuser=root`npassword=`"$escapedPassword`"`nhost=127.0.0.1`nport=3308`nprotocol=tcp`nconnect-timeout=5`n"
  try {
    [IO.File]::WriteAllText($clientConfig, $configText, [Text.UTF8Encoding]::new($false))
    # Verify again immediately before shutdown. Never send shutdown to a different listener.
    $current = Get-RecordedProcess $Service
    if (!(Test-Ownership $Service $current) -or $current.CreationDate -ne $Process.CreationDate) {
      throw 'Database process identity changed. No shutdown command was sent.'
    }
    if (!(Assert-ListenerOwnership $Service $current)) { throw 'Database has no verified listener. No shutdown command was sent.' }
    & $adminPath "--defaults-extra-file=$clientConfig" '--shutdown-timeout=30' shutdown
    if ($LASTEXITCODE -ne 0) { throw 'MariaDB graceful shutdown failed. Database was not forcibly terminated.' }
    Wait-Process -Id $Process.ProcessId -Timeout 35 -ErrorAction SilentlyContinue
    if (Get-Process -Id $Process.ProcessId -ErrorAction SilentlyContinue) { throw 'MariaDB has not exited yet; inspect database logs.' }
  } finally {
    if (Test-Path -LiteralPath $clientConfig) { Remove-Item -LiteralPath $clientConfig -Force }
  }
}

if (!(Test-Path -LiteralPath $trialRoot)) { throw "Clone not found at $trialRoot. This launcher does not install or seed the trial." }

if ($Action -eq 'status') {
  foreach ($service in $services) {
    $process = Get-RecordedProcess $service
    $listeners = @(Get-Listeners $service)
    $label = 'stopped'
    if ($process) {
      if (!(Test-Ownership $service $process)) { $label = 'recorded PID cannot be verified' }
      elseif ($listeners.Count -eq 0) { $label = 'running; port not ready' }
      else {
        try { $null = Assert-ListenerOwnership $service $process; $label = 'ready' }
        catch { $label = $_.Exception.Message }
      }
    } elseif ($listeners.Count -gt 0) { $label = 'port occupied by an untracked process' }
    Write-Host ("{0,-9} {1,-5} {2}" -f $service.Name, $service.Port, $label)
  }
  Write-Host "Web: http://127.0.0.1:3001 | API docs: http://127.0.0.1:4002/api/docs"
  Write-Host "Logs: $logRoot"
  return
}

if ($Action -eq 'start') {
  # Preflight every component before creating any new process.
  foreach ($service in $services) {
    foreach ($path in @($service.Executable, $service.Identity)) {
      if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required trial artifact is missing: $path. Build/setup must finish first." }
    }
    $process = Get-RecordedProcess $service
    if ($process -and !(Test-Ownership $service $process)) { throw "Refusing to reuse ambiguous PID for $($service.Name). No process was stopped." }
    $null = Assert-ListenerOwnership $service $process
  }
  $mysqlConfig = Get-Content -LiteralPath $databaseConfig -Raw
  if ($mysqlConfig -notmatch '(?m)^bind-address\s*=\s*127\.0\.0\.1\s*$' -or $mysqlConfig -notmatch '(?m)^port\s*=\s*3308\s*$') {
    throw 'mysql.ini must bind to 127.0.0.1 on port 3308 for this local trial.'
  }
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  foreach ($service in $services) {
    $process = Get-RecordedProcess $service
    if ($process) {
      Wait-Ready $service $process.ProcessId
      Write-Host "$($service.Name): already running (PID $($process.ProcessId))"
    } else { Start-ServiceProcess $service }
  }
  Write-Host 'Open http://127.0.0.1:3001. Existing trial data was preserved; no seeds were run.'
  return
}

$stopErrors = @()
for ($index = $services.Count - 1; $index -ge 0; $index--) {
  $service = $services[$index]
  try {
    $process = Get-RecordedProcess $service
    if (!$process) {
      $state.Remove($service.Name)
      Save-State
      Write-Host "$($service.Name): already stopped"
      continue
    }
    if (!(Test-Ownership $service $process)) { throw "Refusing to stop unverified PID for $($service.Name)." }
    if ($service.Name -eq 'database') { Stop-Database $service $process }
    else {
      # Recheck creation time to guard against PID reuse between lookup and stop.
      $current = Get-RecordedProcess $service
      if (!(Test-Ownership $service $current) -or $current.CreationDate -ne $process.CreationDate) {
        throw "Process identity changed for $($service.Name); no process was stopped."
      }
      Stop-Process -Id $process.ProcessId -ErrorAction Stop
      Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    }
    $state.Remove($service.Name)
    Save-State
    Write-Host "$($service.Name): stopped"
  } catch { $stopErrors += $_.Exception.Message; Write-Warning $_.Exception.Message }
}
if ($stopErrors.Count) { throw 'Some trial services could not be safely stopped. Review the warnings above.' }
