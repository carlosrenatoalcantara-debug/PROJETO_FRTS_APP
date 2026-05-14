# 🚀 Guia Completo: Processamento de Lote de Pareceres

## 📋 Status

Você forneceu **122 arquivos PDF** de Parecer de Acesso de clientes reais (2022-2025).

**Próximo passo:** Executar o processamento automático para coletar dados de treinamento.

---

## 🎯 O Que Vai Acontecer

```
Você executa o script
       ↓
Script processa 122 PDFs em lote
       ↓
Gemini extrai dados de cada Parecer
       ↓
Sistema valida completude de cada extração
       ↓
Exemplos bem-sucedidos → arquivo de treinamento
       ↓
Relatório mostra taxa de sucesso e completude
       ↓
Quando atingir 50+ exemplos → exporta dados para fine-tuning
```

---

## ✅ Requisitos

- [x] Backend Node.js rodando (http://localhost:5005)
- [x] API parecer de acesso ativa
- [x] Google Gemini API configurada
- [x] Arquivo de lista dos PDFs criado

---

## 🚀 Como Executar

### Opção 1: Processar Todos os PDFs da Lista (RECOMENDADO)

```bash
cd C:\Users\Forte Solar\PROJETO_FRTS_APP\backend

# Ler a lista e processar todos os arquivos
node processarPareceresBatch.mjs @pareceres-lista.txt
```

**O que acontece:**
- Script lê cada linha do arquivo `pareceres-lista.txt`
- Processa cada PDF via API
- Mostra progresso em tempo real
- Ao final, exibe relatório completo
- Se atingir 50+ exemplos, automaticamente exporta dados

### Opção 2: Processar Selecionados

```bash
# Processar apenas alguns PDFs
node processarPareceresBatch.mjs \
  "C:\Users\Forte Solar\OneDrive\Forte Solar\4 - Instalados\2024\206 - Sarah Rodrigues Brasil\Cosern\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2409118802.pdf" \
  "C:\Users\Forte Solar\OneDrive\Forte Solar\4 - Instalados\2024\200 - Projeto Pipa (Rafael Heider)\Cosern\PARECER DE ACESSO PARA CONEXÃO DE MINI E MICROGERAÇÃO - 2409038083.pdf"
```

### Opção 3: Monitorar Progresso (Sem Processar)

```bash
# Apenas ver estatísticas atuais
curl http://localhost:5005/api/parecer-acesso/treinamento/estatisticas | jq
```

---

## 📊 O Que Você Verá Durante Execução

```
🚀 INICIANDO PROCESSAMENTO EM LOTE

ℹ️  Total de arquivos: 122
ℹ️  Endpoint: http://localhost:5005/api/parecer-acesso/extrair

✅ [1/122] PARECER - 2205195281.pdf - Completude: 94% ✓
✅ [2/122] PARECER - 2205124546.pdf - Completude: 92% ✓
✅ [3/122] PARECER - 2205134669.pdf - Completude: 89% ✓
⚠️  [4/122] PARECER - 2205104402.pdf - Dados insuficientes
❌ [5/122] PARECER - 2205053961.pdf - Arquivo não encontrado
...
```

---

## 📈 Após Conclusão: Relatório Esperado

```
📊 RESUMO DO PROCESSAMENTO

Total de arquivos:            122
✅ Processados com sucesso:   105
❌ Erros:                      17
📈 Taxa de sucesso:           86.1%
⭐ Completude média:          91.5%

📍 Distribuição por Distribuidora:
   - Cosern: 103 exemplos (completude média: 92%)
   - BNB: 2 exemplos (completude média: 85%)

✅ PRONTO PARA FINE-TUNING!
Você tem 105 exemplos coletados.

Distribuição:
   - Cosern: 103 (98%)
   - BNB: 2 (2%)

✨ PROCESSAMENTO CONCLUÍDO
```

---

## 🎯 Próximos Passos

### Após Processar Todos os PDFs:

**1. Verificar Estatísticas**
```bash
curl http://localhost:5005/api/parecer-acesso/treinamento/estatisticas | jq
```

**2. Ver Exemplos Coletados**
```bash
curl http://localhost:5005/api/parecer-acesso/treinamento/exemplos | jq
```

**3. Exportar para Fine-Tuning (Automático com 50+)**
```bash
# Ou manualmente:
curl -X POST http://localhost:5005/api/parecer-acesso/treinamento/exportar | jq
```

**4. Verificar Arquivo de Dados**
```bash
# Local: C:\Users\Forte Solar\PROJETO_FRTS_APP\backend\data\training-data\
ls -lh parecer-training-examples.jsonl
ls -lh gemini-tuning-data.json  # Arquivo exportado
```

---

## ⚠️ Se Houver Erros

### Arquivo não encontrado
**Causa:** Caminho inválido ou arquivo movido
**Solução:** Verificar se o arquivo existe no caminho especificado

### Timeout na API
**Causa:** PDFs muito grandes ou API lenta
**Solução:** Aumentar timeout no script (linha `timeout: 60000`)

### Dados insuficientes
**Causa:** Parecer com formato diferente (não conseguiu extrair dados)
**Solução:** Normal, alguns PDFs podem ter layouts únicos

### Taxa de completude baixa
**Causa:** Gemini não conseguiu extrair todos os campos
**Solução:** Ajustar prompt se necessário

---

## 📝 Arquivo de Lista

Criamos um arquivo com todos os 122 PDFs:
```
📁 backend/pareceres-lista.txt
   - 122 caminhos de arquivos
   - Um por linha
   - Pronto para processar
```

---

## 💡 Dicas de Otimização

### Para Processar Mais Rápido:
1. **Aumentar número de requisições paralelas** (modificar script)
2. **Desabilitar validação stricta** (menos checagens)
3. **Usar batch API** do Gemini (mais eficiente)

### Para Melhor Qualidade:
1. **Processar em velocidade normal** (500ms entre PDFs)
2. **Revisar exemplos com baixa completude** (<80%)
3. **Verificar distribuição por distribuidora**

---

## 🔍 Monitoramento em Tempo Real

Enquanto processa, em outro terminal:

```bash
# Terminal 1: Rodar processamento
cd C:\Users\Forte Solar\PROJETO_FRTS_APP\backend
node processarPareceresBatch.mjs @pareceres-lista.txt

# Terminal 2: Monitorar progresso (a cada 30 segundos)
watch -n 30 'curl -s http://localhost:5005/api/parecer-acesso/treinamento/estatisticas | jq'
```

---

## 📊 Métricas Esperadas

Com 122 PDFs Cosern:

| Métrica | Expectativa |
|---------|------------|
| Taxa de sucesso | 80-90% |
| Completude média | 88-94% |
| Exemplos coletados | 95-110 |
| Pronto para fine-tuning | ✅ Sim |
| Tempo total | 3-5 minutos |

---

## 🎓 O Que Acontece com os Dados

Todos os exemplos coletados vão para:
```
📁 backend/data/training-data/
   📄 parecer-training-examples.jsonl  (exemplos brutos)
   📄 gemini-tuning-data.json         (formatado para Gemini)
```

Formato de cada exemplo:
```json
{
  "input": "<PDF em base64>",
  "output": "{\"cliente\": {...}, \"instalacao\": {...}, ...}",
  "metadata": {
    "timestamp": "2026-05-14T15:30:00Z",
    "taxa_completude": 94,
    "distribuidora": "Cosern",
    "fase_tensao": "Trifásico"
  }
}
```

---

## 🚀 Executar Agora!

### Resumo dos comandos:

```bash
# 1. Ir para pasta backend
cd C:\Users\Forte Solar\PROJETO_FRTS_APP\backend

# 2. Executar processamento (vai demorar 3-5 min)
node processarPareceresBatch.mjs @pareceres-lista.txt

# 3. Quando terminar, verificar resultados
curl http://localhost:5005/api/parecer-acesso/treinamento/estatisticas | jq

# 4. Se tiver 50+ exemplos, você está pronto para fine-tuning!
```

---

## ✨ Resultado Final Esperado

Depois de processar 122 PDFs:

```
✅ ~105 exemplos coletados (86% taxa de sucesso)
✅ 91.5% de completude média
✅ Distribuição de distribuidoras: Cosern 98%, outros 2%
✅ PRONTO PARA FINE-TUNING do Gemini
✅ Arquivo de dados exportado: gemini-tuning-data.json
```

Quando estiver pronto, eu configure o fine-tuning no Gemini e você terá um modelo 100% customizado para seus Pareceres!

---

**Tempo estimado:** 5 minutos  
**Data:** 2026-05-14  
**Status:** Pronto para executar! 🚀
