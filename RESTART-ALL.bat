@echo off
REM Script para reiniciar Backend e Frontend

echo ======================================
echo 🔄 REINICIANDO SISTEMA COMPLETO
echo ======================================

REM Aguarda 2 segundos
timeout /t 2 /nobreak

REM Inicia Backend em um terminal separado
echo.
echo 📡 Iniciando Backend em localhost:5005...
start cmd /k "cd backend && npm start"

REM Aguarda backend iniciar
timeout /t 5 /nobreak

REM Inicia Frontend em um terminal separado
echo.
echo 🎨 Iniciando Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Backend: http://localhost:5005
echo ✅ Frontend: http://localhost:5173
echo.
echo Aguarde os servidores ficarem prontos...
echo Depois abra: http://localhost:5173
pause
