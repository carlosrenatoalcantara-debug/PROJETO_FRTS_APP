# 📋 ATUALIZAÇÕES RECENTES - EXTRAÇÃO PDF E BENEFICIÁRIAS

## ✅ CORREÇÕES IMPLEMENTADAS (2026-04-24)

---

## 1️⃣ PARSER PDF - EXTRAÇÃO DE ENDEREÇO CORRIGIDA

**Arquivo:** `backend/src/controllers/faturaController.js`

### Problema Original
- Estava extraindo endereço da **COSERN** (distribuidora)
- Incorreto: "RUA MERMOZ, 150, BALDO"

### Solução Implementada
```javascript
function extrairEndereco(texto) {
  // Ignora linhas da distribuidora
  if (linha.includes('COMPANHIA ENERGÉTICA') ||
      linha.includes('RUA MERMOZ') ||
      linha.includes('BALDO')) {
    continue
  }

  // Procura por "ENDEREÇO:" do cliente
  // Valida: contém logradouro + número
  // Retorna: endereço completo formatado
}
```

### Resultado
- ✅ Extrai endereço do cliente: "RUA JOAQUIM EDUARDO DE FARIAS 209 AP-1701"
- ✅ Ignora endereço da distribuidora
- ✅ Auto-preenche E3 Localização

---

## 2️⃣ BENEFICIÁRIAS - FORMULÁRIO SIMPLIFICADO

**Arquivos Modificados:**
- `backend/src/models/UnidadeBeneficiaria.js`
- `backend/src/controllers/beneficiariasController.js`
- `frontend/src/components/fv/etapas/E2BBeneficiarias.jsx`

### Antes (Complexo)
```json
{
  "contaContrato": "123456789",
  "endereco": "Rua X",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01000-000",
  "consumoMensal": 350,
  "tipo": "beneficiaria"
}
```

### Depois (Simples)
```json
{
  "contaContrato": "123456789",
  "tipoRateio": "percentual" | "prioridade",
  "valor": 50  // 50% ou prioridade #50
}
```

### Campos do Formulário
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Número da Conta/Contrato | text | Identificação única |
| Tipo de Rateio | radio | "Percentual" ou "Prioridade" |
| Valor | number | % (0-100) ou Ordem (1,2,3...) |

### Validações Backend
- ✅ Percentual: soma de todos ≤ 100%
- ✅ Prioridade: valores inteiros positivos
- ✅ Conta/Contrato: obrigatório e único por projeto

---

## 3️⃣ TABELA DE BENEFICIÁRIAS - NOVA VISUALIZAÇÃO

**Componente:** `E2BBeneficiarias.jsx`

### Colunas da Tabela
```
| Conta/Contrato | Tipo de Rateio | Valor | Ações |
|---|---|---|---|
| 123456789 | Percentual | 50% | ✏️ 🗑️ |
| 987654321 | Prioridade | #1 | ✏️ 🗑️ |
```

### Resumo Visual
- Número de beneficiárias registradas
- Barra de progresso de percentuais (se aplicável)
- Cores por tipo: Azul (Percentual), Laranja (Prioridade)

---

## 4️⃣ AUTO-PREENCHIMENTO DE ENDEREÇO

**Componente:** `E3Localizacao.jsx`

### Fluxo
1. **E1 (Fatura PDF)**
   - Extrai endereço do cliente
   - Dispara `SET_LOCALIZACAO` com campo `endereco`

2. **E3 (Localização)**
   - Campo de endereço pré-preenchido
   - Usuário clica em "Buscar" para geocodificar
   - Sistema encontra lat/lon e cidade/estado

---

## 5️⃣ TIPOS DE RATEIO EXPLICADOS

### Percentual (Recomendado)
- Divide a energia gerada proporcionalmente
- Exemplo: 50%, 30%, 20%
- Ideal para: múltiplas beneficiárias com consumos variados
- ⚠️ Soma deve ser ≤ 100%

### Prioridade
- Abastece beneficiárias em ordem
- Exemplo: #1 (primeira), #2 (segunda), #3 (terceira)
- Ideal para: hierarquia clara de consumo
- Casos de uso: matriz → filial → parente

---

## 📊 FLUXO COM BENEFICIÁRIAS SIMPLIFICADO

```
E1 (Fatura)
  ↓ Extrai: consumo, histórico, endereço, distribuidora
  ↓
E2 (Consumo)
  ↓ Gráfico com 12 meses
  ↓
E2.5 (Beneficiárias) ← SIMPLES: Conta | Tipo Rateio | Valor
  ↓
E3 (Localização)
  ↓ Endereço pré-preenchido
  ↓
E4 (Irradiância)
  ↓
E5 (Dimensionamento)
  ↓
E6 (Área)
  ↓
E7 (Equipamentos)
  ↓
E8 (Orçamento)
  ↓
[Homologação com beneficiárias incluídas]
```

---

## 🔧 TESTES RECOMENDADOS

### Parser PDF
```bash
# Extrair dados com novo parser
curl -X POST http://localhost:5000/api/fatura/extrair \
  -F "fatura=@fatura_cosern.pdf"

# Validar resposta inclui:
# - consumoKwh (da média ou extraído)
# - endereco (do cliente, não da distribuidora)
# - historico12Meses (array com JAN-DEZ)
```

### Beneficiárias
```bash
# Criar percentual
curl -X POST http://localhost:5000/api/projetos-fv/{id}/beneficiarias \
  -H "Content-Type: application/json" \
  -d '{
    "contaContrato": "123456789",
    "tipoRateio": "percentual",
    "valor": 50
  }'

# Validação: soma percentuais ≤ 100%
```

---

## 📝 NOTAS DE IMPLEMENTAÇÃO

1. **Endereço Extraído**
   - Ignorado: linhas com "COMPANHIA ENERGÉTICA", "RUA MERMOZ"
   - Validado: contém logradouro + número
   - Formatado: espaços múltiplos removidos

2. **Tipo de Rateio**
   - Percentual: ideal para divisão igualitária
   - Prioridade: ideal para encadeamento de consumos

3. **Homologação**
   - Formulário de beneficiárias compatível
   - Dados transmitidos para concessionária conforme regulamentação

---

**Status:** ✅ Pronto para produção
**Testado em:** localhost:3006 | localhost:5000
**Data:** 2026-04-24
