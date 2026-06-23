# FV_FINAL_RUNTIME_CERTIFICATION_REPORT.md

**Sprint:** P0-FV-FINAL-RUNTIME-CERTIFICATION-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-23
**Tipo:** Validação Final de Produção FV (READ-ONLY — nada corrigido)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:   T11 (E8 usa agregarTotaisArranjos), T13 (irradiância por município).
VALIDADO EM RUNTIME:  T01, T02 (agregação 354/2/157,53; E5 ignorado), T03/T04 (catálogo real via
                      adaptador: 6 MPPT, janela/corrente OK, 'não mapeados' resolvido), T05 (catálogo
                      real), T06 (módulo limpo), T12 (agregação multiarranjo), T14 (flag utilizável).
RUNTIME (ANTERIOR):   T07 (MPPT), T08 (isolamento arranjos), T09 (wizard), T10 (homologação),
                      T15 (governança) — validados em sprints anteriores, NÃO re-exercitados agora.
NÃO TESTADO:          ciclo E2E de UI no navegador (sem preview interativo nesta sessão).
```
**Sem evidência ⇒ declarado explicitamente.** Não há claim de "aprovado" sem a linha de evidência acima.

## RESULTADO
```
APROVADO COM RESSALVAS.
Pipeline de engenharia íntegro. 3 falhas, TODAS de completude de dados do catálogo (não de código):
 T03/T04 — entradas DC = 6 em vez de 12 (entradas_por_mppt ausente no catálogo).
 T05     — modelo ASW6000-S-G2 ausente + subset de inversores sem janela MPPT/corrente.
Nenhum P0 aberto. 2 P1 e 2 P2 (catálogo / cobertura de teste).
```

## DESCOBERTA-CHAVE (RCA)
O aviso "Dados elétricos não mapeados" tem DUAS origens, agora separadas:
1. **Código (resolvido na sprint anterior):** `dadosEletricos*` só liam o mapa estático por id;
   item do catálogo Mongo (id=ObjectId) caía em null. → **Corrigido** (fallback p/ specs inline).
   Prova: Huawei 50/60KTL e módulo Astronergy agora SEM aviso.
2. **Dado (aberto):** alguns inversores realmente não têm janela MPPT (`tensao_mppt_min/max`) +
   `corrente_max_por_mppt` no catálogo → o fallback corretamente retorna null e mantém o aviso
   honesto. → **Não é bug de código; é enriquecimento de catálogo** (sprint proposta).

A contagem de entradas (6 vs 12) decorre da ausência de `entradas_por_mppt`/`strings_por_mppt`
no `especificacoes` → `adaptarInversor` faz default 1. Mesmo diagnóstico: dado, não código.

## MATRIZ
Ver `FV_FINAL_RUNTIME_CERTIFICATION_MATRIX.json` (15 testes detalhados com evidência).
Resumo: **12 passaram · 3 falharam (T03/T04/T05, por dados)**.

## RESPOSTAS OBRIGATÓRIAS
1. **Testes executados:** 15 (9 exercitados nesta sessão em runtime/código; 5 apoiados em sprint anterior; T11/T13 em código).
2. **Passaram:** 12.
3. **Falharam:** 3 (T03, T04, T05).
4. **P0 aberto?** NÃO.
5. **P1 aberto?** SIM — 2 (entradas_por_mppt ausente; janela MPPT/corrente ausente em subset). Ver RISKS.
6. **P2 aberto?** SIM — 2 (modelo ASW6000 ausente; T07–T10/T15 não re-exercitados).
7. **Aprovado para produção (sem ressalvas)?** NÃO.
8. **Aprovado COM ressalvas?** SIM.
9. **Reprovado?** NÃO.
10. **Commit final:** ver hash do commit desta entrega (docs de certificação).

## CRITÉRIO DE APROVAÇÃO — aferição
| Critério | Status |
|---|---|
| Todos os P0 passam | ✅ nenhum P0 aberto |
| Nenhum dado perdido | ✅ (persistência validada; agregação íntegra) |
| E7 e E8 coerentes | ✅ mesma fonte (agregarTotaisArranjos) |
| MPPT persiste | ✅ (sprint anterior; não re-exercido) |
| Homologação persiste | ✅ (sprint anterior; não re-exercido) |
| Wizard persiste | ✅ (sprint anterior; não re-exercido) |
| Catálogo funciona | ⚠️ funciona, com lacunas de envelope MPPT em alguns inversores (P1) |
| Avelino correto | ✅ 354 / 2 / 157,53 (E7 e E8) |

## REGRA FINAL — cumprida
Defeitos **provados** primeiro (runtime contra catálogo real), **não corrigidos** automaticamente.
RCA e sprints específicas em `FV_FINAL_RUNTIME_CERTIFICATION_ROADMAP.md` e `_RISKS.json`.
