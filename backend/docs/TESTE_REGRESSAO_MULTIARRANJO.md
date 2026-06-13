# TESTE DE REGRESSÃO — Multiarranjo / Multi-inversor (FASE 7)

> Testes de lógica pura sobre `arranjosService` (normalização, totais, topologia) + verificação
> de integração contra o Atlas real. **Todos passaram.**

## Casos obrigatórios

### 1. Paulo Carlos — multi-fabricante
- Arranjo 1: 24× BYD 320 + Fronius Primo 6 (string)
- Arranjo 2: 10× Luxen 340 + 10× OSDA 590 (**2 modelos no mesmo arranjo**) + Solax Híbrido 6

| Verificação | Resultado |
|---|---|
| 2 arranjos | ✅ |
| arranjo 2 com 2 modelos de módulo | ✅ |
| topologias string / hibrido | ✅ |
| módulos total = 44 (24+10+10) | ✅ |
| inversores total = 2 | ✅ |
| potência DC total = 16.98 kWp | ✅ |

### 2. Escola Pinheiro — multiarranjo, mesmo inversor
- Arranjo 1: 74× Znshine 600 + SE33.3
- Arranjo 2: 64× Ronma 620 + SE33.3

| Verificação | Resultado |
|---|---|
| 2 arranjos | ✅ |
| módulos total = 138 (74+64) | ✅ |
| inversores total = 2 (2× SE33.3) | ✅ |
| potência AC total = 66.6 kW | ✅ |

### 3. Micro + String
- Arranjo Micro: 8 módulos + 4× Hoymiles HMS-2000 (micro)
- Arranjo String: 20 módulos + Growatt MIN 10000 (string)

| Verificação | Resultado |
|---|---|
| topologia arranjo 1 = micro | ✅ |
| topologia arranjo 2 = string | ✅ |
| inversores total = 5 (4 micro + 1 string) | ✅ |

### 4. FV + BESS
- Arranjo FV: 20 módulos + Deye SUN-12K (híbrido)
- Banco de Baterias: 3× BYD B-Box 5.12 kWh

| Verificação | Resultado |
|---|---|
| topologia arranjo 2 = bess | ✅ |
| capacidade BESS total = 15.36 kWh | ✅ |

### 5. Projeto legado (adaptador FASE 2)
- Só `equipamentos.paineis` (18× Jinko 550) + `equipamentos.inversor` (Growatt MIN 10000)

| Verificação | Resultado |
|---|---|
| deriva 1 arranjo | ✅ |
| arranjo: tipo=principal, origem=original | ✅ |
| painéis e inversor migrados | ✅ |
| totais: 18 módulos, 1 inversor | ✅ |
| projeto vazio → [] (retrocompat) | ✅ |

## Integração no Atlas real

```
GET /api/projetos-fv/<legacy>        → abre OK; arranjos_normalizados:[{origem:'original',topologia:'string'}]
GET /api/projetos-fv/<legacy>/totais → {n_arranjos:1, n_inversores_total:1, potencia_inversor_total_kw:15}
```

## Resultado

```
✅ TODOS OS TESTES PASSARAM (5 casos + retrocompat + integração real)
```

> O teste roda como script de lógica pura (sem DB) para ser determinístico e rápido; a camada
> de integração foi confirmada manualmente contra um projeto legado real no cluster Atlas.
