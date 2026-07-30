# GÊMEO DIGITAL — RELATÓRIO FORENSE DE PRONTIDÃO O&M

**Sprint:** P4-GEMEO-DIGITAL-OM-FORENSICS-01
**Data:** 2026-06-19
**Tipo:** Auditoria READ-ONLY (nenhum código modificado, nenhuma migração criada)
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

---

## NOTA DE HONESTIDADE METODOLÓGICA

Este relatório foi produzido **exclusivamente por leitura estática de código-fonte**.
Restrições assumidas e respeitadas:

- **Nenhuma funcionalidade foi executada ou testada.** Afirmações sobre "funciona"
  referem-se à existência de código que aparenta implementar o comportamento, não a
  comportamento observado em runtime.
- **Nenhum acesso ao MongoDB Atlas.** Não há contagens reais de documentos, volumes
  ou estado de dados de produção. Estimativas de volume são deduzidas do modelo de dados.
- **Nenhum arquivo de código foi modificado** e **nenhuma migração foi criada.**
- Onde um arquivo esperado não foi encontrado, isso é declarado explicitamente.

### Arquivos lidos (evidência primária)

| # | Arquivo | Status |
|---|---------|--------|
| 1 | `backend/src/models/AtivoEquipamento.js` | LIDO |
| 2 | `backend/src/models/ProjetoFV.js` | LIDO |
| 3 | `backend/src/models/Equipamento.js` | LIDO |
| 4 | `backend/src/models/AlertaStatus.js` | LIDO |
| 5 | `backend/src/services/ativoService.js` | LIDO |
| 6 | `backend/src/controllers/ativosController.js` | LIDO |
| 7 | `backend/src/routes/ativos.js` | LIDO |
| 8 | `frontend/src/pages/AtivoQR.jsx` | LIDO |
| 9 | `frontend/src/pages/Unifilar.jsx` | LIDO |
| 10 | `frontend/src/utils/engenhariaGovernanca.js` | LIDO |
| — | `backend/src/utils/alertcenter/alertDetectors.js` | LIDO (parcial, busca) |

### Arquivos esperados pelo briefing e NÃO encontrados

- **Não existe** controller dedicado a comissionamento separado: a lógica de
  comissionamento vive em `ativosController.js` (`comissionarPorQr`). Não há
  `comissionamentoController.js` nem `comissionamentoService.js`.
- **Não existe** `VisitaTecnica`, `Chamado`, `OrdemServico` ou `ticket` como entidade.
  A busca por esses termos só retornou falsos positivos (parsers de OCR, mensagens de
  erro). Confirma-se: **não há modelo de visita técnica nem de chamado.**
- **Não existe** service de substituição. Os campos da cadeia de substituição existem
  no schema, mas não há lógica de negócio que os manipule (detalhado na Fase 5).

---

## FASE 1 — INVENTÁRIO

### 1.1 Entidade central: `AtivoEquipamento` (o Gêmeo Digital)

Coleção própria `ativos_equipamento` (`timestamps: true`). Representa o **as-built**
(o que foi efetivamente instalado), distinto do catálogo `Equipamento` (as-specified)
e do `ProjetoFV` (as-designed). Arquivo: `backend/src/models/AtivoEquipamento.js`.

#### Campos de vínculo
| Campo | Tipo | Uso atual |
|-------|------|-----------|
| `projeto_id` | ObjectId ref ProjetoFV, required, index | Preenchido na geração |
| `arranjo_id` | String (= ProjetoFV.arranjos[].id), index | Preenchido na geração |
| `equipamento_id` | ObjectId ref Equipamento, default null | Link opcional ao catálogo |
| `cliente_id` | ObjectId ref Cliente, default null, index | Preenchido na geração |

#### Identidade física (as-built)
| Campo | Tipo | Uso atual |
|-------|------|-----------|
| `tipo` | enum [modulo, inversor, microinversor, otimizador, bess, carregador], required, index | Definido na geração |
| `fabricante`, `modelo` | String | Herdados do projeto |
| `numero_serie` | String | Preenchido no comissionamento de campo |
| `qr_code` | String, único, imutável | `FORTE-<TIPO3>-<SEQ6>` gerado atomicamente |
| `quantidade` | Number default 1 | Módulos agregados por arranjo (N); 1 p/ inversor/bess |

#### Ciclo de vida
| Campo | Tipo | Uso atual |
|-------|------|-----------|
| `status` | enum [planejado, instalado, operacional, manutencao, substituido, desativado], index | Máquina de estados (Fase 2) |
| `data_instalacao` | Date | Manual |
| `data_comissionamento` | Date | Setado no `comissionarPorQr` |
| `comissionado_por` | String | Setado no comissionamento |

#### Garantia
| Campo | Tipo | Uso atual |
|-------|------|-----------|
| `garantia_inicio` | Date default null | **Apenas declarado.** Editável via PUT; sem preenchimento automático |
| `garantia_fim` | Date default null | **Apenas declarado.** Sem cálculo, sem alerta |

#### Conectividade (as-built de rede)
Subdoc `conectividade`: `mac_wifi`, `wifi_ssid`, `senha_wifi` (sensível, criptografada),
`firmware`, `endereco_ip`. Preenchido no comissionamento. `senha_wifi` nunca é exposta
em leitura (só flag `senha_definida`).

#### Monitoramento (telemetria — registro de credenciais)
Subdoc `monitoramento` (P1-ASSET-MONITORING-REGISTRY-01): `portal`, `plant_id`,
`gateway_sn`, `logger_id`, `usuario` (criptografado), `senha` (criptografada), `url`,
`atualizado_em`, `atualizado_por`. **É um REPOSITÓRIO de credenciais, não um pipeline
de telemetria** — detalhado na Fase 7.

#### Substituição (cadeia de troca)
| Campo | Tipo | Uso atual |
|-------|------|-----------|
| `substitui_ativo_id` | ObjectId ref AtivoEquipamento, default null | **Declarado, sem lógica de wiring** |
| `substituido_por_ativo_id` | ObjectId ref AtivoEquipamento, default null | **Declarado, sem lógica de wiring** |

#### Físico/contexto e idempotência
`topologia`, `localizacao`, `observacoes`, `chave_origem` (determinística, índice único
parcial — idempotência de geração).

#### Histórico embutido (`historico[]` — HistoricoSchema)
Subdocumento com `tipo` (enum de **10 tipos**: `criacao`, `instalacao`, `troca`,
`garantia`, `manutencao`, `comissionamento`, `monitoramento`, `falha`, `inspecao`,
`mudanca_status`), `data`, `usuario`, `descricao`, `status_de`, `status_para`, e
`alteracoes[]` (diffs campo-a-campo: `{campo, de, para}`).

#### Documentos (RESERVADO)
`documentos: [Mixed]` — declarado mas **explicitamente não implementado** ("RESERVADO —
não implementado nesta sprint").

#### Índices
- `qr_code` único (partial, tipo string)
- `chave_origem` único (partial — idempotência)
- `{projeto_id, arranjo_id}` composto

### 1.2 Entidade de catálogo: `Equipamento` (as-specified)

Arquivo `backend/src/models/Equipamento.js`. Relevante para O&M:
- `garantia_produto: {value, unit[anos|meses]}` e `garantia_performance: {value, unit}`
  — **a fonte natural para derivar `garantia_fim` do ativo**, mas hoje não há ligação
  automática entre catálogo e ativo para isso.
- `documentos_tecnicos[]` (datasheet, manual, INMETRO, IEC, declaração, **garantia**) e
  `certificacao` (INMETRO/IEC com `validade`) — documentação de produto existe no
  catálogo, não no ativo.
- `aprovacao_tecnica` (workflow rascunho→pendente→aprovado→bloqueado) — governança de
  catálogo, não de O&M de campo.

### 1.3 `ProjetoFV` — campos relevantes a O&M
- `tipo_projeto` [novo|ampliacao] + `projeto_origem_id` — **suporte de schema a
  Ampliação de Usina** (Fase 6).
- `arranjos[]` com `somente_leitura` (congela arranjo executado), `tipo`
  [principal|existente|ampliacao|secundario], `origem` [original|ampliacao].
- `governanca` (snapshots congelados de 8 tipos), `homologacao` (status + checklist +
  histórico_status + protocolo).

### 1.4 `AlertaStatus` — engine de alertas existente
Modelo mínimo que guarda só o **estado de resolução** de alertas derivados. Origens
suportadas: `rt|catalogo|documento|projeto|fatura`. **Não inclui `ativo` nem garantia
vencida.** Os detectores (`alertDetectors.js`) não referenciam `AtivoEquipamento` nem
`garantia_fim`. Ou seja: a infraestrutura de alertas existe, mas **não cobre O&M de ativos.**

---

## FASE 2 — CICLO DE VIDA

Máquina de estados real (de `ativosController.js`, const `TRANSICOES`):
```
planejado   → instalado, desativado
instalado   → operacional, desativado
operacional → manutencao, substituido, desativado
manutencao  → operacional, substituido
substituido → (terminal)
desativado  → (terminal)
```

| Estágio | Classificação | Evidência |
|---------|---------------|-----------|
| **Projeto** | IMPLEMENTADO | `status: planejado`; ativo gerado de ProjetoFV via `gerarAtivosProjeto` |
| **Instalação** | PARCIAL | `data_instalacao` existe e é editável; transição `planejado→instalado` ocorre automaticamente no 1º comissionamento, mas não há fluxo de instalação dedicado |
| **Comissionamento** | IMPLEMENTADO | `comissionarPorQr` grava serial/MAC/SSID/firmware/IP, registra diffs no histórico, avança status |
| **Homologação** | PARCIAL | Existe robusta em `ProjetoFV.homologacao` (status, checklist, protocolo), mas **não há tipo `homologacao` no histórico do ATIVO** — vive no projeto, desconectado do gêmeo digital |
| **Operação** | PARCIAL | Status `operacional` existe; transição `instalado→operacional` é manual (PUT). Não há gatilho automático |
| **Falha** | PARCIAL | Tipo `falha` existe no enum do histórico, mas **não há endpoint para registrar falha** — só seria gravável via PUT genérico manipulando histórico, o que o controller não expõe |
| **Manutenção** | PARCIAL | Status `manutencao` + tipo `manutencao` existem; transições válidas existem; **não há endpoint dedicado de registro de manutenção** |
| **Substituição** | PARCIAL | Status `substituido` + campos de cadeia existem; **sem lógica que crie o novo ativo e ligue a cadeia** (Fase 5) |
| **Ampliação** | PARCIAL | Suportada em `ProjetoFV` (tipo_projeto/projeto_origem_id/arranjos), mas no nível do **ativo** uma ampliação só geraria novos ativos sem vínculo de "expansão" explícito (Fase 6) |
| **Desativação** | PARCIAL | Status `desativado` (terminal) existe; transição válida de quase todos os estados; sem endpoint dedicado/motivo estruturado |

**Conclusão Fase 2:** o **esqueleto de ciclo de vida está IMPLEMENTADO** (estados +
transições validadas + histórico). O que falta são os **endpoints de operação** para
registrar falha/manutenção/substituição de forma estruturada. Hoje só comissionamento e
mudança genérica de status (PUT) gravam eventos.

---

## FASE 3 — GARANTIAS

| Pergunta | módulo | inversor | carregador EV | ativo (AtivoEquipamento) |
|----------|--------|----------|---------------|--------------------------|
| (1) Existe garantia? | SIM (catálogo: `garantia_produto`+`garantia_performance`) | SIM (catálogo) | SIM (catálogo, tipo `carregador_ev`) | PARCIAL — só `garantia_inicio`/`garantia_fim` |
| (2) Automática ou manual? | — (campo de catálogo) | — | — | **MANUAL** — sem derivação do catálogo |
| (3) Tem expiração? | SIM (value+unit, mas não datada por instalação) | SIM | SIM | `garantia_fim` existe mas **não é calculado** |
| (4) Tem alerta? | NÃO | NÃO | NÃO | **NÃO** — AlertCenter não cobre garantia de ativo |
| (5) Tem histórico? | parcial (validacao.historico do catálogo) | parcial | parcial | tipo `garantia` existe no enum mas **sem endpoint que o grave** |

**Evidência-chave:** em `AtivoEquipamento.js` linhas 60-62, `garantia_inicio` e
`garantia_fim` são `Date default null`. Em `ativosController.js`, `atualizarAtivo` lista
ambos em `CAMPOS` (linha ~322) — ou seja, são **editáveis manualmente via PUT**, mas
nenhum código:
1. deriva `garantia_fim` de `garantia_inicio + Equipamento.garantia_produto`;
2. gera alerta de garantia próxima do vencimento;
3. registra evento `garantia` no histórico automaticamente.

**Maturidade de Garantias: 25%.** Campos existem (persistência), mas é puramente manual,
sem cálculo, sem alerta, sem trilha automática, e desconectado das garantias do catálogo.

---

## FASE 4 — VISITA TÉCNICA

**Não existe entidade `VisitaTecnica`.** Avaliação de reaproveitamento da infra existente:

| Necessidade | Pode ser suportada hoje? | Como (reaproveitamento) |
|-------------|--------------------------|--------------------------|
| Manutenção preventiva | PARCIAL | tipo `manutencao`/`inspecao` no `historico[]`; status `manutencao` |
| Manutenção corretiva | PARCIAL | tipo `falha`+`manutencao`; transição `operacional→manutencao→operacional` |
| Inspeção | PARCIAL | tipo `inspecao` no enum (mas sem endpoint) |
| Ampliação | PARCIAL | via ProjetoFV (Fase 6), não via ativo |

**Campos/tipos reaproveitáveis para visita técnica:**
- `historico[]` com `tipo`, `data`, `usuario`, `descricao`, `alteracoes[]` — pode
  hospedar eventos pontuais de visita.
- `status` `manutencao` — sinaliza ativo em intervenção.
- `localizacao` — onde está fisicamente o ativo.

**Limitação central:** o `historico[]` é **embutido no ativo** e é granular por ativo.
Uma visita técnica real é um **evento agregador** que toca múltiplos ativos, tem
agendamento, responsável, custo, fotos, checklist e resultado. Nada disso é
representável hoje sem uma entidade própria. O histórico embutido serve para **registrar
o efeito** de uma visita em cada ativo, mas não para **planejar/gerenciar** a visita.

**Maturidade de Visitas Técnicas: 25%** (só o substrato de evento por ativo existe).

---

## FASE 5 — SUBSTITUIÇÃO

### (1) Como funciona hoje
Os campos `substitui_ativo_id` e `substituido_por_ativo_id` (ObjectId auto-referentes)
existem no schema (linhas 87-89) e estão listados em `CAMPOS` editáveis no
`atualizarAtivo`. **Não há endpoint dedicado de substituição** nem lógica que:
- crie o ativo substituto;
- preencha a cadeia bidirecional dos dois lados atomicamente;
- transicione o ativo antigo para `substituido` e o novo para `instalado`;
- copie contexto (projeto/arranjo/localização) do antigo para o novo;
- registre o evento `troca` no histórico de ambos.

Hoje, para fazer uma substituição completa, um cliente da API teria que: criar manualmente
o ativo novo (`POST /api/ativos`), e fazer dois PUTs manuais para ligar a cadeia nos dois
sentidos e mudar status. **Não é uma operação atômica de domínio.**

### (2) Histórico preservado?
PARCIAL. A mudança de status para `substituido` gera evento `mudanca_status`. Mas não há
evento `troca` automático nem captura do "motivo da substituição", do serial defeituoso,
ou do número do RMA/garantia.

### (3) Rastreabilidade?
PARCIAL (estrutural). A cadeia bidirecional permite, **se preenchida corretamente**,
navegar antigo↔novo. Como o preenchimento é manual e não-atômico, há risco real de cadeia
quebrada (um lado preenchido, o outro não).

### (4) Útil para garantia (warranty claim)?
NÃO de forma confiável. Para um pleito de garantia seriam necessários: serial do
componente que falhou, data da falha, data da troca, e vínculo ao número de garantia —
nada disso é capturado de forma estruturada hoje. A cadeia diz "A virou B", mas não
"por quê", "quando" nem "sob qual garantia".

**Maturidade de Substituições: 25%.** Schema pronto; domínio ausente.

---

## FASE 6 — EXPANSÕES

| Cenário | Suportado? | Evidência / Limitação |
|---------|-----------|------------------------|
| Expansão de módulos | PARCIAL | `ProjetoFV.tipo_projeto='ampliacao'` + `arranjos[]` novo arranjo + `somente_leitura` no existente; gerar ativos do novo arranjo cria novos `AtivoEquipamento`. **Mas** não há flag de "expansão" no ativo nem vínculo ao ativo/arranjo original |
| Segundo inversor | PARCIAL | Multi-inversor por arranjo suportado no schema (`arranjos[].inversores[]`); geração cria 1 ativo por unidade. Sem marca de "adicionado em expansão" |
| Troca de inversor | PARCIAL/AUSENTE | É um caso de Substituição (Fase 5) — mesma lacuna |
| Retrofit | AUSENTE | Sem conceito de retrofit; cairia em substituição manual |

**Preservação de histórico:** uma ampliação via ProjetoFV **congela** o arranjo executado
(`somente_leitura`) e abre um novo — bom para o as-designed. Mas no nível do **gêmeo
digital**, a geração idempotente (`chave_origem`) garante que não se duplicam ativos, e
os ativos antigos permanecem. **O histórico dos ativos antigos é preservado** porque não
são tocados. A limitação é a **ausência de vínculo explícito de expansão** entre a leva
nova e a antiga de ativos (não há `expansao_origem_id` no ativo).

**Maturidade de Expansões: 25%** (suporte no projeto; nada no ativo).

---

## FASE 7 — TELEMETRIA

### (1) O que existe
Subdoc `monitoramento` no ativo (P1-ASSET-MONITORING-REGISTRY-01):
`portal`, `plant_id`, `gateway_sn`, `logger_id`, `usuario` (cripto), `senha` (cripto),
`url`, `atualizado_em`, `atualizado_por`. Endpoints `POST/GET /api/ativos/:id/monitoramento`.
Segredos cifrados em AES-256-GCM e nunca expostos (só flags `*_definido`). UI: card
"Monitoramento" em `AtivoQR.jsx`.

### (2) O que falta
Isto é um **registro de credenciais/identificadores de portal**, NÃO telemetria. Faltam:
- ingestão de dados (geração kWh, potência instantânea, status de comunicação);
- séries temporais / leituras;
- integração com APIs dos portais (Solarman, SolisCloud, etc.);
- detecção de inversor offline / underperformance;
- alarmes de telemetria.

### (3) MVP mínimo viável (apenas mapeamento, sem desenho de implementação)
Um MVP de telemetria precisaria, no mínimo: (a) um coletor que use as credenciais já
armazenadas em `monitoramento` para puxar leitura diária; (b) uma coleção de leituras
(série temporal) referenciando `ativo_id`/`projeto_id`; (c) um detector de "sem
comunicação há N dias" plugado no AlertCenter existente. Os **identificadores necessários
já estão modelados** (`plant_id`, `logger_id`, `gateway_sn`), o que reduz o atrito.

**Maturidade de Telemetria: 25%** (cadastro de acesso pronto; ingestão zero).
**Maturidade de Monitoramento (registro): 50%** (cadastro funcional, criptografado, com UI).

---

## FASE 8 — MATRIZ DE MATURIDADE O&M

Escala: 0 / 25 / 50 / 75 / 100.

| Dimensão | % | Justificativa curta |
|----------|---|---------------------|
| Garantias | 25 | Campos existem; manual; sem cálculo/alerta/derivação do catálogo |
| Visitas Técnicas | 25 | Sem entidade; só substrato de evento por ativo no histórico |
| Substituições | 25 | Cadeia no schema; sem domínio/atomicidade/endpoint |
| Expansões | 25 | Suporte no ProjetoFV; sem vínculo de expansão no ativo |
| Monitoramento | 50 | Registro de credenciais funcional, cifrado, com UI |
| Telemetria | 25 | Só identificadores; nenhuma ingestão de dados |
| Chamados | 0 | Entidade inexistente |
| Histórico | 75 | Robusto: 10 tipos, diffs campo-a-campo, embutido, em uso |
| Documentação | 25 | `documentos[]` do ativo RESERVADO; docs vivem no catálogo |

**Maturidade O&M global (média ponderada simples): ~30%.**
Cálculo: (25+25+25+25+50+25+0+75+25)/9 = 27.8 ≈ **30%** (arredondado para a banda mais
próxima de 25–30%). O Histórico puxa para cima; Chamados puxa para baixo.

---

## FASE 9 — ARQUITETURA FUTURA (proposta, sem implementação)

### VisitaTecnica — coleção própria? subdoc? evento no histórico[]?
**Recomendação: COLEÇÃO PRÓPRIA** (`visitas_tecnicas`), com **espelhamento de eventos no
`historico[]` dos ativos tocados.**

Justificativa por padrão de acesso e volume:
- Uma visita é um **agregador transversal**: 1 visita → N ativos. Subdoc de um único ativo
  não modela isso. Evento solto no histórico de cada ativo perde a noção de "uma visita".
- Volume cresce no tempo independentemente do ativo (uma usina recebe muitas visitas ao
  longo de 25 anos). Embutir infla o documento do ativo (anti-padrão MongoDB de array
  ilimitado).
- Consultas naturais ("todas as visitas do mês", "visitas pendentes do técnico X",
  "última visita da usina Y") são consultas **sobre visitas**, não sobre ativos —
  exigem coleção indexável própria.
- O `historico[]` do ativo continua sendo o lugar certo para registrar **o efeito** da
  visita em cada ativo (ex.: "inspecionado na visita VT-000123"), via referência leve.

### Chamado/ticket — entidade própria? evento no histórico?
**Recomendação: ENTIDADE PRÓPRIA** (`chamados`). Tem ciclo de vida próprio (aberto →
triagem → em atendimento → resolvido → fechado), SLA, prioridade, solicitante, e
relaciona-se a 1 projeto e 0..N ativos. Um chamado frequentemente **gera** uma visita
técnica e/ou uma substituição. Modelar como evento de histórico impediria filas, SLA e
relatórios. O histórico do ativo referencia o chamado (`tipo: falha`, descrição com
`chamado_id`).

---

## FASE 10 — ROADMAP (candidatos a próximas sprints)

| Sprint candidata | Escopo | Esforço |
|------------------|--------|---------|
| **P5-GARANTIA** | Derivar `garantia_fim` de `garantia_inicio + Equipamento.garantia_produto`; detector de garantia vencendo no AlertCenter; evento `garantia` no histórico | **S** |
| **P5-SUBSTITUICAO** | Endpoint atômico de substituição: cria substituto, liga cadeia bidirecional, transiciona status, registra `troca` em ambos, captura motivo/serial | **M** |
| **P5-OM** (VisitaTecnica + Chamado) | Coleção `visitas_tecnicas` + `chamados` com ciclo de vida, vínculo a projeto/ativos, espelhamento no histórico | **L** |
| **P5-TELEMETRIA** | Coletor usando credenciais de `monitoramento`; coleção de leituras; detector offline/underperformance | **XL** |

**Sequência recomendada:** P5-GARANTIA (rápido, alto valor de retenção/compliance) →
P5-SUBSTITUICAO (fecha o ciclo de troca, base para garantia/RMA) → P5-OM (visitas e
chamados, o coração do O&M) → P5-TELEMETRIA (maior esforço, depende de integrações
externas).

---

## RESPOSTAS OBRIGATÓRIAS (consolidado)

1. **Quanto de O&M já existe?** **~30%.** O substrato do gêmeo digital é sólido
   (entidade as-built dedicada, QR imutável, máquina de estados, histórico rico de 10
   tipos com diffs, comissionamento funcional, registro de monitoramento cifrado). O que
   existe é o **registro de ativos**, não a **operação** deles.

2. **O que falta?** Entidades de Visita Técnica e Chamado (inexistentes); domínio de
   garantia (cálculo + alerta); domínio de substituição (atomicidade); ingestão de
   telemetria; vínculo de expansão no ativo; documentação por ativo (campo reservado).

3. **Garantias suportadas?** Apenas persistência manual de `garantia_inicio/garantia_fim`
   no ativo + campos de garantia no catálogo. Sem cálculo, sem alerta, sem ligação. **25%.**

4. **Substituições suportadas?** Só estruturalmente (campos de cadeia no schema). Sem
   endpoint, sem atomicidade, sem captura de motivo/serial. **25%.**

5. **Expansões suportadas?** No `ProjetoFV` (tipo_projeto/arranjos/somente_leitura), sim
   parcialmente; no nível do **ativo** não há marca de expansão. **25%.**

6. **Nova arquitetura é necessária? SIM.** Visita Técnica e Chamado **exigem coleções
   próprias** — são agregadores transversais com ciclo de vida, volume temporal e padrões
   de consulta incompatíveis com subdoc/evento embutido. Garantia e Substituição **não
   exigem** nova entidade (reaproveitam o ativo + histórico), exigem apenas lógica de
   domínio.

7. **Entidade recomendada para visitas técnicas:** coleção própria `VisitaTecnica`
   (esboço de modelo em `GEMEO_DIGITAL_OM_ARCHITECTURE.md`), com espelhamento de eventos
   no `historico[]` de cada ativo tocado.

8. **Próxima sprint recomendada: P5-GARANTIA (S)** como quick-win de maior ROI, seguida de
   P5-SUBSTITUICAO (M). Justificativa: ambas reusam a arquitetura existente (zero entidades
   novas), entregam valor de compliance/retenção imediato, e pavimentam P5-OM.
