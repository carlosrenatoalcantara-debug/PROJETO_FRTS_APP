@echo off
REM Script para executar setup de credenciais no Windows

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  🔐 SETUP SEGURO DE CREDENCIAIS - MONGODB                    ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Navegando para diretório correto...
cd /d C:\PROJETO_FRTS_APP

echo.
echo Executando script interativo...
echo.
echo 📝 Responda as perguntas:
echo    1. Escolha MongoDB Atlas (a) ou Local (b)
echo    2. Se Atlas: preencha a Connection String
echo    3. Confirme as configurações
echo.

node setup-credentials.js

echo.
echo ✅ Arquivo .env.production foi criado!
echo.
pause
