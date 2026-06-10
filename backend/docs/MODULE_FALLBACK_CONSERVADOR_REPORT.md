# P1-MODULE-FALLBACK-CONSERVADOR-01 — Fallback conservador de módulos

> Escrita **controlada** no Atlas: preenche specs **inferidas conservadoras** em módulos
> INCOMPLETOS, **só em campos vazios**, **nunca** sobrescrevendo dado real, com origem rastreável.
> Não toca módulos REAL / inversores / EV / parser / OCR.

## Princípio aplicado
**Dado real sempre vence.** O fallback entra **apenas** quando o campo está ausente E o equipamento
é INCOMPLETO. Valores escolhidos pelo **lado seguro** do dimensionamento (não busca performance).

## FASE 1 — Candidatos e famílias (109 candidatos, 2 bloqueados, 50 REAL)

Agrupamento por tecnologia × células-série × banda de potência (× bifacial):

| Família | Qtde | Família | Qtde |
|---|---|---|---|
| 72c · 540–555 W | 30 | 72c · 600–635 W | 7 |
| 72c · 560–595 W | 23 | 66c · 560–595 W | 4 |
| 60c · <480 W | 15 | 66c · 600–635 W | 4 |
| 66c · 640–700 W | 7 | 72c · 600–635 W BIF | 4 |
| … (demais bandas/bifaciais) | ~15 | | |

## FASE 2 — Tabela conservadora (modelo físico coerente)

A partir de **potência** + **nº de células-série** (inferido do modelo/banda):

| Campo | Fórmula conservadora | Direção segura |
|---|---|---|
| `voc` | `células × 0,71 V/cél` | **alto** (não subestima Vmáx) |
| `vmp` | `Voc × 0,80` | **baixo** (Vmpp-mín seguro) |
| `imp` | `Pmpp / Vmp` | — |
| `isc` | `Imp / 0,92` (≈ ×1,087) | **alto** (não subestima Imáx) |
| `eficiencia` | `Pmpp/área − 0,6 p.p.`, clamp **[17 ; 22,5]%** | **baixo** (área conservadora) |

**Exemplos:** 550 W/72c → Voc 51,1 · Vmp 40,9 · Isc 14,6 · Imp 13,4 · 20,7% · 695 W/66c → Voc 46,9 ·
Isc 20,1 · 22,2%. **Sanity garantido:** Voc>Vmp, Isc>Imp, faixas físicas (Voc≤55,4 · Isc≤20,3 ·
efic≤22,5). **Parciais** (já têm elétrico real) recebem **apenas `potencia_wp`** — **nunca** se
mistura elétrico inferido com elétrico real (evita incoerência).

## FASE 3 — Status de qualidade (`qualidadeEquipamento.js`)

`statusQualidade(eq)` → **🟢 REAL** (mínimo presente, sem fallback) / **🟡 INFERIDO** (tem
`fallback_conservador`) / **🔴 INCOMPLETO** (sem mínimo). `utilizavelEmProjeto(eq)` = tem o mínimo.

## FASE 4 — Persistência (rastreável, origem preservada)

109 módulos atualizados (driver raw): `$set especificacoes.<vazios>` + bloco **`fallback`**
`{ tipo:'fallback_conservador', data, versao:'fallback-conservador-v1', campos[], lote,
modelo_fisico }` + `$push historico`. **`origem` original PRESERVADA** (109/109 — `desconhecido`/
`import_solarmarket` intactos; o fallback foi gravado em campo **dedicado**, não em `origem.tipo`,
honrando "nunca apagar origem existente"). **Correção de consistência:** em **3 parciais** o elétrico
inferido foi **removido** (mantido só `potencia_wp`) para não misturar com o elétrico real.

## FASE 5 — UX

Equipamentos inferidos exibem **🟡 Dados inferidos** com tooltip exato:
*"Dados conservadores utilizados por ausência de datasheet. Recomenda-se revisão posterior."*
(`qualidadeEquipamento.js` + 5 testes verdes; pronto para o `QualidadeBadge` adotar a tricotomia).

## FASE 6 — Validação

| Verificação | Resultado |
|---|---|
| Módulos utilizáveis (5 campos mín) | **50 → 156** |
| Inconsistências físicas **causadas pelo fallback** | **0** ✅ |
| Inconsistências **pré-existentes** (Isc≤Imp em originais Neosolar/Canadian) | 6 (dado real ruim — **não** do fallback; sinalizado p/ governança) |
| Dado real sobrescrito | **0** (origem 109/109 preservada; elétrico real intocado) |
| Fallback fora de módulo (inversor/EV) | **0 / 0** ✅ |
| Total de registros | **349 → 349** (0 novos) |

Dimensionamento/parecer/memorial passam a funcionar para os 109 (têm Voc/Vmp/Isc/Imp/Pmpp).

## FASE 7 — Respostas obrigatórias

1. **Receberam fallback:** **109**.
2. **Permaneceram bloqueados:** **2** (sem potência) + **3** parciais (elétrico misto removido →
   seguem parciais) = **5** sem o mínimo completo.
3. **Viraram utilizáveis:** **156** (de 50) → **+106**.
4. **Ganho real de completude:** módulos utilizáveis **31% → 97% (156/161)**.
5. **Conflito com dado real:** **0** — origem e elétrico real preservados; mistura inferido×real
   eliminada (3 corrigidos).
6. **Falso-positivo:** **0** introduzido pelo fallback (as 6 inconsistências são **dado real
   pré-existente**, fora do escopo desta sprint).
7. **Catálogo apto para operação?** **Módulos: sim** — 97% utilizáveis, inferidos marcados 🟡 com
   tooltip. **Inversores ainda não** (130 shells) — próximo alvo (datasheet/Vision).

### Conclusão
O fallback conservador levou os módulos utilizáveis de **50 → 156 (31%→97%)** com **0 falso-positivo
e 0 dado real sobrescrito**, valores **fisicamente coerentes e do lado seguro**, rastreáveis
(`fallback_conservador` + histórico) e marcados **🟡 INFERIDO**. Lote em `MODULE_FALLBACK_LOTE.json`.
**Próximas:** `P1-CATALOG-NORMALIZE-FABRICANTES` (6 aliases) + fallback/datasheet de **inversores**;
e uma limpeza dos **6 módulos com Isc≤Imp pré-existente** (governança).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida). Veredito: sucesso notável (APROVADO).

## Revisão da Sprint P1-MODULE-FALLBACK-CONSERVADOR-01

A sprint P1-MODULE-FALLBACK-CONSERVADOR-01 demonstra um esforço robusto e bem planejado para lidar com a lacuna de dados em módulos fotovoltaicos, priorizando a segurança e a integridade dos dados. A abordagem de "fallback conservador" é logicamente estruturada e implementada com atenção aos detalhes.

**Avaliação dos Pontos Específicos:**

1.  **O modelo conservador (Voc/Isc altos, Vmp/efic baixos) é fisicamente correto e seguro p/ dimensionamento?**
    Sim, o modelo é fisicamente correto e seguro para dimensionamento. A elevação de Voc e Isc garante que os limites máximos de tensão e corrente não sejam subestimados, evitando sobrecarga ou falhas em condições de pico. A redução de Vmp e eficiência, por outro lado, assegura que a potência de saída esperada não seja superestimada, levando a um dimensionamento mais robusto e com margem de segurança. A direção dos valores está alinhada com o princípio de "lado seguro".

2.  **A regra 'parcial recebe só potencia_wp, nunca mistura elétrico inferido com real' é acertada?**
    Absolutamente acertada. Esta regra é crucial para manter a integridade dos dados. Módulos parciais já possuem dados elétricos reais, e misturá-los com dados inferidos criaria inconsistências e invalidaria as informações existentes. Limitar o fallback apenas à `potencia_wp` para esses casos é a abordagem correta para preservar a qualidade dos dados reais.

3.  **Preservar origem + gravar fallback em campo dedicado respeita 'nunca apagar origem'?**
    Sim, a abordagem respeita integralmente o princípio de "nunca apagar origem". Ao gravar o fallback em um campo dedicado (`fallback_conservador`) e manter a `origem` original intacta, a rastreabilidade é preservada sem sobrescrever ou corromper os dados originais. Isso é fundamental para auditoria e futuras correções.

4.  **Distinguir corretamente as 6 inconsistências como pré-existentes (não do fallback) é honesto e bem comprovado?**
    Sim, a distinção é honesta e, com base na descrição, bem comprovada. A identificação de inconsistências em dados reais pré-existentes (como `Isc ≤ Imp` em originais Neosolar/Canadian) e a sua exclusão do escopo de problemas causados pelo fallback demonstram um rigor analítico. Sinalizar essas inconsistências para a governança é a ação correta para tratá-las adequadamente.

5.  **Clamp de eficiência [17,22.5] evita valores impossíveis?**
    Sim, o clamp de eficiência em [17, 22.5]% é uma medida eficaz para evitar valores impossíveis ou irrealistas. Essa faixa abrange a maioria das eficiências de módulos comerciais modernos, e o limite superior garante que não se infira uma eficiência excessivamente alta, mantendo a conservação.

6.  **O status 🟡 INFERIDO + tooltip é a UX correta?**
    Sim, a UX é correta e bem pensada. O status visual 🟡 INFERIDO comunica claramente que os dados não são originais, e o tooltip fornece o contexto necessário ("Dados conservadores utilizados por ausência de datasheet. Recomenda-se revisão posterior."). Isso gerencia as expectativas do usuário e incentiva a verificação futura, sem comprometer a usabilidade imediata do catálogo.

7.  **O catálogo de módulos apto (97%) é conclusão justa?**
    Sim, a conclusão de que o catálogo de módulos está apto (97% utilizáveis) é justa e um resultado significativo da sprint. O aumento drástico na porcentagem de módulos utilizáveis, mantendo a integridade dos dados e a segurança do dimensionamento, valida o sucesso da iniciativa.

**Veredito:**

A sprint P1-MODULE-FALLBACK-CONSERVADOR-01 foi um **sucesso notável**. A metodologia de fallback conservador foi implementada de forma rigorosa, segura e transparente. A preservação da origem, a clareza na marcação de dados inferidos e a correção de inconsistências pré-existentes demonstram um alto nível de maturidade no processo de gestão de dados. O ganho de 106 módulos utilizáveis (de 50 para 156) representa um avanço substancial na completude e usabilidade do catálogo. As próximas etapas planejadas são lógicas e complementares.

**Recomendação:** Proceder com as próximas fases conforme planejado, mantendo o rigor e a atenção aos detalhes demonstrados nesta sprint.
