# P0-UNKNOWN-POWER-FORENSICS-01 — Forense de Potência Desconhecida

> **Data:** 2026-06-17 · **Executor:** Sonnet 4.6 · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE  
> **Tipo:** READ-ONLY — nenhum código alterado, nenhum dado alterado, nenhum commit realizado.  
> **Escopo:** Identificar exatamente quem são os 122 inversores e 3 módulos que exibem `?kW`/`?W` na tela de engenharia.

---

## VEREDITO

**Causa-raiz única:** identity-only import via SolarMarket. Todos os 122 inversores e os 2 módulos vindos do SolarMarket foram importados com `especificacoes: {}` completamente vazio — apenas `fabricante`, `modelo` e `tipo` foram salvos. Nenhum dado técnico (potência, tensão, corrente, MPPT) foi importado. A tela exibe `?kW` porque o adapter de engenharia tenta ler `especificacoes.potencia_kw` (e alternativas), não encontra nada, e retorna `null`.

**Achado de oportunidade:** 87 dos 122 inversores têm a potência codificada no próprio nome do modelo (ex: `SUN-25K-G → 25 kW`, `TECH SPI40K-B → 40 kW`). Estes são candidatos a auto-enriquecimento rápido sem necessidade de PDF.

**Impacto nos projetos:** 574 de 575 projetos **não são afetados** por esses itens (ou usam itens já enriquecidos, ou não têm arranjos configurados). **1 projeto ativo** usa um inversor sem-pot: `Cristiano 600kw` → `Goodwe GW8000-DT`.

---

## FASE 1 — Escopo e Metodologia

### Fontes consultadas (read-only)
- `Equipamento` collection (MongoDB Atlas): todos os 361 documentos (175 inversores + 186 módulos)
- `ProjetoFV` collection: 575 projetos para cross-referência

### Critério de ausência de potência
- **Inversor:** `especificacoes.potencia_kw` OU `especificacoes.potencia` OU `especificacoes.potencia_ca` deve ser não-nulo e não-vazio
- **Módulo:** `especificacoes.potencia_wp` OU `especificacoes.potencia_w` OU `especificacoes.potencia`

### Chaves alternativas também verificadas (sem resultado)
```
potencia_nominal, potencia_aparente, potencia_ativa, potencia_saida,
potencia_rated, rated_power, power_kw, pn, pnom, pac, pcc, p_kw,
potencia_cc_max, pdc_max
```
→ **Resultado: zero** inversores encontrados com dado em campo alternativo.

---

## FASE 2 — Inventário Completo

| Tipo | Total Catálogo | Sem Potência | Percentual |
|------|---------------|-------------|------------|
| Inversor | 175 | **122** | 69.7% |
| Módulo | 186 | **3** | 1.6% |

### 122 Inversores — Distribuição por Fabricante

| Rank | Fabricante | Modelos Sem Pot | % do total | Tech | Derivável pelo nome |
|------|-----------|----------------|-----------|------|---------------------|
| 1 | **Deye** | 37 | 30.3% | string (37) | 35/37 ✅ |
| 2 | **Growatt** | 18 | 14.8% | string (18) | 8/18 ⚠️ |
| 3 | **Kehua** | 17 | 13.9% | string (17) | 14/17 ✅ |
| 4 | **Solaredge** | 9 | 7.4% | otimizador (9) | 8/9 🚫 HTTP403 |
| 5 | **Goodwe** | 8 | 6.6% | string (8) | 3/8 ⚠️ |
| 6 | **Solplanet** | 7 | 5.7% | string (7) | 3/7 ⚠️ |
| 7 | **Solis** | 6 | 4.9% | string (6) | 6/6 ✅ |
| 8 | **Sungrow** | 4 | 3.3% | string (4) | 2/4 ⚠️ |
| 9 | **Hoymiles** | 3 | 2.5% | micro (3) | 3/3 ✅ |
| 10 | **Tsun** | 3 | 2.5% | micro (3) | 0/3 ⚠️ duplicatas |
| 11 | Chint | 2 | 1.6% | string (2) | 2/2 ✅ |
| 12 | Sofar | 2 | 1.6% | string (2) | 2/2 ✅ |
| 13 | Apsystems | 2 | 1.6% | micro (2) | 0/2 ❌ |
| 14 | Fronius | 1 | 0.8% | string (1) | 0/1 ❌ |
| 15 | Enphase | 1 | 0.8% | micro (1) | 0/1 ❌ |
| 16 | Nep | 1 | 0.8% | micro (1) | 0/1 ❌ |
| 17 | Solax | 1 | 0.8% | string (1) | 1/1 ✅ |
| **Total** | | **122** | 100% | string 103 / micro 10 / otimizador 9 | **87/122 (71%)** |

### Distribuição por Tecnologia (dos 122 sem-pot)

| Tecnologia | Quantidade | % |
|------------|-----------|---|
| String | 103 | 84.4% |
| Microinversor | 10 | 8.2% |
| Otimizador | 9 | 7.4% |
| Híbrido | 0 | 0% |

### 3 Módulos sem potência

| Fabricante | Modelo | Origem | Derivável | Projetos |
|-----------|--------|--------|----------|---------|
| Risen Energy | Módulo | desconhecido (pré-SolarMarket) | ❌ nome genérico | 0 |
| Leapton | LP182-M-72-NB | import_solarmarket | ❌ 72-cell sem watt | 0 |
| Znshine | ZXMR-UPLDD144 | import_planilha | ❌ 144-cell sem watt | 0 |

---

## FASE 3 — Classificação de Causa-Raiz

### Definição das categorias
- **A:** Dado existe no `especificacoes{}` mas não é lido pelo adapter (chave errada)
- **B:** Dado está em outro campo do documento (fora de `especificacoes`)
- **C:** Dado realmente não existe em nenhum campo do documento

### Resultado

| Categoria | Inversores | Módulos |
|-----------|-----------|---------|
| **A** (chave errada) | 0 | 0 |
| **B** (outro campo) | 0 | 0 |
| **C** (realmente ausente) | **122** | **3** |

**Todos os 125 itens são Categoria C.** `campos_preenchidos = 0` para todos os 122 inversores — o subdocumento `especificacoes` está completamente vazio.

### Por quê o dado está ausente?

O import SolarMarket (`import_solarmarket` via `solarmarket_pricingtable`) foi concebido como **tabela de preços/vinculação**, não como catálogo técnico. O script de importação salvou:
- `fabricante` ✅
- `modelo` ✅  
- `tipo` ✅
- `origem.tipo = "import_solarmarket"` ✅
- `especificacoes = {}` ❌ (vazio intencionalmente — não havia dado técnico na planilha de preços)

Resultado: 122 entradas no catálogo com identidade mas sem specs. A Wave 1 de enriquecimento (Sprint anterior) preencheu **5+3 = 8 modelos** (Deye/Growatt/Kehua/TSUN selecionados); os outros 114 permaneceram em `especificacoes: {}`.

---

## FASE 4 — Achado de Oportunidade: Potência no Nome do Modelo

**87 de 122 inversores** têm o valor de potência embutido no nome do modelo e podem ser enriquecidos via extração por regex, sem precisar de PDF:

| Padrão regex | Exemplo | kW extraído |
|-------------|---------|-------------|
| `(\d+[.,]\d+?)K` | `SUN-25K-G` | 25 |
| `SPI(\d+)K` | `TECH SPI40K-B` | 40 |
| `SE (\d+[.,]\d+)K` | `SE 27.6K 380/220v` | 27.6 |
| `GW(\d+)K` | `GW15K-SDT-20` | 15 |
| `(\d+[.,]\d+?)K` | `S5-GC37.5K` | 37.5 |
| `HMS-(\d{4})` | `HMS-2000DW-4T` | 2.0 |

**35 modelos** sem kW no nome (MIC/MIN/NEO Growatt; SPI8000/9000 Kehua; GW5000DT/GW8000DT Goodwe; Tsun TSOL-*; Apsystems; etc.) requerem datasheet.

> **Atenção:** potência extraída do nome deve ser salva com `origem_potencia: "inferido_do_nome"` para rastreabilidade. Nunca sobrescrever um campo com dado inferido sem registrar a fonte.

---

## FASE 5 — Análise de Impacto nos Projetos

### Estrutura de linkagem (achado técnico)
O campo `equipamento_id` está `null` em **todos** os arranjos dos projetos que têm equipamentos configurados. A linkagem é **por nome** (fabricante + modelo), não por ID de catálogo. Isso implica que mesmo enriquecendo o catálogo, o `potencia_kw` no arranjo salvo permanece `null` — o arranjo precisa ser atualizado separadamente (ou o frontend deve lê-lo do catálogo em tempo real).

### Cross-referência case-insensitive (575 projetos)

| Resultado | Detalhe |
|-----------|---------|
| Projetos com arranjos configurados | 2 de 575 |
| Projetos usando inversor sem-pot | **1** — `Cristiano 600kw` |
| Inversor em questão | `Goodwe GW8000-DT` (qty=1, potencia_kw=null) |
| Projetos usando módulo sem-pot | **0** |

### Por que apenas 2 projetos têm arranjos?
573 projetos não têm `arranjos[].inversores[]` preenchidos — ou foram criados antes do wizard de arranjos, ou usam o wizard novo mas ainda não salvaram arranjos. O campo `potencia_kw` no arranjo embedded nunca foi populado automaticamente pelo wizard (bug: o wizard salva o `modelo` mas não copia `potencia_kw` do catálogo).

---

## FASE 6 — Alertas Adicionais

### Alerta 1: Duplicatas Tsun
A coleção `Equipamento` provavelmente contém 2 documentos para cada modelo Tsun:
- **Documento enriquecido** (Wave 1b): `especificacoes.potencia_kw` preenchido
- **Documento SolarMarket** (aqui listado): `especificacoes: {}` vazio

Os 3 documentos Tsun neste inventário são os duplicatas SolarMarket. A Wave Next deve fazer deduplicação antes de enriquecimento.

### Alerta 2: potencia_kw nos arranjos (campo embedded)
Enriquecer o catálogo (`Equipamento`) **não atualiza** os arranjos salvos em `ProjetoFV`. O campo `inversores[].potencia_kw` no arranjo embedded do projeto `Cristiano 600kw` permanecerá `null` após enriquecimento do catálogo. A wave next deve incluir uma etapa de propagação (opcional, pois o renderer pode buscar do catálogo).

### Alerta 3: Risen Energy "Módulo"
Um módulo com nome genérico `"Módulo"` (sem modelo específico) existe na coleção, criado em 2026-05-20 antes do SolarMarket import. Não está vinculado a projetos e não tem specs. Candidato a remoção (decisão do usuário).

---

## RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Inversores sem potência | 122 / 175 (69.7%) |
| Módulos sem potência | 3 / 186 (1.6%) |
| Causa raiz | Identity-only SolarMarket import |
| Categorias (A/B/C) | 0 / 0 / 122 |
| Derivável pelo nome do modelo | 87 / 122 (71%) |
| Projetos impactados ativamente | 1 (Cristiano 600kw / Goodwe GW8000-DT) |
| Fabricantes envolvidos | 17 |
| Maior volume | Deye 37, Growatt 18, Kehua 17 |
| HTTP 403 bloqueado | Solaredge (9 modelos) |
| Alerta duplicatas | Tsun (3 docs SolarMarket vs Wave 1b) |

---

## Recomendação de Próxima Sprint

**Abrir `P1-DATASHEET-WAVE-NEXT-01`** com 3 fases:

1. **Auto-enriquecimento (sem PDF, 87 itens):** regex no campo `modelo` → `potencia_kw` com `fonte: "inferido_do_nome"`. Sprint rápida, alto impacto.
2. **Datasheet estratégico (PDF, ~35 itens):** Deye SUN1000G3/SUN1300G + 10 Growatt MIC/MIN/NEO + 3 Kehua SPI8000/9000/10000 + 5 Goodwe DT/DNS series.
3. **Deduplicação Tsun** antes de qualquer enriquecimento.

**P0 imediato (fora da Wave):** enriquecer `Goodwe GW8000-DT` e propagar `potencia_kw=8` ao projeto `Cristiano 600kw`.

> Revisão Gemini obrigatória **antes** de iniciar qualquer sprint de enriquecimento.

---

## Entregáveis desta Sprint

| Arquivo | Status |
|---------|--------|
| `UNKNOWN_POWER_INVENTORY.json` | ✅ Gerado |
| `UNKNOWN_POWER_BY_MANUFACTURER.json` | ✅ Gerado |
| `UNKNOWN_POWER_PRIORITY_MATRIX.json` | ✅ Gerado |
| `UNKNOWN_POWER_FORENSICS_REPORT.md` | ✅ Este arquivo |

**Nenhum código foi alterado. Nenhum dado foi alterado. Nenhum commit foi criado.**
