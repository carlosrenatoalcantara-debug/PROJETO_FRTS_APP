# EQUIPMENT_ID — Opções de Migração (análise comparativa)

**Sprint:** P1-EQUIPMENT-ID-MIGRATION-FORENSICS-01 · **Modelo:** Opus 4.8
**Tipo:** FORENSE / READ ONLY — **NENHUMA migração foi criada ou executada.**
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

> Documento de **decisão**, não de implementação. Nenhum script de migração foi gerado.
> As estimativas de esforço são ordens de grandeza, não compromisso.

---

## Contexto da decisão

`equipamento_id` é hoje um vínculo **opcional** com fallback fabricante+modelo em todos os pontos
críticos. Não há quebra de integridade com `null` (ver RISK_ANALYSIS). A pergunta não é "consertar um
bug", e sim "vale a pena investir em qualidade de dados de vínculo ao catálogo, e como".

---

## Estratégia A — Manter fallback fabricante+modelo (status quo)

| Aspecto | Avaliação |
|---|---|
| **Vantagens** | Zero esforço. Zero risco. Já funciona em produção (146 projetos SUN2000 comprovam). Resiliente a mudanças de catálogo. Snapshots já são auto-contidos. |
| **Riscos** | Re-match por string a cada leitura (custo CPU marginal). Sem link clicável projeto→catálogo. Rastreabilidade O&M futura precisa re-resolver. Ambiguidade quando há modelos homônimos de fabricantes diferentes. |
| **Esforço** | **Nenhum.** |
| **Impacto** | Mantém o sistema como está. Bloqueia features que exijam junção forte as-built↔as-specified. |

**Quando escolher:** se não há roadmap de O&M/rastreabilidade por catálogo no curto prazo.

---

## Estratégia B — Migrar TODOS os projetos (backfill total)

| Aspecto | Avaliação |
|---|---|
| **Vantagens** | Vínculo forte universal. Links clicáveis. Base limpa para O&M. Elimina re-match repetido. |
| **Riscos** | **ALTO.** Forçar bind em projetos com identidade fraca → vínculos incorretos. Modelos ambíguos casam errado. Risco de tocar dados de projetos sensíveis em massa. Exige lidar com a ambiguidade ObjectId vs id-string. |
| **Esforço** | **3–4 sprints** (backfill + revisão manual de ambíguos + validação + rollback plan). |
| **Impacto** | Alto valor SE o match for confiável; alto risco se aplicado sem gate de score. |

**Quando escolher:** raramente recomendável de forma "total" — o subconjunto incerto não deveria ser
forçado. Degenera para a Estratégia D na prática.

---

## Estratégia C — Migrar SOMENTE ativos

| Aspecto | Avaliação |
|---|---|
| **Vantagens** | Foca onde equipamento_id tem maior valor real (Gêmeo Digital / O&M). Volume menor que projetos. Não toca o fluxo comercial/engenharia. |
| **Riscos** | **BAIXO–MEDIO.** Ativos já funcionam sem o id; o ganho é rastreabilidade futura. Ainda precisa do gate de score. |
| **Esforço** | **1 sprint** (backfill idempotente sobre `ativos_equipamento` reusando o matcher). |
| **Impacto** | Habilita O&M por catálogo (recall por lote, garantia agregada) sem mexer em projetos. |

**Quando escolher:** se a prioridade é O&M/rastreabilidade e não a navegação projeto→catálogo.

---

## Estratégia D — Modelo Híbrido (RECOMENDADA)

**Definição:** manter o fallback fabricante+modelo como **contrato permanente** (nunca remover) e
fazer um **backfill best-effort idempotente** que preenche `equipamento_id` **apenas onde o matcher
tem alta confiança**, deixando `null` (e portanto fallback) onde houver qualquer incerteza.

| Aspecto | Avaliação |
|---|---|
| **Vantagens** | Captura o ganho fácil (matches ALTO) sem assumir o risco dos ambíguos. Fallback permanece como rede de segurança. Idempotente e reversível. Não toca snapshots. Reusa `equipamentoMatcherService` (já distingue ALTO/MEDIO/BAIXO/ambíguo). |
| **Riscos** | **BAIXO.** Único cuidado: gravar só `_id` de Equipamento (Atlas), nunca id-string estático; só preencher onde `== null`; pular CONGELADO/HOMOLOGADO. |
| **Esforço** | **~1 sprint** backfill (dry-run obrigatório + gate score ≥ 0.85 + relatório de não-resolvidos) + **~1 sprint** validação. |
| **Impacto** | Melhora incremental e segura da qualidade de dados; preserva 100% da resiliência atual. |

### Regras de ouro do backfill híbrido (quando/se for implementado em sprint futura)
1. **READ-MOSTLY com gate:** resolver via matcher; aplicar **só** se `nivel_confianca === 'ALTO'`
   (score ≥ 0.85) e `status === 'equipamento_encontrado'`. Ambíguo → não toca.
2. **Idempotente:** preencher exclusivamente onde `equipamento_id == null`. Nunca sobrescrever.
3. **Só Atlas:** gravar `Equipamento._id` (ObjectId). Descartar id-string do catálogo estático.
4. **Imutabilidade:** **PULAR** qualquer projeto/arranjo cujo governança esteja
   `CONGELADO`/`HOMOLOGADO`. Snapshots nunca são tocados.
5. **Dry-run primeiro:** produzir matriz `{resolvido_alto, ambiguo, nao_resolvido}` antes de gravar.
6. **Reversível:** registrar proveniência (`equipamento_id_origem: 'backfill_matcher'`) para permitir
   reverter exatamente os campos preenchidos pelo backfill.

---

## Recomendação final

**Estratégia D (Híbrido).** Razões:
- O risco real do `null` é **BAIXO–MÉDIO** e concentrado em conveniência/rastreabilidade, não em
  integridade — então uma migração total (B) é desproporcional ao problema.
- O fallback fabricante+modelo é robusto e comprovado em produção; removê-lo seria um retrocesso.
- O ganho de vínculo só é seguro quando o match é inequívoco — exatamente o que o gate de score
  do híbrido garante.
- Snapshots já resolvem a integridade regulatória independentemente de `equipamento_id`.

**Necessidade de migração:** **NÃO obrigatória.** Desejável e segura na forma híbrida, quando houver
roadmap de O&M. Sem urgência operacional.

**Pré-condição para qualquer migração:** rodar as **Queries de Medição** do FORENSICS_REPORT para
quantificar a prevalência real (quantos docs com `null`) — decisão de investir deve ser baseada em
número medido, não em estimativa.

---

## RESPOSTAS DIRETAS (consolidado)

1. **Projetos afetados:** `[PENDENTE — Q2.x]`. Sinal indireto de alta prevalência (binding por string dominante).
2. **Arranjos afetados:** `[PENDENTE — Q3.1]`.
3. **Ativos afetados:** `[PENDENTE — Q5.1]`; impacto funcional ≈ 0.
4. **Dependência do fallback:** ALTA e por design (todos os pontos críticos).
5. **Risco real:** BAIXO–MÉDIO; nenhuma quebra de integridade.
6. **Estratégia recomendada:** D (Híbrido).
7. **Necessidade de migração:** não obrigatória; desejável na forma híbrida.
8. **Esforço:** D ≈ 1 sprint backfill + 1 validação; B ≈ 3–4 sprints.

> **Honestidade:** nenhuma migração criada, nenhum banco alterado, nenhum código de produto alterado.
> Contagens reais pendentes de DB. Revisão Gemini obrigatória e pendente.
