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
| B7 | **`_carregarDepsDocumento` com `req` fora de escopo** → **QUITADO na F14-5**; ver §5B | resolvido |
| B8 | Módulo do caminho **STRING** ainda lê Voc/Vmpp/Isc genéricos (49,5 / 41,2 / 13,9) | decisão de negócio |
| B9 | **Não existe PDF do unifilar FV** — para topologia nenhuma | feature nova |
| ~~B10~~ | **FECHADO na FV-UX-035** — envio canônico por grupo + aceite gateado. Ver §5E |  |
| B11 | **Projeto Executivo, Execução e As-Built continuam stubs** — nenhum agregado registra conclusão de fase; a UX diz que não é rastreável | FV-DOM-006 |

---

## 5B · Dívida técnica: `_carregarDepsDocumento` (FV-DOM-031D/031E)

**O defeito.** `backend/src/controllers/homologacaoController.js::_carregarDepsDocumento`
referencia `req`, que **não é parâmetro dela**. O `ReferenceError` cai no
`try/catch` da própria função, que devolve
`{ equipamentos: [], beneficiarias: [], origem: 'vivo' }` em **toda** chamada.
Consequência: o enriquecimento do memorial pelo **Atlas vivo** e a leitura de
`governanca.snapshot_catalogo` estão **inertes** — silenciosamente, há tempo.

**Alcance.** Um fluxo apenas: `gerarMemorial`
(`POST /api/projetos-fv/:projetoId/homologacao/memorial`). Os outros sete
endpoints do controller não consomem `deps`.

**Impacto MEDIDO da correção** (`backend/scripts/auditoria-req-fv-dom-031d.mjs`,
ambiente isolado, memorial gerado duas vezes e comparado caractere a caractere):

| | |
|---|---|
| projetos cujo memorial **mudaria** | **2 de 3** |
| exemplo de divergência | `Número de MPPT: 2` → `3` |
| exemplo de divergência | `Fonte dos dados: "snapshot do projeto"` → `"catálogo (Atlas) no momento da geração"` |

Corrigir reativa comportamento legado **nunca validado**: marca, modelo,
potência, garantia e a nota de origem impressas no memorial passam a vir do
catálogo vivo, e projetos congelados passam a usar `snapshot_catalogo`.

**Decisão (FV-DOM-031E): NÃO CORRIGIR.** Fica como dívida técnica. A correção
exige sprint própria, com decisão de negócio sobre qual fonte é a correta para
documentos já emitidos. Nenhum documento de topologia **string** foi alterado.

**Como o micro contorna.** `gerarMemorial` deriva `micros[]` do próprio projeto
recebido (`_microsDoProjeto`), sem depender de `deps` — implementado na
FV-DOM-031C e mantido intocado.

### ✅ QUITADA na F14-5 — a sprint própria aconteceu

A F14-5 mediu o que a 031E não tinha medido: `projeto.inversor` e
`projeto.painel` **não existem** no `ProjetoFV` (o schema tem `potencia_kwp` e
`strings[]`, mais nada). Com `deps.equipamentos` sempre vazio, o memorial não
tinha fonte de equipamento alguma e renderizava **`N/A` em todo campo** — para
qualquer projeto FV, multiarranjo ou não. O "comportamento legado nunca
validado" que a 031E temia reativar era, na prática, o único que existia.

Corrigido: `req` virou parâmetro, os ids de equipamento passaram a ser lidos de
`arranjos[]` (onde de fato vivem), e o memorial descreve um bloco por grupo de
inversor. Os "2 de 3 memoriais que mudariam" mudaram de propósito — de `N/A`
para o equipamento real.

O guard `unifilarMicro.check.js §7` foi invertido: travava a não-correção,
agora trava a correção.

---

## 5C · FV-UX-034 — o Gate deixou de ser consultivo na homologação

A auditoria (`backend/scripts/auditoria-fluxo-fv-ux-034.mjs`) mediu o fluxo
inteiro e achou três buracos. Dois foram fechados; o terceiro exige decisão.

**Fechado 1 — quatro endpoints em HTTP 500.** `homologacaoController.js` usava
`aplicarEscopo` em 6 pontos sem importar. `GET/PATCH` de status e de checklist
respondiam 500. Import acrescentado. Isto **não reabre B7**: `req` continua
fora de escopo em `_carregarDepsDocumento`, e a validação prova que o memorial
segue vindo do corpo da requisição (`origem = vivo`, `usou_snapshot = false`).

**Fechado 2 — a regra 5 da FV-DOM-032 valia só na leitura.** A opção NÃO
escolhida tinha `gate.homologacao.liberado = false` e mesmo assim gerava
memorial com HTTP 200: nenhum caminho do controller chamava `exigirGate`. O
guard `_exigirGateHomologacao` passou a cobrir os cinco caminhos de AVANÇO —
memorial, carta, ART, `PATCH status`, `PATCH checklist`. Leitura continua
aberta (regra 9). Medido: `409 OPCAO_NAO_ESCOLHIDA` para a perdedora,
`409 PROPOSTA_SEM_ACEITE` antes do aceite, `409 SEM_BASELINE` sem baseline.

**Fechado 3 — a tela não expunha a homologação.** A API existia inteira e
`EtapaHomologacao` mostrava só o veredito do Gate. Agora mostra o estado do
processo na concessionária, os 5 estados válidos e o checklist de documentos,
com escrita desabilitada quando o Gate bloqueia.

**Aberto — B10 e B11 acima**, que dependem de decisão de negócio e não foram
implementados.

**Efeito colateral medido:** `validacao-fv-dom-031c.mjs` passou a receber 409
ao emitir memorial, porque o script nunca aprovava orçamento — antes do guard
o endpoint não exigia nada. O script foi ajustado para aprovar um orçamento
antes de emitir; nenhum número que ele mede vem do orçamento.

**Guard reforçado:** `fluxoComercialEscrita.check.js` §15 comparava as rotas
chamadas pela UX contra o router e **ignorava `PATCH` e `DELETE`**, além de não
ler o router de homologação (montado à parte em `server.js`). Ambos corrigidos
— o buraco era real: qualquer rota `PATCH` chamada pela UX era invisível ali.

---

## 5D · FV-UX-035 — auditoria do envio (medida, não lida)

`backend/scripts/auditoria-envio-fv-ux-035.mjs`, ambiente isolado.

**Existe e funciona:**

| Peça | Estado medido |
|---|---|
| PDF da proposta | `POST /:id/proposta/gerar` → 200, 27.931 bytes; `visualizar` → base64. **Por opção** |
| Transporte SMTP | `mailService.js` (Zoho/nodemailer); sem credencial devolve `{enviado:false}`, não lança |
| Link público | `GET /api/publico/proposta/:token` — sem auth, token é a credencial, exceção a M-4 documentada |
| Página do cliente | `frontend/src/pages/PropostaPublica.jsx` |
| Criação do link | `POST /:id/governanca/comercial/compartilhar` — token, validade, snapshot congelado, tracking de acessos |

**Não existe / não alcança:**

| Lacuna | Medida |
|---|---|
| O link exige o FREEZE da governança comercial **legada** | `409 SEM_SNAPSHOT_CONGELADO` para uma opção /fv; `governanca.comercial` vem **ausente** — orçamento aprovado ≠ proposta congelada |
| O compartilhamento é por **projeto**, a proposta é o **grupo** | `criarCompartilhamento` não conhece `proposta_grupo_id`; a rota pública não conhece grupo |
| Nenhum controller FV dispara e-mail | o link é devolvido ao chamador; nada chega ao cliente |
| **O aceite não exige envio** | `POST /proposta/aceitar` sem nenhum compartilhamento → **HTTP 200** |
| A UX `/fv` não alcança nada disso | nem PDF, nem enviar; só `aceitarOpcao` |

**Consequência:** fechar a regra da FV-UX-035 exige tocar `governanca.comercial`,
que é território do wizard legado — gatilho de PARADA declarado. Decisão pendente
com o negócio antes de implementar.

---

## 5E · FV-UX-035 — envio da proposta e gate de aceite

**Regra fechada:** só se aceita o que foi enviado. Antes, `POST /proposta/aceitar`
devolvia 200 sem que a proposta jamais tivesse sido disponibilizada.

**Decisões de negócio (tomadas nesta sprint):**

1. **Mecanismo** — reusar `governanca.comercial.compartilhamentos[]` com snapshot
   CANÔNICO. Mesmo armazenamento, token, rota pública, página do cliente e
   tracking; entrada própria, sem chamar `criarCompartilhamento` nem acionar o
   freeze comercial legado.
2. **Escopo** — UM link por `proposta_grupo_id`, com todas as opções lado a lado.
3. **Aceite** — cliente (página pública) **e** operador (interno), convergindo
   para o mesmo domínio; idempotente; uma só opção aceita por grupo.

**O que foi construído:**

| Peça | Onde |
|---|---|
| Domínio puro do envio/aceite | `backend/src/dominio/proposta/index.js` |
| Ato de enviar + snapshot canônico | `backend/src/services/EnvioPropostaService.js` |
| `POST /:id/proposta/enviar` · `GET /:id/proposta/envio` | `routes/projetosFV.js` |
| `GET /api/publico/proposta-fv/:token` · `POST …/aceitar` | `routes/publico.js` |
| Página do cliente (`/proposta/:token`) | `frontend/src/pages/PropostaFVPublica.jsx` |
| Painel de envio + aceite gateado | `frontend/src/fv/paginas/etapas/EtapaProposta.jsx` |
| Guard | `dominio/__checks__/envioProposta.check.js` |

**Fronteira preservada:** a rota legada `/p/:token` e `criarCompartilhamento`
seguem intocadas — ainda exigem freeze e ainda não conhecem grupo. Uma entrada
legada **nunca** conta como envio de proposta: exige `origem: 'canonico'` **e**
`proposta_grupo_id` casando.

**Evidência do aceite** (`proposta_aceite`): `origem` (cliente|interno),
`aceita_por` (só interno), `token_envio` (só público), `ip`, `share_id`,
`snapshot_hash`. O que não se sabe fica `null`.

**Defeito meu corrigido:** `listarOpcoesFV` lia `orc.totais?.total_venda_r`
desde a FV-UX-033. `orc.totais` **nunca existiu** — totais são derivados a cada
leitura (INV-58) —, então a listagem de opções mostrava preço `null`. Agora usa
`totaisDeItens`, a fórmula canônica.

**Incidente registrado:** a primeira execução da validação subiu o backend com o
`.env` real e o envio disparou e-mail pela conta Zoho da empresa
(`enviado=true`, destinatário `validacao+…@exemplo.com` — domínio reservado, RFC
2606, ninguém recebeu). O ambiente isolado passou a exigir
`SMTP_USER="" SMTP_PASS=""`, documentado no cabeçalho de
`validacao-fv-ux-035.mjs`.

**Fica aberto:** a UX `/fv` ainda não oferece o PDF da proposta
(`POST /:id/proposta/gerar`, vivo e funcionando) — o cliente recebe a página
pública, não o documento. Nada no fluxo envio→aceite depende disso.

---

## 5F · FV-UX-036 — PDF da proposta na nova UX

**Auditoria primeiro** (`backend/scripts/auditoria-pdf-fv-ux-036.mjs`), lendo o
TEXTO do PDF gerado com `pdf-parse` — que já estava no repositório.

**Contrato do endpoint, medido:** `POST /:id/proposta/gerar` devolve bytes,
**por opção** (um `ProjetoFV`), isolado por tenant (outro `empresa_id` → 404),
**sem alterar estado persistente** e **sem contar como envio** — não colide com
a FV-UX-035. `visualizar` devolve base64 + lacunas. `GET /proposta/download` é
**rota morta**: `salvarPropostaEmArquivo` está exportado e ninguém o chama.

**O defeito que a auditoria encontrou:** o gerador lia só a forma do WIZARD
LEGADO (`projeto.painel`, `projeto.inversor`, `projeto.strings`,
`projeto.estrutura`), nula em projeto canônico. As duas opções saíam com o
MESMO bloco de equipamentos, todo fabricado:

```
• 10 módulos Marca Modelo        real: 24 × Znshine ZXM7 650 W
• Potência nominal: 400W
• Modelo - 5kW                   real: Sungrow SG15RT 15 kW
• Tipo: String · Fases: 3F       a outra opção era MICRO, 8 × HMS-2000-4T
• Tipo: Fibrocimento             a outra opção era Laje
• Garantia: 12 / 25 / 10 anos    ninguém informou
```

O diff das duas tinha 19 linhas, nenhuma de equipamento. E o documento não
identificava a opção.

**Decisões de negócio desta sprint:**

1. **Corrigir o mapeamento canônico** — o gerador lê `equipamentos`,
   `dimensionamento` e `arranjos[]`; o legado vira FALLBACK (o wizard continua
   produzindo o documento de sempre); sem dado em nenhuma das duas formas,
   declara lacuna `—`. Mesma decisão da FV-DOM-029.
2. **Preservar o rateio 45/15/25/10/5 %** do detalhamento do investimento —
   houve decisão anterior explícita, registrada em comentário no código.

**Resultado medido no documento:**

| | Opção 01 | Opção 02 |
|---|---|---|
| capa | Opção 01 | Opção 02 |
| módulos | 24 × Znshine ZXM7-UHLD144-650/M, 650W | 30 × idem |
| inversor | Inversor · Sungrow SG15RT - 15kW · 3F | **Microinversores** · 8 × Hoymiles HMS-2000-4T - 2kW · 1F |
| estrutura | Fibrocimento | Laje |
| valor | R$ 50.000 | R$ 64.500 |

Sem mistura entre irmãs (8 asserções negativas). Projeto sem equipamento gera o
documento com lacunas, sem inventar nada.

**Achado de implementação:** a quantidade de inversores NÃO vive em
`equipamentos.inversor` — o subdoc não a persiste. Vive em
`arranjos[].inversores[]` e, na topologia micro, em
`configuracao_eletrica.micros[]`. Omiti-la subdeclarava a venda ("Hoymiles
HMS-2000-4T - 2kW" quando são oito unidades).

**Colisão que o PDF denunciou:** meu helper `ou(valor, formatar)` de módulo era
sombreado por um `ou(v, sufixo)` local pré-existente, e o documento saiu com
``650(v) => `${v}W por módulo` `` impresso. Renomeado para `exibir`; o guard
agora exige um único `ou` no arquivo.

**Guards atualizados, não afrouxados:**
* `estruturaEtapa.check.js` — `propostaComercialService.js` saiu da lista de
  "intactos" (alterado por autorização) e ganhou **asserção de conteúdo**, mais
  forte: lê o canônico, mantém o fallback, imprime o tipo sem traduzir, o
  default `'Fibrocimento'` não voltou, `"Outro"` mantém a descrição. Mesmo
  padrão que a FV-DOM-031C já aplicara ao memorial.
* `fluxoComercialEscrita.check.js` §15 — passou a ler `routes/proposta.js`,
  montado à parte em `server.js`. Mesma lacuna que a homologação tinha antes da
  FV-UX-034.

**Fica aberto:** `GET /proposta/download` continua rota morta (o `gerar` não
salva em disco). Ninguém a chama; não foi tocada.

---

## 5G · FV-UX-037 — auditoria end-to-end (arquitetura × código × produto)

`backend/scripts/auditoria-e2e-fv-ux-037.mjs`, ambiente isolado + navegador.
**66 nós medidos: 53 OK · 5 DIVERGE · 5 LACUNA · 3 STUB.** Nada implementado.

A espinha do fluxo funciona ponta a ponta: cliente → projeto → equipamentos →
estrutura → dimensionamento → topologia (string e micro) → engenharia →
orçamento → 3 opções com PDF próprio → envio → aceite público → bifurcação com
Gate → homologação. Abaixo só o que NÃO fecha.

### Divergências

| # | Nó | Medida |
|---|---|---|
| D1 | Equipamentos | `equipamentos.inversor` é **objeto único e sem `quantidade`**; N modelos e quantidade só existem em `arranjos[].inversores[]`. Duas formas para o mesmo conceito — o diagrama pede "N modelos + quantidades" no nó Equipamentos |
| D2 | Estrutura | `"Outro"` **sem descrição é aceito pela API** (HTTP 200). A regra existe só em `frontend/src/fv/estrutura.js` — contradiz "não utilizar validações apenas na interface" |
| D3 | Homologação | `GET /homologacao/checklist` lê concessionária/UF de `req.query`, **nunca do projeto**. O projeto declarou Neoenergia/RN e o checklist diz `"Não informada"` / `"N/A"`. Provado: passando `?estado=RN&concessionaria=Neoenergia` o checklist se corrige — a UX é que não passa |
| D4 | Envio (**defeito meu, FV-UX-035**) | O **tracking diverge entre irmãs**. A rota pública incrementa em UM documento; ler de outra irmã reporta 0. Medido: Opção 01 = 1 visualização; Opções 02 e 03 = 0, depois de o cliente ter aberto o link **e aceitado pela Opção 02**. A tela da opção aceita diz "Ainda não foi aberto pelo cliente" |
| D5 | Unifilar | A topologia é roteada por `configuracao_eletrica.micros[]` preenchido, **não pelo inversor**. Projeto com microinversor cuja topologia ainda não foi autorada cai no **motor de string**, recebe lacuna `arranjoMPPTs` e é desenhado com valores padrão de MPPT. É decisão declarada em `adaptarProjeto.js` ("não deriva topologia por heurística"), mas diverge do diagrama, onde a topologia segue o equipamento |

### Lacunas (nós do diagrama sem implementação)

* **PDF na página pública** — o cliente recebe a página, não o documento
* **Parecer de acesso** — nenhuma rota nem campo
* **Orçamento/conexão** — nó inexistente
* **Agregado Projeto Executivo** e **Agregado As-Built** — sem campo no `ProjetoFV`
  (`execucao` tem campo; executivo e as-built não)

### Stubs

`executivo`, `execucao`, `asbuilt` — telas roteadas que declaram honestamente
"agregado não implementado". Território FV-DOM-006.

### Não é divergência

A etapa **Estrutura** não tem `etapa` própria no `PUT /etapa`: grava em
`equipamentos.estrutura` por decisão da FV-UX-030, e a rota `/estrutura` existe
na UX. Registrado para não ser reaberto como defeito.

---

## 5H · FV-UX-038 — correção das divergências D1–D5

Fecha as cinco divergências medidas na FV-UX-037. Lacunas e stubs ficaram fora
por instrução da sprint.

**D1 · Inversores e quantidade.** `arranjos[].inversores[]` é a fonte canônica;
nenhuma segunda quantidade foi criada em `equipamentos.inversor`. Novo adaptador
**único** `composicaoDoProjeto()` em `arranjosService.js` — construído sobre
`normalizarArranjos`, que já resolve o projeto legado, então a compatibilidade
vem do mesmo caminho e não de uma segunda leitura. Consumidores religados: PDF
da proposta (que tinha a sua própria soma, agora removida), `listarOpcoesFV`,
snapshot do envio e página pública. Cenário obrigatório medido ponta a ponta:

```
PDF        24 módulos Znshine · 8 × Hoymiles HMS-2000-4T · seção "Microinversores"
listagem   inversores[0].quantidade = 8
snapshot   8 × HMS-2000-4T · 24 módulos
cliente    "Módulos 24 × Znshine …" · "Inversor 8 × Hoymiles HMS-2000-4T"
```

Dois modelos no mesmo projeto também aparecem: `2 × Sungrow SG15RT` **e**
`4 × Hoymiles HMS-2000-4T`. `inversor` (string) permanece nas respostas como
resumo legível e para os snapshots já congelados.

**D2 · Regra da estrutura na API.** `dominio/estrutura/index.js` — `"Outro"` sem
descrição agora é `400 ESTRUTURA_INVALIDA`. Ausência continua LACUNA, não erro.
**Escopo corrigido em curso:** a primeira versão também recusava tipo fora da
lista e quebrou a garantia da FV-UX-030 §5 ("valor legado é aceito e devolvido
intacto" — `"Mini Trilho"`). A validação existente pegou. A regra ficou
espelhando `frontend/src/fv/estrutura.js` palavra por palavra.
**Pendente:** unificar as duas cópias em `packages/fv-shared/` — exige
autorização para tocar o pacote (rebuild do `.tgz` vendorizado).

**D3 · Checklist conhece a concessionária.** `obterChecklist` passa a ler
`localizacao.estado` e `fatura_extracao.concessionaria` do projeto quando a query
não informa. A query mantém precedência. Medido: `"Neoenergia"` / `"RN"` onde
antes vinha `"Não informada"` / `"N/A"`.

**D4 · Tracking do envio é do grupo** (defeito meu, da FV-UX-035). Novo
`compartilhamentosDoGrupo()` consolida por `share_id`: soma visualizações, pega
a primeira e a última data entre as irmãs. Continua UMA fonte — o array
`compartilhamentos[]` —; muda o RECORTE lido, de uma irmã para o grupo, sem
persistir nada novo. Medido: cliente abre 2×, **todas** as irmãs enxergam 2.

**D5 · Topologia segue o equipamento.** O unifilar roteia por
`classificarTopologiaInversor` (o classificador canônico da FV-DOM-031, decisão
4); `micros[]` continua sendo o fato da configuração, mas deixa de ser a única
forma de saber que o projeto é micro. Projeto micro sem topologia autorada:
`topologia = micro`, lacuna `topologiaMicro`, **sem** exigir `arranjoMPPTs` e
**sem** desenhar MPPT inventado. String intacto.

**Erro meu em curso, corrigido pela medição:** chamei o classificador com
`{tipo, modelo, fabricante}` num objeto só. O contrato é `(esp, ctx)` — o nome
casa por `ctx`, e `esp.tipo` não é consultado. Tudo classificava STRING em
silêncio; a validação pegou.

**Guard atualizado:** `pdfPropostaOpcao.check.js` exigia que o PDF lesse
`arranjos[]` direto. Agora exige o oposto — que **delegue** ao adaptador e não
mantenha leitura própria —, que é a propriedade mais forte.

**Regressão:** nenhuma. 34 checks (só a pré-existente B6 falha), 276 testes /fv,
9 E2E, build limpo.

---

## 5I · FV-DOM-039 — regra da estrutura unificada no SSOT

Fecha a dívida que a FV-UX-038 registrou: a regra existia em duas cópias
espelhadas. Agora tem **uma definição**, em
`packages/fv-shared/equipamentos/estrutura.js`.

**Trajetória:** FV-UX-030 criou a regra no frontend → FV-UX-037 mediu que a API
a ignorava (só valia na tela) → FV-UX-038 fechou o buraco com uma segunda cópia
no backend → FV-DOM-039 unificou.

**O que mudou de casa:** `TIPOS_ESTRUTURA`, `TIPO_OUTRO`, `estruturaVazia`,
`daEquipamentos`, `tipoForaDaLista`, `rotuloDaEstrutura`, `exigeDescricao`,
`validarEstrutura`, `paraEquipamentos`. Ficou no frontend só `resumoDaOpcao`,
que é de tela (depende de `TECNOLOGIAS_INVERSOR` do catálogo local).

`backend/src/dominio/estrutura/index.js` e `frontend/src/fv/estrutura.js` viraram
**reexportações**. O módulo do domínio permanece como ponto de entrada do
backend — os controllers importam de `dominio/`, como fazem com `gate/`,
`proposta/` e `orcamento/`.

**Mecânica do pacote:** export `./estrutura` em `packages/fv-shared/package.json`,
alias em `frontend/aliases.js` (que serve vite e vitest), e
`npm run vendor:fv-shared` → `@fortesolar/fv-shared@0.1.23`.

**Comportamento inalterado**, medido caso a caso (`validacao-fv-dom-039.mjs`):

| Caso | SSOT | API |
|---|---|---|
| `Outro` + descrição | válido | 200 |
| `Outro` sem descrição | inválido | 400 `ESTRUTURA_INVALIDA` |
| `Fibrocimento` | válido | 200 |
| `Mini Trilho` (histórico) | válido, **preservado** | 200, volta sem reclassificação |
| ausente | lacuna, não erro | 200 |

**Prova de que é uma definição só, não duas iguais:** o script compara
`back.validarEstrutura === ssot.validarEstrutura` — identidade de referência, não
"mesmo resultado por coincidência". Idem `TIPOS_ESTRUTURA` e `exigeDescricao`.

**Guard:** `estruturaEtapa.check.js` passou a ler a regra no SSOT (as asserções
de vocabulário e de "sem default" seguem o arquivo onde a regra está) e ganhou a
§10, que exige que **nenhum dos dois lados redefina** `validarEstrutura`,
`exigeDescricao` ou a lista de tipos, e que os caminhos de resolução existam dos
dois lados.

**Regressão:** nenhuma. 34 checks (só B6 pré-existente falha), 276 testes /fv,
10 E2E, build limpo, tela verificada — 6 tipos, "Mini Trilho" preservado com o
aviso, e `Outro` sem descrição desabilita o salvar com a mensagem do SSOT.

---

## 5J · FV-UX-040 — auditoria e fechamento do fluxo pós-aceite

`backend/scripts/auditoria-pos-aceite-fv-ux-040.mjs` mede cada nó do diagrama
com três perguntas: existe REGRA definida, PERSISTÊNCIA e CAMINHO?
**13 nós: 5 completos · 2 parciais · 6 ausentes.** Só se implementa nó cuja
regra já exista — inventá-la seria decisão de negócio disfarçada de código.

### Implementado (regra já existia)

**1 · O Gate cobre as rotas que escaparam da FV-UX-034** — defeito meu.
Aquela sprint guardou memorial, carta, ART, status e checklist, e deixou de fora
`PATCH /homologacao/protocolo` e `PATCH /homologacao/assistida/status`, que
moram em `routes/homologacao.js`. Medido: a opção **não escolhida** gravava
número de protocolo e chegava a `homologado` na homologação assistida. O guard
`_exigirGateHomologacao` foi **exportado** e aplicado nas duas — uma decisão, um
lugar. Consulta segue aberta (regra 9).

**2 · Protocolo da concessionária na UX (nó A2)** — a regra, o campo, o
histórico e a auditoria existiam desde `P1-CENTRAL-HOMOLOGACAO-MVP`; faltava
caminho. `EtapaHomologacao` expõe o registro, a data e a contagem do histórico;
corrigir preserva o anterior; string vazia limpa, e a remoção também é
registrada. Contrato do endpoint: `{ numero_protocolo }` — não `{ numero }`.

### NÃO implementado — sem regra definida

| Nó | Estado medido |
|---|---|
| A3 · Parecer de acesso | nenhum campo, nenhuma rota. O status tem `aprovado`, mas nada diz que é o parecer |
| A4 · Orçamento de conexão | inexistente — nem campo, nem rota, nem regra |
| B2 · Projeto Executivo | tela stub, sem campo no schema |
| B3 · Campo (equipe) | idem |
| B4 · Execução | idem (`projeto_execucao` no schema é item de checklist da homologação, não agregado) |
| B5 · As-Built | idem |
| Ordem dentro da homologação | o enum não define transições: voltar de `analise` para `rascunho` responde 200 |

### Achado a decidir

Existe um **extrator de parecer de acesso** — `pareceracessoController.js`,
`POST /api/parecer-acesso/extrair`, que lê o PDF da concessionária. A rota está
**comentada** em `server.js` com a nota "DISABLED: pdfjs-dist blocker". O
bloqueio parece vencido: o próprio controller importa `PDFParse` de `pdf-parse`,
que funciona hoje (é o que estas sprints usam para ler PDF). Reativar um
controller legado desse porte não é decisão de sprint de UX.

### Confirmado intacto

Os dois caminhos seguem **independentes**: homologação avança sem engenharia
concluída e vice-versa; ambas declaradas paralelas e liberadas só para a opção
aceita. As telas de Executivo, Execução e As-Built continuam declarando
honestamente que não são rastreáveis.

**Regressão:** nenhuma. 34 checks (só B6 pré-existente), 276 testes /fv, 11 E2E,
build limpo, protocolo verificado no navegador.

---

## 5K · FV-UX-041 — auditoria do extrator de Parecer de Acesso

`backend/scripts/auditoria-parecer-fv-ux-041.mjs`. **Nada foi reativado nem
alterado.** Veredito: **tecnicamente recuperável — 0 bloqueios**, mas 9 pontos
exigem decisão de negócio.

### Mapa do fluxo

```
PDF (multipart, multer memoryStorage)
 ↓
POST /api/parecer-acesso/extrair          ← rota COMENTADA em server.js:264
 ↓
pdf-parse (PDFParse)                       ← só conta páginas; o texto não é usado
 ↓
GEMINI 2.0-flash                           ← PDF inteiro em base64 vai ao Google
 ↓
validarExtracao + calcularCompletude       ← rejeita <100% dos campos críticos
 ↓
trainingDataCollector → data/training-data/parecer-training-examples.jsonl
 ↓
Cliente (busca por CPF/nº cliente, senão CRIA)
ProjetoFV (CRIA, status 'em_simulacao')
 ↓
SVG próprio (utils/simbolosUnifilar)       ← segundo motor de unifilar
 ↓
resposta JSON { projeto, cliente, svg, extractedData, validacao, resumo }
 ↓
UX: ProjetosFV.jsx (legada, chamada inline) · UploadParecerModal.jsx (morto)
    A UX nova /fv NÃO conhece o parecer
```

### O bloqueio histórico está VENCIDO

O controller **não importa `pdfjs-dist`** — usa `PDFParse` de `pdf-parse@2.4.5`,
que traz `pdfjs-dist@5.4.296` como transitiva. Medido: controller e router
**carregam hoje**. `pdf-parse`, `@google/generative-ai` e `multer` estão
declarados e instalados.

### Compatível com a arquitetura atual

Isolamento M-4 (`aplicarEscopo` + `carimbarTenant`) presente; `status:
'em_simulacao'` existe no enum; a saída do LLM é validada e rejeitada quando
incompleta.

### Exige decisão antes de reativar

| # | Ponto | Medida |
|---|---|---|
| 1 | **Extração por LLM** | Gemini `2.0-flash`, não parser determinístico: o mesmo PDF pode extrair diferente entre chamadas |
| 2 | **Dados pessoais ao Google** | o parecer vai inteiro em base64 — nome, CPF/CNPJ, endereço, nº de cliente |
| 3 | **Coleta para treino** | grava as extrações (com dados do cliente) em JSONL local |
| 4 | **`GOOGLE_API_KEY`** | ausente no ambiente — sem ela o endpoint responde 400 |
| 5 | **Não escreve `arranjos[]`** | grava só a forma legada; `composicaoDoProjeto` (FV-UX-038) lê, mas… |
| 6 | **Não extrai quantidade de inversor** | só marca/modelo/potência — um parecer com 8 micros vira 1 inversor |
| 7 | **Topologia fixa** | grava `tipo: 'string'` HARDCODED — parecer de microinversor seria persistido como string, contra a FV-UX-038 (D5) |
| 8 | **Segundo motor de unifilar** | desenha com `utils/simbolosUnifilar` (também usado por `unifilarController`), paralelo ao canônico `dominio/unifilar/` |
| 9 | **Entra pelo meio do fluxo** | cria Cliente + ProjetoFV direto, sem cotação, orçamento, Baseline ou Gate |

### Riscos menores

* `trainingDataCollector` cria `backend/data/training-data/` **só por ser
  importado** — efeito colateral em tempo de import (removido após a medição);
* e-mail sintético `<numero>@parecer.local` quando o parecer não traz e-mail;
* `UploadParecerModal.jsx` (279 linhas) **não é importado por ninguém**;
* `ProjetosFV.jsx` (legada, roteada) chama o endpoint inline — hoje receberia
  404 silencioso.

### Correção de registro

A FV-UX-040 reportou o controller como "197 KB". São **686 linhas / 24.353
bytes** — eu havia lido a coluna errada do `ls`.

---

## 5L · FV-UX-042 — contrato canônico do Parecer de Acesso

Entrega: **`FV-CONTRATO-PARECER-ACESSO.md`** — especificação. Nenhum extrator,
nenhuma rota reativada, nenhum campo criado, nenhum estado novo.

**Precedente aproveitado:** o sistema já resolveu "documento → extração →
confirmação humana → dado canônico" em `ProjetoFV.fatura_extracao`
(`metodo`/`confianca`/`confirmado_pelo_usuario`). O contrato do parecer é o
mesmo envelope — arquitetura reusada, não inventada. `confirmado_pelo_usuario` é
o portão: extração de LLM não é determinística e não alimenta o domínio sem
humano no meio.

**Inventário canônico** (derivado do prompt legado, que codifica experiência real
com Cosern/CELPE/CEEE/Enel/AES): identificação do documento, cliente, unidade
consumidora e geração. Cada campo com tipo, destino no fluxo atual, ou marca de
"sem destino" / "exige decisão".

**As duas correções estruturais que o contrato impõe ao legado:**
* `geracao.modulos[]` e `geracao.inversores[]` são **LISTA com quantidade**, não
  objeto único — 8 microinversores deixam de virar "1 inversor";
* topologia vem de `classificarTopologiaInversor`, nunca de `tipo: 'string'`
  fixo — preserva FV-UX-038/D5.

**Regras de normalização:** ausência é `null` (o legado fabricava seis defaults);
composição em `arranjos[]`; e-mail nunca sintético; estrutura fica vazia (SSOT
FV-DOM-039); vínculo de catálogo só com match real.

**Validação em três níveis:** impeditivo · bloqueia confirmação · lacuna
declarada. Limites citados da fonte (`{127,220,380}` de `unifilarSVG.js`; enum de
`fase_tensao`), não escolhidos por mim. A "taxa de completude" do legado foi
descartada: importa *quais* campos faltam, não quantos.

**7 decisões pendentes (D1–D7)**, nenhuma tomada: se o parecer vira nó do fluxo;
se cria ou só anexa projeto; `GD I` fora do enum; precedência parecer × fatura;
uso de LLM externo (privacidade); coleta para treino; envelope próprio ou
compartilhado.

---

## 5M · FV-DOM-042 — Parecer de Acesso no fluxo

Implementa o contrato da FV-UX-042 com as sete decisões tomadas. **A rota legada
continua comentada** — nada dela foi reativado.

### Onde cada decisão vive

| | Decisão | Onde |
|---|---|---|
| D1 | identidade + estado | `numero_parecer`, `emitido_em`, `estado: extraido\|confirmado` |
| D2 | pertence a projeto existente | endpoints em `/:id/parecer`; **nada cria cliente nem projeto** |
| D3 | `GD I` | preservado como veio, `modalidade_gd_aceita: false` + lacuna. Enum **não** ampliado |
| D4 | precedência | `compararComCanonico` → `novos` / `iguais` / `conflitos`. Não elege vencedor |
| D5 | LLM | `llm_externo` só com `PARECER_PROVEDOR_EXTERNO=habilitado` → senão **501** sem enviar nada |
| D6 | treino | nenhuma coleta; `data/training-data` não é criado |
| D7 | envelope | `parecer_extracao`, irmão de `fatura_extracao` |

### Peças

* `backend/src/dominio/parecer/index.js` — PURO: normalização, validação em três
  níveis, comparação de conflito, envelope, confirmação. **Não lê `process.env`,
  não conhece provedor nem chave, não faz rede.**
* `ProjetoFV.parecer_extracao` — envelope com `metodo`/`confianca`/
  `confirmado_pelo_usuario`, mesmo padrão conceitual da fatura.
* `POST /:id/parecer` · `GET /:id/parecer` · `POST /:id/parecer/confirmar`.

### O que a implementação garante (medido)

**Confirmar não move dado.** `aplicado_ao_projeto: false` — a confirmação declara
que um humano conferiu; levar o dado para `equipamentos`/`arranjos`/`fatura`
segue sendo ato explícito pelas etapas canônicas. É isso que faz D4 valer:
registrar um parecer que diverge da fatura deixou `fatura_extracao` intacta
(`Trifásico`/`380`/`Cosern`) e devolveu 3 conflitos declarados.

**Sem default.** Ausente vira `null` nos seis campos que o legado preenchia.
E-mail nunca sintetizado. Quantidade de **inversor** sobrevive à forma legada —
8 microinversores continuam 8.

**Três níveis:** impeditivo (sem identificação ou sem geração) · bloqueia
confirmação (CPF malformado, tensão fora de `{127,220,380}`, quantidade ausente,
potência divergindo >1 % da soma dos módulos) · lacuna nomeada. Sem "taxa de
completude".

**Nada de deferimento.** O parecer modela o DOCUMENTO. Os estados de processo que
a FV-UX-040 mediu como sem regra continuam não existindo.

### Guard atualizado

`validacao-fv-ux-040.mjs` afirmava "nenhum campo de parecer". A decisão desta
sprint criou o campo, então a asserção virou conteúdo: o envelope existe, tem os
dois estados, e **nenhum estado de deferimento** foi inventado.

**Regressão:** nenhuma. 35 checks (só B6 pré-existente), 276 testes /fv, 12 E2E,
build limpo.

---

## 5N · FV-UX-043 — UX do Parecer de Acesso

`frontend/src/fv/componentes/ParecerDeAcesso.jsx`, dentro de
`EtapaHomologacao`. Três estados, os mesmos que a FV-DOM-042 modela: **nenhum →
extraído → confirmado**. Nenhuma regra de domínio foi alterada.

### A tela não reimplementa a regra

`validacao` e `comparacao` chegam PRONTAS do servidor e são renderizadas. O
teste 16 guarda isso por conteúdo: a tela não contém `validarExtracao`,
`normalizarExtracao`, `compararComCanonico`, o conjunto `{127,220,380}`, o
vocabulário GD, o regex de CPF nem o cálculo `potencia_w × quantidade`. Quem
decide se pode confirmar é `validacao.confirmavel`, do servidor.

### Por que não há upload de PDF

Não existe extrator (FV-UX-041 auditou, FV-DOM-042 decidiu não reativar) e D5
proíbe provedor externo sem configuração. O método disponível é `manual`. O
seletor de arquivo captura **só o nome**, para rastreabilidade — o teste 3
verifica que não há `FileReader`, `readAsArrayBuffer` nem `FormData` no
componente. A tela diz isso ao operador em vez de sugerir automação inexistente.

### Verificado no navegador, ponta a ponta

```
estado 1  "Nenhum parecer registrado" + aviso de que não há leitura automática
estado 2  dados do documento · 2 divergências declaradas · 6 lacunas
          "Nada foi alterado no projeto. A decisão sobre qual valor vale é sua."
estado 3  selo "conferido"; botão de confirmar some
```

O conflito medido foi real: parecer `Monofásico/220` contra fatura
`Trifásico/380`, exibido sem sobrescrever nada (D4).

### Achado de usabilidade corrigido em curso

A fase já tinha um botão "Registrar" (protocolo da concessionária, FV-UX-040) e
o parecer criou outro com o mesmo nome. Ambíguo para o operador — e foi o que
fez minha própria automação clicar no botão errado. Rótulos desambiguados:
"Registrar parecer manualmente" (abre) e "Registrar parecer" (envia).

**Regressão:** nenhuma. 35 checks (só B6 pré-existente), **292 testes /fv**
(+16), 12 E2E, build limpo.

---

## 5O · FV-UX-044 — auditoria Parecer → conexão (implementação PARADA)

`backend/scripts/auditoria-conexao-fv-ux-044.mjs`. **14 nós: 3 completos · 6 com
regra e sem caminho · 5 sem regra.** Nada implementado — a sprint manda parar
quando falta regra de negócio, e falta.

### Já existe, e é reutilizável (não criar paralelo)

`utils/homologacao/homologacaoAssistida.js` + `concessionariaProvider.js` cobrem
quase todo o fluxo-alvo: checklist e validação **por concessionária**
(Neoenergia/Cosern, Equatorial, Energisa, CPFL, CEMIG, COPEL — documentos
obrigatórios, normas, limites de kWp, formulários), pacote documental, máquina
de estados de 7 posições e histórico de transições com motivo.

As rotas `/homologacao/assistida/{checklist,validacao,pacote,regras,status}`
respondem 200 e estão sob o Gate desde a FV-UX-040. **A UX nova não chama
nenhuma delas** (`grep assistida` no cliente de API = 0).

### Implementável (regra existe, falta caminho)

Checklist por concessionária · regras da concessionária · estado "pendente
concessionária" · data de envio · histórico de estados · deferido/indeferido com
motivo. Tudo é exposição de API existente.

### Sem regra — exige decisão

| Lacuna | Medida |
|---|---|
| **Taxa/orçamento de conexão** | **zero** estruturas: nada no schema, nada nas rotas, nada no provider. É o nó que dá nome à sprint |
| Reuso do agregado `Orcamento` | existe, mas é o orçamento COMERCIAL: INV-ORC-3 (um aprovado por projeto) e vira Baseline. Usá-lo para taxa de concessionária misturaria duas coisas |
| Homologação lê o parecer | **ninguém** consome `parecer_extracao`: o parecer confirmado não influencia checklist, validação nem estado |
| Prazo/SLA da concessionária | o provider não declara prazo — nada mede atraso |
| **Duas máquinas de estado** | `homologacao.status` (5 posições) e `status_homologacao` (7) coexistem sem regra que as concilie |

### O sintoma das duas máquinas, medido

O mesmo projeto terminou a auditoria assim:

```
status = "conectado"          (máquina legada)
status_homologacao = "reprovado"   (máquina assistida)
```

Conectado e reprovado ao mesmo tempo. Nenhuma das duas impede a outra.

---

## 5P · FV-DOM-040 — auditoria das máquinas de estado

`backend/scripts/auditoria-estados-fv-dom-040.mjs`. **Nada implementado.**

### Inventário

| Máquina | Estados | Persistida |
|---|---|---|
| **A · homologação legada** | `rascunho → enviado → analise → aprovado → conectado` | `homologacao.status` |
| **B · homologação assistida** | `nao_iniciado → em_preparacao → pendente_documentacao → pendente_engenharia → pendente_concessionaria → homologado/reprovado` | `homologacao.status_homologacao` |
| **Conexão** | não tem máquina própria — `conectado` é o último estado de **A** | — |
| **Gate** | DERIVADO, nunca persistido (INV-58) | — |
| **Baseline** | agregado próprio, congelado, índice único por projeto | `Baseline` |

Fora do escopo mas presentes: `projeto.status` (11 estados de ciclo de vida) e
as máquinas de governança/freeze do wizard legado.

### Quem grava, quem lê — há uma inversão

* **A** ← `PATCH /homologacao/status` (homologacaoController); lida pela **UX
  NOVA** (`/fv`, `EtapaHomologacao`);
* **B** ← `PATCH /homologacao/assistida/status` (routes/homologacao.js); lida
  pela **UX LEGADA** (`CentralDados.jsx`, `CrmProjetos.jsx`).

A interface nova dirige a máquina antiga, e a antiga dirige a nova.

**Nenhum domínio decide com base nesses estados** — confirmado na fonte: Gate,
BaselineService e o domínio da proposta não os leem. São puramente descritivos.

### Transições: não há tabela

Medido nas duas máquinas: pular estados e **regredir** são aceitos com HTTP 200.
Só valor fora do enum é recusado (400).

O contraste importa: **o projeto tem tabelas de transição** — `TRANSICOES` em
`ativosController` e `TRANSICOES_FREEZE` em `fv-shared/estados`, aplicada em
`projetosFVController`. A homologação simplesmente não usa o padrão da casa.

### Caso crítico — reproduzido

```
PATCH /homologacao/status           { status: 'conectado' }   → 200
PATCH /homologacao/assistida/status { status: 'reprovado' }   → 200

homologacao.status             = conectado
homologacao.status_homologacao = reprovado
projeto.status                 = rascunho
```

Usina CONECTADA à rede e homologação REPROVADA, ao mesmo tempo — e o ciclo de
vida do projeto ainda em `rascunho`, uma terceira afirmação incompatível. A
ordem inversa também passa. `GET /homologacao/status` devolve os dois valores
contraditórios **no mesmo payload**.

### Independência

Ao gravar A ninguém consulta B, e vice-versa. **Nenhuma regra declara combinação
inválida**: as 5 × 7 = 35 combinações são todas aceitas.

### Gate e Baseline — intactos

O Gate não olha estado de homologação (decide por Baseline íntegra + opção
aceita) e continuou `liberada=true` depois de reprovar; a Baseline permaneceu
com o mesmo hash. E o Gate **barra a escrita** na opção não escolhida
(409 `OPCAO_NAO_ESCOLHIDA`), como a FV-UX-040 deixou.

### Endpoints que gravam estado

`PATCH /homologacao/status` · `PATCH /homologacao/assistida/status` ·
`PATCH /homologacao/protocolo` · `PATCH /homologacao/checklist`.

---

## 5Q · FV-DOM-041 — máquina canônica de homologação (definição)

Entrega: **`FV-DECISAO-MAQUINA-HOMOLOGACAO.md`**. Nenhum código alterado.

**Recomendação: B (`status_homologacao`) é canônica.** A vira adaptador de
compatibilidade, com descontinuação prevista.

**Quatro razões técnicas:**

1. **A mistura assuntos.** `conectado` é fato físico/comercial da usina, não
   resposta da concessionária. Uma máquina cujo estado terminal pertence a outro
   assunto não pode ser fonte canônica dele — e é a raiz do caso crítico.
2. **B nomeia o bloqueio.** `pendente_documentacao` / `pendente_engenharia` /
   `pendente_concessionaria` dizem de quem é a bola; o `analise` de A não diz.
   Os nós do fluxo da FV-UX-044 mapeiam 1:1 em B; em A, três colapsam em um.
3. **Só B tem histórico** (`{em, de, para, por, motivo}`, gravado a cada
   transição). **A → B é reconstrutível** a partir de `data_envio` e
   `data_aprovacao`; **B → A destrói** autor e motivo. Escolher A seria escolher
   a máquina que perde dado.
4. **O custo de B está na UX, não nos dados** — religar uma tela que já foi
   reescrita duas vezes. Escolher A descartaria o histórico, o vocabulário de
   bloqueio e as regras por concessionária (`concessionariaProvider`), que só
   existem do lado de B.

Nenhum domínio depende das duas (confirmado na FV-DOM-040), o que torna a
escolha reversível e de baixo risco.

**Transições propostas** no padrão de `TRANSICOES_FREEZE`: impedem salto
(`nao_iniciado → homologado`), regressão de terminal e deferimento sem passar
pela concessionária; permitem de propósito o vaivém entre pendências, que é a
exigência real da distribuidora.

**`conectado + reprovado`:** sob B o caso **deixa de ser representável** — B não
tem estado de conexão. A contradição some por construção, não por validação
cruzada.

**A como adaptador:** deixa de ser escrita; vira projeção derivada de B; o
endpoint legado traduz o vocabulário antigo e recusa `conectado`.

**PARADO em 6 decisões de negócio** — as duas travantes: `reprovado` é terminal
ou reabre (a linha da tabela depende disso), e o que o leitor legado enxerga
quando B diz `reprovado`, já que A não tem correspondente e criar estado é
proibido.

---

## 5R · FV-DOM-043 — fechamento D1–D6 da homologação

> Prompt chegou como `FV-DOM-042`, número já usado pelo Parecer (§5M).
> Registrado como **FV-DOM-043**.

Entrega: **`FV-DECISAO-HOMOLOGACAO-D1-D6.md`**. Nenhum código alterado.

| | Decisão | Recomendação | Sustentação medida |
|---|---|---|---|
| D1 | `reprovado` | **não terminal**: `→ em_preparacao` com motivo obrigatório; nova transição no mesmo ciclo | é a única alternativa que a persistência atual sustenta — `historico_status` e `protocolo_historico` já acumulam |
| D2 | legado A | **projeção derivada de B**, somente leitura, descontinuação prevista | A tem **1** escritor de produção e **1** leitor real |
| D3 | conexão | fora da homologação — **PARADO** | **não existe agregado de conexão**; `AtivoEquipamento` é por equipamento (`planejado→…→operacional`), não por usina |
| D4 | conexão provisória | **PENDENTE** | zero evidência no sistema |
| D5 | `homologado` | **Gate + vir de `pendente_concessionaria`**, nada além | hoje exige só o Gate; `validarDocumentos` é relatório, não barreira; parecer não tem leitor |
| D6 | desistência | **nenhum estado novo** | o conceito já existe no nível do projeto: `MOTIVOS_ARQUIVAMENTO` (`'Cliente desistiu'`) + `projeto.status` perdido/cancelado/arquivado |

**Defeito encontrado no mapeamento (não corrigido — sprint proíbe):**
`scripts/backfillLocalSuperficie.js:66` compara `homologacao.status ===
'homologado'`, mas `'homologado'` **não pertence ao enum de A** — pertence a B.
A condição nunca é verdadeira: o script crê que pula projetos homologados e não
pula nenhum.

**Dado a preservar:** projetos com `homologacao.status = 'conectado'` carregam
afirmação que nenhum destino canônico recebe enquanto D3 não for decidida. Não
descartar antes disso.

**D3 é a única que trava implementação.** Com D1, D2, D5 e D6, a tabela de
transições da FV-DOM-041 fica completa e implementável.

---

## 5S · FV-DOM-044 — estado de conexão (auditoria)

Entrega: **`FV-DECISAO-ESTADO-CONEXAO.md`**. Nenhum código alterado, nenhum
projeto tocado.

**Premissa do enunciado corrigida:** `projeto.status` **não tem** `conectado`
(enum: rascunho…arquivado). O valor existe só em `homologacao.status`.

### Proveniência de `conectado`

* **1 escritor**, genérico: `PATCH /homologacao/status` — `conectado` é só um dos
  cinco valores aceitos. Nada no sistema "conecta" uma usina; alguém escolhe a
  palavra numa lista;
* **2 leitores**, ambos rótulo/exibição na mesma tela (`EtapaHomologacao`).
  **Nenhuma regra, cálculo, relatório, Gate ou documento depende dele.**

### O que existe para conexão física

| Conceito | Persistido? |
|---|---|
| `medidor` (65 ocorrências) | **não** — só símbolo de desenho, render de unifilar e leitura da fatura |
| `comissionamento` | **sim**, mas em `AtivoEquipamento` (por peça): `data_comissionamento`, `comissionado_por` |
| energização · troca de medidor · data de conexão | **zero ocorrências** |

`AtivoEquipamento` é as-built **por equipamento** (`planejado→…→operacional`,
com transições declaradas). **Somar peças comissionadas não produz "usina
conectada"** — são atores diferentes: equipe de campo × distribuidora.

### Quatro fatos distintos, dois representados

homologação aprovada (B) · **conexão física (nenhum lugar)** · conexão provisória
(não existe) · equipamento operacional (`AtivoEquipamento`, por peça).

### `projeto.status` não serve

É a máquina comercial/lifecycle (funil + execução; terminais `perdido`,
`cancelado`, `arquivado`). `em_execucao` começa antes da conexão; `concluido` é
encerramento do projeto. Reinterpretar qualquer um mudaria o significado de um
enum lido em toda a aplicação.

### Decisão de domínio registrada

**Não existe destino adequado.** Proposta mínima — **nada criado**:
`ProjetoFV.conexao { conectada_em, registrada_por, numero_medidor, observacoes }`.
Conexão é **evento, não processo**: uma data já é a máquina binária inteira, sem
enum novo e sem agregado.

### Preservação

Um projeto com `status='conectado'` afirma apenas que **alguém declarou a usina
conectada** — sem data, sem autor (A não tem histórico). Remover sem destino
perde o fato de a usina estar em operação.

**Quantos projetos: não mensurável daqui** — produção é proibida e o ambiente
isolado só tem dado sintético. Consulta de leitura pura fornecida no documento,
para quem tem acesso.

**Pendências de negócio:** conexão exige `homologado`? quem declara? encerra o
projeto? `numero_medidor` obrigatório?

---

## 5T · FV-DOM-045 — fechamento do domínio de conexão

Entrega: **`FV-DECISAO-CONEXAO-D1-D6.md`**. Nenhum código alterado, nenhum dado
tocado.

### Achado decisivo da auditoria

```
homologacaoController.js  (máquina A)  →  0 chamadas de auditoria
routes/homologacao.js     (máquina B)  →  7 chamadas de auditoria
```

`atualizarStatusHomologacao` **não audita** — só grava. Somado ao fato de A não
ter histórico, isso significa: para um projeto com `status = 'conectado'`, **a
data e o autor da declaração não existem em lugar nenhum**. Não é questão de
onde buscar; nunca foi gravado. É o que decide D6.

### Decisões

| | Decisão | Base medida |
|---|---|---|
| D1 | pré-condição: **recomendação, não bloqueio**; divergência declarada | nenhuma regra do sistema usa `homologado` como pré-condição — o único uso é um alerta informativo |
| D2 | autoridade: **`editar` em `fv`**, sem controle novo | RBAC é módulo × ação; `verificarPerfil` existe e **nunca foi usado**. Hoje o perfil `comercial` pode declarar conexão |
| D3 | evidência: **data + confirmação manual** | o sistema **não armazena documento de concessionária** — só referências e links |
| D4 | `numero_medidor`: **opcional**, lacuna declarada | não existe regra alguma sobre medidor; `medidor` nem está no enum de `AtivoEquipamento.tipo` |
| D5 | efeito: **apenas fato**, zero colateral | `conectado` hoje não afeta nada; Gate decide por Baseline + aceite |
| D6 | legado: **histórico**, sem migração automática | a data não existe — inventá-la de `updatedAt` ou `data_aprovacao` seria dado falso |

### Achado colateral

`homologacaoAssistida.js:209` já contém a ponte **A→B**:
`status_homologacao || (status === 'aprovado' ? 'homologado' : 'nao_iniciado')`.
A direção de compatibilidade proposta na FV-DOM-041 **já está codificada**.

### Contrato proposto (não implementado)

`ProjetoFV.conexao { conectada_em, registrada_por, registrada_em,
numero_medidor, sem_homologacao, observacoes }`.

`conectada_em` é a máquina inteira — `null` = não conectada. Separa a **data da
conexão** da **data do registro**, que A confundia por não ter nenhuma.

### Migração conceitual

Passo 0 **contar** (consulta na FV-DOM-044 §5.2 — exige acesso a produção) ·
nunca fazer backfill de data · coexistência silenciosa · **UX pergunta a data ao
operador**, um projeto por vez · desligar A só depois da tradução para B.

**4 pendências de negócio.** Travantes: se `comercial` pode declarar conexão, e
se conexão encerra a execução.

---

## 5U · FV-DOM-046 — decisões travantes de conexão (FECHADAS)

Entrega: **`FV-DECISAO-CONEXAO-TRAVANTES.md`**. Nenhum código alterado.
**As duas decisões fecharam com evidência do sistema — não foi preciso parar.**

### D1 · quem registra conexão → **`editar` em `fv`** (alternativa A)

O precedente que decide: **aprovar orçamento** — ato que congela a Baseline,
origina o contrato e é irreversível (INV-ORC-3, M-2) — está protegido apenas por
`protegerModulo('fv')` → `POST` → `editar`, e `OrcamentoService` não checa perfil.
**Hoje o perfil `comercial` já congela Baseline.**

Exigir `aprovar` para conexão aplicaria o controle mais estrito ao ato **menos**
consequente. E seria o **primeiro ponto de aplicação** desse nível em toda a
aplicação: `verificarPermissao` e `verificarPerfil` existem e **nunca foram
usados** — zero rotas com `aprovar`.

### D2 · conexão encerra execução? → **apenas o fato** (alternativa A)

Quatro evidências:

1. **`projeto.status` não tem nenhuma transição automática.** Três escritores em
   produção, todos manuais: arquivar, restaurar e `PUT /:id/status`. Nem aceite
   de proposta, nem Baseline, nem homologação movem o ciclo de vida;
2. **zero ocorrências** ligando `conectado` a `concluido` em backend ou frontend;
3. **alternativa C é inviável**: Projeto Executivo, Execução e As-Built continuam
   stubs sem agregado — não há etapa com conteúdo a liberar;
4. `concluido` é indicador de carteira (`dashboard.js` o exclui dos ativos), não
   de energização.

Só existe **um** gate — o da bifurcação, alimentado por Baseline + aceite, ambos
anteriores à conexão. Não há portão que a conexão pudesse abrir.

### Contrato final — 4 campos

`conexao { conectada_em, registrada_por, numero_medidor, observacoes }`.

**Retirei os dois campos que eu propusera na FV-DOM-045:** `sem_homologacao` é
**derivável** (INV-58 proíbe persistir derivado — a divergência se calcula na
leitura) e `registrada_em` é redundante com auditoria.

**Requisito no lugar dele:** o endpoint futuro **tem de auditar** — sem isso
repetiríamos o defeito de A, que grava sem auditar e por isso perdeu para sempre
data e autor de todo `conectado` existente.

### Pendência encontrada, fora do escopo

**Aprovação de orçamento está em `editar`** — se o negócio quiser controle por
perfil, o alvo é esse, não conexão. Sprint própria.

---

## 5V · FV-DOM-047 — domínio de conexão implementado

Implementa o fato de conexão conforme FV-DOM-044/045/046. **Contrato de 3
campos**, como especificado: `conexao { conectada_em, numero_medidor,
observacoes }`.

### Peças

* `backend/src/dominio/conexao/index.js` — PURO. Não menciona `projeto.status`,
  Baseline nem Gate (o guard verifica);
* `ProjetoFV.conexao` — aditivo, `null` em todo documento existente;
* `GET/PUT/DELETE /api/projetos-fv/:id/conexao`.

### O que a implementação garante (medido)

**Conexão é fato, não máquina.** `conectada_em` é a máquina inteira — `null` =
não conectada. Sem enum, sem transição, sem estado intermediário. Corrigir a data
corrige o MESMO fato; não cria segunda conexão.

**Zero efeito colateral**, medido antes/depois: `projeto.status` inalterado,
Baseline com o mesmo hash, Gate **byte a byte igual**.

**Não exige `homologado` — declara divergência.** O caso crítico da FV-DOM-040
deixa de ser silencioso: conectada + reprovada agora responde *"Usina registrada
como conectada, mas a homologação foi REPROVADA."* E a divergência é **derivada
na leitura**, nunca persistida (INV-58) — o documento tem exatamente 3 campos.

**Regra 5 da FV-DOM-032 aplicada sem tocar o Gate:** lê `estadoDaOpcao` do
domínio do Gate (leitura pura) e recusa a opção não escolhida com 409. Antes de
alguém escolher, não bloqueia.

**Legado intocado:** `homologacao.status = 'conectado'` não é interpretado como
conexão, não é migrado, não é convertido — é apenas EXIBIDO como
`legado_conectado`. Nenhum backfill de data, porque aquela data nunca existiu.

**Auditoria obrigatória** — é o que substitui `registrada_por`, ausente do
contrato. Medido no AuditLog: 22 entradas `CONEXAO_*`, todas com autor, e a
correção guardando a transição
`2026-05-14 → 2026-05-12 medidor=MED-77123`.

### Erro meu, corrigido em curso

Uma asserção do script de validação terminava em `|| true` — passava sempre e
não media nada. Guard vazio é pior que guard ausente, porque parece cobertura.
Substituída por leitura real do `AuditLog`. (E meu primeiro query olhou o campo
errado: `auditarCiclo` grava o detalhe em `path`, não em `detalhe`.)

**Regressão:** nenhuma. 36 checks (só B6 pré-existente), 292 testes /fv, 13 E2E,
build limpo.

---

## 5W · FV-AUD-048 — mapa real (BASELINE TÉCNICO)

Entrega: **`FV-MAPA-REAL.md`**. Fotografia do que existe, medida contra a API em
execução. Nada implementado, nada corrigido, nada inferido.

**19 nós OK · 4 STUB · 7 NÃO IMPLEMENTADO · 1 CONTRADIÇÃO · 5 DIVERGÊNCIAS ·
7 máquinas de estado · 13 domínios puros.**

O fluxo foi **exercido de ponta a ponta** num único projeto: cliente → projeto →
equipamentos → estrutura → dimensionamento → topologia → unifilar → orçamento →
Baseline → 2 opções → PDF → envio (snapshot congelado) → aceite → bifurcação.

### Depois do aceite — como o código executa

```
ACEITE ├── HOMOLOGAÇÃO   liberada · paralela
       └── ENGENHARIA    liberada · paralela
```

**Não são sequência** (medido): homologação avançou sem engenharia concluir, e o
unifilar gerou com a homologação em preparação. Só a opção aceita avança — a
irmã recebe 409 em todos os oito caminhos de escrita.

### A contradição viva

Reproduzida: `homologacao.status="conectado"` ∧ `status_homologacao="reprovado"`
∧ `projeto.status="rascunho"`. Decidida nas FV-DOM-041/043, **não implementada**.

**Contraste medido:** o domínio de conexão da FV-DOM-047 **declara** a mesma
divergência em vez de contradizer — derivada na leitura, nunca persistida.

### Divergências

UX nova dirige a máquina legada e vice-versa · dois motores de unifilar ·
`backfillLocalSuperficie:66` compara contra o enum errado · **A não audita**
(0 × 7 chamadas) · duas formas de composição no schema.

### Não implementado

Taxa de conexão · parecer como etapa · conexão provisória · prazo/SLA ·
**UX da conexão** (API existe desde a FV-DOM-047) · PDF na página pública ·
**ninguém lê `parecer_extracao`** · `GET /proposta/download` responde 404 sempre.

**Conclusão:** a espinha comercial está fechada. O que falta é depois do aceite.

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
| FV-DOM-031C | "`gerarPDFUnifilar` ainda desenha pelo caminho antigo" | aquele arquivo é o PDF do **EV** (`construirCanonicalDeProjetoEV`); **nunca desenhou FV**. O bloqueio real é outro: não existe PDF de unifilar FV |
| FV-DOM-031B | "a distribuição fill-based é herdada e não se corrige sem regra nova" | a 031B corrigiu: equilibrada, e o veredito de oversizing passou a responder à quantidade de micros |

---

## 7 · Regressão de referência (baseline)

| Verificação | Valor |
|---|---|
| Suíte frontend | **25 falhas em 6 arquivos**, 973 testes |
| Build | 2396 módulos |
| Checks backend | 15, sendo 14 ✅ e 1 falha pré-existente (B6) |
| Produção | intocada · nada commitado em toda a série |

---

## 8 · FV-DOM-056 — integridade topologia → unifilar

Sprint de correção. Fecha o defeito que a **FV-QA-055** encontrou no navegador
(T07/T09) e que a FV-DOM-051 já tinha previsto no código.

### Causa raiz

`montarModeloEletrico` tem um **ramo de compatibilidade**: sem `arranjoMPPTs`,
usa `dimensionamento.numPaineis ?? 6` como UMA string e `Pmpp ?? 550`
(`engenhariaNormativa.js:365-378`, `:348`). Existe para o wizard legado, onde um
traço aproximado vale mais que nenhum.

O defeito não era do motor: era o **domínio canônico deixar esse ramo ser
alcançado**. `gerarUnifilarDoProjeto` chamava o motor sem verificar se havia
topologia que sustentasse o desenho.

Medido em T07/T09 — 77 módulos, 2 × 25 kW, topologia **recusada** pelo validador
(`Vmpp no frio 1017,85 V > 850 V`):

| | antes |
|---|---|
| Potência CA | **25 kW** — metade dos 50 kW comprados |
| Strings / MPPTs | **1 / 1** — uma string de 77 módulos |
| Voc máx. | **3933,1 V** — 3,9× o limite de 1000 V do inversor |
| Aviso | nenhum |

### Correção

`backend/src/dominio/unifilar/integridade.js` (**novo**) — portão puro, sem I/O,
avaliado antes de desenhar. Quatro recusas, cada uma com motivo técnico:

| Código | Quando |
|---|---|
| `TOPOLOGIA_AUSENTE` | sem `mppts[]` (string) ou sem `micros[]` (micro) |
| `TOPOLOGIA_INVALIDA` | `engenharia_eletrica.compatibilidade.compativel === false` |
| `MULTIPLOS_INVERSORES` | composição com mais de um inversor — o desenho representa um só |
| `TOPOLOGIA_DIVERGENTE` | módulos ligados ≠ módulos comprados |

Recusa devolve `svg: null` + `impedimento`. **Nunca um desenho alternativo.**

### Arquivos

| Arquivo | Mudança |
|---|---|
| `dominio/unifilar/integridade.js` | **novo** — o portão |
| `dominio/unifilar/index.js` | chama `avaliarIntegridade`; `recusar()` |
| `controllers/projetosFVController.js` | devolve `impedimento` (HTTP 200) |
| `fv/providers/UnifilarProvider.jsx` | expõe `impedimento` |
| `fv/paginas/etapas/EtapaUnifilar.jsx` | mostra o motivo no lugar do diagrama |
| `__checks__/integridadeUnifilar.check.js` | **novo** — 45 asserções |
| `__checks__/unifilarDominio.check.js` | 1 asserção revogada (projeto vazio já não desenha) |

**Não tocados:** `montarModeloEletrico`, `gerarUnifilarSVG`, wizard legado
(usa o próprio `frontend/utils/gerarUnifilarSVG.js`), Baseline, Gate, conexão,
parecer, cálculo de necessidade. Nenhum campo novo, nenhuma migração.

### Evidência no navegador (ambiente isolado, catálogo semeado)

| Cenário | Antes | Depois |
|---|---|---|
| T01 mono string 6 kWp | 6,5 kWp · 2 str · Voc 255,4 V | **idêntico** |
| T03 **sem** topologia | 10,4 kWp · 1 str · **Voc 817,3 V** | **recusa** `TOPOLOGIA_AUSENTE` |
| T03 **com** topologia | 10,4 kWp · 2 str · Voc 408,6 V | **idêntico** |
| T05 tri string 14 kWp | 14,3 kWp · 3 str · Voc 408,6 V | **idêntico** |
| T07 tri 50 kWp, 2×25 | **Voc 3933,1 V · CA 25 kW** | **recusa** `TOPOLOGIA_AUSENTE` |
| T09 2 inversores, topologia válida | desenhava com 1 inversor | **recusa** `MULTIPLOS_INVERSORES` |

Em T07 as strings `3933`, `25 kW` e `77` deixaram de existir na resposta.

### Regressão

| Verificação | Resultado |
|---|---|
| Checks de domínio | **30/30 OK** |
| Testes frontend FV | **292/292 OK** (14 arquivos) |
| Wizard legado | intocado — caminho próprio, sem o portão |
| Produção | intocada · sem commit · sem push |

### Achados da FV-QA-055 deixados de fora (por escopo)

Página pública contradiz a si mesma · duas máquinas de homologação vivas · sem
UX de conexão · envio exige orçamento na opção vazia · topologia cobre um
inversor só (o portão **declara**, não resolve) · micro salva 1,30× > 1,25 ·
data do parecer com um dia a menos · Opção 02 rotulada "Opção 01" · navegação
diz que Homologação não existe · Cotação redigita consumo.

---

## 9 · FV-QA-056 — reteste pós-correção

Sprint de auditoria. **Nenhum arquivo de produto alterado** — só este documento.
Os 9 cenários da FV-QA-055 foram reexecutados na UX real, ambiente isolado,
mesmas premissas (Znshine 650 W · COSERN/RN · HSP 5,2 · perdas 18% · margem 10%).

### Matriz final

| Cenário | UX | Topologia | Unifilar | Potências (nec · comp · inst) | Resultado |
|---|---|---|---|---|---|
| T01 mono string 6 | ok | 2 MPPT × 5 salva | 6,5 kWp · 2 str · Voc 255,4 V | 6,02 · 6,50 · 6,50 | **igual à QA-055** |
| T02 mono micro 6 | ok | 3 micros salva | 6,5 kWp · CA 6 kW | 6,02 · 6,50 · 6,50 | igual · CC/CA 1,30× |
| T03 **sem** topologia | ok | ausente | **recusa** `TOPOLOGIA_AUSENTE` | 9,97 · 10,40 · — | **corrigido** (era Voc 817,3 V) |
| T03 **com** topologia | ok | 2 MPPT × 8 salva | 10,4 kWp · 2 str · Voc 408,6 V | 9,97 · 10,40 · 10,40 | **igual à QA-055** |
| T04 mono micro 10 | ok | 5 micros salva | 10,4 kWp · CA 10 kW | 9,97 · 10,40 · 10,40 | igual · CC/CA 1,30× |
| T05 tri string 14 | ok | 3 MPPT 8/7/7 salva | 14,3 kWp · 3 str · Voc 408,6 V | 14,02 · 14,30 · 14,30 | **igual à QA-055** |
| T06 tri micro 14 | ok | 7 micros salva | 14,3 kWp · CA 14 kW | 14,02 · 14,30 · 14,30 | igual · micro 1Ø em 3Ø |
| T07 tri string 50 (2×25) | ok | **bloqueada** — Vmpp frio 1017,85 V > 850 V | **recusa** `TOPOLOGIA_AUSENTE` | 49,87 · 50,05 · — | **corrigido** (era Voc 3933,1 V · CA 25 kW) |
| T08 tri micro 50 | ok | 25 micros salva | 50,05 kWp · CA 50 kW · 77 mód | 49,87 · 50,05 · 50,05 | igual · CC/CA 1,30× |
| T09 tri string 2×25 (77 mód) | ok | **bloqueada** — Vmpp frio 1017,85 V > 800 V | **recusa** `TOPOLOGIA_AUSENTE` | 49,87 · 50,05 · — | **corrigido** |
| T09b 2 inversores, topologia **válida** | ok | 3 MPPT × 8 salva | **recusa** `MULTIPLOS_INVERSORES` | — · 15,60 · — | **corrigido** |

`3933` e `817.3` não aparecem em nenhuma resposta. Sete cenários mantêm valores
byte a byte idênticos à QA-055 — **nenhuma regressão**.

### Ciclo completo T01 (reteste)

cliente → projeto → dados técnicos → equipamentos → estrutura → dimensionamento
→ topologia → unifilar → cotação → orçamento (EMITIDO) → aprovação (Baseline
íntegra) → opções → proposta → envio → página pública → **aceite pelo cliente**
→ Gate (Engenharia e Homologação liberadas) → homologação (Enviado → protocolo
`PROT-T01-2026-0001` → parecer `PA-2026-0099` → Em análise → Aprovado) →
conexão (`PUT /:id/conexao`, HTTP 200).

Bloqueios encontrados, todos **já conhecidos e não corrigidos por escopo**:
envio recusado até a Opção 02 ter orçamento aprovado; conexão sem UX; divergência
`homologação em "nao_iniciado"` no registro da conexão.

### Achados vivos e classificação

| # | Achado | Sev. | Causa | Decisão existente | Próxima ação |
|---|---|---|---|---|---|
| 1 | Página pública e proposta exibem `dimensionamento.potencia_kwp` (6,02) ao lado de 10 × 650 W | **P1** | conhecida — propagação, FV-DOM-053 | **sim** — FV-DOM-050/051 | FV-DOM-053, bloqueada por 3 ambiguidades |
| 2 | PDF rotula "Potência Instalada" sobre a necessidade | **P1** | conhecida | **sim** | FV-DOM-055 (após 053) |
| 3 | ART cobrada por faixa da necessidade, e o memorial vem do `req.body` | **P1** | conhecida | não | sprint própria — muda contrato do endpoint |
| 4 | Duas máquinas de homologação vivas: UX escreve na legada, conexão lê a canônica | **P1** | conhecida | **sim** — FV-DOM-041/043 (B canônica, A projeção) | implementar a decisão |
| 5 | Topologia cobre um inversor só | **P2** | conhecida — declarada na tela | não | decisão de domínio pendente |
| 6 | Micro salva CC/CA 1,30× > 1,25 do fabricante | **P2** | conhecida | **sim** — FV-DOM-031: registrar e declarar | nenhuma |
| 7 | Envio exige orçamento na Opção 02 vazia criada pela própria UX | **P2** | conhecida | não | decisão de negócio |
| 8 | Sem UX de conexão (API pronta desde FV-DOM-047) | **P2** | conhecida | **sim** | sprint de UX |
| 9 | Cotação redigita consumo/tarifa/HSP — segunda fonte | **P2** | conhecida | não | decisão de negócio |
| 10 | `homologacaoDTO` lê `dimensionamentoV3`, campo inexistente → sempre 0 | **P2** | conhecida | não | verificar se o DTO está vivo |
| 11 | Navegação diz "Agregado não implementado" e a tela de Homologação funciona | **P3** | conhecida | não | rótulo |
| 12 | Opção 02 rotulada "Opção 01" na tela de Orçamentos | **P3** | conhecida | não | rótulo |
| 13 | Data do parecer exibe um dia a menos (fuso) | **P3** | conhecida | não | formatação |
| 14 | Link da proposta usa origem fixa (`:5173`) em vez da origem da requisição | **P3** | **nova** — observada ao rodar em porta alternativa | não | verificar antes de qualquer deploy |

**Nenhum P0 vivo.** O único P0 da série — documento tecnicamente impossível —
foi fechado pela FV-DOM-056 e confirmado fechado aqui.

### Pronto para implementação

FV-DOM-053 (migrar leitores de engenharia/regulatórios) — **depende** de fechar
as ambiguidades 1, 3 e 6 do mapa de leitores.

### Bloqueado por decisão de negócio

Faixa de divergência aceitável entre necessidade e instalada · significado de
`potenciaArredondada` nas duas UX · congelamento técnico na UX nova
(`engineering_lock` só é alimentado pelo wizard) · propostas já enviadas quando
a potência exibida mudar · envio com opção vazia · segunda fonte de consumo.

---

## §10 — FV-DOM-056 / RETOMADA FINAL: matriz T01–T09b no ambiente QA real

Executada pela UX real (frontend Vite local com `/api` apontado ao backend de
QA via `VITE_PROXY_TARGET`), contra `backend-qa-staging.up.railway.app` →
Atlas `Forte-Solar-QA / ClusterQA / forte_solar_staging` (51 equipamentos).
A publicação do frontend na Vercel permanece **BLOCKED** (device code, sem
`VERCEL_TOKEN` e sem extensão do Chrome conectada) — o proxy local é o
substituto declarado, não uma simulação: o backend, o banco e o catálogo são
os reais do QA.

| Cenário | Projeto | Topologia | Unifilar | necessidade · comprada · instalada | vs. baseline |
|---|---|---|---|---|---|
| T01 sem topologia | `6a949156565a361d6e525cbb` | ausente | **recusa** `TOPOLOGIA_AUSENTE` | 6,02 · 6,50 · — | igual |
| T01 completo | idem | 2 MPPT | 6,50 kWp · 2 str · Voc 255,4 V | 6,02 · 6,50 · 6,50 | igual |
| T02 mono micro 6 | `6a949b4b565a361d6e525dcd` | 3 micros | 6,50 kWp · CA 6 kW | 6,02 · 6,50 · 6,50 | igual · CC/CA 1,30× |
| T03 sem topologia | `6a94a6237582fad7c3de9870` | ausente | **recusa** | 9,97 · 10,40 · — | igual |
| T03 com topologia | idem | 2 MPPT × 8 | 10,4 kWp · 2 str · Voc 408,6 V | 9,97 · 10,40 · 10,40 | igual |
| T04 mono micro 10 | `6a94a7027582fad7c3de990f` | 4 micros necessários | 10,4 kWp · CA 10 kW | 9,97 · 10,40 · 10,40 | igual · CC/CA 1,30× |
| T05 tri string 14 | `6a94a7ba7582fad7c3de99ab` | 3 MPPT 8/7/7 | 14,3 kWp · 3 str · 3 MPPT · Voc 408,6 V | 14,02 · 14,30 · 14,30 | igual |
| T06 tri micro 14 | `6a94a92b7582fad7c3de9a4f` | 7 micros | 14,3 kWp · CA 14 kW | 14,02 · 14,30 · 14,30 | igual |
| T07 tri string 50 (2×25) | `6a9492cf565a361d6e525d42` | **bloqueada** — Vmpp frio 1017,85 V > 850 V | **recusa** | 49,87 · 50,05 · — | igual |
| T08 tri micro 50 | `6a94aa2e7582fad7c3de9b13` | 25 micros | 50,05 kWp · CA 50 kW · 77 mód | 49,87 · 50,05 · 50,05 | igual |
| T09 tri 2×25 (Symo+SG25RT) | `6a94aae67582fad7c3de9bc7` | **bloqueada** — 1017,85 V > 800 V | **recusa** `TOPOLOGIA_AUSENTE` | 49,87 · 50,05 · — | igual |
| T09b dois inversores | `6a94abf07582fad7c3de9d0d` | 3 MPPT × 8 **salva** | **recusa** `MULTIPLOS_INVERSORES` | 15,48 · 15,60 · — | igual |

`3933`, `817.3` e `817,3` não aparecem em nenhuma resposta. Doze execuções,
doze iguais ao `FV-QA-BASELINE-001.md` — o baseline se reproduz em banco e
backend reais, não só no ambiente efêmero em que foi levantado.

### Observação registrada, não corrigida

O T06 (micro monofásico em rede trifásica) **não emite aviso**. A busca no
código não encontra nenhuma regra que compare a fase do inversor com a fase da
ligação. O `FV-QA-BASELINE-001.md` também não exige esse aviso — a menção
"micro 1Ø em 3Ø" na §9 desta nota descrevia a montagem do cenário, não uma
saída esperada. Fica como **lacuna P2 nova**, não como regressão.

### Suítes após a matriz

30 checks de domínio OK · `infraOrigens` OK (63) · frontend 1234/1259, as 25
falhas em `components/diagram/*` (EV), `alertCenter88` e `catalogoEngenharia` —
nenhum arquivo tocado por esta sprint, que só alterou `frontend/vercel.staging.json`.

---

## §11 — FV-QA FASE FINAL: frontend publicado na Vercel

O BLOCKED da Vercel caiu: a CLI está autenticada (`carlosrenatoalcantara-debug`).
Publicado um projeto **novo e separado**, `projeto-frts-qa` — o de produção,
`projeto-frts-app`, não foi tocado (última alteração continua em 14 d).

| Item | Valor |
|---|---|
| Frontend QA | `https://projeto-frts-qa.vercel.app` |
| Build | `npm run build:staging` — verificador do bundle 12/12 ✓ |
| `/api/*` | rewrite → `https://backend-qa-staging.up.railway.app/api/*` |
| Backend QA | `forte-solar-qa` `07ea3aa7…` / `staging` `51093c87…` / `backend-qa` `71242089…` |
| Banco | `clusterqa.5ecbbya.mongodb.net/forte_solar_staging` |
| `APP_URL` · `CORS_ORIGENS` | `https://projeto-frts-qa.vercel.app` |

`.env.staging` foi preenchido apenas em memória de build e **restaurado aos
placeholders** — nenhum segredo versionado. A chave do Google Maps ficou como
`DESABILITADO_EM_QA` (o console do QA registra `InvalidKey`, esperado).

### Isolamento provado

- `/api/projetos-fv` pelo frontend publicado devolve **exatamente os 10 projetos
  da matriz** — o banco alcançado é o de QA, não o de produção.
- CORS: origem QA aceita; `projeto-frts-app.vercel.app`, `fortesolar.com.br`,
  `localhost:5173` e a origem forjada por substring (`…vercel.app.evil.com`)
  **todas recusadas** — sem cabeçalho `Access-Control-Allow-Origin`.
- Sem token / token inválido / token assinado com segredo errado → `401
  NAO_AUTENTICADO`. Token sem organização → `403 TENANT_AUSENTE` (M-4 fecha).
- Nenhuma requisição do frontend publicado sai da origem `projeto-frts-qa`.

### Matriz reexecutada no frontend PUBLICADO

Os 10 cenários abrem, recalculam (`POST /unifilar/gerar`, `POST
/financeiro/calcular`) e renderizam **valores idênticos ao baseline**;
`3933`, `817.3` e `817,3` ausentes em todos. `TOPOLOGIA_AUSENTE` (T07, T09) e
`MULTIPLOS_INVERSORES` (T09b) continuam recusando.

Caminho de **escrita** exercido do zero pelo frontend publicado — `TWEB Ciclo
completo publicado`: cadastro → 51 equipamentos do catálogo → estrutura →
dimensionamento (6,02 kWp) → topologia 2 MPPT × 5 → unifilar 6,5 kWp · 2 str ·
2 MPPT · Voc 255,4 V — igual ao T01. Reload em rota profunda preserva tudo
(SPA fallback + persistência).

Ciclo comercial: cotação → orçamento `ORC-QA-001` R$ 32.500,00 → emitido →
aprovado e congelado → **Baseline íntegra** (`eea3bf10…`) → Gate libera
Engenharia e Homologação → Opção 02 criada vazia (nada técnico copiado) →
**PDF da proposta gerado** (28 007 B, `%PDF-1.3`, `contrato_versao 1.0.0`,
lacunas `tarifa_kwh` e `inflacao_energia_aa_pct` declaradas, não fabricadas).

### Aceite e ART — destravados e validados

Autorizado explicitamente pelo usuário, restrito ao ambiente QA, sem SMTP e sem
tocar produção.

O primeiro `Enviar ao cliente` foi **recusado pelo domínio** com
`SEM_ORCAMENTO_APROVADO` — a Opção 02 nascera vazia (P2 #7, já catalogado).
Completada a Opção 02 pela UX publicada (fatura → 12 módulos + Fronius Primo
5.0-1 → estrutura → dimensionamento 6,02 kWp → cotação → `ORC-QA-002`
R$ 38.900,00 → emitido → aprovado, Baseline própria), o envio passou.

| Passo | Evidência |
|---|---|
| Envio | link público `https://projeto-frts-qa.vercel.app/proposta/04cfedmtggc6bgb504d09f` — **origem de QA**, não `:5173`: o P3 #14 se resolve com `APP_URL` correto |
| E-mail | nenhum despachado — sem `SMTP_*` no serviço, o envio é só o link |
| Página pública | 2 opções comparáveis, R$ 32.500,00 × R$ 38.900,00, documento de referência `de8bd6d1c830` |
| Aceite | Opção 01 escolhida em 30/08/2026 20:40:43; Opção 02 permanece íntegra e não escolhida |
| Gate | `PROPOSTA_SEM_ACEITE` → **Engenharia e Homologação liberadas** |
| Baseline | hash `eea3bf10…` **inalterado** após o aceite — M-2 confirmada |
| ART | marcada na lista obrigatória → `Documentos 1/7` |
| Protocolo | `PROT-QA-2026-0001` registrado, persistido e reexibido após reload |

Nenhum BLOCKED funcional restante nesta sprint.

### Defeitos encontrados (pré-existentes, NÃO corrigidos nesta sprint)

| # | Defeito | Grav. | Evidência |
|---|---|---|---|
| A | `/api/auth/login` montado (`auth-security.js`) **não consulta o MongoDB** — a busca está comentada como TODO. Só aceita dois pares embutidos no fonte. O usuário real do banco é recusado. | **P0** | login com `qa@fortesolar.com.br` → `INVALID_CREDENTIALS` |
| B | O token emitido por esse login traz `empresa_id: null` → **nenhum dado de negócio é acessível** por quem entra pela UI. | **P0** | `403 TENANT_AUSENTE` em `/api/projetos-fv` |
| C | `Login.jsx` grava `localStorage.token = dados.token`, mas a resposta traz `accessToken` → o token salvo é `undefined`. | **P1** | contrato do endpoint vs. `Login.jsx:39` |
| D | O verificador do bundle lista `https://fortesolar.com.br` mas não `https://www.fortesolar.com.br`, que passa. São links de marketing, não chamadas de API. | **P3** | 4 ocorrências no bundle publicado |
| E | **P2 — micro monofásico em rede trifásica não gera aviso.** Lacuna futura: não pertence ao baseline atual. | **P2** | T06 |

Por causa de A+B+C, **autenticação pela UI publicada = FAIL** — defeito
pré-existente, fora do escopo desta sprint e NÃO corrigido aqui. A validação
seguiu com a sessão de QA injetada em `localStorage` — o mesmo estado que um
login correto produziria. Isso está declarado, não mascarado.

---

## §12 — Sincronização de autenticação com a `main`

A auditoria de divergência mostrou que a FV estava atrás de `origin/main` em
autenticação. Fork limpo a partir de `a4aa720`: `main` tinha 2 commits, a FV
tinha 8, e nenhum lado reescreveu história.

- `6e7ed22` (EmpresaContext depende do token) — **já presente byte a byte** na
  FV, trazido pelo `2ee463d` (FV-DOM-025). Nada a fazer.
- `5863bca` (login real com tenant) — **ausente**. Incorporado por cherry-pick
  cirúrgico, não por merge da `main`.

O cherry-pick não teve conflito e o diff produzido é **idêntico** ao original:
`auth-security.js`, `Login.jsx` e `tests/auth/test_login_real.mjs`. Nenhum
arquivo de domínio, engine, unifilar ou UX FV foi tocado. Zero dependências
novas — `bcryptjs` e `jsonwebtoken` já estavam no `package.json`.

### Os defeitos A, B e C — fechados e medidos no QA real

Backend e frontend de QA republicados com o código novo. Provas contra
`backend-qa-staging` + Atlas `forte_solar_staging`, sem nenhuma injeção de
sessão:

| Defeito | Antes | Depois |
|---|---|---|
| **A** — login não consultava o MongoDB | `qa@fortesolar.com.br` → `INVALID_CREDENTIALS` | login real → `success: true`, usuário vindo da coleção |
| **B** — token sem tenant | `empresa_id: null` → `403 TENANT_AUSENTE` | claim `empresa_id: 000…009`; `/api/projetos-fv` → **200 com 12 projetos** |
| **C** — token salvo como `undefined` | `localStorage.token = "undefined"` → `Bearer undefined` | grava `accessToken` + `refreshToken`; chave legada `token` **ausente**; redireciona para `/dashboard` |

Garantias adicionais do commit, verificadas no ar:

- credenciais demo (`demo@` e `admin@fortesolar.com.br`) **recusadas**;
- senha errada e usuário inexistente devolvem resposta **idêntica** — sem
  enumeração;
- falha de login exibe mensagem na tela e **não grava nada** no `localStorage`;
- o box que divulgava a credencial demo saiu da tela.

### Fluxo FV revalidado com sessão real

Com o login de verdade (sem token injetado), o fluxo validado continua
idêntico: T01 desenha 6,5 kWp · 2 str · 2 MPPT · Voc 255,4 V; T09 recusa por
`TOPOLOGIA_AUSENTE`; T09b recusa por `MULTIPLOS_INVERSORES`; `3933` e `817,3`
seguem ausentes.

### Suítes

`tests/auth/test_login_real.mjs` **12/12** (requer
`node --experimental-test-module-mocks` — `mock.module` ainda é experimental no
Node 24; sem a flag o arquivo aborta com `mock.module is not a function`).
Domínio 30/30 · infra 63/63 · frontend 1234/1259, as mesmas 25 falhas
pré-existentes em `components/diagram/*`, `alertCenter88` e
`catalogoEngenharia`.

**Débitos remanescentes:** D (o verificador de bundle não cobre
`https://www.fortesolar.com.br`) e E (micro 1Ø em rede 3Ø sem aviso). Nenhum
dos dois é tocado pela `main`.
