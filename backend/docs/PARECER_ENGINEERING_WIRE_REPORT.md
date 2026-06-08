# P1-PARECER-ENGINEERING-WIRE-01 — Engenharia/Atlas/Beneficiárias no memorial

> Escopo: **apenas o fluxo de documentos** (`memorialDescritivoService` + `homologacaoController`).
> Sem alterar parser/catálogo/SSOT. Compatibilidade preservada (assinatura antiga continua válida).

## FASE 1 — Dialeto corrigido

`memorial`/`carta`/`ART` liam `inversor.potenciaKW` (**camelCase**), mas o `ProjetoFV` persiste
`potencia_kw` (**snake**) → "N/A". **Ocorrências corrigidas (1 padrão, 4 pontos):**
`potenciaKW` no memorial, na carta e no ART; `nMppts` no memorial. Solução: helper `_pick(obj,
[aliases])` que tolera snake **e** camel, mais resolvedores que normalizam o equipamento. Auditoria
de casos similares: nenhum outro campo camelCase remanescente nos documentos.

## FASE 2 — Atlas vivo × Snapshot

| Campo | Origem (depois) |
|---|---|
| inversor: potência, nº MPPT, fases, marca, modelo, garantia | **Atlas vivo** (se há `_id` ref) → snapshot |
| módulo: pmpp, Voc, Isc, eficiência, garantias, marca, modelo | **Atlas vivo** (se há `_id` ref) → snapshot |
| certificações (INMETRO/IEC) | **Atlas vivo** (`equipamento.certificacao`) |
| `tensao_partida` e demais específicos de engenharia | Atlas + **fallback sinalizado** |
| beneficiárias / rateio | `UnidadeBeneficiaria` (live por `projetoId`) |
| potência_kwp, strings, endereço, concessionária, estrutura | **snapshot do projeto** (dimensionamento — correto manter) |

O `homologacaoController.gerarMemorial` agora carrega `Equipamento.find({_id:$in})` + beneficiárias
e passa em `opts`. Tolerante a falhas → cai no snapshot (compatibilidade).

## FASE 3 — engineeringPresentation integrado

`montarPayloadEngenharia(_canonInversor(esp))` detecta campos `fallback_conservador`. Quando há
fallback, o documento registra:
> ⚠ Valores inferidos (tensao_partida): **Valor estimado conservadoramente — sujeito à validação técnica.**

A proveniência **não é escondida**: o memorial declara também a **fonte** ("catálogo (Atlas)" vs
"snapshot do projeto"). Valores reais **não** recebem o disclaimer (teste cobre os dois casos).

## FASE 4 — Beneficiárias no memorial

Nova seção **2.1 — Unidades Beneficiárias / Rateio (Lei 14.300/2022)**: lista **UC Principal +
beneficiárias** com `contaContrato`, titular e **percentual/prioridade**, e valida a **soma do
rateio = 100%** (✓/⚠). Sem beneficiárias → "autoconsumo local".

## FASE 5 — Certificações (suporte automático)

Nova seção **10.1 — Certificações dos equipamentos**, alimentada por `equipamento.certificacao`:

| Norma | Entra automaticamente? |
|---|---|
| **INMETRO** | ✅ `certificacao.inmetro.numero` |
| **IEC 62116 / 62109 / 61727** | ✅ se presente em `certificacao.normas_iec[]` |
| **NBR 16149 / 16150** | ✅ se presente em `certificacao.normas_iec[]` |

→ As 6 normas **entram automaticamente** no documento desde que registradas no equipamento do
Atlas (o checklist de homologação valida o subconjunto obrigatório por concessionária).

## FASE 6 — Validação Projeto → Atlas → Documento

Teste **live**: inversor `X3-ULT-15K` (Atlas `potencia_kw=15`) + snapshot **propositalmente
divergente** (`99`). O memorial gerou **"Potência Nominal: 15 kW"** (Atlas), **ignorando o
snapshot stale** → **alterações do catálogo chegam ao documento**. Beneficiárias e nota de fonte
Atlas confirmadas. (Os 27 campos recuperados na sprint anterior, ex.: SolaX `potencia` 2→15,
fluem automaticamente.)

## FASE 7 — Respostas

1. **Quantos bugs de dialeto existiam?** **1 padrão (camelCase×snake) em 4 pontos** —
   `potenciaKW` (memorial/carta/ART) + `nMppts` (memorial). Todos corrigidos; sem remanescentes.
2. **Quantos campos migraram para Atlas vivo?** **~13** (6 do inversor + 7 do módulo) + certificações,
   priorizados do Atlas quando há `_id` ref; snapshot como fallback.
3. **Beneficiárias aparecem corretamente?** **Sim** — UC principal, beneficiárias, percentuais e
   rateio (soma 100% validada) na seção 2.1.
4. **Valores inferidos ficam identificados?** **Sim** — disclaimer "Valor estimado
   conservadoramente…" para campos `fallback_conservador`; valores reais sem disclaimer.
5. **Certificações aparecem?** **Sim** — INMETRO + IEC + NBR do Atlas, automaticamente (seção 10.1).
6. **Ainda existe risco de divergência?** **Reduzido.** Projetos com `_id` ref usam **Atlas vivo**
   (sem divergência). **Resíduo:** projetos sem vínculo por `_id` (ex.: criados via
   `extrairParecer`, que grava só snapshot) ainda usam o snapshot → recomenda-se gravar o `_id`
   do equipamento nesses fluxos. Hardcodes (geração `131.44`, ART) **fora do escopo** desta sprint.
7. **O memorial pode ser classificado como produção pronta?** **Sim para o caminho com vínculo
   Atlas (`_id`)** — engenharia, Atlas-vivo, beneficiárias e certificações conectados, com
   proveniência visível. **Ressalva (B→A condicional):** projetos sem `_id` ref seguem no
   snapshot; fechar isso (gravar `_id` na criação) eleva a A incondicional.

### Conclusão
O memorial passou de **B (lacunas)** para **A condicional**: dialeto corrigido, **Atlas vivo**
prevalecendo sobre o snapshot (validado live), **engenharia real×inferido** sinalizada,
**beneficiárias/rateio** e **certificações** integradas — tudo só no fluxo de documentos, sem
tocar parser/catálogo/SSOT, com compatibilidade preservada (657 testes, build OK).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARECER-ENGINEERING-WIRE-01

**Revisor Sênior**

A sprint P1-PARECER-ENGINEERING-WIRE-01, focada em conectar engenharia, Atlas e beneficiárias ao memorial/parecer, demonstra um avanço significativo e bem estruturado. A abordagem de alterar apenas o fluxo de documentos, preservando a compatibilidade com sistemas legados (parser, catálogo, SSOT), é louvável e minimiza riscos.

**Avaliação Detalhada:**

1.  **Abordagem Atlas-vivo-com-fallback-snapshot:** A estratégia de priorizar o Atlas vivo e utilizar o snapshot como fallback é **correta e compatível**. Ela garante a atualização dos dados quando possível, mantendo a funcionalidade para projetos sem vínculo direto com o Atlas ou em cenários de indisponibilidade, o que é crucial para a robustez do sistema.

2.  **Disclaimer de valores inferidos e proveniência:** O disclaimer "Valor estimado conservadoramente — sujeito à validação técnica" para campos `fallback_conservador`, combinado com a indicação explícita da fonte (Atlas vs. snapshot), **atende plenamente ao requisito**. Essa transparência é fundamental para a gestão de expectativas e para a clareza técnica do documento gerado.

3.  **Honestidade sobre resíduo e classificação A-condicional:** A honestidade em relação ao risco residual em projetos sem `_id` ref (que continuam no snapshot) e a classificação "A condicional" são **adequadas e transparentes**. Reconhecer as limitações atuais e propor caminhos para a melhoria (gravar `_id` nesses fluxos) demonstra maturidade no processo de desenvolvimento e gestão de riscos.

4.  **Riscos/Efeitos Colaterais:**
    *   **Risco Residual (Projetos sem `_id` ref):** Como mencionado, projetos criados via `extrairParecer` que não gravam o `_id` do equipamento continuarão a depender do snapshot. A recomendação de gravar o `_id` nesses fluxos é pertinente.
    *   **Hardcodes:** A exclusão de hardcodes (geração 131.44, ART) do escopo desta sprint é compreensível, mas deve ser mapeada para futuras iterações.
    *   **Complexidade do `_pick`:** Embora eficaz, a introdução de um helper `_pick` com tolerância a múltiplos formatos pode, a longo prazo, adicionar uma camada de complexidade na depuração de problemas de mapeamento de campos, caso novos alias sejam adicionados ou a lógica precise ser alterada. No entanto, para os casos atuais, parece bem justificado.

5.  **Veredito:**

    **APROVADO COM RESSALVAS**

    A sprint é um sucesso em seus objetivos principais, com implementações robustas e transparentes. A classificação "A condicional" é justa, refletindo o excelente progresso com um ponto de atenção claro para aprimoramento futuro (gravação do `_id` em fluxos específicos). A abordagem geral é sólida e a execução demonstra um alto nível de qualidade técnica.

**Observações Adicionais:**

*   A correção do dialeto `potenciaKW`→`potencia_kw` com o helper `_pick` é uma solução elegante para um problema comum de inconsistência de nomenclatura.
*   A priorização do Atlas vivo para campos de equipamento é um passo crucial para a precisão dos dados.
*   A integração da `engineeringPresentation` com o disclaimer e a fonte de dados é um diferencial importante.
*   A seção de beneficiárias/rateio e a certificação automática agregam valor significativo ao memorial.
*   A validação "live" com o cenário de divergência (Atlas 15 vs. snapshot 99) é uma prova de conceito poderosa da eficácia das mudanças.

Em suma, a sprint P1-PARECER-ENGINEERING-WIRE-01 representa um avanço substancial e bem executado. As ressalvas são mais um convite à melhoria contínua do que impedimentos à aprovação.
