# P1-PARSER-COLUMN-ALIGNMENT-01 — Deslocamento de coluna (SolaX X3-ULTRA / X1-SPT)

> Escopo: **parser matricial**. Sem alterar SSOT, **sem tocar o Atlas** (reprocesso é
> simulação — os dados persistidos NÃO foram reescritos). Fontes: datasheets SolaX X3-ULTRA e X1-SPT.

## FASE 1 — Modelos SolaX no Atlas (9)

`X3-ULT-15K · X3-ULT-15KP · X3-ULT-19.9K · X3-ULT-20K · X3-ULT-20KP · X3-ULT-25K · X3-ULT-30K`
(7) + `X1-SPT-10K · X1-SPT-12K` (2).

## FASE 2 — Comparação campo a campo (Atlas persistido vs PDF)

**X3-ULTRA (por modelo) — Atlas ANTES:**

| Campo | Atlas (persistido) | Correto (PDF) | Status |
|---|---|---|---|
| potencia_nominal | **2** (todos) | 15/15/19.9/20/20/25/30 | ❌ errado |
| potencia_maxima | 27.5 (todos) | 16.5…33 (por modelo) | ❌ errado |
| n_mppts | 2/3… | 2/3… | ✅ |
| corrente_mppt | 36 | 36 | ✅ |
| isc | 45 | 45 | ✅ |
| tensao_max | 1000 | 1000 | ✅ |
| mppt_min | **∅** | 120 | ❌ ausente |
| mppt_max | **∅** | 950 | ❌ ausente |

→ **X3-ULTRA Atlas: 4/8** acertos por modelo. **X1-SPT: 8/8** (já correto).

## FASE 3 — Onde ocorre o deslocamento

Três defeitos, todos no **matricial**:

1. **Falso-match BACKUP → potência = 2.** A linha *"Peak EPS output power"* (modo backup)
   casava o alias `Output Power`; o valor *"**2** time of rated power, 10s"* virava
   `potencia_kw=2` (replicado a todos por carry-forward). A potência real da rede ficava perdida.
2. **Right-alignment shift (+1 coluna).** Os valores numéricos são **alinhados à direita** na
   célula → o `x` (borda esquerda) fica à direita do header da própria coluna e cai mais perto
   do header da coluna **seguinte**. Ex.: `15000 VA` em x=233 ficava mais perto de `15KP@256`
   que de `15K@204` (midpoint 230) → atribuído à coluna errada.
3. **Rótulo MPPT não reconhecido.** A faixa MPPT do X3-ULTRA é rotulada *"Operating voltage
   range"* (sem a palavra "MPPT") → não casava o detector → `mppt_min/max` ausentes.

## FASE 4 — Correção (somente parser matricial)

1. **Pular linhas de backup/bateria**: `if (/\bEPS\b|\bUPS\b|backup|charge|discharge|battery|
   bateria/i.test(label)) continue` — elimina o falso-match de potência/corrente.
2. **Recuo de right-alignment**: antes do nearest-match, recua o `x` do valor por ~25% do gap
   médio de coluna (`min(gap*0.25, 18)`). Valores centralizados não trocam de coluna (o recuo é
   menor que meia-distância ao header vizinho) → corrige o shift sem regressão.
3. **MPPT por "Operating voltage range"**: adicionado ao detector de faixa MPPT (linhas de
   bateria/AC já são puladas antes, então é seguro).

## FASE 5 — Reprocesso (simulado, sem escrever no Atlas)

**X3-ULTRA DEPOIS:**

| Modelo | pot | n_mppts | Imppt | Isc | Vmáx | MPPT |
|---|---|---|---|---|---|---|
| X3-ULT-15K | **15** | 2 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-15KP | **15** | 3 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-19.9K | **19.9** | 2 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-20K | **20** | 2 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-20KP | **20** | 2 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-25K | **25** | 3 | 36 | 45 | 1000 | **120–950** |
| X3-ULT-30K | **30** | 3 | 36 | 45 | 1000 | **120–950** |

X1-SPT permanece correto (10/12, MPPT 35–490, Vmáx 500, Imppt 18, Isc 22) — **sem regressão**.

## FASE 6 — Relatório (métricas)

| | Acertos ANTES | Acertos DEPOIS | Cobertura |
|---|---|---|---|
| X3-ULTRA (7×8) | 28/56 (50%) | **49/56 (87.5%)** | +37.5 pp |
| X1-SPT (2×8) | 16/16 (100%) | 16/16 (100%) | — |
| **Total (9 modelos)** | **44/72 (61%)** | **65/72 (90.3%)** | **+29 pp** |

- **Campos corrigidos:** **21** (potência ×7, mppt_min ×7, mppt_max ×7).
- **Cobertura final:** **90.3%**.
- **Resíduo:** `potencia_maxima` do X3-ULTRA (7 slots) — a linha *"Max output apparent power"*
  está **quebrada/wrapped** no PDF (só 2 dos 7 valores na mesma linha) → carry-forward replica
  27.5. É limitação de layout (linha multi-linha), não de associação de coluna; fica para refino futuro.

### ⚠️ Atlas não foi alterado
O bug (`potencia=2`, MPPT ausente) **continua persistido** nos 9 docs SolaX — esta sprint **só
corrige o parser** e prova o reprocesso. Aplicar ao Atlas exige uma sprint de **escrita
controlada** (`P1-CATALOG-DATASHEET-RECOVERY-01`), preservando IDs/histórico.

## Validação / Regressão

- Fixtures: `golden/solax_x1_spt.json`, `golden/solax_x3_ultra.json`.
- Teste `solaxColumns.test.js` (7): 7 modelos X3-ULT, potência 15–30 (≠2), MPPT 120–950,
  compartilhados; X1-SPT 10/12 intacto.
- Suíte **642 passed** (+7); 14 falhas pré-existentes de `diagram` (jsdom) inalteradas.
- **Goldens 24/24** (o recuo + os skips não regridem GoodWe/Sungrow/Solplanet/Deye/CHINT/Kehua/SAJ).
- Build OK.

### Conclusão
O X3-ULTRA passou de **4/8 → 7/8** campos corretos por modelo (potência `2`→`15-30`, MPPT
`∅`→`120-950`), com 3 correções no matricial (skip backup, recuo de right-align, rótulo MPPT) —
sem tocar SSOT/Atlas e sem regressão. Resíduo único: `potencia_maxima` (linha wrapped).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARSER-COLUMN-ALIGNMENT-01

A sprint P1-PARSER-COLUMN-ALIGNMENT-01 abordou problemas críticos no parser matricial de datasheets SolaX, especificamente para os modelos X3-ULTRA e X1-SPT. A análise detalhada dos problemas e das soluções propostas é apresentada a seguir.

**Análise das Correções e Questões:**

1.  **Recuo de 25% do Gap Médio (Segurança e Princípio):**
    *   **Princípio:** A abordagem de ajustar o `x` do valor numérico antes do `nearest-match` para compensar o alinhamento à direita é um princípio sólido para resolver o problema de deslocamento de coluna. A ideia de que valores centralizados não são afetados é logicamente correta, pois o ajuste é relativo à borda esquerda do valor e não à sua posição central.
    *   **Segurança (Regressão):** A validação com os "Goldens 24/24" e a ausência de regressão na suíte de testes (642 passed) indicam que esta correção é segura. O ajuste de 25% do gap médio parece ser uma heurística eficaz que evita afetar dados corretamente alinhados ou centralizados em outros parsers.

2.  **Pular Linhas de Backup/Bateria (Correção para Inversor de Rede):**
    *   **Correção:** Para um inversor de rede (on-grid), as funcionalidades de backup/bateria (EPS/UPS, charge/discharge) são secundárias ou inexistentes em muitos modelos. Portanto, pular essas linhas é uma correção **correta e necessária** para evitar a captura de dados irrelevantes ou incorretos que se sobrepõem aos dados de operação principal do inversor. Isso previne o falso-match da `potencia_nominal`.

3.  **Reconhecer "Operating Voltage Range" como Faixa MPPT (Segurança):**
    *   **Segurança:** Reconhecer "Operating voltage range" como faixa MPPT é **seguro** no contexto desta sprint. As linhas de bateria/AC já estão sendo puladas, o que elimina a possibilidade de confundir faixas de operação de bateria com faixas MPPT. Dado que o objetivo é capturar a faixa de tensão de operação dos painéis solares, este rótulo é um forte indicador.

4.  **Honestidade (Atlas Não Alterado, Resíduo `potencia_maxima`):**
    *   **Adequação:** A honestidade em reportar que o Atlas não foi alterado e que o resíduo `potencia_maxima` persiste devido a um problema de layout no PDF é **altamente adequada e profissional**.
        *   **Atlas Não Alterado:** É crucial para a integridade dos dados históricos e para a clareza do que foi corrigido nesta sprint. A distinção entre a correção do parser e a aplicação ao banco de dados é fundamental.
        *   **Resíduo `potencia_maxima`:** Identificar e documentar limitações causadas pela fonte (PDF wrapped) demonstra um entendimento profundo do problema e evita falsas promessas. A menção de que isso "fica para refino futuro" é apropriada.

**Métricas e Resultados:**

*   O aumento na cobertura de 61% para 90.3% (44/72 para 65/72) é significativo e demonstra o impacto positivo das correções.
*   A correção de 21 campos, especialmente `potencia_nominal` e a introdução de `mppt_min`/`mppt_max`, resolve problemas centrais.
*   A manutenção de 100% de acertos para o X1-SPT e a ausência de regressão nos goldens validam a robustez das mudanças.

**Veredito:**

**APROVADO**

**Justificativa:**

A sprint P1-PARSER-COLUMN-ALIGNMENT-01 demonstrou um trabalho de revisão e correção de alta qualidade no parser matricial. As soluções implementadas são tecnicamente sólidas, seguras e abordam diretamente os problemas identificados, resultando em um aumento substancial na precisão e cobertura dos dados extraídos. A abordagem de ajuste de alinhamento é inovadora e validada pela ausência de regressão. A honestidade na comunicação sobre o estado do Atlas e os resíduos remanescentes é um ponto forte, garantindo transparência e expectativas realistas. A separação clara entre a correção do parser e a necessidade de uma sprint futura para aplicar as mudanças ao Atlas é a prática correta.
