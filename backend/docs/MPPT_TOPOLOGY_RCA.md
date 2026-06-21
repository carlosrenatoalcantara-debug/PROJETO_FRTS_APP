# MPPT_TOPOLOGY_RCA.md

**Sprint:** P1-MPPT-TOPOLOGY-RCA-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Root Cause Analysis — Topologia MPPT / Entradas / Strings (READ-ONLY)

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente. **Revisão Gemini: PENDENTE.**

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM — ConfiguradorArranjoFV, GerenciadorArranjos, ProjetoFVContext,
                      gerarUnifilarSVG, schemas (ProjetoFV.js)
VALIDADO EM RUNTIME:  SIM — gravação de engenharia_eletrica testada no Railway/Atlas
                      (PUT 500 em projeto com o campo null; arranjo persistido vazio)
```

---

## RESULTADO

```
ATENDE PARCIALMENTE
```

O sistema **modela MPPTs** (um grupo de strings por MPPT) na UI e o **unifilar desenha** MPPT + strings + pontos de entrada. Porém: não há nível de **Entrada** (A/B por MPPT), strings são uma **contagem** (não editáveis individualmente), `modulosPorString` é **global**, a topologia **por-MPPT não é persistida** (schema só guarda o pior-caso) e a gravação de `engenharia_eletrica` **falha (500)** em projeto novo.

---

## FASE 1 — FORENSICS (onde mora cada coisa)

| Arquivo | Papel |
|---|---|
| `ConfiguradorArranjoFV.jsx` | Modela MPPTs do **Arranjo A**: `mppts=[{numStrings, modulosPorString}]` |
| `GerenciadorArranjos.jsx` | Arranjos secundários (B,C…): só `paineis[]/inversores[]/estrutura/orientacao` — **sem MPPT** |
| `ProjetoFVContext.jsx` | `arranjos[]` (multiarranjo) e `equipamentos.arranjoMPPTs` (via dispatch) |
| `gerarUnifilarSVG.js` | Desenha grupos MPPT + strings + pontos de entrada do inversor |
| `ProjetoFV.js` | `engenharia_eletrica.arranjo` (3 campos) e `arranjos[].configuracao_eletrica` |
| catálogo (`adaptarInversor`) | tem `entradas_por_mppt`/`strings_por_mppt` — **não usados como limite** |

---

## FASE 2 — MODELO ATUAL

| Pergunta | Resposta | Evidência |
|---|---|---|
| Conhece **MPPT**? | **SIM** | `mppts` = 1 entrada por MPPT físico (`nMppts`) no Configurador |
| **Entradas por MPPT**? | **NÃO** | Campo `entradas_por_mppt` existe no catálogo, mas o Configurador usa "strings paralelas" (contagem livre 0–10), sem nível de entrada A/B nem limite por entradas |
| **Quantidade máxima de strings**? | **PARCIAL** | Slider hardcoded `0–10`, não derivado de `entradas_por_mppt`/`strings_por_mppt` do inversor |
| **Strings independentes**? | **NÃO** | Strings são `numStrings` (contagem); todas idênticas; sem identidade/edição por string |
| **Módulos por string**? | **PARCIAL** | `modulosPorString` existe, mas é **GLOBAL** (`setModulosPorStringGlobal` aplica a todos os MPPTs) — não por-string nem por-MPPT |
| **Entradas vazias**? | **NÃO** (nível entrada) / MPPT vazio **SIM** | `numStrings=0` → "MPPT sem strings". Não há entrada parcial dentro de um MPPT |

---

## FASE 3 — CASO REAL (Huawei SUN2000-50KTL-M0: 6 MPPT, 12 entradas, 2/MPPT)

**Consegue representar?** **NÃO (plenamente).**

| Aspecto da topologia real | Sistema |
|---|---|
| 6 MPPTs | ✅ representa (mppts.length = nMppts) |
| 2 entradas por MPPT (A/B) | ❌ não modela entradas; só "strings paralelas" (contagem) |
| String por entrada | ❌ string = contagem, sem mapeamento a entrada |
| Módulos diferentes por string | ❌ `modulosPorString` global |
| MPPT parcialmente usado | ⚠ só no nível MPPT (numStrings=0), não por entrada |

**Onde quebra:**
1. **UI/modelo:** não há entidade "Entrada"; `modulosPorString` é global → impossível "MPPT1: entrada A=10 mód, entrada B=8 mód".
2. **Persistência (schema):** `engenhariaEletricaV3Schema.arranjo` só tem `quantidade_modulos_por_string`, `quantidade_strings_paralelo`, `total_modulos` — **sem `mppts[]`**. O payload `arranjo.mppts[]` do Configurador é descartado (strict).
3. **Persistência (runtime):** a 1ª gravação de `engenharia_eletrica` em projeto novo **falha com HTTP 500** (campo `null`, sem null-guard).
4. **Reidratação:** quando há legado, joga **todas** as strings no MPPT1 (`i===0 ? s : 0`).

---

## FASE 4 — MULTIARRANJO (hierarquia)

A hierarquia completa **NÃO** existe de forma uniforme:

```
Arranjo A (ConfiguradorArranjoFV):
  Inversor → MPPT[] → strings(CONTAGEM) → modulosPorString(GLOBAL)   ← sem nível Entrada

Arranjos B/C/D (GerenciadorArranjos):
  Inversor → quantidade de módulos                                    ← sem MPPT, sem string
```

- Apenas o **Arranjo A** tem detalhe MPPT (e mesmo assim sem entradas e com módulos/string global).
- `arranjos[].configuracao_eletrica` existe no schema (`n_mppts`, `strings_por_mppt`, `tensao_string_v`) mas **a UN nunca o popula** e são **contagens**, não estrutura por-MPPT.
- **Não existe** o nível "Entrada" em lugar nenhum.

---

## FASE 5 — UNIFILAR

O `gerarUnifilarSVG.js` **desenha**:
- ✅ **MPPT**: grupos por MPPT (`mpptCalc`, cores por MPPT)
- ✅ **Strings**: N strings por MPPT, cada uma "M módulos em série"
- ✅ **Entradas (pontos de conexão)**: `mpptYs` = pontos de entrada no lado esquerdo do inversor — **um ponto por MPPT** (não as 2 entradas físicas por MPPT)
- ✅ String box / DJ-DC quando `numStrings > 1`

**Limites:** desenha a partir de `arranjoMPPTs` (contagem); strings idênticas (mesmo `modulosPorString`); "entradas" = pontos MPPT, não entradas A/B. Como a config por-MPPT **não persiste**, o unifilar de um projeto reaberto parte do estado colapsado (ou da reidratação que empilha tudo no MPPT1).

---

## FASE 6 — GAPS (ver MPPT_TOPOLOGY_GAPS.json)

| ID | Gap |
|---|---|
| GAP-MPPT-01 | Entradas por MPPT não modeladas (campo existe, não usado como limite) |
| GAP-MPPT-02 | Strings não editáveis individualmente (apenas contagem `numStrings`) |
| GAP-MPPT-03 | Módulos por string é GLOBAL (não por-string nem por-MPPT) |
| GAP-MPPT-04 | MPPT parcial só no nível MPPT (numStrings=0); entradas vazias impossíveis |
| GAP-MPPT-05 | Schema `engenharia_eletrica.arranjo` não tem `mppts[]` → per-MPPT descartado |
| GAP-MPPT-06 | Reidratação empilha todas as strings no MPPT1 (`i===0?s:0`) |
| GAP-MPPT-07 | Multiarranjo secundário sem config elétrica (só quantidade) |
| GAP-MPPT-08 | `numStrings` sem limite por entradas do inversor (slider 0–10 fixo) |
| GAP-MPPT-09 | Sem nível "Entrada" na hierarquia |
| GAP-MPPT-10 | **(runtime)** Gravação de `engenharia_eletrica` falha 500 em projeto novo (campo null, sem null-guard como o de `workflow`) |

**Maior gap: GAP-MPPT-10 + GAP-MPPT-05** — a configuração MPPT **não persiste**: na 1ª gravação dá 500 e, mesmo corrigido o null, o schema descartaria o `mppts[]`. Tudo o que a UI modela evapora ao salvar/reabrir.

---

## FASE 7 — IMPACTO

| Módulo | Impacto | Por quê |
|---|---|---|
| Dimensionamento | MÉDIO | Usa `total_modulos`/`numPaineis` (ok); validação usa pior-caso de string |
| Engenharia | **ALTO** | Validação por-MPPT existe na UI mas não persiste; reabertura perde/colapsa; 500 na 1ª gravação |
| Unifilar | **ALTO** | Desenha a partir de config colapsada; não reflete 2 entradas/MPPT reais |
| Homologação | MÉDIO-ALTO | Memorial parte do arranjo persistido (worst-case/colapsado) |
| Digital Twin | **ALTO** | Sem entidade Entrada/String individual → impossível mapear ativo/telemetria por string/entrada |

---

## FASE 8 — ARQUITETURA FUTURA (proposta, sem implementar)

Modelo recomendado:
```
Arranjo → Inversor → MPPT → Entrada → String → quantidade_de_modulos
```

| Fabricante | Compatível? | Observação |
|---|---|---|
| Huawei (SUN2000, 2 entradas/MPPT) | ✅ | caso motivador — entradas A/B por MPPT |
| Sungrow (multi-MPPT) | ✅ | idem |
| Solis | ✅ | idem |
| Growatt | ✅ | idem |
| TSUN | ✅ | string e micro |
| Microinversores | ✅ (caso especial) | 1 módulo = 1 entrada; MPPT≡micro; já há caminho dedicado (`dimensionarMicro`) — manter |

**Recomendado: SIM.** O modelo Entrada→String generaliza o atual (string = contagem vira N entidades) e cobre todos os fabricantes citados. Micro permanece como projeção (1:1 módulo↔entrada).

**Compatibilidade retroativa:** ler `quantidade_modulos_por_string`/`quantidade_strings_paralelo` legados → derivar N strings idênticas distribuídas; novo schema aditivo (`mppts[].entradas[].strings[]`), default vazio para projetos antigos.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Como modela MPPT hoje:** array `mppts=[{numStrings, modulosPorString}]` (1 por MPPT físico do inversor) — só no **Arranjo A** (ConfiguradorArranjoFV). Secundários não têm MPPT.
2. **Como modela strings hoje:** como **contagem** (`numStrings` paralelas por MPPT), todas idênticas com `modulosPorString` **global**. Não há strings individuais.
3. **Conhece entradas por MPPT?** **NÃO** (o campo existe no catálogo, mas não é modelado nem limita as strings).
4. **Suporta módulos por string?** **PARCIAL** — existe, mas é global (igual em todas as strings/MPPTs).
5. **Suporta entradas vazias?** **NÃO** no nível de entrada; MPPT vazio sim (`numStrings=0`).
6. **Quantos gaps:** **10**.
7. **Maior gap:** **GAP-MPPT-10/05** — a configuração MPPT não persiste (500 na 1ª gravação + schema sem `mppts[]`).
8. **Modelo Arranjo→MPPT→Entrada→String recomendado?** **SIM** — compatível com Huawei/Sungrow/Solis/Growatt/TSUN e micro (caso especial).
9. **Necessita migração de dados?** **SIM** — novo schema aditivo (`mppts[].entradas[].strings[]`) + null-guard de `engenharia_eletrica`; projetos existentes têm só worst-case → leitura tolerante/backfill derivando strings a partir do legado.
10. **Commit gerado:** ver rodapé (RCA — sem alteração de código de produção).

---

## VEREDITO

```
ATENDE PARCIALMENTE — modela MPPT e desenha no unifilar (em sessão), mas sem
entradas, sem strings individuais, módulos/string global, e SEM persistência
confiável da topologia (500 na 1ª gravação + schema sem mppts[]). 10 gaps.
```
