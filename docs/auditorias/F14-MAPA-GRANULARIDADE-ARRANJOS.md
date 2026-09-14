# MAPA ARQUITETURAL F14 — PROJETO × ARRANJO × MPPT/STRING

**Data:** 2026-09-14 · **Base:** `27cd0bd` (F13) · **Escopo:** auditoria arquitetural.
**Nenhuma alteração funcional de produção. Nenhum documento alterado. `MULTIPLOS_INVERSORES` intacto.**

Alterações deste sprint: um guard novo (`selecaoPosicionalArranjoF14.check.js`), o ponteiro
que substitui a seção fraca do guard da F13, e este documento.

---

## 1. Evidência de multiarranjo

Cinco projetos reais, todos em `proposta` ou `rascunho` — não são fixtures.

| Projeto | Arranjos | Inversores por arranjo | Módulos |
|---|---|---|---|
| Mercado Avelino | 2 | Huawei SUN2000-60KTL-M0 · Solplanet ASW50K-LT-G2 | 225 + 174 = 399 |
| Sistema FV 131.29 kWp | 2 | Huawei 60KTL-M0 · Huawei 50KTL-M0 | 225 + 160 = 385 |
| Sistema FV novo kWp | **3** | Huawei 60K · Huawei 60K · Huawei 50K | 211 + 180 + 174 = 565 |
| Ampliação - Sistema FV novo kWp | 2 | Solis 1P7K-5G · (vazio) | 8 + 0 = 8 |
| Wagner Hoymiles + tcl | 2 | Hoymiles HMS-2250DW-4T ×1 · ×3 | 4 + 12 = 16 |

Quatro dos cinco têm **modelos de inversor diferentes** entre arranjos. O requisito
funcional está comprovado: o negócio já vende sistemas assim.

---

## 2. Modelo atual

```
ProjetoFV
├── dimensionamento            NECESSIDADE        (projeto)   ✔ correto
├── equipamentos
│   ├── paineis[]              array              (projeto)   legado
│   └── inversor               OBJETO ÚNICO       (projeto)   ✘ assimetria
├── arranjos[]                                    (arranjo)   ✔ estrutura pronta
│   ├── id                     F13, único/estável
│   ├── paineis[] / inversores[]                  N por arranjo
│   ├── configuracao_eletrica
│   │   ├── mppts[]            LEGACY isolado (F-04)   0/589 usos
│   │   ├── micros[]           CANÔNICO micro          em uso
│   │   └── compatibilidade    0 escritores, 0 registros
│   ├── dimensionamento        cache por arranjo   sempre null no acervo
│   └── potencia_kwp           derivado
└── engenharia_eletrica        OBJETO ÚNICO       (projeto)   ✘ singular
    ├── arranjo                topologia string do Core — UMA por projeto
    ├── clima_utilizado
    └── compatibilidade        UMA por projeto
```

O schema do **arranjo já suporta** N inversores, N painéis, topologia e compatibilidade
próprios. O que não suporta é o **Core**, que continua lendo de `engenharia_eletrica`
(singular) e de `equipamentos.inversor` (singular).

---

## 3. Matriz de granularidade

| Conceito | Estrutura atual | Granul. atual | Granul. correta | Persistido? | Fonte atual | Consumidores | Risco |
|---|---|---|---|---|---|---|---|
| Necessidade | `dimensionamento.potencia_kwp` | projeto | **projeto** | sim | motor de dimensionamento | `dominio/potencia`, UI | — |
| Composição (comprada) | `arranjos[]` → `totais` | arranjo→agregado | **arranjo + agregado** | derivado | `calcularTotaisProjeto` | potência, orçamento, proposta | atribuição perdida |
| Potência CC | `totais.potencia_total_kwp` | agregado | **arranjo + agregado** | derivado | `potenciaPaineisKwp` (F12) | `compradaDoProjeto` | — |
| Potência CA | `totais.potencia_inversor_total_kw` | agregado | **arranjo + agregado** | derivado | `potenciaInversoresKw` | totais | — |
| Potência instalada | `engenharia_eletrica.arranjo.mppts × Pmpp` | projeto | **arranjo** | derivado | `instaladaDoProjeto` | UI, governança | **alto** |
| Módulo | `arranjos[].paineis[]` + `equipamentos.paineis[]` | ambos | **arranjo** | sim | duplicado | composição, unifilar | duas fontes |
| Inversor | `arranjos[].inversores[]` + `equipamentos.inversor` | ambos | **arranjo** | sim | duplicado, um singular | unifilar, homologação | **alto** |
| Topologia string | `engenharia_eletrica.arranjo` | **projeto** | **arranjo** | sim | singular | potência, unifilar, integridade | **alto** |
| Topologia micro | `arranjos[].configuracao_eletrica.micros[]` | arranjo | **arranjo** | sim | canônico | `dominio/potencia`, unifilar | — ✔ |
| MPPT | `engenharia_eletrica.arranjo.mppts[]` | projeto | **arranjo → MPPT** | sim | singular | unifilar, potência | alto |
| Strings | `mppts[].entradas[].strings[]` | projeto | **MPPT** | sim | singular | unifilar | alto |
| Compatibilidade | `engenharia_eletrica.compatibilidade` | **projeto** | **arranjo + veredito agregado** | sim | singular | integridade, governança | **alto** |
| Clima | `engenharia_eletrica.clima_utilizado` | projeto | **projeto** | sim | por UF/cidade | motor | — ✔ |
| Perdas / irradiância | premissas de dimensionamento | projeto | **projeto** | sim | dimensionamento | motor | — ✔ |
| Orçamento | `composicaoDoProjeto` | agregado | **arranjo + agregado** | derivado | agrupa por modelo | proposta, baseline | atribuição perdida |
| Proposta | `EnvioPropostaService` | agregado + `[0]` | **agregado** | sim | misto | envio | médio |
| Homologação | `find(principal) ?? arranjos[0]` | **um arranjo** | **todos** | documento | seleção posicional | distribuidora | **P1** |
| Unifilar | `equipamentos.inversor` | **um inversor** | **N inversores** | derivado | singular | diagrama | **alto** |
| Unidade consumidora | `fatura_extracao` / cliente | projeto | **projeto** | sim | fatura | homologação | — ✔ |

---

## 4. Consumidores singulares

| Consumidor | Arquivo | Campo | Supõe 1? | O que perde em multiarranjo | Classe | Risco | Sprint |
|---|---|---|---|---|---|---|---|
| Homologação | `controllers/homologacaoController.js:86` | `arranjos` | **sim** | descarta N−1 arranjos do documento | documento | **P1** | F17 |
| Homologação | `controllers/homologacaoController.js:117` | `equipamentos.inversor` | sim | inversor vazio em projeto só-arranjos | documento | P1 | F17 |
| Unifilar (adapter) | `dominio/unifilar/adaptarProjeto.js:73` | `arranjos` | **sim** | desenha um arranjo | Core | alto | F16 |
| Unifilar (adapter) | `dominio/unifilar/adaptarProjeto.js:130,168` | `equipamentos.inversor` | **sim** | `inversor: undefined` | Core | alto | F16 |
| Potência instalada | `dominio/potencia/index.js` | `engenharia_eletrica.arranjo.mppts` | **sim** | uma topologia | Core | alto | F15 |
| Integridade unifilar | `dominio/unifilar/integridade.js` | `engenharia_eletrica.arranjo.mppts` | sim | — (é o gate) | Core | — | F16 |
| Proposta | `services/EnvioPropostaService.js:81` | `arranjos` | sim | topologia do primeiro | comercial | médio | F18 |
| Projeto (listagem) | `controllers/projetosFVController.js:2308` | `arranjos` | sim | topologia do primeiro | Core | médio | F18 |
| Composição (tela) | `frontend/fv/composicao.js:151` | `arranjos` | sim | exibe o primeiro | UI | médio | F18 |
| Parecer de acesso | `controllers/pareceracessoController.js:618` | `equipamentos.inversor` | sim | um inversor | documento | P2 | F17 |
| Alertcenter | `routes/alertcenter.js` | `equipamentos.inversor` | sim | um inversor | infraestrutura | P3 | — |
| Governança (UI) | `frontend/utils/engenhariaGovernanca.js` | `equipamentos.inversor` | sim | exibição | UI | P3 | — |
| Dimensionamento (UI) | `frontend/components/fv/E5Dimensionamento.jsx` | `equipamentos.inversor` | sim | exibição | UI | P3 | — |
| Templates homologação | `frontend/data/templatesHomologacao.js` | `equipamentos.inversor` | sim | documento | documento | P2 | F17 |
| Unifilar (UI) | `frontend/components/fv/UnifilarFV.jsx` | `equipamentos.inversor` | sim | exibição | UI | médio | F16 |

**Orçamento é a exceção**: `composicaoDoProjeto` é *arranjo-aware* — soma todos os
arranjos agrupando por modelo. Não perde equipamento; perde **atribuição**.

---

## 5. Acessos posicionais

Seis, confirmados por AST (`selecaoPosicionalArranjoF14.check.js`):

| Arquivo:linha | Forma | Escapava do guard F13? |
|---|---|---|
| `backend/src/controllers/homologacaoController.js:86` | `find(principal) ?? arranjos[0]` | não |
| `backend/src/dominio/unifilar/adaptarProjeto.js:73` | `find(principal) ?? arranjos[0]` | não |
| `backend/src/dominio/unifilar/adaptarProjeto.js:168` | `projeto.arranjos?.[0]?.inversores?.[0]` | **sim** — acesso opcional |
| `backend/src/controllers/projetosFVController.js:2308` | `(o.arranjos ?? [])[0]` | **sim** — parênteses |
| `backend/src/services/EnvioPropostaService.js:81` | `(o.arranjos ?? [])[0]` | **sim** — parênteses |
| `frontend/src/fv/composicao.js:151` | `find(principal) ?? (arranjos ?? [])[0]` | **sim** — fora do diretório varrido |

**Correção ao relatado na F13:** eu disse "2 consumidores, teto de 2 no guard". São
**6**. O guard tinha dois furos — regex de forma única e varredura só de `backend/src`.
O teto passava por acaso. Substituído por detecção AST.

Três usam `find(principal)` **antes** do fallback posicional, o que os torna corretos
enquanto houver exatamente um `principal` — garantido pela F13. O risco não é hoje: é
que um projeto sem `principal`, ou com o principal removido, cai no primeiro em silêncio.

---

## 6. Identidade

Resolvida na F13 e **verificada aqui**: 19 arranjos, 0 ids ausentes, 0 duplicados,
exatamente um `tipo=principal` por projeto, ids estáveis entre reloads.

Gerador único em `@fortesolar/fv-shared/projeto/identidade-arranjo`, garantido na
**escrita** (`salvarEtapaProjetoFV`), nunca na leitura.

**Pré-requisito satisfeito** para tudo que vem a seguir: sem identidade estável, não há
como indexar topologia, compatibilidade ou potência por arranjo.

---

## 7. Compatibilidade

| Onde | Escritores | Registros | Granularidade |
|---|---|---|---|
| `engenharia_eletrica.compatibilidade` | `salvarEtapaProjetoFV` (subcampo) | em uso | **projeto** |
| `arranjos[].configuracao_eletrica.compatibilidade` | **0** | **0/12 arranjos** | arranjo (dormente) |

O campo por arranjo existe no schema desde antes e nunca foi escrito. Não é infra
dormente criada por engano: é um destino já reservado.

**Necessário no futuro:** veredito **por arranjo** (cada par módulo+inversor tem seu
próprio envelope de tensão e corrente) **mais** um veredito agregado do projeto — que
não é a soma, é a conjunção: o projeto só é compatível se todos os arranjos forem.

---

## 8. Potência

Semântica preservada de F-05 / F12 / F-01, confirmada nos 5 projetos:

```
necessidade = 131.29 kWp   (dimensionamento — o que o consumo exige)
comprada    = null         (MODULO_SEM_POTENCIA — F12 funcionando)
instalada   = null         (TOPOLOGIA_AUSENTE)
```

Nos 5 projetos a potência comprada é `null` com motivo `MODULO_SEM_POTENCIA`: os
painéis do arranjo primário não têm `potencia_w` cadastrada. É lacuna de **cadastro**,
não de código — e a F12 garante que ela não vira número.

**Agregação futura de N arranjos** deve manter as três regras:
- soma por arranjo, depois agregação — nunca `Σ conhecidos + zeros`;
- um arranjo incompleto torna o **total** não avaliável, e o próprio arranjo também;
- MPPT não é fator multiplicativo: `num_mppt_usados` conta MPPTs ocupados (F-01).

---

## 9. Topologia

| | `engenharia_eletrica.arranjo` | `arranjos[].configuracao_eletrica.mppts` |
|---|---|---|
| Granularidade | **projeto** (objeto único) | arranjo |
| Uso no acervo | ausente em 5/5 multiarranjo | **0 de 589** |
| Quem lê | `dominio/potencia`, `unifilar/adaptarProjeto`, `unifilar/integridade` | só `GerenciadorArranjos` (UI) |
| Status | **fonte canônica do Core** | **LEGACY isolado** (F-04) |

A topologia de **microinversor** já é por arranjo (`configuracao_eletrica.micros[]`,
FV-DOM-031) e é consumida pelo domínio inteiro. **O caminho micro já provou que a
granularidade por arranjo funciona** — é o modelo a replicar para string.

**Fonte futura:** `arranjos[].configuracao_eletrica.mppts`, com `engenharia_eletrica.arranjo`
virando projeção de leitura durante a transição.

---

## 10. Unifilar

```
projeto → adaptarProjetoParaUnifilar → view-model { painel, inversor, arranjoMPPTs } → gerarUnifilarSVG
                                                     ▲ SINGULAR      ▲ SINGULAR
```

Campos singulares do view-model: `inversor` (um objeto), `arranjoMPPTs` (uma topologia).
Medido nos 5 projetos: `inversor` chega **AUSENTE em 5/5**, porque o equipamento vive em
`arranjos[]` e o adapter lê `equipamentos.inversor`.

**Contrato futuro necessário:**
- `arranjos: [{ id, painel, inversor, mppts[] }]` em vez de campos soltos;
- vínculo inversor↔arranjo pelo `arranjo.id` (F13), não por posição;
- o SVG desenha um bloco por arranjo, com barramento CA comum.

---

## 11. Orçamento

`composicaoDoProjeto` **já atravessa todos os arranjos** e agrupa por modelo —
"o mesmo módulo em dois arranjos é um item só". Nenhum equipamento é perdido.

O que se perde é a **atribuição**: não dá para dizer que 211 módulos são do arranjo A e
174 do B. Para comprar, agregar basta. Para **engenharia** (cabeamento, proteção,
string box por arranjo) e para **conferência em obra**, a atribuição é necessária.

Decisão sugerida: manter a agregação como está e **acrescentar** a atribuição, sem
substituir — são duas perguntas diferentes sobre o mesmo dado.

---

## 12. Homologação — **P1**

`homologacaoController:86`:

```js
const a = arranjos.find((x) => x?.tipo === 'principal') ?? arranjos[0] ?? null
```

Um arranjo entra no documento; os demais **desaparecem sem aviso**. Medido:

| Projeto | Arranjos | Escolhido | Descartados | Módulos descartados |
|---|---|---|---|---|
| Mercado Avelino | 2 | `arr_primario` | 1 | **174** |
| Sistema FV 131.29 kWp | 2 | `arr_primario` | 1 | **160** |
| Sistema FV novo kWp | 3 | `arr_primario` | 2 | **354 de 565 (63%)** |
| Ampliação | 2 | `exist_…` | 1 | 0 |
| Wagner Hoymiles | 2 | `arr_primario` | 1 | **12** |

**Risco documental:** o documento enviado à distribuidora declara uma usina menor do que
a projetada. Classificação **P1** — não é P0 porque nenhum dos cinco está homologado
(todos em `proposta`/`rascunho`), mas basta um avançar.

Não corrigido neste sprint, por decisão de escopo.

---

## 13. APIs

| Endpoint | Entrada | Saída | Singularidade | Granularidade futura | Impacto |
|---|---|---|---|---|---|
| `PUT /projetos-fv/:id/etapa` (`arranjos`) | `{lista:[...]}` | projeto | — (já N) | igual | nenhum |
| `PUT /projetos-fv/:id/etapa` (`engenharia_eletrica`) | `{arranjo, clima, compatibilidade}` | projeto | **uma topologia, uma compat.** | por `arranjo.id` | **quebra de contrato** |
| `POST /projetos-fv/:id/unifilar/gerar` | `{}` | SVG + impedimento | um inversor | N arranjos | contrato novo |
| `POST /engenharia/compatibilidade-eletrica` | módulo+inversor+arranjo | veredito | **um par** | um par **por arranjo** | aditivo (chamar N×) |
| `POST /homologacao/memorial` · `/carta` · `/art` | projeto | documento | um arranjo | todos | conteúdo muda |
| `GET /pareceracesso/:id/unifilar` | projeto | SVG | um inversor | N | contrato novo |
| `POST /projetos-fv/:id/proposta/enviar` | projeto | envio | `[0]` p/ topologia | agregado | baixo |

O endpoint de compatibilidade é o mais fácil: é **puro e sem estado**, recebe um par e
devolve um veredito. Multiarranjo = chamá-lo uma vez por arranjo. Nenhuma mudança nele.

---

## 14. Reidratação

Hoje a reidratação do arranjo depende de: posição (`[0]`), do rótulo `principal`, ou do
inversor raiz singular.

**Futuro:** tudo indexado por `arranjo.id`, que a F13 já garante único e estável.

```
arranjo.id → topologia      (arranjos[].configuracao_eletrica.mppts)
arranjo.id → compatibilidade (arranjos[].configuracao_eletrica.compatibilidade)
arranjo.id → inversor        (arranjos[].inversores[].equipamento_id → SSOT)
arranjo.id → potência        (derivada, nunca persistida — INV-58)
```

Nenhuma estrutura nova é necessária: os quatro destinos já existem no schema.

---

## 15. Histórico

| Classe | Projetos | Estratégia |
|---|---|---|
| Sem `arranjos[]` | 576 | derivação legada de `equipamentos.*` já existe em `normalizarArranjos` |
| Single-arranjo | 8 | migram sem ambiguidade — um arranjo recebe a topologia do projeto |
| **Multiarranjo** | **5** | topologia do projeto não tem a quem pertencer — exigem decisão |
| Parciais | 1 (Ampliação) | arranjo vazio; identidade existe, composição não |

Para os 5 multiarranjo a topologia de `engenharia_eletrica.arranjo` está **ausente**, o
que é sorte: não há o que desambiguar. A migração desses é atribuir topologia nova, não
repartir a existente.

---

## 16. `MULTIPLOS_INVERSORES`

**Origem:** `dominio/unifilar/integridade.js:142`. Dispara quando
`totais.n_inversores_total > 1`.

**Motivo técnico, no comentário do próprio código:** o adapter lê
`equipamentos.inversor` — o primeiro. Desenhar um sistema de dois inversores a partir de
um só *"reduz a potência CA pela metade em silêncio, que foi exatamente o 25 kW de 50 kW
comprados do T07/T09"*. É um defeito que já aconteceu.

**Consumidor:** `dominio/unifilar/index.js:67` — `recusar(impedimento)`, que devolve o
impedimento em vez do desenho.

**É o gate o primeiro bloqueio?** **Não.** Nos 5 projetos reais o unifilar para antes,
em `TOPOLOGIA_AUSENTE`. A ordem medida é:

```
TOPOLOGIA_AUSENTE → EQUIPAMENTO_AUSENTE → MULTIPLOS_INVERSORES
```

O gate protege um caminho que os projetos reais **nem alcançam**. Removê-lo hoje não
habilitaria nada — só calaria o aviso.

**Pré-condições para remoção**, todas necessárias:
identidade por arranjo ✔ (F13) · inversor por arranjo · compatibilidade por arranjo ·
topologia por arranjo · potência por arranjo ✔ (F12 no agregado) · agregação correta ✔ (F12) ·
unifilar multiinversor · orçamento com atribuição · homologação sem descarte ·
reidratação determinística · testes ponta a ponta.

---

## 17. Gaps

| # | Gap | Severidade |
|---|---|---|
| 1 | Topologia string singular por projeto | **alta** — bloqueia toda a cadeia |
| 2 | `equipamentos.inversor` singular, 9 consumidores | **alta** |
| 3 | Unifilar com um slot de inversor | alta |
| 4 | Homologação descarta arranjos (P1) | **alta** — risco documental |
| 5 | Compatibilidade singular; campo por arranjo sem escritor | alta |
| 6 | 6 seleções posicionais | média — mitigada pelo `principal` único |
| 7 | Orçamento sem atribuição por arranjo | média |
| 8 | `arranjos[].dimensionamento` nunca preenchido | baixa — derivado em leitura |
| 9 | `potencia_w` ausente em 12 de 13 projetos | **cadastro**, não código |

---

## 18. Opções arquiteturais

| Opção | Benefícios | Riscos | Complexidade | Compatibilidade | Recomendação |
|---|---|---|---|---|---|
| **A — Migração direta** | uma verdade desde o dia 1; sem coexistência | ~15 consumidores mudam juntos; rollback caro; 589 documentos sob risco | alta | quebra | não |
| **B — Faseada com adapter** | incremental; rollback por etapa; consumidor migra quando estiver pronto | adapter pode virar permanente; janela com duas leituras | média | preservada | **sim** |
| **C — Agregado + por arranjo** | leitura agregada barata | **duas fontes de verdade** — o defeito que F8/F9/F12 passaram removendo | média | preservada | não |
| **D — Espelhar o caminho MICRO** | o padrão já existe, já funciona e já é consumido pelo domínio inteiro | exige disciplina de não duplicar | média | preservada | **compõe com B** |

**A opção D não é alternativa a B — é o formato que B deve seguir.** O caminho de
microinversor já resolveu exatamente este problema: `arranjos[].configuracao_eletrica.micros[]`
é por arranjo, é canônico, e `dominio/potencia` e `dominio/unifilar` o consomem sem
passar por `engenharia_eletrica`. String deve seguir o mesmo desenho, não inventar outro.

**Por que não C:** manter o dado agregado *e* o por arranjo como fontes independentes
recria a classe de defeito que os sprints anteriores eliminaram (`specs_canonicas`,
catálogo comercial, soma parcial). Agregado é legítimo **como derivação**, nunca como
segunda fonte.

---

## 19. Arquitetura recomendada

**Opção B, no formato da D.**

```
PROJETO   cliente · unidade consumidora · necessidade · clima · perdas
          estado comercial · agregados (DERIVADOS, nunca persistidos — INV-58)

ARRANJO   id (F13) · módulo · inversor · composição · topologia
          compatibilidade · potência · estado técnico

MPPT      módulos/string · strings paralelas · tensão · corrente

DERIVADO  potência total · módulos totais · inversores totais · veredito agregado
          (conjunção dos arranjos, não soma)
```

Regra que sustenta o desenho: **o projeto agrega, o arranjo decide, o MPPT detalha.**
Nada que o arranjo decide é persistido no projeto.

---

## 20. Plano de migração

| # | Etapa | Mudança | Pré-requisitos | Consumidores | Dados históricos | Testes | Risco | Isolável? |
|---|---|---|---|---|---|---|---|---|
| 1 | **Contrato de leitura** | `obterTopologiaProjeto` passa a devolver topologia por arranjo, lendo do legado enquanto só ele existir | F13 ✔ | nenhum (aditivo) | nenhum | contrato | baixo | **sim** |
| 2 | **Inversor por arranjo** | consumidores passam a ler `arranjos[].inversores[]`; `equipamentos.inversor` vira projeção | 1 | 9 arquivos | derivação já existe | por consumidor | médio | **sim** |
| 3 | **Compatibilidade por arranjo** | escrever `arranjos[].configuracao_eletrica.compatibilidade`; agregado = conjunção | 1, 2 | integridade, governança | 0 registros — nada a migrar | motor ×N | médio | **sim** |
| 4 | **Topologia por arranjo** | `configuracao_eletrica.mppts` vira canônica; `engenharia_eletrica.arranjo` vira projeção | 1, 3 | potência, unifilar, integridade | 0/589 no destino; 5 multiarranjo sem topologia | equivalência | **alto** | parcial |
| 5 | **Agregação** | totais derivam dos arranjos preservando F12 | 2, 4 | `dominio/potencia` | nenhum | F12 ✔ | baixo | **sim** |
| 6 | **Reidratação por id** | eliminar as 6 seleções posicionais | 1–5 | 6 arquivos | nenhum | guard F14 ✔ | baixo | **sim** |
| 7 | **Unifilar multiinversor** | view-model com N arranjos; SVG com barramento CA | 2, 4, 6 | adapter, SVG, UI | nenhum | visual + contrato | **alto** | não |
| 8 | **Orçamento com atribuição** | acrescentar `arranjo_id` aos itens, sem tirar a agregação | 2, 6 | proposta, baseline | nenhum | composição | médio | **sim** |
| 9 | **Homologação sem descarte** | documento declara todos os arranjos | 2, 6, 8 | homologação, templates | nenhum | documento | **alto** | **sim** |
| 10 | **Remover o gate** | `MULTIPLOS_INVERSORES` sai | 1–9 | unifilar | nenhum | ponta a ponta | alto | não |

**A etapa 9 pode e deve ser antecipada se algum dos 5 projetos avançar para homologação** —
é a única com risco documental externo.

---

## 21. Guards

| Guard | Cobre | Status |
|---|---|---|
| `identidadeArranjoF13.check.js` | id único, estável, um gerador, `principal` único | verde |
| `selecaoPosicionalArranjoF14.check.js` | seleção posicional por AST, backend + frontend, lista fechada de 6 | **novo** |
| `capacidadeMultiarranjoF11.check.js` | capacidade medida; contagem funciona, topologia/unifilar não | verde |
| `somaPotenciaF12.check.js` | ausência ≠ zero, parcial ≠ total | verde |
| `fontesDerivadasF10.check.js` | `specs_canonicas` sem autoridade; LEGACY isolado; gate armado | verde |

**Guard a criar na etapa 4:** equivalência entre a topologia lida do legado e a lida do
arranjo, para que a troca de fonte seja provada e não presumida.

---

## 22. Riscos

| Risco | Mitigação |
|---|---|
| Adapter da etapa 1 virar permanente | prazo declarado: removido na etapa 6 |
| Duas fontes de topologia durante a etapa 4 | guard de equivalência obrigatório antes da troca |
| Homologação avançar antes da etapa 9 | monitorar os 5 projetos; antecipar a etapa se algum sair de `proposta` |
| Remover o gate cedo demais | pré-condições explícitas na seção 16 |
| Migrar sem `potencia_w` cadastrada | ortogonal — F12 garante que a lacuna aparece em vez de virar zero |
| Regressão em projeto single-arranjo | 576 sem `arranjos[]` + 8 single: derivação legada já coberta por testes |

---

## 23. Fora do escopo

Não tratados neste sprint, por decisão explícita:

- correção dos 6 consumidores posicionais;
- migração da topologia;
- compatibilidade por arranjo;
- unifilar multiinversor;
- orçamento e homologação multiarranjo;
- remoção de `MULTIPLOS_INVERSORES`;
- backfill de `potencia_w` (12 de 13 projetos — lacuna de cadastro);
- `instalacaoRefEtapa.check.js` falhando com `TENANT_AUSENTE` (pré-existente, F12);
- `cosernTopologiasReferencia.js` como sexta fonte (F9, medida: 0 divergências).
