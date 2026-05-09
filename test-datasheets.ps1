# Script de teste automático de datasheets
# Testa módulos e inversores contra a API

$API_URL = "https://projetofrtsapp-production.up.railway.app"
$MODULOS_PATH = "C:\Users\Forte Solar\OneDrive\Área de Trabalho\Modulo"
$INVERSORES_PATH = "C:\Users\Forte Solar\OneDrive\Área de Trabalho\inversor"

Write-Host "🚀 Teste Automático de Datasheets" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Função para testar um PDF
function Test-Datasheet {
    param(
        [string]$FilePath,
        [string]$Type
    )

    $FileName = Split-Path $FilePath -Leaf
    Write-Host "📄 Testando: $FileName ($Type)" -ForegroundColor Yellow

    try {
        # Criar FormData
        $form = @{
            pdf = Get-Item -Path $FilePath
        }

        # Endpoint específico baseado no tipo
        if ($Type -eq "modulo") {
            $endpoint = "/api/datasheet/extrair-datasheet"
        } else {
            $endpoint = "/api/datasheet/extrair-datasheet"
        }

        # Fazer request
        $response = Invoke-RestMethod -Uri "$API_URL$endpoint" `
            -Method Post `
            -Form $form `
            -ErrorAction Stop

        # Validar resposta
        if ($response) {
            Write-Host "  ✅ Sucesso!" -ForegroundColor Green
            Write-Host "     Modelo: $($response.modelo)"
            Write-Host "     Fabricante: $($response.fabricante)"
            Write-Host "     Potência: $($response.potencia_wp)W"
            Write-Host "     Score: $($response.qualityScore)%"
            Write-Host ""
            return $response
        } else {
            Write-Host "  ❌ Resposta vazia" -ForegroundColor Red
        }

    } catch {
        Write-Host "  ❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Testar Módulos
Write-Host "📦 TESTANDO MÓDULOS" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
$modulos = Get-ChildItem -Path $MODULOS_PATH -Filter "*.pdf" | Select-Object -First 5

foreach ($pdf in $modulos) {
    Test-Datasheet -FilePath $pdf.FullName -Type "modulo"
}

Write-Host ""
Write-Host "⚡ TESTANDO INVERSORES" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
$inversores = Get-ChildItem -Path $INVERSORES_PATH -Filter "*.pdf" | Select-Object -First 5

foreach ($pdf in $inversores) {
    Test-Datasheet -FilePath $pdf.FullName -Type "inversor"
}

Write-Host ""
Write-Host "✅ Testes concluídos!" -ForegroundColor Green
