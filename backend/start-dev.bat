@echo off
REM 🚀 Script de inicialização do servidor Forte Solar
REM Modo: Desenvolvimento com Memory Storage (SEM MongoDB)
REM
REM Uso:
REM   start-dev.bat          (inicia normalmente)
REM   start-dev.bat mongodb  (tenta conectar ao MongoDB)

echo.
echo 🚀 Iniciando Servidor Forte Solar
echo ==================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js não encontrado. Instale Node.js 16+ antes de continuar.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js versão: %NODE_VERSION%
echo.

REM Modo MongoDB (se solicitado)
if "%1"=="mongodb" (
    echo 🔌 Tentando conectar ao MongoDB...
    echo    Se falhar, o servidor usará Memory Storage automaticamente
    set USE_MEMORY_STORAGE=false
    set SKIP_MONGODB_RETRIES=false
) else (
    echo 💾 Modo: Memory Storage (SEM MongoDB)
    echo    Todos os dados serão salvos em memory-storage.json
    echo    Rápido de iniciar ✨
    set USE_MEMORY_STORAGE=true
    set SKIP_MONGODB_RETRIES=true
)

echo.
echo Iniciando servidor na porta 5005...
echo 🌐 Frontend: http://localhost:5173
echo 📡 API: http://localhost:5005
echo.
echo Pressione Ctrl+C para parar
echo ==================================
echo.

npm run dev
pause
