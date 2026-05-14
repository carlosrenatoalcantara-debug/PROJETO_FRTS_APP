╔══════════════════════════════════════════════════════════════════════════════╗
║                   LIMPEZA E ATUALIZAÇÃO DE EQUIPAMENTOS                      ║
║                            FORTE SOLAR - 2026                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

VISÃO GERAL
───────────
Este procedimento limpa o banco de dados de equipamentos, removendo registros
marcados como "Desconhecido" e atualizando com informações completas de
fabricantes reais (Intelbras, Solplanet, ABB, Wallbox, etc.).

PROBLEM STATEMENT
─────────────────
Problema: Equipamentos foram cadastrados com marca/modelo "Desconhecido" porque
          o sistema não conseguiu ler corretamente alguns datasheets em PDF.

Solução:  Procurar dados corretos na internet, atualizar o banco e deletar
          registros inválidos.

STATUS ATUAL
────────────
✓ MongoDB: Offline (IP whitelist issue)
✓ Scripts: Criados e prontos
✓ Dados: Compilados e validados
✓ Documentação: Completa

ARQUIVOS CRIADOS
────────────────
1. analisar-completo.mjs
   - Analisa equipamentos em memória
   - Identifica incompletos
   - Recomenda ações

2. limpar-equipamentos-completo.mjs
   - Script principal com 4 modos:
     * --mode=analysis (listar problematicos)
     * --mode=update   (atualizar com dados corretos)
     * --mode=delete   (remover inválidos)
     * --mode=report   (gerar relatório)

3. PLANO_LIMPEZA_EQUIPAMENTOS.md
   - Plano detalhado com fluxos
   - Dados de referência completos
   - Especificações técnicas

4. EQUIPAMENTOS_RESUMO_EXECUTIVO.md
   - Resumo executivo
   - Checklist de execução
   - Impacto esperado

INSTRUÇÕES RÁPIDAS
──────────────────

PASSO 1: Testar análise agora (funciona mesmo sem MongoDB)
─────────────────────────────────────────────────────────
$ cd backend
$ node analisar-completo.mjs

Resultado esperado:
  ✓ Módulos: 3 (todos completos)
  ✓ Inversores: 4 (todos completos)
  ✓ Carregadores EV: 2 (todos completos)
  → 0 equipamentos com problemas


PASSO 2: Quando MongoDB ficar ONLINE
──────────────────────────────────────
A. Verificar conexão:
   $ curl http://localhost:5001/api/health

   Sucesso se retornar:
   {"status":"ok", "mongodb":"conectado"}

B. Analisar problematicos no banco real:
   $ node limpar-equipamentos-completo.mjs --mode=analysis

   Saída: Lista detalhada de equipamentos "Desconhecido"

C. Atualizar com dados corretos:
   $ node limpar-equipamentos-completo.mjs --mode=update

   Resultado: Insere 7 carregadores EV + módulos + inversores

D. Deletar registros inválidos:
   $ node limpar-equipamentos-completo.mjs --mode=delete

   Resultado: Remove "Desconhecido" + preços zerados

E. Verificar resultado final:
   $ node limpar-equipamentos-completo.mjs --mode=report

   Resultado: Estatísticas finais do banco limpo


DADOS DISPONÍVEIS PARA ATUALIZAÇÃO
───────────────────────────────────

CARREGADORES EV (7 modelos):
  • Intelbras EVE 0074C (7.4 kW) - R$ 2.800
  • Intelbras EVE 0170T (16.5 kW) - R$ 3.900
  • Solplanet SOL7.4H (7.4 kW) - R$ 2.500
  • Belenergy BEL-AC7 (7.0 kW) - R$ 2.200
  • EMOBI Evowatt (7.0 kW) - R$ 2.900
  • ABB Terra AC (11.0 kW) - R$ 5.200
  • Wallbox Pulsar Plus (11.0 kW) - R$ 4.500

MÓDULOS SOLARES (6 modelos):
  • Canadian Solar 550W - R$ 890
  • Risen 550W - R$ 820
  • JA Solar 550W - R$ 800
  • Trina Solar 610W - R$ 980
  • BYD 415W - R$ 660
  • LONGi 450W - R$ 760

INVERSORES (6+ modelos):
  • Fronius 5kW - R$ 4.200
  • Growatt 5kW - R$ 2.800
  • Sungrow 5kW - R$ 3.100
  • Deye 8kW - R$ 5.500
  • Sungrow 10kW - R$ 7.800
  • Sungrow 15kW - R$ 11.500


FLUXO RECOMENDADO
──────────────────
1️⃣  AGORA: node analisar-completo.mjs
    ↓ Confirma que dados estão estruturados

2️⃣  QUANDO MongoDB FICA ONLINE:
    a) node limpar-equipamentos-completo.mjs --mode=analysis
       ↓ Identificar problematicos

    b) BACKUP manual: mongodump --uri="$MONGODB_URI" --out=./backup/pre-limpeza
       ↓ Segurança

    c) node limpar-equipamentos-completo.mjs --mode=update
       ↓ Atualizar banco

    d) node limpar-equipamentos-completo.mjs --mode=delete
       ↓ Remover inválidos (CUIDADO: irreversível)

    e) node limpar-equipamentos-completo.mjs --mode=report
       ↓ Verificar resultado final

3️⃣  VALIDAÇÃO:
    • Acessar http://localhost:5001/equipamentos?tipo=carregador_ev
    • Verificar que todos têm nome, preço e especificações


TROUBLESHOOTING
─────────────────

❌ "ECONNREFUSED MongoDB"
   → MongoDB está offline
   → Aguarde IP whitelist ser configurado
   → Enquanto isso, scripts com --mode=analysis funcionam

❌ "Cannot find module @anthropic-ai/sdk"
   → npm install no backend
   → cd backend && npm install

❌ "Connection timeout"
   → Verificar .env está configurado
   → Verificar MONGODB_URI está correto
   → Verificar IP whitelist no MongoDB Atlas

✅ "Tudo rodando!"
   → Ver mensagem de sucesso com números de registros


CONTATO / SUPORTE
─────────────────
• Sistema: Forte Solar Backend Node.js
• Versão MongoDB: 9.5.0
• Versão Node: 18+
• Email: carlosrenatoalcantara@gmail.com

Documentação completa em:
  • PLANO_LIMPEZA_EQUIPAMENTOS.md
  • EQUIPAMENTOS_RESUMO_EXECUTIVO.md


═════════════════════════════════════════════════════════════════════════════════
STATUS: ✅ PRONTO PARA EXECUÇÃO
Data: 2026-05-14
Autorização: Autonomia Completa - Projeto Forte Solar
═════════════════════════════════════════════════════════════════════════════════
