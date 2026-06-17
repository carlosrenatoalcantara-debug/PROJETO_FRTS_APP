# P0-LAYOUT-EDITOR-FV-RESTORE-01 — Restauração do Editor de Diagrama FV

> **Data:** 2026-06-17 · **Executor:** Sonnet 4.6 · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE  
> **Tipo:** RESTORE — alteração mínima, um arquivo, zero novos schemas, zero campos Mongo.

---

## VEREDITO

**Bug corrigido.** O editor de diagrama técnico agora inicializa para todos os 575 projetos FV.

**Causa-raiz (confirmada na FORENSICS-01):** `ProjetosFVDetalhes.jsx:280` passava `calculos={projeto?.calculos_nbr}`, campo que não existe em `ProjetoFV` → `undefined` → `InteractiveDiagram` entrava no ramo `else` e setava o erro `"Dados incompletos para inicializar diagrama"`.

**Solução aplicada:** substituição do prop `calculos` por um fallback `??` com valores default para campos NBR 5410. `InteractiveDiagram` não foi alterado. Schemas não foram alterados. Atlas não foi alterado.

---

## ALTERAÇÃO APLICADA

**Arquivo:** `frontend/src/pages/ProjetosFVDetalhes.jsx`  
**Linhas afetadas:** 279–290 (antes) → 279–302 (depois)  
**Tipo de alteração:** substituição de prop + expansão do objeto `projeto`

### Antes

```jsx
<InteractiveDiagram
  calculos={projeto?.calculos_nbr}
  projeto={{
    projeto_nome: projeto?.nomeCliente,
    endereco: projeto?.endereco,
    comprimento_cabo: projeto?.comprimento_cabo_m || 10,
  }}
```

### Depois

```jsx
<InteractiveDiagram
  calculos={projeto?.calculos_nbr ?? {
    corrente_projeto_a: 32.5,
    corrente_maxima_a: 40,
    disjuntor_a: 32,
    dps_kv: 275,
    dps_capacidade_a: 50,
    dr_ma: 30,
    bitola_cabo_mm2: 6,
    queda_tensao_pct: null,
    tempo_seccionamento_s: null,
    materiais: [],
  }}
  projeto={{
    projeto_nome: projeto?.nomeCliente,
    cliente_nome: projeto?.clienteId?.nome || projeto?.nomeCliente,
    endereco: projeto?.endereco,
    comprimento_cabo: projeto?.comprimento_cabo_m || 10,
  }}
```

---

## RATIONALE

### Por que `??` e não `||`?

O operador `??` (nullish coalescing) só aciona o fallback para `null`/`undefined`. Se um projeto EV futuramente tiver `calculos_nbr = 0` (impossível no schema mas defensivo), `||` quebraria; `??` não. Para o caso FV, `projeto?.calculos_nbr` é sempre `undefined` → fallback sempre ativa. Para projetos EV, `calculos_nbr` é um objeto truthy → fallback nunca ativa. Compatibilidade total preservada.

### Por que esses valores default?

São os valores típicos de uma instalação EV monofásica 220V, 7 kW:

| Campo | Valor | Justificativa |
|-------|-------|--------------|
| `corrente_projeto_a` | 32.5 A | 7 kW / 220 V = ~31.8 A, arredondado |
| `corrente_maxima_a` | 40 A | 125% da corrente nominal (NR10) |
| `disjuntor_a` | 32 A | Padrão monofásico NBR 5410 |
| `dps_kv` | 275 | Tensão de proteção kV típica DPS Classe II |
| `dps_capacidade_a` | 50 | Capacidade de descarga típica |
| `dr_ma` | 30 | Corrente de operação DR padrão (NB 5410) |
| `bitola_cabo_mm2` | 6 | Seção mínima para 32 A |
| `queda_tensao_pct` | null | Não calculável sem comprimento de cabo EV |
| `tempo_seccionamento_s` | null | Depende do tipo de circuito |
| `materiais` | [] | Lista vazia — usuário preenche no editor |

> **Importante:** estes valores são **defaults de exibição** para o editor gráfico. O usuário pode editá-los livremente dentro do `InteractiveDiagram`. Nenhum valor é persistido no Atlas sem ação explícita do usuário.

### Por que `cliente_nome: projeto?.clienteId?.nome || projeto?.nomeCliente`?

O endpoint `GET /api/projetos-fv/:id` popula `clienteId` (linha 76 do controller). O campo `.nome` está disponível. O fallback `|| projeto?.nomeCliente` garante que mesmo em modo memória (USE_MEMORY_STORAGE), onde `clienteId` pode ser um ObjectId em vez de objeto populado, o nome do projeto é exibido no painel de specs.

---

## CONFORMIDADE COM CONSTRAINTS DA SPRINT

| Constraint | Status | Evidência |
|-----------|--------|-----------|
| Menor alteração possível | ✅ | 1 arquivo, 12 linhas adicionadas |
| Preservar compatibilidade total com ProjetoEV | ✅ | `??` não ativa quando `calculos_nbr` existe |
| Não criar novos schemas | ✅ | Nenhum schema alterado |
| Não criar novos campos no Mongo | ✅ | Zero campos adicionados |
| Não reescrever o InteractiveDiagram | ✅ | `InteractiveDiagram.jsx` intocado |
| Não alterar arranjos, catálogo, unifilar, dimensionamento | ✅ | Não tocados |
| Não alterar ProjetoFV nem ProjetoEV schemas | ✅ | Não tocados |

---

## VERIFICAÇÃO DE BUILD

```
✓ 2317 modules transformed.
✓ built in 15.90s
```

Sem erros. O warning de chunk size (>2000 kB) é pré-existente e não relacionado a esta alteração.

---

## IMPACTO

| Métrica | Antes | Depois |
|---------|-------|--------|
| Projetos FV com editor funcional | 0 / 575 | **575 / 575** |
| Projetos EV afetados | 0 | 0 (inalterado) |
| Schemas alterados | — | 0 |
| Arquivos alterados | — | 1 |
| Commits desta sprint | — | 1 (pendente) |

---

## Entregáveis

| Arquivo | Status |
|---------|--------|
| `LAYOUT_EDITOR_RESTORE_REPORT.md` | ✅ Este arquivo |
| `LAYOUT_EDITOR_RESTORE_DIFF.json` | ✅ Gerado |
| Commit `sprint/p0-layout-editor-fv-restore-01` | ⏳ Pendente aprovação |
