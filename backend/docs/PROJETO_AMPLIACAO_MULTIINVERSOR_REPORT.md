# P1-PROJETO-AMPLIACAO-MULTIINVERSOR-01 — Arquitetura definitiva multi-arranjo

> **100% READ-ONLY** (documento de arquitetura — nenhuma alteração de código/Atlas). Define o modelo
> definitivo `Projeto → Arranjos[]` para suportar múltiplos inversores/fabricantes/módulos, micro+
> string, híbrido, ampliações, retrofit e BESS futuro.

## 1. Estado atual (auditoria do `ProjetoFV.js`)

| Campo | Forma atual | Limitação |
|---|---|---|
| `equipamentos.paineis[]` | **array** | OK p/ vários módulos, mas **não vinculados a um inversor específico** |
| `equipamentos.inversor` | **objeto único** | **1 inversor por projeto** ⛔ |
| `strings[]` + `engenharia_eletrica.arranjo` | **único** (mppts) | **string-centric**; 1 arranjo só |
| `bess` | **objeto único** | 1 bateria |
| `dimensionamento` (v3) | `num_inversores`, agregados | assume **homogêneo** |

→ **O projeto não consegue representar dois inversores** (Fronius+Solax), **mistura micro+string**,
**módulo diferente por inversor**, nem **ampliação** (adicionar subsistema depois preservando o
existente). Tudo é modelado como **um único bloco elétrico homogêneo**.

## 2. Princípio da arquitetura definitiva

```
Projeto
 ├── arranjos[]          // 1..N subsistemas elétricos independentes
 │     └── Arranjo { inversor + módulos + topologia + config + dimensionamento_parcial }
 ├── bess[]              // 0..N baterias
 ├── ev[]                // 0..N carregadores EV
 └── totais{}            // agregados derivados (somatórios) — read-model
```

O **Arranjo** passa a ser a **unidade elétrica atômica** (o que hoje é "o projeto inteiro"). Um
projeto é a **soma de arranjos**. Isto reaproveita 1:1 o que já foi construído nas sprints micro
(`topologiaInversor`, `dimensionarMicro`, `descricaoTopologia`) — cada arranjo é classificado e
dimensionado pela sua própria topologia.

### Schema proposto do Arranjo (aditivo, não destrói o legado)

```js
Arranjo {
  id:            String,            // estável (uuid)
  rotulo:        String,            // "Arranjo 1 — Telhado Norte (Fronius)"
  origem:        'original' | 'ampliacao' | 'retrofit',
  incluido_em:   Date,
  topologia:     'string' | 'micro' | 'otimizador' | 'hibrido',
  inversor: {                       // 1 inversor por arranjo
    equipamento_id: ObjectId(ref Equipamento), marca, modelo, potencia_kw, tipo, fases,
  },
  modulos: [{                       // pode diferir entre arranjos (fabricante/potência)
    equipamento_id: ObjectId, marca, modelo, potencia_w, quantidade,
  }],
  config_eletrica: {                // discriminado por topologia (sem mistura)
    // string/otimizador:  mppts:[{ strings_paralelo, modulos_por_string }]
    // micro:              { qtd_microinversores, modulos_por_micro, entradas_por_micro, distribuicao[] }
  },
  dimensionamento_parcial: { potencia_cc_kwp, potencia_ca_kw, geracao_kwh, oversizing, fases },
  compatibilidade: { compativel, diagnosticos[], calculos{} },  // validação POR arranjo
  bess_vinculado_id: String | null, // p/ híbrido (inversor + bateria)
}
```

### Projeto (agregação)

```js
totais (read-model derivado dos arranjos): {
  num_arranjos, num_inversores, num_paineis,
  potencia_cc_kwp:  Σ arranjos.dimensionamento_parcial.potencia_cc_kwp,
  potencia_ca_kw:   Σ arranjos.inversor.potencia_kw,
  geracao_total_kwh: Σ ...,
  fabricantes_inversor: distinct(...), topologias: distinct(...),  // 'misto' quando >1
}
```

## 3. Casos reais mapeados

| Caso | Modelagem `arranjos[]` |
|---|---|
| **Escola Pinheiro — Fronius + Solax** | `[{inversor:Fronius, topologia:string, módulos…}, {inversor:Solax, topologia:string, módulos…}]` — 2 arranjos, totais somados |
| **Micro + String** | `[{inversor:Hoymiles, topologia:micro, dim por entradas}, {inversor:Growatt, topologia:string, dim por MPPT}]` — topologia **por arranjo** |
| **FV + BESS** | `arranjos:[FV…]` + `bess:[{capacidade_kwh, química, marca}]`; **híbrido** = arranjo cujo inversor é híbrido + `bess_vinculado_id` |
| **Ampliação / Retrofit** | novo `Arranjo{origem:'ampliacao', incluido_em}` **adicionado** preservando os existentes e o histórico (governança) |

## 4. Impacto nos consumidores (e reaproveitamento)

| Consumidor | Mudança |
|---|---|
| **Configurador elétrico** | passa a iterar `arranjos[]` (1 painel por arranjo); o branch micro/string já existe (reutiliza `topologiaInversor`/`dimensionarMicro`) |
| **Dimensionamento** | validação **por arranjo** + agregação (`totais`) |
| **Memorial / Parecer / Unifilar** | **uma seção por arranjo** (reusa `descricaoTopologia`) + bloco de totais |
| **Financeiro** | custo por arranjo → somatório; ampliação adiciona linha sem reprecificar o existente |
| **Compatibilidade** | `compativel` do projeto = AND de todos os arranjos |

## 5. Compatibilidade retroativa (migração não-destrutiva)

- **Adaptador de leitura:** projeto legado (`equipamentos.inversor` único + `engenharia_eletrica.
  arranjo`) é lido como **`arranjos:[arranjo_único]`** — nenhuma migração de dados obrigatória.
- **Campos legados mantidos** (`equipamentos.inversor`, `strings[]`, `dimensionamento`) e
  **sincronizados** a partir do **primeiro arranjo** (espelho), como já feito com `topologia`/`micro`.
- **`arranjos[]` é aditivo** (default `[]`/`null`); telas antigas continuam funcionando.
- Migração opcional/preguiçosa: ao salvar engenharia, materializa `arranjos[0]` a partir do legado.

## 6. Roadmap de implementação sugerido (pós-arquitetura)

| Etapa | Conteúdo |
|---|---|
| **A — Schema** | adicionar `arranjos[]` (aditivo) + `totais` (read-model) + adaptador legado→arranjo[0] |
| **B — Configurador** | loop de arranjos (adicionar/remover arranjo; cada um seleciona inversor+módulo+topologia) |
| **C — Dimensionamento** | validação por arranjo + agregação; oversizing/geração por arranjo |
| **D — Documentos** | memorial/parecer/unifilar por-arranjo + totais (reusa `descricaoTopologia`) |
| **E — BESS/EV/Ampliação** | `bess[]`/`ev[]` + `origem:'ampliacao'` + governança de revisões |

## 6.1 Gaps a tratar na implementação (apontados na revisão)

- **Fases / trifásico misto:** cada arranjo carrega `dimensionamento_parcial.fases` (mono/bi/tri)
  **independente** — um projeto pode ter Arranjo A trifásico + Arranjo B monofásico. `totais`
  expõe `fases: 'misto'` quando heterogêneo; o **balanceamento de fases** (distribuição de micros/
  inversores monofásicos entre L1/L2/L3) é regra elétrica a detalhar na etapa C (dimensionamento).
- **Medição agregada:** a geração/consumo é do **ponto de conexão** (uma medição por UC), não por
  arranjo. A geração é **somatório** dos arranjos; consumo/fatura permanecem no nível do projeto/UC.
  Arranjos compartilham a mesma UC (mesmo medidor) salvo projetos multi-UC (fora deste escopo).
- **Governança de ampliação:** `origem:'ampliacao'` + `incluido_em` + snapshot de governança por
  revisão; a ampliação **não reprecifica nem revalida** os arranjos originais (congelados) — gera
  um novo parecer/ART aditivo referenciando o sistema existente.

## 7. Conclusão — arquitetura definitiva

A unidade elétrica deixa de ser **o projeto** e passa a ser **o arranjo**: `Projeto → Arranjos[]`.
Isso resolve, com **um único conceito**, todos os casos do roadmap — múltiplos inversores/
fabricantes, micro+string, híbrido, ampliação, retrofit e BESS — e **reaproveita integralmente** os
módulos já entregues nas sprints micro (classificação + motor + descrição por topologia, agora
aplicados **N vezes**). A transição é **não-destrutiva** (adaptador legado→`arranjos[0]`, campos
aditivos). **Resultado esperado atingido:** modelo `Projeto └── Arranjos[]` especificado e mapeado
aos 4 casos reais. Nenhuma alteração de código/Atlas (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Os 3 gaps apontados (fases mistas, medição agregada, governança de ampliação) foram incorporados na seção 6.1.

## Revisão Arquitetural: Sprint P1-PROJETO-AMPLIACAO-MULTIINVERSOR-01

**Revisor:** Sênior de Arquitetura

**Documento:** Arquitetura definitiva multi-arranjo (READ-ONLY)

**Sprint:** P1-PROJETO-AMPLIACAO-MULTIINVERSOR-01

**Objetivo:** Definir o modelo definitivo para suportar múltiplos inversores/fabricantes/módulos, micro+string, híbrido, ampliações, retrofit e BESS.

---

### Análise e Avaliação:

1.  **Diagnóstico da Limitação (Inversor Único):**
    *   **Avaliação:** Correto. A auditoria do `ProjetoFV.js` demonstra claramente a limitação de um único inversor por projeto, o que impede a representação de cenários com múltiplos fabricantes, tecnologias mistas (micro+string) ou ampliações. A estrutura atual é homogênea e não atômica o suficiente.

2.  **Projeto → Arranjos[] como Unidade Atômica:**
    *   **Avaliação:** Correta e definitiva. A proposta de transformar o `Arranjo` em unidade elétrica atômica, com o `Projeto` agregando múltiplos `Arranjos[]`, é a abordagem arquitetural mais robusta e escalável. Isso permite a granularidade necessária para modelar a complexidade exigida, desde a compatibilidade de equipamentos até a gestão de ampliações. O conceito de `Projeto` como um agregador de `Arranjos` é fundamental para a flexibilidade futura.

3.  **Discriminar `config_eletrica` por Topologia:**
    *   **Avaliação:** Acertado. Separar a configuração elétrica com base na topologia (`string`/`otimizador` vs. `micro`) é crucial para evitar ambiguidades e garantir a correta interpretação dos parâmetros elétricos. Isso permite que cada tipo de arranjo seja configurado e dimensionado de acordo com suas especificidades, sem misturar conceitos como MPPTs e microinversores.

4.  **Mapeamento dos 4 Casos Reais:**
    *   **Avaliação:** Bem mapeados. Os quatro casos apresentados (Escola Pinheiro, Micro+String, FV+BESS, Ampliação/Retrofit) são logicamente representados pela nova estrutura de `Projeto → Arranjos[]`. A capacidade de definir múltiplos arranjos com diferentes inversores e topologias, a vinculação de BESS e a marcação de origem para ampliações são pontos fortes.

5.  **Migração Não-Destrutiva (Adaptador Legado → `arranjos[0]`, Aditivo):**
    *   **Avaliação:** Segura e Viável. A estratégia de migração não-destrutiva é essencial para a adoção da nova arquitetura. O adaptador de leitura que mapeia o estado legado para `arranjos[0]` garante a retrocompatibilidade. Manter campos legados sincronizados e tornar `arranjos[]` aditivo minimiza o impacto em sistemas existentes e permite uma transição gradual. A migração preguiçosa ao salvar é uma boa prática.

6.  **Gaps Arquiteturais:**
    *   **Avaliação:**
        *   **Fases/Trifásico Misto:** A proposta atual parece focar na discriminação por topologia, mas a gestão de fases (monofásico, bifásico, trifásico) dentro de um mesmo projeto com múltiplos arranjos pode precisar de mais detalhamento. Um arranjo pode ser trifásico, enquanto outro monofásico. A agregação dos totais e a representação unifilar precisarão considerar isso.
        *   **Medição:** Não há menção explícita sobre como a medição (consumo, geração) será tratada em um cenário multi-arranjo. A agregação de dados de medição de diferentes arranjos pode ser complexa.
        *   **Governança de Ampliação:** Embora a `origem:'ampliacao'` seja um bom começo, a governança detalhada de revisões, aprovações e histórico de ampliações pode precisar de um escopo mais aprofundado em sprints futuras.

7.  **Veredito:**
    *   **APROVADO COM RESSALVAS**

---

### Justificativa do Veredito:

A arquitetura proposta é sólida, inovadora e resolve de forma elegante as limitações atuais. A introdução do `Arranjo` como unidade atômica é um avanço significativo e a estratégia de migração não-destrutiva é louvável. O reaproveitamento de módulos existentes é um ponto forte.

As ressalvas se concentram em potenciais lacunas que podem surgir na implementação prática, especificamente em relação à gestão detalhada de **fases/trifásico misto** em um projeto com múltiplos arranjos e à necessidade de um plano mais robusto para a **medição** agregada. A **governança de ampliação** também pode demandar mais atenção em etapas posteriores.

Sugere-se que os pontos de fases/trifásico misto e medição sejam considerados em detalhe nas próximas fases de design ou em sprints subsequentes, possivelmente com a criação de campos ou modelos específicos para gerenciar essas complexidades.

---
**Observação:** A revisão foi realizada com base no documento fornecido, assumindo que os detalhes de implementação de cada campo e sua interação serão definidos nas próximas etapas.
