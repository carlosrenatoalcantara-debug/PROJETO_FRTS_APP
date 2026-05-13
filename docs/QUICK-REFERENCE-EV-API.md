# ⚡ Quick Reference - API Endpoints EV com Normas

## Base URL
```
http://localhost:5005/api/projetos-ev
```

---

## 📋 Listar Todos os Projetos

```http
GET /
```

**Exemplo:**
```bash
curl http://localhost:5005/api/projetos-ev
```

**Resposta:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "nome": "Carregador Residencial",
    "status": "dimensionado",
    "calculos_nbr": { ... },
    "conformidade_norms": { ... }
  }
]
```

---

## 🔍 Buscar Projeto por ID

```http
GET /:id
```

**Exemplo:**
```bash
curl http://localhost:5005/api/projetos-ev/507f1f77bcf86cd799439012
```

---

## ➕ Criar Novo Projeto

```http
POST /
Content-Type: application/json

{
  "clienteId": "607f1f77bcf86cd799439020",
  "nome": "Novo Carregador EV",
  "tipo_carregamento": "AC"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:5005/api/projetos-ev \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "607f1f77bcf86cd799439020",
    "nome": "Carregador Sunset AP",
    "tipo_carregamento": "AC"
  }'
```

**Resposta:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "clienteId": "607f1f77bcf86cd799439020",
  "nome": "Carregador Sunset AP",
  "status": "rascunho",
  "normas_aplicadas": [
    "ABNT NBR 17019:2022",
    "ABNT NBR 5410:2004",
    "ABNT NBR IEC 61851-1:2021",
    "ABNT NBR IEC 62196-1/2/3:2021"
  ]
}
```

---

## 🧮 Simular Cálculos (SEM SALVAR)

```http
POST /:id/calcular-normas
Content-Type: application/json

{
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "tensao_sistema": 230,
  "fases": 1,
  "comprimento_cabo_m": 30,
  "resistencia_aterramento_ohms": 3.5
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:5005/api/projetos-ev/507f1f77bcf86cd799439012/calcular-normas \
  -H "Content-Type: application/json" \
  -d '{
    "carregadores": [{
      "tipo": "AC_Mono",
      "potencia_kw": 7
    }],
    "tensao_sistema": 230,
    "comprimento_cabo_m": 30,
    "resistencia_aterramento_ohms": 3.5
  }'
```

**Resposta (Cálculos Detalhados):**
```json
{
  "calculos_nbr": {
    "corrente_projeto_a": 40,
    "corrente_maxima_a": 38.04,
    "bitola_cabo_mm2": 16,
    "disjuntor_a": 50,
    "dr_ma": 30,
    "queda_tensao_pct": 2.6
  },
  "conformidade_norms": {
    "corrente_ok": true,
    "bitola_ok": true,
    "queda_tensao_ok": true,
    "disjuntor_ok": true,
    "dr_ok": true,
    "aterramento_ok": true,
    "spda_necessario": false,
    "conforme": true
  },
  "detalhes": {
    "corrente": {
      "corrente_calculada": 38.04,
      "corrente_comercial": 40,
      "fator_seguranca": 1.25
    },
    "bitola": {
      "bitola_mm2": 16,
      "queda_tensao_real": 2.6,
      "queda_tensao_ok": true
    },
    "disjuntor": {
      "disjuntor_a": 50,
      "curva_recomendada": "C"
    },
    "aterramento": {
      "resistencia_medida": 3.5,
      "conforme": true,
      "status": "✓ Excelente"
    }
  }
}
```

---

## 💾 Atualizar Projeto (COM AUTO-CÁLCULO)

```http
PUT /:id
Content-Type: application/json

{
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "modo_operacao": 1,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "tensao_sistema": 230,
  "fases": 1,
  "comprimento_cabo_m": 30,
  "resistencia_aterramento_ohms": 3.5,
  "status": "dimensionado"
}
```

**Exemplo cURL:**
```bash
curl -X PUT http://localhost:5005/api/projetos-ev/507f1f77bcf86cd799439012 \
  -H "Content-Type: application/json" \
  -d '{
    "carregadores": [{
      "tipo": "AC_Mono",
      "potencia_kw": 7
    }],
    "tensao_sistema": 230,
    "comprimento_cabo_m": 30,
    "resistencia_aterramento_ohms": 3.5,
    "status": "dimensionado"
  }'
```

**Resposta (Projeto Atualizado COM Cálculos):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "nome": "Carregador Residencial",
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    ...
  }],
  "modo_operacao": 1,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "calculos_nbr": {
    "corrente_projeto_a": 40,
    "bitola_cabo_mm2": 16,
    "disjuntor_a": 50,
    "dr_ma": 30,
    "queda_tensao_pct": 2.6
  },
  "conformidade_norms": {
    "corrente_ok": true,
    "bitola_ok": true,
    "queda_tensao_ok": true,
    "disjuntor_ok": true,
    "dr_ok": true,
    "aterramento_ok": true,
    "conforme": true
  },
  "resistencia_aterramento_conformidade": "✓ Excelente"
}
```

---

## 📄 Exportar PDF com Diagrama

```http
GET /:id/pdf
```

**Exemplo:**
```bash
curl http://localhost:5005/api/projetos-ev/507f1f77bcf86cd799439012/pdf \
  -o diagrama_unifilar.pdf
```

---

## 🗑️ Deletar Projeto

```http
DELETE /:id
```

**Exemplo:**
```bash
curl -X DELETE http://localhost:5005/api/projetos-ev/507f1f77bcf86cd799439012
```

---

## 👥 Listar Projetos por Cliente

```http
GET /cliente/:clienteId
```

**Exemplo:**
```bash
curl http://localhost:5005/api/projetos-ev/cliente/607f1f77bcf86cd799439020
```

---

## 📊 Exemplos de Payload Completo

### Exemplo 1: Residência 7kW (Modo 1)

```json
{
  "clienteId": "607f1f77bcf86cd799439020",
  "nome": "Residencial - Sunset AP 1701-B",
  "tipo_carregamento": "AC",
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "modo_operacao": 1,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "tensao_sistema": 230,
  "fases": 1,
  "frequencia_hz": 60,
  "comprimento_cabo_m": 30,
  "resistencia_aterramento_ohms": 3.5,
  "status": "dimensionado"
}
```

### Exemplo 2: Condomínio 11kW (Modo 3)

```json
{
  "clienteId": "607f1f77bcf86cd799439020",
  "nome": "Condomínio - Garagem A",
  "tipo_carregamento": "AC",
  "carregadores": [{
    "tipo": "AC_Tri",
    "potencia_kw": 11,
    "marca": "Tesla",
    "modelo": "Wall Connector",
    "quantidade": 2,
    "tensao_entrada_v": 400,
    "corrente_entrada_a": 32
  }],
  "modo_operacao": 3,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "tensao_sistema": 400,
  "fases": 3,
  "frequencia_hz": 60,
  "comprimento_cabo_m": 50,
  "resistencia_aterramento_ohms": 5.5,
  "status": "dimensionado"
}
```

### Exemplo 3: Recarga Rápida DC (Modo 4)

```json
{
  "clienteId": "607f1f77bcf86cd799439020",
  "nome": "Estação Rápida - Pátio Forte Solar",
  "tipo_carregamento": "DC",
  "carregadores": [{
    "tipo": "DC",
    "potencia_kw": 50,
    "marca": "Elgin",
    "modelo": "Fast Charge 50",
    "quantidade": 1,
    "tensao_entrada_v": 920,
    "corrente_entrada_a": 100
  }],
  "modo_operacao": 4,
  "tipo_conector": "CCS (Combined Charging System)",
  "tensao_sistema": 400,
  "fases": 3,
  "frequencia_hz": 60,
  "comprimento_cabo_m": 20,
  "resistencia_aterramento_ohms": 2.0,
  "status": "dimensionado"
}
```

---

## ✅ Validação de Resposta

Após salvar com PUT, verifique sempre:

```javascript
if (projeto.conformidade_norms.conforme) {
  console.log('✅ Projeto conforme com todas as normas!')
} else {
  console.log('❌ Projeto não conforme:')
  if (!projeto.conformidade_norms.queda_tensao_ok) {
    console.log('   - Queda de tensão > 3%')
  }
  if (!projeto.conformidade_norms.aterramento_ok) {
    console.log('   - Aterramento > 10Ω')
  }
}
```

---

## 🔧 HTTP Status Codes

| Código | Significado |
|--------|-------------|
| 200 | OK - Operação bem-sucedida |
| 201 | CREATED - Projeto criado |
| 400 | Bad Request - Dados inválidos |
| 404 | Not Found - Projeto não encontrado |
| 500 | Server Error - Erro no servidor |

---

## 📝 Campos Obrigatórios

### Ao Criar (POST)
- `clienteId` (ObjectId válido)
- `nome` (string)

### Ao Calcular (POST /calcular-normas)
- `carregadores[0].potencia_kw` (number)
- `tensao_sistema` (number, padrão: 230)
- `comprimento_cabo_m` (number, padrão: 30)

### Ao Atualizar (PUT)
- Todos os campos que deseja alterar
- Os cálculos acontecem automaticamente se mudar dados relevantes

---

## 🎯 Fluxo Recomendado para Frontend

```javascript
// 1. Criar projeto
const projeto = await criar({
  clienteId: client._id,
  nome: 'Novo Carregador'
})

// 2. Preencher dados (simular sem salvar)
const preview = await simularCalculos(projeto._id, {
  carregadores: [{ tipo: 'AC_Mono', potencia_kw: 7 }],
  tensao_sistema: 230,
  comprimento_cabo_m: 30,
  resistencia_aterramento_ohms: 3.5
})

// 3. Mostrar preview ao usuário
if (preview.conformidade_norms.conforme) {
  mostrarSucesso('✅ Conforme com normas!')
} else {
  mostrarErro('❌ Não conforme - ajuste os parâmetros')
}

// 4. Se OK, salvar definitivamente
const projetoSalvo = await salvar(projeto._id, {
  carregadores: [...],
  // ... dados
})

// 5. Projeto agora tem cálculos_nbr e conformidade_norms preenchidos
console.log(projetoSalvo.calculos_nbr)
console.log(projetoSalvo.conformidade_norms)
```

---

**Última Atualização:** 2026-05-13  
**Versão:** 1.0
