Write-Host "Abrindo console.anthropic.com para obter API Key..." -ForegroundColor Cyan
Start-Process "https://console.anthropic.com/api_keys"
Write-Host "Pagina aberta! Copie sua chave (sk-ant-...)" -ForegroundColor Green
Write-Host ""

$apiKey = Read-Host "Cole a chave ANTHROPIC_API_KEY aqui"

if ($apiKey -match "sk-ant-") {
    Write-Host "Chave detectada! Configurando..." -ForegroundColor Green

    $envFile = "C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\.env"
    $content = Get-Content $envFile -Raw

    if ($content -like "*ANTHROPIC_API_KEY*") {
        $content = $content -replace "ANTHROPIC_API_KEY=.*", "ANTHROPIC_API_KEY=$apiKey"
    } else {
        $content += "`nANTHROPIC_API_KEY=$apiKey"
    }

    Set-Content $envFile -Value $content
    Write-Host "Configurado em .env" -ForegroundColor Green
    Write-Host "Proxima: execute `npm run dev` na pasta backend" -ForegroundColor Yellow
} else {
    Write-Host "Chave invalida!" -ForegroundColor Red
}
