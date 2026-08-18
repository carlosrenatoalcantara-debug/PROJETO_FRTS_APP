# FV — Estado compactado

**Atualizado:** 2026-08-15, ao fim da FV-DOM-015.
**Origem:** este arquivo era citado como fonte obrigatória desde a FV-DOM-010, mas **não existia no repositório** (verificado 5 vezes). Criado agora contendo **apenas o estado comprovado por check**.

> Nada aqui é premissa ou intenção — cada linha corresponde a algo verificado. Onde há decisão pendente, está marcado `PENDENTE`.

---

## 1 · Decisões de negócio

| # | Decisão | Status | Valor |
|---|---|---|---|
| D1 | Convenção de payback | **DEFINIDA** | acumulado **fracionário** oficial + **inteiro** secundário |
| D2 | VPL e taxa de desconto | **DEFINIDA** | VPL **obrigatório** · TMA **nominal 10 % a.a.**, versionada |
| D3 | Premissa de inflação energética | **DEFINIDA** | **obrigatória, sem default** · zero só se informado · versionada · ausência → `lacuna` |
| D4 | Autoridade financeira dos PDFs | **DEFINIDA** | **opção C** — motor canônico para novos cálculos e documentos; histórico não recalculado |
| D5 | Cenário oficial da Lei 14.300 | **PENDENTE** | — |

D1 e D2 fechadas em 2026-08-15 e implementadas no contrato V1 (FV-DOM-012).
D3 e D4 fechadas em 2026-08-15 (FV-DOM-015).

**D3 — inflação energética:** premissa **obrigatória**, sem default. `0 %` é valor legítimo apenas quando informado explicitamente; ausência gera `lacuna` e os indicadores dependentes voltam `null`, nunca um número implícito. Versionada junto das demais premissas.
*O contrato V1 já se comporta exatamente assim — **nenhuma alteração de código é necessária** para D3.*

**D4 — autoridade financeira (opção C):** o motor canônico é a autoridade para **novos cálculos** e **novos documentos**. Histórico já emitido não é recalculado, `Baseline` existente não é alterada, propostas históricas permanecem como foram emitidas.
*Implementação pendente: migrar as 8 superfícies não canônicas — sprint separada.*

**D3 auditada (FV-DOM-013):** 4 conjuntos contraditórios no código (0 %, 6 %, 8 %, 5 %×2 %); apenas 6 % tem fonte citada — um comentário, sem série verificável. Impacto medido com a TMA de 10 %: de 0 % a 8 % o **VPL varia 3,1×** e a economia acumulada **2,9×**. Em projeto saudável o valor não altera a decisão (VPL positivo já a 0 %); em projeto marginal ele **decide sozinho** (VPL vira positivo só a partir de 9,2 %). Recomendação técnica: **obrigatória sem default**. Composição em dois fatores é matematicamente idêntica ao fator único equivalente.

D5 segue sem valor: **nenhuma foi decidida no código** — protegido por `financeiroConsolidacao`, `financeiroRestante`, `defaultsFinanceiros`, `hardeningFinanceiro` e `contratoFinanceiroV1`.

### Contrato financeiro V1 — implementado (FV-DOM-012)

| Item | Estado |
|---|---|
| `packages/fv-shared/financeiro/contratoV1.js` | motor canônico — compõe `financeiroEngine`, não reimplementa |
| Premissas versionadas | `v1-2026-08` · TMA 10 % nominal · horizonte 25 · degradação 0,5 % |
| `POST /api/projetos-fv/:id/financeiro/calcular` | tenant fail-closed · ignora o corpo · não persiste |
| `backend/src/dominio/financeiro/` | adapter com proveniência e engineering lock |
| Inflação (D3) | premissa de ENTRADA obrigatória, **sem default** — ausente vira lacuna |
| Regulatório (D5) | declarado `aplicavel: false, motivo: 'D5_PENDENTE'` |

**D4 auditada (FV-DOM-014):** 9 superfícies calculam indicadores com 6 motores. Divergência vs contrato V1 no caso típico: `fluxoCaixa` **VPL +82 %**, `dimensionamentoFV` payback **−1,85 a**, PDF comercial **+0,45 a** — e em projeto longo o PDF erra **até +106 %**. **A `Baseline` NÃO congela indicadores** (só itens e condições), e produção não tem propostas canônicas emitidas — o risco histórico é menor que o estimado. **Dependência dura: D4 não é implementável antes de D3** — sem inflação decidida, o contrato devolve `null` e os PDFs sairiam com "—".

**Superfícies ainda não migradas para a TMA de 10 %:** `fluxoCaixa` (6 %) e os paybacks divergentes — a propagação é FV-DOM-013 e depende de D3/D4.

---

## 1B · Decisões de engenharia elétrica (FV-DOM-024)

Fechadas em 17/08/2026. Fundamentadas nas normas **já citadas pelo próprio
código**, medidas na FV-DOM-023. Nenhuma foi escolhida por conveniência.

| # | Questão | Decisão | Fonte |
|---|---|---|---|
| **Q1** | Fator de segurança na Isc | `Isc_total = Isc_stc × strings × 1,25` | **NBR 16690 §5.2**, citada em `fv-shared/engenharia/engenhariaNormativa.js` |
| **Q2** | Coeficiente térmico de Vmpp | usar `coef_temp_voc_pct_c` **provisoriamente** | sem fonte para o `×0,75` do wizard; `coef_temp_vmpp_pct_c` fica para evolução |
| **Q3** | Vmpp mínimo | comparado em condição **QUENTE** (`Tcel = Tmax + 1,25·(NOCT−20)`) | **NBR 16690 §5.1** |
| **Q4** | Unidade do coeficiente | catálogo guarda **`%/°C`**; conversão para fração **só na fronteira** | campo `coef_temp_voc_pct_c` + regra `COEF_TEMP_VOC_FORA_FAIXA` (faixa `[-0,5; -0,15]`) |
| **Q5** | NOCT canônico | **44 °C** quando o módulo não declara | alinhamento com `fv-shared` |
| **Q6** | Histórico | **congelado** — projetos existentes não são recalculados | coerente com D4 (histórico não se reescreve) |
| **Modelo A** | `mppts[]` | permanece **topologia autorada pelo projetista**; o sistema valida, não distribui strings | FV-DOM-022/023 |

**Consequência direta:** `compatibilidadeEletricaService` (backend) passa a
divergir do canônico em Q1 — hoje usa `Isc × strings` sem fator. A validação
local do `ConfiguradorArranjoFV` diverge em Q2, Q3 e Q4 (esta última é um
**erro de unidade**: trata `%/°C` como fração e infla a Voc em ~4×, reduzindo o
máximo de módulos em série de 11 para 3 nos módulos vindos do catálogo Mongo).

**Impacto de Q1 medido (FV-DOM-024)** — catálogo elétrico de referência:
`227 de 700` combinações módulo × inversor têm faixa de virada. Um arranjo muda
de aprovado para reprovado quando `limite/1,25 < Isc × strings ≤ limite`, isto
é, quando a corrente já ocupa **mais de 80 % do limite do MPPT**. O fator é
monotônico: **só aperta, nunca afrouxa** — zero casos no sentido inverso.

**Contagem de projetos em produção: NÃO DETERMINADA.** Não existe credencial
somente-leitura; a única do Atlas é a de aplicação, com escrita. Pré-requisito
declarado da FV-DOM-025.

---

## 2 · Domínio financeiro

### Motores consolidados — `packages/fv-shared/financeiro/`

| Módulo | Origem | Premissas próprias |
|---|---|---|
| `financeiroEngine.js` | frontend | inflação 0 % · degr. 0,5 % · sem desconto · payback fracionário |
| `fluxoCaixa.js` | `engenhariaController` | inflação 8 % · degr. 0,5 % · desconto 6 % · payback inteiro |
| `regulatorioBR.js` | frontend | reajuste 5 % × inflação 2 % · Fio B · Lei 14.300 |
| `dimensionamentoRetorno.js` | `dimensionamentoFV` | inflação 6 % · desconto 10 % · payback por economia média |
| `simulacaoOM.js` | `financeiroController` | O&M 1 % · cresc. consumo 2 % · fator cenário 0,2 / 1,5 |

**Cópias vivas: zero.** Três cópias literais da TIR eliminadas (`projetoController`, `financeiroController`, e a extração do `engenhariaController`).

### Caminhos ainda fora do pacote

| Caminho | Motivo |
|---|---|
| `projetoController.simularFinanceiroLocal` | cálculo próprio (sem degradação, desconto 10 %) — D1/D2 |
| `propostaComercialService` | payback simplificado inline — D4 |
| `bessController` | payback arredondado inline — decisão |

### Divergência medida (mesmo projeto: R$ 80 000 · 18 000 kWh/ano · R$ 0,98)

- **payback**: 2,2 a 14 anos
- **VPL**: −R$ 13 119 a R$ 412 646
- **inflação**: 4 conjuntos · **desconto**: 3 valores

---

## 3 · Hardening concluído (FV-DOM-011C)

| # | Item | Estado |
|---|---|---|
| E3 | `calculado_em` injetável, fora de cálculo e hash | ✅ validado |
| E7 | TIR com `convergiu` + motivo, valor inalterado | ✅ validado |
| R6 | PDF comercial sem `undefined` | ✅ validado |
| R10 | sazonalidade morta removida | ✅ validado |
| — | `/api/engenharia/fv` órfã preservada até D2 | ✅ classificada |
| — | 18 defaults financeiros fabricados removidos (FV-DOM-011B) | ✅ validado |

---

## 4 · Nova UX FV — `/fv/projetos/:id`

Etapas operacionais: **Projeto · Beneficiárias · Cotação · Orçamentos · Aprovação · Baseline · Gate · Unifilar**.
Aguardando agregado: Engenharia · Homologação · Executivo · Execução · As-Built.

Agregados canônicos: `Cotacao`, `Orcamento`, `Baseline`, `UnidadeBeneficiaria`. Motor de unifilar no domínio (FV-DOM-007B), com proveniência e lacunas.

### AMB-2 — abas ainda só no wizard

**5**: Layout · BESS · Financeiro · Documentos · CRM.

---

## 5 · Bloqueios ativos

| # | Bloqueio | Depende de |
|---|---|---|
| B1 | **D5 pendente** → contrato V1 declara `regulatorio.aplicavel: false`; cenário da Lei 14.300 sem definição | Negócio |
| B1b | **D4 aprovada mas não implementada** → 8 superfícies ainda com motores próprios; convergência é sprint de execução | FV-DOM-016 |
| B2 | `empresa_id: null` em 588 projetos (0 % de cobertura) → RBAC fail-closed | SSOT-GOV-003 / backfill (LME) |
| B3 | `obterOrcamentoProjeto` insubstituível (7 projetos históricos) | backfill (LME) |
| B4 | Layout/telhado: `local_ref` nunca populado | backfill (LME) |
| B5 | Documentos: `DocumentoTecnico` **não tem vínculo com projeto** — é biblioteca de equipamentos | decisão de modelagem |
| B6 | `instalacaoRefEtapa.check.js` falha (`TENANT_AUSENTE`) | pré-existente ao HEAD |

---

## 6 · Correções de auditorias anteriores

Registradas para não se repetirem:

| Onde | Erro | Correção |
|---|---|---|
| FV-DOM-006 | "motor de unifilar é o `diagram-engine`" | o pacote **não tem adapter FV**; o desenho nascia no navegador |
| FV-DOM-006 | "não existe equivalente financeiro no backend" | `engenhariaController` tinha TIR, VPL e payback descontado |
| FV-DOM-006 | `DocumentoTecnico` "órfão, sem rotas CRUD" | tem 4 consumidores e 5 rotas em `adminCatalogo` |
| FV-DOM-008 | "4 motores financeiros" | são **8** — `head` truncou greps de inventário |
| FV-UX-013 | "7 abas dependem de agregados novos" | apenas 2 dependiam |

---

## 7 · Regressão de referência (baseline)

| Verificação | Valor |
|---|---|
| Suíte frontend | **25 falhas em 6 arquivos**, 973 testes |
| Build | 2396 módulos |
| Checks backend | 15, sendo 14 ✅ e 1 falha pré-existente (B6) |
| Produção | intocada · nada commitado em toda a série |
