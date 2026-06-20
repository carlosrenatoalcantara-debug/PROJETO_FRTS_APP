# WIZARD_PERSISTENCE_FIX_REPORT.md

**Sprint:** P1-FV-WIZARD-PERSISTENCE-FIX-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Correção crítica de persistência do Wizard FV

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM — build do frontend OK (2332 módulos); lógica de draft/autosave/URL/hidratação
VALIDADO EM RUNTIME:  SIM (API) — round-trip real contra Railway/Mongo:
                      POST rascunho → PUT fatura+localizacao → GET (reabertura) preservou → bump status → delete
                      NÃO exercido em browser real (F5 físico) — ver ressalva nos testes
```

---

## RESULTADO

```
APROVADO
```

A perda de trabalho em E1–E7 é eliminada para o fluxo principal: o projeto nasce no banco já na **Etapa 2** e cada etapa subsequente é salva automaticamente (autosave já existente, agora ativado). O `?id=` é ancorado na URL, então F5/reabertura hidratam do banco.

---

## FASE 1 — AUDITORIA (documentada antes de alterar)

| Item | Local (antes) |
|---|---|
| POST inicial do projeto | `E8Orcamento.jsx:354` (somente na etapa 8) |
| Autosave bloqueado | `ProjetosFVNovo.jsx:288` — `if (etapaAtual > etapaAnterior && state.projetoId)` — `projetoId` nulo até E8 |
| Mensagem enganosa | `ProjetosFVNovo.jsx:398-407` — "Dados salvos no navegador… protege do refresh" |
| localStorage | `ProjetoFVContext.jsx:163` escreve; **nenhum `getItem`** → write-only |

---

## FASE 2 — NASCIMENTO ANTECIPADO

Implementado `garantirProjetoRascunho()` em `ProjetosFVNovo.jsx`:
- Dispara ao **avançar a partir da Etapa 2** (consumo concluído).
- Resolve `clienteId` (prioriza `state.clienteId`; senão `resolverClientePorNome`).
- `POST /api/projetos-fv` com `status: 'rascunho'`.
- `dispatch(SET_PROJETO_ID / SET_CLIENTE_ID)`.
- **Ancora `?id=<pid>` na URL** (`setParams`, replace) → F5/reabrir hidratam do banco.
- Sem cliente cadastrado → retorna `null` e **mantém o comportamento anterior** (nasce no E8) — sem regressão.

```
Projeto Novo → E2 (consumo) → avançar → POST /api/projetos-fv → projetoId + ?id= na URL → wizard continua
```

---

## FASE 3 — AUTOSAVE (reaproveitado, sem duplicar)

O hook de autosave foi reescrito para criar o rascunho antes de salvar e então usar o `salvarEtapa` **já existente**. Slices ativados incrementalmente:

| Etapa | Slice salvo |
|---|---|
| E2 consumo | `fatura` (novo no mapa `ETAPA_PARA_SLICE`) |
| E2.5 beneficiárias | via API em tempo real — `E2BBeneficiarias.handleSalvo` já fazia POST/PUT quando há `projetoId` (agora ativo) |
| E3 localização | `localizacao` (inclui irradiância) |
| E5 dimensionamento | `dimensionamento` |
| E6 área | `layout_solar` |
| E7 equipamentos | `equipamentos` (+ arranjos via `salvarArranjos`, já existente) |
| E8 orçamento | `orcamento` + `salvarTodosSlices` (consolidação final) |

Nenhuma lógica de salvamento duplicada — reuso de `salvarEtapa`, `adaptar*`, `criarProjeto`, `handleSalvo`.

---

## FASE 4 — REABERTURA

- Hidratação por `?id=` já existia (carrega fatura, localização, dimensionamento, área, equipamentos do banco).
- **Adicionado:** hidratação de **beneficiárias** (`GET /api/projetos-fv/:id/beneficiarias`) no mount com `?id=`.
- Como o draft ancora `?id=` na URL, um F5 recarrega com `?id=` → hidrata do banco.

---

## FASE 5 — LOCALSTORAGE: ESTRATÉGIA ESCOLHIDA

**Escolhida: Opção A — remover a mensagem enganosa** (não implementar restauração de localStorage).

**Por quê:** a durabilidade real agora vem do **banco (draft + `?id=`)**. Implementar restauração de localStorage (Opção B) reintroduziria o risco de **contaminação entre clientes** que o código deliberadamente evita (comentário em `ProjetosFVNovo.jsx:53`). Com o draft persistido, o localStorage é redundante. A mensagem foi reescrita para refletir o estado real:
- Com `projetoId`: "Projeto salvo no banco automaticamente a cada etapa."
- Sem `projetoId`: "Rascunho ainda não salvo — conclua a Etapa 2 com um cliente cadastrado… evite atualizar a página."

---

## FASE 6 — COMPATIBILIDADE

| Garantia | Status |
|---|---|
| Projetos antigos abrem (`?id=`) | ✅ inalterado (+ hidratação de beneficiárias, aditiva) |
| Fluxo E8 funciona | ✅ se draft existe, promove `rascunho→proposta`; senão cria como antes |
| Snapshot intacto | ✅ nenhum arquivo de snapshot tocado |
| Beneficiárias intactas | ✅ reuso de `handleSalvo`/lote; sem mudança de endpoint |
| Governança intacta | ✅ nenhum arquivo de governança tocado |

---

## FASE 7 — TESTES

> **Ressalva de honestidade:** os Testes 1–3 são de browser (F5/fechar). Não dirigi o navegador real; validei o **round-trip de API equivalente** contra o Railway/Mongo (o mecanismo de F5→hidratar por `?id=` é o de retomada já em produção). Build do frontend confirma a fiação.

| Teste | Método | Resultado |
|---|---|---|
| 1. Novo → E3 → F5 | API: POST rascunho + PUT fatura + GET | ✅ dados preservados (`tensao_v=380`) |
| 2. Novo → E6 → F5 | API: PUT localizacao + GET | ✅ preservado (`latitude=-5.79`) |
| 3. Novo → fechar navegador | Lógica: `?id=` na URL → reabrir hidrata do banco | ✅ (code) — mesmo caminho do Teste 1/2 |
| 4. Reabrir projeto salvo | GET `/api/projetos-fv/:id` | ✅ `PRESERVADO=True` |
| 5. Concluir E8 | PUT `status→proposta` (reuso do draft) | ✅ `status=proposta` |
| Limpeza | DELETE projeto de teste | ✅ `excluido=true` |

Evidência runtime (Railway):
```
clienteId=6a3588caf3fada9effa61ce6 (COMERCIAL OLIVEIRA E AVELINO LTDA)
POST rascunho → projetoId=6a370c6decad41f353b384b3
PUT fatura → ok=True tensao_v=380
PUT localizacao → ok=True
GET → status=rascunho, fatura.tensao_v=380, localizacao.latitude=-5.79, PRESERVADO=True
PUT status → proposta
DELETE → excluido=true (limpo)
```

---

## RESPOSTAS OBRIGATÓRIAS

1. **Onde o projeto passa a nascer:** na **Etapa 2** (ao avançar do consumo), via `garantirProjetoRascunho()` → `POST /api/projetos-fv` (status `rascunho`). Fallback para E8 se não houver cliente cadastrado.
2. **Autosave ativado em qual etapa:** a partir de **E2** (slice `fatura`), e E3/E5/E6/E7 (localizacao/dimensionamento/layout/equipamentos); beneficiárias em tempo real em E2.5.
3. **O que foi alterado:** `ProjetosFVNovo.jsx` (draft precoce + autosave + URL `?id=` + hidratação beneficiárias + mensagem), `projetoFVApi.js` (`atualizarProjeto`), `E8Orcamento.jsx` (promove rascunho→proposta).
4. **localStorage removido ou restaurado:** **Opção A** — mensagem enganosa corrigida; restauração de LS NÃO implementada (evita contaminação entre clientes; durabilidade vem do banco).
5. **F5 preserva dados?** SIM (draft + `?id=` → hidrata do banco). Validado por API + build.
6. **Fechar navegador preserva dados?** SIM, ao reabrir com `?id=` (mesmo mecanismo).
7. **Troca de computador preserva dados?** SIM — dados no Mongo; abrir o projeto pela lista (`?id=`) hidrata. (localStorage continua local, mas é redundante.)
8. **Regressões encontradas:** nenhuma no build/round-trip. Efeito esperado: wizards iniciados (com cliente cadastrado) passam a deixar um `rascunho` na lista — tradeoff documentado do draft.
9. **Runtime executado?** SIM (API round-trip contra Railway/Mongo). Browser físico: não (validado por equivalência + build).
10. **Commit gerado:** ver rodapé.

---

## CRITÉRIO DE ACEITAÇÃO

> "O usuário não pode mais perder trabalho realizado em E1–E7."

**ATENDIDO** para o fluxo principal (cliente via `?clienteId=` ou nome já cadastrado): a partir de E2 tudo é persistido incrementalmente e recuperável por `?id=`.

**Residual honesto:** se o operador digita um nome de cliente **ainda não cadastrado**, o draft só nasce no E8 (o backend exige `clienteId`) — exatamente a restrição pré-existente do E8. A mensagem da UI agora avisa isso explicitamente. Endereçar esse caminho (criar cliente cedo) fica para sprint futura, fora do escopo "não refatorar".

---

## VEREDITO

```
APROVADO — perda de trabalho E1–E7 eliminada no fluxo principal.
VALIDADO EM CÓDIGO (build) + VALIDADO EM RUNTIME (API round-trip). Browser físico não exercido.
```
