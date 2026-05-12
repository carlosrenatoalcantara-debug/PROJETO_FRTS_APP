#!/usr/bin/env python3
"""
Script para configurar ANTHROPIC_API_KEY no Railway
Usa GraphQL API do Railway para adicionar variável de ambiente
"""

import requests
import json
import os
from pathlib import Path

# ============================================
# CONFIGURAÇÕES
# ============================================

# Token de API do Railway (obtenha em https://railway.app/dashboard)
RAILWAY_TOKEN = os.getenv('RAILWAY_TOKEN', '')

# Chave Claude Vision (extraída do .env local)
# NÃO COLOQUE CHAVES REAIS AQUI - configure via variáveis de ambiente
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')

# IDs do Railway (precisam ser descobertos)
# Você pode encontrar em: https://railway.app/dashboard/project/[PROJECT_ID]/settings
RAILWAY_PROJECT_ID = os.getenv('RAILWAY_PROJECT_ID', '')
RAILWAY_ENVIRONMENT_ID = os.getenv('RAILWAY_ENVIRONMENT_ID', 'production')

# ============================================
# ENDPOINTS
# ============================================

RAILWAY_API_URL = 'https://api.railway.app/graphql'
RAILWAY_DASHBOARD_URL = 'https://railway.app/dashboard'

# ============================================
# FUNCTIONS
# ============================================

def print_header():
    print("""
╔══════════════════════════════════════════════════╗
║  Railway - Configurar Claude Vision API         ║
║  ANTHROPIC_API_KEY Setup                        ║
╚══════════════════════════════════════════════════╝
    """)

def print_instructions():
    print("""
INSTRUÇÕES PARA OBTER IDs DO RAILWAY:

1. Acesse: https://railway.app/dashboard
2. Clique no seu projeto (ex: "accomplished-achievement")
3. Na URL, copie o ID do projeto:
   https://railway.app/project/[PROJECT_ID]

4. Vá para Settings → Variables
5. Copie o Environment ID se necessário

Variáveis de Ambiente:
- RAILWAY_TOKEN: Token API (https://railway.app/dashboard/tokens)
- RAILWAY_PROJECT_ID: ID do projeto
- RAILWAY_ENVIRONMENT_ID: "production" (padrão)

Exemplo de uso:
    set RAILWAY_TOKEN=your_token_here
    set RAILWAY_PROJECT_ID=your_project_id
    python configure_claude_vision.py
    """)

def verify_configuration():
    """Verifica se as configurações necessárias estão disponíveis"""
    print("\n📋 Verificando configuração...")

    checks = {
        '✓ ANTHROPIC_API_KEY': ANTHROPIC_API_KEY,
        '⚠ RAILWAY_TOKEN': RAILWAY_TOKEN or '(não configurado)',
        '⚠ RAILWAY_PROJECT_ID': RAILWAY_PROJECT_ID or '(não configurado)',
        'ℹ RAILWAY_ENVIRONMENT_ID': RAILWAY_ENVIRONMENT_ID,
    }

    for check, value in checks.items():
        status = '✓' if value != '(não configurado)' else '⚠'
        display = value[:20] + '...' if isinstance(value, str) and len(value) > 20 else value
        print(f"  {status} {check}: {display}")

    return bool(RAILWAY_TOKEN and RAILWAY_PROJECT_ID)

def configure_via_graphql():
    """Tenta configurar usando GraphQL API do Railway"""

    if not RAILWAY_TOKEN or not RAILWAY_PROJECT_ID:
        print("\n❌ RAILWAY_TOKEN ou RAILWAY_PROJECT_ID não configurados")
        print("   Não é possível usar API GraphQL")
        return False

    print(f"\n🔐 Configurando via GraphQL API...")

    # GraphQL Query para adicionar variável de ambiente
    query = """
    mutation VariableCreate($input: VariableCreateInput!) {
      variableCreate(input: $input) {
        variable {
          id
          name
          value
        }
      }
    }
    """

    variables = {
        "input": {
            "projectId": RAILWAY_PROJECT_ID,
            "environmentId": RAILWAY_ENVIRONMENT_ID,
            "name": "ANTHROPIC_API_KEY",
            "value": ANTHROPIC_API_KEY
        }
    }

    headers = {
        'Authorization': f'Bearer {RAILWAY_TOKEN}',
        'Content-Type': 'application/json'
    }

    payload = {
        'query': query,
        'variables': variables
    }

    try:
        response = requests.post(RAILWAY_API_URL, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            result = response.json()

            if 'errors' in result:
                print(f"❌ Erro na API: {result['errors']}")
                return False

            if 'data' in result and result['data'].get('variableCreate'):
                variable = result['data']['variableCreate']['variable']
                print(f"✅ Variável criada com sucesso!")
                print(f"   Nome: {variable['name']}")
                print(f"   ID: {variable['id']}")
                return True

        else:
            print(f"❌ Erro HTTP {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except requests.RequestException as e:
        print(f"❌ Erro de conexão: {e}")
        return False

def print_manual_instructions():
    """Exibe instruções para configuração manual"""

    print("""
╔══════════════════════════════════════════════════╗
║  CONFIGURAÇÃO MANUAL (Via Dashboard)            ║
╚══════════════════════════════════════════════════╝

Se a configuração automática não funcionou, faça manualmente:

1. Acesse: https://railway.app/dashboard

2. Clique no projeto Forte Solar
   (nome pode ser: "accomplished-achievement" ou similar)

3. Vá para aba "Variables" ou "Secrets"

4. Clique no botão "+ Add" ou "+ New Variable"

5. Preencha:
   - Nome da Variável: ANTHROPIC_API_KEY
   - Valor: (copie do arquivo .env local - NÃO COLOQUE AQUI POR SEGURANÇA)

6. Clique "Deploy" ou "Save & Deploy"

7. Aguarde o rebuild (2-5 minutos)

8. Teste a API:
   curl https://projetofrtsapp-production.up.railway.app/api/health

Quando a configuração estiver completa:
✅ mongodb: "connectado" (ou ainda "conectando")
✅ API retornará status "ok"
✅ Claude Vision estará ativo

    """)

# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    print_header()

    # Verificar configuração
    config_ok = verify_configuration()

    if not config_ok:
        print("\n⚠️  Configuração incompleta para API automática")
        print_instructions()
        print_manual_instructions()
    else:
        print("\n✅ Configuração detectada, tentando setup automático...")

        if configure_via_graphql():
            print("""
╔════════════════════════════════════════════╗
║  ✅ SUCESSO!                               ║
╚════════════════════════════════════════════╝

Próximas ações:
1. Railway fará rebuild em 2-5 minutos
2. Teste: curl https://projetofrtsapp-production.up.railway.app/api/health
3. Upload de novo datasheet para testar Claude Vision
            """)
        else:
            print_manual_instructions()

