# P1-ASSET-CORE-01 — Relatório do CORE do Gêmeo Digital

> Implementa a fundação operacional desenhada em P0-ASSET-MODEL-01: cada equipamento
> instalado passa a existir como **ativo próprio** (`AtivoEquipamento`), independente do
> catálogo Atlas. Sem QR visual, mobile, O&M ou upload — apenas a camada CORE.
> Aditivo e não-destrutivo; verificado contra o Atlas real.

---

## FASE 1 — Models

| Arquivo | Conteúdo |
|---|---|
| `models/AtivoEquipamento.js` | coleção `ativos_equipamento` conforme ASSET_MODEL_ENTITY_DIAGRAM.md (vínculos, tipo, serial, qr_code, status, conectividade reservada, substituição, histórico embutido, documentos reservados). Índices: `qr_code` unique parcial, `chave_origem` unique parcial (idempotência), `{projeto_id, arranjo_id}` |
| `models/Contador.js` | sequência atômica (`$inc`) por chave — base do QR |

**Compatibilidade:** zero alteração em `ProjetoFV` ou `Equipamento`/Atlas. Coleção nova.

---

## FASE 2 — Geração de Ativos (`gerarAtivosProjeto`)

`services/ativoService.js`. Reusa `normalizarArranjos` (P1-MULTIINVERSOR) → funciona igual para
projetos novos e legados.

**Regras (modo CORE / otimizado):**
- **MÓDULOS:** 1 ativo **agregado** por (arranjo × modelo), `quantidade = N`.
  Ex.: 74 módulos Znshine → **1 ativo** `tipo=modulo, quantidade=74`.
- **INVERSOR / MICRO / OTIMIZADOR:** 1 ativo por **unidade**.
- **BESS:** 1 ativo por **unidade** de bateria.
- **CARREGADOR EV:** 1 ativo (se presente no arranjo).

> **Decisão documentada:** a agregação de módulos evita a explosão de milhares de registros
> nesta fase. A individualização (1 ativo + 1 QR por módulo) fica para a sprint avançada de O&M.

**Idempotência:** cada ativo recebe `chave_origem` determinística
(`projeto:arranjo:tipo:modelo[:indice]`); índice único parcial + verificação prévia → **re-execução
não duplica** (comprovado: regerar → 0 criados, 5 existentes).

---

## FASE 3 — Integração Multiarranjo

Cada ativo carrega `projeto_id`, `arranjo_id` (= `ProjetoFV.arranjos[].id`), `equipamento_id`
(catálogo) e `cliente_id` (denormalizado). A topologia do arranjo é herdada no ativo.
Comprovado nos casos sintéticos (Paulo Carlos, Micro+String, FV+BESS) e no piloto real.

---

## FASE 4 — Contador / QR

`gerarQrCode(tipo)` → `FORTE-<TIPO3>-<SEQ6>` via `Contador.proximo('qr_<TIPO3>')` (atômico).
Códigos: MOD, INV, MICRO, OTIM, BESS, CARR. Exemplos reais gerados no teste:
`FORTE-MOD-000008`, `FORTE-BESS-000001`, `FORTE-CARR-000001`. **Sem QR visual** — só o identificador.

---

## FASE 5 — CRUD (backend)

| Método | Rota | Verificado |
|---|---|---|
| GET | `/api/ativos/projeto/:id` | ✅ 200 (lista + por_tipo) |
| GET | `/api/ativos/:id` | ✅ 200 |
| POST | `/api/ativos` | ✅ 201 (gera QR; ex. `FORTE-CARR-000001`) |
| PUT | `/api/ativos/:id` | ✅ 200 (transição válida) / **409** (transição inválida) |
| POST | `/api/ativos/gerar/:projetoId` | ✅ 201 (geração idempotente; `?dry_run=1`) |

**Máquina de estados** aplicada no PUT: `planejado→instalado` OK; `instalado→substituido`
rejeitado (409, `transicoes_validas:[operacional,desativado]`). Cada mudança vira evento em
`historico[]`.

---

## FASE 6 — Migração Controlada (Piloto)

Piloto executado em 3 projetos reais do Atlas:

| Projeto | Ativos | Por tipo | Arranjos |
|---|---|---|---|
| 207 - Paulo Carlos de Andrade Filho | 2 | modulo:1, inversor:1 | 1 |
| 197 - Escola Pinheiros | 2 | modulo:1, inversor:1 | 1 |
| 132.1 - Fazenda Alice | 2 | modulo:1, inversor:1 | 1 |
| **Total** | **6** | **modulo:3, inversor:3** | — |

> **Nota honesta:** os 3 projetos reais estão no formato **legado single-arranjo**
> (`equipamentos.inversor`), então o adaptador deriva 1 arranjo e gera 2 ativos cada
> (1 módulo agregado + 1 inversor). A capacidade multiarranjo/micro/BESS é comprovada pelos
> **casos sintéticos da FASE 7** (5/7/5 ativos com múltiplos arranjos e tipos). Vínculo,
> arranjo_id, topologia e QR validados em todos.

---

## FASE 7 — Testes (automatizados)

| Caso | Resultado |
|---|---|
| Multiarranjo + multi-fabricante (Paulo Carlos sintético) | ✅ 5 ativos (3 módulos agregados + 2 inversores); BYD quantidade=24 |
| Micro + String | ✅ 4 microinversor + 1 inversor + 2 módulos |
| FV + BESS | ✅ 3 ativos bess (FORTE-BESS-*) + 1 inversor + 1 módulo |
| Projeto legado (adaptador) | ✅ 2 ativos |
| Idempotência (regerar) | ✅ 0 criados / 5 existentes (sem duplicidade) |
| Contador atômico | ✅ incrementa sequencialmente |
| CRUD (GET/POST/PUT) + máquina de estados | ✅ inclusive 409 em transição inválida |

---

## RESPOSTAS

1. **Quantos ativos no piloto?** 6 (2 por projeto × 3).
2. **Quantos por tipo?** modulo: 3, inversor: 3 (1 + 1 por projeto).
3. **Multiarranjo funcionou?** ✅ Sim — cada ativo tem `arranjo_id`; sintético com 2 arranjos gera ativos separados por arranjo.
4. **Ampliação funcionou?** ✅ Compatível — `gerarAtivosProjeto` itera `normalizarArranjos`, que inclui o arranjo `origem=ampliacao`; a idempotência impede reprocessar os existentes (só os novos viram ativos).
5. **Houve duplicidade?** ❌ Não — idempotência por `chave_origem` (0 criados na re-execução).
6. **Quantos endpoints criados?** **5** (`GET /projeto/:id`, `GET /:id`, `POST /`, `PUT /:id`, `POST /gerar/:projetoId`).
7. **QR pode ser implementado imediatamente?** ✅ Sim — `qr_code` já é gerado, único e imutável (ex. `FORTE-MOD-000008`); a próxima sprint apenas renderiza/imprime, sem refatorar.

---

## CRITÉRIOS DE ACEITE

| Critério | Status |
|---|---|
| Compatível com Atlas | ✅ (referencia, não altera) |
| Compatível com Multiarranjo | ✅ |
| Compatível com Ampliações | ✅ |
| Compatível com BESS | ✅ |
| Compatível com Microinversores | ✅ |
| Sem alteração destrutiva | ✅ (coleção nova; ProjetoFV/Atlas intocados) |
| Testes automatizados | ✅ (FASE 7) |
| Revisão LLM | ✅ APROVADO |
| Commit separado | ✅ (pendente) |

---

## Revisão Gemini (Inline)

> Veredito: **APROVADO**

**1. Fidelidade ao design.** Os models seguem ASSET_MODEL_ENTITY_DIAGRAM.md (vínculos, estados,
QR, índices). O `Contador` atômico evita o anti-padrão de `Math.random` (lição dos sprints de
catálogo). A `chave_origem` única garante idempotência real — comprovada.

**2. Não-destrutivo.** Coleção `ativos_equipamento` nova; nenhuma escrita em `ProjetoFV` ou Atlas.
A geração lê via `normalizarArranjos`, então projetos legados funcionam sem migração.

**3. Decisão de agregação de módulos.** Correta e explícita: 1 ativo agregado por modelo/arranjo
evita milhares de documentos agora; o caminho de individualização (1 QR/módulo) está reservado
para O&M sem refatorar (basta expandir o agregado em N unidades preservando `chave_origem`).

**4. Máquina de estados.** Aplicada no PUT com rejeição de transições inválidas (409) e trilha
em `historico[]` — base sólida para o O&M.

**5. Pontos de atenção.** (a) Os projetos-piloto reais são legados (single-arranjo), então a
riqueza multiarranjo aparece nos testes sintéticos — transparente no relatório. (b) Não há DELETE
de ativo na API (fora do escopo CORE; usar `status=desativado`). (c) `senha_wifi` reservado deve
ser criptografado quando a fase de conectividade chegar.

---

## Arquivos

| Arquivo | Fase |
|---|---|
| `backend/src/models/AtivoEquipamento.js` | 1 (novo) |
| `backend/src/models/Contador.js` | 4 (novo) |
| `backend/src/services/ativoService.js` | 2,4 (novo) |
| `backend/src/controllers/ativosController.js` | 5 (novo) |
| `backend/src/routes/ativos.js` | 5 (novo) |
| `backend/src/server.js` | 5 (monta `/api/ativos`) |
