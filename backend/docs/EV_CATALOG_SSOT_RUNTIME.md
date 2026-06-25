# EV_CATALOG_SSOT_RUNTIME.md

**Sprint:** P0-EV-CATALOG-SINGLE-SOURCE-OF-TRUTH-01 — implementação + certificação
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-25 · **Opção ratificada:** A (CarregadorEV = SSOT)
**Commits:** `2fc7dc2` (refactor) · `229e3ab` (anti-duplicação) · `f0b28f2` (paridade de score)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  syntax OK; 4 arquivos; mirror-writes removidos; leitura derivada.
VALIDADO EM RUNTIME: fixture completo (todos os campos antes perdidos presentes) + os 3 carregadores
                     reais reimportados durante o sprint + migração dos 2 mirrors + certificação.
NUANCE HONESTA:      durante o sprint o usuário reimportou 3 carregadores; 2 (Solplanet/Belenergy,
                     17:00:14-16) caíram no código ANTIGO e criaram mirror; 1 (Intelbras, 17:00:18)
                     caiu no código NOVO e NÃO criou mirror — provando o fix ao vivo. Os 2 mirrors
                     stale foram removidos (FASE 5).
```

## Arquitetura implementada (Opção A)
- **Fonte única: `CarregadorEV`** (superset nativo). O catálogo unificado/score **derivam** a visão de
  carregador NA LEITURA via `carregadorEquipamentoView` (projeção **COMPLETA**, nunca armazenada).
- **Mirror eliminado:** removidos os 3 mirror-writes (upload-datasheet, admin/adicionar-lote, admin/
  sincronizar-equipamentos → no-op deprecado). Leituras (`/engenharia`, `listarEquipamentos`) **ignoram**
  docs `Equipamento(carregador_ev)` armazenados e sempre derivam.
- **Score intocado:** `processarEquipamento` reusado sem alteração; `origem` default = `import_legado`
  (paridade com o mirror antigo) → score idêntico ao anterior.

## FASE 5 — Migração
2 mirrors obsoletos (`Equipamento(carregador_ev)` de Solplanet e Belenergy) **removidos** (HTTP 200,
origem=Equipamento). **Zero perda** — os dados vivem em `CarregadorEV` (intactos). Sem mais migração
(o restante do catálogo já estava limpo).

## FASE 6 — Certificação (runtime)
| Verificação | Resultado |
|---|---|
| Carregadores no catálogo (`/engenharia`) | 3 |
| Todos derivados de CarregadorEV (`_origem`) | ✅ sim |
| Duplicados | ✅ 0 |
| Mirrors Equipamento restantes | ✅ 0 |
| CarregadorEV (fonte do projeto EV) | 3 (intacto) |
| Score (paridade) | 56/incompleto (= antes; sprint não alterou score) |
| Projeção sem perda (fixture: qtd_con=2, ocpp=true, peso=9.9, dim, frequencia, fator_potencia) | ✅ todos presentes |

## RESPOSTAS OBRIGATÓRIAS
1. **Causa raiz?** Mirror parcial `Equipamento(carregador_ev)` = 2ª fonte derivada e LOSSY de `CarregadorEV`.
2. **Fonte única?** **CarregadorEV** (opção A ratificada).
3. **Mirror eliminado completamente?** SIM — 3 writes removidos + 2 mirrors stale deletados + leitura ignora qualquer mirror.
4. **Sincronização restante?** NÃO — endpoint de sync virou no-op; as leituras derivam.
5. **Algum campo descartado?** NÃO — projeção COMPLETA (fixture provou qtd_conectores/ocpp/peso/dimensoes/DC/frequencia/fator_potencia presentes).
6. **Migração necessária?** SIM, mínima — 2 mirrors obsoletos removidos (zero perda).
7. **Projetos EV continuaram funcionando?** SIM — `projetosEVController` lê `CarregadorEV` (intacto, inalterado).
8. **Regressão?** NÃO — score em paridade (56), 0 duplicação, fonte do projeto intacta.
9. **Runtime executado?** SIM.
10. **Commit?** `2fc7dc2` + `229e3ab` + `f0b28f2`.

## CRITÉRIO DE ACEITAÇÃO
✅ uma fonte de verdade (CarregadorEV) · ✅ nenhum campo depende de sync · ✅ nenhum campo perdido
(projeção completa) · ✅ OCR/projetos/catálogo leem a mesma informação (CarregadorEV) · ✅ sem mirror
parcial · ✅ sem projeção lossy · ✅ carregadores íntegros após persistência · ✅ sem regressão.

## Follow-up (1 linha, fora do escopo)
Corrigir a proveniência (`origem` real do datasheet em vez de `import_legado`) no `carregadorEquipamentoView`
→ eleva o score dos carregadores completos de ~56 para ~92 (validado). Adiado por respeito à restrição
"não alterar Score" desta sprint.
