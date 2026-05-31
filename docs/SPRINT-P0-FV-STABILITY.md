# SPRINT P0-FV-STABILITY — Relatório Final

> Objetivo: estabilizar o núcleo FV. Sem novas funcionalidades, sem CAT-CLEAN-01,
> sem OCR treinável, sem Homologação UI. Nenhuma coleção/snapshot foi alterado.

## Resumo executivo

| ID | Bug | Severidade | Status |
|----|-----|------------|--------|
| P0-01 | Inversores não persistem após upload | **P0** | ✅ Corrigido |
| P0-02 | Não abre projetos salvos / não entra em edição | **P0** | ✅ Corrigido |
| P0-03 | Unifilar de outro projeto (chave por nome) | **P0** | ✅ Corrigido |
| P1-01 | Resumo sem dados recém-salvos | **P1** | ✅ Corrigido |
| P1-02 | Documentos sem dados recém-salvos | **P1** | ✅ Corrigido |
| P1-03 | Microinversores aceitam config impossível | **P1** | ✅ Corrigido |

Validação: `vite build` ✓ · `node --check` (3 arquivos) ✓ · 13 testes novos ✓
(348 testes totais; 23 falhas **pré-existentes** em `diagram/__tests__` — undo/redo,
connectionValidator, electricalCalculations, phase2.realista — confirmadas com as
alterações deste sprint *stashed*, portanto fora do escopo).

---

## P0-01 — Inversores não persistem

- **Causa raiz:** assimetria do guard de "lixo". O modal abortava só se fabricante
  **E** modelo fossem lixo (`&&`); o backend rejeitava com 422 se fabricante **OU**
  modelo fosse lixo (`||`). Extração parcial (marca boa, modelo lixo) → modal faz
  POST, backend devolve 422 silencioso → inversor não persistido.
- **Arquivo / função / linha:**
  - `backend/src/controllers/equipamentosController.js` → `criarEquipamento` (guard ~L190-201)
  - `frontend/src/components/equipamentos/ModalNovoInversor.jsx` → `processarItem` (~L104, ~L184-200)
- **Correção:** backend alinhado ao modal (`&&` — só rejeita se AMBOS lixo); caso
  parcial gera `req._avisoParcial` e devolve `_aviso` no 201. Modal passa a exibir o
  motivo exato do 422 (`codigo: motivo`).
- **Evidência:** `node --check` do controller OK; fluxo passa a retornar 201 com
  aviso em vez de 422 quando só um campo é lixo.

## P0-02 — Não abre projetos salvos / não entra em modo edição

- **Causa raiz:** o botão "Editar" navegava para `/projetos-fv/:id?wizard=1`, que
  cai em `ProjetosFVDetalhes` (somente leitura) e **ignora** `?wizard=1`. O wizard
  oficial (`ProjetosFVNovo`) só hidrata via **`?id=`** em `/projetos-fv/novo`.
- **Arquivo / função / linha:**
  - `frontend/src/pages/ProjetosFV.jsx` → `onEditar` (L324-330)
  - `frontend/src/pages/ProjetosFVDetalhes.jsx` → botão "Completar dados" (L429)
- **Correção:** navegação corrigida para `/projetos-fv/novo?id=${_id}`, que dispara
  `buscarProjeto(id)` e hidrata todos os slices (cliente, fatura, localização,
  dimensionamento, área, equipamentos). "Abrir" (visualização) já usava `_id`.
- **Mapa do fluxo:** CRM/Lista (`ProjetosFV`) → `navigate(_id)` →
  rota `projetos-fv/:id` (App.jsx L60) → `buscarProjetoFV` (controller L71) →
  `GET /api/projetos-fv/:id` devolve doc cru `enriquecer(p)` (sem wrapper).
- **Evidência:** edição agora entra no wizard hidratado; build OK.

## P0-03 — Unifilar de outro projeto

- **Causa raiz:** chave de localStorage derivada do **nome** do projeto. No wizard
  EV (`InteractiveDiagramWrapper`) a chave era `proposta-${nome || 'sem-nome'}` →
  dois projetos de mesmo nome (ou ambos sem nome) compartilhavam o mesmo slot.
- **Arquivo / função / linha:**
  - `frontend/src/pages/NovaPropostaEV.jsx` → `handleChange` (L896→ agora `draftId`)
  - `frontend/src/components/diagram/utils/diagramPersistence.js` → `salvarDiagramaLocal` (L29)
- **Correção:**
  1. Wizard EV usa `draftId` único por sessão (`ev-draft-<ts>-<rand>`), nunca o nome.
  2. Helper `chaveProjetoValida()` rejeita chaves vazias/ambíguas (`sem-nome`,
     `undefined`, `proposta-sem-nome`...) — `salvar/carregar` falham explícito em
     vez de cruzar dados. Telas de detalhe já usavam `projeto-fv-${_id}` /
     `projeto-ev-${_id}` (estáveis).
- **Evidência:** teste "dois _id distintos têm diagramas independentes" ✓ e
  "NÃO salva sob chave ambígua" ✓.

## P1-01 / P1-02 — Resumo / Documentos sem dados recém-salvos

- **Causa raiz:** o detalhe buscava o projeto **uma vez** na montagem (`useEffect
  [id]`) e a resposta podia vir do cache HTTP. Ao voltar do wizard, Resumo e
  Documentos (ambos leem o mesmo `projeto`) não refletiam o que acabou de ser salvo.
  A persistência por slices no backend está correta (merge em `salvarEtapaProjetoFV`).
- **Arquivo / função / linha:**
  - `frontend/src/pages/ProjetosFVDetalhes.jsx` → `carregarProjeto` (L40-51)
  - `frontend/src/components/fv/etapas/E8Orcamento.jsx` → salvar (L311)
- **Correção:**
  1. `fetch(..., { cache: 'no-store' })` + refetch em `focus`/`visibilitychange`.
  2. E8 deixou de engolir slices falhos: agora avisa o operador para re-salvar.
- **Evidência:** build OK; ao reganhar foco o detalhe relê do banco.

## P1-03 — Microinversores: validação física

- **Causa raiz:** `E7Equipamentos.validar()` só checava se painel/inversor/estrutura
  estavam selecionados. Nenhuma checagem de capacidade física → "20 módulos / 5
  microinversores" era aceito.
- **Arquivo / função / linha:**
  - Novo: `backend/src/utils/fv/validacaoMicroinversores.js` → `validarMicroinversores`
  - `frontend/src/components/fv/etapas/E7Equipamentos.jsx` → `validar` (L81+)
- **Correção:** helper puro com regras físicas — capacidade de entradas
  (`numModulos ≤ numMicros × entradasPorMicro`), limite do fabricante por micro,
  micro ocioso, oversizing CC/CA por micro, distribuição. E7 bloqueia topologia
  `micro` inválida com mensagem específica.
- **Evidência:** teste "BLOQUEIA 20 módulos / 5 micros / 1 entrada" ✓; "ACEITA
  20/5/4 entradas" ✓; +7 casos.

---

## Execução

- `cd frontend && npx vitest run src/utils/__tests__/p0FvStability.test.js` → **13/13 ✓**
- `cd frontend && npx vite build` → **✓ (2299 módulos)**
- `node --check` em equipamentosController, projetosFVController, validacaoMicroinversores → **✓**
- Falhas remanescentes (23) são **pré-existentes** em `diagram/__tests__` e não foram
  introduzidas por este sprint (confirmado com alterações *stashed*).
