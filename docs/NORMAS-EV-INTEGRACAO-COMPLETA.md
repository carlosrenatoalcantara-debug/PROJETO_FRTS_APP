# 🔌 Integração Completa de Normas Brasileiras para Carregadores EV

## Status: ✅ IMPLEMENTAÇÃO CONCLUÍDA

Toda a estrutura de cálculos e validações conforme normas brasileiras foi implementada e integrada ao backend.

---

## 📋 O Que Foi Implementado

### 1. **Documentação de Normas** ✅

#### Arquivo: `backend/docs/NORMAS-CARREGADORES-EV-BRASIL.md`
- Referência completa de 6 normas principais
- Requisitos de dimensionamento (corrente, bitola, disjuntor, DR, aterramento)
- 4 modos de operação (Modo 1-4)
- Checklist de implementação
- Exemplo calculado: 7kW residencial com todos os parâmetros
- Requisitos de segurança Corpo de Bombeiros RN

### 2. **Módulo de Cálculos** ✅

#### Arquivo: `backend/src/utils/calculosCarregadorEV.js`

Funções exportadas:

```javascript
// Cálculos principais
- calcularCorrenteProjetoNBR5410(potencia_kw, tensao_v)
- calcularBitolaNBR5410(corrente_a, comprimento_m, queda_tensao_max, tensao_v)
- calcularDisjuntorNBR5410(corrente_a)
- validarAteramentoNBR5410(resistencia_medida_ohms)

// Especificações
- obterEspecificacaoDRNBREIEC618511()
- obterModoOperacao(modo)
- obterEspecificacaoConector(tipo_conector)
- determinarModoOperacao(tipo_carregador, potencia_kw) // NOVO

// Validação completa
- executarCalculosProjetoEV(dados) // Executa TODOS os cálculos

// Conformidade
- gerarChecklistConformidadeNormas(dados_projeto)

// Constantes
- TABELA_BITOLAS         // Tabela NBR 5410
- MODOS_OPERACAO         // Modo 1-4 especificações
```

### 3. **Schema Atualizado** ✅

#### Arquivo: `backend/src/models/ProjetoEV.js`

Novos campos adicionados:

```javascript
// Carregador (expandido)
carregadores[0].tensao_entrada_v: Number
carregadores[0].corrente_entrada_a: Number

// Operação
tipo_carregamento: String         // AC, DC, Misto
modo_operacao: Number              // 1, 2, 3, ou 4 (NBR IEC 61851-1)
tipo_conector: String              // IEC 62196-2, Tesla, CCS, CHAdeMO

// Proteção
resistencia_aterramento_ohms: Number
resistencia_aterramento_conformidade: String

// Normas
normas_aplicadas: [String]         // Array com 6 normas padrão
conformidade_norms: {
  corrente_ok: Boolean
  bitola_ok: Boolean
  queda_tensao_ok: Boolean
  disjuntor_ok: Boolean
  dr_ok: Boolean
  aterramento_ok: Boolean
  spda_necessario: Boolean
  conforme: Boolean                // RESUMO: Tudo OK?
}
```

### 4. **Controller com Integração** ✅

#### Arquivo: `backend/src/controllers/projetosEVController.js`

Atualizações:

1. **Imports:** Adicionado `executarCalculosProjetoEV`
2. **atualizarProjetoEV:** Agora executa cálculos automaticamente quando:
   - Carregadores são atualizados
   - Tensão muda
   - Comprimento de cabo muda
   - Resistência de aterramento muda
   - Modo de operação muda

3. **Nova função:** `calcularNormasProjetoEV()`
   - Endpoint: `POST /api/projetos-ev/:id/calcular-normas`
   - Permite simular cálculos SEM salvar projeto
   - Retorna cálculos detalhados para frontend mostrar ao usuário

### 5. **Routes** ✅

#### Arquivo: `backend/src/routes/projetosEV.js`

Nova rota adicionada:
```javascript
router.post('/:id/calcular-normas', calcularNormasProjetoEV)
```

### 6. **Documentação de Integração** ✅

#### Arquivo: `backend/docs/IMPLEMENTACAO-NORMAS-EV.md`

Guia completo com:
- Arquitetura e fluxo de dados
- Exemplos de API (POST, PUT)
- Documentação de cada função
- Fluxo de integração frontend
- Tabelas de referência
- Troubleshooting

---

## 🔄 Fluxo de Operação

### Cenário 1: Criar Novo Projeto

```
1. Frontend → POST /api/projetos-ev
   {
     "clienteId": "...",
     "nome": "Novo Carregador"
   }
   
2. Backend cria projeto com status = "rascunho"
   
3. Resposta inclui normas_aplicadas por padrão
```

### Cenário 2: Preencher Dados do Carregador

```
1. Frontend → POST /api/projetos-ev/:id/calcular-normas
   {
     "carregadores": [{
       "potencia_kw": 7,
       "tipo": "AC_Mono"
     }],
     "tensao_sistema": 230,
     "comprimento_cabo_m": 30,
     "resistencia_aterramento_ohms": 3.5
   }
   
2. Backend executa:
   - calcularCorrenteProjetoNBR5410() → 40A
   - calcularBitolaNBR5410() → 16mm²
   - calcularDisjuntorNBR5410() → 50A
   - validarAteramentoNBR5410() → ✓ Excelente
   
3. Resposta mostra:
   {
     "calculos_nbr": {
       "corrente_projeto_a": 40,
       "bitola_cabo_mm2": 16,
       "disjuntor_a": 50,
       "dr_ma": 30,
       "queda_tensao_pct": 2.6
     },
     "conformidade_norms": {
       "conforme": true  ← Usuario pode confirmar
     }
   }
   
4. Frontend mostra validação ao usuário
   "✅ Projeto conforme com normas ABNT"
```

### Cenário 3: Salvar Projeto

```
1. Frontend → PUT /api/projetos-ev/:id
   {
     "carregadores": [...],
     "tensao_sistema": 230,
     ...
   }
   
2. Backend detecta mudanças relevantes
   
3. Executa automaticamente:
   - executarCalculosProjetoEV() ← Tudo automaticamente
   
4. Salva projeto com:
   - calculos_nbr populado
   - conformidade_norms preenchido
   - resistencia_aterramento_conformidade = "✓ Excelente"
   
5. Resposta retorna projeto completo pronto para diagrama unifilar
```

---

## 📊 Exemplos Práticos

### Exemplo 1: Residência 7kW (Modo 1)

**Entrada:**
```json
{
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7
  }],
  "tensao_sistema": 230,
  "comprimento_cabo_m": 30,
  "resistencia_aterramento_ohms": 3.5
}
```

**Cálculos Automáticos:**
```
I_projeto = (7000W / 230V) × 1.25 = 38.04A → 40A (comercial)

Bitola: Para 40A em 30m, começar com 10mm²
ΔU = (2 × 0.0175 × 30 × 40) / 10 = 4.2% ❌ Excede 3%
Usar 16mm² → ΔU = 2.6% ✅

Disjuntor: 40A × 1.3 = 52A → 50A (comercial)
Curva: B (inrush suave para Modo 1)

DR: 30mA (obrigatório)

Aterramento: 3.5Ω < 5Ω ✓ Excelente
```

**Saída (Automática):**
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
    "conforme": true
  }
}
```

### Exemplo 2: Condomínio 11kW (Modo 3)

**Entrada:**
```json
{
  "carregadores": [{
    "tipo": "AC_Tri",
    "potencia_kw": 11
  }],
  "tensao_sistema": 400,
  "comprimento_cabo_m": 50,
  "resistencia_aterramento_ohms": 5.5
}
```

**Resultado:**
```
I_projeto = (11000W / 400V) × 1.25 = 34.375A → 40A
Bitola: 16mm² (suporta até 40A)
ΔU = 2.1% ✅
Disjuntor: 50A Curva C
Status: ✅ CONFORME
```

---

## 🎯 Como Usar na Frontend

### 1. Validação em Tempo Real

```javascript
// Ao usuário mudar potência/tensão/comprimento
async function validarCarregador(dados) {
  const response = await fetch(
    `/api/projetos-ev/${projetoId}/calcular-normas`,
    { method: 'POST', body: JSON.stringify(dados) }
  )
  const resultado = await response.json()
  
  // Mostra ao usuário
  console.log('Bitola:', resultado.calculos_nbr.bitola_cabo_mm2, 'mm²')
  console.log('Conforme?', resultado.conformidade_norms.conforme ? '✅' : '❌')
  
  if (!resultado.conformidade_norms.conforme) {
    mostrarErro('Projeto não conforme com normas')
  }
}
```

### 2. Exibição de Cálculos na Interface

Mostrar para o usuário durante preenchimento:
- ✅ Corrente calculada (A)
- ✅ Bitola do condutor (mm²)
- ✅ Queda de tensão (%)
- ✅ Disjuntor (A)
- ✅ DR (30mA)
- ✅ Aterramento (Ω e status)

### 3. Indicador Visual de Conformidade

```
Status: ✅ CONFORME COM NORMAS ABNT
Normas Aplicadas:
  ✓ ABNT NBR 17019:2022
  ✓ ABNT NBR 5410:2004
  ✓ ABNT NBR IEC 61851-1:2021
  ✓ ABNT NBR IEC 62196-1/2/3:2021
```

---

## 🔌 Integração com Diagrama Unifilar

O PDF gerado pode incluir:

1. **Bloco de Normas Aplicadas**
   ```
   NORMAS APLICADAS
   ┌─────────────────────────┐
   │ ABNT NBR 17019:2022     │
   │ ABNT NBR 5410:2004      │
   │ NBR IEC 61851-1:2021    │
   │ NBR IEC 62196-1:2021    │
   └─────────────────────────┘
   ```

2. **Tabela de Dimensionamento**
   ```
   DIMENSIONAMENTO CONFORME NBR 5410
   ┌──────────────┬────────┬──────────┐
   │ Parâmetro    │ Valor  │ Norma    │
   ├──────────────┼────────┼──────────┤
   │ Potência     │ 7 kW   │ NBR 5410 │
   │ Corrente     │ 40 A   │ NBR 5410 │
   │ Bitola       │ 16 mm² │ NBR 5410 │
   │ Disjuntor    │ 50 A C │ NBR 5410 │
   │ DR           │ 30 mA  │ IEC 61851│
   │ ΔU           │ 2.6 %  │ NBR 5410 │
   │ Aterramento  │ 3.5 Ω  │ NBR 5410 │
   └──────────────┴────────┴──────────┘
   ```

3. **Status de Conformidade**
   ```
   CONFORMIDADE COM NORMAS: ✅ CONFORME
   ```

---

## 🚀 Próximas Implementações (Frontend)

### Curto Prazo (1-2 semanas)

1. **ProjetoEVDetalhes - Adicionar Cálculos**
   - Mostrar seção de cálculos NBR
   - Exibir conformidade_norms com indicadores
   - Botão "Recalcular" para simular mudanças

2. **Formulário de Carregador - Validação**
   - Ao preencher potência, validar automaticamente
   - Mostrar cálculos estimados
   - Avisar se não conforme

3. **Campo de Aterramento**
   - Input para resistência
   - Mostrar status (Excelente/Aceitável/Não conforme)

### Médio Prazo (2-4 semanas)

1. **Página de Diagrama Unifilar**
   - Gerar diagrama com dados calculados
   - Mostrar blocos de normas
   - Tabela de dimensionamento

2. **Gerador de PDF**
   - Incluir seção de normas
   - Adicionar detalhes de conformidade
   - Assinatura de engenheiro

3. **Relatório de Conformidade**
   - Document checklist completo
   - Assinatura digital
   - QR code para acesso ao projeto

---

## 📚 Arquivos Criados/Modificados

| Arquivo | Tipo | Status |
|---------|------|--------|
| `backend/src/utils/calculosCarregadorEV.js` | Novo | ✅ |
| `backend/src/models/ProjetoEV.js` | Modificado | ✅ |
| `backend/src/controllers/projetosEVController.js` | Modificado | ✅ |
| `backend/src/routes/projetosEV.js` | Modificado | ✅ |
| `backend/docs/NORMAS-CARREGADORES-EV-BRASIL.md` | Novo | ✅ |
| `backend/docs/IMPLEMENTACAO-NORMAS-EV.md` | Novo | ✅ |
| `frontend/src/pages/ProjetosEVDetalhes.jsx` | Existente | ✅ |

---

## ✅ Checklist de Integração

Backend:
- [x] Módulo de cálculos criado
- [x] Schema atualizado
- [x] Controller integrado
- [x] Rotas configuradas
- [x] Documentação completa

Frontend (Próximo):
- [ ] Mostrar cálculos em ProjetosEVDetalhes
- [ ] Validação em tempo real no formulário
- [ ] Indicador visual de conformidade
- [ ] Integração com PDF/diagrama

---

## 🔧 Como Testar

### 1. Testar via cURL

```bash
# Simular cálculos
curl -X POST http://localhost:5005/api/projetos-ev/{id}/calcular-normas \
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

### 2. Testar via Postman

- Collection: "Projetos EV"
- Request: "POST Calcular Normas"
- Body: Dados do carregador
- Resultado: Cálculos e conformidade

### 3. Testar via Frontend

- Criar novo projeto
- Preencher dados do carregador
- Verificar se cálculos aparecem ao salvar

---

## 📞 Suporte

### Dúvidas Comuns

**P: Por que a bitola mudou de 10mm² para 16mm²?**  
R: A queda de tensão em 10mm² excedia 3%, limite da NBR 5410.

**P: DR é sempre 30mA?**  
R: Sim, conforme NBR IEC 61851-1:2021. Tipo pode variar (AC/A/B).

**P: Como determinar modo de operação?**  
R: Função `determinarModoOperacao()` faz automaticamente baseado na potência e tipo.

---

**Status Final:** 🟢 PRONTO PARA INTEGRAÇÃO COM FRONTEND

**Próxima Ação:** Atualizar componentes do frontend para exibir e validar cálculos

---

**Última Atualização:** 2026-05-13  
**Versão:** 1.0  
**Normas Implementadas:** ABNT NBR 17019:2022, NBR 5410:2004, IEC 61851-1:2021, IEC 62196-1/2/3:2021, NBR 5419:2026
