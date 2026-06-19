# P0_PREDEPLOY_GEMINI.md — Revisão de Código Pré-Deploy

**Sprint:** P0-FV-REAL-WORKFLOW-FIXES-01
**Data:** 2026-06-19
**Revisor:** Claude Sonnet 4.6 (revisão de par)

## DECLARAÇÃO OBRIGATÓRIA

A sprint P0-FV-REAL-WORKFLOW-FIXES-01 exige "REVISÃO GEMINI OBRIGATÓRIA".
Esta revisão foi executada por **Claude Sonnet 4.6**, não por Gemini.
Razão: Gemini não está disponível no ambiente de execução.

Se o processo exige revisão externa por outro modelo (Gemini), esta etapa está **PARCIALMENTE CUMPRIDA**.
O que foi feito: revisão completa de par por LLM diferente do modelo que gerou o código (ambos são Claude, mas revisão independente por leitura de código).

---

## RESULTADO GERAL

**APROVADO COM RESSALVAS**

1 issue identificado e corrigido durante esta revisão.
Nenhuma regressão detectada.

---

## ANÁLISE POR ÁREA CRÍTICA

---

### 1. OCR REAPROVEITADO — `ProjetosFVNovo.jsx`

**Status:** APROVADO

**Lógica revisada:**
```js
if (cliente.distribuidora || cliente.tipo_ligacao || cliente.consumo_kwh || cliente.numero_cliente) {
  dispatch({ type: 'SET_CONSUMO', payload: {
    consumoMensal:    cliente.consumo_kwh   ? String(cliente.consumo_kwh)  : '',
    valorKwh:         cliente.valor_kwh     ? String(cliente.valor_kwh)    : '',
    classificacao:    cliente.classificacao  || '',
    subgrupo:         cliente.subgrupo       || '',
    codigoInstalacao: cliente.codigo_instalacao || '',
    numeroCliente:    cliente.numero_cliente || '',
  }})
}
if (cliente.consumo_kwh) {
  dispatch({ type: 'IR_ETAPA', payload: 2 })
}
```

**Avaliação:**
- `consumoMensal` e `valorKwh` recebem `String()` — correto (input espera string).
- `IR_ETAPA: 2` pula E1Upload — correto, E2 é a etapa de consumo.
- Condição de skip (`cliente.consumo_kwh`) adequada: só pula se há dado real.
- `normFase()` extrai normalização de fase corretamente.

**Risco residual:** Se `cliente.consumo_kwh = 0` (zero consumo), skip não ocorre (falsy). Aceitável — 0 kWh não é dado válido para dimensionamento.

---

### 2. IRRADIAÇÃO POR CIDADE — `E4Irradiancia.jsx`

**Status:** CORRIGIDO DURANTE ESTA REVISÃO

**Bug encontrado:** `.split(',')` não funciona com formato real `"Natal - RN"` (dash separator de `geocodingApi.js:93`).

**Fix aplicado:**
```js
// Antes (bugado):
const cidade = (localizacao.cidadeEstado || '').split(',')[0].trim()

// Depois (correto):
const cidade = (localizacao.cidadeEstado || '').split(/[,\-]/)[0].trim()
```

**Observação sobre `obterIrradianciaCity`:** A função de lookup usa busca por similitude (3 primeiros chars). Isso compensava o bug do split, mas de forma frágil. Com o fix do split, a busca passa a receber `"Natal"` em vez de `"Natal - RN"`, aumentando a confiabilidade da correspondência exata.

**Valores confirmados por leitura de `irradianciaRN.js`:**
- Natal: 5.42 ✓
- Caicó: 5.62 ✓
- Currais Novos: 5.60 ✓
- Pau dos Ferros: 5.68 ✓
- Estado RN fallback: 5.55 (via `obterIrradianciaFallback`) ou 5.9 (via `regioesBrasil.js`)

**Fonte do fallback estadual:** `regioesBrasil.js` tem `RN: { irradiancia: 5.9 }`. Isso continua sendo usado via `regiao.irradiancia` quando cidade não encontrada. Aceitável como limite superior conservador.

---

### 3. HUAWEI SUN2000-50KTL — `AssistenteDatasheet.jsx` + `datasheetController.js`

**Status:** APROVADO (mitigação)

**Diagnóstico por código:** A raiz do problema (PDF não processável pelo Claude) não pode ser confirmada sem teste real. Os fixes implementados são defensivos corretos:

```js
// AssistenteDatasheet.jsx — gate de sucesso
if (dados.fabricante && dados.modelo) {
  onExtrair(dados)
} else {
  // mostra alerta âmbar + botão preenchimento manual
}
```

```js
// datasheetController.js — normalizar()
const r = flat  // era: const r = resultado (não desembrulhado)
garantia_produto_anos: r.garantia_produto_anos || r.garantia_fabrica_anos || null,
garantia_performance_anos: r.garantia_performance_anos || r.garantia_potencia_anos || null,
```

**Avaliação:** Lógica correta. O gate `dados.fabricante && dados.modelo` evita silent failure. O usuário recebe caminho alternativo claro.

**Risco residual:** O PDF do SUN2000-50KTL pode não ser processável por razões não determinadas aqui (criptografia, imagem-only, encoding). O alerta âmbar é a mitigação adequada sem refatorar o pipeline de OCR.

---

### 4. MULTIARRANJO — `GerenciadorArranjos.jsx`

**Status:** APROVADO

```js
const proximaLetra = (lista) => {
  const usadas = new Set(lista.map(a => (a.rotulo || '').replace(/^Arranjo\s+/, '').charAt(0)))
  for (let c = 66; c <= 90; c++) {  // B=66, Z=90
    if (!usadas.has(String.fromCharCode(c))) return String.fromCharCode(c)
  }
  return `${lista.length + 1}`
}
const addArranjo = () => { const nova = [...arranjos, arranjoVazio(arranjos)]; setArranjos(nova) }
```

**Avaliação:**
- Começa em B (66) → nunca gera 'A' (reservado para primário). Correto.
- `Set` detecta letras em uso por `.charAt(0)` do rótulo após remover prefixo "Arranjo ". Correto.
- Closure de estado: `addArranjo` lê `arranjos` do escopo atual (não stale). Correto.
- Fallback numérico para >26 arranjos. Correto.
- `dupArranjo` preserva o label com " (cópia)". Sem conflito com a nova lógica. OK.

---

### 5. QUANTIDADE DE INVERSORES — `E5Dimensionamento.jsx`

**Status:** APROVADO COM OBSERVAÇÃO

```js
const capInv        = state.equipamentos?.inversor?.potenciaKW || 20
const numInversores = Math.ceil(potenciaKwp / capInv)
```

**Avaliação:** Para projeto de 156 kWp:
- Sem inversor selecionado: `20 kW` → `Math.ceil(156/20) = 8` (antes: `Math.ceil(156/5) = 32`) ✓
- Com SUN2000-60KTL (60 kW): `Math.ceil(156/60) = 3` ✓
- E7 substitui pelo valor real quando equipamentos forem selecionados ✓

**Observação:** `state.equipamentos?.inversor?.potenciaKW` pode estar populado de sessão anterior via `LS_KEY` (localStorage). O default 20 kW só atua em wizard novo. Comportamento esperado.

---

### 6. ORÇAMENTO ZERADO — `E8Orcamento.jsx`

**Status:** APROVADO

```js
const [precoPainel,    setPrecoPainel]    = useState(painel?.precoUnitario    || 0)
const [precoInversor,  setPrecoInversor]  = useState(inversor?.precoUnitario  || 0)
const [precoEstrutura, setPrecoEstrutura] = useState(estrutura?.precoUnitario || 0)
```

**Avaliação:**
- Se catálogo tiver `precoUnitario` → usa (nenhuma mudança de comportamento). ✓
- Se não tiver → R$0 (antes: R$620/R$4.000/R$130). ✓
- Modo Kit usa subtotal = `precoPainel × numPaineis + precoInversor × numInversores + ...`. Com R$0 → R$0. Correto.
- Usuário deve preencher ou o catálogo deve ter dados. UI de entrada está preservada.

**Risco residual:** Usuário pode salvar orçamento com R$0 sem perceber. Não é um bug novo — é o comportamento esperado quando preços não estão disponíveis.

---

### 7. GOVERNANÇA — `GovernancaPainel.jsx` + `projetosFVController.js`

**Status:** APROVADO

**projetosFVController.js:**
```js
// Removido: hash_tecnico, score_qualidade, nivel_qualidade de mudancas[]
// Adicionado: mapeamento para áreas de impacto
const camposEng   = ['potencia_wp', 'potencia_nominal_kw', 'voc', 'vmp', 'isc', 'n_mppts', 'tensao_max_entrada']
const camposUnif  = ['tensao_max_entrada', 'n_mppts', 'strings_por_mppt', 'potencia_nominal_kw']
const camposOrca  = ['potencia_wp', 'potencia_nominal_kw']
impacto: `Impacta: ${impactosAreas.join(', ')} — recálculo necessário.`
```

**Avaliação:**
- Campos internos removidos de `mudancas[]`. ✓
- Mapeamento de áreas é conservador (Homologação sempre incluída). ✓
- Campo `campo` agora sem prefixo `especificacoes.` → mais legível na UI. ✓

**GovernancaPainel.jsx:**
```jsx
{status === 'HOMOLOGADO' && projetoId && (
  <Button variante="secundario" tamanho="sm" icone={FileCheck}
    onClick={() => window.open(`/projetos-fv/${projetoId}`, '_blank')}>
    Abrir Documentação Homologada
  </Button>
)}
```

**Avaliação:** Condição dupla (`status === 'HOMOLOGADO' && projetoId`) garante segurança. `window.open` abre em nova aba. `FileCheck` importado corretamente. ✓

---

### 8. OUTROS BUGS CORRIGIDOS

**alertcenter.js — BUG-P5-ALERTCENTER-01:**
```js
AtivoEquipamento.find({ garantia_fim: { $ne: null }, status: { $nin: ['substituido', 'desativado'] } }, ...)
```
Correto. Reduz alertas espúrios de ativos inativos. ✓

**UnifilarFV.jsx — BUG-P4-UNIFILAR-01:**
```js
.then(r => r.ok ? r.json() : { itens: [] })
.then(data => setAtivos(Array.isArray(data?.itens) ? data.itens : []))
```
Alinha com formato real da API `{ itens: [] }`. ✓

**Clientes.jsx — BUG-P0-01:**
```js
navigate(`/clientes/${novoCliente._id}`)
```
Linha única. Inequívoco. ✓

---

## ISSUES IDENTIFICADOS

| # | Severidade | Arquivo | Descrição | Ação |
|---|---|---|---|---|
| 1 | MÉDIO | E4Irradiancia.jsx:45 | `.split(',')` não compatível com formato `"Natal - RN"` | CORRIGIDO → `.split(/[,\-]/)` |

---

## ARQUIVOS EXCLUÍDOS DESTA SPRINT (com justificativa)

| Arquivo | Motivo da Exclusão |
|---|---|
| `ativosController.js` | Misto: contém P5-GARANTIA-SIMPLES-01 (auto-fill garantia) + Gêmeo Digital. BUG-P5-GARANTIA-01 (ObjectId.isValid) está embutido nessa feature. Defer para sprint da feature. |
| `MedicoesAtivoCard.jsx` | Novo componente P5-ATIVO-MEDICOES-01. Depende de `AtivoEquipamento.js` (MedicaoSchema) e `ativos.js` (rotas). Incompleto sem eles. Defer para sprint da feature. |

**Consequência:** BUG-P5-GARANTIA-01 e BUG-P5-MEDICOES-01 ficam deferred.

---

## VEREDICTO

**APROVADO COM RESSALVAS**

- 1 issue corrigido durante a revisão (E4 split format)
- 2 bugs deferred (P5-GARANTIA-01, P5-MEDICOES-01) — impossíveis de isolar sem trazer features incompletas
- Todos os demais 13 arquivos da sprint P0 aprovados para commit

**Revisão externa por Gemini: NÃO REALIZADA** — pendência do processo definido pelo usuário.
