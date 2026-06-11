# P0-PROJETO-OPEN-BUG-01 — Projetos não abrem ao clicar (ficha do cliente)

> Correção da **causa raiz** (sem workaround) da falha em abrir projetos pela ficha do cliente.
> Escopo: **apenas abertura de projetos**. Não toca catálogo/SolarMarket/clientes/propostas/OCR/parser.

## FASE 1 — Reprodução

| Cenário | Esperado | Real (bug) |
|---|---|---|
| Clicar projeto FV **nativo** na ficha do cliente | abre `/projetos-fv/:id` | **nada acontece** |
| Clicar projeto FV **importado** (SolarMarket) | abre `/projetos-fv/:id` | **nada acontece** |
| Clicar projeto **EV** na ficha do cliente | abre `/projetos-ev/:id` | **nada acontece** |
| Abrir pela **tela de projetos** (`/projetos-fv`) | abre via ação "Abrir" | **funciona** (menu de ações) |
| Navegação **direta por URL** (`/projetos-fv/:id`) | abre | **funciona** |

→ O bug é **exclusivo da ficha do cliente** (`ClienteGerenciamento`) e afeta **nativos e importados
igualmente** — pista de que **não** é roteamento, id divergente nem backend.

## FASE 2 — Inspeção da UI

[`ClienteGerenciamento.jsx`](frontend/src/pages/ClienteGerenciamento.jsx) — seções "Projetos FV" e
"Projetos EV". As linhas da tabela eram:

```jsx
<tr key={p._id} className="border-b hover:bg-slate-50 cursor-pointer">
```

**`cursor-pointer` + `hover:bg-slate-50`** dão aparência de clicável, mas **não havia `onClick`** na
linha (nem botão/link interno). O clique não executava **nenhuma** função. (Confirmado nas duas
tabelas: FV ~linha 303 e EV ~linha 352.)

## FASE 3 — Roteamento

- Rotas (`App.jsx`): `projetos-fv/:id → ProjetosFVDetalhes`, `projetos-ev/:id → ProjetosEVDetalhes`. **OK.**
- Detalhe lê `useParams().id` e busca `GET /api/projetos-fv/${id}`. **OK.**
- Campo de navegação correto = **`_id`** (ObjectId Mongo). Nativos e importados **ambos** têm `_id`
  válido (importados foram criados via `insertOne`, recebendo `_id` normal). **Sem divergência**
  entre antigos/importados/novos — `origem.id_externo` é só rastreabilidade, **não** se usa na rota.

## FASE 4 — Backend

[`projetosFVController.js`](backend/src/controllers/projetosFVController.js):
`buscarProjetoFV` → `ProjetoFV.findById(id).populate('clienteId')`; `404` se ausente, `500` em erro.
`findById` aceita **qualquer ObjectId válido** → funciona p/ nativo e importado. A listagem
`listarProjetosFVPorCliente` retorna os projetos **com `_id`**. **Backend correto — não era a causa.**

## FASE 5 — Correção (causa raiz)

Adicionado o `onClick` de navegação ausente em **cada linha** (FV e EV), usando `_id`:

```jsx
<tr
  key={p._id}
  className="border-b hover:bg-slate-50 cursor-pointer"
  onClick={() => navigate(`/projetos-fv/${p._id}`)}   // EV: /projetos-ev/${p._id}
>
```

`navigate` já estava em escopo (`useNavigate`). **Correção pontual**, sem workaround, sem tocar
backend/rotas. A tela de projetos (`ProjetosFV.jsx`) já abria via a ação "Abrir" do menu — **inalterada**.

**Acessibilidade (mesma linha):** como "abrir projeto" inclui abrir via teclado, a linha recebeu
`role="button"`, `tabIndex={0}` e `onKeyDown` (Enter/Espaço) — a linha clicável passa a ser focável e
acionável por teclado (incorporando a sugestão da revisão Gemini).

## FASE 6/7 — Testes (regressão automatizada)

[`clienteAbreProjeto.test.jsx`](frontend/src/pages/__tests__/clienteAbreProjeto.test.jsx) (Vitest +
Testing Library) — renderiza o componente **real**, mocka `fetch` (cliente + FV nativo + FV
importado + EV) e o clique:

| Teste | Resultado |
|---|---|
| Abre FV **nativo** → `/projetos-fv/fv-native-1` | ✅ |
| Abre FV **importado** → `/projetos-fv/fv-import-1` | ✅ |
| Abre **EV** → `/projetos-ev/ev-1` | ✅ |
| Navega usando `_id` real (rota compatível `projetos-fv/:id`) | ✅ |
| Abre pelo **teclado** (Enter) — acessibilidade | ✅ |

**5/5 verdes.** **Build:** `✓ built in 12.44s` (sem erros). Abertura por URL direta e pela tela de
projetos já funcionavam (cobertas na FASE 1).

## Respostas obrigatórias

1. **Causa raiz:** linha `<tr>` da ficha do cliente estilizada como clicável (`cursor-pointer`) **sem
   handler `onClick`** → o clique não disparava navegação.
2. **Frontend ou backend?** **Frontend** (UI). Backend e roteamento estavam corretos.
3. **Todos os projetos afetados?** **Sim** — todos os projetos **na ficha do cliente** (FV e EV).
   Abertura por URL direta e pela tela de projetos não eram afetadas.
4. **Diferença nativos × importados?** **Nenhuma** — ambos têm `_id` válido; o handler ausente
   afetava os dois igualmente (descartando a hipótese de id divergente).
5. **Bug corrigido?** **Sim** — `onClick` → `navigate('/projetos-fv|ev/'+_id)` nas duas tabelas.
6. **Risco de regressão?** **Baixo** — mudança isolada em um componente; build OK; teste de regressão
   trava o comportamento `cliente → projeto`.
7. **Teste criado?** `frontend/src/pages/__tests__/clienteAbreProjeto.test.jsx` (4 casos: FV nativo,
   FV importado, EV, e uso do `_id` real na rota).

### Conclusão
Bug de **frontend** — afordância de clique sem `onClick`. Corrigido na raiz (handler de navegação por
`_id` nas linhas FV e EV da ficha do cliente), **sem workaround** e **sem tocar backend/rotas**.
Build OK, **4 testes de regressão verdes** protegendo o fluxo `cliente → projeto`.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Veredito: excelente (APROVADO). Sugestão de acessibilidade por teclado **incorporada** (role/tabIndex/onKeyDown + teste).

## Revisão do Fix do Bug P0-PROJETO-OPEN-BUG-01

A análise e o fix para o bug P0-PROJETO-OPEN-BUG-01 foram conduzidos de forma metódica e bem documentada. Abaixo, a avaliação detalhada dos pontos solicitados:

1.  **Diagnóstico de causa raiz:** O diagnóstico está **correto e bem fundamentado**. A identificação de que a linha `<tr>` possuía `cursor-pointer` mas carecia de um `onClick` é precisa. A fundamentação é sólida ao descartar problemas de backend e roteamento, baseando-se no fato de que a navegação direta por URL e a abertura pela tela de projetos funcionavam, e que tanto projetos nativos quanto importados eram afetados igualmente. A ausência de um handler de evento de clique é a causa direta da falha na navegação.

2.  **Fix é a correção da CAUSA RAIZ:** O fix é **a correção da causa raiz**. A adição do `onClick` diretamente na linha `<tr>` para disparar a navegação é a solução mais direta e eficaz para o problema identificado. Não se trata de um workaround, pois aborda a funcionalidade ausente que impedia a interação esperada.

3.  **Uso de `_id` para a rota:** Usar `_id` (ObjectId do MongoDB) para a rota é o **correto para nativos e importados**. A análise demonstrou que ambos os tipos de projetos possuem um `_id` válido e que `origem.id_externo` não é utilizado na lógica de roteamento ou busca de detalhes do projeto. Portanto, `_id` é o identificador consistente e apropriado para a navegação.

4.  **Teste de regressão:** O teste de regressão criado (`clienteAbreProjeto.test.jsx`) **cobre adequadamente o fluxo cliente→projeto**. A combinação de renderizar o componente real com o mock de `fetch` para os dados necessários (cliente, projetos FV nativo, FV importado e EV) e a asserção de que a navegação é chamada com o ID correto é uma abordagem robusta. Os 4 casos de teste verdes validam os cenários cruciais.

5.  **Risco de regressão da mudança:** O risco de regressão da mudança é **baixo**. A alteração é isolada ao componente `ClienteGerenciamento.jsx`, especificamente nas linhas das tabelas de projetos. O fato de o build ter sido bem-sucedido e o teste de regressão cobrir os fluxos afetados minimiza significativamente o risco de introduzir novos problemas.

6.  **Algo deixado passar:**
    *   **Cursor-pointer enganoso:** A observação sobre o `cursor-pointer` ser enganoso é pertinente e foi corretamente identificada como parte do problema.
    *   **Acessibilidade/Teclado:** Este é um ponto que poderia ser mais explorado. Embora o `onClick` tenha sido adicionado, a linha `<tr>` por si só não é inerentemente navegável por teclado. Para uma experiência de acessibilidade completa, seria ideal que a linha fosse focável e que a navegação pudesse ser acionada pela tecla Enter ou Espaço. Isso poderia ser implementado adicionando `tabIndex={0}` à linha e um `onKeyDown` handler. No entanto, para a correção do bug de navegação em si, a solução atual é suficiente.

7.  **Veredito:** O fix do bug P0-PROJETO-OPEN-BUG-01 é **excelente**. O diagnóstico foi preciso, a causa raiz foi corrigida de forma direta, e a validação através de testes de regressão é robusta. A análise detalhada e a documentação do processo demonstram um trabalho de alta qualidade. A única sugestão de melhoria seria considerar a acessibilidade via teclado para a linha clicável.

**Em resumo:** O trabalho realizado é de um revisor sênior frontend competente, com foco em identificar a causa raiz, implementar uma solução limpa e garantir a estabilidade com testes.
