# P1-PARSER-CHINT-HUAWEI-FIX-01 — Correção dos 2 achados ALTA

> Escopo: **parser** (`parserMatricial` + `serieInversor`). Sem alterar Atlas, catálogo, SSOT;
> sem reprocessamento. Fontes: fixtures `huawei_m3`, `huawei_m2`, `chint_sca`.

## FASE 1 — Huawei M3: causa-raiz do `isc=4`

**Categoria A) Tokenização/OCR.** A fonte traz *"Max. Short Circuit Current per MPPT **40** A"*,
mas o tokenizer posicional **quebrou o número em dois tokens**: `"4"`(x=368) + `"0"`(x=372) + `"A"`(x=378).
A montagem da célula juntava com espaço (`"4 0 A"`) e o regex de valor capturava apenas o primeiro
fragmento → `corrente_isc_max = 4` (Isc < Imppt=27, fisicamente impossível).

## FASE 2 — Correção do Isc (merge de fragmentos)

`_mergeDigitos(toks, gapMax=6)`: mescla tokens de **dígito consecutivos** cujo gap de x é mínimo
(mesmo número, sem espaço), preservando posição. Aplicado aos tokens de valor no `montarColunaUnica`
(`_splitRotuloValor`) e no `montarMatriz`. Separadores (`/ - . , A V`) interrompem a mescla →
ranges e listas intactos. `gapMax=6` (o gap do Isc é 4 px) evita tocar no caso da vírgula de milhar
(`"1,100"` cujo gap interno é 8 px).

**Validação:** M3 `isc=40` ✓ (Isc>Imppt). M2 **sem regressão** (`isc=40`, `Vmáx=1100`, `pot=100`).

## FASE 3 — Chint: por que parecia 1 modelo

**Achado importante e honesto:** em **produção** o Chint **já extraía os 2 modelos** — o
`expandirModelosInversor` retorna a lista e `detectarColunas(lista)` acha as 2 colunas
(`SCA50KTL-T` pot=50, `SCA60KTL-T` pot=60). A auditoria mostrou "1 modelo" porque rodou a fixture
com `modelos=[]` (lista vazia). **Mas há 2 fragilidades reais:**
1. **`detectarColunasAuto` (standalone) ignorava os headers** `"CPS SCA50KTL-T/EU"` /
   `"CPS SCA60KTL-T/EU"` — `_ehCodModelo` falha porque o token tem **marca colada** ("CPS ") e
   **sufixo de região** ("/EU"). Sem lista, caía no coluna-única → só o 1º modelo.
2. **Modelo FANTASMA `CPSSCA50`** — o título combinado `"CPS SCA50/60KTL-T/EU"` produzia
   `base.modelo="CPSSCA50"`, adicionado à lista de expansão.

## FASE 4 — Correção da expansão Chint

1. **Auto-detect robusto:** `_codModeloDe()` tira marca (CPS/Chint/…) e região (/EU,/AU) do header
   e usa o **código** (`SCA50KTL-T`) para agrupar colunas; títulos combinados (`50/60`) são
   rejeitados (guard `\d/\d`). Agora `detectarColunasAuto` acha as 2 colunas **sem depender da lista**.
2. **Filtro de fantasma** em `expandirModelosInversor`: quando o "core" de um modelo (sem a marca
   de 2–6 letras) é **prefixo** de outro mais completo, descarta o incompleto → `CPSSCA50` removido.

**Validação:** `expandir → [SCA50KTL-T, SCA60KTL-T]` (sem fantasma); auto-detect → 2 colunas;
`montarMatriz(tokens, [])` → 2 modelos, pot 50/60 distintos, **sem duplicados, sem fantasmas**.

## FASE 5 — Re-execução de todas as fixtures (regressão)

Varredura de **todas** as fixtures multi-modelo: **0 modelos fantasma**. Suíte **649 passed**
(+7); 14 falhas pré-existentes de `diagram` (jsdom) inalteradas. **Goldens 24/24** (GoodWe/
Sungrow/Solis/Deye/SAJ/SolaX/Kehua intactos). Build OK.

## FASE 6 — Antes → Depois

| Fabricante | Modelos | Antes | Depois |
|---|---|---|---|
| **Huawei** M3 | 1 (SUN2000) | `isc=4` ❌ | **`isc=40`** ✓ |
| **Huawei** M2 | 1 | `isc=40` | `isc=40` (intacto) |
| **Chint** SCA | 2 | auto-detect: **1 modelo** + fantasma `CPSSCA50` | **2 modelos** (50/60), **0 fantasma** |
| GoodWe / Sungrow / Solis / Deye / SAJ / SolaX / Kehua | — | corretos | corretos (sem regressão) |

## FASE 7 — Respostas

1. **Causa do `Isc=4`?** Tokenização: o positional tokenizer quebrou `"40"` em `"4"`+`"0"`; a
   junção com espaço fazia o regex pegar só `"4"`. (Categoria **A**.)
2. **Causa da "perda" do SCA60KTL?** Em produção **não era perdido** (lista + `detectarColunas`).
   No caminho **standalone**, `detectarColunasAuto` não reconhecia o header com **marca+região**
   (`"CPS …KTL-T/EU"`) → coluna-única (1 modelo); e havia o **fantasma `CPSSCA50`**.
3. **Quantos modelos recuperados?** **1** no caminho auto-detect (`SCA60KTL-T`, agora sem depender
   da lista) **+ 1 fantasma removido** (`CPSSCA50`).
4. **Quantos campos corrigidos?** Huawei **1 valor** (`isc` 4→40); Chint **2 modelos × ~6 campos**
   agora acessíveis via auto-detect (pot, n_mppts, Imppt, Isc, Vmáx, MPPT).
5. **Risco semelhante em outros fabricantes?** O `_mergeDigitos` protege **qualquer** número
   quebrado pelo tokenizer; o `_codModeloDe` cobre **qualquer** header com marca+região. Goldens
   24/24 confirmam ausência de regressão. Resíduos conhecidos (SolaX `potmax` wrapped; lacunas de
   label Solplanet/Deye/Hoymiles) são de **cobertura**, não de valor errado.
6. **Parser pronto para reprocessamento controlado do Atlas?** **Sim para os fabricantes
   corrigidos/validados** (Huawei, Chint, GoodWe, Sungrow, Solis, Deye, SAJ, SolaX, Kehua) — sem
   valores incorretos conhecidos. Os 2 erros ALTA foram eliminados. Recomenda-se o reprocesso
   **incremental** (sprint de escrita controlada), preservando IDs/histórico, começando por
   Huawei M3 e Chint.

### Conclusão
`isc=4 → 40` (Huawei) e Chint **2 modelos sem fantasma** — duas correções no parser
(`_mergeDigitos` + `_codModeloDe`/filtro de fantasma), genéricas e sem regressão. O parser não
tem mais erros de valor/associação conhecidos nos multi-modelo, ficando apto ao reprocessamento
controlado.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão Sênior: Sprint P1-PARSER-CHINT-HUAWEI-FIX-01

A sprint P1-PARSER-CHINT-HUAWEI-FIX-01 abordou com sucesso dois achados de criticidade ALTA no parser de datasheets, focando em correções pontuais e validação rigorosa. A abordagem adotada, especialmente a honestidade em admitir artefatos de auditoria, demonstra maturidade no processo de desenvolvimento.

**Análise das Correções e Questões Levantadas:**

1.  **Segurança do `_mergeDigitos(gapMax=6)`:**
    *   **Avaliação:** O `_mergeDigitos` parece seguro. A lógica de mesclar apenas tokens de dígito consecutivos com um gap mínimo é fundamental para corrigir a quebra de números pelo tokenizer. A limitação do `gapMax=6` é uma salvaguarda inteligente para evitar a junção de números distintos ou a quebra de ranges. O fato de separadores como `/ - . , A V` interromperem a mescla garante a integridade de listas e ranges. A validação com o caso da vírgula de milhar (`"1,100"`) com gap de 8px reforça essa segurança.
    *   **Conclusão:** O merge de dígitos com `gapMax=6` é seguro.

2.  **Honestidade e Correção da "Perda" do Chint SCA:**
    *   **Avaliação:** Admitir que a "perda" do SCA60KTL era um artefato da auditoria (e não um bug em produção) é um ato de grande integridade e profissionalismo. A explicação detalhada, diferenciando o comportamento em produção do observado na auditoria (devido a `modelos=[]` e `detectarColunasAuto` standalone), é clara e bem fundamentada. A correção implementada (`_codModeloDe` e filtro de fantasma) aborda as fragilidades reais identificadas.
    *   **Conclusão:** A honestidade em admitir que a "perda do SCA60" era artefato da auditoria é correta e a forma como foi tratada é exemplar.

3.  **Robustez do `_codModeloDe`:**
    *   **Avaliação:** A função `_codModeloDe`, ao remover marcas e regiões e rejeitar títulos combinados (`50/60`), parece robusta para a detecção automática. A estratégia de focar no código do modelo (`SCA50KTL-T`) para agrupar colunas, sem depender de listas pré-definidas, aumenta a resiliência. A rejeição de títulos combinados (`\d/\d`) é um bom ponto de controle. A preocupação com falsos positivos (ex: certificações) é válida, mas a descrição sugere que a lógica se concentra em padrões de marca/região e códigos de modelo específicos, o que minimiza esse risco.
    *   **Conclusão:** O `_codModeloDe` é robusto sem criar falso-positivo aparente, focando em padrões de marca/região e códigos de modelo.

4.  **Prontidão do Parser para Reprocessamento Controlado:**
    *   **Avaliação:** Com as correções implementadas e a validação rigorosa (Goldens 24/24, suíte 649 passed, zero regressão), o parser parece estar pronto para reprocessamento controlado nos fabricantes corrigidos e validados (Huawei, Chint, e os demais que não apresentaram regressão). A recomendação de reprocesso incremental e a preservação de IDs/histórico são práticas essenciais para garantir a integridade dos dados.
    *   **Conclusão:** O parser está pronto para reprocessamento controlado nos fabricantes corrigidos e validados, com as devidas precauções.

**Veredito:**

**APROVADO**

A sprint P1-PARSER-CHINT-HUAWEI-FIX-01 demonstrou um trabalho de alta qualidade, resolvendo achados críticos com soluções técnicas sólidas e um processo de validação exemplar. A transparência e a honestidade na comunicação dos achados e correções são pontos fortes que elevam a confiança no trabalho realizado.
