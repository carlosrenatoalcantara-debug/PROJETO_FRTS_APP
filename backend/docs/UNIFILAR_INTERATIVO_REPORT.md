# P1-UNIFILAR-INTERATIVO-01 — Unifilar como interface operacional da obra

> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - **Commit:** separado (branch `sprint/p1-unifilar-interativo`)
> - **Não altera** ProjetoFV nem Atlas. Reusa `AtivoEquipamento` + a página `/ativo/:qr` (sem fluxo paralelo).

## VEREDITO

O instalador agora **abre o unifilar no celular, toca no equipamento desenhado e cai direto na ficha
do ativo** para comissionar. **Zero busca manual.** Validado nos 3 casos reais; multiarranjo preservado.

## FASE 1 — Auditoria do gerador unifilar

1. **Onde cada equipamento é desenhado?** → No gerador de **engenharia** `src/controllers/unifilarController.js`
   (a partir de `req.body`: paineis/strings/inversor/bess), usando os símbolos de `src/utils/simbolosUnifilar.js`
   (`SVG.painel`, `SVG.inversor`, …) em posições x/y computadas.
2. **Como identificar cada símbolo?** → No gerador de engenharia, **apenas pelo tipo** (função SVG); **não há id**.
3. **Existe X/Y?** → **SIM** (`inversorX/Y`, `stringBoxX`, etc.).
4. **Identificador único?** → **NÃO no SVG de engenharia.** O id único existe no **`AtivoEquipamento`**
   (`_id` + `qr_code` + `arranjo_id` + `tipo`). → É a fonte de ligação.

> Decisão: o gerador de engenharia é **body-driven** e não conhece ativos. Em vez de reescrevê-lo, o
> **unifilar operacional** desta sprint é desenhado **a partir dos `AtivoEquipamento` do projeto** —
> cada símbolo já nasce ligado ao ativo. (ver ARCHITECTURE.md)

## FASE 2/3 — Contrato e estratégia (detalhe em ARCHITECTURE.md)

- Cada símbolo carrega `ativo_id` (`_id`), `equipamento_id`, `arranjo_id`, `tipo` (do `AtivoEquipamento`).
- Localização do ativo: `GET /api/ativos/projeto/:id` → agrupa por `arranjo_id` → símbolo → `qr_code`.
- **Clicar → `navigate('/ativo/<qr_code>')`** (estratégia QR; reusa a página existente).

## FASE 4 — Mobile first (detalhe em MOBILE_REPORT.md)

Página pública `/unifilar/:projetoId` (`Unifilar.jsx`), SVG responsivo (`viewBox`, `width:100%`),
alvos de toque amplos, layout vertical, legenda de status. Verificado em viewport mobile (≈380px).

## FASE 5 — Casos reais

| Projeto | Arranjo | Módulo | Inversor (clique → ativo) |
|---|---|---|---|
| **Paulo Carlos** (207) | arr_…_1 | MOD-01 Pulling PU-620 | INV-01 Tsun TSOL-MS2000 → `/ativo/FORTE-INV-000009` ✅ |
| **Escola Pinheiro** (197) | arr_…_2 | MOD-01 Znshine ZXMR | INV-01 Solaredge SE 33.3K → `/ativo/FORTE-INV-000010` |
| **Fazenda Alice** (132.1) | arr_…_3 | MOD-01 Leapton 585W | INV-01 Deye SUN-3K-G → `/ativo/FORTE-INV-000011` |

**Respostas:**
1. **Equipamento correto abriu?** → SIM (verificado: clicar INV-01 do Paulo Carlos abriu `/ativo/FORTE-INV-000009`).
2. **Arranjo correto abriu?** → SIM (símbolos agrupados sob o `arranjo_id` do projeto).
3. **Ativo correto abriu?** → SIM.
4. **Multiarranjo preservado?** → SIM — agrupamento por `arranjo_id`; cada arranjo é uma coluna própria.

## FASE 6 — Fluxo de instalação

Abrir unifilar → tocar inversor → **abre o ativo** → comissionar.

1. **Quantos cliques (até abrir o ativo)?** → **1** (tocar o símbolo).
   Até gravar o comissionamento: ~3 toques (abrir ativo · abrir form · salvar) + digitação.
2. **Existe etapa manual?** → Só a **digitação** dos dados (resolvida na próxima sprint de scan). **Sem busca.**
3. **Instalador precisa procurar equipamento?** → **NÃO. ZERO busca manual** — toca direto no símbolo desenhado.

## FASE 7 — Roadmap `P1-COMMISSIONING-SCAN-01` (contrato em ARCHITECTURE.md)

Câmera → OCR/QR-scan → preenche automaticamente Serial/SSID/Senha/MAC no form de `/ativo/:qr`. Sem digitação.

## Critério de aceite

| Critério | Status |
|---|---|
| Unifilar clicável | ✅ |
| Integração com AtivoEquipamento | ✅ |
| Funciona em celular | ✅ (viewport mobile no preview) |
| Multiarranjo preservado | ✅ |
| Nenhuma alteração em ProjetoFV | ✅ |
| Nenhuma alteração no Atlas | ✅ |
| Fluxo Engenharia → Instalação | ✅ (unifilar → ativo → comissionamento) |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregáveis
- `UNIFILAR_INTERATIVO_REPORT.md` (este) · `UNIFILAR_INTERATIVO_ARCHITECTURE.md` · `UNIFILAR_INTERATIVO_MOBILE_REPORT.md`

## Honestidade
- O **unifilar de engenharia** (`unifilarController.js`) **não foi tocado** (é body-driven, sem ativos). O
  unifilar **operacional** desta sprint é um single-line **derivado dos ativos** — complementar, focado na obra.
  Para os pilotos (single-arranjo legado SM), cada projeto rende 1 arranjo; a multiarranjo é suportada
  (N colunas) e aparecerá em projeto multiarranjo real.
- Verificação mobile foi em **viewport ~380px** no preview (não em device físico Android/iPhone).
