# ARRANJO_ELECTRICAL_ISOLATION_REPORT.md

**Sprint:** P0-ARRANJO-ELECTRICAL-ISOLATION-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Isolamento elétrico por arranjo (última limitação estrutural do FV)

---

## ⚠️ GEMINI — revisão cruzada PENDENTE (sem ferramenta no ambiente)

## HONESTIDADE

```
VALIDADO EM CÓDIGO:   build OK; mapeamento editor↔schema; syntax backend
VALIDADO EM RUNTIME:  topologia PRÓPRIA por arranjo (A/B/C) persiste independente;
                      legado abre HTTP 200; Avelino A+B mantido (Railway/Atlas)
NÃO EXERCIDO:         editor por arranjo no navegador (build-validado)
```

## RESULTADO

```
APROVADO — a última limitação estrutural foi eliminada.
Cada arranjo tem engenharia elétrica/topologia INDEPENDENTE e persistente.
```

---

## O QUE FOI FEITO

### Backend (schema aditivo)
`arranjos[].configuracao_eletrica` ganhou (além dos campos de contagem já existentes):
`num_mppts_usados`, `total_modulos`, `quantidade_modulos_por_string`,
`quantidade_strings_paralelo`, **`mppts[].entradas[].strings[].modulos`** (topologia
real por arranjo) e `clima_utilizado` / `compatibilidade` (Mixed). Persistência via
a etapa `arranjos` já existente (`$set.arranjos = lista`).

### Frontend
`GerenciadorArranjos`: toggle **"Topologia detalhada deste arranjo"** por arranjo →
`TopologiaMPPTEditor` controlado, com specs (nMppts/entradas/Voc) resolvidas do
catálogo por arranjo; grava em `a.configuracao_eletrica` (mapeamento editor↔schema).

---

## VALIDAÇÃO RUNTIME (Railway/Atlas)

```
Arranjo A [string · 60KTL] → topologia própria: entradas [15, 15]
Arranjo B [string · 50KTL] → topologia própria: entradas [14, 15]   ← distinta de A
Arranjo C [micro · TSUN-2250] → topologia própria: entradas [1, 1]
topologias independentes (A≠B≠C): True
cada arranjo tem topologia própria: True
Avelino (A+B = 354 mód / 2 inv / 157.53 kWp): mantido
Projeto legado (sem configuracao_eletrica.mppts): HTTP 200, abre sem erro
```

---

## RESPOSTAS

1. **Onde a engenharia elétrica está hoje:** subdoc ÚNICO `engenharia_eletrica.arranjo` (projeto) — agora **complementado por `arranjos[].configuracao_eletrica` (por arranjo)**.
2. **Novo modelo:** `arranjos[].configuracao_eletrica.mppts[].entradas[].strings[].modulos` + resumo + clima/compatibilidade — **independente por arranjo**.
3. **Migração necessária:** **NÃO** (aditivo; legado lê null/undefined; runtime: legado abre 200).
4. **Arranjo B ganhou topologia própria?** **SIM** (entradas [14,15], distinta de A).
5. **Arranjo C ganhou topologia própria?** **SIM** (micro, entradas [1,1]).
6. **Persistência validada?** **SIM** (round-trip independente por arranjo).
7. **Runtime validado?** **SIM** (A/B/C + legado + Avelino).
8. **Regressões:** **nenhuma** (aditivo; `engenharia_eletrica` único preservado; legado abre; Avelino mantido).
9. **Commit:** `1278fe8` (schema) + `8fdf2ab` (editor por arranjo).
10. **FV estruturalmente concluído?** **SIM** — a engenharia elétrica deixou de ser única e cada arranjo tem topologia própria persistente.

---

## VEREDITO

```
APROVADO — isolamento elétrico por arranjo entregue e validado em runtime.
Migração: não. Regressões: nenhuma. Snapshot/governança/homologação intocados.
```
