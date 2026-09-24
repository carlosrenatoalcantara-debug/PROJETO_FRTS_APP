# P0.2-A — Revisão de Engenharia do Contrato Canônico de Inversores

**Data:** 2026-09-12 · **Escopo:** especificação para revisão. **Nenhum código, schema, banco, UI, default ou cálculo foi alterado.**
**Base:** Atlas produção — 52 inversores. **Não reabre P0.1 nem P0.2.**

---

## SUMÁRIO DAS DECISÕES

| # | Questão | Decisão |
|---|---|---|
| 1 | `specs_canonicas` vira o contrato persistido? | **NÃO.** É projeção lossy (18 de 34 campos) e há **3 checks que proíbem lê-la**. Medida: perde 11 valores reais por coerção numérica. |
| 2 | Qual é o SSOT? | **`CAMPOS_INVERSOR`** (`dicionarioInversor.js`), estendido com metadados. Um só. |
| 3 | `subtipo` entra no contrato? | **NÃO.** Derivável integralmente. Sem valor de cache. Remover do vocabulário persistido. |
| 4 | `entradas` / `modulos_por_entrada` / `oversizing_max` | **Opção D** — subcontrato de topologia `MICRO`, com produtor a criar. |
| 5 | Os 14 campos "de apresentação" | **Pertencem ao contrato**, marcados `natureza: apresentacao`. Persistidos. Não removidos. |
| 6 | Os 4 defaults elétricos | 2 removíveis após cadastro (D1, D2), 1 é bug de precedência (D10), 1 é **decisão de engenharia** (D9). Nenhum alterado. |
| 7 | Estrutura em 10 grupos do §9 | **Adotar como taxonomia de metadado (`grupo:`), NÃO como aninhamento de schema.** |

---

## 1. `specs_canonicas` — PARECER (item §6, o mais crítico)

### 1.1 Estrutura atual medida

```
18 chaves declaradas · 14 já apareceram com valor · 4 sempre null
```

| Chave | Cobertura | Campo SSOT correspondente |
|---|---:|---|
| `_versao` | 52/52 | — (metadado) |
| `protecoes_integradas` | 52/52 | — (objeto, 4 booleanos) |
| `potencia_kw_ca` | 47/52 | `potencia_kw` |
| `voc_max_dc_v` | 44/52 | `tensao_max_entrada` |
| `n_mppts` | 43/52 | `n_mppts` |
| `fases_saida` | 40/52 | `fases` |
| `mppt_min_v` / `mppt_max_v` | 37/52 | `tensao_mppt_min` / `_max` |
| `eficiencia_max_pct` | 33/52 | `eficiencia_maxima` |
| `tensao_inicializacao_dc_v` | 29/52 | `tensao_partida` |
| `isc_max_por_mppt_a` | 27/52 | `corrente_isc_max` |
| `eficiencia_european_pct` | 24/52 | `eficiencia_europeia` |
| `strings_max_por_mppt` | **19/52** | `strings_por_mppt` (**30/52** na origem) |
| `tensao_saida_v` | 12/52 | `tensao_ac` |
| `potencia_kw_cc_max`, `frequencia_hz`, `tipo_inversor`, `certificacoes` | **0/52** | — |

### 1.2 Três provas contra adotá-la

**Prova 1 — é LOSSY por omissão.** 16 dos 34 campos do SSOT não existem na projeção, inclusive campos com alta cobertura e consumo direto pelo motor:

```
ausentes da projeção:  corrente_max_por_mppt (51/52 na origem!)  corrente_ac_saida (49/52)
                       potencia_maxima_kw (47/52)  entradas_por_mppt (30/52)  tipo_topologia (52/52)
                       corrente_max_entrada · entradas · modulos_por_entrada · oversizing_max
                       max_por_cabo_tronco · potencia_aparente_kva · peso_kg · dimensoes
                       grau_protecao_ip · garantia_anos · temperatura_operacao · bateria (4)
```

**Prova 2 — é LOSSY por coerção, e isso está medido.** `normalizarSpecsInversor` aplica `num()` a todo campo. `num("2/1") === null`:

```
strings_por_mppt presente em especificacoes e NULL na projeção: 11 inversores
valores destruídos: "2/1" · "2/2" · "1/1" · "2/2/2"
```

Esses 11 são exatamente os inversores de **MPPTs desiguais** — a informação que o editor de topologia MPPT precisa. A projeção apaga o caso difícil e preserva o fácil.

**Prova 3 — a arquitetura já decidiu, e trancou com teste.** Três checks existentes impedem que engenharia leia a projeção:

- `fontesDerivadasF10.check.js:33` — varre **todo** `backend/src/dominio` e `services` e falha se **qualquer** módulo de engenharia mencionar `specs_canonicas`.
- `limiteCurtoF8.check.js:73` — "`specs_canonicas` segue reportado, nunca promovido a fonte".
- `cadastroMicroE3.check.js:130` — "o segundo repositório de spec é reportado, nunca lido".

Promover `specs_canonicas` a contrato **reprovaria os três** — que foram escritos precisamente para impedir esta mudança.

### 1.3 Parecer

| Pergunta | Resposta |
|---|---|
| Estrutura | 18 chaves planas + 1 objeto, dialeto próprio com sufixo de unidade |
| Relação com `CAMPOS_INVERSOR` | **projeção unidirecional** — SSOT → projeção, nunca o inverso |
| Contém todos os campos necessários? | **Não** — 16 ausentes, 4 sempre nulos |
| Possui aliases? | Não. Recebe o valor já resolvido pelo SSOT |
| Contém defaults? | **Não** — F10 §2 trava: nenhum `??` entre campos, nenhum literal numérico |
| É fonte ou derivação? | **Derivação**, recalculada a cada `save()` |
| Quem grava | `catalogoQualidade.processarEquipamento` (hook `pre('save')`), `adminCatalogo`, `bulkOperationsService`, `catalogoDatasheetEnriquecimento` |
| Quem lê | **Ninguém em engenharia.** Só `catalogoDatasheetEnriquecimento` (merge incremental) e UI de score |
| Precisa versionamento? | Já tem `_versao: '1.0'`, e é adequado para o papel que exerce |

> **DECISÃO: manter `specs_canonicas` como PROJEÇÃO DE RELATÓRIO. O contrato canônico é `CAMPOS_INVERSOR`.**
> Não há dois SSOT concorrentes: há um SSOT (`CAMPOS_INVERSOR`) e uma projeção somente-escrita para score e enriquecimento. A regra que já existe — *escrita e relatada, nunca lida* — é o que impede o segundo SSOT.
>
> **Pendência decorrente:** os 11 valores destruídos por coerção são um defeito da projeção (P2-b do P0.2), não motivo para promovê-la.

---

## 2. TABELA CAMPO A CAMPO

Colunas: **Tipo · Unid · Origem primária · Produtor atual · Persist. · Consumidores · Crítico · Edit. · Exib. · Deriv. · Obrig. · Validação · Default atual · Decisão**

Legenda produtor: `DS` = extrator de datasheet (3/52 registros) · `MAN` = formulário manual (49/52) · `DER` = derivação em código · `—` = nenhum.

### 2.A — DADOS ELÉTRICOS PRIMÁRIOS

| Campo | Tipo | Unid | Origem | Produtor | Persist. | Consumidores | Crít. | Edit | Exib | Deriv | Obrig. | Validação | Default | Decisão |
|---|---|---|---|---|---:|---|:--:|:--:|:--:|:--:|---|---|---|---|
| `potencia_kw` | number | kW | datasheet | DS+MAN | 47/52 | montarStrings, oversizing, score, DC/AC | **SIM** | ✔ | ✔ | ✘ | sempre | `>0 ≤600` | **`?? 0`** (D2) | **manter** — remover D2 no P1 |
| `potencia_maxima_kw` | number | kW | datasheet | DS | 47/52 | plausibilidade | não | ✔ | ✔ | ✘ | não | `≥ potencia_kw×0.98` | — | manter |
| `tensao_max_entrada` | number | V | datasheet | DS+MAN | 44/52 | montarStrings, classificarTensaoCC, gate | **SIM** | ✔ | ✔ | ✘ | topologia≠MICRO | `100..1500` | nenhum (FV-DOM-029) | manter · obrigatório condicional |
| `tensao_mppt_min` | number | V | datasheet | DS | 37/52 | montarStrings, classificarTensaoCC, gate | **SIM** | ✔ | ✔ | ✘ | topologia≠MICRO | `>0 < mppt_max` | nenhum | manter |
| `tensao_mppt_max` | number | V | datasheet | DS | 37/52 | montarStrings, classificarTensaoCC, gate | **SIM** | ✔ | ✔ | ✘ | topologia≠MICRO | `≤ tensao_max_entrada` | nenhum | manter |
| `corrente_isc_max` | number | A | datasheet | DS | 27/52 | montarStrings, classificarCorrenteCC | **SIM** | ✔ | ✔ | ✘ | topologia≠MICRO | `≥ corrente_max_por_mppt` | nenhum (F8) | manter · **campanha de cadastro** |
| `corrente_max_por_mppt` | number\|string | A | datasheet | DS+MAN | 51/52 | classificarCorrenteCC, gate | não | ✔ | ✔ | ✘ | recomendado | `>0` | nenhum | manter · **normalizar tipo** (1 doc é string) |
| `corrente_max_entrada` | number | A | datasheet | DS (prompt ✔) | **0/52** | CORRENTE_ENTRADA_TOTAL_EXCEDIDA | não | **✘→✔** | ✔ | **✘ nunca** | opcional | `> corrente_max_por_mppt` | nenhum (F10) | **editar** + preencher via datasheet |
| `n_mppts` | int | — | datasheet | DS+MAN | 43/52 | montarStrings, topologia MPPT, score | **SIM** | ✔ | ✔ | ✘ | topologia≠MICRO | `≥1` | nenhum | manter · obrigatório |
| `tensao_partida` | number | V | datasheet | DS | 29/52 | engineeringFallback (runtime) | não | **✘→✔** | ✔ | parcial | opcional | `≤ tensao_mppt_min` | **`mppt_min : 200`** (D6) | **editar**; D6 permanece (runtime, com proveniência) |
| `potencia_max_entrada_cc` | number | W/kWp | datasheet | DS | 0/52 | **nenhum** | não | ✘ | ✔ | ✘ | não | `> potencia_kw` | — | manter · sem consumidor hoje |
| `tensao_ac` | number\|string | V | datasheet | DS | 12/52 | `tensao_nominal_v`, plausibilidade | não | ✔ | ✔ | ✘ | recomendado | `>0` | — | manter · **normalizar tipo** (6 docs são string) |
| `corrente_ac_saida` | number | A | datasheet | DS | 49/52 | correnteDoRamal, cabo CA, plausibilidade | **SIM (micro)** | ✔ | ✔ | ✘ | topologia=MICRO | `≈ P/(V·k)` ±40% | — | manter |
| **`fases`** | int | — | datasheet | DS | **40/52** | montarStrings, avisoDeFase, polos NBR, `tensao_nominal_v`, score | **SIM** | **✘→✔** | ✔ | ✘ | sempre | `∈{1,2,3}` | **`?? 1`** (D1) | **editar** — é a maior lacuna de contrato |
| `frequencia_hz` | number | Hz | datasheet | DS | 0/52 | **nenhum** | não | ✘ | ✔ | ✘ | não | `∈{50,60}` | — | **apresentação** (§2.C) |
| `potencia_aparente_kva` | number | kVA | datasheet | DS | 0/52 | **nenhum** | não | ✘ | ✔ | **✔** | não | `≥ potencia_kw` | — | **derivar** — ver §2.A.1 |
| `eficiencia_maxima` | number | % | datasheet | DS | 33/52 | score, relatório | não | ✔ | ✔ | ✘ | recomendado | `90..100` | **`\|\| 97`** (D4) | manter · D4 é aproximação declarada |

#### 2.A.1 — `potencia_aparente_kva`: derivar ou armazenar?

```
fórmula:    S[kVA] = P[kW] / fp
insumos:    potencia_kw 47/52   ·   fator_potencia 0/52
```

A derivação é exata **mas o insumo não existe**: `fator_potencia` está 0/52 e, no datasheet, é tipicamente textual (`">0.99"`) — não numérico. Duas leituras:

- **Derivar** com `fp = 1` quando ausente ⇒ S = P, o que é **fabricar um número** (a mesma classe da FV-DOM-029).
- **Armazenar** ⇒ mais um campo de datasheet sem consumidor de engenharia.

> **Decisão: tratar como apresentação (classe C), persistida quando o datasheet declarar, NUNCA derivada.** Não há consumidor de engenharia que a exija; derivar com `fp` ausente seria inventar. Se um dia INV-xx precisar de S, a decisão é revisitada com `fator_potencia` cadastrado.

### 2.B — DADOS DE TOPOLOGIA

Separação exigida pelo §2: **classificação derivável** × **especificação primária**.

| Campo | Natureza | Tipo | Origem | Produtor | Persist. | Consumidores | Crít. | Edit | Exib | Deriv | Obrig. | Validação | Default | Decisão |
|---|---|---|---|---|---:|---|:--:|:--:|:--:|:--:|---|---|---|---|
| `tipo_topologia` | **classificação derivável** | enum | derivação | DER (+DS materializa) | 52/52 | toda a cadeia | **SIM** | override | ✔ | **✔** | nunca | `STRING\|MICRO\|HYBRID\|OTIMIZADOR` | `STRING` (último degrau) | **derivar**; campo explícito só como override |
| `entradas_por_mppt` | **derivável c/ override** | int[] | derivação | DER+MAN | 30/52 | topologia MPPT, capacidade de strings | **SIM** | override | ✔ | **✔** | nunca | soma `≥1`, len `= n_mppts` | nenhum (F3) | **derivar** de `strings_por_mppt`+`n_mppts`; override obrigatório p/ MPPT desigual |
| `strings_por_mppt` | **insumo de derivação** | string\|int | datasheet | DS | 30/52 | fonte de `entradas_por_mppt` | indireto | ✔ | ✔ | ✘ | não | `"n/n/…"` ou int `≥1` | — | **internalizar** — deixar de ser campo de UI própria |
| **`entradas`** | **especificação primária** | int | datasheet | **—** | **0/52** | montarModeloMicro | **SIM (micro)** | **✘→✔** | **✘→✔** | **✘** | topologia=MICRO | `≥1` | nenhum | **criar produtor** (§4) |
| **`modulos_por_entrada`** | **especificação primária** | int | datasheet | **—** | **0/52** | montarModeloMicro | **SIM (micro)** | **✘→✔** | **✘→✔** | **✘** | topologia=MICRO | `≥1` | nenhum | **criar produtor** (§4) |
| **`oversizing_max`** | **especificação primária** | number | datasheet | **—** | **0/52** | classificarOversizing | **SIM** | **✘→✔** | **✘→✔** | **✘** | recomendado | `1.0..1.5` | nenhum (F2) | **criar produtor** (§4) |
| **`max_por_cabo_tronco`** | **especificação primária** | int | datasheet | DS (prompt ✔) | **0/52** | cabo tronco, regrasMicroFabricante | **SIM (micro)** | **✘→✔** | ✔ | ✘ | topologia=MICRO | `≥1` | precedência: catálogo → fabricante → lacuna | **editar** + preencher |
| **`subtipo`** | **classificação legada** | string | — | DS (prompt ✘) | **0/52** | 2 gates de UI | — | ✘ | ✔ | ✔ | — | — | — | **REMOVER** (§5) |
| `tensao_bateria_min/max` | especificação primária | number | datasheet | — | 0/52 | INV-44/45 (não implementado) | não | ✘ | ✘ | ✘ | topologia=HYBRID | `>0`, min<max | — | **manter latente** |
| `corrente_bateria_carga/descarga_max` | especificação primária | number | datasheet | — | 0/52 | INV-44/45 | não | ✘ | ✘ | ✘ | topologia=HYBRID | `>0` | — | manter latente |

> **Regra de topologia:** obrigatoriedade é **condicional à topologia**, nunca universal. `INVERSOR_COMUM` + `INVERSOR_STRING` de `utilizavelProjeto` já implementa isso; o contrato apenas o declara. Exigir janela MPPT de microinversor barraria 16 equipamentos que o sistema sabe avaliar por outro motor.

### 2.C — DADOS DE APRESENTAÇÃO

Conforme a retificação do P0.2: **não são mortos**, são produzidos por `normalizarMulti` e consumidos pela camada de apresentação.

| Campo | Tipo | Produtor | Persist. | Consumidor | Pertence ao contrato? | Derivado? | Permanece persistido? |
|---|---|---|---:|---|---|---|---|
| `faixa_tensao_rede` | string | DS | 0/52 | card, ficha | **sim**, `natureza: apresentacao` | não | **sim** |
| `tipo_conexao_rede` | string | DS | 0/52 | card, ficha | sim | não | sim |
| `faixa_frequencia_hz` | string | DS | 0/52 | card, ficha | sim | não | sim |
| `fator_potencia` | string | DS | 0/52 | card, ficha | sim | não | sim — **insumo potencial de `potencia_aparente_kva`** |
| `thdi` | number\|string | DS | 0/52 | card, ficha | sim | não | sim |
| `tensao_nominal_cc` | number | DS | 0/52 | card, ficha | sim | não | sim |
| `faixa_operacao_cc` | string | DS | 0/52 | card, ficha | sim | não | sim |
| `eficiencia_cec` | number | DS | 0/52 | card, ficha | sim | não | sim |
| `eficiencia_mppt` | number | DS | 0/52 | card, ficha | sim | não | sim |
| `protecao_antiilhamento` | bool\|string | DS | 0/52 | ficha, `specs_canonicas.protecoes_integradas` | sim | não | sim |
| `protecao_sobretensao_dc` | string | DS | 0/52 | card, ficha, projeção | sim | não | sim |
| `protecao_sobretensao_ac` | string | DS | 0/52 | card, ficha, projeção | sim | não | sim |
| `tipo_refrigeracao` | string | DS | 0/52 | card, ficha | sim | não | sim |
| `comunicacao` | string | DS | 0/52 | card, ficha | sim | não | sim |
| `eficiencia_europeia` | number | DS | 24/52 | card, ficha, projeção | sim | não | sim |
| `grau_protecao_ip` | string | DS | 49/52 | card, ficha, edição | sim | não | sim |
| `temperatura_operacao` | string | DS | 5/52 | card, ficha | sim | não | sim |
| `peso_kg` / `dimensoes` | number / string | DS | 49 / 46 | card, ficha, edição | sim (`grupo: mecanica`) | não | sim |
| `linha` | string | DS | — | ficha | sim | não | sim |

> **Nenhum campo desta classe é removido.** A única mudança proposta é declará-los `natureza: apresentacao` no contrato, o que os exclui automaticamente de qualquer verificação de obrigatoriedade ou de lacuna de engenharia — hoje essa exclusão é implícita (eles simplesmente não aparecem nos motores) e por isso ninguém sabe se a ausência importa.

### 2.D — METADADOS (fora de `especificacoes`)

Não pertencem ao contrato de especificação elétrica. Listados para fechar o §10 (100% dos campos).

| Campo | Onde | Produtor | Papel |
|---|---|---|---|
| `tipo`, `fabricante`, `modelo` | doc raiz | MAN/DS | identidade · `PESO_IDENTIFICACAO = 15` |
| `origem.{tipo,fonte,em}` | doc raiz | hook | **proveniência** — revelou `manual=49 / datasheet=3` |
| `identificacao.{fabricante_normalizado,modelo_normalizado,hash_unico,aliases}` | doc raiz | `catalogoQualidade` | dedup |
| `qualidade.{score_global,nivel,campos_faltantes,alertas}` | doc raiz | `catalogoQualidade` | score |
| `status_operacional`, `utilizavel_em_projeto`, `bloqueio_engenharia` | doc raiz | `utilizavelProjeto` | gate (18/52 bloqueados) |
| `aprovacao_tecnica.*`, `validacao.*` | doc raiz | admin | workflow |
| `fonte_dados` | doc raiz | extrator | **confiança por campo** |
| `datasheet_original`, `documentos_tecnicos[]`, `certificacao.*` | doc raiz | upload | documentação |
| `preco_sugerido`, `ativo`, `createdAt/updatedAt` | doc raiz | — | comercial/temporal |
| `specs_canonicas` | doc raiz | `catalogoQualidade` | **projeção de relatório** (§1) |
| `certificacoes` | em `especificacoes` | DS | 46/52 · editável e **não exibido** → **exibir** |
| `garantia_anos` | em `especificacoes` | DS | 21/52 · comercial, não elétrico |

---

## 3. OS 4 DEFAULTS ELÉTRICOS

### D1 — `fases ?? 1`

```
campo:                  fases
onde ocorre:            backend/src/services/compatibilidadeFV.js:87 (extrairSpecsInversor)
                        espelhado em frontend/src/utils/catalogoEngenhariaAdapter.js:95 (declarado UI-only)
quem produz:            extrator de datasheet (prompt "fases"); 40/52 têm, 12/52 não
quem consome:           montarStrings → sugerirAcessorios · tensao_nominal_v (380/220)
                        Inversores.jsx (polos Bipolar/Tripolar) · avisoDeFase · PESOS_INVERSOR (10 pts)
qual resultado altera:  trifásico sem `fases` vira MONOFÁSICO → tensão nominal 220 V em vez de 380 V
                        → corrente de projeto ~1,73× maior → cabo e disjuntor SUPERdimensionados;
                        e `avisoDeFase` deixa de alertar incompatibilidade com a instalação
é fisicamente justificável: NÃO. 1∅ não é o caso conservador nem o mais comum no catálogo
                        (dos 40 declarados, a maioria é trifásica)
é fallback ou default:  DEFAULT — grava-se um valor onde não há dado
deve existir no contrato: NÃO
decisão proposta:       tornar `fases` EDITÁVEL (P0-a) → cadastrar os 12 → remover o `?? 1` (P1-d).
                        Nesta ordem: remover antes do cadastro converteria 12 inversores
                        em MODULO/INVERSOR_SEM_SPECS de um dia para o outro.
```

### D2 — `potencia_kw ?? 0`

```
campo:                  potencia_kw
onde ocorre:            packages/fv-shared/equipamentos/inversores/index.js (paraDimensionamento)
                        — declarado como pendência FORA do escopo no defaultsTecnicos.check §11
quem produz:            extrator + formulário manual; 47/52 têm
quem consome:           montarStrings → dc_ac_ratio = potencia_array_kw / inversor.potencia_kw
qual resultado altera:  divisão por zero → dc_ac_ratio = Infinity → alerta
                        INVERSOR_SUBDIMENSIONADO em inversor que só não tem potência cadastrada.
                        Antes do P0.1 o numerador também era 0 (0/0 = NaN) e o alerta não disparava:
                        o P0.1 tornou este default VISÍVEL, não o criou.
é fisicamente justificável: NÃO. Potência zero não é inversor
é fallback ou default:  DEFAULT
deve existir no contrato: NÃO
decisão proposta:       `potencia_kw` entra em `lacunas` de `paraDimensionamento` (mesma
                        disciplina dos outros cinco da FV-DOM-029) → montarStrings bloqueia
                        nomeando o campo. Executar no P1-d, junto com D1.
                        ATENÇÃO: o check `defaultsTecnicos §11` AFIRMA a presença deste default —
                        removê-lo exige atualizar o check no mesmo commit.
```

### D9 — `FATOR_TEMPERATURA_VOC = 1.15`

```
campo:                  coef_temp_voc (do MÓDULO — entra aqui porque substitui um dado do módulo
                        dentro do motor do inversor)
onde ocorre:            backend/src/services/compatibilidadeFV.js:21, aplicado na linha 164
quem produz:            datasheet do módulo; 5/54 têm (o P0.1 fez os outros 49 virarem null honesto)
quem consome:           montarStrings: voc_corrigido = modulo.voc × 1.15
                        → max_modulos_serie = floor(tensao_max_entrada / voc_corrigido)
qual resultado altera:  o NÚMERO MÁXIMO DE MÓDULOS EM SÉRIE — o parâmetro mais sensível do
                        dimensionamento CC. 1,15 corresponde a ≈ −0,28 %/°C a −10 °C.
                        Módulos N-type modernos têm ≈ −0,24 %/°C → o fator real seria ~1,13
                        → a constante é CONSERVADORA (permite menos módulos que o real).
                        Em compensação, −10 °C não ocorre no RN: a temperatura mínima real
                        (CLIMA_PADRAO_UF, RN tmin 18 °C) tornaria o fator ~1,02.
                        Ou seja: a constante é conservadora no coeficiente e MUITO conservadora
                        na temperatura — e as duas fontes de conservadorismo se somam sem controle.
é fisicamente justificável: SIM como limite superior de segurança; NÃO como substituto do dado real
é fallback ou default:  APROXIMAÇÃO DE ENGENHARIA embutida como constante — não é default de campo
deve existir no contrato: NÃO — é regra de motor, não especificação de equipamento
decisão proposta:       NENHUMA ação no P0.2-A. Ligar `coef_temp_voc` + `tmin` da UF ao cálculo
                        (como `classificarTensaoCC` já faz na nova UX) é MUDANÇA DE REGRA ELÉTRICA
                        e altera o veredito de dimensionamento de todo projeto pelo motor legado.
                        → PENDÊNCIA DE ENGENHARIA (§10, item E1). Exige aprovação formal.
```

### D10 — `Math.ceil(inversor.mppt_min_v / modulo.vmpp || 1)`

```
campo:                  — (não é campo, é precedência de operador)
onde ocorre:            backend/src/services/compatibilidadeFV.js:166
quem produz:            —
quem consome:           min_modulos_serie, usado no laço que escolhe a configuração de string
qual resultado altera:  `||` tem precedência MENOR que `/`, então o `|| 1` se aplica ao
                        RESULTADO da divisão, não ao divisor:
                            vmpp = 0    → 200/0 = Infinity  → Math.ceil(Infinity) = Infinity
                            vmpp = null → 200/null = Infinity → idem
                        A intenção aparente era `Math.ceil(mppt_min_v / (vmpp || 1))`.
                        Efeito: min_modulos_serie = Infinity > max → veredito INCOMPATIVEL,
                        atribuindo à COMBINAÇÃO um defeito que é falta de cadastro.
                        Impacto em produção HOJE: ZERO — 54/54 módulos têm vmp, e o guard do
                        P0.1 passou a bloquear antes por `MODULO_SEM_SPECS`. É bug LATENTE.
é fisicamente justificável: N/A
é fallback ou default:  BUG DE PRECEDÊNCIA disfarçado de default
deve existir no contrato: NÃO
decisão proposta:       corrigir no P2, isolado, com teste. Não urgente — o P0.1 já o tornou
                        inalcançável pelo caminho normal. Não corrigir junto de outra mudança,
                        para que o teste prove exatamente esta linha.
```

---

## 4. CLASSE F — `entradas`, `modulos_por_entrada`, `oversizing_max`

Avaliação pelas opções A/B/C/D, sem decidir pelo nome.

### `entradas` — quantas entradas CC independentes o microinversor tem

| Opção | Avaliação |
|---|---|
| A — criar produtor | viável |
| B — derivável? | **NÃO.** Não há fórmula: um micro de 2000 W pode ter 2 ou 4 entradas conforme a linha do fabricante. `n_mppts` **não** é substituto — em micro, MPPT e entrada física são contagens distintas (achado do FV-UX-027). |
| C — legado? | **NÃO.** `montarModeloMicro` o consome hoje; 16 inversores dependem dele |
| D — específico de topologia | **SIM** — só existe para `MICRO` |

> **Decisão: D + A.** Campo do **subcontrato `MICRO`**, obrigatório quando `tipo_topologia = MICRO`, com produtor a criar (prompt + `normalizarMulti` + formulário). Fora de MICRO não é exigido nem exibido.

### `modulos_por_entrada` — quantos módulos cada entrada aceita

Mesma análise. **Decisão: D + A.** Complemento obrigatório de `entradas`: os dois juntos formam o envelope `micro → entradas → módulos` (FV-DOM-031, decisão 5). Um sem o outro não fecha a topologia.

### `oversizing_max` — limite CC/CA do fabricante

| Opção | Avaliação |
|---|---|
| A — criar produtor | viável |
| B — derivável? | **NÃO**, e a F2 já provou o custo: o `?? 1.30` anterior fabricava o limite do fabricante em 100% dos casos, e todo `OVERSIZING_ELEVADO` já emitido foi contra número inventado |
| C — legado? | **NÃO.** `classificarOversizing` o consome |
| D — específico de topologia? | **NÃO** — vale para STRING, MICRO e HYBRID |

> **Decisão: A (não D).** Campo do **contrato comum**, `recomendado` (não obrigatório): sua ausência produz `nao_avaliado`, que é veredito honesto e não bloqueia. Diferença deliberada em relação aos dois anteriores, que **bloqueiam** o motor micro.

**Consequência comum aos três:** exigem alteração do **prompt de extração** (lista 6) e de `normalizarMulti` (lista 5) — é a única forma de preencher os 49 registros manuais sem redigitação, via reprocessamento do datasheet original (`datasheet_original.conteudo_base64` já está guardado no schema).

---

## 5. `subtipo` — DECISÃO FORMAL

> **`subtipo` não é dado primário; é integralmente derivável por `classificarTopologiaInversor`.**
> **NÃO é incluído como campo obrigatório do contrato canônico.**

**Existe motivo legítimo para persistir como cache/materialização?** Foram avaliados os quatro motivos usuais:

| Motivo | Aplica? | Por quê |
|---|---|---|
| Custo de cálculo | **não** | a classificação é um punhado de regex sobre strings curtas |
| Consulta/índice no banco | **não** | não há query por topologia; a listagem filtra por `tipo` e `ativo` |
| Auditoria histórica (o que o sistema achou na data X) | **não** | `validacao.historico` já registra mudanças; e uma classificação congelada é pior que uma correta |
| Override humano ("este modelo é micro, apesar do nome") | **SIM** | é o único motivo real — mas ele já tem campo próprio: **`tipo_topologia`**, que é o primeiro degrau de precedência do classificador |

> **Recomendação: remover `subtipo` do vocabulário persistido.** O override humano usa `tipo_topologia`; a classificação automática usa a função. Não há terceiro papel.
>
> **Causa raiz do 0/52, para o registro:** `normalizarMulti:77` grava `set('subtipo', v.subtipo)`, mas `subtipo` **não consta do prompt de extração** — o extrator nunca tem como devolvê-lo. O campo nasceu sem produtor.
>
> **Dependências a migrar antes de remover:** `Inversores.jsx` (badge + gate do cabo tronco), `fichaTecnicaMap` (slot "Subtipo"), `catalogoQualidade.tipo_inversor` (`pick(['tipo_inversor','tipo','subtipo'])` — 0/52 nos três), `extrairSpecsInversor.tipo` (default D5 `'string'`, 52/52), `classificarTopologiaInversor` degrau 2 (aceita `ctx.subtipo`; manter por compatibilidade de leitura).

---

## 6. MATRIZ DAS 9 CAMADAS + PERSISTÊNCIA

| # | Camada | Produz | Transforma | Persiste | Lê | Traduz alias | Aplica default | Valida |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | **SSOT** `dicionarioInversor` | ✘ | ✔ deriva `tipo_topologia`, `entradas_por_mppt`, `fases` | ✘ | ✔ | **✔ (autoridade)** | ✘ | ✘ |
| 2 | `normalizarMulti` (produtor) | **✔** | ✔ | ✔ (via controller) | ✘ | ✔ **próprio** | ✘ | ✘ |
| 3 | prompt de extração | **✔ (origem documental)** | ✘ | ✘ | ✘ | — | ✘ | ✘ |
| 4 | `fichaTecnicaMap` | ✘ | ✔ agrupa | ✘ | ✔ | ✔ **próprio, divergente** | ✘ | ✘ |
| 5 | `utilizavelProjeto` | ✘ | ✘ | ✔ (grava `utilizavel_em_projeto`, `bloqueio_engenharia`) | ✔ | ✔ **próprio, divergente** | ✘ | **✔ (gate)** |
| 6 | `catalogoEngenhariaAdapter` | ✘ | ✔ | ✘ | ✔ | ✔ **próprio, divergente** | **✔ (D7, D8)** | ✘ |
| 7 | exibição `SPECS_*` | ✘ | ✘ | ✘ | ✔ | ✘ (chave crua) | ✘ | ✘ |
| 8 | edição `ESQUEMA.inversor` | ✔ (grava) | ✘ | ✔ | ✔ | ✘ (chave crua) | ✘ | **✔ (obrigatório)** |
| 9 | criação `ModalNovoInversor` | **✔ (49/52 registros!)** | ✘ | ✔ | ✘ | ✘ (chave crua) | ✘ | ✔ (fabricante+modelo) |
| — | **`specs_canonicas`** (persistência) | ✘ | ✔ **lossy** | **✔ 52/52** | ✘ em engenharia (travado) | ✘ | ✘ (F10 §2) | ✘ |
| — | `validacaoEletricaInversor` | ✘ | ✘ | ✘ | ✔ | **✘ — cego a alias** | ✘ | **✔ (plausibilidade)** |
| — | `compatibilidadeFV` / motores | ✘ | ✔ | ✘ | ✔ via SSOT | ✘ (usa SSOT) | **✔ (D1,D2,D4,D5)** | ✔ |

**Leitura da matriz:** quatro camadas traduzem alias por conta própria (1, 2, 4, 5, 6 — sendo 1 a autoridade) e três aplicam defaults (6 e os motores). A camada **9**, que produziu 94% do catálogo, não traduz, não valida e não deriva — grava chave crua com 6 campos. É o elo mais fraco e o mais usado.

---

## 7. MATRIZ DE ALIASES

Verificada **unidade e semântica**, não só o nome.

### 7.1 Aliases legítimos (mesma grandeza, mesma unidade) — **manter**

| Nome encontrado | Campo canônico | Unid. confere | Onde vive | Divergência | Ação |
|---|---|:--:|---|---|---|
| `potencia_nominal_kw`, `potencia_kw_ca`, `potenciaKW`, `potencia` | `potencia_kw` | ✔ kW | SSOT, normalizarMulti, ficha | nomenclatura histórica | manter no SSOT |
| `voc_max_dc`, `voc_max`, `tensao_max_dc`, `tensao_max_cc`, `vpv_max`, `tensao_max_entrada_dc_v` | `tensao_max_entrada` | ✔ V | SSOT, ficha, gate, adapter | nomenclatura | manter no SSOT · **remover das cópias** |
| `mppt_min`, `faixa_mppt_min`, `tensao_mppt_min_v` | `tensao_mppt_min` | ✔ V | SSOT, ficha, gate, adapter | nomenclatura | idem |
| `mppt_max`, `faixa_mppt_max`, `tensao_mppt_max_v` | `tensao_mppt_max` | ✔ V | SSOT, ficha, gate, adapter | nomenclatura | idem |
| `corrente_max_mppt`, `ipv_max`, `corrente_max_por_mppt_a` | `corrente_max_por_mppt` | ✔ A | SSOT, ficha, gate, adapter | nomenclatura | idem |
| `isc_max_mppt`, `isc_max_por_mppt_a`, `corrente_curto_mppt`, `corrente_isc_max_a` | `corrente_isc_max` | ✔ A | SSOT, ficha, projeção | nomenclatura | idem |
| `mppts`, `nMppts`, `numero_mppt`, `num_mppt` | `n_mppts` | ✔ — | SSOT, ficha, gate, adapter | nomenclatura | idem |
| `fases_saida`, `numeroFases`, `faseAC`, `fases_ac` | `fases` | ✔ — | SSOT, ficha, adapter, projeção | nomenclatura | idem |
| `tensao_ac_nominal`, `tensao_saida`, `tensao_nominal_v` | `tensao_ac` | ✔ V | SSOT, ficha | nomenclatura | manter |
| `corrente_max` | `corrente_ac_saida` | ✔ A | SSOT, ficha | **nome ambíguo** (qual corrente?) | manter como alias, **não usar em código novo** |
| `max_micros_por_arranjo`, `max_micros_serie`, `max_micros_por_ramal`, … | `max_por_cabo_tronco` | ✔ — | SSOT | Sprint E3 já resolveu a precedência | manter |

### 7.2 Nomes SEM correspondente no SSOT — **decidir**

| Nome encontrado | Campo canônico | Onde vive | Tipo de divergência | Ação |
|---|---|---|---|---|
| **`potencia_ca`** | `potencia_kw` (presumido) | `utilizavelProjeto:59`, `catalogoEngenhariaAdapter:101` | **sem correspondente SSOT** · unidade **não declarada** (kW? W?) | **eliminar** — 0/52 no banco, nenhum produtor o grava. Impacto medido: zero |
| **`potencia_cc_max`** | `potencia_max_entrada_cc` | `fichaTecnicaMap:77` | sem correspondente SSOT | **eliminar** do slot da ficha |
| `tipo_inversor` | — | `catalogoQualidade:170` | campo que não existe em lugar nenhum (0/52) | **eliminar** junto com `subtipo` (§5) |
| `entrada_monofalor` | `fases` | `dicionarioInversor._inferirFases` | **typo histórico de seed**, já documentado | manter (defensivo, custo zero) |

### 7.3 Correção ao exemplo do enunciado (§8)

O enunciado propõe `potencia_w → potencia_wp` como canônico. **A relação é a inversa no SSOT do módulo:**

```
CAMPOS_MODULO.potencia_w = ['potencia_wp', 'potencia_w', 'potenciaW', 'potencia_pico', 'potencia']
                ↑ CHAVE canônica              ↑ primeiro ALIAS (é o que está gravado, 54/54)
```

A **chave canônica** (nome interno do contrato) é `potencia_w`; o **nome gravado** em 54/54 documentos é `potencia_wp`. São coisas diferentes e a distinção importa: o P0.1 não renomeou nada no banco — fez o motor ler pela chave canônica, que resolve o alias gravado. **Nenhum alias deve ser eliminado do lado do módulo**, porque `potencia_wp` é o dado real em produção.

---

## 8. PROPOSTA FINAL — uma só

### 8.1 Forma

`CAMPOS_INVERSOR_CANONICO` = `CAMPOS_INVERSOR` **acrescido de metadados por campo**. Mesma estrutura plana, mesmas chaves, mesmos aliases. Nenhum campo novo, nenhum alias novo.

```js
// FORMA PROPOSTA (não implementada)
tensao_max_entrada: {
  aliases: [...],                    // — inalterado
  grupo: 'eletrica_cc',              // + taxonomia (§9 do enunciado)
  natureza: 'primario',              // + primario | derivado | apresentacao
  tipo: 'number',  unidade: 'V',     // +
  origem: 'datasheet',               // +
  obrigatorio: { topologia: ['STRING','HYBRID','OTIMIZADOR'] },  // + condicional
  editavel: true,  exibivel: true,   // +
  validacao: { min: 100, max: 1500 },// +
  peso: 15,                          // — inalterado
}
```

### 8.2 Os 10 grupos do §9 — validados contra o domínio

O enunciado pede para validar a taxonomia antes de adotar. Resultado:

| Grupo proposto | Existe no domínio? | Campos | Veredito |
|---|---|---|---|
| `identidade` | ✔ mas **fora de `especificacoes`** | fabricante, modelo, linha | **excluir do contrato de specs** — é metadado (§2.D) |
| `eletrica_cc` | ✔ | tensao_max_entrada, corrente_max_entrada, tensao_partida, potencia_max_entrada_cc | adotar |
| `mppt` | ✔ | n_mppts, tensao_mppt_min/max, corrente_max_por_mppt, corrente_isc_max, strings_por_mppt, entradas_por_mppt | adotar — corresponde ao grupo `CC` atual, mais preciso |
| `eletrica_ca` | ✔ | potencia_kw, potencia_maxima_kw, potencia_aparente_kva, tensao_ac, corrente_ac_saida, fases, frequencia_hz | adotar = grupo `CA` atual |
| `topologia` | ✔ **e é o que falta hoje** | tipo_topologia, entradas, modulos_por_entrada, max_por_cabo_tronco, oversizing_max | **adotar — grupo novo, necessário** |
| `mecanica` | ✔ | peso_kg, dimensoes | adotar = grupo `FIS` atual |
| `ambiental` | ✔ | temperatura_operacao, grau_protecao_ip, tipo_refrigeracao | adotar (hoje `PROT`+`FIS` misturados) |
| `certificacao` | ✔ | certificacoes | adotar |
| `garantia` | ✔ | garantia_anos | adotar |
| `apresentacao` | ✔ | os 14 da §2.C sem consumidor de engenharia | **adotar — resolve a classe C** |
| — | **faltou** | tensao_bateria_*, corrente_bateria_* | **acrescentar `bateria`** (grupo `BAT` já existe no SSOT) |

> **Adotar os 10 grupos + `bateria`, menos `identidade`, como VALOR DO CAMPO `grupo:`** — metadado de organização, exatamente como o `grupo: 'CA'|'CC'|'BAT'|'EFIC'|'PROT'|'FIS'|'GERAL'` que já existe.
> **NÃO transformar em aninhamento de objeto.** `especificacoes` é `Mixed` e tem 106 documentos gravados em estrutura plana; aninhar exigiria migração de banco para ganho puramente visual. O §9 do enunciado já alertava para isso e a medição confirma: nenhum ganho funcional.

### 8.3 Contrato resultante — contagem

```
34 campos SSOT atuais
 −1  subtipo já não estava no SSOT (não entra)
 +0  nenhum campo novo
────────────────────────────────────────────
34 campos, reagrupados em 10 grupos, com 8 metadados cada
     18 primarios · 3 derivados · 13 apresentacao
     7 obrigatórios condicionais à topologia · 0 obrigatórios universais além de potencia_kw e fases
```

---

## 9. CRITÉRIO DE APROVAÇÃO §10 — cobertura

Para **100% dos campos** (34 SSOT + subtipo + 14 apresentação + 12 metadados) as 11 perguntas estão respondidas nas tabelas §2.A–§2.D. Resumo da resposta final:

> **Existe exatamente uma fonte canônica para cada especificação de engenharia?**
>
> **Hoje: NÃO.** Cinco camadas traduzem alias por conta própria e `specs_canonicas` é um segundo repositório persistido em 52/52.
>
> **Com este contrato: SIM** — `CAMPOS_INVERSOR_CANONICO` é a única fonte; `specs_canonicas` permanece explicitamente rotulada como projeção somente-escrita, papel já travado por três checks.

---

## 10. PENDÊNCIAS QUE EXIGEM DECISÃO DE ENGENHARIA ELÉTRICA

Nenhuma destas pode ser decidida por análise de código. São as únicas travas para emitir o P0-a.

| # | Pendência | Pergunta | Impacto se decidida |
|---|---|---|---|
| **E1** | `FATOR_TEMPERATURA_VOC = 1.15` (D9) | O motor legado deve passar a usar `coef_temp_voc` real + `tmin` da UF, como a nova UX já faz? | Altera `max_modulos_serie` de **todo** projeto pelo `/api/dimensionamento`. Hoje 49/54 módulos não têm o coeficiente |
| **E2** | Ramo `resto` de `montarStrings` | Módulos sobrando são "usados" (contam na potência) ou "não conectados" (não contam)? Hoje `total_modulos_usados` diz uma coisa e `potencia_array_kw` outra | Medido: 2 de 16 combinações afetadas |
| **E3** | `corrente_isc_max` obrigatório? | Bloquear os 25 inversores sem o limite de curto, ou manter `nao_avaliado`? | `utilizavelProjeto` hoje **não** o exige, deliberadamente (F1/F2) |
| **E4** | `oversizing_max` — teto do sistema | Sem o dado do fabricante, vale só o teto de segurança de 1,50× do sistema? | Afeta `classificarOversizing` em 52/52 |
| **E5** | `entradas` × `n_mppts` em micro | Confirmar que são contagens independentes (FV-UX-027) e que nenhuma deriva da outra | Define se o subcontrato MICRO tem 2 campos ou 1 |
| **E6** | `potencia_aparente_kva` | Confirmar que nenhuma regra de parecer de acesso / homologação exige S em kVA | Se exigir, muda de `apresentacao` para `primario` |

---

## 11. O QUE NÃO FOI FEITO

Nenhum refactor, migração, alteração de banco, de UI, de default ou de cálculo. Nenhum campo novo. Nenhum alias novo. `CAMPOS_INVERSOR`, `ESQUEMA.inversor`, `SPECS_*`, `ModalNovoInversor`, `montarStrings`, `coef_temp_voc`, ramo `resto`, cabo tronco e os 11 defaults permanecem exatamente como estavam.

**Aguardando:** decisão sobre E1–E6 e aprovação do contrato para emissão do P0-a.
