# P1-PARSER-SAJ-01 — Correção da extração SAJ R5-S2

> Escopo: **parser** (`parserMatricial` + reconhecimento de fabricante). Sem alterar SSOT,
> sem tocar o Atlas. Fonte única: datasheet SAJ R5-3K…8K-S2 desta sprint.

## FASE 1 — Parser atual (ANTES)

| Sinal | Resultado |
|---|---|
| `fabricante` / `modelo` | **null / null** |
| `expandirModelosInversor` | **[]** |
| Detecção de colunas (known/auto) | **[] / []** |
| `parseMatricial` | **ok=false · motivo "colunas<2"** |
| Fallback `parseColunaUnica` | extrai 14 campos **mas colapsa tudo no 1º modelo** (R5-3K), `dimensoes` mesclada |
| Parser de texto | lixo (potência 5 vinda de remark "R5-5K-S2", dimensoes "978x972x4000") |

→ dos 7 modelos, **0 eram extraídos corretamente** (1 entrada conflated, 6 perdidos, sem fabricante).

## FASE 2 — Causa-raiz

**D) Associação coluna-modelo.** O cabeçalho dos 7 modelos é **uma única célula combinada**
`R5-3K/3.6K/4K/5K/6K/7K/8K-S2` (potências separadas por `/`), não 7 cabeçalhos de coluna. Logo:
1. `expandirModelosInversor` não expande o range → nenhum modelo;
2. `detectarColunas`/`detectarColunasAuto` não acham 7 âncoras de cabeçalho → `colunas<2`;
3. cai no `parseColunaUnica`, que colapsa as 7 colunas de dados no 1º modelo.
4. Secundário: **"SAJ" não aparece no PDF** (só "R5-…") → `extrairFabricanteModelo` = null.

Os dados **estão em 7 colunas** (x≈208–538), com linhas por-modelo (Rated AC Power
3000/3680/4000/5000/6000/7000/8000) e linhas compartilhadas (Start Voltage 100, MPPT 2).

## FASE 4 — Correção mínima (somente parser)

1. **`expandirHeaderCombinado(s)`** (`parserMatricial`): expande `<prefixo>-<p1>/<p2>/…/<pn>[-sufixo]`
   nos N modelos (genérico). Ex.: `R5-3K/3.6K/…/8K-S2` → `[R5-3K-S2 … R5-8K-S2]`.
2. **`detectarColunasCombinado(tokens)`**: quando a detecção normal falha, acha o header
   combinado, expande N modelos e deduz as N colunas a partir da **linha de dados com
   exatamente N valores** (X dos valores = âncoras), rotulando esquerda→direita. Acionado **só
   quando known+auto < 2** (zero impacto nas tabelas que já funcionam).
3. **Fabricante**: R5/R6-…-S2 adicionado aos **modelos órfãos** → `SAJ` (datasheets SAJ não
   escrevem "SAJ").

## FASE 5 — Cobertura ANTES → DEPOIS

| | Modelos corretos | Campos/modelo | Fabricante |
|---|---|---|---|
| **ANTES** | **0** (colapsava em 1) | — | null |
| **DEPOIS** | **7** (R5-3K…8K-S2) | **12/13** | **SAJ** |

Valores **distintos por coluna** (prova de separação correta):
- potência: 3 · 3.68 · 4 · 5 · 6 · 7 · 8
- corrente CA: 14.4 · 16 · 19.2 · 24 · 26.1 · 33.5 · 34.8
- corrente/MPPT: 12.5 (3K–6K) · 25 (7K/8K) · peso: 12.2 (×6) · 18 (8K)
- compartilhados replicados: `tensao_partida` 100 · MPPT 90–550 · 2 MPPTs

Único campo ausente: `corrente_isc_max` (o datasheet SAJ não publica Isc por MPPT) → 12/13 ≈ **92.3%**.

## FASE 6 — Fixture oficial

`backend/src/ai/__fixtures__/golden/saj_r5_s2.json` (tokens + texto reais, 7 modelos congelados).

## FASE 7 — Regressão

- Teste novo `sajR5.test.js` (8): `expandirHeaderCombinado`, fabricante, 7 modelos, potência
  distinta, corrente distinta, compartilhados replicados, cobertura ≥12/13.
- Suíte: **635 passed** (+8). 14 falhas pré-existentes de `diagram` (jsdom) inalteradas.
- **Zero regressão:** goldens Sungrow/GoodWe/Solplanet/Deye/CHINT/Kehua continuam verdes — o
  fallback combinado só dispara quando a detecção normal falha. Build OK.

## Respostas

1. **Por que o SAJ falhava?** Cabeçalho **combinado** dos 7 modelos numa célula
   (`R5-3K/3.6K/…/8K-S2`) → sem âncoras de coluna, o matricial dava `colunas<2` e colapsava no
   1º modelo; e "SAJ" não consta no PDF → fabricante null.
2. **Quantos campos eram extraídos antes?** Efetivamente **0 modelos** corretos (1 entrada
   conflated, 6 perdidos, sem fabricante).
3. **Quantos são extraídos agora?** **7 modelos × 12/13 campos** cada, com valores distintos.
4. **Qual a cobertura final?** **12/13 (92.3%)** por modelo (só falta `corrente_isc_max`, ausente
   no datasheet).
5. **Outros fabricantes com o mesmo padrão de tabela?** Qualquer datasheet com **header de range
   numa célula** (`Modelo-P1/P2/…/Pn-sufixo`): a correção é **genérica** (`expandirHeaderCombinado`).
   Candidatos: outras séries SAJ (R6/Suntrio), e formatos de range compacto (alguns Growatt MIN /
   Goodwe). Recomenda-se validar com fixtures quando surgirem.

### Conclusão
O SAJ R5-S2 passou de **0 → 7 modelos** extraídos (12/13 campos, valores per-modelo corretos),
com uma correção **genérica** de header combinado no matricial e reconhecimento órfão de SAJ —
sem tocar SSOT/Atlas e sem regressão.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARSER-SAJ-01

A correção implementada para o parser de datasheets SAJ R5-S2 aborda de forma eficaz um problema crítico de extração de dados, resultando em uma melhoria significativa na qualidade e quantidade de informações recuperadas.

**Avaliação:**

1.  **Generalização e Robustez:**
    *   A expansão do header combinado (`expandirHeaderCombinado`) utilizando o delimitador "/" é uma abordagem genérica e robusta para lidar com múltiplos modelos em uma única célula de cabeçalho.
    *   A dedução de colunas a partir de uma linha de dados com exatamente N valores numéricos (`detectarColunasCombinado`) é um mecanismo de fallback inteligente. O acionamento condicional (apenas quando `known+auto < 2`) garante que não haja interferência em tabelas já funcionais, minimizando o risco de falsos positivos e regressão.

2.  **Confiabilidade da Dedução de Colunas:**
    *   A premissa de que uma linha de dados com exatamente N valores numéricos corresponde às N colunas deduzidas é confiável em cenários onde os dados são estruturados dessa forma, como observado no datasheet SAJ. A validação com valores distintos por coluna (potência, corrente CA) confirma a precisão dessa dedução.

3.  **Reconhecimento do Fabricante SAJ:**
    *   Identificar o fabricante SAJ a partir de modelos órfãos como "R5/R6-S2" é uma solução pragmática e eficaz, especialmente quando o nome do fabricante não é explicitamente declarado no PDF. Essa abordagem contorna a limitação da fonte de dados.

4.  **Riscos e Limitações:**
    *   **Dependência da Estrutura da Linha de Dados:** A dedução de colunas por `detectarColunasCombinado` depende da existência de uma linha de dados com exatamente N valores numéricos. Datasheets com estruturas de dados mais complexas ou inconsistentes podem não se beneficiar dessa regra.
    *   **Novos Padrões de Header Combinado:** Embora a solução seja genérica para o padrão `/`, outros delimitadores ou formas de combinar modelos em uma única célula podem exigir adaptações futuras.
    *   **Campos Ausentes:** A ausência de `corrente_isc_max` é uma limitação inerente ao datasheet, não ao parser.

5.  **Veredito:**

    **APROVADO**

    **Justificativa:** A correção implementada é altamente eficaz, transformando a extração de dados de 0 modelos corretos para 7 modelos com 12/13 campos cada. A abordagem de fallback é robusta, genérica e não introduziu regressão. O reconhecimento do fabricante é uma solução inteligente para a limitação do datasheet. A cobertura de 92.3% é excelente, considerando a ausência de um campo específico no documento original. A solução demonstra um avanço significativo na capacidade do parser.
