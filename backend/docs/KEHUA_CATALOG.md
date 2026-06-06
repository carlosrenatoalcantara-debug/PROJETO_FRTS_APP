# P0-KEHUA-CATALOG-01 — Kehua como fabricante de primeira classe

## FASE 1 — Auditoria forense (6 datasheets reais)

| PDF | Tipo | OCR | alias "Kehua"? | modelos | fonte parser | cobertura* |
|---|---|---|---|---|---|---|
| SPI 6000-B2 | imagem (32 ch) | sim (2984) | ❌ (rodapé perdido) | SPI6000-B2 (OCR "SP13000-B2") | texto/OCR | 5→9/13 |
| spi 30k-b x2 | imagem (32 ch) | sim (3083) | ✅ "Kehua Tech" | SPI30K~36K-B X2 | texto/OCR | 4→7/13 |
| SPI8K~12K-B X2 | texto (2518) | não | ✅ | SPI8K/10K/12K-B X2 | matricial | 11→12/13 |
| SP15~25K-B X2 | texto (2466) | não | ❌ | SPI15/17/20/23/25K-B X2 | matricial | 11→12/13 |
| SPI30~36K-B X2 | texto (2311) | não | ❌ | SPI30/33/36K-B X2 | matricial | 11→12/13 |
| SPI50-60K-B X2 | texto (2298) | não | ❌ | SPI50/60K-B X2 | matricial | 11→12/13 |

\* cobertura sobre 13 campos canônicos. `corrente_isc_max` é **ausente de fábrica**
nos datasheets Kehua (não há linha de Isc por MPPT; só "AC short circuit
protection: Yes") — logo o teto real dos PDFs de texto é **12/13**, não falha do parser.

**Onde quebrava (ANTES):**
1. `fabricante = null` em TODOS — Kehua inexistente no catálogo. A palavra "Kehua"
   só aparece em 2 dos 6 PDFs (rodapé) → necessário regex de família como **órfão**.
2. `corrente_max_por_mppt` perdida nos PDFs de texto — rótulo Kehua é
   `Max.current per MPPT` (sem espaço após o ponto); alias exigia `\s+`.
3. `corrente_max_por_mppt` ausente no SPI50-60K — célula mesclada "40A" centralizada
   entre as 2 colunas, descartada pela tolerância posicional.
4. OCR de imagem: `potência`, `IP`, `dimensões` corrompidos ("Poténcia", "Grau IP P65",
   "360%x420%125 mm") não casavam os extratores.

## FASE 2 — Família semântica Kehua (sem hardcode por modelo)

`fabricanteModeloFallback.js`: entrada `Kehua`, aliases
`kehua / kehua tech / kehua digital / kehua technology / kehua.com`, família
`SPI<potência>[K]-<variante>[ X<n>]` com variantes `B/S/T/X/HT`. Aceita
`SPI15K-B`, `SPI 15K-B`, `SPI15K B`, `SPI-15K-B`. Regex também registrado como
**modelo órfão** (datasheets sem a palavra "Kehua") com tolerância de OCR `SPI→SP1`.

## FASE 6 — Medição (cobertura por campo, 6 PDFs)

| Campo | ANTES | DEPOIS | Meta | Status |
|---|---|---|---|---|
| fabricante | 0/6 | **6/6 (100%)** | ≥100% | ✅ |
| modelo | 0/6 (lixo) | **6/6 (100%)** | ≥100% | ✅ |
| potência | 4/6 | **6/6 (100%)** | ≥95% | ✅ |
| MPPT (n_mppts) | 6/6 | **6/6 (100%)** | ≥90% | ✅ |
| correntes (max/MPPT) | 2/6 | **6/6 (100%)** | ≥90% | ✅ |
| IP | 4/6 | **6/6 (100%)** | ≥95% | ✅ |
| peso | 6/6 | **6/6 (100%)** | ≥90% | ✅ |
| dimensões | 4/6 | **6/6 (100%)** | ≥90% | ✅ |

Campos só recuperados em PDF de texto (OCR de imagem não os recupera, degradação
aceitável de fonte): `tensao_max_entrada`, `tensao_mppt_min/max`, `eficiencia` (4/6).
`corrente_isc_max`: 0/6 — **inexistente nos datasheets** (não inventar).
Valores de OCR de imagem são marcados 🟡 `inferido_alta` (não 🟢).

## FASE 8 — Fabricantes com risco histórico similar (APENAS DOCUMENTAÇÃO)

| Fabricante | Extrai (parser) | Persiste | No catálogo | Observação |
|---|---|---|---|---|
| **Sofar** | parcial (genérico) | sim se fab. casar | ❌ | Séries SOFAR/HYD ES — sem alias; cai em órfão genérico. Candidato P1. |
| **Livoltek** | parcial | sim se fab. casar | ❌ | Séries GTx/Hyper — sem alias. Candidato P1. |
| **Intelbras Inversor** | EV apenas | parcial | ⚠️ parcial | `Intelbras` existe só p/ carregadores (EVE/EWS/EVB). Inversores solares (EWS-xxx) não cobertos como inversor. |
| **SAJ** | sim | sim | ✅ | Já coberto (R5/R6/Suntrio) na P1-INV-HARDEN-PLUS-01. |

### Limitação conhecida (OCR de imagem single-model)
`expandirModelosInversor` sobre-extrai tokens-lixo de OCR muito ruidoso
(ex.: "YR0ESPECIFICAGDO"), gerando variantes espúrias além do modelo correto.
É comportamento **genérico de OCR** (não específico de Kehua) — fora do escopo
desta sprint. Recomendação: filtro de validade de modelo no caminho OCR single-model.
