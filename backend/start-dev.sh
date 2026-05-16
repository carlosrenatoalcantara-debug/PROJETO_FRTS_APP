#!/bin/bash

# 🚀 Script de inicialização do servidor Forte Solar
# Modo: Desenvolvimento com Memory Storage (SEM MongoDB)
#
# Uso:
#   ./start-dev.sh          (inicia normalmente)
#   ./start-dev.sh mongodb  (tenta conectar ao MongoDB)

echo "🚀 Iniciando Servidor Forte Solar"
echo "=================================="

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 16+ antes de continuar."
    exit 1
fi

echo "✅ Node.js versão: $(node --version)"
echo ""

# Modo MongoDB (se solicitado)
if [ "$1" == "mongodb" ]; then
    echo "🔌 Tentando conectar ao MongoDB..."
    echo "   Se falhar, o servidor usará Memory Storage automaticamente"
    export USE_MEMORY_STORAGE=false
    export SKIP_MONGODB_RETRIES=false
else
    echo "💾 Modo: Memory Storage (SEM MongoDB)"
    echo "   Todos os dados serão salvos em memory-storage.json"
    echo "   Rápido de iniciar ✨"
    export USE_MEMORY_STORAGE=true
    export SKIP_MONGODB_RETRIES=true
fi

echo ""
echo "Iniciando servidor na porta 5005..."
echo "🌐 Frontend: http://localhost:5173"
echo "📡 API: http://localhost:5005"
echo ""
echo "Pressione Ctrl+C para parar"
echo "=================================="
echo ""

npm run dev
