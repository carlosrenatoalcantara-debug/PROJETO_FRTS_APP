# P1-PARSER-STARTVOLTAGE-01 — Extração real de `tensao_partida`

> Escopo: **parser** (`parserTecnicoInversor` + `parserMatricial`). Sem alterar SSOT, sem
> tocar o Atlas, sem migração, sem gravar estimados, sem mexer nas regras de fallback.
> Aliases adicionados **somente com evidência real** em fixtures/PDF.

## FASE 1/2 — Inventário de aliases (com evidência)

| Rótulo (alias) | Fabricante(s) | Fixture exemplo | Valor extraído |
|---|---|---|---|
| `Start Voltage` (sem -up) | **Huawei, Chint** | `huawei_m2`, `chint_sca` | 200, 250 |
| `Start-up Voltage (V)` | **GoodWe** (DT) | `goodwe_dt` | 250 |
| `Start-up voltage(V)` | **Solis** | `solis_30k_ocr` | 350 |
| `Starting voltage` | **Kehua** | `kehua_spi_commercial/utility` | 180 |
| `Tensão de partida` | **GoodWe** (MS), **Hopewind**, **Sungrow** | `goodwe_ms`, `hopewind`, `sungrow_sg110cx` | 50, 55, 180 |
| `Tensão de inicialização (V)` | **Deye** | `deye_2330` | 250 |
| `Tensão de Partida por Entrada` | TSUN | `tsun_mx3000d` | (layout não pareado — ver FASE 6) |
| — (ausente) | **Solplanet** | `solplanet_7300` | datasheet **não publica** tensão de partida |

## FASE 3 — Parser (aliases + matcher)

`ROTULOS_BASE.tensao_partida = ['Start(?:ing|[\s-]*up)?\s+Voltage', 'Tens[ãa]o de partida',
'Tens[ãa]o de inicializa[çc][ãa]o']` (o sufixo `-up/-ing` é **opcional** para cobrir
Huawei/Chint "Start Voltage"). Extrator em `CAMPOS`: `_valor(..., { min: 30, max: 600 })`
(faixa física: ~40 V híbridos a ~450 V string; não colide com tensão máx CC ≥1000 nem com
o MPPT). Como o rótulo virou matcher, o **matricial** também extrai → adicionado
`_RANGES.tensao_partida = [30, 600]`.

## FASE 4 — Testes (`startVoltage.test.js`, 13)

- Valor correto por rótulo (Start Voltage 200, Start-up 250, Starting 180, Tensão de
  partida 55, Tensão de inicialização 250, rótulo composto Sungrow 200).
- **Ausência sem falso positivo:** texto sem rótulo → ausente; "Output/Input Voltage" não
  confundidos; valor fora de `[30,600]` rejeitado.
- Fixtures reais (matricial): Deye `[250,250,250]`, GoodWe DT 250; Huawei texto 200.

## FASE 5 — Cobertura ANTES → DEPOIS

**Nas fixtures (capacidade do parser):**

| | Fixtures com `tensao_partida` |
|---|---|
| **ANTES** | **0** (campo inexistente no parser) |
| **DEPOIS** | **11** (Chint, Deye, GoodWe×2, Hopewind, Huawei×2, Kehua×2, Solis, Sungrow) |

**Nos 22 inversores do catálogo (Atlas):** o parser passa a **saber extrair** para os
fabricantes que cobrem **20/22** (Goodwe 9 + Huawei 6 + Chint 2 + Solis 2 + Deye 1).
Solplanet (2) **não tem o campo** no datasheet. **Porém**, os 22 documentos não armazenam o
datasheet de origem e **não há migração nesta sprint** → a contagem real do Atlas só muda
quando os PDFs forem **reprocessados** (sprint futura). Hoje os 22 seguem no fallback.

## FASE 6 — Regressão

- Suíte: **627 passed** (+13). As 14 falhas pré-existentes de `diagram` (jsdom) inalteradas.
- **Zero alteração de outros campos:** os golden tests (Sungrow/GoodWe/Solplanet/Deye/CHINT…)
  continuam verdes — o novo matcher só captura rótulos de partida (não rouba outros campos).
- Build OK.

## FASE 7 — Respostas

1. **Quais aliases foram encontrados?** `Start Voltage`, `Start-up/Starting Voltage`,
   `Tensão de partida`, `Tensão de inicialização` (todos com evidência em fixtures).
2. **Quantos fabricantes passaram a extrair?** **8** — Chint, Deye, GoodWe, Hopewind, Huawei,
   Kehua, Solis, Sungrow.
3. **Quantos inversores deixaram de usar fallback?** **0 imediatamente** (os 22 do Atlas não
   têm datasheet armazenado e não há migração nesta sprint). O parser fica **pronto para
   20/22** quando reprocessados.
4. **Quantos ainda dependem do fallback?** **22 hoje**; após reprocesso, **2** (Solplanet)
   permaneceriam, pois o datasheet não publica o campo.
5. **Existe fabricante que exige tratamento específico?** **Huawei/Chint** ("Start Voltage"
   sem sufixo → exigiu tornar `-up/-ing` opcional). **Solplanet** não publica o campo. **TSUN**
   (rótulo "por Entrada") e **Sungrow RT** (só menção em prosa) não pareiam o valor no layout
   atual — ficam para refinamento futuro.
6. **Próxima sprint recomendada?** **P1-CATALOG-DATASHEET-RECOVERY-01** — reprocessar os PDFs
   originais dos 22 inversores (parser já extrai `tensao_partida` p/ 20/22), gravando o valor
   REAL no Atlas com proveniência e reduzindo de fato o uso do fallback.

### Conclusão
O parser agora **extrai `tensao_partida` real** de 8 fabricantes (0→11 fixtures), com aliases
só onde há evidência e sem falso positivo. A redução efetiva do fallback nos 22 do catálogo
ocorrerá no reprocesso dos datasheets (próxima sprint) — Solplanet permanecerá no fallback
por ausência do campo na fonte.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARSER-STARTVOLTAGE-01

A sprint P1-PARSER-STARTVOLTAGE-01 aborda a extração do campo `tensao_partida` (startup voltage) para o parser de datasheets, um campo que anteriormente estava 100% ausente. As restrições de não alterar SSOT, não tocar Atlas, não migrar e não inventar aliases foram respeitadas.

**Avaliação:**

1.  **Aliases e Generalização:** Os aliases adicionados ("Start Voltage", "Start-up Voltage", "Starting Voltage", "Tensão de partida", "Tensão de inicialização") possuem evidência em fixtures reais de 8 fabricantes distintos. A generalização "Start Voltage" com sufixo opcional (`-up/-ing`) parece segura, pois foi validada em fixtures e a cobertura de fixtures aumentou de 0 para 11. O teste de "ausência sem falso positivo" confirma que outros campos como "Output/Input Voltage" não são confundidos e valores fora da faixa são rejeitados.

2.  **Honestidade do Reporte:** A honestidade em reportar que 0 inversores foram alterados *hoje* no Atlas é correta e transparente. A sprint foca na capacidade do parser de extrair o dado, com a expectativa de que a aplicação real no Atlas ocorra em sprints futuras com o reprocessamento dos datasheets. A distinção entre a capacidade do parser e a atualização do catálogo é crucial.

3.  **Faixa e Ausência de Regressão:** A faixa de [30,600]V para `tensao_partida` é adequada, cobrindo a amplitude física esperada para este parâmetro e sem colidir com outras tensões críticas. A ausência de regressão, com 627 testes passando e zero alteração em outros campos, demonstra a robustez da implementação.

**Veredito:**

**APROVADO**

**Justificativa:** A sprint cumpre rigorosamente o escopo definido, adicionando uma funcionalidade essencial de extração de dados com base em evidências concretas. Os aliases são bem fundamentados, a generalização é segura, e os testes validam a correção e a ausência de efeitos colaterais indesejados. A comunicação sobre o impacto imediato no Atlas versus a capacidade futura é clara e honesta. A faixa de valores e a ausência de regressão são adequadas. A recomendação para a próxima sprint de reprocessamento dos PDFs é lógica e alinha a capacidade recém-adquirida com a atualização do catálogo.
