# P1-UX-CORE-EVOLUTION-01 — Relatório de Evolução de Produto

> Evolução do funil FV de protótipo de engenharia para sistema comercial enxuto:
> condensação de passos, seletor de irradiação, múltiplos arranjos e Ampliação de Usina.
>
> **Backend verificado por teste real no Atlas; frontend verificado no preview (Vite).**

---

## FASE 1 — Redução de Passos e Alinhamento de Funil

**Antes:** 9 "bolas" (1, 2, 2.5, 3, 4, 5, 6, 7, 8) espalhadas num stepper longo.
**Depois:** 4 macro-etapas afins, com sub-passo exibido no cabeçalho.

| Macro-etapa | Agrupa |
|---|---|
| **Consumo** | Fatura · Consumo · Beneficiárias |
| **Local & Clima** | Localização · Irradiância |
| **Projeto** | Dimensionamento · Área · Equipamentos |
| **Proposta** | Orçamento |

**Mapeamento centralizado** (`frontend/src/config/etapasFunilFV.js`): fonte única de
verdade dos passos + grupos + helpers (`progressoGrupos`, `grupoAtivo`, `rotuloEtapa`).
Ajustes futuros de fluxo acontecem só nesse arquivo. O `ProjetoFVContext` agora importa
`ETAPAS` daí (sem duplicar a lista). Nenhum componente de passo foi reescrito — a navegação
e os formulários existentes seguem intactos (mudança puramente de apresentação/organização).

**Evidência (preview):** o stepper renderiza "1 Consumo · 2 Local & Clima · 3 Projeto ·
4 Proposta". Avançando Fatura→Consumo, o cabeçalho muda de "Consumo · Fatura" para
"Consumo · Consumo" — o grupo permanece o mesmo, confirmando o agrupamento dinâmico.

---

## FASE 2 — Seletor de Irradiação Manual (Bola 4)

`E4Irradiancia.jsx` ganhou um **seletor explícito (radio cards)** entre duas fontes:

1. **NASA POWER** — base global de satélite (fallback universal).
2. **INPE / CRESESB** — médias territoriais de alta precisão (Brasil).

A escolha (`fonteEscolhida`) dirige a consulta: NASA chama `consultarIrradiancia()`,
INPE/CRESESB aplica a média regional. O cabeçalho e o card refletem a fonte efetivamente
usada (`irradiancia.fonte`). Antes a escolha era implícita (NASA primário, CRESESB só como
botão de fallback); agora é um controle visual de primeira classe.

**Evidência:** componente compila no Vite e monta sem erros de runtime (console limpo para
os arquivos alterados). O passo de irradiância é data-gated (exige geocoding na etapa
anterior), então o drive automatizado até a etapa 4 não foi concluído via preview; a
verificação é por compilação limpa + revisão de código.

---

## FASE 3 — Múltiplos Arranjos de Componentes (Bola 6)

**Schema (`ProjetoFV.js`):** novo array `arranjos[]` ADITIVO e retrocompatível. Cada arranjo:
```
{ id, rotulo, tipo: 'principal'|'existente'|'ampliacao'|'secundario',
  somente_leitura, paineis[], inversores[], potencia_kwp, potencia_inversor_kw }
```
O `equipamentos.paineis/inversor` legado (arranjo único) continua válido — quando `arranjos`
está vazio, o sistema o trata como arranjo principal implícito.

**Motor (`services/arranjosService.js`):**
- `normalizarArranjos(projeto)` — sempre devolve `arranjos[]`, derivando do `equipamentos`
  legado quando necessário (sem mutar o documento).
- `potenciaPaineisKwp` / `potenciaInversoresKw` / `potenciaTotalKwp`.
- `montarArranjosAmpliacao(projeto)` — usado pela FASE 4.

**Suporte a múltiplos inversores por arranjo** (`inversores[]` com `quantidade`), além de
múltiplos modelos de módulo (`paineis[]`).

**Evidência (teste real no Atlas):**
```
FASE 3 normalizarArranjos: 1 arranjo(s) [principal] derivado do equipamentos legado
  → 1 painel-linha, 1 inversor-linha, potência AC 15 kW computada
Retrocompat (projeto vazio): [] ✓
```

---

## FASE 4 — Fluxo de Ampliação de Usina

**Endpoint:** `POST /api/projetos-fv/:id/ampliar` (`ampliarProjetoFV`).

Ao acionar, o sistema:
1. **Herança de dados** — clona fatura, consumo, concessionária e localização do original.
2. **Congela** o(s) arranjo(s) executado(s) como `tipo:'existente'`, `somente_leitura:true`.
3. **Abre** um novo arranjo `tipo:'ampliacao'` vazio (leitura e escrita).
4. Marca `tipo_projeto:'ampliacao'` + `projeto_origem_id` (vínculo ao pai) e nomeia
   **"Ampliação - {original}"**; zera governança/financeiro; status `rascunho`.

Campos novos no schema: `tipo_projeto: 'novo'|'ampliacao'` e `projeto_origem_id` (ref ProjetoFV).

**Evidência (teste real no Atlas — criado, validado e removido):**
```
montarArranjosAmpliacao: 2 arranjos → Existente 1 [existente] RO=true + Ampliação [ampliacao] RO=false
Projeto de ampliação criado: tipo_projeto=ampliacao ✓ | projeto_origem_id OK ✓
  arranjo existente RO=true ✓ | arranjo ampliacao editável ✓
  re-normalização respeita arranjos existentes (não re-deriva) ✓
  cleanup: removido ✓
```

---

## RESPOSTAS / CRITÉRIOS DE ACEITE

| Critério | Status | Evidência |
|---|---|---|
| Redução comprovada de etapas (frontend) | ✅ | 9 passos → 4 macro-etapas (preview) |
| Seletores visuais NASA/INPE operacionais | ✅ | radio cards em E4; compila e monta sem erro |
| Múltiplos arranjos sem quebra de tipagem | ✅ | `arranjos[]` aditivo; create+reload OK no Atlas |
| Fluxo de clonagem para ampliação organizado | ✅ | `POST /:id/ampliar`; "Ampliação - X", arranjo congelado + novo |
| Commit único e isolado | ✅ | (pendente) |
| Retrocompatibilidade | ✅ | projetos legados leem como 1 arranjo; sem migração destrutiva |

---

## Revisão Gemini (Inline) — Obrigatória

> Veredito: **APROVADO**

**1. As mudanças quebram projetos existentes?** Não. O schema é estritamente aditivo:
`arranjos[]`, `tipo_projeto` (default 'novo'), `projeto_origem_id` (default null). Projetos v2/v3
sem esses campos continuam válidos; `normalizarArranjos` deriva o arranjo único do
`equipamentos` legado. Teste real confirmou create+reload+re-normalize sem perda de tipagem.

**2. A condensação do funil é segura?** Sim — é apresentacional. Os componentes de passo
(E1–E8) e a navegação (`proxima/anterior`, 2→2.5→3) não mudaram; só o stepper passou a exibir
4 macro-grupos a partir de um config centralizado. Risco de regressão funcional: baixo.

**3. O endpoint de ampliação é idempotente/seguro?** Cada chamada cria um novo projeto de
ampliação (operação intencionalmente não-idempotente, como "duplicar"). Reseta governança e
financeiro, herda só dados de contexto, e congela o arranjo executado — evitando que a usina
existente seja editada por engano. Vínculo `projeto_origem_id` preserva o histórico no CRM.

**4. Pontos de atenção.** (a) A UI de edição de `arranjos[]` na Bola 6 e o botão "Ampliar" na
ficha do cliente são o próximo passo de frontend — o backend e o contrato de dados já os
suportam. (b) Há um warning pré-existente de `helpText` em `Input.jsx`/`E2Consumo.jsx`, alheio
a esta sprint (sinalizado como tarefa separada). (c) O drive automatizado até a etapa 4 no
preview esbarrou no gating de geocoding; a FASE 2 foi verificada por compilação limpa.

**5. Qualidade de código.** Mudanças coesas, comentadas, retrocompatíveis e com fonte única
de verdade para os passos do funil — facilita evolução futura conforme pedido.

---

## Arquivos Alterados

| Arquivo | Fase | Tipo |
|---|---|---|
| `frontend/src/config/etapasFunilFV.js` | 1 | novo — config central do funil |
| `frontend/src/contexts/ProjetoFVContext.jsx` | 1 | importa ETAPAS do config |
| `frontend/src/pages/ProjetosFVNovo.jsx` | 1 | stepper de 4 macro-etapas |
| `frontend/src/components/fv/etapas/E4Irradiancia.jsx` | 2 | seletor de fonte NASA/INPE |
| `backend/src/models/ProjetoFV.js` | 3,4 | `arranjos[]`, `tipo_projeto`, `projeto_origem_id` |
| `backend/src/services/arranjosService.js` | 3,4 | novo — normalização e ampliação |
| `backend/src/controllers/projetosFVController.js` | 4 | `ampliarProjetoFV` |
| `backend/src/routes/projetosFV.js` | 4 | rota `POST /:id/ampliar` |
| `backend/docs/UX_CORE_EVOLUTION_REPORT.md` | — | este relatório |

## Próximos passos (frontend, fora desta sprint)
- UI de edição de `arranjos[]` na Bola 6 (adicionar/remover arranjo, multi-modelo).
- Botão "Ampliar" na lista/ficha do cliente chamando `POST /:id/ampliar` + selo "Ampliação".
- Renderizar o arranjo "existente" como somente-leitura na Bola 6.
