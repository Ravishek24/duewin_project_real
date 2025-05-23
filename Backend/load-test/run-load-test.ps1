# PowerShell script to run load tests

Write-Host "Starting load test..." -ForegroundColor Green

# Create results directory if it doesn't exist
if (-not (Test-Path "results")) {
    New-Item -ItemType Directory -Path "results"
}

# Get current timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Run the load test
Write-Host "Running HTTP load test..." -ForegroundColor Yellow
artillery run --output "results/load_test_${timestamp}.json" load-test.yml

# Run WebSocket test
Write-Host "Running WebSocket load test..." -ForegroundColor Yellow
artillery run --output "results/websocket_test_${timestamp}.json" websocket-test.yml

# Generate HTML reports
Write-Host "Generating reports..." -ForegroundColor Yellow
artillery report --output "results/load_test_${timestamp}.html" "results/load_test_${timestamp}.json"
artillery report --output "results/websocket_test_${timestamp}.html" "results/websocket_test_${timestamp}.json"

Write-Host "Load test completed!" -ForegroundColor Green
Write-Host "Results saved in:" -ForegroundColor Green
Write-Host "  - results/load_test_${timestamp}.html" -ForegroundColor Cyan
Write-Host "  - results/websocket_test_${timestamp}.html" -ForegroundColor Cyan 