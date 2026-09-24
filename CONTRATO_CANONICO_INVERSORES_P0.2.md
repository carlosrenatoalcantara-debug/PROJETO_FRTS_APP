# P0.2 — Inventário e Proposta de Contrato Canônico de Inversores

**Data:** 2026-09-12 · **Escopo:** arquitetura/inventário. **Nenhum código foi alterado.**
**Base de medição:** MongoDB Atlas produção — 52 inversores, 54 módulos.
**Não reabre o P0.1.**

---

## 0. CORREÇÃO DE PREMISSA — são NOVE listas, não quatro

O enunciado parte de quatro representações. A varredura por consumidor real encontrou **nove**, todas com vocabulário próprio. Três delas não estavam no radar e duas contradizem o SSOT.

| # | Lista | Arquivo | Campos | Papel | Tem aliases próprios? |
|---|---|---|---:|---|---|
| 1 | `CAMPOS_INVERSOR` | `equipamentos/inversores/dicionarioInversor.js` | 34 | **SSOT de leitura** | — (é a fonte) |
| 2 | `SPECS_AC/DC/EXTRA` | `pages/Inversores.jsx` | 40 | exibição (card) | não (lê chave crua) |
| 3 | `ESQUEMA.inversor` | `ai/camposEquipamento.js` | 19 | edição + assistente | não (lê chave crua) |
| 4 | form manual | `ModalNovoInversor.jsx` | 6 | criação manual | não (grava chave crua) |
| 5 | `mapearEspecificacoes` | `ai/normalizarMulti.js` | **41** | **produtor** (datasheet) | **sim** |
| 6 | prompt de extração | `controllers/datasheetController.js` | **40** | contrato documental (IA) | — |
| 7 | `GRUPOS_POR_TIPO.inversor` | `utils/catalogo/fichaTecnicaMap.js` | **56 slots** | 2ª exibição (Ficha Técnica) | **sim, divergentes** |
| 8 | `INVERSOR_COMUM/STRING` | `equipamentos/utilizavelProjeto.js` | 6 | gate de engenharia | **sim, divergentes** |
| 9 | `inversorParaEngenharia` | `utils/catalogoEngenhariaAdapter.js` | 12 | adapter do wizard | **sim, divergentes + defaults** |

Ainda há **`specs_canonicas`** — um **décimo** vocabulário, derivado por `catalogoQualidade.normalizarSpecsInversor` e **persistido no Atlas em 52/52 inversores** com nomes próprios (`potencia_kw_ca`, `voc_max_dc_v`, `isc_max_por_mppt_a`, `fases_saida`, `tensao_inicializacao_dc_v`, `strings_max_por_mppt`).

> **Consequência:** unificar apenas exibição/edição contra `CAMPOS_INVERSOR` resolve 4 das 9. Sem tratar 5, 7, 8 e 9 a divergência volta pelo produtor e pelos adapters.

---

## 1. A DESCOBERTA QUE REORDENA AS PRIORIDADES

```
origem dos 52 inversores:   manual = 49   ·   datasheet_pdfparse = 3
origem dos 54 módulos:      manual = 49   ·   datasheet_pdfparse = 5
```

O produtor rico (lista 5, 41 campos, alimentado pelo prompt da lista 6) **produziu 3 dos 52 registros — 6%**. O catálogo real foi digitado pelo formulário manual, que tem **6 campos na criação e 19 na edição**.

Isto explica, sem hipótese adicional, **todos** os campos em 0/52:

| Campo | 0/52 porque | Classe |
|---|---|---|
| `corrente_max_entrada` | só o extrator o produz; 3 extrações, nenhuma o trouxe | F |
| `max_por_cabo_tronco` | idem (está no prompt, linha 177) | F |
| `potencia_aparente_kva`, `frequencia_hz` | idem | F |
| os 14 rótulos "mortos" do card | idem — **não são inventados**, são chaves do produtor | C |
| `subtipo` | `normalizarMulti` grava, mas **o prompt nunca pede** | E |
| `entradas`, `modulos_por_entrada`, `oversizing_max` | **não existem em produtor nenhum** | F |

**Retificação da auditoria anterior:** classifiquei 13 rótulos do card como "mortos / inventados". Estava errado — eles são exatamente as chaves de `normalizarMulti` (`faixa_tensao_rede`, `tipo_conexao_rede`, `fator_potencia`, `thdi`, `tensao_nominal_cc`, `faixa_operacao_cc`, `eficiencia_cec`, `eficiencia_mppt`, `protecao_sobretensao_dc/ac`, `tipo_refrigeracao`, `comunicacao`, `faixa_frequencia_hz`). `SPECS_*` foi derivado do produtor, não inventado. Estão em 0/52 por falta de execução do produtor, não por falta de contrato. Isso muda a decisão de **remover** para **manter como C**.

---

## 2. CONSUMIDORES REAIS — quem lê inversor e por onde

| Consumidor | Lê via | Campos consumidos | Observação |
|---|---|---|---|
| `compatibilidadeFV.extrairSpecsInversor` → `montarStrings` | SSOT (`paraDimensionamento`) | `potencia_kw`, `fases`, `tensao_ac`, `tensao_max_entrada`, `tensao_mppt_min/max`, `corrente_isc_max`, `n_mppts`, `eficiencia_maxima`, `tipo_topologia`, `entradas_por_mppt` | ✅ conforme |
| `inversoresCompativeisService` | SSOT (`lerInversor`) | + `corrente_max_por_mppt`, `corrente_max_entrada` | traduz nomes localmente (documentado) |
| `catalogo.js::eletricoDoInversor` (nova UX) | SSOT (`lerInversor`) | + `oversizing_max`, `entradas`, `modulos_por_entrada`, `max_por_cabo_tronco` | ✅ conforme |
| `catalogoEletrico.dadosEletricosInversor` | recebe `_eletrico` | idem | gate: sem `tensao_max_entrada`+`corrente_max_mppt`+`mppt_min/max` devolve `null` (**15/52**) |
| `classificacaoTensaoCC / CorrenteCC / Oversizing` | recebem envelope | `tensao_max_entrada`, `mppt_min/max`, `corrente_isc_max_mppt`, `corrente_max_entrada`, `oversizing_max` | ausência ⇒ `nao_avaliado` |
| `engenharia/microinversores`, `arranjosMicro`, `correnteMicro`, `regrasMicroFabricante` | SSOT | `entradas`, `modulos_por_entrada`, `corrente_ac_saida`, `max_por_cabo_tronco`, `fases` | envelope micro 0% preenchido |
| `catalogoQualidade` (score backend) | SSOT | 10 campos com peso | grava `specs_canonicas` (10º dialeto) |
| `catalogQualityEngine` (score frontend) | SSOT | idem | espelho do backend |
| `utilizavelProjeto.avaliarUtilizavel` | **aliases próprios** | `potencia_kw`(+`potencia_ca`), `n_mppts`(+`numero_mppt`), `tensao_max_entrada`(+`voc_max`,`tensao_max_dc`), `mppt_min/max`, `corrente_max_por_mppt`(+`ipv_max`) | **divergente** — aceita grafias que o SSOT não conhece |
| `catalogoEngenhariaAdapter` (wizard) | **aliases próprios + defaults** | 12 campos | **divergente** |
| `fichaTecnicaMap` (Ficha Técnica) | **aliases próprios** | 56 slots | **divergente** |
| `validacaoEletricaInversor` | **chave crua, sem alias** | 11 campos | **divergente** — cego a alias |
| `regrasPlausibilidade.tecnologiaInversor` | recebe campos | `voc_max_dc_v`, `potencia_kw_ca`, `n_mppts` + fabricante/modelo | alimenta `classificarTopologiaInversor` |
| `topologiaInversor` (wizard), `derivadosTopologia`, `montarGerador`, `unifilar/adaptarProjeto` | SSOT | `tipo_topologia`, `entradas_por_mppt`, `n_mppts`, `modulos_por_entrada` | ✅ conforme |
| `Inversores.jsx::DimensionamentoEletrico` | **chave crua** | `corrente_ac_saida`, `fases`, `subtipo`, `max_por_cabo_tronco` | gate por `subtipo` (0/52) ⇒ **morto** |

---

## 3. MATRIZ COMPLETA — critério de aceitação §9

Legenda SSOT/UI/Motor: ✔ presente · ✘ ausente. UI = `E`ditável / `X`ibido / `C`riação manual.

| Campo | SSOT | UI | Motor | Persist. | Fonte | Classe | **Decisão** |
|---|:--:|:--:|:--:|---:|---|:--:|---|
| `potencia_kw` | ✔ | E X C | ✔ | 47/52 | datasheet + manual | **A** | manter · obrigatório |
| `potencia_maxima_kw` | ✔ | E X | plausib. | 47/52 | datasheet | **A** | manter |
| `potencia_aparente_kva` | ✔ | X | ✘ | 0/52 | datasheet | **B** | derivar de `potencia_kw`+`fator_potencia`; §6 |
| `tensao_ac` | ✔ | E X | ✔ | 12/52 | datasheet | **A** | manter · **editar** (cobertura 23%) |
| `corrente_ac_saida` | ✔ | E X | ✔ (cabo CA, micro) | 49/52 | datasheet | **A** | manter |
| **`fases`** | ✔ | X | ✔ (5 consumidores) | 40/52 | datasheet | **A** | **editar** — hoje não é editável |
| `frequencia_hz` | ✔ | X | ✘ | 0/52 | datasheet | **C** | manter como apresentação |
| `n_mppts` | ✔ | E X C | ✔ | 43/52 | datasheet + manual | **A** | manter · obrigatório |
| `strings_por_mppt` | ✔ | E X | fonte de derivação | 30/52 | datasheet | **B** | **internalizar** — é insumo de `entradas_por_mppt` |
| `tipo_topologia` | ✔ | E X | ✔ | 52/52 (derivado) | derivação | **B** | **derivar**; parar de persistir como se fosse primário |
| `entradas_por_mppt` | ✔ | E X C | ✔ | 30/52 | derivado + manual | **B** | derivar de `strings_por_mppt`+`n_mppts`; editar só como override |
| **`entradas`** (micro) | ✔ | ✘ | ✔ (16 micros) | **0/52** | **sem produtor** | **F** | **preencher via fonte documental** + editar |
| **`modulos_por_entrada`** | ✔ | ✘ | ✔ (16 micros) | **0/52** | **sem produtor** | **F** | idem |
| **`max_por_cabo_tronco`** | ✔ | X | ✔ (cabo tronco) | **0/52** | prompt ✔, extração ✘ | **F** | **preencher via fonte documental** + editar |
| `tensao_max_entrada` | ✔ | E X C | ✔ | 44/52 | datasheet + manual | **A** | manter · obrigatório (string) |
| `tensao_mppt_min` | ✔ | E X | ✔ | 37/52 | datasheet | **A** | manter · obrigatório (string) |
| `tensao_mppt_max` | ✔ | E X | ✔ | 37/52 | datasheet | **A** | manter · obrigatório (string) |
| `corrente_max_por_mppt` | ✔ | E X C | ✔ | 51/52 | datasheet + manual | **A** | manter |
| `corrente_isc_max` | ✔ | E X | ✔ (único critério que reprova) | 27/52 | datasheet | **A** | manter · **campanha de cadastro** |
| **`corrente_max_entrada`** | ✔ | X | ✔ (critério ligado) | **0/52** | prompt ✔, extração ✘ | **F** | **editar** + preencher |
| `tensao_partida` | ✔ | X | fallback runtime | 29/52 | datasheet | **A** | **editar** |
| `potencia_max_entrada_cc` | ✔ | X | ✘ | 0/52 | datasheet | **A** | manter; sem consumidor hoje |
| **`oversizing_max`** | ✔ | ✘ | ✔ (`classificarOversizing`) | **0/52** | **sem produtor** | **F** | **preencher via fonte documental** + editar |
| `tensao_bateria_min/max` | ✔ | ✘ | INV-44/45 (futuro) | 0/52 | — | **F** | manter latente; só p/ `HYBRID` |
| `corrente_bateria_carga/descarga_max` | ✔ | ✘ | idem | 0/52 | — | **F** | idem |
| `eficiencia_maxima` | ✔ | E X | ✔ (default 97) | 33/52 | datasheet | **A** | manter |
| `eficiencia_europeia` | ✔ | X | ✘ | 24/52 | datasheet | **C** | manter |
| `grau_protecao_ip` | ✔ | E X | ✘ | 49/52 | datasheet | **C** | manter |
| `temperatura_operacao` | ✔ | X | ✘ | 5/52 | datasheet | **C** | manter |
| `peso_kg` / `dimensoes` | ✔ | E X | ✘ | 49 / 46 | datasheet | **C** | manter |
| `garantia_anos` | ✔ | E X | comercial | 21/52 | datasheet | **A** | manter |
| `certificacoes` | ✔ | E | homologação | 46/52 | datasheet | **A** | **exibir** — editável e não exibido |
| **`subtipo`** | ✘ | X (badge) | 2 gates | **0/52** | prompt ✘ | **E** | **remover** — substituir por `tipo_topologia` |
| 14 chaves de apresentação¹ | ✘ | X | ✘ | 0/52 | datasheet | **C** | manter (produtor existe) |
| `linha` | ✘ | Ficha | ✘ | — | datasheet | **C** | manter |
| `lacunas`, `lacunas_micro`, `max_entradas_total`, `tensao_nominal_v` | — | ✘ | ✔ | nunca | calculado | **D** | internalizar — nunca persistir |
| `specs_canonicas.*` | — | ✘ | score | 52/52 | derivado | **E** | **migrar** para nomes do SSOT |

¹ `faixa_tensao_rede`, `tipo_conexao_rede`, `faixa_frequencia_hz`, `fator_potencia`, `thdi`, `tensao_nominal_cc`, `faixa_operacao_cc`, `eficiencia_cec`, `eficiencia_mppt`, `protecao_antiilhamento`, `protecao_sobretensao_dc`, `protecao_sobretensao_ac`, `tipo_refrigeracao`, `comunicacao`.

---

## 4. DIVERGÊNCIAS DE NOMENCLATURA

### 4.1 Aliases que existem FORA do SSOT (risco de leitura divergente)

| Grafia | Onde vive | Está no SSOT? | Decisão |
|---|---|:--:|---|
| `potencia_ca` | `utilizavelProjeto`, `catalogoEngenhariaAdapter` | **✘** | **remover** do adapter — nunca gravada (0/52) |
| `numero_mppt` | `utilizavelProjeto`, `catalogoEngenhariaAdapter` | ✔ (alias) | manter |
| `voc_max`, `tensao_max_cc` | `utilizavelProjeto`, `fichaTecnicaMap`, adapter | ✔ (`voc_max`) / **✘** (`tensao_max_cc`) | `tensao_max_cc` já é alias do SSOT — **manter**, só parar de duplicar a lista |
| `corrente_max_mppt`, `ipv_max` | `utilizavelProjeto`, adapter, ficha | ✔ (aliases) | manter no SSOT, remover das cópias |
| `corrente_curto_mppt` | `fichaTecnicaMap` | ✔ (alias) | manter |
| `potencia_cc_max` | `fichaTecnicaMap` | **✘** | **remover** — o SSOT usa `potencia_kw_cc_max` |
| `faseAC`, `corrente_max`, `tensao_saida` | `fichaTecnicaMap` | ✔ (aliases) | manter |
| `fases_saida` | adapter, `specs_canonicas` | ✔ (alias) | manter |

**Nenhum alias novo é proposto.** A ação é eliminar as **cópias** das listas, não a lista canônica.

### 4.2 O caso `potencia_*` (paralelo ao P0.1, lado inversor)

```
canônico:  potencia_kw
aliases:   potencia_nominal_kw · potencia_kw_ca · potenciaKW · potencia
fora:      potencia_ca (só em 2 adapters, 0/52 no banco)
```
Decisão: canônico `potencia_kw`; `potencia_ca` **removido** por não ter registro nem produtor. Os demais permanecem por compatibilidade com o que já está gravado.

### 4.3 Três grandezas de corrente — não confundir (já resolvido pela F8/F10, registrar)

```
corrente_max_por_mppt   limite de OPERAÇÃO, por MPPT        51/52
corrente_isc_max        limite de CURTO-CIRCUITO, por MPPT  27/52
corrente_max_entrada    limite TOTAL de entrada CC           0/52
```
**Manter separadas. Nunca substituir uma pela outra, nem derivar `corrente_max_entrada` de `corrente_max_por_mppt × n_mppts`.**

---

## 5. CAMPOS SEM CONSUMIDOR / DUPLICADOS / AUSENTES

**Sem consumidor de engenharia (classe C, manter como apresentação):** `frequencia_hz`, `eficiencia_europeia`, `grau_protecao_ip`, `temperatura_operacao`, `peso_kg`, `dimensoes`, `potencia_max_entrada_cc`, + as 14 chaves de apresentação.

**Duplicados semânticos:**
- `strings_por_mppt` × `entradas_por_mppt` — a segunda é **derivada** da primeira. Duas persistidas (30/52 cada) para a mesma informação física.
- `subtipo` × `tipo_topologia` — a segunda supera a primeira e está em 52/52. A primeira está em 0/52 e ainda gateia duas features.
- `specs_canonicas` × `especificacoes` — mesma informação, dois vocabulários, ambos persistidos.

**Necessários e ausentes (classe F, 0/52):** `entradas`, `modulos_por_entrada`, `oversizing_max`, `corrente_max_entrada`, `max_por_cabo_tronco`. Os três primeiros **não têm produtor em lugar nenhum do sistema** — nem prompt, nem normalizador, nem formulário.

---

## 6. CRITÉRIO DE DERIVAÇÃO — o que NÃO deve virar campo cadastral

| Campo | Derivável de | Decisão | Razão |
|---|---|---|---|
| `potencia_aparente_kva` | `potencia_kw` ÷ `fator_potencia` | **derivar, não armazenar** | `fator_potencia` está 0/52 e é tipicamente ">0.99"; armazenar o kVA cria divergência com a potência ativa sem ganho de precisão |
| `tipo_topologia` | fabricante/modelo + envelope elétrico | **derivar em leitura** | derivação já é determinística e cobre 52/52; persistir congela uma classificação que melhora com o código |
| `entradas_por_mppt` | `strings_por_mppt` + `n_mppts` | **derivar, permitir override** | MPPTs desiguais (ex. `3/3/2/2`) exigem override manual; derivação cobre o caso uniforme |
| `tensao_nominal_v` | `fases` | **derivar (D)** | já é; nunca persistir |
| `entradas` (micro) | ✘ não derivável | **cadastrar** | é dado de fábrica; nenhuma fórmula o produz |
| `modulos_por_entrada` | ✘ não derivável | **cadastrar** | idem |
| `oversizing_max` | ✘ não derivável | **cadastrar** | limite do fabricante; qualquer default fabrica o limite (F2 já provou) |
| `corrente_max_entrada` | ✘ **nunca** de `corrente_max_por_mppt × n_mppts` | **cadastrar** | classe de erro que a F8 removeu |

**Critério aplicado:** deriva-se quando a fórmula é exata **e** os insumos têm cobertura maior que o alvo. `potencia_aparente_kva` passa (kW tem 47/52); `corrente_max_entrada` não passa (não há fórmula exata).

---

## 7. `subtipo` — parecer

1. **É dado primário?** Não. É classificação, não medição.
2. **É derivável?** Sim, integralmente — `classificarTopologiaInversor` cobre 52/52 e acerta os 16 MICRO que `subtipo` não registra.
3. **Fonte da classificação:** precedência campo explícito → `subtipo` → padrão fabricante/modelo → indício de bateria → queda elétrica → `STRING`.
4. **Onde persistir:** em lugar nenhum como `subtipo`. `tipo_topologia` já é gravado por `normalizarMulti` como *snapshot* da derivação — mas o valor de verdade é a função, não o campo.
5. **Quem deve consumir:** `Inversores.jsx` (badge e gate do cabo tronco), `fichaTecnicaMap`, `catalogoQualidade.tipo_inversor` — todos hoje leem `subtipo` e recebem `null`.

**Decisão: remover `subtipo` do vocabulário.** Causa raiz do 0/52 identificada: `normalizarMulti` grava `subtipo` (linha 77) mas o **prompt de extração nunca o pede** — o extrator não tem como devolvê-lo.

---

## 8. AUDITORIA DE DEFAULTS — nenhum removido nesta etapa

| # | Default | Local | Classe | Altera resultado elétrico? | Cobertura |
|---|---|---|---|:--:|---:|
| D1 | `fases ?? 1` | `extrairSpecsInversor:87` | **default inválido** | **SIM** — define `tensao_nominal_v` (380/220), polos do disjuntor e dimensionamento CA | **12/52** |
| D2 | `potencia_kw ?? 0` | `paraDimensionamento` | **default inválido** | **SIM** — divisor do DC/AC ratio | 5/52 |
| D3 | `tensao_nominal_v = fases===3 ? 380 : 220` | `paraDimensionamento` | aproximação de engenharia | SIM (acessórios CA) | 40/52 |
| D4 | `eficiencia_pct \|\| 97` | `extrairSpecsInversor:94` | aproximação de engenharia | não (só relatório) | **19/52** |
| D5 | `tipo \|\| 'string'` | `extrairSpecsInversor:95` | fallback de compatibilidade | não | **52/52** |
| D6 | `tensao_partida = tensao_mppt_min : 200` | `engineeringFallback` (ATIVA) | **default de segurança declarado** | não (runtime, com proveniência) | 23/52 |
| D7 | `fases ?? 1` | `catalogoEngenhariaAdapter:95` | fallback de UI (documentado) | não (só agrupa vitrine) | 12/52 |
| D8 | `garantia ?? 12 / 25 / 5`, `percentualPerformance ?? 80` | `catalogoEngenhariaAdapter` | aproximação comercial | não | alta |
| D9 | `FATOR_TEMPERATURA_VOC = 1.15` | `compatibilidadeFV:21` | aproximação de engenharia | **SIM** — substitui `coef_temp_voc` real | 52/52 |
| D10 | `Math.ceil(mppt_min_v / vmpp \|\| 1)` | `compatibilidadeFV:166` | **precedência incorreta** | **SIM** — `\|\|` aplica ao resultado da divisão, não ao divisor | latente |
| D11 | 7 regras `ativa:false` | `engineeringFallback` | desligadas | não | — |

**Prioridade de remoção (execução futura, não agora):** D1 → D2 → D10 → D9. D6 é legítimo (runtime, proveniência, não grava). D5 deixa de existir quando `subtipo` sair.

---

## 9. PROPOSTA — `CAMPOS_INVERSOR_CANONICO` (não implementar)

Extensão do `CAMPOS_INVERSOR` atual: mesmos nomes e aliases, **mais** os metadados que hoje vivem espalhados nas listas 2, 3, 4, 7, 8 e 9. Uma entrada por campo; as demais listas passam a ser **projeções** dela.

```
campo                  tipo    unid  origem      obrigatorio          editavel exibivel  consumido_por                         derivado_de                validacao
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
potencia_kw            number  kW    datasheet   sempre               sim      sim       montarStrings·oversizing·score        —                          > 0 e <= 600
fases                  enum    —     datasheet   sempre               sim      sim       montarStrings·avisoDeFase·cabo CA     —                          1 | 2 | 3
n_mppts                int     —     datasheet   topologia=STRING     sim      sim       montarStrings·topologia MPPT·score    —                          >= 1
tensao_max_entrada     number  V     datasheet   topologia=STRING     sim      sim       montarStrings·classificarTensaoCC     —                          100..1500
tensao_mppt_min        number  V     datasheet   topologia=STRING     sim      sim       montarStrings·classificarTensaoCC     —                          > 0 e < mppt_max
tensao_mppt_max        number  V     datasheet   topologia=STRING     sim      sim       montarStrings·classificarTensaoCC     —                          <= tensao_max_entrada
corrente_isc_max       number  A     datasheet   topologia=STRING     sim      sim       montarStrings·classificarCorrenteCC   —                          >= corrente_max_por_mppt
corrente_max_por_mppt  number  A     datasheet   recomendado          sim      sim       classificarCorrenteCC                 —                          > 0
corrente_max_entrada   number  A     datasheet   opcional             sim      sim       CORRENTE_ENTRADA_TOTAL_EXCEDIDA       — (NUNCA de imppt×n)       > corrente_max_por_mppt
entradas               int     —     datasheet   topologia=MICRO      sim      sim       montarModeloMicro                     —                          >= 1
modulos_por_entrada    int     —     datasheet   topologia=MICRO      sim      sim       montarModeloMicro                     —                          >= 1
oversizing_max         number  ×     datasheet   topologia=MICRO      sim      sim       classificarOversizing                 —                          1.0..1.5
max_por_cabo_tronco    int     —     datasheet   topologia=MICRO      sim      sim       cabo tronco·regrasMicroFabricante     —                          >= 1
tipo_topologia         enum    —     derivado    nunca (derivado)     override sim       toda a cadeia                         fabricante+modelo+envelope  STRING|MICRO|HYBRID|OTIMIZADOR
entradas_por_mppt      int[]   —     derivado    nunca (derivado)     override sim       topologia MPPT·capacidade             strings_por_mppt + n_mppts  soma >= 1
potencia_aparente_kva  number  kVA   derivado    nunca (derivado)     nao      sim       —                                     potencia_kw / fator_potencia  > potencia_kw
tensao_ac              number  V     datasheet   recomendado          sim      sim       tensao_nominal_v·plausibilidade       —                          > 0
corrente_ac_saida      number  A     datasheet   topologia=MICRO      sim      sim       correnteDoRamal·cabo CA               —                          > 0
tensao_partida         number  V     datasheet   opcional             sim      sim       engineeringFallback                   —                          <= tensao_mppt_min
eficiencia_maxima      number  %     datasheet   recomendado          sim      sim       score·relatório                       —                          90..100
certificacoes          string[] —    datasheet   recomendado          sim      SIM(novo)  homologação                          —                          —
[demais classe C]      —       —     datasheet   nao                  nao      sim       —                                     —                          —
```

**Regra de obrigatoriedade condicional:** o campo é obrigatório **conforme a topologia**, não universalmente. É o que `utilizavelProjeto` já faz (`INVERSOR_COMUM` + `INVERSOR_STRING`) e o que evita barrar os 16 micros por exigir janela MPPT que eles não têm.

---

## 10. PROPOSTA DE MIGRAÇÃO

**Princípio (P0.1):** *o consumidor consome o SSOT; o SSOT não se adapta ao consumidor.* Aplicado aqui: nenhuma lista nova — as 9 existentes viram **projeções** de `CAMPOS_INVERSOR_CANONICO`.

```
                    CAMPOS_INVERSOR_CANONICO
                              │
     ┌──────────┬─────────────┼─────────────┬──────────────┐
  exibivel   editavel    obrigatorio     validacao      origem
     │          │             │              │             │
 SPECS_*    ESQUEMA      utilizavel    validacao      prompt +
 + Ficha    + Modal      Projeto       Eletrica       normalizarMulti
```

| Fase | Ação | Risco | Reversível |
|---|---|---|---|
| M1 | Acrescentar metadados (`tipo`, `unidade`, `obrigatorio`, `editavel`, `exibivel`, `validacao`) a `CAMPOS_INVERSOR`. Ninguém os lê ainda. | nulo | sim |
| M2 | `ESQUEMA.inversor` passa a ser `derivarEditaveis(CAMPOS_INVERSOR_CANONICO)`. Ganha `fases`, `corrente_max_entrada`, `tensao_partida`, `entradas`, `modulos_por_entrada`, `oversizing_max`, `max_por_cabo_tronco`. | baixo | sim |
| M3 | `SPECS_*` e `fichaTecnicaMap` passam a ser `derivarExibiveis(...)`. Elimina as listas 2 e 7. | baixo | sim |
| M4 | `utilizavelProjeto` e `catalogoEngenhariaAdapter` param de ter aliases próprios e leem `valorCampo`. Elimina as listas 8 e 9. | **médio** — muda veredito de `utilizavel_em_projeto` em registros com `potencia_ca` (0/52 hoje ⇒ impacto medido = zero) | sim |
| M5 | `validacaoEletricaInversor` passa a ler por `lerInversor` em vez de chave crua. | baixo | sim |
| M6 | Prompt de extração e `normalizarMulti` ganham `entradas`, `modulos_por_entrada`, `oversizing_max` e **perdem** `subtipo`. | baixo | sim |
| M7 | `tipo_topologia` deixa de ser persistido por `normalizarMulti`; vira derivação pura em leitura. | **médio** — 52/52 têm o valor gravado; passa a ser recalculado | sim |
| M8 | `specs_canonicas` migra para os nomes do SSOT. **Requer backfill** de 106 documentos. | **alto** — único item com migração de banco | com backup |
| M9 | Remover `subtipo` dos 2 gates de `Inversores.jsx` (usar `classificarTopologiaInversor`). | baixo | sim |

**Impacto de dados medido:** M1–M7 e M9 **não tocam o banco**. Só M8 exige migração.

---

## 11. PRÓXIMOS PASSOS ORDENADOS

### P0 — destrava engenharia com dado real
| | Ação | Fecha |
|---|---|---|
| P0-a | M1 + M2 — contrato com metadados e edição derivada dele | `fases` (12), `corrente_max_entrada` (52), `tensao_partida` (23) editáveis |
| P0-b | M6 — produtor ganha o envelope micro | `entradas`/`modulos_por_entrada`/`oversizing_max` deixam de ser classe F |
| P0-c | Campanha de cadastro: `corrente_isc_max` (25), `tensao_mppt_min/max` (15), `n_mppts` (9), `tensao_max_entrada` (8) | leva 36 inversores bloqueados a `ok` em `montarStrings` |
| P0-d | M9 + remoção de `subtipo` | ressuscita badge de topologia e cabo tronco |

### P1 — elimina a divergência estrutural
| | Ação | Fecha |
|---|---|---|
| P1-a | M3 — exibição derivada (elimina listas 2 e 7) | 2 dialetos |
| P1-b | M4 — gate e adapter sem aliases próprios (listas 8 e 9) | 2 dialetos + `potencia_ca` |
| P1-c | M5 — plausibilidade lê por alias | cegueira a alias |
| P1-d | Remover D1 e D2 (`fases ?? 1`, `potencia_kw ?? 0`) — com o cadastro já corrigido pelo P0 | 2 defaults que alteram resultado elétrico |

### P2 — consolidação
| | Ação |
|---|---|
| P2-a | M7 — `tipo_topologia` derivado puro |
| P2-b | M8 — backfill de `specs_canonicas` (única migração de banco) |
| P2-c | D10 (precedência `\|\| 1`) e D9 (ligar `coef_temp_voc` real ao Voc no frio) — **decisão de regra elétrica**, requer aprovação de engenharia |
| P2-d | Envelope de bateria (`tensao_bateria_*`, `corrente_bateria_*`) quando INV-44/45 entrar |

---

## 12. O QUE NÃO FOI FEITO (conforme §10 do escopo)

Nenhuma alteração em `CAMPOS_INVERSOR`, listas de edição/exibição, `ModalNovoInversor`, regras elétricas, `montarStrings`, `coef_temp_voc`, ramo `resto`, cabo tronco, defaults ou geração automática de listas de UI. Nenhuma migração de banco. Nenhum alias novo proposto.
