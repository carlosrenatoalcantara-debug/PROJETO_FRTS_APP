# P0-FV-WORKFLOW-ARCHITECTURE-REVIEW-01 — RCA e Proposta Arquitetural

**Status:** FASE 0–4 concluídas. NADA IMPLEMENTADO.
**Base:** leitura do código em 2026-07-14. Nenhuma execução de runtime.

---

## FASE 0 — RCA

### Causa raiz única

O sistema **permite que dado derivado seja digitado**. Toda a classe de bugs do FV nasce daí.

Evidências no código, não hipóteses:

| Dado | Deveria vir de | Hoje vem de | Consequência observada |
|---|---|---|---|
| Potência do módulo | modelo do catálogo | `dimensionamento.potenciaPainelW = 550` (constante `PAINEL_REF_W` do E5) | PDF imprime "354 painéis de 550 W" ao lado de "157,53 kWp" — só fecha com 445 W |
| Capacidade do inversor | modelo do catálogo | `capacidadeInversorKW = 5` (default do contexto) | idem, no PDF |
| Nº de módulos / inversores | arranjos (E7) | era `dim` do E5 até o fix BUG-E8-01 | exigiu criar `agregarArranjosFV.js` só para reconciliar |
| Voc / Vmpp / Isc / NOCT | datasheet | fallback `voc || 49.5`, `nMppts || 1`, `numPaineis ?? 6` | `montarModeloEletrico` **inventa um sistema** quando falta dado |

O `agregarArranjosFV.js` não é uma feature. É uma **cicatriz**: existe apenas porque há duas fontes de verdade para o mesmo número.

### Causa raiz secundária: dois modelos de dados para a mesma entidade

- **Arranjo A** vive em `state.equipamentos = { painel, inversor, estrutura }` — objetos **singulares**, e conta **sempre exatamente 1 inversor** (`invA = equipamentos.inversor ? 1 : 0`, `agregarArranjosFV.js:35`).
- **Arranjos B, C…** vivem em `state.arranjos[]` com `paineis[]` / `inversores[]` — **arrays com quantidade**.

São duas representações incompatíveis da mesma coisa. Todo consumidor (E8, PDF, unifilar, memorial, snapshot) precisa saber disso e reconciliar. Cada novo consumidor é uma chance nova de errar. Já errou uma vez (BUG-E8-01).

Pior: o contexto ainda carrega um **terceiro** shape morto — `novoArranjoVazio()` cria `{painel, inversor, quantidadeModulos}` (singular) e as actions `ADD_ARRANJO`/`SET_ARRANJO` operam nele. Ninguém as dispara hoje. Quem disparar vai ver o E8 contar zero módulos naquele arranjo.

### Causa raiz terciária: a engenharia elétrica roda antes de existir arranjo

`montarModeloEletrico` é chamado com o que houver na mão, e completa o resto com defaults. Um cálculo normativo que aceita default silencioso não é cálculo normativo — é decoração.

---

## FASE 1 — Fluxo atual × fluxo proposto

### O fluxo proposto é superior. Por arquitetura, não por gosto.

Ele impõe um invariante que o atual não tem: **potência nunca é digitada; é sempre derivada do modelo**. Isso não melhora a UX — isso **elimina a classe inteira de bug da tabela acima**, incluindo os que já estão em produção.

Ganhos concretos:

1. **Mata `agregarArranjosFV.js`.** Se Arranjo A é igual a B e C, não há o que agregar — só somar.
2. **Mata os defaults de invenção.** Modelo escolhido → Voc, Vmpp, Isc, coef. térmico, NOCT, nº de MPPTs vêm todos do catálogo. Sem modelo → o sistema **bloqueia**, não chuta.
3. **Ordena a dependência real.** Engenharia elétrica é função do arranjo. Estrutura é função do arranjo. Orçamento é função dos três. O fluxo proposto respeita o grafo de dependência; o atual o viola.
4. **O orçamento nasce pronto.** Hoje o E8 é um formulário de digitação paralelo ao projeto.

### Perdas de funcionalidade — existem duas, e uma é séria

**PERDA 1 (séria) — o modo Kit.** Hoje o operador orça um kit fechado do fornecedor **sem selecionar equipamento nenhum**: digita "Aldo, R$ 45.000" e segue. É o modo **padrão** do E8 (`modoOrcamento = 'kit'`). No fluxo proposto, o orçamento deriva dos arranjos → **se o kit do distribuidor tiver modelos que não estão no catálogo, o fluxo trava**.

Isso não é detalhe. É o caminho comercial mais usado. Precisa de decisão explícita:

- **(a)** Kit obriga cadastro dos modelos no catálogo (rigor total, atrito alto no comercial); ou
- **(b)** Kit permanece como caminho comercial paralelo, **desacoplado da engenharia** — orça, mas não gera unifilar/memorial/ART até os modelos existirem.

**Recomendação: (b).** Amarrar a venda à completude do catálogo vai fazer o comercial contornar o sistema. Mas o kit precisa ser marcado como `engenharia_pendente` e **não pode** produzir documento técnico.

**PERDA 2 (menor) — a sugestão de quantidade do pré-dimensionamento.** O E5 hoje sugere nº de módulos. No fluxo proposto a quantidade é digitada. Não perca isso: entregue como **default pré-preenchido e editável**, não como campo vazio.

### Uma correção ao fluxo proposto: a ordem inversor→módulo está certa, mas incompleta

Você propôs: tipo do inversor → marca → modelo → marca do módulo → modelo → quantidade.

Falta um passo obrigatório entre "quantidade" e "engenharia": **como esses módulos se distribuem nas entradas do inversor** (strings × módulos por string, por MPPT). O sistema pode *sugerir* essa distribuição, mas ela precisa ser um dado do arranjo, não uma inferência do motor. Sem ela, Voc_max é indeterminado — porque Voc_max depende de módulos **em série**, não do total.

Hoje isso já é um buraco conhecido (ver `mppt_topology_findings`: a topologia MPPT é contagem, não strings reais). O fluxo proposto é a oportunidade de fechá-lo. Se não fechar agora, você reordena o wizard e mantém o mesmo cálculo elétrico furado.

---

## FASE 2 — Motor FV × Motor EV

### O estado atual é pior do que "dois motores"

Não existem dois motores. Existem **quatro tabelas de condutor divergentes** e **dois geradores de BOM do EV**:

| Arquivo | Tabela | 2,5 mm² | 6 mm² | 16 mm² |
|---|---|---|---|---|
| `frontend/src/utils/engenhariaNormativa.js` (FV) | `TABELA_CABO_NBR5410` | **19,5 A** | **34 A** | **61 A** |
| `frontend/src/services/calculosNBR5410EV.js` (EV) | `tabelaCobre` | **21 A** | **36 A** | **68 A** |
| `backend/src/utils/calculosCarregadorEV.js` (EV) | `TABELA_COBRE_NBR` | 21 A | 36 A | 68 A |
| `backend/src/utils/calculosCarregadorEV.js` (legado, **ainda exportado**) | `TABELA_BITOLAS` | 17,5 A | 34 A | 68 A |

Mesmo cabo. Mesma norma. Três respostas diferentes. O FV e o EV **discordam sobre a ampacidade de um condutor de cobre** — e o EV discorda de si mesmo.

Isso não é dívida técnica de estilo. É **risco normativo**: dois documentos assinados pela mesma empresa, para a mesma bitola, com capacidades diferentes.

Ainda:

- **BOM EV duplicado.** `packages/diagram-engine/adapters/bomEV.js` (motor oficial, com condutores por fase, terminais, luvas) e `backend/src/utils/calculosCarregadorEV.js::gerarListaMaterialesNBRProjeto` (versão antiga, sem terminais, sem condutores por fase). Duas listas de materiais para o mesmo projeto.
- **Motor térmico FV duplicado e divergente.** `montarModeloEletrico` (frontend) usa **NOCT padrão 44 °C**; `compatibilidadeEletricaService.tCelula` (backend) usa **45 °C**. Mesmo cálculo, constantes diferentes.

### Comparação funcional

**1. Cálculos EXATAMENTE iguais (hoje escritos duas vezes):**

- Corrente AC: `I = P / (V · fp)`, `I = P / (√3 · V · fp)`, fp = 0,95. **Idêntico nos dois** (`engenhariaNormativa.calcularCorrenteAC` × `calculosCarregadorEV`).
- Seleção de condutor por ampacidade (Iz ≥ Ib · k) — mesma tabela NBR 5410, só divergem os números por acidente.
- Disjuntor por série comercial.
- DPS AC por tensão do sistema.
- Aterramento.
- **Todo o BOM geométrico**: barras de eletroduto = ceil(L/3), curvas, luvas = barras−1, abraçadeiras 3/barra, bucha+parafuso 4/barra, prensa-cabo, box reto, terminais = nº condutores × 2, perfurantes = nº condutores + 1. **Isso é função de (comprimento, nº de condutores) e de mais nada.** Não tem uma linha de FV ou de EV nele.
- Condutores por sistema: mono = L+N+PE = 3; tri = L1+L2+L3+N+PE = 5.

**2. Exclusivo do FV (física do gerador fotovoltaico):**

- `Voc_max = n · Voc · [1 + coef · (Tmin − 25)]` — coeficiente térmico e temperatura mínima por UF.
- `Vmpp_min` com temperatura de célula via NOCT.
- `Isc_max = Isc · 1,25`.
- Compatibilidade string ↔ MPPT: janela de tensão, entradas por MPPT, corrente máxima por MPPT, oversizing CC/CA.
- DPS **CC** por `Uc ≥ 1,2 · Voc_max`.
- Cabo **CC**: fator 1,25, mínimo 4 mm², temperatura de operação ao sol.
- String fuse.

**3. Exclusivo do EV:**

- Modo de operação 1–4 (NBR IEC 61851-1).
- Tipo de conector (Type 2 / CCS / CHAdeMO).
- DR 30 mA obrigatório, tipo A/B (regra do carregador, não do inversor).
- Fator de carga contínua 1,25 — **na verdade isso é NBR 5410 genérico, não EV**; está no lado errado.
- Gestão de demanda / carga.

**4. Queda de tensão: o FV simplesmente não calcula.**

O EV calcula (ρ = 0,0179, limite 3 %, e **re-seleciona a bitola** se estourar). O FV **não tem uma linha** sobre queda de tensão — nem CC (string→inversor, o trecho mais crítico) nem CA. Grep confirma: zero ocorrências fora do EV.

Isso não é uma diferença arquitetural entre os domínios. É o **FV estar errado**. Um sistema FV com inversor a 40 m do quadro e cabo escolhido só por aquecimento é um projeto subdimensionado, e o software está assinando isso.

**5. Disjuntor do FV está errado por construção.**

`selecionarCabo` devolve `{ secao, imax, disj }` — o disjuntor vem **colado na linha da tabela do cabo**. Ou seja: o FV escolhe o disjuntor **pela bitola**, não pelo critério `Ib ≤ In ≤ Iz`. O EV faz certo (série comercial, margem de 5 %, valida In ≤ Iz). O FV herda o disjuntor de uma tabela.

---

## RESPOSTA À PERGUNTA PRINCIPAL

**Nem "motor próprio por tecnologia", nem "um motor genérico que faz tudo".**

**Arquitetura correta: NÚCLEO ÚNICO + PLUGINS DE TECNOLOGIA.**

A decomposição não é por produto (FV/EV/BESS). É **por física**:

```
┌─────────────────────────────────────────────────────────┐
│ NÚCLEO AC — NBR 5410 (uma implementação, uma tabela)     │
│  corrente(P, V, fases, fp) · ampacidade(Ib, método inst.)│
│  queda de tensão(ρ, L, I, S, V) · disjuntor(Ib≤In≤Iz)    │
│  DR · DPS AC · aterramento                              │
│  → usado por: FV · EV · BESS                            │
├─────────────────────────────────────────────────────────┤
│ NÚCLEO CC — corrente CC · cabo CC · disjuntor/fusível CC│
│  DPS CC · polaridade                                    │
│  → usado por: FV · BESS · EV-DC (hoje nem modelado)     │
├─────────────────────────────────────────────────────────┤
│ NÚCLEO BOM GEOMÉTRICO                                   │
│  f(comprimento, nº condutores) → eletroduto, curvas,    │
│  luvas, abraçadeiras, fixação, terminais, perfurantes,  │
│  prensa-cabo, box reto                                  │
│  → 100% compartilhado. Zero regra de tecnologia.        │
└─────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
   ┌────┴─────┐        ┌─────┴────┐         ┌─────┴────┐
   │PLUGIN FV │        │PLUGIN EV │         │PLUGIN    │
   │Voc/Vmpp  │        │modo 1-4  │         │BESS      │
   │térmicos  │        │conector  │         │C-rate    │
   │string↔   │        │DR 30mA   │         │DoD       │
   │MPPT      │        │gestão de │         │janela V  │
   │oversizing│        │demanda   │         │ilhamento │
   │DPS CC    │        │          │         │backup    │
   └──────────┘        └──────────┘         └──────────┘
```

**Por que isso e não dois motores:** os 4 conflitos de tabela acima já provam que "dois motores" na prática significa "N tabelas divergentes". A duplicação não é teórica — está em produção, e o BUG-017 já foi uma tentativa manual de sincronizar as tabelas na mão. Sincronização manual de constante normativa **sempre** volta a divergir.

**Por que isso e não um motor genérico:** Voc térmico não existe no EV. Modo de operação IEC 61851 não existe no FV. Um motor único com `if (tecnologia === 'fv')` espalhado é a mesma duplicação com roupa nova, mais o custo de acoplar as regressões dos três produtos.

**A prova de que a decomposição é a certa: o BESS.** O BESS não é um caso novo — ele é **núcleo CC + núcleo AC + plugin pequeno**. Bateria tem corrente CC (núcleo CC), inversor híbrido tem saída CA (núcleo AC), o cabo/eletroduto/terminal é geométrico (núcleo BOM). O que é realmente exclusivo do BESS — C-rate, DoD, janela de tensão do banco, lógica de backup — cabe num plugin de algumas centenas de linhas. Se a decomposição estivesse errada, o BESS exigiria um quarto motor. Não exige. **Isso valida o desenho.**

Corolário duro: se você mantiver "motor por tecnologia", o BESS vai nascer com a **quinta** tabela de condutor.

---

## FASE 3 — Arquitetura proposta (desenho, não implementação)

### Pacote `packages/electrical-engine/`

```
packages/electrical-engine/
  core/
    ac.js            corrente, ampacidade, queda de tensão, disjuntor, DR, DPS AC
    dc.js            corrente CC, cabo CC, disjuntor/fusível CC, DPS CC
    tables/
      nbr5410.js     ÚNICA tabela de ampacidade. Método de instalação = parâmetro.
      comerciais.js  série de disjuntores, bitolas comerciais
    bom-geometrico.js  f(comprimento, nº condutores) → infraestrutura + conexões
  plugins/
    fv.js            Voc/Vmpp térmicos, string↔MPPT, oversizing, DPS CC FV
    ev.js            modo 1-4, conector, DR 30mA, gestão de carga
    bess.js          (futuro) C-rate, DoD, janela do banco, ilhamento
  index.js           calcularEngenharia({ tecnologia, circuitos[] })
```

### Contrato de entrada — um circuito é um circuito

O motor não recebe "um projeto FV" nem "um projeto EV". Recebe **circuitos**:

```js
{
  id: 'ca-inversor-quadro',
  corrente: 'ac' | 'dc',
  potencia_kw, tensao_v, fases,
  comprimento_m,              // default 25 m
  metodo_instalacao: 'B1',
  limite_queda_pct: 3,
}
```

Um projeto FV tem N circuitos CC (string→inversor) + M circuitos CA (inversor→quadro).
Um projeto EV tem 1 circuito CA (quadro→carregador).
Um BESS tem circuitos CC (banco→inversor) + CA.

**Mesma função. Mesma tabela. Mesmo BOM.** A tecnologia só entra no plugin que **monta** os circuitos e valida as regras próprias dela.

### Lista de materiais do FV pelo conceito do EV — SIM, com uma correção obrigatória

Conceito: informar distância → motor gera cabo, DPS, disjuntor, DR, conectores, eletroduto, terminações, quadro. Isso **deve** ser adotado no FV. O BOM geométrico já é agnóstico — é copiar zero linha e reusar tudo.

**MAS: o FV precisa de DUAS distâncias, não uma.**

- `distancia_string_inversor_m` (circuito **CC**) — default 20 m
- `distancia_inversor_quadro_m` (circuito **CA**) — default 25 m

Um campo único subestima o cabo CC — que no FV é o trecho mais longo e o mais crítico (é onde a queda de tensão come geração). Se implementar com um campo só, você troca um bug conhecido por um novo.

Materiais exclusivos do FV que o BOM do EV não tem e precisam entrar no plugin: **conector MC4 (2 por string + reserva), string box / stringbox CC, fusível de string, DPS CC, cabo solar 6 mm² (não é cabo PVC comum)**.

---

## FASE 4 — Justificativa de não-convergência

Não aplicável. A convergência é recomendada. Registre-se apenas o limite: **os plugins não convergem e não devem**. Tentar unificar `Voc_max` com `modo de operação IEC 61851` seria um erro simétrico ao atual.

---

## RESPOSTAS OBRIGATÓRIAS

1. **O fluxo proposto é superior?** Sim. Porque impõe "potência sempre derivada do modelo, nunca digitada" — o que elimina a causa raiz de todos os bugs de dado divergente já observados (incluindo o PDF que imprime 550 W com potência de 445 W).

2. **Existe perda de funcionalidade?** Sim, uma real: **o modo Kit** (o modo padrão do orçamento hoje) deixa de funcionar sem catálogo completo. Recomendação: manter kit como caminho comercial paralelo, marcado `engenharia_pendente`, **proibido de gerar documento técnico**. Perda menor: a sugestão automática de quantidade do E5 — preserve como default editável.

3. **Todos os arranjos devem usar exatamente o mesmo componente?** **Sim, obrigatoriamente.** Hoje Arranjo A é `{painel, inversor}` singular com 1 inversor fixo, e B/C são `paineis[]/inversores[]` com quantidade. Essa assimetria é a causa direta do BUG-E8-01 e a única razão de existir o `agregarArranjosFV.js`. Unificar apaga o agregador.

4. **A engenharia elétrica deve acontecer só após os arranjos?** **Sim.** Voc_max, Vmpp_min e MPPT são funções matemáticas do arranjo. Rodar antes força defaults inventados — que é exatamente o que `montarModeloEletrico` faz hoje (`voc || 49.5`, `numPaineis ?? 6`, `nMppts || 1`). Um cálculo normativo com default silencioso não vale a assinatura do RT.

5. **Vale unificar o motor FV e EV?** **Sim, e não é opcional.** Não pela elegância: hoje existem **4 tabelas de ampacidade divergentes** para o mesmo cobre e **2 geradores de BOM do EV**. O produto já se contradiz. Unificar o núcleo é correção de risco normativo, não refactor.

6. **Quais cálculos podem ser compartilhados?** Corrente AC; ampacidade do condutor; queda de tensão; disjuntor (Ib≤In≤Iz); DR; DPS AC; aterramento; e **todo o BOM geométrico** (eletroduto, curvas, luvas, abraçadeiras, fixação, terminais, perfurantes, prensa-cabo, box reto) — que é função apenas de comprimento e nº de condutores.

7. **Quais permanecem exclusivos?** FV: Voc/Vmpp térmicos, Isc×1,25, string↔MPPT, oversizing, DPS CC, cabo solar, fusível de string, MC4. EV: modo 1–4, conector, DR 30 mA, gestão de demanda. BESS: C-rate, DoD, janela do banco, ilhamento.

8. **A lista de materiais do FV deve usar o conceito do EV?** **Sim** — o BOM geométrico já é agnóstico e reusa-se inteiro. **Com uma correção obrigatória:** o FV exige **duas** distâncias (string→inversor CC, default 20 m; inversor→quadro CA, default 25 m). Um campo único subestima o cabo CC.

9. **Melhora a arquitetura para o BESS?** **Sim, e é o teste que valida o desenho.** BESS = núcleo CC + núcleo AC + plugin pequeno. Ele não exige um motor novo. Se a decomposição estivesse errada, exigiria. Mantida a arquitetura atual, o BESS nasce com a quinta tabela de condutor.

10. **Qual sprint executar primeiro?** **Nenhuma das acima.** Ver abaixo.

---

## ORDEM DE EXECUÇÃO

### ANTES DE TUDO — P0 de produção (não é arquitetura, é sangramento)

A auditoria do fluxo de orçamento (mesma sessão) encontrou dois bugs **destrutivos**, já em produção, independentes desta arquitetura:

- O orçamento vive só em `useState` do E8. Voltar uma etapa **zera** o kit digitado.
- Reabrir um projeto salvo monta o E8 zerado; salvar de novo **sobrescreve o orçamento bom no banco com `total_venda_r: 0`**.

Não se refatora arquitetura com um bug que apaga o orçamento do cliente. **Corrija isso primeiro.**

### Depois, nesta ordem — cada passo é pré-requisito do seguinte

**S1 — Modelo único de arranjo.** `arranjos[]` passa a conter TODOS os arranjos, A inclusive, com `paineis[]`/`inversores[]`/quantidade. Remove `state.equipamentos` singular, `novoArranjoVazio()`, `ADD_ARRANJO`, `SET_ARRANJO` e **o `agregarArranjosFV.js` inteiro**. Sem isso, tudo o mais é construído sobre a assimetria.

**S2 — Núcleo elétrico único + colapso das tabelas.** Uma tabela NBR 5410. Um seletor de condutor. Um seletor de disjuntor. Queda de tensão **passa a existir no FV**. Mata as 4 tabelas e o BOM EV duplicado. **Aqui mora o risco de regressão** — ver abaixo.

**S3 — Reordenar o wizard.** Conta → pré-dim → arranjos (com strings/MPPT explícitos) → engenharia → estrutura → orçamento.

**S4 — BOM FV sobre o núcleo.** Duas distâncias, defaults 20 m / 25 m.

**S5 — Orçamento derivado.** Só faz sentido depois de S1–S4.

**S6 — BESS** como plugin. Se S2 estiver certo, é pequeno. Se S2 não acontecer, é um motor novo.

---

## IMPACTO EM MANUTENÇÃO E REGRESSÃO (resposta honesta)

**Manutenção:** hoje, mudar uma constante normativa exige tocar 4 arquivos e torcer. O BUG-017 já foi uma sincronização manual — e a `TABELA_BITOLAS` legada **continuou divergente mesmo assim**. Prova empírica de que sincronização manual não sustenta.

**Regressão: S2 é o passo perigoso, e não vou suavizar.** Colapsar as tabelas **vai mudar resultados numéricos do EV em produção** — porque a tabela do FV e a do EV discordam, e uma das duas está errada. Projetos EV já emitidos podem passar a calcular bitola diferente.

Mitigação obrigatória antes de tocar em S2:
1. Decidir **qual tabela é a correta** (método de instalação B1 vs B2 — isso é decisão de engenharia, não de software; precisa do RT).
2. Congelar os projetos já emitidos por snapshot (a infra de governança/freeze já existe).
3. Rodar o diff numérico sobre a base real antes de trocar (a suíte `bomMateriaisEV.test.js` / `especificacaoBOM.test.js` cobre o EV; **o FV não tem cobertura equivalente** — criar antes, não depois).

Sem o passo 1, S2 troca uma divergência silenciosa por uma mudança silenciosa. Isso seria pior.

---

## CRITÉRIO DE ACEITAÇÃO — atendido

- Proposta arquitetural consolidada para o novo fluxo do FV: **FASE 1 + FASE 3**.
- Resposta técnica sobre o motor: **núcleo único compartilhado (AC + CC + BOM geométrico) com plugins por tecnologia (FV/EV/BESS)** — justificada por 4 tabelas divergentes em produção, 2 BOMs duplicados, 2 motores térmicos com constantes diferentes, e pelo teste do BESS.

**NADA IMPLEMENTADO.**

---

## ADENDO — DECISÕES DE REGISTRO (revisão do RT, 2026-07-15)

O RT revisou a RCA e decidiu. Travado abaixo. Uma decisão permanece aberta (método NBR).

### Travado

| # | Decisão | Detalhe de implementação |
|---|---|---|
| 1 | Tabela de ampacidade **única** | NBR 5410 Tab. 36, **método B1** (condutores unipolares em eletroduto — o que o BOM instala; "cabo em eletroduto"). Coluna por **nº de condutores carregados: 2 (mono) ou 3 (tri)** — as únicas colunas da Tab. 36. **4+ carregados NÃO é coluna:** usa coluna 3c × **fator de agrupamento (Tab. 42)** ou regra do neutro carregado (6.2.5.5). PE nunca conta. Vale para FV, EV, BESS. **Correção crítica:** tabelas atuais (FV/EV) travadas em 3c → super-dimensionam o monofásico. |
| 2 | Motor térmico **único**, **NOCT 44 °C** (conservador) | Mata o 45 °C do `compatibilidadeEletricaService`. Deleta `TABELA_BITOLAS` legada e o `gerarListaMaterialesNBRProjeto` do backend (BOM EV duplicado). |
| 3a | FV **passa a calcular queda de tensão** | ρ=0,0179 Ω·mm²/m, limite 3%, re-seleciona bitola se estourar. Idêntico ao EV. Aplicar aos DOIS circuitos FV (CC e CA). |
| 3c | **Legenda de equivalente em alumínio** | `selecionarCabo(corrente, {material, metodo, nCondutores})` — material vira parâmetro (Cu\|Al), mesma função, tabela Al própria (NBR Tab. 38/39, ~78% do Cu). Cobre = principal; Al = legenda _"alt.: X mm² Al"_. **Al mínimo 16 mm² (NBR 6.2.6)** → todo Cu ≤ 10 mm² mapeia para "16 mm² (mínimo NBR)", não por corrente. **Se Al for material real: re-rodar queda de tensão com ρ_Al=0,0282 e terminais bimetálicos no BOM.** Valores da coluna Al = **dado a preencher da NBR impressa**, não inventar. |
| 3b | Disjuntor FV por **Ib ≤ In ≤ Iz** | Menor comercial ≥ Ib com folga ≥5% (anti-desarme, lado Ib). Teto = maior comercial ≤ Iz (SEM 5% do lado do cabo). `selecionarCabo` deixa de devolver `disj`. **Iz depende de mono/tri (agora B1).** 6 mm²: mono (41 A)→40 A, tri (36 A)→32 A. 10 mm²: mono (57 A)→50 A, tri (50 A)→50 A. 16 mm²: mono (76 A)→63 A, tri (68 A)→63 A. Iz ainda sofre fator de agrupamento quando `circuitos>1`. |
| 6 | BOM FV com **duas distâncias**, ambas default **25 m** | `distancia_cc_string_inversor_m` e `distancia_ca_inversor_quadro_m`. |
| 7 | **Kit** = aglutinação financeira **manual**, paralela | Não deriva engenharia. Marcado `engenharia_pendente`. Proibido de emitir unifilar/memorial/ART até modelos catalogados. |
| 8 | **BESS** na barra lateral **agora** | Item visível, estado "em breve"/desabilitado. Implementação real depois (plugin sobre núcleo CC+AC). |

### Método e nº de condutores carregados — DECIDIDO: B1, coluna dinâmica + agrupamento

**Método B1 travado.** "Tabela única em eletroduto" + condutores unipolares (BOM: L/N/PE separados) = definição de B1. Isto **substitui** o B2 da rodada anterior: B2 pressupõe **cabo multipolar**, que a Forte Solar não instala. (Override disponível: se o RT quiser a coluna B2 por conservadorismo mesmo instalando unipolar, é uma palavra.)

**Coluna por nº de condutores carregados — deriva do sistema, não é escolha:**

- Monofásico → **2** (F + N)
- Trifásico → **3** (L1+L2+L3; neutro equilibrado não conta)
- Bifásico → RT (2 fases = 2; 2F+N com corrente = 3). Default conservador = 3.
- PE **nunca** conta.

**4+ condutores carregados NÃO é coluna** (a Tab. 36 só tem 2c e 3c). É tratado por fator:
- Neutro carregado (harmônicos 3ª ordem > 15%, NBR 6.2.5.5) → conta como carregado.
- Vários circuitos no mesmo eletroduto → **fator de agrupamento (Tab. 42):** 2 circ ×0,80 · 3 ×0,70 · 4 ×0,65 · 5 ×0,60.

**Dois inputs novos no motor (defaults não atrapalham o caso comum):**
- `circuitos_no_eletroduto` — default **1** (fator 1,0)
- `neutro_carregado` — default **não**

**Valores NBR 5410 Tab. 36 (Cu, PVC 70 °C, método B1):**

| Bitola | Mono (2c) | Tri (3c) |
|---|---|---|
| 1,5 | 17,5 | 15,5 |
| 2,5 | 24 | 21 |
| 4 | 32 | 28 |
| 6 | 41 | 36 |
| 10 | 57 | 50 |
| 16 | 76 | 68 |
| 25 | 101 | 89 |

_(Valores a conferir contra a Tab. 36 impressa antes de povoar — mesma disciplina do resto.)_

**S2 desbloqueado quanto à tabela.** Pré-requisito restante = suíte de teste FV antes de mexer no núcleo.

### Ponto 4 — fonte única de verdade + motor FV (resolvido)

O #5 do RT resolve o #4: o operador preenche por arranjo `inversores[{modelo,qtd}]` + `paineis[{modelo,qtd}]` e **nada elétrico é digitado**.

- **Entidade única `Arranjo`** (A/B/C idênticos): `{ inversores:[{modelo_id,qtd}], paineis:[{modelo_id,qtd}] }`.
- **Duas fontes de verdade, ambas catálogo:** inversor (potência CA, nº MPPT, entradas/MPPT, janela de tensão, fases) · placa (Wp, Voc, Vmpp, Isc, coef. térmico, NOCT).
- **Motor FV = função pura** `calcularArranjo(arranjo, catálogos, uf)`. Nunca lê `dimensionamento.potenciaPainelW`. A constante 550 W deixa de ser fonte — vira só default editável de quantidade no pré-dim.
- `agregarArranjosFV.js` é **deletado** (A=B=C → soma, não agregação).

### Ponto 5 — distribuição automática módulos↔MPPT (algoritmo)

Operador digita só quantidade. Sistema distribui:

1. Total de módulos ÷ potência dos inversores → distribuição proporcional das placas por inversor.
2. Por inversor, do catálogo: `nMPPT`, `entradas_por_mppt`.
3. Módulos/string = `floor(Vmax_inversor / Voc_corrigido_Tmin)`, **limitado pela janela do catálogo** — não chutado.
4. Distribui strings entre MPPTs. Sobra → aviso ("N módulos sem entrada"), **não trava**.

**Pré-requisito de DADOS (não de código):** catálogo de inversor precisa de `entradas_por_mppt` e `janela_tensao_mppt`. **Hoje não tem** (ver `fv_certification_catalog_mppt_gap`). Sem isso, a distribuição cai no fallback atual de 16 módulos/string e o cálculo continua estimado. **Este é o gargalo real do #5.** Completar o envelope MPPT do catálogo é pré-requisito da S3.

### Ordem de execução revisada

Inalterada. P0-orçamento (bugs destrutivos) antes de tudo → S1 arranjo único → S2 núcleo elétrico (tabela **B2 decidida**; pré-requisito restante = suíte de teste FV antes de mexer) → S3 wizard + envelope MPPT do catálogo → S4 BOM FV → S5 orçamento derivado → S6 BESS.

**ADENDO NÃO IMPLEMENTADO — apenas decisões e desenho.**
