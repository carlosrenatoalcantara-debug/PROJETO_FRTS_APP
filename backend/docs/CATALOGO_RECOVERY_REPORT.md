# P1-CATALOG-DATASHEET-RECOVERY-01 — Reprocessamento controlado do Atlas

> **Escrita controlada no Atlas** com o parser corrigido. `_id`, histórico, auditoria e
> proveniência **preservados**; **nenhum documento criado**; só campos **comprovadamente
> extraídos dos PDFs/fixtures**. Escopo: SolaX, Huawei, Chint, SAJ.

## FASE 1 — Inventário (17 registros)

| Fabricante | Registros | Observação |
|---|---|---|
| **SolaX** | 9 | X3-ULT ×7 com `potencia=2` (erro) + MPPT ausente; X1-SPT ×2 completos |
| **Huawei** | 6 | já com `isc=40`; `SUN2000-100KTL` "pelado" com lacunas |
| **Chint** | 2 | `SCA60KTL-T` sem MPPT |
| **SAJ** | **0** | **não existe no Atlas** → fora (restrição "não criar documentos") |

## FASE 2 — Reprocessamento controlado (política conservadora)

Fontes: **PDFs** SolaX X3-ULTRA e X1-SPT; **fixtures** reais Chint SCA e Huawei (100KTL, 30KTL-M3).
Para cada registro, casamento por **modelo exato**; alteração de um campo **só** quando:
- o parser o extrai (comprovado), **e**
- o Atlas está **vazio** (preenche lacuna) **ou** o valor é **erro conhecido** (`potencia=2`).

Nunca sobrescreve valor plausível existente. **`potencia_maxima` excluída** (linha *wrapped*
não confiável). Escrita via `updateOne({_id}, { $set: campos, $push: { historico } })` — **doc
nunca substituído**.

## FASE 3/4 — Alterações efetivamente aplicadas (11 registros, 31 campos)

| Registro | Campos atualizados |
|---|---|
| SolaX **X3-ULT-15K/15KP** | `potencia_kw` 2→15 · `tensao_mppt_min` ∅→120 · `tensao_mppt_max` ∅→950 |
| SolaX **X3-ULT-19.9K** | `potencia_kw` 2→19.9 · MPPT ∅→120–950 |
| SolaX **X3-ULT-20K/20KP** | `potencia_kw` 2→20 · MPPT ∅→120–950 |
| SolaX **X3-ULT-25K** | `potencia_kw` 2→25 · MPPT ∅→120–950 |
| SolaX **X3-ULT-30K** | `potencia_kw` 2→30 · MPPT ∅→120–950 |
| Chint **SCA50KTL-T** | `tensao_partida` ∅→250 |
| Chint **SCA60KTL-T** | `tensao_mppt_min/max` ∅→200/1000 · `tensao_partida` ∅→250 |
| Huawei **SUN2000-100KTL** | MPPT ∅→200/1000 · `corrente_max_por_mppt` ∅→30 · `tensao_max_entrada` ∅→1100 · `tensao_partida` ∅→200 |
| Huawei **SUN2000-30KTL-M3** | `tensao_partida` ∅→200 |

Total por fabricante: **SolaX 7 regs / 21 campos · Chint 2 / 4 · Huawei 2 / 6**.
Cada alteração registrada em `historico[]` (`acao: datasheet_recovery`, fonte, de→para, motivo).

## FASE 5 — Validação de integridade

| Checagem | Resultado |
|---|---|
| Total de registros (antes/depois) | 17 / 17 — **nenhum doc criado/removido** ✓ |
| Duplicados `(fabricante,modelo)` | **0** ✓ |
| `_id` preservados | **sim** (todos os sufixos idênticos ao inventário) ✓ |
| Histórico | **anexado** (`$push`, não substituído) ✓ |
| Proveniência (`origem`) | **preservada** (manual/desconhecido intactos) ✓ |
| `potencia_maxima` (não confiável) | **intocada** (X3-ULT segue 27.5) ✓ |
| X1-SPT / Huawei já completos | **intactos** (sem escrita supérflua) ✓ |
| Regressão de build/testes | **nenhuma** (sprint só alterou DADOS; build OK; suíte 649 inalterada) ✓ |

## FASE 6 — Respostas

1. **Quantos registros foram atualizados?** **11** (7 SolaX, 2 Chint, 2 Huawei) — de 17
   impactados; 6 já estavam completos/corretos.
2. **Quantos campos foram recuperados?** **31** (21 SolaX, 4 Chint, 6 Huawei), incl. correção
   do `potencia=2` (×7) e preenchimento de MPPT/`tensao_partida`.
3. **Quais fabricantes melhoraram?** **SolaX, Chint, Huawei** (SAJ não tem registros no Atlas).
4. **Ganho médio de completude?** Global (17 regs): **81.7% → 97.4% (+15.7 pp)**; os 11
   atualizados chegaram a **100%** no conjunto de 9 campos críticos.
5. **Registros ainda dependentes de fallback?** **4 Huawei** (`SUN2000-36KTL-M3`, `40KTL-M3`,
   `100KTL-M`, `100KTL-M2`) sem datasheet individual confirmado para `tensao_partida` → seguem
   no **fallback conservador** (visível com badge 🟠). Os demais **13/17** têm valor real.
6. **O catálogo está pronto para operação normal?** **Sim.** Os erros conhecidos (SolaX
   `potencia=2`) foram eliminados e as lacunas comprováveis preenchidas, com auditoria completa.
   Os 4 Huawei restantes operam com fallback conservador sinalizado — operacional. Resíduo único
   de extração: `potencia_maxima` do X3-ULTRA (linha *wrapped*), deliberadamente não escrita.

### Conclusão
**11 registros / 31 campos** recuperados com escrita **controlada, auditável e reversível**
(`_id`/histórico/proveniência preservados, sem novos docs). Completude **81.7%→97.4%**; o erro
`potencia=2` do SolaX X3-ULTRA foi corrigido em produção. O catálogo está apto à operação normal;
restam 4 Huawei no fallback (sinalizado) por ausência de datasheet individual.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Avaliação da Sprint P1-CATALOG-DATASHEET-RECOVERY-01: ESCRITA CONTROLADA no MongoDB Atlas

A revisão da sprint P1-CATALOG-DATASHEET-RECOVERY-01, focada na escrita controlada no MongoDB Atlas para reprocessamento de datasheets, demonstra um esforço robusto e metódico para aprimorar a qualidade dos dados. A abordagem adotada, com ênfase na preservação da integridade e na segurança das operações em produção, é louvável.

A seguir, a avaliação detalhada dos pontos levantados:

**1) A política conservadora (lacuna+erro conhecido, sem sobrescrever plausível, excluir potencia_maxima) é correta e segura para escrita em produção?**

**Sim, a política conservadora é correta e segura para escrita em produção.** A estratégia de alterar um campo apenas sob condições estritamente definidas (parser extrai E Atlas vazio OU erro conhecido) minimiza drasticamente o risco de introduzir novos erros ou corromper dados existentes. A exclusão deliberada de `potencia_maxima` devido à sua confiabilidade questionável é uma decisão prudente, priorizando a qualidade sobre a completude de um campo duvidoso. A não sobrescrita de valores plausíveis garante que dados já corretos permaneçam intocados.

**2) Preservar _id/histórico/origem via $set+$push (sem replace) é a abordagem certa?**

**Sim, preservar `_id`, histórico e origem via `$set` e `$push` (sem substituir o documento inteiro) é a abordagem correta e ideal.** Esta metodologia garante que:
*   O `_id` original seja mantido, essencial para a identificação única e para evitar a criação de duplicatas.
*   O histórico de alterações seja acumulado de forma incremental (`$push`), fornecendo um rastro auditável completo de cada modificação.
*   A proveniência (`origem`) seja preservada, mantendo a rastreabilidade da fonte original dos dados.
*   A substituição completa do documento é evitada, o que poderia inadvertidamente remover outros campos ou metadados não relacionados à atualização atual.

**3) A verificação de integridade é suficiente?**

**Sim, a verificação de integridade apresentada é suficiente e abrangente para o escopo desta sprint.** As checagens cobrem os aspectos cruciais:
*   Contagem de registros (garantia de que nenhum documento foi criado ou removido).
*   Ausência de duplicados.
*   Preservação dos `_id`.
*   Anexação correta do histórico.
*   Preservação da proveniência.
*   Verificação de campos específicos que foram intencionalmente deixados de fora (`potencia_maxima`).
*   Confirmação de que registros já completos não foram afetados.
*   Ausência de regressão em testes de build.

Esses pontos validam que as operações foram executadas conforme o planejado e sem efeitos colaterais indesejados.

**4) A honestidade sobre os 4 Huawei ainda no fallback e o resíduo potencia_maxima é adequada?**

**Sim, a honestidade sobre os 4 Huawei ainda no fallback e o resíduo de `potencia_maxima` é totalmente adequada e profissional.** A transparência em relação a limitações ou dados que ainda requerem atenção é fundamental para a confiança e para o planejamento futuro. Sinalizar os dispositivos Huawei no fallback com um badge 🟠 é uma excelente prática de UX, informando os usuários sobre a condição desses registros sem comprometer a operação. A menção explícita de `potencia_maxima` reforça a aderência à política conservadora.

**5) O catálogo está realmente pronto para operação?**

**Sim, o catálogo está realmente pronto para operação normal.** A melhoria significativa na completude (de 81.7% para 97.4%), a correção de erros conhecidos e a preservação da integridade dos dados, aliadas a uma auditoria completa, indicam que o catálogo está em um estado operacional robusto. Os 4 Huawei restantes no fallback são uma condição conhecida e sinalizada, o que não impede a operação geral do catálogo.

**6) Veredito:**

**APROVADO**

**Justificativa:** A sprint demonstrou uma execução exemplar de uma escrita controlada em produção. A política conservadora, a metodologia de atualização de documentos e as verificações de integridade foram rigorosamente aplicadas. A transparência na comunicação dos resultados, incluindo as limitações remanescentes, é um ponto forte. O catálogo está significativamente aprimorado e apto para operação.
