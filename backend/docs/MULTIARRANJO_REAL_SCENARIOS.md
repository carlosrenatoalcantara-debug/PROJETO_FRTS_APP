# P1-MULTIARRANJO-UX-RESTORE-01 — Cenários reais (FASE 5)

> Cada cenário foi montado no shape de arranjo do configurador e **validado contra o schema real
> `ProjetoFV.arranjos[]`** (`new ProjetoFV({arranjos}).validateSync()`) → **0 erros de arranjo**.
> Sem adaptações, sem gambiarras, sem alterar o schema.

## 1. Fazenda Alice — 2 arranjos heterogêneos

| Arranjo | Módulos | Inversores |
|---|---|---|
| **Arranjo 1** | 75× **OSDA** ODA575 (575W) | 1× **Deye** SUN-25K-G (25kW) |
| **Arranjo 2** | 80× **DAH** DHN66-610 (610W) | 1× **Kehua** SPI40 (40kW) |

→ Dois arranjos com fabricantes/modelos diferentes de módulo **e** de inversor. ✅ aceito.

## 2. Paulo Carlos — original + ampliação

| Arranjo | Papel | Módulos | Inversores |
|---|---|---|---|
| **Original** | `somente_leitura` (congelado) | 8× Pulling PU-620 | 2× Tsun TSOL-MS2000 |
| **Ampliação** | `tipo: ampliacao` | 8× Helius HMF132T12R-600HL | 1× NEP BDM-2250 |

→ Arranjo existente **congelado** (`somente_leitura: true`) + arranjo de **ampliação** editável. ✅ aceito.

## 3. Escola Pinheiro — 1 arranjo, 2 modelos de módulo + 2 inversores

| Arranjo | Módulos | Inversores |
|---|---|---|
| **Arranjo único** | 74× Znshine ZXMR-UPLDD144-600W **+** 64× Znshine ZXMR-UPLDD144-600W (= 138) | 1× SolarEdge SE 33.3K **+** 1× SolarEdge SE 20.1K |

→ Múltiplos **modelos de módulo** e múltiplos **inversores** no **mesmo** arranjo (74+64 módulos, 2 inversores). ✅ aceito.

## Conclusão

Os 3 cenários reais são **representáveis nativamente** pelo modelo existente (`arranjos[].paineis[]` /
`arranjos[].inversores[]`) e pelo novo configurador (N módulos + N inversores por arranjo, Fabricante→Modelo,
quantidade por item). **Nada precisou ser inventado nem adaptado.**

> Evidência: `backend` — `new ProjetoFV({ nome, arranjos }).validateSync()` retornou **0 erros** nos três casos.
