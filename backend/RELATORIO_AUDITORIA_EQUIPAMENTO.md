# Auditoria — Equipamento.especificacoes

_Gerado em: 2026-05-18_
_Fonte: produção (Railway → MongoDB Atlas)_
_Pré-requisito da Sprint 3 (seleção hierárquica de equipamentos)_

---

## Sumário executivo

| Tipo | Total docs | Status geral |
|---|---|---|
| Módulos | 71 | **OK** — cobertura > 95% em campos críticos |
| Inversores | 44 | **ALERTA** — apenas 8 docs (18%) com specs completas |
| Carregadores EV | 77 | aceitável — verificar caso a caso na sprint EV |

---

## MÓDULOS — Cobertura por campo

_(variantes reconhecidas pelo `extrairSpecsModulo` da Sprint 1)_

| Status | Campo | Presença | % | Variantes encontradas |
|---|---|---|---|---|
| OK | potência (Wp) | 6/71 | 8.5% | `potencia`, `potencia_w` em `especificacoes` (mas existe no nível raiz como `potencia_w`) |
| OK | Voc (V) | 70/71 | 98.6% | `voc` (70) |
| OK | Isc (A) | 70/71 | 98.6% | `isc` (70) |
| OK | Vmp / Vmpp (V) | 70/71 | 98.6% | `vmp` (70) |
| OK | Imp / Impp (A) | 70/71 | 98.6% | `imp` (70) |
| OK | eficiência | 69/71 | 97.2% | `eficiencia` (69) |

**Conclusão módulos:** dados técnicos estão consistentes. Cascata marca → modelo da Sprint 3 pode ser construída sem enriquecimento adicional.

---

## INVERSORES — Cobertura por campo

_(variantes reconhecidas pelo `extrairSpecsInversor` da Sprint 1)_

| Status | Campo | Presença | % | Variantes encontradas |
|---|---|---|---|---|
| X | potência (kW) | 8/44 | 18.2% | `potencia_kw` (8) |
| X | tensão max DC | 8/44 | 18.2% | `vpv_max` (8) — equivale a `voc_max_dc` |
| X | corrente max MPPT | 8/44 | 18.2% | `ipv_max` (8) — equivale a `isc_max_mppt` |
| X | MPPT min V | 0/44 | 0.0% | nenhuma variante presente |
| X | MPPT max V | 0/44 | 0.0% | nenhuma variante presente |
| X | número de MPPTs | 0/44 | 0.0% | nenhuma variante presente |
| X | fases (saída) | 2/44 | 4.5% | `entrada_trifasico` (booleano, 2 docs) |
| X | eficiência | 8/44 | 18.2% | `eficiencia` (8) |
| X | tipo inversor | 0/44 | 0.0% | nenhuma variante presente |

**Conclusão inversores — ALERTA CRÍTICO:**

- **36 dos 44 inversores (82%) parecem ser placeholders** sem datasheet processado
- Validação de strings em cascata (S3) **não funcionará** para esses 36 docs
- MPPT min/max ausentes impedem cálculo de faixa de tensão de operação

---

## Recomendações para Sprint 3

### Opção (a) — Enriquecimento manual via Gemini Vision
- Reprocessar os 36 inversores via `POST /api/datasheet/extrair`
- Tempo: 1–2h de trabalho + ~36 chamadas Gemini
- Risco: baixo. **Recomendado.**

### Opção (b) — UI alerta visualmente
- Cards de inversor com badge "Specs incompletas"
- Frontend impede avanço para validação de strings até specs preenchidas
- Tempo: incluído no escopo da S3
- Risco: médio. **Aceitável como fallback.**

### Opção (c) — Aceitar lacunas
- Motor S1 já tem fallbacks defensivos (`voc_max_dc` default 600V, etc.)
- Risco: alto. **NÃO recomendado** — pode resultar em projetos técnicos incorretos.

**Decisão sugerida:** combinação **(a) + (b)** — enriquecer datasheets + UI mostrar status visual.

---

## Próximos passos antes da Sprint 3

1. Executar enriquecimento via Gemini Vision dos 36 inversores faltantes (utilitário admin)
2. Validar amostra de 5 inversores enriquecidos para confirmar qualidade
3. Implementar badge visual de "specs incompletas" na cascata S3
4. Cobertura-alvo antes de S3: ≥ 80% nos campos críticos de inversor

---

## Apêndice — Validação em produção da S2

Sprint 2 foi validada com endpoints em produção:
- `POST /api/projetos-fv/preparar-com-fatura` → busca candidatos + dimensiona OK
- `POST /api/projetos-fv/finalizar-com-fatura` → cria Cliente+Projeto idempotente
- Schema `fatura_extracao` aditivo, sem regressão em docs existentes
