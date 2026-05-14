# Sistema de Treinamento Automático - Parecer de Acesso

## 📚 Visão Geral

Sistema automático que coleta exemplos de Parecer de Acesso validados durante o uso normal da aplicação e prepara dados para fine-tuning do Gemini.

---

## 🔄 Fluxo de Coleta de Dados

```
1. Usuário faz upload de Parecer PDF
   ↓
2. Gemini extrai dados estruturados
   ↓
3. Sistema valida qualidade da extração
   ↓
4. Se válido → Adiciona ao conjunto de treinamento
   ↓
5. Coleta métricas e estatísticas
   ↓
6. Quando atinge 50 exemplos → Pronto para fine-tuning
```

---

## 📊 Monitorar Progresso de Treinamento

### 1. Ver Estatísticas em Tempo Real

```bash
# Terminal - Node.js
node -e "
import('./backend/src/config/trainingDataCollector.js').then(m => {
  console.log(m.estatisticasTreinamento());
});
"
```

### 2. Acessar via API

```bash
# GET /api/parecer-acesso/treinamento/estatisticas
curl http://localhost:5005/api/parecer-acesso/treinamento/estatisticas
```

**Resposta:**
```json
{
  "status": "⏳ Em Coleta",
  "total_exemplos": 15,
  "faltam_exemplos": 35,
  "taxa_media_completude": 92.5,
  "distribuicao": {
    "Cosern": {
      "count": 12,
      "avg_completude": "94"
    },
    "CELPE": {
      "count": 3,
      "avg_completude": "88"
    }
  },
  "ultimoExemplo": "2026-05-14T14:30:00.000Z"
}
```

### 3. Listar Exemplos Coletados

```bash
# GET /api/parecer-acesso/treinamento/exemplos
curl http://localhost:5005/api/parecer-acesso/treinamento/exemplos
```

**Resposta:**
```json
{
  "total": 15,
  "exemplos": [
    {
      "numero": 1,
      "completude": 94,
      "distribuidora": "Cosern",
      "fase": "Monofásico",
      "timestamp": "2026-05-14T10:15:00.000Z"
    },
    {
      "numero": 2,
      "completude": 92,
      "distribuidora": "Cosern",
      "fase": "Trifásico",
      "timestamp": "2026-05-14T10:30:00.000Z"
    }
  ],
  "caminhoArquivo": "/app/data/training-data/parecer-training-examples.jsonl",
  "statusTreinamento": "⏳ 35 exemplos ainda necessários"
}
```

---

## 🎯 Fases do Treinamento

### Fase 1: Coleta de Dados (Atual)

**Objetivo:** Coletar 50+ exemplos validados de Parecer

**Critérios:**
- ✅ Taxa de completude ≥ 80%
- ✅ Todos os campos críticos preenchidos
- ✅ Diversidade de distribuidoras (Cosern, CELPE, CEEE, etc)
- ✅ Mix de monofásico e trifásico

**Tempo Estimado:** 2-3 semanas de uso normal

**Como Acelerar:**
1. Você fornece Parecer de Acesso (50+)
2. Sistema processa automaticamente
3. Coleta exemplos em paralelo

### Fase 2: Validação e Exportação

**Objetivo:** Preparar dados no formato Gemini

**Ações:**
```bash
# Exportar dados para fine-tuning
curl -X POST http://localhost:5005/api/parecer-acesso/treinamento/exportar

# Resultado:
# ✅ Dados exportados para fine-tuning
# ✅ Arquivo: /app/data/training-data/gemini-tuning-data.json
# ✅ Total de exemplos: 52
# ✅ Distribuição:
#    - Cosern: 35 exemplos (67%)
#    - CELPE: 12 exemplos (23%)
#    - CEEE: 5 exemplos (10%)
```

### Fase 3: Fine-Tuning do Gemini

**Quando:** Após coletar 50+ exemplos com ≥90% completude média

**Processo:**
```javascript
// 1. Preparar dados
const dados = await exportarParaTreinamento()

// 2. Criar tuning job no Gemini
const tuningJob = await client.models.createTunedModel({
  displayName: "Parecer-Acesso-Extractor-v2",
  baseModel: "models/gemini-2.0-flash",
  trainingData: dados.arquivos,
  hyperParameters: {
    epochCount: 3,
    batchSize: 1,
    learningRate: 0.001
  }
})

// 3. Monitorar progresso
const status = await client.models.getTunedModel(tuningJob.name)
console.log(`Status: ${status.state}`)

// 4. Usar modelo em produção
const model = client.getGenerativeModel({
  model: tuningJob.name // "tunedModels/parecer-..."
})
```

### Fase 4: Deploy do Modelo Treinado

Após conclusão do fine-tuning:

1. Atualizar `pareceracessoController.js`:
```javascript
const model = client.getGenerativeModel({ 
  model: 'tunedModels/parecer-acesso-extractor-v2' 
})
```

2. Testar com novos Parecer
3. Monitorar taxa de sucesso (target: >98%)
4. Ajustar conforme necessário

---

## 📈 Métricas de Qualidade

### Taxa de Completude

```
Taxa = (Campos Preenchidos / Campos Totais) × 100

Excelente:  ≥ 95% (95-100 pontos)
Bom:        85-94% (85-94 pontos)
Aceitável:  75-84% (75-84 pontos)
Insuficiente: < 75% (menos de 75 pontos)
```

**Campos Considerados:**
1. cliente.nome
2. cliente.cpf_cnpj
3. instalacao.numero_cliente
4. instalacao.distribuidora
5. instalacao.fase_tensao
6. equipamento.paineis.marca
7. equipamento.paineis.modelo
8. equipamento.paineis.potencia_w
9. equipamento.quantidade_paineis
10. equipamento.inversor.marca
11. equipamento.inversor.modelo
12. equipamento.inversor.potencia_kw

### Distribuição por Distribuidora

```
Cosern:   35+ exemplos (40-50%)
CELPE:    15+ exemplos (20-30%)
CEEE:     10+ exemplos (15-20%)
Outras:   5+ exemplos  (5-10%)
```

**Importância:** Garante que modelo funciona com diferentes formatos

---

## 🛠️ Implementação Técnica

### Arquivo de Dados (JSONL)

**Localização:** `backend/data/training-data/parecer-training-examples.jsonl`

**Formato:** One JSON object per line (JSON Lines)

```jsonl
{"input": "JVBERi0xLjQKJeLj...", "output": "{\"cliente\": {...}}", "metadata": {...}}
{"input": "JVBERi0xLjQKJeLj...", "output": "{\"cliente\": {...}}", "metadata": {...}}
```

### Estrutura de Dados

```javascript
// Cada exemplo contém:
{
  // PDF codificado em base64
  "input": "JVBERi0xLjQKJeLj...",
  
  // JSON estruturado extraído
  "output": "{\"cliente\": {\"nome\": \"...\", ...}, ...}",
  
  // Metadados
  "metadata": {
    "timestamp": "2026-05-14T14:30:00Z",
    "taxa_completude": 94,
    "avisos": ["Email não encontrado"],
    "distribuidora": "Cosern",
    "fase_tensao": "Monofásico"
  }
}
```

### Validação Automática

Critérios para aceitar exemplo:

```javascript
const validacao = validarExtracao(dados)

if (!validacao.valido) {
  // Rejeita: Campos críticos faltando
  return false
}

if (validacao.taxa_completude < 75) {
  // Aviso: Completude baixa
  console.warn("⚠️  Exemplo com completude baixa")
}

// Aceita e adiciona ao conjunto
adicionarExemploTreinamento(pdf, dados, validacao)
```

---

## 📋 Checklist de Uso

### Semana 1-2
- [ ] Processar 5-10 Parecer
- [ ] Verificar métricas: `GET /api/parecer-acesso/treinamento/estatisticas`
- [ ] Confirmar que exemplos estão sendo coletados
- [ ] Revisar taxa de completude média (target: ≥90%)

### Semana 3-4
- [ ] Processar 20-30 Parecer (mínimo 50 total)
- [ ] Analisar distribuição por distribuidora
- [ ] Verificar se faltam certos tipos de Parecer
- [ ] Exportar dados: `POST /api/parecer-acesso/treinamento/exportar`

### Semana 5+
- [ ] Ter 50+ exemplos com ≥90% completude
- [ ] Iniciar fine-tuning no Gemini
- [ ] Monitorar progresso do treinamento
- [ ] Testar modelo treinado em produção

---

## 🚀 Como Usar (Passo a Passo)

### 1. Processar Pareceres Normalmente

```
Usuário → Upload Parecer PDF → Sistema extrai e valida
→ Exemplo adicionado automaticamente ao conjunto de treinamento
```

### 2. Acompanhar Progresso

```bash
# Comando para verificar status
curl http://localhost:5005/api/parecer-acesso/treinamento/estatisticas | jq
```

**Outputs esperados:**

```
Etapa 1: "⏳ Em Coleta" - 15/50 exemplos
Etapa 2: "⏳ Em Coleta" - 35/50 exemplos
Etapa 3: "✅ Pronto para Fine-Tuning" - 52/50 exemplos
```

### 3. Exportar quando pronto

```bash
curl -X POST http://localhost:5005/api/parecer-acesso/treinamento/exportar
```

### 4. Iniciar Fine-Tuning

Com o arquivo exportado, seguir documentação Gemini API para:
- Criar tuning job
- Monitorar progresso
- Deploy do novo modelo

---

## 🔍 Troubleshooting

### Exemplos não estão sendo coletados

```javascript
// Verificar se validação está rejeitando
console.log(validacao.erros)
console.log(validacao.taxa_completude)

// Possíveis causas:
// - Taxa de completude < 75%
// - Campos críticos faltando (nome cliente, número cliente, marca painel)
// - Formato de CPF/CNPJ inválido
```

### Taxa de completude muito baixa

```
Possíveis soluções:
1. Melhorar prompt do Gemini (ajustar instruções)
2. Fornecer mais exemplos de diferentes distribuidoras
3. Revisar Parecer com campos faltando (pode ser formato novo)
4. Atualizar regex de validação se necessário
```

### Arquivo JSONL muito grande

```bash
# Comprimir dados de treinamento
gzip parecer-training-examples.jsonl

# Ou limpar exemplos antigos
# (Manter apenas últimos 3 meses)
```

---

## 📞 Próximos Passos

Quando tiver 50+ Parecer prontos para treinar:

1. **Me avise** que quer fazer o fine-tuning
2. **Forneça** os Parecer de Acesso
3. **Sistema coleta** automaticamente os exemplos
4. **Quando pronto** → Inicia treinamento
5. **Depois** → Deploy do novo modelo

---

## 📚 Referências

- Documentação Gemini API: https://ai.google.dev/docs/
- Fine-tuning Guide: https://ai.google.dev/docs/tuning
- JSONL Format: https://jsonlines.org/

