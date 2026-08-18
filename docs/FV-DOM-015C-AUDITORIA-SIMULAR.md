# FV-DOM-015C — Auditoria de `/api/projeto/simular`

**Data:** 2026-08-16
**Natureza:** auditoria. Nenhum código alterado.
**Resultado:** **PARADA.** O simulador não pode consumir o contrato V1 sem decisão de escopo — os modelos de entrada são incompatíveis.

Pré-condições conferidas: D1, D2, D3 e D4 conforme `FV-ESTADO-COMPACTADO.md` §1. D5 pendente e intocada.

---

## 1 · Mapa de `/api/projeto/simular`

| Aspecto | Situação |
|---|---|
| Rota | `POST /api/projeto/simular` — **sem `protegerModulo`, sem `exigirOrganizacao`** |
| Entrada | **tudo do `req.body`**; nenhum acesso a banco |
| Estado | stateless — não há projeto, tenant nem histórico |
| Consumidor | `SimulacaoFV.jsx` → alimenta `RecomendacaoFinal` → `/api/decisao/recomendar` |
| Dependências externas | nenhuma |

O handler é um orquestrador de 7 blocos independentes (carga, strings, validação, sombreamento, BESS, financeiro, recomendação), cada um em `try/catch` que devolve `null` em falha.

### Bloco financeiro — `simularFinanceiroLocal`

| Item | Valor |
|---|---|
| Entradas | `investimento`, `economia_anual`, `inflacao_energia`, `taxa_desconto` |
| Inflação | default `0.08`; o formulário envia **8 %** |
| Taxa de desconto | default `0.10`; **o formulário envia 6 %** |
| Degradação | **ausente** |
| Horizonte | 25 anos, fixo |
| Payback | **inteiro** — primeiro ano com saldo positivo |
| TIR | bisseção `[−0,99 ; 10]`, 300 iterações, tolerância 0,5 |
| VPL | `saldoDescontado` pela taxa recebida |
| Fluxo de caixa | 25 linhas com valor presente |

### Origem real dos dados — `SimulacaoFV.jsx`

```js
financeiro: {
  investimento: 20000,                                   // ← HARDCODED
  economia_anual: consumoMensal * 12 * tarifaEnergia,    // ← calculado no FRONTEND
  inflacao_energia: form.inflacaoEnergia / 100,          // 8 % (padrão do formulário)
  taxa_desconto: form.taxaDesconto / 100,                // 6 % (padrão do formulário)
}
```

**`investimento: 20000` é um valor fabricado.** Não veio de orçamento, de catálogo nem de entrada do usuário — está escrito no código. Escapou da varredura da FV-DOM-011B porque não é um fallback `||`, é um literal no corpo da requisição.

Toda a simulação financeira apresentada ao usuário parte desse número.

---

## 2 · Comparação indicador a indicador com o contrato V1

| Indicador | `/simular` | Contrato V1 | Divergência |
|---|---|---|---|
| **Payback** | inteiro, sem degradação | **fracionário** oficial + inteiro secundário, degradação 0,5 % | convenção **e** modelo |
| **TIR** | `[−0,99 ; 10]`, tol. 0,5, satura no teto | `[−0,95 ; 2]`, tol. 1e-6, com `convergiu` + motivo | intervalo, precisão, tratamento de falha |
| **VPL** | TMA **6 %** (do formulário) | TMA **10 % nominal**, versionada (D2) | taxa e origem da taxa |
| **Economia** | recebida pronta do frontend | derivada de `geração × tarifa`, com degradação e inflação | **modelo de entrada diferente** |
| **Degradação** | ausente | 0,5 % a.a. | ausente × presente |
| **Inflação** | default 8 % embutido | **premissa obrigatória sem default** (D3) | viola D3 |
| **Geração** | **não existe no modelo** | **entrada obrigatória** | incompatível |

---

## 3 · BESS

### O que `/simular` calcula

`dimensionarBESSLocal(carga_kw, horas_backup)`:

```js
capacidade_kwh = (carga_kw × horas_backup) / 0.8
potencia_kw    = carga_kw
autonomia      = horas_backup
```

**Nenhum indicador financeiro.** É dimensionamento técnico puro — capacidade, potência e autonomia. O `0.8` é profundidade de descarga (DoD), não premissa financeira.

### Onde os indicadores financeiros de BESS existem

Em **outra rota**: `POST /api/bess/dimensionar` (`bessController`), que produz `paybackComBateria`, `investimentoTotal` e economias com fatores `0,2` / `0,4`.

### Achado: a cadeia auditada nunca usa esses indicadores

`SimulacaoFV.jsx:460` envia **`bess: null`** ao `decisaoController`. Portanto as três decisões condicionais lá —

```js
if (bess && bess.paybackComBateria < 12)  → 'BESS viável com retorno rápido'
else if (... < 15)                        → 'BESS com retorno moderado'
else if (bess)                            → 'BESS não é economicamente viável'
```

— **nunca disparam nesta cadeia**. O bloqueio de BESS que reportei na FV-DOM-015B é real como acoplamento de código, mas **inerte em produção neste fluxo**.

### Decisão necessária

Se BESS deve ou não integrar o contrato financeiro canônico continua sendo **decisão de negócio**. Não a tomei. Mas ela **deixou de ser bloqueante para esta cadeia**, porque os indicadores não trafegam por ela.

---

## 4 · Economia estimada

Duas fórmulas distintas, nenhuma no domínio:

| Onde | Fórmula | Fatores |
|---|---|---|
| `SimulacaoFV.jsx` | `consumoMensal × 12 × tarifaEnergia` | tarifa do formulário |
| `decisaoController` (fallback) | `consumoMensal × 12 × 0,95 × 0,3` | **0,95** e **0,3** sem origem |

O `0,95` aparenta ser tarifa presumida em R$/kWh; o `0,3`, uma fração de economia sobre o consumo. **Nenhum dos dois está documentado, e nenhum tem equivalente no contrato V1** — que deriva economia de `geração × tarifa`, com degradação e inflação, e não de consumo.

Conforme instruído, **não substituí por outra fórmula**. A decisão necessária é: a economia do simulador passa a derivar de geração (exigindo geração na entrada), ou permanece como estimativa por consumo com fatores explicitados e versionados?

---

## 5 · Classificação por saída

| Saída | Existe no contrato V1? | Ação | Motivo |
|---|---|---|---|
| **Payback** | sim | **bloqueado** | o contrato precisa de geração; o simulador não a tem |
| **TIR** | sim | **bloqueado** | idem — a TIR do contrato deriva do fluxo, que deriva da geração |
| **VPL** | sim | **bloqueado** | idem; além disso, mudaria a TMA de 6 % para 10 % sem decisão |
| **Fluxo de caixa** | sim | **bloqueado** | idem |
| **Economia anual** | não (modelo diferente) | **bloqueado** | derivada de consumo, não de geração |
| **BESS (dimensionamento)** | não se aplica | **não migrável** | é técnico, não financeiro |
| **BESS (indicadores)** | não | fora desta cadeia | não trafega aqui |
| **Carga, strings, validação, sombreamento, recomendação** | não se aplica | **não migrável** | técnicos |

**Não existe subconjunto seguro.** Os quatro indicadores financeiros são todos derivados do mesmo fluxo de caixa; migrar qualquer um exige a geração, que não está no modelo de entrada. Migrar parcialmente criaria exatamente a segunda verdade que a sprint proíbe — payback do contrato convivendo com economia do simulador.

---

## 6 · Bloqueios

| # | Bloqueio | Natureza |
|---|---|---|
| **B1** | **Modelos de entrada incompatíveis** — o contrato deriva economia de `geração × tarifa`; o simulador **recebe economia pronta** e não conhece geração | escopo/API |
| **B2** | **`investimento: 20000` hardcoded** no frontend alimenta toda a simulação | dado fabricado |
| **B3** | **TMA de 6 %** vinda do formulário × **10 %** de D2 — migrar muda o VPL exibido sem decisão | número ao usuário |
| **B4** | **Inflação com default 8 %** embutido, contra D3 (obrigatória, sem default) | viola decisão já tomada |
| **B5** | **Economia por consumo** (`× 0,95 × 0,3` e `× tarifa`) sem fundamento no domínio | regra de negócio |
| **B6** | Rota **sem guard de tenant** — migrar para o contrato não altera isso, mas convém registrar | segurança |

Qualquer um deles, isolado, já impede a migração. B1 é estrutural: não é ajuste, é outro modelo.

---

## 7 · Decisões necessárias

1. **O simulador passa a receber geração?** Se sim, ele deixa de ser "calculadora de economia" e vira consumidor do modelo canônico — mudança de escopo da tela.
2. **De onde vem o investimento?** Hoje é `20000` no código. Do orçamento canônico exigiria projeto; de entrada do usuário exigiria campo novo.
3. **A TMA da simulação passa a ser 10 %?** Muda o VPL apresentado hoje.
4. **A inflação vira obrigatória também aqui?** D3 diz que sim para o contrato; o simulador tem default 8 %.
5. **A economia por consumo é oficializada** (com fatores explicitados) **ou substituída** por geração × tarifa?
6. **BESS integra o contrato financeiro?** Não bloqueia esta cadeia, mas bloqueia `bessController`.

---

## 8 · Nova ordem sugerida para D4

A ordem anterior (FV-DOM-014 §5) presumia que cada superfície era migrável isoladamente. A auditoria mostra que **duas delas dependem de decisão de escopo antes de qualquer código**:

| Ordem | Superfície | Estado |
|---|---|---|
| 1 | `propostaComercialService` (PDF) | ✅ **concluída** (FV-DOM-015) |
| 2 | `CentroFinanceiroFV` — aba Financeiro FV | **candidata seguinte**: tem projeto, orçamento e snapshot técnico; usa o `financeiroEngine`, que o contrato já compõe |
| 3 | `gerarPropostaPDF` (frontend) | consome o que a aba produzir |
| 4 | `dimensionamentoFV` | tem geração; migrável após decidir D1/D2 sobre payback médio |
| 5 | `/api/projeto/simular` | **bloqueada** — decisões 1 a 5 |
| 6 | `decisaoController` | **bloqueada** — consome (5) |
| 7 | `bessController` | **bloqueada** — decisão 6 |

**Recomendação:** seguir com `CentroFinanceiroFV`. É a única superfície restante que já tem todas as entradas do contrato — projeto, orçamento canônico e snapshot técnico — e não exige nenhuma das seis decisões acima.

---

**Nenhum código alterado. BESS intocado. D5 intocada. Nenhuma fórmula substituta criada. Sem commit.**
