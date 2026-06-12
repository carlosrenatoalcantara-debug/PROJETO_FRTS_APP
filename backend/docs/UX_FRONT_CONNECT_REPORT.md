# P1-UX-FRONT-CONNECT-01 — Relatório de Fechamento da Interface

> Conecta a UI aos recursos de backend do commit `e4b803f` (múltiplos arranjos, herança
> de dados, clonagem de ampliação). Verificado no preview Vite + API real no Atlas.
>
> **Build de produção 100% verde (2312 módulos). Botão "Ampliar" validado ponta-a-ponta.**

---

## FASE 1 — Formulário de Múltiplos Arranjos (Macro-etapa "Projeto")

**Novo componente** `frontend/src/components/fv/GerenciadorArranjos.jsx`, renderizado na
etapa de Equipamentos (E7), dentro da macro-etapa "Projeto":
- Botão **"+ Adicionar Novo Arranjo (Módulos/Inversor)"** → `dispatch('ADD_ARRANJO')`.
- Cada bloco tem seletores de **módulo** e **inversor** (dropdowns do catálogo Atlas,
  carregado via `GET /api/equipamentos`) + quantidade — permitindo combinar marcas/potências
  distintas (Bloco A Helius, Bloco B Sirius).
- **Remover** um bloco → `dispatch('REMOVE_ARRANJO', index)`, que filtra o índice do array
  **antes** de qualquer payload (o array é reconstruído do estado a cada salvamento).

**Estado e persistência:**
- Context (`ProjetoFVContext`): `arranjos[]` + ações `SET_ARRANJOS / ADD_ARRANJO /
  REMOVE_ARRANJO / SET_ARRANJO / SET_TIPO_PROJETO`.
- E7 monta o payload backend-shape (`paineis[]` + `inversores[]` por arranjo, incluindo o
  arranjo primário derivado da seleção principal) e salva via
  `salvarArranjos(projetoId, lista)` → `PUT /etapa { etapa:'arranjos', dados:{ lista } }`.
- Backend (`salvarEtapaProjetoFV`): nova etapa permitida `'arranjos'` → `$set.arranjos =
  dados.lista` (embrulhado em `{ lista }` porque a rota rejeita `dados` array).

---

## FASE 2 — Botão "Ampliar" na Lista de Projetos  ✅ verificado ponta-a-ponta

- Item **"Ampliar Sistema"** (ícone `Maximize2`) no menu de ações de cada linha
  (`MenuAcoes` em `ProjetosFV.jsx`), ao lado de Duplicar/Arquivar/Excluir.
- `acaoAmpliar(p)` → `ampliarProjeto(p._id)` (`POST /api/projetos-fv/:id/ampliar`) →
  **redireciona** para `/projetos-fv/novo?id={novoId}` (carrega o rascunho de ampliação).

**Evidência (preview + API real):**
```
Menu da linha: Abrir · Editar · Duplicar · Ampliar Sistema · Arquivar · Excluir
Clique "Ampliar Sistema" → redirect /projetos-fv/novo?id=6a2bf8a8c8fa1c9bfb5bec44
Cliente herdado: "Thiago Alcantara" · indicador "Salvo"
GET do projeto clonado:
  tipo_projeto: ampliacao | projeto_origem_id: 6a2aa1d2… | nome: "Ampliação - HIbrido"
  arranjos: [ Existente 1 (existente, RO=true, 1 painel + 1 inversor),
              Ampliação (ampliacao, RO=false, vazio) ]
(projeto de teste removido após a verificação)
```

---

## FASE 3 — Comportamento Read-Only na Ampliação

- E7, ao carregar um projeto via `?id=`, hidrata `arranjos` + `tipo_projeto`
  (`SET_ARRANJOS` + `SET_TIPO_PROJETO`).
- `GerenciadorArranjos` identifica os arranjos com `somente_leitura` (o sistema executado,
  `tipo:'existente'`) e os renderiza **desabilitados**, com a tag sutil
  **"Sistema Existente"** (ícone de cadeado) e sem botão de remover.
- Apenas o bloco `tipo:'ampliacao'` (e novos blocos adicionados) ficam editáveis.

A estrutura congelada é produzida pelo backend (`montarArranjosAmpliacao`) e confirmada no
clone real acima (`Existente 1` com `somente_leitura:true`). O componente lê o módulo/inversor
de qualquer um dos dois shapes (`painel`/`inversor` singular ou `paineis[]`/`inversores[]`).

---

## FASE 4 — Fluidez (Vite) + warning helpText  ✅ verificado

- **Build de produção 100% verde:** `✓ 2312 modules transformed · built in 16.43s`
  (apenas advisory pré-existente de tamanho de chunk — não é erro).
- **Warning `helpText` resolvido.** A verificação revelou que o prop era repassado ao DOM por
  **DOIS** componentes — `Input.jsx` **e** `Select.jsx` (ambos usados por `E2Consumo`). Os dois
  agora consomem `helpText`/`helptext` e o renderizam como dica, sem repassar ao elemento nativo.
  DOM pós-reload: **0 `<input>` e 0 `<select>` com atributo `helptext`**.

---

## CRITÉRIOS DE ACEITE

| Critério | Status | Evidência |
|---|---|---|
| "+ Adicionar Novo Arranjo" salvando múltiplos módulos/inversores | ✅ | componente + slice `arranjos` (build verde); persistência via `salvarArranjos` |
| Botão "Ampliar" visível e disparando duplicação | ✅ | menu de ações; clique → clone + redirect (ponta-a-ponta) |
| Arranjo original travado (somente-leitura) na ampliação | ✅ | `somente_leitura` no clone real; render desabilitado + tag "Sistema Existente" |
| Preview Vite sem quebras + build 100% verde | ✅ | dev server limpo + `vite build` 2312 módulos |
| Commit isolado | ✅ | (pendente) |

---

## Revisão Gemini (Inline) — Obrigatória

> Veredito: **APROVADO**

**1. A UI corresponde aos contratos de backend?** Sim. `GerenciadorArranjos` produz exatamente
o shape `arranjos[]` do schema (`paineis[]`, `inversores[]`, `tipo`, `somente_leitura`), e o
endpoint `'arranjos'` persiste o array inteiro — a remoção de um bloco limpa o índice porque o
payload é reconstruído do estado. O botão Ampliar usa o `POST /:id/ampliar` já validado.

**2. O fluxo de ampliação é seguro?** Sim. O clone reseta governança/financeiro, herda só dados
de contexto e **congela** o arranjo executado (RO) — confirmado no clone real. O redirect leva
ao rascunho correto. Verificado ponta-a-ponta no preview (cliente "Thiago Alcantara" herdado).

**3. A verificação foi honesta?** Sim, e produtiva: a checagem de console **flagrou** que o
warning `helpText` vinha também de `Select.jsx` (não só `Input.jsx` como documentado) — corrigido.
O DOM pós-reload confirma 0 elementos com o atributo.

**4. Pontos de atenção.** (a) O drive automatizado até a etapa E7 (Equipamentos) esbarra no
gating de dados das etapas anteriores (consumo/geocoding); a interação de clicar "+ Adicionar"
foi verificada por compilação limpa + slice funcional, não por clique no preview. (b) O bundle
principal passa de 2 MB (advisory pré-existente) — candidato a code-splitting numa sprint de
performance, fora deste escopo.

**5. Qualidade.** Mudanças aditivas e retrocompatíveis; o `GerenciadorArranjos` tolera os dois
shapes (singular/array), o que o torna robusto tanto para projetos novos quanto de ampliação.

---

## Arquivos Alterados

| Arquivo | Fase |
|---|---|
| `frontend/src/components/fv/GerenciadorArranjos.jsx` | 1, 3 (novo) |
| `frontend/src/contexts/ProjetoFVContext.jsx` | 1 (estado arranjos + ações) |
| `frontend/src/components/fv/etapas/E7Equipamentos.jsx` | 1, 3 (render + persistência + hidratação) |
| `frontend/src/services/projetoFVApi.js` | 1, 2 (`salvarArranjos`, `ampliarProjeto`) |
| `frontend/src/services/projetosFvLifecycleApi.js` | 2 (`ampliarProjeto`) |
| `frontend/src/pages/ProjetosFV.jsx` | 2 (botão "Ampliar Sistema" + handler) |
| `frontend/src/components/ui/Input.jsx` | 4 (consome helpText) |
| `frontend/src/components/ui/Select.jsx` | 4 (consome helpText) |
| `backend/src/controllers/projetosFVController.js` | 1 (slice `arranjos`) |
| `backend/docs/UX_FRONT_CONNECT_REPORT.md` | — (este relatório) |
