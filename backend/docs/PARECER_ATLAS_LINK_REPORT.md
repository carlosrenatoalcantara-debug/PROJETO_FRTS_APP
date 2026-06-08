# P1-PARECER-ATLAS-LINK-01 — Vínculo persistente com o Atlas no extrairParecer

> Escopo: fluxo `extrairParecer → ProjetoFV` (+ leitura do vínculo no documento). Sem alterar
> parser/catálogo/SSOT/SolarMarket. Retrocompatibilidade preservada.

## FASE 1 — Onde o vínculo se perdia

`pareceracessoController.extrairParecer` **STEP 4** já localiza o equipamento no Atlas
(`Equipamento.findOne({ tipo, fabricante: /…/i, modelo: /…/i })`) e **STEP 5** cria o `ProjetoFV`.
**Mas o vínculo se perdia em 3 elos:**
1. **Painel:** gravava `id: painel._id`, deixando o campo de referência real `equipamento_id`
   (que **já existe** no schema, ObjectId ref) **null**.
2. **Inversor:** o subdoc **não tinha** o campo `equipamento_id` no schema — só `id: String`.
3. **Leitura (memorial):** o loader lia `e?._id || e?.equipamento_id` — como o subdoc de array
   tem **`_id` automático**, `e._id` (o id do *subdocumento*, não do equipamento) vencia →
   referência errada/ignorada.

## FASE 2 — Estratégia (evidência, sem adivinhação)

O `Equipamento._id` **já é resolvido** por `findOne` exato em `tipo + fabricante (regex) + modelo
(regex)`. **O vínculo só é gravado quando há match real** (`painel`/`inversor` não-nulo). Quando
não há equipamento correspondente no catálogo → `equipamento_id = null` → snapshot. **Nenhuma
associação por adivinhação.**

## FASE 3 — Vínculo persistente implementado

- **`ProjetoFV`** (inversor subdoc): adicionado `equipamento_id: { ObjectId, ref:'Equipamento',
  default:null }` (o painel já o tinha).
- **`extrairParecer` STEP 5:** grava `equipamento_id: painel?._id || null` (painel) e
  `equipamento_id: inversor?._id || null` (inversor) — **apenas com match**.
- **Carregadores EV:** o fluxo `extrairParecer` não cria EV no projeto (só painéis + inversor) →
  **não aplicável** nesta sprint.

## FASE 4 — Retrocompatibilidade

Loader passa a resolver na ordem **`equipamento_id` → `id` (legado, se ObjectId válido)**,
ignorando o `_id` do subdoc:
- Projetos **novos**: usam `equipamento_id` → Atlas vivo.
- Projetos **legados** (só `id` string): caem no `id` → Atlas vivo (retrocompatível).
- Projetos **sem vínculo** ou equipamento fora do catálogo: `equipamento_id`/`id` nulos →
  **snapshot** (fallback permitido).
- `id` inválido / lixo: ignorado (não confunde o `_id` do subdoc) → snapshot.

## FASE 5 — Validação do fluxo completo (live, contra o Atlas)

Inversor real `X3-ULT-15K` (Atlas `potencia_kw=15`), com snapshot **propositalmente divergente**:

| Caso | Vínculo | Snapshot | Memorial | Esperado |
|---|---|---|---|---|
| **a) NOVO** | `equipamento_id` | 99 | **15** | 15 ✓ (Atlas) |
| **b) LEGADO** | `id` (string) | 99 | **15** | 15 ✓ (retrocompat) |
| **c) SEM VÍNCULO** | — | 77 | **77** | 77 ✓ (snapshot) |
| **d) id inválido** | lixo | 55 | **55** | 55 ✓ (não confunde subdoc) |

→ **PDF → ProjetoFV → Atlas → Memorial → Parecer** confirmado: alterações futuras do catálogo
chegam ao documento (o caso "a" prova que o Atlas vence o snapshot stale).

## FASE 6 — Respostas

1. **Quantos pontos perdiam o vínculo?** **3 elos** — gravação do painel (`equipamento_id`
   null), gravação do inversor (campo inexistente) e leitura do loader (precedência do `_id` do
   subdoc).
2. **Quantos foram corrigidos?** **Todos os 3** — painel e inversor persistem `equipamento_id`
   (com match), e o loader lê `equipamento_id`/`id` (ignora o `_id` do subdoc).
3. **Projetos antigos continuam compatíveis?** **Sim** — legados com `id` string resolvem via
   fallback; sem vínculo → snapshot. Nenhuma migração necessária.
4. **Ainda existe caminho usando snapshot?** **Sim, e é o correto** — apenas quando **não há
   vínculo válido** (equipamento não cadastrado no Atlas, ou projeto sem referência).
5. **O memorial passa a ser A incondicional?** **Sim para equipamentos catalogados** — projetos
   via `extrairParecer` agora persistem o vínculo e usam o Atlas vivo. Quando o equipamento
   **não existe no catálogo**, o snapshot é a única fonte possível (não há registro Atlas para
   vincular) — limitação **inerente**, não divergência. → **A incondicional no que depende do Atlas.**
6. **Próxima sprint recomendada?** **P1-PARECER-HARDCODE-01** — substituir os hardcodes
   remanescentes do memorial (geração `kWp×131.44` → irradiância por localidade; valores de ART;
   tensão `380/220V` derivada do `tensao_ac` do equipamento), fechando a qualidade do documento.

### Conclusão
O **último ponto de divergência** foi eliminado: o `extrairParecer` agora **persiste o vínculo
`equipamento_id`** (só com match real, sem adivinhação) e o documento o **consome corretamente**,
com retrocompatibilidade total e fallback de snapshot apenas quando não há vínculo. Validado live
(4 casos). Sem tocar parser/catálogo/SSOT/SolarMarket; 657 testes, build OK.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-PARECER-ATLAS-LINK-01

A sprint P1-PARECER-ATLAS-LINK-01 abordou uma divergência crítica no fluxo `extrairParecer`, garantindo que projetos gerados a partir dele mantenham um vínculo persistente com o catálogo de equipamentos (Atlas). A análise detalhada dos pontos de falha e das correções implementadas demonstra um trabalho minucioso e bem-sucedido.

**Avaliação dos Pontos:**

1.  **Estratégia de vincular só com match real:** **APROVADO**. Esta é a abordagem correta e mais segura. Vincular equipamentos sem uma correspondência exata no Atlas poderia introduzir dados incorretos e inconsistências. A estratégia de usar o snapshot como fallback quando não há match real é um mecanismo de segurança robusto.

2.  **Correção da precedência do loader:** **APROVADO**. A alteração na ordem de leitura do loader, priorizando `equipamento_id` sobre o `_id` do subdocumento, ataca diretamente a causa raiz da divergência. Isso garante que a referência correta ao equipamento no Atlas seja utilizada, em vez de um identificador interno do documento.

3.  **Retrocompatibilidade garantida:** **APROVADO**. A estratégia de fallback para `id` string legado e o uso de snapshot para projetos sem vínculo ou com `id` inválido asseguram que projetos antigos continuem funcionando sem a necessidade de migração. A validação em 4 casos demonstra a eficácia dessa abordagem.

4.  **Honestidade da afirmação "A-incondicional-no-que-depende-do-Atlas":** **APROVADO**. A afirmação é honesta e precisa. O fluxo agora garante que, para equipamentos catalogados no Atlas, o vínculo é persistente e o documento reflete os dados do Atlas. O snapshot é explicitamente reservado para os casos onde o vínculo com o Atlas não é possível ou aplicável, o que é uma limitação inerente ao cenário, não uma falha do sistema.

5.  **Riscos:** Os riscos parecem ter sido mitigados de forma eficaz. A validação em múltiplos cenários e a ausência de regressão nos testes indicam um alto nível de confiança na solução. A principal preocupação seria a introdução de novos hardcodes ou a falha em cobrir todos os casos de uso, o que não parece ter ocorrido.

6.  **Veredito:** **APROVADO**.

**Considerações Adicionais:**

A recomendação para a próxima sprint, focando na eliminação de hardcodes remanescentes no memorial, é um passo lógico e importante para aprimorar a qualidade e a manutenibilidade do sistema.

Em suma, a sprint P1-PARECER-ATLAS-LINK-01 resolveu com sucesso uma divergência crítica, fortalecendo a integridade dos dados e a confiabilidade do fluxo `extrairParecer`.
