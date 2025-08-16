# PowerShell Script to Run Manual Attendance Cron
# This script runs the manual attendance cron job

Write-Host "🚀 Manual Attendance Cron Trigger Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Navigate to the Backend directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir ".."
Set-Location $backendDir

Write-Host "📁 Working directory: $(Get-Location)" -ForegroundColor Yellow

# Check if the manual script exists
$manualScript = Join-Path $scriptDir "manual-attendance-cron.js"
if (-not (Test-Path $manualScript)) {
    Write-Host "❌ Manual attendance script not found: $manualScript" -ForegroundColor Red
    exit 1
}

Write-Host "📜 Found manual script: $manualScript" -ForegroundColor Green

# Show usage options
Write-Host ""
Write-Host "Available options:" -ForegroundColor Cyan
Write-Host "  Default: Process today's attendance" -ForegroundColor White
Write-Host "  --date=YYYY-MM-DD: Process specific date" -ForegroundColor White
Write-Host "  --force: Force processing even if already processed" -ForegroundColor White
Write-Host ""

# Ask user for options
$useForce = Read-Host "Force processing? (y/N)"
$forceFlag = if ($useForce -eq "y" -or $useForce -eq "Y") { "--force" } else { "" }

$useDate = Read-Host "Process specific date? (YYYY-MM-DD or press Enter for today)"
$dateFlag = if ($useDate -and $useDate -match "^\d{4}-\d{2}-\d{2}$") { "--date=$useDate" } else { "" }

# Build command
$command = "node scripts/manual-attendance-cron.js"
if ($forceFlag) { $command += " $forceFlag" }
if ($dateFlag) { $command += " $dateFlag" }

Write-Host ""
Write-Host "🚀 Running command: $command" -ForegroundColor Yellow
Write-Host ""

# Execute the command
try {
    Invoke-Expression $command
    Write-Host ""
    Write-Host "✅ Script execution completed!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Script execution failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
