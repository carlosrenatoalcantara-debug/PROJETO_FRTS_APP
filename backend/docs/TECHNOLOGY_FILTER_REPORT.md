# P0-DIMENSIONAMENTO-ENGINEERING-RESTORE-01 — TECHNOLOGY FILTER (FASE 3)

> Validação: após a classificação, cada fabricante aparece **apenas** na tecnologia correta.
> Contagem por grupo a partir de `tecnologiaInversor` (fonte única).

## Resultado (fabricante × grupo)

| Fabricante | micro | string | otimizador | híbrido | Veredito |
|---|---|---|---|---|---|
| **Hoymiles** | 3 | **0** | 0 | 0 | ✅ não aparece em String |
| **TSUN** | 5 | **0** | 0 | 0 | ✅ não aparece em String |
| **APsystems** | 2 | **0** | 0 | 0 | ✅ não aparece em String |
| **SolarEdge** | 0 | **0** | 9 | 0 | ✅ otimizado, não em String |
| **Deye** | 3 | 38 | 0 | 1 | ✅ micros (SUN-M*) em Micro; string (SUN-xK) em String; híbrido (SG) em Híbrido |

> **Deye** aparece em mais de um grupo **corretamente** — a Deye fabrica microinversor (SUN-M225G4…),
> string (SUN-8K-SG…) e híbrido. A separação por modelo está correta.

## Antes × Depois

| | Antes (hard-code) | Depois (RESTORE) |
|---|---|---|
| Abas exibidas | só **String** | **String · Micro · Otimizador · Híbrido** |
| Hoymiles/TSUN/APsystems | em String (errado) | em **Micro** ✅ |
| SolarEdge | em String (errado) | em **Otimizador** ✅ |
| Deye SUN-M (micro) | em String (errado) | em **Micro** ✅ |

## Verificação no browser

`agruparInversores` carregado no Vite (import cross-package resolve OK) classificou em tempo real:
Hoymiles→micro, Deye SUN-M225G4→micro, SolarEdge SE5000H HD-Wave→**otimizador**, Growatt MID 5000TL-X→string.
Abas resultantes: `micro, otimizador, string` (e `hibrido` quando presente).

## Conclusão
O filtro de marcas por tecnologia foi **restaurado**. Nenhum micro/otimizador permanece na aba String.
