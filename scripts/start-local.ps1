$ErrorActionPreference = 'Stop'
$clinicRoot = Split-Path $PSScriptRoot -Parent
$address = 'http://127.0.0.1:4173'
try {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (!$node) {
        $node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    }
    if (!(Test-Path -LiteralPath $node)) { throw 'Node.js 22 or later is required. Install it, then run this launcher again.' }
    Set-Location -LiteralPath $clinicRoot
    if (!(Test-Path -LiteralPath '.demo\state.json')) {
        & $node 'scripts\seed.cjs'
        if ($LASTEXITCODE -ne 0) { throw 'Unable to prepare demo data.' }
    }
    $running = $false
    try {
        $health = Invoke-RestMethod "$address/api/health" -TimeoutSec 2
        $running = $health.service -eq 'clinic-local'
    } catch {}
    if (!$running) {
        $server = Join-Path $PSScriptRoot 'demo-server.cjs'
        Start-Process -FilePath $node -ArgumentList @('"' + $server + '"') -WorkingDirectory $clinicRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $clinicRoot '.demo\server.log') -RedirectStandardError (Join-Path $clinicRoot '.demo\server-error.log')
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 300
            try {
                $health = Invoke-RestMethod "$address/api/health" -TimeoutSec 1
                if ($health.service -eq 'clinic-local') { $running = $true; break }
            } catch {}
        }
    }
    if (!$running) { throw 'The clinic could not start. Check .demo\server-error.log; port 4173 may be occupied.' }
    Start-Process $address
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
