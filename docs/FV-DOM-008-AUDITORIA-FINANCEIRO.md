# FV-DOM-008 — Auditoria do motor financeiro FV

**Data:** 2026-08-14
**Natureza:** auditoria. Nenhum arquivo de código alterado, nenhuma fórmula corrigida.
**Resultado:** não são dois motores financeiros. São **quatro**, e eles discordam.

---

## Correção da FV-DOM-006

Eu havia registrado, no achado R1:

> *"Não existe equivalente no backend. O único cálculo financeiro do servidor é em `propostaComercialService:43` — um payback simplificado."*

**Está errado.** `backend/src/controllers/engenhariaController.js` tem, desde antes desta sessão:

```
calcularTIR(fluxos)      — bisseção em [−0,99 ; 10], 300 iterações
calcularFluxoCaixa({…})  — 25 anos, VPL com taxa de desconto, payback simples
                           E descontado, ROI 25 anos, fluxo anual detalhado
```

O backend tem **mais** indicadores que o frontend em um aspecto — é o único que calcula **VPL** e **payback descontado**. Só que a rota que o expõe, `POST /api/engenharia/fv`, **não tem um único consumidor no frontend**. É uma engine órfã, exatamente como a de unifilar era antes da FV-DOM-007B.

O padrão se repete: o backend tem o cálculo, ninguém chama, e o frontend faz o seu.

---

## 1 · Inventário classificado

### DOMÍNIO — regra de negócio, deve viver no Core

| Arquivo | Linhas | O que contém |
|---|---|---|
| `frontend/utils/financeiroEngine.js` | 424 | composição de custos, 2 modos de orçamento, margem, financiamento Price, parcelamento, retorno/payback/ROI, TIR por bisseção |
| `frontend/utils/financeiroRegulatorioBR.js` | 269 | **Lei 14.300**: cronograma do Fio B, direito adquirido, custo de disponibilidade, modalidades GD |
| `backend/controllers/engenhariaController.js` (§ financeira) | ~60 | TIR, VPL, payback simples e descontado, fluxo de caixa 25 anos |
| `frontend/utils/comercialEngine.js` | 248 | cenários comerciais comparados |

### ADAPTER — traduz, não decide

| Arquivo | Papel |
|---|---|
| `frontend/utils/engenhariaGovernanca.js:327` | `construirSnapshotFinanceiro` — congela o resultado do motor (não calcula) |
| `frontend/services/calcAutoMatico.js` | monta entrada para seleção automática de kits |

### APRESENTAÇÃO

`CentroFinanceiroFV.jsx` (399) · `SimulacaoFinanceira.jsx` (240) · `PropostaEnterprise.jsx` · `RecomendacaoFinal.jsx` · `gerarPdfComercial.js` · `gerarPropostaPDF.js` · `gerarPdfSimulacao.js` · `PropostaPublica.jsx`

### DADO — indicadores derivados PERSISTIDOS

| Local | Campos |
|---|---|
| `ProjetoFV.orcamento` (v3) | `irr_pct`, `npv_r`, `payback_anos`, `payback_meses`, `economia_25anos_r`, `economia_mensal_r`, `economia_anual_r`, `co2_evitado_t` |
| `ProjetoFV.financeiro` (v2 legado) | `irr_pct`, `npv_r`, `payback_anos`, `geracao_25anos_kwh`, `economia_25anos_r` |
| `ProjetoFV.governanca.snapshot_financeiro` | pacote completo congelado (Mixed) |

**Isto é INV-58 violado no legado**: derivados persistidos como se fossem fatos. O agregado `Orcamento` (FV-DOM-001) **não** persiste indicador nenhum — e agora se entende por quê: nunca houve motor no domínio para derivá-los.

O `snapshot_financeiro` é a exceção legítima, pela mesma razão que a Baseline é: congelar é o ato de transformar derivado em fato.

### LEGADO

`propostaComercialService:43` — payback do PDF · `bessController:47` — payback do BESS · `decisaoController:67` — usa `financeiro?.payback || 8` (default silencioso).

### CÓDIGO MORTO

**Nenhum arquivo financeiro está morto.** Todos os componentes e utilitários auditados têm ao menos um consumidor. A única peça sem uso é a **rota** `POST /api/engenharia/fv` — o código por trás dela está vivo, mas inalcançável pela interface.

---

## 2 · As divergências, medidas

Executei os motores como estão hoje, mesmo caso, sem alterar nada.

### Payback — todos discordam

Investimento e economia anual variando; inflação 8 % a.a., degradação 0,5 % a.a.:

| Investimento | Economia/ano | `financeiroEngine` | `engenhariaController` | `propostaComercialService` |
|---|---|---|---|---|
| R$ 52 000 | R$ 20 580 | **2,39** | 3 | 2,5 |
| R$ 60 000 | R$ 9 000 | **5,60** | 6 | 6,7 |
| R$ 80 000 | R$ 7 000 | **8,56** | 9 | 11,4 |
| R$ 120 000 | R$ 6 000 | **12,68** | 13 | 20,0 |
| R$ 200 000 | R$ 5 000 | **19,21** | 20 | **40,0** |

Duas naturezas de divergência:

1. **Frontend × backend**: 0,3 a 0,8 ano. O frontend interpola a fração do ano; o backend devolve o ano inteiro em que o saldo virou positivo. Ambos defensáveis — mas são números diferentes para a mesma pergunta.

2. **`propostaComercialService`**: divergência estrutural. Ele faz `investimento / (economia × 12)` sem inflação e sem degradação, então **o erro cresce com o payback** — no último caso ele diz **40 anos** onde os outros dizem 19 e 20. É o número que vai no **PDF entregue ao cliente**.

### TIR — os dois erram, de formas diferentes

| Investimento | Economia/ano | `financeiroEngine` | `engenhariaController` |
|---|---|---|---|
| R$ 5 000 | R$ 12 000 | **null** | 247,46 % |
| R$ 2 000 | R$ 12 000 | **null** | 607,46 % |
| R$ 1 000 | R$ 20 000 | **null** | **1000,00 %** |

O frontend busca em `[−0,95 ; 2]`: acima de 200 % a.a. o sinal não inverte e ele devolve `null` — a tela mostra "—" onde havia um retorno altíssimo. O backend busca em `[−0,99 ; 10]` e, no limite, **satura em 1000 %** — devolve o teto do intervalo como se fosse resultado, sem sinalizar que não convergiu.

Nos casos com prejuízo (projeto que não se paga) os dois concordam: −2,27 % e −10,22 %.

### O que NÃO se confirmou

A tolerância do backend (`|NPV| < 0,5`, absoluta em reais, contra `1e-6` do frontend) parecia frágil — uma tolerância em reais deveria afrouxar conforme o fluxo cresce. **Medida, a diferença é de 0,0003 ponto percentual** e não varia com a escala (testei 1×, 10×, 100×, 1000×). É uma fragilidade de forma, não um defeito de resultado. Registro como observação, não como divergência.

### Premissas: a maior sensibilidade não é fórmula, é default

O `financeiroEngine` não tem default de inflação energética — quem chama decide, e a ausência vale 0 %. O backend embute 8 %.

Mesmo projeto (R$ 52 000, 8 000 kWh/ano, tarifa R$ 1,00):

| | Payback | Economia 25 anos |
|---|---|---|
| sem inflação (default do front) | 6,59 anos | R$ 188 447 |
| com 8 % a.a. (default do back) | 5,49 anos | **R$ 540 682** |

**R$ 352 mil de diferença** — quase 3×. Nenhuma fórmula mudou; só a premissa. É por isso que o contrato canônico precisa tornar as premissas **explícitas e versionadas**, não embutidas em default.

---

## 3 · Entradas dos cálculos

| Grandeza | Origem hoje | Problema |
|---|---|---|
| Geração anual (kWh) | snapshot técnico congelado | ✓ correto — o *engineering lock* já é respeitado |
| Potência (Wp) | `snapshotTecnico.sistema.potenciaCC × 1000` | ✓ |
| Tarifa (R$/kWh) | parâmetro do chamador | sem proveniência: não se sabe se veio da fatura, do cadastro ou digitada |
| Reajuste / inflação | parâmetro, default 0 % | ver acima |
| Degradação | default 0,5 % a.a. | consistente entre os dois motores |
| Horizonte | 25 anos | consistente |
| Taxa de desconto | **só o backend** (6 %) | o frontend não desconta — logo não tem VPL |
| Custos (11 campos) | `CAMPOS_CUSTO` | sem equivalente no agregado `Orcamento` |
| Consumo anual | motor regulatório | usado só no cenário Lei 14.300 |

---

## 4 · O que é reutilizável

**Quase tudo.** Ao contrário do unifilar, aqui não há reescrita a fazer:

- `financeiroEngine.js` é **puro e determinístico** (exceto `calculado_em: new Date()`), sem DOM, sem React, sem I/O — move para o pacote compartilhado como está, do mesmo modo que a engenharia normativa;
- `financeiroRegulatorioBR.js` é igualmente puro e é a peça de **maior valor regulatório** — Lei 14.300 não pode viver só no navegador;
- do backend, o que se aproveita é o **conceito** que falta no frontend: taxa de desconto, VPL e payback descontado.

A migração é de **localização e contrato**, não de fórmula.

---

## 5 · Contrato canônico proposto

Espelhando o que funcionou na FV-DOM-007B:

```
premissas + orçamento + snapshot técnico
        ↓
packages/fv-shared/financeiro/   (motor puro, movido — sem alteração de fórmula)
        ↓
backend/src/dominio/financeiro/  (adapter ProjetoFV→entrada + proveniência)
        ↓
POST /api/projetos-fv/:id/financeiro/calcular
        ↓
{ resultado, premissas, proveniencia, lacunas, divergencias }
```

**Princípios:**

1. **Nenhuma fórmula é corrigida nesta migração.** Como no unifilar, a equivalência é provada byte a byte / valor a valor contra o `HEAD` antes de qualquer discussão de mérito. Corrigir e mover ao mesmo tempo torna impossível saber o que quebrou.

2. **Premissas explícitas e versionadas.** Inflação, reajuste, degradação, taxa de desconto e horizonte entram como um objeto `premissas` com proveniência declarada — nunca como default invisível. A diferença de R$ 352 mil acima é o argumento.

3. **Proveniência e lacunas**, como no unifilar: quem consome sabe qual premissa veio do projeto e qual foi assumida.

4. **Não persistir derivados** (INV-58). O cálculo é derivação; o único fato é o `snapshot_financeiro` no congelamento.

5. **TIR com resultado honesto**: `{ valor, convergiu, intervalo }` em vez de `null` mudo (frontend) ou do teto disfarçado de resultado (backend). Isso **não é mudar a fórmula** — é parar de esconder que ela não convergiu.

### Decisões que exigem o usuário — não são minhas

| # | Questão | Por que não decido |
|---|---|---|
| D1 | Payback **fracionário** ou **inteiro**? | Os dois motores discordam há tempo; é convenção comercial da empresa |
| D2 | Adotar **taxa de desconto e VPL** no motor canônico? | Muda o indicador apresentado ao cliente. Hoje o front não desconta |
| D3 | Default de **inflação energética**: 0 % ou 8 %? | Vale R$ 352 mil em 25 anos na proposta |
| D4 | O PDF passa a usar o motor canônico? | Corrige o payback de 40 → 19 anos, mas **muda proposta em produção** |
| D5 | Cenário **otimista × realista (Lei 14.300)**: qual é o oficial? | Hoje o realista vence quando presente — regra comercial, não técnica |

**D4 é o mais delicado**: há propostas já emitidas com o payback simplificado. Corrigir o motor muda números que clientes receberam.

---

## 6 · Ordem recomendada

1. **FV-DOM-009** — mover `financeiroEngine` + `financeiroRegulatorioBR` para o pacote compartilhado, com check de equivalência valor a valor contra o `HEAD`. **Zero mudança de fórmula.**
2. **Decisões D1–D5** com o usuário.
3. **FV-DOM-010** — adapter de domínio + endpoint canônico + proveniência.
4. **FV-UX-017** — aba Financeiro na nova UX, consumindo a API.
5. **Só então** — unificar `propostaComercialService`, `bessController` e `decisaoController` no motor canônico, encerrando os pagamentos paralelos.

---

## Riscos registrados

| # | Risco | Grau |
|---|---|---|
| R1 | `propostaComercialService` entrega payback **até 2× maior** que o motor real, em PDF assinado | **alto** |
| R2 | TIR devolve `null` (front) ou satura em 1000 % (back) sem sinalizar não-convergência | **alto** |
| R3 | Indicadores derivados persistidos em `orcamento`/`financeiro` — INV-58 violado no legado | médio |
| R4 | Lei 14.300 só no navegador: mudança regulatória exige deploy de frontend | médio |
| R5 | `decisaoController` usa `financeiro?.payback \|\| 8` — default silencioso em decisão automatizada | médio |
| R6 | Tarifa sem proveniência: não se sabe se veio da fatura ou foi digitada | médio |

---

**Nenhum arquivo alterado. Nenhuma fórmula corrigida. Nenhum motor apagado. Produção intocada. Sem commit.**
