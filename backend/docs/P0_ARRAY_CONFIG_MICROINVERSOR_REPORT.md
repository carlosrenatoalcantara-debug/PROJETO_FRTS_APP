# P0-ARRAY-CONFIG-MICROINVERSOR-01 — Modelagem elétrica de microinversores

> Escopo: **modelagem elétrica + auto-configuração + persistência + interface**. NÃO altera
> SSOT / Atlas / OCR / parser / SolarMarket. Objetivo: microinversores deixam de ser tratados
> como inversores string.

## FASE 1 — Auditoria do fluxo

1. **Como o sistema identificava topologia (antes):** **não identificava.** Não havia campo
   `topologia` nem classificador. O `ConfiguradorArranjoFV` usava `inversor.nMppts` e **sempre**
   aplicava lógica de string (`sugerirMPPTs`, `validarArranjo`, `modulosPorString`, `numStrings`)
   a qualquer inversor — micro/otimizador inclusos.
2. **Onde a lógica de string era aplicada indevidamente:** `ConfiguradorArranjoFV.jsx`
   (`sugerirMPPTs`/`validarArranjo`/MPPT-tree) rodava para microinversores → produzia "módulos por
   string", "strings paralelas" e "MPPT" para Hoymiles/TSUN/APsystems/Deye Micro — **conceitos
   inexistentes em micro**.
3. **Telas que assumiam string/MPPT/strings paralelas:** `ConfiguradorArranjoFV`, `UnifilarFV`,
   `ValidacaoEletrica`, `E5Dimensionamento`, `CardResumoSistema` + templates de memorial/parecer
   (`templatesHomologacao.js`) — **~6 telas/artefatos**.
4. **Onde o banco persiste:** no **projeto** (`engenharia_eletrica.arranjo` — `mppts`,
   `strings_paralelo`, `modulos_por_string`) via `PUT /api/projetos-fv/:id/etapa`. **Não** nos
   equipamentos do Atlas (que são o catálogo).

## FASE 2 — Classificação explícita (sem heurística oculta)

Novo `topologiaInversor.js` → `classificarTopologia(inversor, eletricoInv)` com precedência
**documentada**: (1) campo `topologia` explícito; (2) padrões claros de modelo/fabricante;
(3) default `string`. Campo `topologia` adicionado ao `catalogoEletrico` (micro/otimizador).

**Auditoria do Atlas (read-only, 172 inversores):**

| Topologia | Qtde | Exemplos |
|---|---|---|
| **string** | **152** | Growatt, Kehua, Deye SUN-xK-G, SAJ… |
| **micro** | **11** | Hoymiles HMS-2000-4T, TSUN TSOL-MX2250, APsystems DS3/QT2, Enphase IQ8 |
| **otimizador** | **9** | SolarEdge SE… |

## FASE 3/4 — Motor de dimensionamento micro (`dimensionarMicro.js`)

Para MICRO: **removidos** módulos-por-string, strings-paralelas e MPPT visual. **Substituídos** por:
quantidade de módulos, quantidade de micros, módulos por micro, potência CC/CA, relação DC/AC,
distribuição. Lógica **por entradas** (não por string):

- **Quantos módulos por entrada:** `modulos_por_entrada` (=1).
- **Quantas entradas o micro possui:** `entradas` (HMS-500=2, HMS-2000=4, HMT=6, Enphase=1…).
- **Quantos micros:** `ceil(módulos / (entradas × modulos_por_entrada))`.
- **Sobras:** micros completos + 1 parcial (fill-based).
- **Oversizing:** DC/AC do micro mais cheio ≤ `oversizing_max` (1,25).

**Exemplos validados:** 26 mód / micro 4 entradas → **7 micros (6 completos + 1 de 2)**,
distribuição `[4,4,4,4,4,4,2]`; 26 mód / HMS-500 (2 entradas) → **13 micros**; DC/AC 26×590W /
HMS-2000 = **1,096×** (oversizing por micro 1,18× ✓). **Zero conceito de string.**

## FASE 5 — UI (`ConfiguradorArranjoFV.jsx`)

Branch por topologia: quando `micro`, **oculta** MPPT/strings/módulos-por-string e exibe o painel
**⚡ Sistema Microinversor** (módulos, nº de micros, módulos por micro + entradas, aproveitamento,
potência CC/CA, DC/AC, distribuição). Quando `string`, fluxo **idêntico ao anterior**. Persistência
estendida: payload passa a carregar `topologia` + bloco `micro` (campos legados de string mantidos).

## FASE 6 — Validação (`microinversor.test.js`, 12 testes — verdes)

| Caso | Resultado |
|---|---|
| 8 / 12 / 26 / 74 / 128 mód (micro 4 entradas) | **2 / 3 / 7 / 19 / 32 micros** ✓ |
| 26 mód HMS-2000 (4 ent.) | 7 micros, 6 completos + 1 parcial ✓ |
| 26 mód HMS-500 (2 ent.) | 13 micros ✓ |
| 8 mód Enphase (1 ent.) | 8 micros ✓ |
| Classificação Hoymiles/APsystems/TSUN/Deye Micro/Enphase | **micro** ✓ |
| Deye SUN-5K-G / SUN2000G-US | **string** (não-micro) ✓ |
| "não produz string/MPPT" | sem `modulosPorString`/`numStrings`/`mppts` ✓ |

**Build OK · suíte 684 passed** (+12; 14 falhas pré-existentes de diagram, inalteradas).

## FASE 7 — Respostas obrigatórias

1. **Onde ocorria o erro:** `ConfiguradorArranjoFV` aplicava `sugerirMPPTs`/`validarArranjo` (string/
   MPPT) a **todos** os inversores, inclusive micros.
2. **Quantas telas assumiam string:** ~6 (Configurador, Unifilar, ValidacaoEletrica, E5, CardResumo,
   templates memorial/parecer). **Corrigida a fonte** (Configurador); o payload agora carrega
   `topologia`+`micro` para as demais consumirem (render micro a jusante = follow-up P1).
3. **Como ficou a modelagem micro:** classificador explícito + motor por-entradas + catálogo com
   `topologia`/`entradas` + UI dedicada + persistência.
4. **Quantos equipamentos micro:** **11** (+9 otimizador) de 172.
5. **Impacto em projetos existentes:** **nenhum** — o fluxo string é idêntico; projetos sem
   `topologia` classificam por modelo (ou default string).
6. **Compatibilidade retroativa:** **preservada** — campos legados (`mppts`/`strings_paralelo`/
   `modulos_por_string`) mantidos; `topologia`/`micro` são **aditivos**.
7. **Suporta microinversores corretamente?** **Sim** na modelagem elétrica, auto-configuração, UI
   do configurador e persistência (núcleo da sprint). **Follow-up (P1):** render micro em
   unifilar/memorial/parecer consumindo o payload `topologia`/`micro`.

### Conclusão
Microinversor **não usa mais lógica de string**: classificação explícita (11 micro no Atlas),
motor de dimensionamento por entradas (quantidade de micros correta — validada em 5 casos), MPPT/
strings **ocultos** na UI (⚡ Sistema Microinversor), persistência estendida e **compatibilidade
preservada**. Build + 12 testes verdes. Nada fora do escopo (SSOT/Atlas/OCR/parser/SolarMarket
intocados).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-ARRAY-CONFIG-MICROINVERSOR-01

A sprint P0-ARRAY-CONFIG-MICROINVERSOR-01 abordou de forma eficaz a correção fundamental no tratamento de microinversores, que anteriormente eram indevidamente processados como inversores string. O escopo, focado em modelagem elétrica, auto-configuração, persistência e UI, foi rigorosamente seguido, sem impactar sistemas externos como SSOT, Atlas, OCR, parser ou SolarMarket.

**Avaliação dos pontos:**

1.  **Classificação explícita:** A introdução de um classificador explícito para topologia (`string`/`micro`/`otimizador`) com precedência clara (campo explícito > padrões de modelo > default string) é **correta** e elimina a ambiguidade e heurísticas ocultas. A documentação dessa precedência é crucial e parece ter sido realizada.

2.  **Motor por-entradas e números:** O motor de dimensionamento `dimensionarMicro.js` por entradas, com a lógica de cálculo de quantidade de micros (`ceil(módulos/(entradas×mod_por_entrada))`) e a distribuição fill-based, parece **correto**. Os exemplos apresentados (26 módulos para 7 micros com 6+1 parcial, e 13 micros para HMS-500) são consistentes com a lógica descrita. O cálculo de DC/AC e oversizing por micro também está alinhado com as boas práticas.

3.  **UX no ConfiguradorArranjoFV:** Ocultar MPPT/strings para microinversores e apresentar um painel dedicado (`⚡ Sistema Microinversor`) é a **UX correta**. Isso reflete a natureza distinta do funcionamento dos microinversores e evita confusão para o usuário, que não precisa lidar com conceitos de string ou MPPT em um arranjo de microinversores.

4.  **Persistência aditiva e compatibilidade:** A persistência aditiva, mantendo campos legados e adicionando a nova estrutura (`topologia` + bloco `micro`), **preserva a compatibilidade retroativa**. Projetos existentes que não utilizam a nova classificação continuarão a funcionar com a lógica string, enquanto novos projetos se beneficiarão da modelagem aprimorada.

5.  **Honestidade sobre follow-up:** Admitir que a renderização de microinversores em unifilar, memorial e parecer é um follow-up (P1) é **honesto e transparente**. Isso demonstra um entendimento claro do escopo da sprint e do trabalho restante.

6.  **Riscos/Gaps:** O principal risco identificado é a dependência do follow-up P1 para a visualização completa em todos os artefatos. Embora a modelagem e configuração estejam corretas, a experiência do usuário final em relatórios pode ser incompleta até que o P1 seja implementado. A validação dos 12 testes verdes é um bom indicativo de que os riscos técnicos foram mitigados dentro do escopo.

7.  **Veredito:** **APROVADO**.

A sprint entregou com sucesso a correção fundamental na modelagem e configuração de microinversores, alinhando o sistema com a realidade técnica desses dispositivos. A abordagem de classificação explícita, o motor de dimensionamento por entradas e a UX aprimorada no configurador são pontos fortes. A compatibilidade retroativa foi mantida, e a transparência sobre o trabalho futuro é louvável.
