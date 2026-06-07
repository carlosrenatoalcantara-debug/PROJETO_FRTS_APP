# P1-ENGINEERING-INTEGRATION-01 — Exibição de proveniência + correção manual (contrato)

> **Camada de exibição pura.** Zero escrita no Atlas · zero alteração de catálogo/OCR/parser/SSOT ·
> sem alterar componentes React · sem implementar gravação. Módulo novo:
> `backend/src/services/engineeringPresentation.js`.

## FASE 1 — Auditoria dos pontos de exibição

Telas/consumidores que exibem campos elétricos de inversor (tensão de partida, MPPT,
strings, corrente MPPT, Isc, tensão máxima):

| Tela / módulo | Papel |
|---|---|
| `components/fv/FichaTecnicaModal.jsx` | ficha técnica do equipamento |
| `pages/Inversores.jsx` | catálogo + edição de inversor |
| `components/engenharia/PainelCompatibilidadeFV.jsx` | compatibilidade elétrica |
| `components/fv/ConfiguradorArranjoFV.jsx` | dimensionamento de strings/arranjo |
| `components/fv/SeletorInversores.jsx` | seleção de inversor |
| `utils/catalogoEngenhariaAdapter.js`, `hooks/useCompatibilidadeEletrica.js` | adaptadores/hook |

Essas telas **podem adotar** o payload de badges; **nenhuma foi alterada** nesta sprint.

## FASE 2 — Contrato de status (padronizado)

`montarPayloadEngenharia(equipReal, ctx)` → `{ campos: { campo: { valor, status, badge,
real, justificativa? } }, fallback_aplicado, tem_fallback }`. Status ∈
`extraido · validado · inferido_forte · fallback_conservador`. **Todo campo exibido
informa sua origem.**

## FASE 3 — Badges visuais (camada de exibição)

| Status | Badge | `real` |
|---|---|---|
| `extraido` | 🟢 Extraído | true |
| `validado` | 🔵 Validado | true |
| `inferido_forte` | 🟡 Inferido | true |
| `fallback_conservador` | 🟠 Fallback Conservador | **false** |

O flag `real:false` no fallback permite a UI **não confundir** estimativa com dado real.
Nenhum dado persistido é alterado.

## FASE 4 — Painel de justificativa

Todo valor de fallback expõe `justificativa: { origem, confianca, motivo, texto }`, ex.:
> Origem: fallback_conservador · Confiança: baixa · Motivo: campo ausente

## FASE 5 — Correção manual futura (contrato, sem gravar)

- **Payload** `PAYLOAD_SUBSTITUICAO`: `{ equipamento_id, campo, valor_real, por (role), justificativa? }`.
- **Autorização**: `ROLES_PODEM_SUBSTITUIR = [engenheiro, tecnico, administrador]`.
- **Validações**: `validarSubstituicaoManual(payload, role)` → `{ ok, erros, efeito }`. O
  `efeito` **descreve** o que seria feito (`gravar_valor_real_no_atlas`, `remove_fallback`)
  mas **não executa**. Sem endpoint/UI nesta sprint.

## FASE 6 — Auditoria de impacto (contra o catálogo real)

1. **Quantos equipamentos exibiriam badges hoje?** **22 inversores** exibiriam o badge
   🟠 (fallback de `tensao_partida`); além disso, cada campo presente exibe 🟢/🟡 conforme
   a origem. (Módulos/EV não têm regra de fallback ativa → só badges de origem real.)
2. **Quantos campos usam fallback?** **1** (`tensao_partida`), em 22 inversores.
3. **Quais telas serão afetadas?** As da FASE 1 (FichaTecnica, Inversores, Compatibilidade,
   ConfiguradorArranjo, SeletorInversores) — **quando adotarem** o payload; nenhuma alterada agora.
4. **Existe risco de regressão?** **Não** — módulos novos e isolados (funções puras), sem
   alterar componentes, rotas, SSOT, parser ou dados.
5. **O Atlas continua imutável?** **Sim** — validação live: **0** valores de fallback
   persistidos (`especificacoes.tensao_partida` ausente em 100%).

## FASE 7 — Testes (`engineeringPresentation.test.js`, 10 casos)

Badges (4 status, fallback `real:false`); payload (extraído 🟢 sem justificativa; fallback
🟠 com justificativa + `substituivel`; inferido 🟡; valor real não vira fallback); não-mutação
do real; validação de substituição (role autorizada/negada, payload incompleto, efeito
descrito sem executar).

## FASE 8 — Respostas

1. **Como o usuário identifica um valor estimado?** Pelo badge **🟠 "Fallback Conservador"**
   (flag `real:false`) + o painel de justificativa (origem `fallback_conservador`, confiança
   baixa, motivo "campo ausente"). Valores reais aparecem 🟢/🔵/🟡.
2. **Como será a futura correção manual?** Engenheiro/técnico/administrador enviam o
   `PAYLOAD_SUBSTITUICAO`; `validarSubstituicaoManual` autoriza e valida; ao implementar
   (sprint futura), grava o **valor REAL no Atlas** e remove o fallback, com autoria/data.
3. **Quantos equipamentos serão beneficiados?** **22 inversores** (todos passam a ter
   `tensao_partida` operacional, claramente sinalizado como estimativa).
4. **Como evitar que estimativas sejam confundidas com valores reais?** Badge 🟠 distinto +
   `real:false` + justificativa obrigatória; o valor de fallback **nunca** é persistido (o
   Atlas só recebe valor real via substituição manual autorizada).
5. **Próxima sprint recomendada?** **P1-ENGINEERING-CONSUME-01** — adotar o payload de
   badges nas telas (FichaTecnica/Inversores/Compatibilidade) e expor um endpoint read-only
   que devolva o payload; em paralelo, **P1-PARSER-STARTVOLTAGE-01** (extrair o valor REAL).

### Conclusão
A proveniência agora é **exibível** (badges + justificativa) e a correção manual tem
**contrato/autorização/validação** prontos — tudo em camada pura, sem tocar componentes,
SSOT ou Atlas. 22 inversores ganham `tensao_partida` visível e inequivocamente marcada
como estimativa conservadora.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-ENGINEERING-INTEGRATION-01 (app solar Node/Mongo)

**Avaliação Geral:** A abordagem da sprint é **APROVADA COM RESSALVAS**. A criação do módulo `engineeringPresentation.js` para tornar visíveis os valores inferidos e preparar a correção manual futura é um passo crucial e bem executado em termos de isolamento e contrato. No entanto, a ressalva reside na clareza da comunicação do "fallback real:false" e na necessidade de um plano mais robusto para a futura implementação da gravação.

**Análise Detalhada:**

1.  **Distinção entre Estimativa e Dado Real:** A abordagem de badges (🟢extraído/🔵validado/🟡inferido/🟠fallback) combinada com o flag `real:false` para o fallback é **eficaz na distinção**. O badge 🟠 e a justificativa detalhada (origem, confiança, motivo) comunicam claramente que o valor é uma estimativa conservadora e não um dado real. A ausência de persistência no Atlas reforça essa distinção.

2.  **Contrato de Substituição Manual:** O contrato de substituição manual (payload/autorização/validação sem gravar) é **adequado e seguro para esta fase**. A definição de roles (`engenheiro`, `tecnico`, `admin`) e a validação do payload com descrição do efeito (sem execução) criam uma base sólida para a implementação futura. A segurança é mantida pela ausência de gravação e pela validação de roles.

3.  **Risco de Regressão/Contaminação do Atlas:** O risco de regressão/contaminação do Atlas é **confirmado como zero**. A criação de um módulo puro, sem alteração de componentes React, SSOT, parser ou gravação no Atlas, garante o isolamento e a imutabilidade dos dados existentes.

4.  **Riscos:**
    *   **Risco de Confusão Futura:** Embora a distinção seja clara agora, a **próxima sprint (P1-ENGINEERING-CONSUME-01)**, que adotará o payload nas telas, precisa garantir que a UI apresente o badge 🟠 e a justificativa de forma proeminente para evitar qualquer confusão a longo prazo.
    *   **Implementação da Gravação:** A sprint atual prepara o contrato, mas a **implementação futura da gravação** (P1-PARSER-STARTVOLTAGE-01 e a gravação em si) precisará de atenção rigorosa para garantir a integridade dos dados e a correta substituição do fallback pelo valor real.
    *   **Abrangência do Fallback:** Atualmente, apenas `tensao_partida` em 22 inversores é afetado. É importante monitorar se outros campos podem necessitar de regras de fallback semelhantes no futuro.

5.  **Veredito:** **APROVADO COM RESSALVAS**.

    *   **Aprovações:** A arquitetura da sprint é excelente em termos de isolamento, clareza na exibição de proveniência e preparação segura para a correção manual. O módulo `engineeringPresentation.js` é um ganho significativo.
    *   **Ressalvas:** A principal ressalva é a necessidade de **atenção redobrada na próxima fase de consumo** para garantir que a apresentação visual do fallback seja inequivocamente clara e que a **implementação futura da gravação** seja robusta. A recomendação de próximas sprints é pertinente e deve ser priorizada.

A sprint cumpre seus objetivos de tornar visíveis os valores inferidos de forma segura e preparar o terreno para a correção manual, com um impacto mínimo e controlado.
