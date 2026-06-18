# Sprint P1-BENEFICIARIAS-PRIORIDADE-01 — Relatório

**Data:** 2026-06-18
**Modelo:** Sonnet
**Revisão Gemini:** Opcional
**Branch:** sprint/p1-beneficiarias-prioridade-01
**Escopo alterado:** BeneficiariasPainel.jsx (frontend único). Backend, schema, Atlas, ProjetoEV, Governança, Homologação, Snapshot, Ativos, QR — intocados.

> **HONESTIDADE:** Build Vite executado com sucesso (0 erros). App não executada contra DB real.
> Comportamento validado por leitura do código e análise do fluxo. Testes automatizados: 0 afetados.

---

## FASE 1 — Auditoria

| Componente | Achado |
|---|---|
| `UnidadeBeneficiaria.js` | `tipoRateio: enum ['percentual', 'prioridade']` — **schema já pronto** |
| `beneficiariasController.js` | Validação de soma 100% só ativa quando `tipoRateio === 'percentual'` — **backend já pronto para prioridade** |
| `BeneficiariasPainel.jsx` (antes) | `novoForm.tipoRateio` hardcoded `'percentual'`; **sem seletor na UI** — BUG-BEN-01 confirmado |
| `beneficiariaRateio.js` | `validarRateio` filtra `tipoRateio === 'percentual'` — badge incorreto (0%) no modo prioridade se sem seletor |
| `ModalBeneficiaria.jsx` | Modal legado independente, não usado pelo painel principal — não alterado |
| Campo `concessionaria` | Presente em `novoForm` mas ausente do formulário de adição — adicionado nesta sprint |

---

## FASE 2 — Seletor de Tipo de Rateio

Seletor de rádio exibido **somente quando a lista está vazia** (estado `tipoRateioGlobal`).
Quando a lista tem itens, o modo é **derivado dos itens** (read-only, exibido como badge de texto).

```jsx
const modoRateio = lista.length > 0
  ? (lista.some(b => b.tipoRateio === 'prioridade') ? 'prioridade' : 'percentual')
  : tipoRateioGlobal
const isPrioridade = modoRateio === 'prioridade'
```

Opções:
- `Percentual (%)` — comportamento original
- `Prioridade (P1, P2…)` — novo

---

## FASE 3 — Modo Percentual (preservado)

Comportamento original **integralmente preservado**:
- Validação `valor` como float 0–100
- `RateioBadge` com soma em tempo real
- `validarRateio` do `beneficiariaRateio.js` sem alteração
- Import Excel/CSV continua produzindo itens com `tipoRateio: 'percentual'`

---

## FASE 4 — Modo Prioridade

### UI
- Coluna da tabela: **"Prioridade"** (ao invés de "% Rateio")
- Valor exibido: **`P1`, `P2`, `P3`...** (ao invés de `50%`)
- Campo de edição: `type="number" min="1" step="1"` (inteiro)
- Formulário de adição: label **"Prioridade *"**, input inteiro ≥ 1
- Badge: `PrioridadeBadge` — conta UCs ativas, alerta se há duplicatas

### Validação na adição
```js
if (isPrioridade) {
  const prio = parseInt(novoForm.valor, 10)
  if (isNaN(prio) || prio < 1) { flash('Prioridade deve ser um número inteiro ≥ 1.') }
}
```

### Backend
- `tipoRateio: 'prioridade'` enviado com `valor: parseInt(...)` 
- Schema aceita `prioridade` no enum; controller não valida soma para prioridade
- Sem alteração no backend

---

## FASE 5 — Auto-preenchimento

Ao digitar a UC no formulário de adição, `onUcChange` busca na `lista` existente:

```js
function onUcChange(uc) {
  setNovoForm(f => {
    const match = uc.trim() ? lista.find(b => b.contaContrato === uc.trim()) : null
    return {
      ...f, contaContrato: uc,
      titular: match?.titular && !f.titular ? match.titular : f.titular,
      cpf_cnpj: match?.cpf_cnpj && !f.cpf_cnpj ? match.cpf_cnpj : f.cpf_cnpj,
      concessionaria: match?.concessionaria && !f.concessionaria ? match.concessionaria : f.concessionaria,
    }
  })
}
```

**Limitação honesta:** a fonte de dados é a própria lista já carregada. Serve para re-adicionar UCs removidas (dados não estarão mais na lista) ou para preflight de UCs que ainda estão na lista com dados. Não há endpoint externo de consulta de UCs.

**Campo `concessionaria` adicionado ao formulário** de adição (estava só em `novoForm` sem UI).

---

## FASE 6 — Validação de fluxo (análise de código)

| Cenário | Resultado esperado |
|---|---|
| Lista vazia → seletor Percentual | RateioBadge vazio; formulário com "% Rateio *" |
| Lista vazia → seletor Prioridade | PrioridadeBadge vazio; formulário com "Prioridade *" |
| Adicionar percentual válido | POST com `tipoRateio:'percentual'`, `valor: float`; lista recarrega |
| Adicionar prioridade 1 | POST com `tipoRateio:'prioridade'`, `valor: 1`; lista recarrega |
| Prioridade duplicada | PrioridadeBadge vermelho/âmbar com "(duplicatas!)" |
| Editar valor no modo prioridade | Input inteiro; PUT com valor inteiro |
| Lista com itens percentual | Modo travado em percentual; RateioBadge visível |
| Lista com itens prioridade | Modo travado em prioridade; PrioridadeBadge visível |
| somenteLeitura=true | Seletor e formulário ocultos; tabela read-only |

**App não executada contra DB — validação por análise de fluxo.**

---

## Arquivos alterados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/src/components/fv/BeneficiariasPainel.jsx` | MODIFICADO | Seletor modo, PrioridadeBadge, modo prioridade, auto-preenchimento, campo concessionaria |

## Não alterados

- Schema `UnidadeBeneficiaria.js` (já suportava prioridade)
- `beneficiariasController.js` (já suportava prioridade)
- `beneficiariaRateio.js` (validarRateio não alterada)
- `ModalBeneficiaria.jsx` (modal legado independente)
- Atlas, ProjetoEV, Governança, Homologação, Snapshot, Ativos, QR

---

## Limitações honestas

1. **Auto-preenchimento** depende de UCs já existentes na lista — não há consulta externa.
2. **Importação Excel/CSV** no modo prioridade: o parser de `parsearTextoExcel` continua emitindo `tipoRateio: 'percentual'` — se importar no modo prioridade, os itens chegam como percentual. Não corrigido nesta sprint (fora de escopo).
3. **App não executada** contra DB real — sem MONGODB_URI nesta sessão.
4. **`node --check`** não aplicável a JSX; validado via **`vite build`** (0 erros).
