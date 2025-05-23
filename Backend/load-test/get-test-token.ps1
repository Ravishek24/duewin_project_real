# PowerShell script to get test token

Write-Host "Creating test user and getting token..." -ForegroundColor Green

# Create test user
$registerBody = @{
    user_name = "loadtestuser"
    password = "Test@123"
    email = "loadtest@example.com"
    phone_no = "1234567890"
    referral_code = "TEST123"  # You might need to provide a valid referral code
} | ConvertTo-Json

try {
    Write-Host "Registering test user..." -ForegroundColor Yellow
    $registerResponse = Invoke-RestMethod -Uri "https://strike.atsproduct.in/api/users/signup" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody
    Write-Host "Test user created successfully" -ForegroundColor Green
} catch {
    Write-Host "Error creating test user: $_" -ForegroundColor Red
    Write-Host "Trying to login with existing user..." -ForegroundColor Yellow
}

# Get token by logging in
$loginBody = @{
    email = "loadtest@example.com"  # Using email for login
    password = "Test@123"
} | ConvertTo-Json

try {
    Write-Host "Logging in to get token..." -ForegroundColor Yellow
    $loginResponse = Invoke-RestMethod -Uri "https://strike.atsproduct.in/api/users/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    # Save token to environment variable
    $env:TEST_TOKEN = $loginResponse.token
    Write-Host "Token obtained successfully" -ForegroundColor Green
    
    # Save token to file
    $env:TEST_TOKEN | Out-File -FilePath ".env.test"
    Write-Host "Token saved to .env.test" -ForegroundColor Green
    
    # Display token (first 10 characters for verification)
    $tokenPreview = $loginResponse.token.Substring(0, [Math]::Min(10, $loginResponse.token.Length))
    Write-Host "Token preview: $tokenPreview..." -ForegroundColor Cyan
} catch {
    Write-Host "Error getting token: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nTo use this token in your load tests:" -ForegroundColor Green
Write-Host "1. The token has been saved to .env.test" -ForegroundColor Yellow
Write-Host "2. The token has been set as an environment variable TEST_TOKEN" -ForegroundColor Yellow
Write-Host "3. You can now run your load tests using: .\run-load-test.ps1" -ForegroundColor Yellow 