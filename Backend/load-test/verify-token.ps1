# PowerShell script to verify token

Write-Host "Verifying token..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "https://strike.atsproduct.in/api/users/profile" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $env:TEST_TOKEN"
        }
    
    Write-Host "Token is valid!" -ForegroundColor Green
    Write-Host "User Profile:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Token verification failed: $_" -ForegroundColor Red
    Write-Host "Please run .\get-test-token.ps1 to get a new token" -ForegroundColor Yellow
} 