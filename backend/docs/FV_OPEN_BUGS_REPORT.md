# Sprint P0-FV-OPEN-BUGS-CONSOLIDATION-01 — Relatório

**Data:** 2026-06-18
**Executor:** Opus (READ-ONLY)
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Natureza:** Auditoria de consolidação — **nenhuma alteração de código**, nenhum fix.

> **HONESTIDADE METODOLÓGICA:** auditoria **estática** (leitura de código + forenses anteriores).
> **NÃO** houve query ao Atlas vivo nem execução da aplicação. As contagens de catálogo
> vêm das forenses de 2026-06-15/17 e podem divergir do estado atual do banco.

---

## FASE 1 — Beneficiárias

| Item | Estado | Evidência |
|------|--------|-----------|
| **prioridade** | ❌ ABERTO (BUG-BEN-01) | `BeneficiariasPainel.jsx:48` fixa `tipoRateio:'percentual'`; o formulário (332-353) não tem seletor. `UnidadeBeneficiaria.js:31` aceita `['percentual','prioridade']`. Backend pronto, UI nunca envia 'prioridade'. |
| **percentual** | ✅ OK | `validarRateio` recalcula soma=100% em tempo real; badge mostra excedido/falta. |
| **preenchimento automático** | ✅ OK (parcial) | "Colar Excel" / "Importar CSV" → `parsearTextoExcel` detecta colunas (UC, Titular, CPF/CNPJ, Concessionária, %). Não captura tipoRateio (sempre percentual). |
| **persistência** | ✅ OK | CRUD via `/api/projetos-fv/:id/beneficiarias/*` (resumo, POST, PUT, DELETE, lote) → coleção `UnidadeBeneficiaria`. |
| Arquitetura | ⚠️ BUG-ARCH-01 | `BeneficiariasPainel.jsx:4` importa **direto de `backend/src/utils/...`** — acoplamento frontend↔backend. |

---

## FASE 2 — Layout Editor

| Cenário | Comportamento | Estado |
|---------|---------------|--------|
| Projeto novo | `AbaLayout` (linha 562) lê `snapshot_geoespacial` ou `layout_solar.roof_planes`; vazio → "Nenhum layout geoespacial registrado". | OK (esperado) |
| Legado | Idem; muitos legados sem geoespacial → vazio. | OK (esperado) |
| Congelado | Mostra geoespacial congelado (badge "· geoespacial congelado"), `PlanejadorTelhado bloqueado`. | OK |
| Multiarranjo | O **editor de diagrama** (`InteractiveDiagram`, modal "Editar Diagrama") usa cálculos genéricos (fallback da Sprint 1) e **não desenha múltiplos arranjos** FV. | ⚠️ BUG-LAY-01 (limitação, não regressão) |

O erro "Dados incompletos para inicializar diagrama" foi **corrigido** na sprint P0-LAYOUT-EDITOR-FV-RESTORE-01 (`82f26e4`). Resta a limitação de o editor (EV-exclusivo) não representar a topologia multiarranjo FV — reescrevê-lo foi explicitamente proibido na Sprint 1.

---

## FASE 3 — Potência desconhecida

Fonte: `UNKNOWN_POWER_INVENTORY.json` / `UNKNOWN_POWER_BY_MANUFACTURER.json` (2026-06-17).

- **122 inversores** sem especificações (69.7% de 175). `especificacoes{}` vazia — *identity-only import* do SolarMarket.
  - **Deriváveis por regex do modelo: 87** (ex.: `SUN-25K-G → 25kW`, `TECH SPI20K-B → 20kW`).
  - **Não deriváveis: 35** (MIC/MIN/NEO/TL3-S codificam watt; micros Tsun/Apsystems; SolarEdge 403).
- **3 módulos** sem potência (1.6%) — **0 projetos afetados**.
- **Impacto ativo:** projeto **"Cristiano 600kw"** (Goodwe GW8000-DT, `potencia_kw=null`).
- **Enriquecimento:** WAVE1 (+5) e WAVE1B (+3) aplicados, mas `WAVE1B.fase6` reporta **~122 ainda sem specs**. A tentativa P1-INVERTER-DATASHEET-ENRICH-01 enriqueceu **0** (sem API key, sem datasheets locais).

### Separação derivável × não derivável
| | Inversores | Módulos |
|---|---|---|
| Derivável (regex/nome) | 87 | (n/d) |
| Não derivável (datasheet/manual) | 35 | 3 |

**Bloqueador transversal (BUG-QUAL-01):** regras de plausibilidade calibradas para STRING geram falso-positivo em micro (`MPPT_INCOERENTE` exige `MPPT_max < Voc_max_DC` estrito; datasheets legítimos têm `==`); e `origem=import_solarmarket` está fora de `BASE_POR_ORIGEM` → confiança base 20 → nenhum item atinge "utilizável" (75) mesmo com completude 95. **4/5 da WAVE1 permaneceram inválidos apesar de specs corretas.**

---

## FASE 4 — equipamento_id (MAPEADO, não corrigido)

- **Seleção nova (wizard):** `E7Equipamentos.jsx:131/139` grava `equipamento_id = painel._id || null` / `inversor._id || null` — **preenchido** quando o item do catálogo tem `_id`.
- **Legado / SolarMarket:** arranjos com `equipamento_id=null` (forense: "equipamento_id=null em todos os arranjos" dos 2 projetos configurados na época).
- **Snapshots:** `snapshotEquipamento` (`engenhariaGovernanca.js:213`) herda `equipamento_id = eq._id || eq.id || null`.
- **Catálogo / consumo:**
  - `homologacaoController._carregarDepsDocumento` carrega Atlas vivo **por `equipamento_id`** (refValida) → com null, **não carrega** Atlas; cai em inline/snapshot.
  - `detectarDivergencia` tenta `equipamento_id` e cai em `(fabricante, modelo)`.

**Impacto:** para projetos legados, a vinculação ao Atlas vivo por ID é inoperante; documentos e divergência funcionam por nome (fabricante+modelo, case-insensitive). Não é defeito de código — é **completude de dados**. Correção (backfill) exigiria migração de dados do Atlas → **fora desta sprint** (FASE 4: não corrigir).

---

## FASE 5 — Scanner

| Item | Estado | Evidência |
|------|--------|-----------|
| **câmera** | ✅ OK | `getUserMedia({ facingMode: environment })`; falha → estado `sem_camera` + fallback. |
| **OCR** | ✅ OK (com ressalva) | `tirarFoto` → canvas → blob → `POST /api/ativos/scan`. **Só a partir da câmera ao vivo.** |
| **QR** | ⚠️ BUG-SCAN-02 | `BarcodeDetector` (Android/Chrome). **iOS Safari não tem** → QR automático não funciona; cai em foto/colar. |
| **upload galeria** | ❌ ABERTO (BUG-SCAN-01) | **Não existe** `<input type=file accept=image/*>`. Sem câmera, o usuário só pode **colar texto** — não há como enviar foto salva para OCR. |

> O `EtiquetaScanner` pertence a **Ativos/Comissionamento/QR** (sob restrição "Não alterar"). Correções exigem liberação de escopo.

---

## FASE 6 — Classificação

| Prioridade | Bugs |
|-----------|------|
| **P0** | BUG-QUAL-01 (regras de qualidade), BUG-CAT-01 (122 inversores sem specs) |
| **P1** | BUG-BEN-01 (prioridade rateio), BUG-EQID-01 (equipamento_id legado), BUG-SCAN-01 (upload galeria), BUG-ART-01 (transporte ART) |
| **P2** | BUG-SCAN-02 (QR iOS), BUG-LAY-01 (editor multiarranjo), BUG-ARCH-01 (import cross-camada), BUG-MOD-01 (3 módulos) |

---

## RESPOSTAS DIRETAS

1. **Bugs ainda abertos (10):** BUG-CAT-01, BUG-QUAL-01, BUG-BEN-01, BUG-SCAN-01, BUG-SCAN-02, BUG-EQID-01, BUG-ART-01, BUG-LAY-01, BUG-ARCH-01, BUG-MOD-01.
2. **Bugs já corrigidos (8):** GAP-01..04 (P0-FV-WORKFLOW-RESTORE-01), Layout FV (P0-LAYOUT-EDITOR-FV-RESTORE-01), PDF Kit (P1-FV-PDF-KIT-RESTORE-01), Freeze/APROVADO (P1-FV-FREEZE-TO-ENGINEERING-01), Homologação snapshot (P1-HOMOLOGACAO-SNAPSHOT-01).
3. **Regressões encontradas:** **0** na revisão estática. **Não executei runtime nem query ao Atlas** — não afirmo ausência de regressão em runtime.
4. **Prioridade:** 2× P0, 4× P1, 4× P2 (ver matriz).
5. **Esforço:** P0 = medium+medium; P1 = small (BEN/SCAN/ART) + medium (EQID); P2 = small a large.
6. **Dependências:** BUG-CAT-01 depende de BUG-QUAL-01; BUG-EQID-01 depende de BUG-CAT-01; BUG-SCAN-02 depende de BUG-SCAN-01. Itens de Ativos/QR/Comissionamento e migração de Atlas exigem liberação de restrição.
7. **Próxima sprint recomendada:** **P0-FV-CATALOG-QUALITY-RECAL-01** — recalibrar regras de qualidade (BUG-QUAL-01) e então enriquecer os 87 inversores deriváveis + Goodwe GW8000-DT (BUG-CAT-01). É o gargalo de maior alcance e agora afeta diretamente a fidelidade dos snapshots e da homologação. Os fixes de UI de baixo risco (BUG-BEN-01, BUG-ART-01) podem ir em uma sprint P1 paralela.

---

## Restrições respeitadas

Auditoria **READ-ONLY**. Atlas não consultado/alterado. ProjetoEV, Ativos, QR, Comissionamento não tocados. Nenhuma correção aplicada (inclui FASE 4, explicitamente "não corrigir ainda").
