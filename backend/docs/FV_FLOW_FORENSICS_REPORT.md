# P0-FV-FLOW-FORENSICS-01 — Auditoria do Fluxo FV vs Processo Real Forte Solar

> **Data:** 2026-06-17 · **Executor:** Sonnet 4.6 · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE  
> **Tipo:** READ-ONLY — nenhum código alterado, nenhum commit, nenhuma escrita no Atlas.

---

## VEREDITO GERAL

O sistema atual cobre **8 de 12 etapas** do fluxo real, com qualidade variável. Quatro etapas têm gaps P0 que bloqueiam o processo operacional. Uma etapa (Instalação) é completamente ausente. Uma etapa (Homologação) existe completa no código mas está **desconectada** da tela principal — um stub substitui o componente real.

| Etapa Real | Sistema | Status |
|-----------|---------|--------|
| 1. Cliente | Clientes.jsx | PARCIAL |
| 2. Conta de Energia | Wizard E1-E4 | FUNCIONAL |
| 3. Dimensionamento | Wizard E5 | FUNCIONAL |
| 4. Seleção Equipamentos | Wizard E7 | FUNCIONAL |
| 5. Orçamento | Wizard E8 + PropostaEnterprise | PARCIAL (P0) |
| 6. Aprovação Comercial | PropostaEnterprise + workflow | PARCIAL (P0) |
| 7. Engenharia | GovernancaPainel (freeze) | PARCIAL (P0) |
| 8. Unifilar | UnifilarFV.jsx | FUNCIONAL |
| 9. Homologação | AbaHomologacao STUB | PLACEHOLDER (P0) |
| 10. Instalação | — | AUSENTE |
| 11. Comissionamento | Módulo Ativos (separado) | PARCIAL |
| 12. Operação | Ativos monitoramento (separado) | PARCIAL |

---

## FASE 1 — INVENTÁRIO DO SISTEMA ATUAL

### Telas e Rotas

| Tela | Arquivo | Rota | Propósito |
|------|---------|------|-----------|
| Lista de Projetos FV | `ProjetosFV.jsx` | `/projetos-fv` | CRUD + filtros + ações lifecycle |
| Wizard Novo Projeto | `ProjetosFVNovo.jsx` | `/projetos-fv/novo` | 8 etapas sequenciais |
| Detalhes do Projeto | `ProjetosFVDetalhes.jsx` | `/projetos-fv/:id` | 11 abas + modal Editar Diagrama |

### Abas no ProjetosFVDetalhes

| Aba | Componente | Status |
|-----|-----------|--------|
| Resumo | `AbaResumo` (inline) | FUNCIONAL (bug: nomeCliente) |
| Layout | `AbaLayout` + `PlanejadorTelhado` | FUNCIONAL |
| BESS | `AbaBESS` (inline) | PLACEHOLDER |
| Financeiro | `AbaFinanceiro` (inline) | PARCIAL (dados legados) |
| Unifilar | `UnifilarFV.jsx` | FUNCIONAL |
| Governança | `GovernancaPainel.jsx` | PARCIAL (sem snapshot) |
| Documentos | `DocumentCenter.jsx` | FUNCIONAL |
| Comercial | `PropostaEnterprise.jsx` | PARCIAL (sem resultado financeiro) |
| CRM | `CrmPainel.jsx` | FUNCIONAL |
| Homologação | `AbaHomologacao` (STUB!) | PLACEHOLDER |
| Beneficiárias | `BeneficiariasPainel.jsx` | PARCIAL (sem tipoRateio) |

### Etapas do Wizard (ProjetosFVNovo)

| Etapa | Componente | Slice Salvo |
|-------|-----------|------------|
| E1 — Upload Fatura | `E1Upload.jsx` | `fatura_extracao` |
| E2 — Consumo | `E2Consumo.jsx` | não salva (manual) |
| E2.5 — Beneficiárias | `E2BBeneficiarias.jsx` | beneficiarias collection |
| E3 — Localização | `E3Localizacao.jsx` | `localizacao` |
| E4 — Irradiância | `E4Irradiancia.jsx` | inline no localizacao |
| E5 — Dimensionamento | `E5Dimensionamento.jsx` | `dimensionamento` |
| E6 — Área/Telhado | `E6Area.jsx` | `layout_solar` |
| E7 — Equipamentos | `E7Equipamentos.jsx` | `equipamentos` + `arranjos` |
| E8 — Orçamento | `E8Orcamento.jsx` | cria projeto + todos slices |

### Endpoints Backend Mapeados

| Módulo | Base URL | Endpoints principais |
|--------|---------|---------------------|
| Projetos FV | `/api/projetos-fv` | GET, POST, PATCH, DELETE |
| Slices FV | `/api/projetos-fv/:id` | PATCH (slices por nome) |
| Governança | `/api/projetos-fv/:id/governanca` | POST /congelar, POST /revisao |
| Homologação | `/api/projetos-fv/:id/homologacao` | GET/PATCH /checklist, POST /memorial, POST /carta, GET /art |
| Homologação Assistida | `/api/projetos-fv/:id/homologacao/assistida` | checklist, validacao, pacote, status |
| Beneficiárias | `/api/projetos-fv/:projetoId/beneficiarias` | GET, POST, PUT, DELETE, /lote, /resumo |
| Unifilar | `/api/unifilar/gerar` | POST (geração SVG) |
| Irradiância | `/api/irradiancia/projetos-fv/:projetoId` | POST (NASA Power) |

### Schemas Relevantes (ProjetoFV)

- **`fatura_extracao`** — dados extraídos da conta de energia (Gemini OCR)
- **`localizacao`** — v3 estruturado (lat/lon, geocoding, irradiância, clima)
- **`dimensionamento`** — v3 (kWp, painéis, strings, inversores, PR)
- **`layout_solar`** — v3 (panos, área, telhado, obstáculos)
- **`equipamentos`** — legado singular (paineis[], inversor, estrutura)
- **`arranjos[]`** — multi-MPPT/multi-inversor (v3, sprint P1-MULTIARRANJO)
- **`engenharia_eletrica`** — compatibilidade elétrica salva explicitamente
- **`orcamento`** — v3 (custo, margem, payback, IRR, NPV)
- **`proposta`** — v3 (número, versão, status, validade)
- **`governanca`** — freeze_status, snapshots, revisões, auditoria, comercial
- **`homologacao`** — status, checklist legado + S9.0 assistida (status_homologacao, historico)
- **`arranjos[].baterias[]`** — BESS por arranjo (schema existe, UI ausente)

---

## FASE 2 — ORÇAMENTO

### 1. Onde fica?

O sistema tem **dois contextos distintos** de orçamento:

**Contexto A — Wizard (E8Orcamento.jsx):**
- Existe como etapa final do wizard (`/projetos-fv/novo`)
- Calcula: subtotais de painel, inversor, estrutura, mão de obra, cabos e proteções
- Gera PDF via jsPDF + proposta HTML comercial
- Salva em `orcamento` (schema v3) ao persistir o projeto
- Disponível: **somente durante a criação**

**Contexto B — Tela de Detalhes (PropostaEnterprise.jsx):**
- Fica na aba `Comercial` de `ProjetosFVDetalhes.jsx`
- Recebe `resultadoFinanceiro={null}` (hardcoded) → sem valores
- Recebe `snapshotTecnico={projeto.governanca?.snapshot_tecnico}` (só existe se congelado)
- Resultado: a aba Comercial mostra o workflow (estados, assinaturas) mas **sem valores financeiros reais** para comparar ou negociar

### 2. Quando é executada?

No wizard, **entre E7 (Equipamentos) e o fim do fluxo**. Não há orçamento disponível após o wizard sem reabrir o projeto no modo edição.

### 3. Antes ou depois do unifilar?

**Antes** — E8 gera o unifilar SVG durante o orçamento. O unifilar formal (aba Unifilar) é gerado depois, a partir dos dados do projeto salvo.

### 4. O orçamento influencia a engenharia?

**Não diretamente.** O orçamento usa os dados de engenharia (dimensionamento, equipamentos), mas a engenharia (unifilar, memorial) não é bloqueada pelo status do orçamento. Não há gate de "orçamento aprovado" antes de gerar o unifilar.

### 5. O unifilar usa equipamentos orçados?

**Parcialmente** — o unifilar usa `projeto.equipamentos` e `projeto.dimensionamento`, que são os dados salvos pelo wizard (incluindo os equipamentos selecionados). Se o cliente não aprovou o orçamento mas o técnico gerou o unifilar, o documento reflete equipamentos pré-aprovação.

---

## FASE 3 — UNIFILAR

### O unifilar é gerado a partir de:

**A) Dimensionamento (atual)** — CONFIRMADO como fonte primária.

**Evidência em `UnifilarFV.jsx:8-26`:**
```js
const svgCongelado = projeto?.governanca?.snapshot_unifilar?.svg || null
const [unifilar, setUnifilar] = useState(svgCongelado)

async function handleGerarUnifilar() {
  const svg = gerarUnifilarSVG(projeto)   // ← recebe o projeto inteiro
  setUnifilar(svg)
  setOrigem('dados_atuais')
}
```

**Evidência em `gerarUnifilarSVG` (E8Orcamento.jsx:170-199):**
```js
const svg = gerarUnifilarSVG({
  nome: dadosCliente.nomeProjeto,
  dimensionamento: { numPaineis, numStrings, potenciaArredondada },
  tipo_ligacao, tensao, distribuidora,
  painel, inversor,
  arranjoMPPTs, uf,
})
```

O unifilar usa:
- `dimensionamento.numPaineis`, `numStrings`, `potenciaArredondada`
- `equipamentos.painel` (marca, modelo, potência)
- `equipamentos.inversor` (marca, modelo)
- `dadosConsumo.tipo_ligacao`, `tensao`, `concessionaria`

**Conclusão:** O unifilar é gerado a partir do **dimensionamento atual + equipamentos selecionados**, não a partir de um estado de aprovação formal. Se o snapshot congelado (`governanca.snapshot_unifilar`) existir, ele tem prioridade (imutável). Caso contrário, gera "ao vivo" com dados atuais.

**Gap identificado (GAP-05):** não há gate de orçamento aprovado antes de gerar o unifilar.

---

## FASE 4 — HOMOLOGAÇÃO

### Classificação: FUNCIONAL (backend + componente) / PLACEHOLDER (tela principal)

#### Backend — FUNCIONAL

**Endpoints em `/api/projetos-fv/:id/homologacao`:**
| Endpoint | Status |
|---------|--------|
| `GET /checklist` | FUNCIONAL — gera checklist por estado/concessionária |
| `PATCH /checklist` | FUNCIONAL — salva progresso |
| `POST /memorial` | FUNCIONAL — gera memorial descritivo |
| `POST /carta` | FUNCIONAL — gera carta à concessionária |
| `GET /art` | FUNCIONAL — dados para ART |
| `GET /status` | FUNCIONAL |
| `PATCH /status` | FUNCIONAL |
| `GET /assistida/checklist` | FUNCIONAL — checklist inteligente por equip. |
| `GET /assistida/validacao` | FUNCIONAL |
| `GET /assistida/pacote` | FUNCIONAL |
| `PATCH /assistida/status` | FUNCIONAL com histórico |
| `GET /assistida/regras` | FUNCIONAL |

**Schema `ProjetoFV.homologacao`:**
- `status` (legado: rascunho/enviado/analise/aprovado/conectado)
- `status_homologacao` (S9.0: nao_iniciado → homologado)
- `historico_status` com rastreabilidade de transições
- Campos para datas, responsáveis, concessionária

#### Componente Frontend — FUNCIONAL (mas desconectado)

**`components/fv/homologacao/Homologacao.jsx`** — componente completo com:
- Checklist de documentos (por concessionária e estado)
- Memorial Descritivo (geração automática)
- Carta à Concessionária
- Dados para ART
- Status da homologação (5 estados + barra de progresso)

#### Tela Principal — PLACEHOLDER ❌

**`ProjetosFVDetalhes.jsx:596-605`:**
```jsx
function AbaHomologacao() {
  return (
    <Card>
      <CardHeader>Documentos de Homologação</CardHeader>
      <CardBody>
        <p className="text-slate-600">Homologação em desenvolvimento...</p>
      </CardBody>
    </Card>
  )
}
```

O componente `Homologacao.jsx` **não é importado** em `ProjetosFVDetalhes.jsx`. A aba Homologação exibe apenas um stub. O componente real existe e funciona — só está desconectado.

**Correção (GAP-01):** 1 arquivo, ~25 linhas. Substituir `AbaHomologacao()` por:
```jsx
import Homologacao from '../components/fv/homologacao/Homologacao'
// ...
{abaAtiva === 'homologacao' && (
  <Homologacao
    projetoId={id}
    projeto={projeto}
    cliente={{ nome: projeto.clienteId?.nome, email: projeto.clienteId?.email }}
  />
)}
```

---

## FASE 5 — GOVERNANÇA

### Gap: congelar na tela de detalhes não captura snapshot técnico

**Causa:**

`ProjetosFVDetalhes.jsx:216-228` renderiza `GovernancaPainel` sem a prop `construirSnapshots`:

```jsx
<GovernancaPainel
  projetoId={id}
  governanca={projeto.governanca}
  onAtualizar={(g) => setProjeto(p => ({ ...p, governanca: g }))}
  usuario={null}
  // ← AUSENTE: construirSnapshots
/>
```

`GovernancaPainel.jsx:59`:
```js
const snapshots = construirSnapshots ? construirSnapshots() : {}
```

Sem o prop, o payload enviado ao backend é `{ snapshots: {} }`.

**Contraste:** No wizard (`E8Orcamento.jsx`), `GovernancaPainel` recebe `construirSnapshots={construirSnapshotsE8}` que gera snapshots técnico, catálogo, unifilar, financeiro e geoespacial.

**Impacto:**
- `projeto.governanca.snapshot_tecnico` permanece `null` após congelar pela tela de detalhes
- `projeto.governanca.snapshot_catalogo` = `null` → verificação de divergência inoperante
- `projeto.governanca.snapshot_unifilar` = `null` → UnifilarFV cai para "gera ao vivo"
- `projeto.governanca.snapshot_financeiro` = `null` → AbaFinanceiro sem valores congelados

**Esforço:** Médio — criar `construirSnapshotsProjeto()` em ProjetosFVDetalhes que derive snapshot dos dados do projeto salvo (sem precisar do estado do wizard).

---

## FASE 6 — BENEFICIÁRIAS

### 1. Quando a Prioridade desapareceu?

`tipoRateio = 'prioridade'` **nunca esteve visível na UI**. O campo existe no schema desde a criação de `UnidadeBeneficiaria.js` (Sprint 7/8.7), mas o formulário em `BeneficiariasPainel.jsx` sempre inicializou com `tipoRateio: 'percentual'` e nunca expôs seletor para alterar.

**Evidência — `BeneficiariasPainel.jsx:47-48`:**
```js
const [novoForm, setNovoForm] = useState({
  contaContrato: '', valor: '', titular: '', cpf_cnpj: '', concessionaria: '',
  tipoRateio: 'percentual'   // ← hardcoded, sem seletor de UI
})
```

### 2. O backend ainda suporta Prioridade?

**Sim.** `UnidadeBeneficiaria.js:31`:
```js
tipoRateio: {
  type: String,
  enum: ['percentual', 'prioridade'],
  required: true,
},
```

O endpoint `POST /api/projetos-fv/:id/beneficiarias` aceita `tipoRateio: 'prioridade'`.

### 3. É regressão de UI?

**Não** — nunca foi implementada. É uma feature **existente no schema mas não exposta na UI**.

### 4. É apenas ocultação?

Sim. O campo existe no banco, o backend valida, mas a UI fixa o valor como 'percentual'. Não há toggle ou seletor para o usuário escolher o tipo de rateio.

---

## FASE 7 — MATRIZ DE GAPS (RESUMO)

### P0 — Bloqueio operacional imediato

| ID | Gap | Arquivo | Esforço |
|----|-----|---------|---------|
| GAP-01 | Homologação é stub (componente real desconectado) | ProjetosFVDetalhes.jsx:596 | PEQUENO |
| GAP-04 | `nomeCliente` indefinido em projetos novos | ProjetosFVDetalhes.jsx (8+ locais) | PEQUENO |
| GAP-03 | Governança: congelar sem snapshot técnico | ProjetosFVDetalhes.jsx:216-228 | MÉDIO |
| GAP-02 | Orçamento/Comercial sem resultadoFinanceiro | ProjetosFVDetalhes.jsx:235 | MÉDIO |

### P1 — Gap funcional relevante

| ID | Gap | Arquivo | Esforço |
|----|-----|---------|---------|
| GAP-05 | Unifilar sem gate de aprovação | UnifilarFV.jsx | PEQUENO |
| GAP-09 | Beneficiárias sem tipoRateio=prioridade | BeneficiariasPainel.jsx | PEQUENO |
| GAP-07 | Instalação completamente ausente | — | GRANDE |
| GAP-08 | Comissionamento desconectado do ProjetoFV | Ativo.js + detalhes | MÉDIO |

### P2 — Melhorias de qualidade

| ID | Gap | Arquivo | Esforço |
|----|-----|---------|---------|
| GAP-10 | AbaFinanceiro usa dados legados (não snapshot) | ProjetosFVDetalhes.jsx | PEQUENO |
| GAP-06 | BESS placeholder | AbaBESS + schema | GRANDE |
| GAP-11 | Operação sem link ao projeto FV | AtivoQR + ProjetoFV | GRANDE |

---

## Entregáveis

| Arquivo | Status |
|---------|--------|
| `FV_FLOW_FORENSICS_REPORT.md` | ✅ Este arquivo |
| `FV_FLOW_REAL_VS_SYSTEM.json` | ✅ Gerado |
| `FV_FLOW_GAP_MATRIX.json` | ✅ Gerado |
| `FV_FLOW_PRIORITY_ROADMAP.json` | ✅ Gerado |

**Nenhum código foi alterado. Nenhum dado foi alterado. Nenhum commit foi criado.**
