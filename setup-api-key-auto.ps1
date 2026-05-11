# Script para abrir a página de API keys do Anthropic no Chrome
# O usuário vai copiar a chave e vamos configurar automaticamente

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ABRINDO: Console.Anthropic.com para obter API Key" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Abrir página de API keys no Chrome
Start-Process "https://console.anthropic.com/api_keys"

Write-Host "✅ Página aberta no Chrome"
Write-Host ""
Write-Host "📋 PRÓXIMAS AÇÕES:"
Write-Host "  1. Faça login no Anthropic Console"
Write-Host "  2. Clique em 'Create Key'"
Write-Host "  3. Copie a chave (começa com sk-ant-)"
Write-Host "  4. Cole a chave no prompt abaixo"
Write-Host ""

# Pedir a chave
$apiKey = Read-Host "Cole sua chave ANTHROPIC_API_KEY (sk-ant-)"

if ($apiKey -match "^sk-ant-") {
    Write-Host "✅ Chave válida detectada!" -ForegroundColor Green
    Write-Host "   Configurando..." -ForegroundColor Yellow
    Write-Host ""
    
    # Configurar no .env local
    $envPath = "C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\.env"
    $content = Get-Content $envPath -Raw
    
    if ($content -match "ANTHROPIC_API_KEY=") {
        $content = $content -replace "ANTHROPIC_API_KEY=.*", "ANTHROPIC_API_KEY=$apiKey"
    } else {
        $content += "`n`n# ANTHROPIC - Claude Vision`nANTHROPIC_API_KEY=$apiKey"
    }
    
    Set-Content $envPath -Value $content
    Write-Host "✅ Configurado em backend/.env" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  PRÓXIMAS AÇÕES:" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  BACKEND LOCAL:"
    Write-Host "    cd backend && npm run dev"
    Write-Host ""
    Write-Host "2️⃣  RAILWAY PRODUCTION:"
    Write-Host "    railway variables set ANTHROPIC_API_KEY=$apiKey"
    Write-Host ""
    Write-Host "3️⃣  TESTE:"
    Write-Host "    http://localhost:5000/api/carregadores-ev"
    Write-Host ""
} else {
    Write-Host "❌ Chave inválida! Deve começar com 'sk-ant-'" -ForegroundColor Red
    exit 1
}
