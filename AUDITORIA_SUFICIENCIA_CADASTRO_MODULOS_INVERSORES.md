# Auditoria de Suficiência do Cadastro Técnico — Módulos e Inversores

**Data:** 2026-09-12 · **Base:** MongoDB Atlas produção (conexão viva) · **Amostra:** 106 equipamentos — **54 módulos**, **52 inversores**
**Método:** leitura do código (schema, SSOT, UI, motores) + medição sobre os dados reais via `lerInversor` / `lerModulo` / `paraDimensionamento` / `dadosEletricos*`.
**Natureza:** somente leitura. Nenhuma alteração de código ou de dados foi feita.

---

## VEREDITO

A suspeita está **CORRETA**, e é mais grave do que enunciada. Três defeitos distintos:

1. **O cadastro armazena menos do que o motor precisa.** Apenas **16 de 52 inversores (31%)** passam pela precondição de `montarStrings`. **49 de 54 módulos (91%)** não declaram o coeficiente térmico de Voc, que é o que decide `SOBRETENSAO_VOC`.
2. **Existem campos exibidos que não podem ser editados.** 9 campos do inversor são exibidos no card expandido e não existem em nenhum formulário. 7 campos que o SSOT consome não são nem exibidos nem editáveis. No módulo, o coeficiente térmico é exibido e não é editável.
3. **Existe um terceiro problema não suspeitado: campo gravado que o motor legado não lê.** `extrairSpecsModulo` devolve `potencia_w = 0` para **54/54 módulos** — o catálogo inteiro.

---

## 1. MODELO REAL

### 1.1 Schema Mongo

`backend/src/models/Equipamento.js` — coleção única `equipamentos`, discriminada por `tipo` (`modulo` | `inversor` | `estrutura` | `bateria` | `carregador_ev`).

Campos tipados no schema: `tipo`, `fabricante`, `modelo`, `garantia_produto{value,unit}`, `garantia_performance{value,unit}`, `datasheet_url`, `preco_sugerido`, `ativo`, mais os blocos aditivos S2.6.1+ (`origem`, `identificacao`, `qualidade`, `status_operacional`, `validacao`, `aprovacao_tecnica`, `documentos_tecnicos`, `certificacao`, `suporte`, `fonte_dados`, `utilizavel_em_projeto`, `bloqueio_engenharia`).

**Todo o dado elétrico vive em `especificacoes`, que é `mongoose.Schema.Types.Mixed`.**

Consequência estrutural: **o schema não declara nem um único campo elétrico**. Não há validação, não há tipo, não há obrigatoriedade, não há lista fechada. O contrato elétrico real do sistema é o dicionário SSOT em `packages/fv-shared/equipamentos/`, que é um contrato de *leitura* — não impede nada na *escrita*.

### 1.2 Backend — o que é aceito

`equipamentosController.atualizarEquipamento` (linha 351): `equipamento.especificacoes = especificacoes; markModified(...)`.

**O backend aceita qualquer chave.** Não há whitelist, não há rejeição, não há normalização no POST/PUT. Logo, **o limite do que pode ser cadastrado é 100% do frontend** — nenhuma restrição é do servidor.

---

## 2. INVERSOR — TABELA DE SUFICIÊNCIA

Cobertura medida em produção sobre os 52 inversores, por campo **canônico** (via `lerInversor`, resolvendo todos os aliases).

| Campo canônico | Persistido | Exibido | Editável | Peso no score |
|---|---:|:---:|:---:|---:|
| `potencia_kw` | 47/52 | ✔ | ✔ | 10 |
| `potencia_maxima_kw` | 47/52 | ✔ | ✔ | |
| `potencia_aparente_kva` | **0/52** | ✔ | ✘ | |
| `tensao_ac` | 12/52 | ✔ | ✔ | 5 |
| `corrente_ac_saida` | 49/52 | ✔ | ✔ | |
| **`fases`** | **40/52** | ✔ | **✘** | **10** |
| `frequencia_hz` | **0/52** | ✔ | ✘ | |
| `n_mppts` | 43/52 | ✔ | ✔ | 10 |
| `strings_por_mppt` | 30/52 | ✔ | ✔ | |
| `tipo_topologia` | 52/52 (derivado) | ✔ | ✔ | |
| `entradas_por_mppt` | 30/52 | ✔ | ✔ | |
| **`entradas`** (micro) | **0/52** | ✘ | **✘** | |
| **`modulos_por_entrada`** (micro) | **0/52** | ✘ | **✘** | |
| **`max_por_cabo_tronco`** | **0/52** | ✔ | **✘** | |
| `tensao_max_entrada` | 44/52 | ✔ | ✔ | 15 |
| `tensao_mppt_min` | 37/52 | ✔ | ✔ | 10 |
| `tensao_mppt_max` | 37/52 | ✔ | ✔ | 10 |
| `corrente_max_por_mppt` | 51/52 | ✔ | ✔ | |
| `corrente_isc_max` | 27/52 | ✔ | ✔ | 10 |
| **`corrente_max_entrada`** | **0/52** | ✔ | **✘** | |
| `tensao_partida` | 29/52 | ✔ | ✘ | |
| `potencia_max_entrada_cc` | **0/52** | ✔ | ✘ | |
| **`oversizing_max`** | **0/52** | ✘ | **✘** | |
| `tensao_bateria_min` / `tensao_bateria_max` | 0/52 | ✘ | ✘ | |
| `corrente_bateria_carga_max` / `..._descarga_max` | 0/52 | ✘ | ✘ | |
| `eficiencia_maxima` | 33/52 | ✔ | ✔ | 5 |
| `eficiencia_europeia` | 24/52 | ✔ | ✘ | |
| `grau_protecao_ip` | 49/52 | ✔ | ✔ | |
| `temperatura_operacao` | 5/52 | ✔ | ✘ | |
| `peso_kg` / `dimensoes` | 49/52 · 46/52 | ✔ | ✔ | |
| `garantia_anos` | 21/52 | ✔ | ✔ | |
| `certificacoes` | 46/52 | ✘ | ✔ | |

### 2.1 Classificação pedida

**PERSISTIDO** — 23 dos 34 campos canônicos têm ao menos um registro. 11 têm **zero** registros em produção.

**DERIVADO (nunca persistido, calculado na leitura):**
- `tipo_topologia` — `classificarTopologiaInversor()`, precedência campo explícito → subtipo → padrão de nome → indício de bateria → queda elétrica → `STRING`. Resultado medido: **36 STRING / 16 MICRO**.
- `entradas_por_mppt` — `normalizarEntradasPorMppt()` deriva de `entradas_por_mppt`, de `strings_por_mppt`, de string `"2/1"`, de número simples ou de `total_entradas_cc`. Persistido bruto: 27/52 (21 array + 6 string); canônico após derivação: 30/52.
- `fases` — `_inferirFases()` aceita número, texto (`/trif|mono/`) e os flags legados `entrada_trifasico` / `entrada_monofasico`.
- `tensao_nominal_v` (em `paraDimensionamento`) — derivada de `fases` (3 → 380 V, senão 220 V).

**EXIBIDO** — 40 rótulos em `Inversores.jsx` (`SPECS_AC` + `SPECS_DC` + `SPECS_EXTRA`).

**EDITÁVEL** — 19 campos, definidos em `packages/fv-shared/ai/camposEquipamento.js::ESQUEMA.inversor`, usados por `EdicaoInversor` (botão ✏) e pelo Assistente de Importação. O modal de *criação manual* (`ModalNovoInversor`) é ainda menor: **6 campos** (`potencia_kw`, `n_mppts`, `entradas_por_mppt`, `tensao_max_entrada`, `corrente_max_por_mppt` + preço).

**CONSUMIDO PELO MOTOR** — dois motores, contratos diferentes:
- Legado (`compatibilidadeFV` → `/api/dimensionamento`): `potencia_kw`, `fases`, `tensao_nominal_v`, `voc_max_dc`, `mppt_min_v`, `mppt_max_v`, `isc_max_mppt`, `n_mppts`, `eficiencia_maxima`, `tipo_topologia`, `entradas_por_mppt`.
- Nova UX (`frontend/src/fv/catalogo.js::eletricoDoInversor` → `classificacao*CC` / `catalogoEletrico`): os mesmos + `corrente_max_entrada`, `oversizing_max`, `entradas`, `modulos_por_entrada`, `max_por_cabo_tronco`.

**NÃO UTILIZADO** — 13 rótulos exibidos no card que **não existem no dicionário SSOT** e não são lidos por motor nenhum: `faixa_tensao_rede`, `tipo_conexao_rede`, `faixa_frequencia_hz`, `fator_potencia`, `thdi`, `tensao_nominal_cc`, `faixa_operacao_cc`, `eficiencia_cec`, `eficiencia_mppt`, `protecao_sobretensao_dc`, `protecao_sobretensao_ac`, `tipo_refrigeracao`, `comunicacao`. Nenhum tem registro em produção — são rótulos mortos.

---

## 3. MÓDULO — TABELA DE SUFICIÊNCIA

| Campo canônico | Persistido | Exibido | Editável | Consumido |
|---|---:|:---:|:---:|:---:|
| `potencia_w` (grava `potencia_wp`) | 54/54 | ✔ | ✔ | ✔ |
| `voc` | 54/54 | ✔ | ✔ | ✔ |
| `vmpp` (grava `vmp`) | 54/54 | ✔ | ✔ | ✔ |
| `isc` | 54/54 | ✔ | ✔ | ✔ |
| `impp` (grava `imp`) | 54/54 | ✔ | ✔ | ✔ |
| **`coef_temp_voc`** | **5/54** | ✔ | **✘** | ✔ (decide Voc no frio) |
| **`temp_noct`** | **0/54** | ✘ | **✘** | ✔ |
| `eficiencia` | 53/54 | ✔ | ✘ | só motor legado (valor descartado) |
| `coef_temp_pmax` / `coef_temp_isc` | 5/54 | ✔ | ✘ | ✘ |
| `celulas` | 5/54 | ✘ (ver 3.2) | ✘ | ✘ |
| `tipo_celula` / `dimensoes` / `peso_kg` | 5/54 | ✔ | ✘ | ✘ |
| `tensao_max_sistema` / `fusivel_serie_max` | 5/54 | ✔ | ✘ | ✘ |
| `bifacial` | 3/54 | — | ✘ | ✘ |
| `largura_mm` / `altura_mm` | **0/54** | ✘ | ✘ | ✔ (motor legado) |

### 3.1 O formulário de módulo não usa o esquema SSOT

`Modulos.jsx` **não importa** `camposEquipamento`. A edição abre `ModalNovoModulo`, que renderiza **5 campos elétricos fixos**: `potencia_wp`, `voc`, `vmp`, `isc`, `imp`. O `ESQUEMA.modulo` (13 campos, com `eficiencia`, `tipo_celula`, `num_celulas`, `dimensoes`…) existe no pacote e **não é consumido por nenhuma tela de módulo** — só pelo Assistente de Importação.

Resultado: **não há caminho na UI para informar o coeficiente térmico de Voc de um módulo.** Os 5 módulos que o têm vieram de datasheet; os outros 49 são incorrigíveis pela interface.

### 3.2 Divergência de chave: `celulas` vs `num_celulas`

O banco grava `especificacoes.celulas` (5/54). `Modulos.jsx` exibe `e.num_celulas` (**0/54**) e o `ESQUEMA.modulo` também usa `num_celulas`. O rótulo "Nº de células" está sempre vazio, inclusive nos 5 módulos que têm o dado.

---

## 4. DEFEITOS CONFIRMADOS, POR SEVERIDADE

### 🔴 D1 — `extrairSpecsModulo` ignora `potencia_wp`: potência do array = 0 para o catálogo inteiro

`backend/src/services/compatibilidadeFV.js:61`

```js
potencia_w: equipamento.potencia_w || esp.potencia_w || esp.potencia || 0,
```

Os 54 módulos gravam `especificacoes.potencia_wp` — **100% deles** — e nenhum grava as três grafias lidas. O SSOT `CAMPOS_MODULO.potencia_w` já lista `potencia_wp` em primeiro lugar; **este leitor não usa o SSOT**.

Medido: `potencia_w === 0` em **54/54**. Efeito em `compatibilidadeFV.js:211`:
`potencia_array_w = n_serie × n_paralelo × 0 = 0` → DC/AC ratio 0 → toda a validação de potência do motor legado opera sobre zero. É a causa exata do sintoma "24 módulos, Potência CC real: 0 kWp".

**Correção:** trocar por `potenciaDoModulo(equipamento)` do SSOT.

### 🔴 D2 — 36 de 52 inversores são inutilizáveis para dimensionamento, e parte do que falta não é digitável

`montarStrings` com 24 módulos reais contra cada inversor do catálogo:

```
ok = 16      bloqueado por INVERSOR_SEM_SPECS = 36      total = 52
```

Lacunas que produzem o bloqueio: `corrente_isc_max` (25), `tensao_mppt_min` (15), `tensao_mppt_max` (15), `n_mppts` (9), `tensao_max_entrada` (8). Estas **são** editáveis — é lacuna de dados, resolvível por cadastro.

Mas os **16 microinversores** têm lacunas próprias que **não são editáveis em lugar nenhum**: `entradas` (16/16), `modulos_por_entrada` (16/16), `oversizing_max` (16/16). O envelope CC do microinversor é 0% preenchido e 0% preenchível.

### 🔴 D3 — `corrente_max_entrada`: critério ligado no motor, impossível de alimentar

A F10 conectou `CORRENTE_ENTRADA_TOTAL_EXCEDIDA` ao dicionário. Cobertura: **0/52**. O campo é **exibido** no card ("Corrente máx. entrada DC") e **não está no `ESQUEMA.inversor`**. O critério permanece `nao_avaliado` permanentemente — não por escolha de engenharia, mas por falta de campo de entrada.

Mesma classe: `oversizing_max` (0/52, consumido por `classificarOversizing`, não exibido, não editável).

### 🟠 D4 — `fases` é consumido, pesa 10 no score, e não é editável

40/52 têm. Os 12 restantes não podem ser corrigidos pela UI. `fases` alimenta: `extrairSpecsInversor.fases`, `tensao_nominal_v` (380/220), `inversorDoCatalogo`, `avisoDeFase` (compatibilidade com a ligação da instalação) e o dimensionamento CA (`polos`: Tripolar/Bipolar) em `Inversores.jsx`. É exibido no card e no resumo da linha.

### 🟠 D5 — `subtipo` está morto: 0/52, e duas funcionalidades dependem dele

`Inversores.jsx` usa `espec.subtipo` para (a) o badge "Microinversor"/"String" e (b) a gate do bloco **cabo tronco** em `DimensionamentoEletrico` (`espec.subtipo === 'microinversor' && espec.max_por_cabo_tronco`).

Medido: `subtipo` = **0/52**, `max_por_cabo_tronco` = **0/52**. Os dois gates falham sempre. O badge nunca aparece e o dimensionamento de cabo tronco nunca roda — apesar de o SSOT classificar **16 MICRO** corretamente via `classificarTopologiaInversor`. A tela ignora o classificador canônico e consulta um campo que ninguém grava.

### 🟠 D6 — `coef_temp_voc` do módulo: 5/54, sem campo de entrada

`lacunasDoModulo` acusa `modulo.coef_temp_voc` em **49/54**. É o parâmetro que decide o Voc no frio e, portanto, `SOBRETENSAO_VOC`. Está exibido no card expandido e não existe em formulário nenhum.

No motor legado o efeito é pior que lacuna: `compatibilidadeFV.js:67` substitui a ausência por `-0.27` (**50/54 caem no default**) — e depois **nem usa o valor**: `montarStrings` aplica a constante fixa `FATOR_TEMPERATURA_VOC = 1.15`. O coeficiente é extraído, defaultado e descartado.

### 🟡 D7 — defaults geométricos fabricados no motor legado

`compatibilidadeFV.js:68-69`: `largura_mm ?? 1134`, `altura_mm ?? 2278`. Cobertura real: **0/54**. Toda área/layout calculada por esse caminho usa um módulo imaginário de 1134×2278 mm, em 100% dos casos, sem aviso.

### 🟡 D8 — envelope elétrico ausente em 15 inversores na nova UX

`dadosEletricosInversor` só monta o envelope quando `tensao_max_entrada && corrente_max_mppt && mppt_min != null && mppt_max`. Medido: **37/52** montam; 15 devolvem `null` — sem envelope, os classificadores de tensão/corrente CC não têm contra o que comparar.

### 🟡 D9 — 13 rótulos mortos no card do inversor

Ver §2.1 "NÃO UTILIZADO". Ocupam espaço na tela, sugerem que o dado existe, nunca renderizam (`SpecGroup` filtra por `!= null`), e nenhum motor os lê.

---

## 5. RESPOSTA DIRETA ÀS DUAS PERGUNTAS

**"O cadastro de inversores armazena menos do que o Motor Elétrico necessita?"**
Sim. O motor precisa de 11 a 16 campos canônicos; o catálogo entrega os 5 críticos completos em apenas **16/52**. Para os 16 microinversores, o envelope CC exigido (`entradas`, `modulos_por_entrada`, `oversizing_max`) está em **0%**.

**"Existem informações exibidas em 'Atualizar manualmente' que não podem ser ajustadas manualmente?"**
Sim, e a formulação exata é mais forte: **o que é exibido e o que é editável são duas listas diferentes, montadas em arquivos diferentes, e ninguém as concilia.**

- Exibidos e **não** editáveis (inversor): `fases`, `corrente_max_entrada`, `max_por_cabo_tronco`, `tensao_partida`, `potencia_max_entrada_cc`, `potencia_aparente_kva`, `frequencia_hz`, `eficiencia_europeia`, `temperatura_operacao`.
- Consumidos pelo motor e **nem exibidos nem editáveis**: `entradas`, `modulos_por_entrada`, `oversizing_max` (+ os 4 campos de bateria do inversor híbrido).
- Módulo: `coef_temp_voc` (exibido, consumido, não editável) e `temp_noct` (consumido, nem exibido nem editável).

**Causa raiz:** existem **quatro** listas de campos independentes e nenhuma é derivada das outras —

| Lista | Arquivo | Campos |
|---|---|---:|
| SSOT de leitura | `equipamentos/inversores/dicionarioInversor.js` | 34 |
| Exibição | `pages/Inversores.jsx` (`SPECS_AC/DC/EXTRA`) | 40 |
| Edição | `fv-shared/ai/camposEquipamento.js` (`ESQUEMA.inversor`) | 19 |
| Criação manual | `ModalNovoInversor.jsx` | 6 |

É a mesma classe de defeito que a P0-INV-SSOT-01 eliminou do lado da *leitura*, ainda intacta do lado da *escrita e da exibição*.

---

## 6. CORREÇÕES, EM ORDEM DE RETORNO

| # | Ação | Esforço | Efeito |
|---|---|---|---|
| 1 | `extrairSpecsModulo` → usar `potenciaDoModulo`/`lerModulo` do SSOT | 1 linha | destrava potência de array para 54/54 módulos (D1) |
| 2 | Derivar `ESQUEMA.inversor` de `CAMPOS_INVERSOR` (toda chave do SSOT vira editável) | pequeno | fecha D3, D4 e a metade não-micro de D2 |
| 3 | Acrescentar `coef_temp_voc`, `temp_noct`, `eficiencia` ao formulário de módulo; `Modulos.jsx` passar a usar `classificarCampos` | pequeno | fecha D6 e corrige `celulas`/`num_celulas` (§3.2) |
| 4 | Acrescentar `entradas`, `modulos_por_entrada`, `oversizing_max`, `max_por_cabo_tronco` ao esquema de edição | pequeno | torna os 16 microinversores dimensionáveis (D2) |
| 5 | `Inversores.jsx`: trocar `espec.subtipo` por `classificarTopologiaInversor` nos dois gates | pequeno | ressuscita badge e cabo tronco (D5) |
| 6 | Derivar `SPECS_*` de `CAMPOS_INVERSOR`; remover os 13 rótulos mortos | médio | elimina D9 e impede a divergência de reaparecer |
| 7 | Campanha de cadastro: `corrente_isc_max` (25), `tensao_mppt_min/max` (15), `n_mppts` (9), `tensao_max_entrada` (8) | dados | leva os 36 bloqueados a `ok` em `montarStrings` |
| 8 | Decidir `largura_mm`/`altura_mm`: ou campo de cadastro, ou lacuna declarada — nunca 1134×2278 silencioso | pequeno | fecha D7 |
