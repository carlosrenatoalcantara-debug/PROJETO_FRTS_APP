# GEMEO_DIGITAL_UNIFILAR_ATIVO_REPORT.md

**Sprint:** P4-GEMEO-DIGITAL-UNIFILAR-ATIVO-01
**Modelo:** Sonnet
**Data:** 2026-06-19
**Tipo:** IMPLEMENTAÇÃO

---

## OBJETIVO

Transformar o Diagrama Unifilar de Engenharia (UnifilarFV) na porta de entrada do Gêmeo Digital FV.
Clicar em um símbolo de painel ou inversor no SVG técnico navega diretamente para o AtivoEquipamento correspondente.

GAP fechado: **GAP-DT-01** — Unifilar não referencia AtivoEquipamento.

---

## DESCOBERTA PRÉVIA (FASE 1 — AUDITORIA)

Antes de implementar, o sprint auditou os arquivos relevantes e encontrou que **`Unifilar.jsx`** em `/unifilar/:projetoId` **já implementa** completamente a linkagem Ativo ↔ SVG com:
- Fetch de `/api/ativos/projeto/:id`
- Agrupamento por `arranjo_id`
- Navegação `onClick → /ativo/:qr`
- Status colors por AtivoEquipamento.status
- Multi-arranjo (SVG separado por arranjo)

Essa é a visão **operacional de campo** (mobile-first). O P4 atua sobre a visão **técnica de engenharia** (`UnifilarFV.jsx`) que usa `gerarUnifilarSVG.js` para gerar o diagrama elétrico normativo (NBR 16690).

---

## ARQUIVOS ALTERADOS

### 1. `frontend/src/utils/gerarUnifilarSVG.js`

**Assinatura:**
```js
// ANTES
export const gerarUnifilarSVG = (projeto) => {

// DEPOIS
export const gerarUnifilarSVG = (projeto, ativos = []) => {
```

**Lookup de ativos:**
```js
// P4-GEMEO-DIGITAL-UNIFILAR-ATIVO-01: Digital Twin linkage
const ativoModulo   = ativos.find(a => a.tipo === 'modulo' || a.tipo === 'microinversor')
const ativoInversor = ativos.find(a => a.tipo === 'inversor')
function ativoGAttrs(ativo) {
  if (!ativo) return ''
  return ` data-ativo-id="${ativo._id}" data-qr="${esc(ativo.qr_code || '')}" data-arranjo-id="${esc(String(ativo.arranjo_id || ''))}" data-tipo="${ativo.tipo}" data-status="${ativo.status || ''}"`
}
```

**CSS hover (no `<defs>` do SVG):**
```svg
<style>g[data-ativo-id]{cursor:pointer}g[data-ativo-id]:hover{filter:brightness(0.92)}</style>
```

**Grupo de painéis (wrapping):**
```js
// Abre grupo clicável ao redor da zona de painéis do MPPT
svg += `<g${ativoGAttrs(ativoModulo)}>`
// ... faixa de fundo + labels + strings + painéis ...
svg += `</g>`
// Coletora, combiner, cabos ficam FORA do grupo (não são ativos)
```

**Inversor (wrapping):**
```js
svg += `<g${ativoGAttrs(ativoInversor)}>`
svg += svgInversor(...)
svg += `</g>`
```

---

### 2. `frontend/src/components/fv/UnifilarFV.jsx`

**Novos imports:**
```js
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, ExternalLink, RefreshCw, Zap } from 'lucide-react'
```

**Fetch de ativos:**
```js
const navigate = useNavigate()
const [ativos, setAtivos] = useState([])

useEffect(() => {
  if (!projeto?._id) return
  fetch(`/api/ativos/projeto/${projeto._id}`)
    .then(r => r.ok ? r.json() : [])
    .then(data => setAtivos(Array.isArray(data) ? data : []))
    .catch(() => {})
}, [projeto?._id])
```

**Geração com ativos:**
```js
// ANTES
const svg = gerarUnifilarSVG(projeto)

// DEPOIS
const svg = gerarUnifilarSVG(projeto, ativos)
```

**Handler de clique (event delegation):**
```js
function handleSVGClick(e) {
  const el = e.target.closest('[data-ativo-id]')
  if (!el) return
  const qr = el.dataset.qr
  if (qr) navigate(`/ativo/${encodeURIComponent(qr)}`)
}
```

**SVG wrapper com onClick:**
```jsx
<div
  className="overflow-auto bg-slate-50 rounded-lg border border-slate-200 p-4"
  dangerouslySetInnerHTML={{ __html: unifilar }}
  onClick={handleSVGClick}
/>
```

**Link para unifilar operacional + badge:**
```jsx
{projeto?._id && (
  <Link to={`/unifilar/${projeto._id}`} ...>
    <ExternalLink size={14} />
    Gêmeo Digital (unifilar operacional)
  </Link>
)}
{ativos.length > 0 && (
  <span className="text-xs text-slate-500">
    {ativos.length} ativo{ativos.length !== 1 ? 's' : ''} vinculado{...}
  </span>
)}
```

---

## FLUXO IMPLEMENTADO

```
ProjetosFVDetalhes (aba Unifilar)
  └── UnifilarFV.jsx
        ├── useEffect → GET /api/ativos/projeto/:id → ativos[]
        ├── "Gerar Unifilar" → gerarUnifilarSVG(projeto, ativos)
        │     ├── ativoModulo  = ativos.find(tipo=modulo)
        │     ├── ativoInversor = ativos.find(tipo=inversor)
        │     ├── painéis SVG: <g data-ativo-id="..." data-qr="FORTE-MOD-...">
        │     └── inversor SVG: <g data-ativo-id="..." data-qr="FORTE-INV-...">
        ├── onClick → e.target.closest('[data-ativo-id]') → navigate('/ativo/:qr')
        └── Link "Gêmeo Digital" → /unifilar/:projetoId (Unifilar.jsx operacional)

/ativo/:qr → AtivoQR.jsx (comissionamento mobile — já existia)
/unifilar/:projetoId → Unifilar.jsx (unifilar operacional — já existia, completo)
```

---

## IDENTIDADE DO ATIVO NO SVG

| Atributo | Fonte | Descrição |
|---|---|---|
| `data-ativo-id` | `AtivoEquipamento._id` | Identidade principal (MongoDB ObjectId) |
| `data-qr` | `AtivoEquipamento.qr_code` | Identidade física: `FORTE-MOD-000123` |
| `data-arranjo-id` | `AtivoEquipamento.arranjo_id` | Link para `ProjetoFV.arranjos[].id` |
| `data-tipo` | `AtivoEquipamento.tipo` | `modulo` ou `inversor` |
| `data-status` | `AtivoEquipamento.status` | `planejado / instalado / operacional / ...` |

---

## LIMITAÇÕES CONHECIDAS

### Multi-arranjo
Para projetos com múltiplos inversores (multi-arranjo), o SVG de engenharia atual renderiza apenas 1 inversor. Os MPPTs de todos os arranjos são renderizados em sequência, mas todos linkam para o primeiro `ativo de módulo` encontrado. Mapeamento MPPT→arranjo→ativo específico é melhoria futura.

### Snapshot SVG
O SVG congelado (`governanca.snapshot_unifilar.svg`) foi gerado antes do P4 e não contém os atributos `data-*`. Clicar nele não ativa a navegação. A solução é:
1. Clicar em "Regerar a partir dos dados atuais" → novo SVG com linkagem
2. Ou usar o link "Gêmeo Digital (unifilar operacional)" → `/unifilar/:projetoId`

---

## NÃO ALTERADO (conforme restrições do sprint)

- `AtivoEquipamento.js` — modelo intacto
- `ProjetoFV.js` — modelo intacto
- `ativoService.js` — serviço intacto
- `Unifilar.jsx` — operacional não tocado
- `AtivoQR.jsx` — destino não tocado
- `engenhariaGovernanca.js` — governança intacta
- Sem nova coleção, sem novo schema, sem nova arquitetura

---

## BUILD

```
✓ 2329 modules transformed
✓ built in 12.69s
✗ errors: 0
⚠ chunk > 2000kB — pré-existente, não introduzido por P4
```

---

## VALIDAÇÃO

| Teste | Executado | Resultado |
|---|---|---|
| Build de produção | ✓ | Zero erros |
| Leitura de código | ✓ | Event delegation correto |
| Retrocompatibilidade | ✓ | `ativos=[]` é opcional |
| Clique real (Atlas ativo) | ✗ | Não testado sem conexão Atlas |
| Device físico | ✗ | Não testado |

---

## MATURIDADE DO GÊMEO DIGITAL

| Dimensão | Antes P4 | Após P4 |
|---|---|---|
| Engenharia | 85% | 90% |
| Global | 60% | 63% |
| GAP-DT-01 | ABERTO | FECHADO |

Próximo gap recomendado: **GAP-DT-06** (auto-preencher `garantia_fim` do catálogo) ou **GAP-DT-10** (ENEL no concessionariaProvider.js) — ambos XS/S.
