# GARANTIA_SIMPLES_REPORT.md

**Sprint:** P5-GARANTIA-SIMPLES-01
**Modelo:** Sonnet
**Data:** 2026-06-19
**Revisão Gemini:** Opcional

---

## OBJETIVO

Transformar a Garantia em uma funcionalidade simples de consulta operacional. O técnico ou operador visualiza rapidamente fabricante, prazo, datas, dias restantes e contato do fabricante — sem chamados, SLA, workflow ou tickets.

---

## FASE 1 — FORENSE

### Campos já existentes (antes desta sprint)

| Campo | Onde | Status |
|---|---|---|
| `garantia_produto {value, unit}` | `Equipamento` | ✓ já existia |
| `garantia_performance {value, unit}` | `Equipamento` | ✓ já existia |
| `garantia_inicio` | `AtivoEquipamento` | ✓ já existia |
| `garantia_fim` | `AtivoEquipamento` | ✓ já existia |

### Campos ausentes (adicionados por esta sprint)

| Campo | Onde |
|---|---|
| `suporte.telefone/email/site/portal_garantia/garantia_padrao_meses` | `Equipamento` |
| `origem_garantia` | `AtivoEquipamento` |

### Decisão de arquitetura

- Contato de suporte do fabricante → `Equipamento.suporte` (catálogo)
- Datas calculadas por ativo → `AtivoEquipamento.garantia_inicio/fim` (já existiam)
- Auto-fill: `data_instalacao + garantia_padrao_meses` → `garantia_fim` (no controller)
- AlertCenter: detector puro em `alertDetectors.js`, I/O na rota `alertcenter.js`
- UI: `GarantiaCard.jsx` consumindo `dados.ativo` + `dados.equipamento_catalogo` (QR já retornava Equipamento)

---

## FASE 2 — EQUIPAMENTO (catálogo)

### Adicionado a `backend/src/models/Equipamento.js`

```js
// P5-GARANTIA-SIMPLES-01 — contato de suporte do fabricante (todos opcionais, aditivo)
suporte: {
  telefone:              { type: String, default: null },
  email:                 { type: String, default: null },
  site:                  { type: String, default: null },
  portal_garantia:       { type: String, default: null },
  garantia_padrao_meses: { type: Number, default: null },
},
```

Compatibilidade: equipamentos existentes lêem `suporte: {}` sem erro. Nenhuma migração necessária.

**Derivação de meses (`_garantiaMeses`):** prioriza `suporte.garantia_padrao_meses`; fallback para `garantia_produto.value × 12` (se anos) ou `garantia_produto.value` (se meses).

---

## FASE 3 — ATIVO

### Adicionado a `backend/src/models/AtivoEquipamento.js`

```js
origem_garantia: { type: String, default: null },  // 'manual' | 'auto_catalogo'
```

`garantia_inicio` e `garantia_fim` já existiam — não foram alterados.

---

## FASE 4 — AUTO PREENCHIMENTO

**Onde:** `ativosController.js` — funções `criarAtivo` e `atualizarAtivo`

**Lógica:**
```
se data_instalacao está presente
E equipamento_id está presente
E garantia_fim é null:
  → busca Equipamento (projeção 'suporte garantia_produto')
  → meses = suporte.garantia_padrao_meses ?? _derivar(garantia_produto)
  → garantia_inicio = garantia_inicio ?? data_instalacao
  → garantia_fim = garantia_inicio + meses
  → origem_garantia = 'auto_catalogo'
```

**Sem inventar:** se nenhum campo de garantia for encontrado no catálogo, deixa `garantia_fim = null`.

---

## FASE 5 — UI DO ATIVO

### `frontend/src/components/fv/GarantiaCard.jsx` (CRIADO)

Exibe condicionalmente (não renderiza se não há dados):
- Status badge: ATIVA / PRÓXIMA DO VENCIMENTO / VENCIDA
- Data início e vencimento
- Dias restantes (coloridos: verde / âmbar / vermelho)
- Nota "Calculada automaticamente" quando `origem_garantia = 'auto_catalogo'`
- Seção de suporte: telefone (tel:), e-mail (mailto:), site e botão "🛡 Abrir Portal de Garantia"

Integrado em `AtivoQR.jsx` entre Projeto/Arranjo e Comissionamento, recebendo `dados.ativo` e `dados.equipamento_catalogo`.

---

## FASE 6 — STATUS

| Condição | Status exibido | Cor |
|---|---|---|
| > 90 dias restantes | ATIVA | verde |
| 1–90 dias restantes | PRÓXIMA DO VENCIMENTO | âmbar |
| 0 ou menos dias | VENCIDA | vermelho |

---

## FASE 7 — ALERTCENTER

### Novo detector: `detectarAlertasGarantia(ativos, hoje)`

Adicionado a `alertDetectors.js`:

| Condição | Severidade | ID prefix |
|---|---|---|
| garantia_fim ≤ hoje | critico | `garantia_vencida:` |
| garantia_fim - hoje ≤ 30 dias | aviso | `garantia_30d:` |
| garantia_fim - hoje ≤ 90 dias | info | `garantia_90d:` |

### Alterações no AlertCenter

| Arquivo | Mudança |
|---|---|
| `alertDetectors.js` | `'garantia'` adicionado a `ORIGENS[]` |
| `alertDetectors.js` | `detectarAlertasGarantia()` (nova função) |
| `alertDetectors.js` | `agregarAlertas()` — aceita `ativos` + inclui detector |
| `alertDetectors.js` | `calcularKPIs()` — `por_origem.garantia`, `garantias_vencidas`, `garantias_vencendo` |
| `alertcenter.js` | Import `AtivoEquipamento`; query ativos com `garantia_fim != null` |
| `AlertCenter.jsx` | `ORIGEM_LABEL` — adicionado `garantia: 'Garantia'` e `homologacao: 'Homologação'` |

---

## FASE 8 — INTEGRAÇÃO

**Fluxo:** Ativo → Garantia → Portal fabricante → Fotos (Documentos externos) → Medições

- O `consultarPorQr` já retornava `equipamento_catalogo`; a projeção foi extendida com `suporte garantia_produto`
- `GarantiaCard` usa `dados.equipamento_catalogo.suporte` para os contatos
- O link "🛡 Abrir Portal de Garantia" usa `window.open` via `target="_blank" rel="noopener noreferrer"`
- Medições (`MedicoesAtivoCard`) aparecem logo abaixo na mesma página

---

## FASE 9 — VALIDAÇÃO

| Cenário | Comportamento |
|---|---|
| Inversor com catálogo completo | GarantiaCard exibe datas + contatos |
| Módulo sem suporte no catálogo | Card mostra só datas, sem seção suporte |
| Ativo sem garantia_fim + sem suporte | Card não renderiza (`return null`) |
| Projeto legado (ativo antigo) | `origem_garantia = null` → sem nota "calculada automaticamente" |
| Build | ✓ 2332 módulos, 0 erros |

---

## FASE 10 — REGRESSÃO

| Área | Status |
|---|---|
| QR / EtiquetaScanner | Intacto |
| Medições (P5-ATIVO-MEDICOES-01) | Intacto — GarantiaCard inserido antes, MedicoesAtivoCard permanece |
| Documentação Externa (P5-DOCS-EXTERNOS) | Intacto |
| Comissionamento | Intacto |
| Segurança (AES-256-GCM) | Não afetada — suporte[] não tem campos sensíveis |
| Snapshot / Governança | Não afetados |
| Homologação | Não afetada |
| ProjetoEV | Não tocado |

---

## ARQUIVOS ALTERADOS

| Arquivo | Tipo | Descrição |
|---|---|---|
| `backend/src/models/Equipamento.js` | MODIFICADO | Campo `suporte` aditivo (5 subcampos) |
| `backend/src/models/AtivoEquipamento.js` | MODIFICADO | Campo `origem_garantia` aditivo |
| `backend/src/controllers/ativosController.js` | MODIFICADO | Helpers auto-fill + `criarAtivo`/`atualizarAtivo` + projeção QR |
| `backend/src/utils/alertcenter/alertDetectors.js` | MODIFICADO | `detectarAlertasGarantia` + ORIGENS + agregarAlertas + calcularKPIs |
| `backend/src/routes/alertcenter.js` | MODIFICADO | Import AtivoEquipamento + query garantia_fim + pass para agregarAlertas |
| `frontend/src/pages/AlertCenter.jsx` | MODIFICADO | `ORIGEM_LABEL` — garantia + homologacao |
| `frontend/src/components/fv/GarantiaCard.jsx` | CRIADO | Card de garantia: status, datas, suporte, portal |
| `frontend/src/pages/AtivoQR.jsx` | MODIFICADO | Import + `<GarantiaCard>` inserido |

---

## RESPOSTAS ÀS 8 QUESTÕES

1. **Arquivos alterados:** 6 modificados + 1 criado (ver tabela acima)

2. **Campos adicionados:**
   - `Equipamento.suporte` (telefone, email, site, portal_garantia, garantia_padrao_meses)
   - `AtivoEquipamento.origem_garantia`

3. **Auto preenchimento:** Implementado em `criarAtivo` e `atualizarAtivo`. Trigger: `data_instalacao` presente + `equipamento_id` presente + `garantia_fim` nulo. Fonte: `suporte.garantia_padrao_meses` ou derivado de `garantia_produto`.

4. **Integração com Ativos:** Via `GarantiaCard` em `AtivoQR.jsx`, usando `dados.ativo` (datas) e `dados.equipamento_catalogo.suporte` (contatos). Projeção do QR endpoint extendida.

5. **Integração com AlertCenter:** `detectarAlertasGarantia` em `alertDetectors.js`. Severidade: critico (vencida), aviso (≤30d), info (≤90d). Query em `alertcenter.js`. Origin `'garantia'` registrada em KPIs.

6. **Compatibilidade com projetos antigos:** Total. Todos os campos são aditivos com `default: null`. Ativos sem `garantia_fim` não geram alertas. `GarantiaCard` retorna `null` se sem dados.

7. **Regressões encontradas:** Zero.

8. **Commit:** Build validado — pronto para commit.

---

## NÃO IMPLEMENTADO (conforme restrições)

- Chamados / OS / Tickets
- SLA / workflow de aprovação
- Integração com API do fabricante
- ProjetoEV / QR / Scanner / Segurança / Snapshot / Homologação / Governança (intocados)
