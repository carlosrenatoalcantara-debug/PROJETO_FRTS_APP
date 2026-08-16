# FV-DOM-008A — Contrato canônico financeiro

**Data:** 2026-08-14
**Natureza:** especificação. Nenhum código, banco, UX, endpoint ou PDF alterado.
**Correção da FV-DOM-008:** não são quatro motores. São **seis caminhos**, com **três conjuntos de premissas** e **duas taxas de desconto**.

---

## 0 · O caminho que faltava

A FV-DOM-008 mapeou quatro. Auditando os consumidores dos PDFs, apareceu o quinto — e ele é o que a tela de simulação realmente usa:

**`backend/controllers/projetoController.js:323` — `simularFinanceiroLocal`**, servido por `POST /api/projeto/simular`, consumido por `pages/SimulacaoFV.jsx`.

É o único dos seis que **não aplica degradação** e usa taxa de desconto de **10 %** (contra 6 % do `engenhariaController`). Sua `calcularTIRLocal` é cópia literal da do `engenhariaController` — mesmo intervalo, mesma tolerância, mesmo teto.

O sexto é o motor regulatório (Lei 14.300), que tem premissas próprias.

---

## 1 · Inventário canônico

Caso único para todas as medições: **investimento R$ 80 000 · geração 18 000 kWh/ano · tarifa R$ 0,98** → economia ano 1 = R$ 17 640.

| Motor | Payback | TIR % | VPL R$ | Premissas embutidas |
|---|---|---|---|---|
| `financeiroEngine` (front) | **4,58** | 21,40 | — | inflação **0 %** · degr. 0,5 % · sem desconto |
| `financeiroEngine` + 8 % | 4,05 | 29,29 | — | inflação 8 % · degr. 0,5 % · sem desconto |
| `engenhariaController` | **5** | 29,29 | **412 646** | inflação 8 % · degr. 0,5 % · desconto **6 %** |
| `projetoController /simular` | **5** | 29,83 | **244 499** | inflação 8 % · **sem degradação** · desconto **10 %** |
| `propostaComercialService` (PDF) | **4,5** | — | — | sem inflação · sem degradação |
| `bessController` | **5** | — | — | sem inflação · sem degradação · arredondado |
| `financeiroRegulatorioBR` | **4,79** | 24,41 | — | reajuste **5 %** × inflação **2 %** · Fio B · simult. 30 % |

**Os dois VPL diferem em 69 %** — R$ 412 646 contra R$ 244 499, mesmo projeto. Nenhuma fórmula está errada: um desconta a 6 % com degradação, o outro a 10 % sem. É o custo de premissas implícitas.

**Payback descontado existe em um único motor** (`engenhariaController`: 5 anos).

### Ficha por cálculo

| Cálculo | Implementação | Consumidores | Fórmula | Entradas | Defaults | Unidade | Horizonte | Arredondamento | Diverge | Impacto | Destino |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Payback simples** | `financeiroEngine.calcularRetorno` | CentroFinanceiroFV, snapshot | acumula economia até cobrir investimento, **interpola** a fração do ano | geração, tarifa, preço, reajuste, inflação, degradação | infl. 0 % · degr. 0,5 % | anos | 25 | 2 casas | **sim** | **alto** | preservar como base |
| | `engenhariaController` / `projetoController` | rota órfã / SimulacaoFV | mesmo acúmulo, devolve **ano inteiro** | idem | infl. 8 % | anos | 25 | inteiro | **sim** | **alto** | absorver |
| | `propostaComercialService:43` | PDF comercial | `investimento / (economia × 12)` | investimento, economia mensal | — | anos | — | 1 casa | **sim** | **alto** | substituir |
| | `bessController:48` | análise BESS | `round(investimento / economia)` | idem | — | anos | — | inteiro | **sim** | médio | substituir |
| **Payback descontado** | `engenhariaController` | rota órfã | saldo em valor presente vira positivo | + taxa de desconto | 6 % | anos | 25 | inteiro | — | médio | absorver |
| **VPL** | `engenhariaController` (6 %) · `projetoController` (10 %) | rota órfã / SimulacaoFV | Σ economia/(1+i)^t − investimento | + taxa | **6 % × 10 %** | R$ | 25 | 2 casas | **sim** | **alto** | absorver (D2) |
| **TIR** | `financeiroEngine.calcularTIR` | front | bisseção, `[−0,95 ; 2]`, 200 iter, tol 1e-6 | fluxos | — | % a.a. | 25 | 2 casas | **sim** | **alto** | preservar precisão |
| | `engenhariaController` / `projetoController` | back | bisseção, `[−0,99 ; 10]`, 300 iter, tol 0,5 | fluxos | — | % a.a. | 25 | 2 casas | **sim** | **alto** | absorver faixa |
| **Fluxo de caixa** | `engenhariaController` / `projetoController` | back | ano a ano com VP | economia, inflação, degr., taxa | ver acima | R$/ano | 25 | 2 casas | **sim** | médio | absorver estrutura |
| **Inflação energética** | premissa | todos | `(1+reajuste)(1+inflação)−1` (front/regul.) · `(1+inflação)` (back) | — | **0 % / 8 % / 5 %×2 %** | % a.a. | — | — | **sim** | **alto** | premissa explícita (D3) |
| **Degradação** | premissa | front, back, regulatório | `(1−d)^(ano−1)` | — | 0,5 % — **ausente** no `/simular` | % a.a. | — | — | parcial | médio | premissa explícita |
| **Taxa de desconto** | premissa | só backend | — | — | **6 % / 10 %** | % a.a. | — | — | **sim** | **alto** | premissa (D2) |
| **Financiamento** | `financeiroEngine.calcularFinanciamento` | CentroFinanceiroFV | Price: `i/(1−(1+i)^−n)`; carência capitaliza `pv(1+i)^c` | valor, entrada, parcelas, taxa/mês, carência | carência 0 | R$ | n meses | 2 casas · coef. 6 | **não** | baixo | preservar |
| **Carência** | idem | idem | juros capitalizam antes da 1ª parcela | meses | 0 | meses | — | inteiro | **não** | baixo | preservar |
| **CET** | idem | idem | `((1+i)^12−1)×100` | taxa/mês | — | % a.a. | 12 m | 2 casas | **não** | baixo | preservar |
| **Margem/Wp** | `financeiroEngine.calcularMargem` | CentroFinanceiroFV | `(preço − custo_total) / potência_Wp` | preço, composição, Wp | — | R$/Wp | — | 2 casas | **não** | baixo | preservar |
| **Composição de custos** | `financeiroEngine.composicaoCustos` | idem | CMV (9 itens) + despesas variáveis (comissão, impostos) | 11 campos | 0 por campo | R$ | — | 2 casas | **não** | baixo | preservar |
| **Lei 14.300** | `financeiroRegulatorioBR` | CentroFinanceiroFV, comercialEngine | autoconsumo + compensação − Fio B | geração, consumo, premissas | ver D5 | R$ | 25 | 2 casas | **não** (sem par) | **alto** | preservar e mover |
| **BESS** | `bessController` | rota `/api/bess/dimensionar` | economia = consumo×12×tarifa×**0,2** (sem) / **0,4** (com) | consumo, tarifa, investimento | fatores fixos | R$ | 25 | inteiro | **sim** | médio | substituir |

**Nenhum arquivo financeiro está morto.** A única peça inalcançável é a rota `POST /api/engenharia/fv`.

---

## 2 · Matriz de decisão

### D1 — Payback: fracionário ou inteiro

| | Fracionário (`financeiroEngine`) | Inteiro (`engenhariaController`) |
|---|---|---|
| R$ 80 000 / R$ 7 000 | **8,56 anos** | 9 anos — **+5 meses** |
| R$ 200 000 / R$ 5 000 | **19,21 anos** | 20 anos — **+9 meses** |
| Significado | momento em que o acumulado cruza o investimento | primeiro ano fechado em que já cruzou |
| A favor | precisão; comparável entre propostas | conservador; a economia real é sazonal, não linear dentro do ano |
| Contra | sugere precisão intra-anual que a premissa anual não sustenta | sempre superestima (até 12 meses) |
| Impacto | apresentação e comparação comercial | idem |

O inteiro **nunca subestima**; o fracionário **nunca superestima**. Ambos são defensáveis — é convenção comercial, não questão técnica. Recomendação possível: adotar um e expor o outro como campo secundário, para não perder o conservadorismo.

**Não escolhido aqui.**

### D2 — VPL e taxa de desconto

Mesmo projeto, o VPL varia **69 %** conforme a taxa e a degradação:

| Taxa | Degradação | VPL |
|---|---|---|
| 6 % | 0,5 % | R$ 412 646 |
| 10 % | ausente | R$ 244 499 |

Questões a decidir:

1. **VPL vira indicador oficial?** Hoje ele não aparece na aba Financeiro do FV — só na simulação. Adotá-lo acrescenta um número que o cliente não vê hoje.
2. **Qual taxa (TMA)?** Não existe resposta técnica: é o custo de capital da empresa ou a taxa de referência do cliente. Candidatos observados no código: 6 %, 10 %. Nenhum é justificado por comentário.
3. **Premissa obrigatória?** Sem taxa não há VPL. Se obrigatória, projetos sem ela devolvem `null` com lacuna declarada — nunca um default silencioso.
4. **Versionamento:** a TMA muda com o tempo. O contrato prevê `premissas.versao` + `vigencia`, e o `snapshot_financeiro` congela a que foi usada.

**Não assumida aqui.**

### D3 — Inflação energética

Impacto isolado, mesmo projeto, 25 anos:

| Inflação | Payback | Economia 25 anos |
|---|---|---|
| **0 %** (default do front) | 4,58 | R$ 415 527 |
| 2 % (regulatório) | 4,42 | R$ 529 645 |
| 5 % | 4,22 | R$ 783 457 |
| **8 %** (default do back) | 4,05 | R$ 1 192 205 |

**Entre 0 % e 8 %: 2,9× na economia apresentada ao cliente.** Nenhuma fórmula muda.

| Opção | A favor | Contra |
|---|---|---|
| **Zero** | não promete o que não se sabe; conservador | irreal — a tarifa subiu historicamente |
| **Fixo** | comparabilidade entre propostas | vira default oculto de novo; envelhece |
| **Premissa configurável** (obrigatória, com proveniência) | honesta; auditável; permite cenários | exige decisão de quem preenche |
| **Reajuste × inflação** (modelo do front/regulatório) | separa reajuste tarifário de inflação energética | dois campos para explicar |

Observação factual: o modelo do frontend e o regulatório **compõem** dois fatores (`(1+r)(1+i)−1`); o backend usa **um** só. O contrato precisa fixar qual composição vale.

**Não assumida aqui.**

### D4 — PDFs

| PDF | Onde | Origem dos números | Estado |
|---|---|---|---|
| `propostaComercialService` | backend, `POST /api/proposta/gerar` | **calcula internamente** (payback simplificado) | diverge de todos |
| `gerarPdfComercial` | frontend, `SimulacaoFV` | lê `resultado.financeiro` de `/api/projeto/simular` | **campos não batem** |
| `gerarPropostaPDF` | frontend | lê `retorno`/`comparacao` do `financeiroEngine` | **defaults literais** |
| `gerarPdfSimulacao` | frontend | lê resultado da simulação | herda o motor 5 |
| `gerarPdfOrcamento` | frontend | valores do orçamento | sem cálculo de retorno |

Dois defeitos encontrados ao mapear (registrados, **não corrigidos**):

- **`gerarPdfComercial` lê campos que a API não devolve.** O PDF usa `financeiro.paybackAnos`, `roi25Anos`, `paybackDescontado`, `taxaDesconto`, `economiaAnual`, `custoTotalEstimado`; `/api/projeto/simular` responde `payback`, `tir`, `vpl`, `fluxo_caixa`. Nomes distintos → o PDF imprime `undefined anos` nesses campos.
- **`gerarPropostaPDF.js:26-27` tem defaults literais**: `economiaAnual = 15000, payback = 8.5`. Sem os dados, o PDF **exibe números inventados** como se fossem do projeto. `SimulacaoFV.jsx:160` faz o mesmo com `financeiro?.vpl || 15000`.

A decisão a tomar: **o PDF comercial passa a consumir obrigatoriamente o motor canônico?**

| | A favor | Contra |
|---|---|---|
| **Sim** | um número por projeto; corrige payback de 40 → 19 anos nos casos longos | muda documento entregue a clientes; propostas já emitidas passam a divergir das novas |
| **Não** | preserva o histórico literal | mantém, em documento assinado, o número mais errado do sistema |

**Documentos afetados:** todas as propostas geradas por `POST /api/proposta/gerar`. O levantamento de quantas e quais **exige acesso a produção** e não foi feito — esta sprint não toca produção.

**Nenhum PDF alterado.**

### D5 — Lei 14.300

`financeiroRegulatorioBR.js` (269 linhas) implementa:

| Regra | Conteúdo | Default |
|---|---|---|
| Cronograma Fio B | 2023: 15 % · 2024: 30 % · 2025: 45 % · 2026: 60 % · 2027: 75 % · 2028: 90 % · **2029+: 100 %** | 100 % é escolha conservadora do código, **não** norma |
| Direito adquirido | protocolo < 2023 → Fio B 0 % até **2045** | derivado do ano de instalação |
| Custo de disponibilidade | mono 30 · bi 50 · tri 100 kWh/mês (REN 1.000/2021) | por tipo de ligação |
| Modalidades | GD I (≤500 kW) · GD II (500 kW–1 MW) · GD III (>1 MW, fator 0,9) | GD_I |
| Simultaneidade | fração autoconsumida na hora | **30 %** |
| Fio B em R$/kWh | explícito ou fração da tarifa | **28 %** da tarifa |
| Reajuste / inflação | compostos | **5 % / 2 %** |
| Tarifa | quando ausente | **R$ 0,95** |

**Cenários:** o motor produz `otimista` (compensação integral) e `realista` (Lei 14.300); `compararCenarios` gera o delta. Em `calcularFinanceiroCompleto`, quando o regulatório está ativo o **realista vira a base da visão do cliente** — decisão hoje tomada pelo código, não por regra de negócio escrita.

Neste caso: economia 25 anos otimista R$ 1 192 205 × regulatório R$ 848 828; perda regulatória no ano 1 = R$ 2 041.

**Divergência frontend × backend: nenhuma — porque o backend não tem nada.** Lei 14.300 existe apenas no navegador. Uma mudança de cronograma da ANEEL exige deploy de frontend.

**Defeito registrado:** `calcularRetornoRegulatorio` aceita `geracaoMensalKwh`/`consumoMensalKwh` (sazonalidade) e chama `normalizarPesos`, mas **o resultado (`pesosGer`) nunca é usado** no cálculo. A sazonalidade é documentada e inerte. Não corrigido — corrigir mudaria resultado, e a sprint proíbe.

**Cenário oficial não escolhido aqui.**

---

## 3 · `FinancialCalculationContract v1`

```
FinancialCalculationContract v1
├── contrato_versao        "1.0.0"        — versão do CONTRATO
├── motor_versao           "x.y.z"        — versão do MOTOR que executou
├── calculado_em           ISO-8601 UTC
│
├── premissas                             ← nunca default oculto
│   ├── versao             string         — identifica o conjunto vigente
│   ├── horizonte_anos     int            — sem default; obrigatório
│   ├── reajuste_tarifa_aa_pct     number|null
│   ├── inflacao_energia_aa_pct    number|null
│   ├── composicao_reajuste  'composta'|'simples'    ← D3
│   ├── degradacao_aa_pct  number|null
│   ├── taxa_desconto_aa_pct number|null            ← D2; null ⇒ sem VPL
│   ├── tarifa_kwh         number|null
│   └── convencao_payback  'fracionario'|'inteiro'  ← D1
│
├── entradas
│   ├── investimento_r     number
│   ├── geracao_anual_kwh  number         ← engineering lock: snapshot técnico
│   ├── consumo_anual_kwh  number|null
│   └── potencia_wp        number|null
│
├── fluxo_caixa[]          ano · economia_r · saldo_acumulado_r
│                          · valor_presente_r|null · saldo_descontado_r|null
│
├── payback
│   ├── anos               number|null    — null = não paga no horizonte
│   ├── convencao          espelha a premissa
│   └── dentro_horizonte   bool
├── payback_descontado     { anos|null, dentro_horizonte } | null   ← null sem D2
├── vpl                    { valor_r, taxa_aa_pct } | null          ← null sem D2
│
├── tir
│   ├── valor_aa_pct       number|null
│   ├── convergiu          bool           ← nunca "null mudo" nem teto disfarçado
│   ├── intervalo_busca    [lo, hi]
│   └── motivo             'ok'|'fora_do_intervalo'|'sem_troca_de_sinal'
│
├── margem                 preco · custo_total · bruta_pct · liquida_pct
│                          · lucro_total · lucro_por_wp
├── financiamento          { valor_financiado, entrada, parcelas, taxa_mes_pct,
│                            carencia_meses, coeficiente, parcela, total_pago,
│                            total_juros, cet_aa_pct } | null
│
├── regulatorio                                                     ← D5
│   ├── aplicavel          bool
│   ├── lei                "14.300/2022"
│   ├── premissas          { modalidade, ano_instalacao, grandfathered,
│   │                        fio_b_aplicavel, fator_compensacao,
│   │                        simultaneidade, tarifa_fio_b_kwh, … }
│   ├── cenario_oficial    'otimista'|'realista'                    ← D5
│   ├── otimista           { … }
│   ├── realista           { … }
│   └── comparacao         { diferenca_25_anos, diferenca_pct, … }
│
├── proveniencia           { <campo>: 'caminho.no.projeto' | null }
├── lacunas                [ <campo> ]    — o que o projeto não forneceu
└── arredondamento
    ├── moeda              2 casas, meia-para-cima
    ├── percentual         2 casas
    ├── anos               conforme convencao_payback
    └── coeficiente        6 casas
```

### Regras do contrato

1. **Determinismo** — mesma entrada + mesmas premissas ⇒ mesma saída, bit a bit. `calculado_em` é metadado, nunca entra em cálculo. (Hoje `calcularFinanceiroCompleto` grava `new Date()` no meio do resultado, o que impede comparação direta — a versão canônica isola isso.)
2. **Premissa é dado** — toda premissa aparece em `premissas` com proveniência. Ausente ⇒ `lacunas`, e o indicador que depende dela é `null`. **Nunca um número assumido.**
3. **Reprodutibilidade** — `contrato_versao` + `motor_versao` + `premissas.versao` reconstroem qualquer cálculo histórico.
4. **Não persistir derivados** (INV-58) — exceto `snapshot_financeiro`, onde congelar é o ato que transforma derivado em fato.
5. **Engineering lock preservado** — geração e potência vêm do snapshot técnico, nunca do estado vivo. O `financeiroEngine` já respeita isso; o contrato torna explícito.
6. **Falha honesta** — TIR que não converge devolve `convergiu: false` com motivo. Nem `null` mudo, nem teto de intervalo apresentado como resultado.

---

## 4 · Ordem recomendada

| Sprint | Conteúdo | Depende de |
|---|---|---|
| **D1–D5** | decisões de negócio | — |
| **FV-DOM-009** | mover `financeiroEngine` + `financeiroRegulatorioBR` para `packages/fv-shared/financeiro/`, com check de equivalência valor a valor contra o `HEAD`. **Zero mudança de fórmula.** | nenhuma |
| **FV-DOM-010** | adapter de domínio + `POST /:id/financeiro/calcular` + proveniência, implementando o contrato v1 | D1, D2, D3 |
| **FV-UX-017** | aba Financeiro na nova UX | FV-DOM-010 |
| **FV-DOM-011** | unificar `propostaComercialService`, `projetoController`, `bessController`, `decisaoController` | D4 |

FV-DOM-009 **não depende de nenhuma decisão** — mover sem alterar é seguro e pode começar antes.

---

## 5 · Riscos consolidados

| # | Risco | Grau |
|---|---|---|
| R1 | `propostaComercialService` entrega payback até **2×** maior em PDF assinado | **alto** |
| R2 | TIR: `null` mudo (front) ou saturação em 1000 % (back) sem sinalizar não-convergência | **alto** |
| R3 | **VPL difere 69 %** entre os dois motores que o calculam | **alto** |
| R4 | Premissa de inflação vale **2,9×** na economia apresentada | **alto** |
| R5 | `gerarPropostaPDF` e `SimulacaoFV` têm **defaults literais** (R$ 15 000 · 8,5 anos) exibidos como dado do projeto | **alto** |
| R6 | `gerarPdfComercial` lê campos que a API não devolve → `undefined` no PDF | médio |
| R7 | Lei 14.300 só no navegador; mudança da ANEEL exige deploy de frontend | médio |
| R8 | Derivados persistidos em `orcamento`/`financeiro` — INV-58 violado no legado | médio |
| R9 | `decisaoController` usa `financeiro?.payback \|\| 8` em decisão automatizada | médio |
| R10 | Sazonalidade do motor regulatório é **inerte** (`pesosGer` calculado e não usado) | baixo |
| R11 | `financeiroRegulatorioBR` importa sem extensão — funciona no Vite, quebra em Node ESM puro (relevante ao mover para o pacote) | baixo |

---

**Nenhum código, banco, UX, endpoint ou PDF alterado. Nenhuma fórmula corrigida. Nenhuma premissa assumida. Produção intocada. Sem commit.**
