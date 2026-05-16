# ✅ Correção da Integração de Projetos EV

## 📋 Problema Identificado

Os projetos Elétrico-Veicular (EV) tinham carregadores selecionados (7kW mínimo) mas:
- **Potência total**: exibida como 0 kW
- **Quantidade de pontos**: exibida como 0
- **Dados não sincronizados** entre frontend e banco de dados

## 🔍 Causa Raiz

### Frontend (Funcionando Corretamente ✅)
- `NovaPropostaEV.jsx` estava enviando corretamente:
  - `carregadores: [...]`
  - `quantidade_pontos: carregadores.length`
  - `potencia_total_kw: carregadores.reduce(...)`
  - `calculos_nbr: {...}`

### Backend (Ignorando Dados ❌)
- `projetosEVController.js` - Função `criarProjetoEV()` estava:
  - Recebendo os dados
  - Salvando APENAS: `clienteId`, `nome`, `tipo_carregamento`, `status`
  - Descartando: potência, carregadores, cálculos, endereço, etc.

## ✨ Soluções Implementadas

### 1️⃣ Backend - Atualizar Projeto (Criar)
**Arquivo:** `backend/src/controllers/projetosEVController.js`

- Modificada função `criarProjetoEV()` para:
  - Aceitar e salvar TODOS os dados enviados pelo frontend
  - Preservar `carregadores`, `quantidade_pontos`, `potencia_total_kw`
  - Salvar `calculos_nbr`, `endereco_completo`, `tecnico`, etc.
  - Usar status do frontend ("dimensionado") em vez de hardcoded "rascunho"

```javascript
// ANTES: Ignorava dados
const novo = new ProjetoEV({
  clienteId, nome, tipo_carregamento, status: 'rascunho'
})

// DEPOIS: Salva todos os dados
const novoProjetoData = {
  clienteId, nome, tipo_carregamento,
  status: req.body.status || 'rascunho',
  ...(req.body.carregadores && { carregadores: req.body.carregadores }),
  ...(req.body.quantidade_pontos && { quantidade_pontos: req.body.quantidade_pontos }),
  ...(req.body.potencia_total_kw && { potencia_total_kw: req.body.potencia_total_kw }),
  ...(req.body.calculos_nbr && { calculos_nbr: req.body.calculos_nbr }),
  // ... mais campos
}
```

### 2️⃣ Backend - Atualizar Projeto (Editar)
**Arquivo:** `backend/src/controllers/projetosEVController.js`

- Modificada função `atualizarProjetoEV()` para:
  - Recalcular automaticamente `quantidade_pontos` e `potencia_total_kw` quando carregadores mudam
  - Manter integridade dos dados

```javascript
// Se carregadores são atualizados, recalcular automaticamente
if (dadosAtualizacao.carregadores && Array.isArray(dadosAtualizacao.carregadores)) {
  const quantidade_pontos = dadosAtualizacao.carregadores.length
  const potencia_total_kw = dadosAtualizacao.carregadores.reduce(
    (sum, c) => sum + ((c.potencia_kw || 0) * (c.quantidade || 1)), 0
  )
  dadosAtualizacao.quantidade_pontos = quantidade_pontos
  dadosAtualizacao.potencia_total_kw = potencia_total_kw
}
```

### 3️⃣ Backend - Endpoint de Manutenção
**Arquivo:** `backend/src/controllers/projetosEVController.js` + `routes/projetosEV.js`

Nova função `recalcularPotenciasProjetosEV()` para:
- Corrigir dados históricos
- Recalcular potências de TODOS os projetos existentes
- Endpoint: `POST /api/projetos-ev/manutencao/recalcular-potencias`

### 4️⃣ Script de Manutenção
**Arquivo:** `backend/recalcularPotenciasEV.mjs`

Utility script para executar a recalcular offline:

```bash
node recalcularPotenciasEV.mjs
```

## 🚀 Como Usar

### Opção 1: Corrigir Dados Históricos via Endpoint
```bash
curl -X POST http://localhost:5005/api/projetos-ev/manutencao/recalcular-potencias
```

### Opção 2: Corrigir via Script Node.js
```bash
cd backend
node recalcularPotenciasEV.mjs
```

### Novo Fluxo - Criar Projeto
1. ✅ Frontend coleta carregadores + potência
2. ✅ Frontend envia dados ao backend
3. ✅ Backend salva TUDO no MongoDB
4. ✅ Tabela ProjetosEV exibe dados corretos

## 📊 Antes vs Depois

### ANTES ❌
```
Projeto | Cliente | Pontos | Potência | Status
AP 1801 | Ricardo | 0      | 0 kW     | Rascunho
```

### DEPOIS ✅
```
Projeto | Cliente | Pontos | Potência | Status
AP 1801 | Ricardo | 1      | 7 kW     | Dimensionado
```

## 🧪 Teste Rápido

1. Criar novo projeto EV com 1 carregador de 7kW
2. Salvar projeto
3. Ir para `/projetos-ev`
4. Verificar se aparece:
   - Potência: **7 kW** (não mais 0)
   - Pontos: **1** (não mais 0)
   - Status: **Dimensionado** (não mais Rascunho)

## 📝 Mudanças de Arquivo

| Arquivo | Mudança |
|---------|---------|
| `backend/src/controllers/projetosEVController.js` | ✏️ Atualizar `criarProjetoEV()` e `atualizarProjetoEV()` |
| `backend/src/routes/projetosEV.js` | ➕ Adicionar rota `/manutencao/recalcular-potencias` |
| `backend/recalcularPotenciasEV.mjs` | ✨ Novo script de manutenção |
| `frontend/src/pages/NovaPropostaEV.jsx` | ✅ Já funcionando correto (sem mudanças) |
| `frontend/src/pages/ProjetosEV.jsx` | ✅ Já display correto (sem mudanças) |

## ⏭️ Próximos Passos (Melhorias Visuais)

Aprimoramentos mencionados ainda pendentes:
- [ ] Melhorar visual do unifilar EV (desenhos mais realistas)
- [ ] Adicionar componentes interativos
- [ ] Suporte a vários carregadores na visualização
- [ ] Exportação PDF com melhor layout

---

**Status:** ✅ Integração Corrigida e Testada
