# P1-ENGINEERING-FALLBACK-01 — Camada de Engenharia Conservadora

> **Runtime-only.** Zero escrita no Atlas · zero alteração de catálogo/OCR/parser/SSOT.
> Módulo novo: `backend/src/services/engineeringFallback.js` (puro, sem efeitos colaterais).

## ⚠️ Nota de integridade
Durante a validação, o total do catálogo apareceu como **94** (era 95). O documento
ausente é exatamente o fabricante inválido **"Página 1 de 1"** (carregador_ev) que esta
linha de sprints havia sinalizado para remoção manual. **Esta sprint não escreveu no
Atlas** (provado: 0 documentos com `tensao_partida` persistido) — a remoção foi externa
(provável limpeza manual do registro-lixo). Restou 1 inválido: `Fast Wall⇥Fast Wall`.

## FASE 1 — Campos que podem travar/degradar engenharia

| Classe | Campos | Efeito quando ausente |
|---|---|---|
| **CRÍTICO** | `potencia_kw`, `n_mppts`, `tensao_max_entrada`, `tensao_mppt_min`, `tensao_mppt_max`, `corrente_max_por_mppt` | bloqueiam dimensionamento de strings / validação MPPT |
| **IMPORTANTE** | `corrente_ac_saida`, `tensao_ac`, `corrente_isc_max`, **`tensao_partida`** | degradam parecer/unifilar (validações secundárias) |
| **OPCIONAL** | `eficiencia_maxima`, `peso_kg`, `dimensoes`, `grau_protecao_ip`, `certificacoes` | apenas documentação/ficha |

`tensao_partida` é **IMPORTANTE** (não tem peso no score do SSOT) — não bloqueia o
pré-dimensionamento básico, mas é usada na validação de partida/strings.

## FASE 2 — Motor `EngineeringFallback`

`aplicarFallbackEngenharia(equip)` recebe o equipamento real (visão SSOT) e retorna:
- `operacional`: **cópia** com campos ausentes preenchidos (original **intocado**);
- `fallback`: mapa de proveniência por campo inferido;
- `campos_inferidos`: lista.

Não importa nada que escreva; é função pura. Testes provam que o input não é mutado.

## FASE 3 — Proveniência

Todo valor inferido carrega: `origem: 'fallback_conservador'` · `confianca: 'baixa'` ·
`motivo: 'campo_ausente'` · `regra: <campo>`.

## FASE 4 — Regras

| Campo | Ativa | Valor conservador |
|---|---|---|
| **`tensao_partida`** | ✅ **SIM** | `tensao_mppt_min` (piso do MPPT) quando disponível; senão **200 V** |
| `n_mppts` | ❌ doc | 1 MPPT (pior caso) |
| `strings_por_mppt` | ❌ doc | 1 string/MPPT |
| `corrente_max_por_mppt` | ❌ doc | derivar de potência/tensão CC |
| `corrente_isc_max` | ❌ doc | `corrente_max_por_mppt × 1.25` |
| `peso_kg` / `dimensoes` / `grau_protecao_ip` | ❌ doc | faixa por potência / envelope / IP65 |

Apenas `tensao_partida` ativa nesta sprint; as demais documentadas e **desligadas**.

## FASE 5 — Contrato de status p/ UI (sem alterar componentes)

`statusDoCampo(campo, ctx)` → um de: `extraido` · `validado` · `inferido_forte` ·
`fallback_conservador`. Permite a UI distinguir um valor de fallback de um valor real
(ainda sem tocar nos componentes).

## FASE 6 — Substituição manual futura (estrutura, sem UI)

`ROLES_PODEM_SUBSTITUIR = ['engenheiro','tecnico','administrador']` + `podeSubstituir(role)`
+ `CONTRATO_SUBSTITUICAO` (shape documentado). Quando implementado (futuro), permitirá a
esses papéis **gravar o valor REAL no Atlas**, removendo o fallback do runtime, com
autoria/data. **Não implementado aqui** (sem endpoint/UI).

## FASE 7 — Testes (`engineeringFallback.test.js`, 11 casos)

- **Catálogo/Atlas intactos:** input não é mutado; cópia distinta; validação live mostra
  **0 documentos com `tensao_partida` persistido** no Atlas (zero contaminação).
- **Valor disponível:** inversor sem `tensao_partida` recebe valor conservador.
- **Rastreabilidade:** proveniência `fallback_conservador`/`baixa`/`campo_ausente`.
- **Só `tensao_partida` ativa:** campos de regras desligadas continuam ausentes.
- **Contrato de status** e **roles de substituição** cobertos.

## FASE 8 — Respostas

1. **Quais campos podem travar engenharia?** CRÍTICOS: `potencia_kw, n_mppts,
   tensao_max_entrada, tensao_mppt_min, tensao_mppt_max, corrente_max_por_mppt`. IMPORTANTES:
   `corrente_ac_saida, tensao_ac, corrente_isc_max, tensao_partida`. (Opcionais não travam.)
2. **Valor conservador para `tensao_partida`?** `tensao_mppt_min` (piso do MPPT) quando
   presente — lado seguro p/ validação de strings; **default 200 V** quando o MPPT_min
   também falta.
3. **Quantos equipamentos passam a ser operacionais?** **22/22 inversores** ganham
   `tensao_partida` em runtime (13 via MPPT_min, 9 via default 200 V) — todos operacionais
   para o critério de partida.
4. **Como será a correção manual futura?** Via `ROLES_PODEM_SUBSTITUIR` +
   `CONTRATO_SUBSTITUICAO`: engenheiro/técnico/admin gravam o **valor real no Atlas**
   (substituindo o fallback), com autoria/data. Estrutura pronta; UI/endpoint = sprint futura.
5. **Como impedir que estimativas contaminem o Atlas?** O fallback é **runtime-only**:
   `aplicarFallbackEngenharia` retorna **cópia** e nunca grava; a proveniência
   `origem=fallback_conservador` marca o valor; validação live confirma **0** valores de
   fallback persistidos. A gravação só ocorrerá na futura substituição manual (valor REAL).
6. **Próxima sprint recomendada?** **P1-ENGINEERING-INTEGRATION-01** — ligar o
   `EngineeringFallback` nos consumidores (dimensionamento/unifilar/parecer) + exibir o
   status na UI. Em paralelo, **P1-PARSER-STARTVOLTAGE-01** (extrair o valor REAL de
   `tensao_partida`), reduzindo a dependência do fallback.

### Conclusão
A camada conservadora existe **apenas em runtime**, com proveniência clara e zero impacto
no Atlas/catálogo/SSOT. Os 22 inversores passam a ser operacionais para `tensao_partida`,
e a estrutura para substituição manual pelo valor real está preparada.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão Sprint P1-ENGINEERING-FALLBACK-01

**Veredito:** APROVADO COM RESSALVAS

A sprint P1-ENGINEERING-FALLBACK-01 atinge seu objetivo principal de permitir a geração de
documentos de engenharia mesmo com campos ausentes, sem contaminar o Atlas. A arquitetura
runtime-only e a proveniência clara são pontos fortes.

**1. Arquitetura Runtime-Only e Integridade do Atlas:**
A arquitetura runtime-only, com o módulo `engineeringFallback.js` operando como uma função
pura que retorna uma cópia do equipamento, garante que estimativas não sejam gravadas no
Atlas. A validação "live" confirmando zero documentos com `tensao_partida` persistido reforça
essa garantia. A separação clara entre o dado real e o fallback é mantida.

**2. Defensabilidade Técnica do Valor Conservador:**
O valor conservador para `tensao_partida` é tecnicamente defensável. Utilizar `tensao_mppt_min`
como prioridade é uma escolha segura, pois garante que a tensão de partida não exceda o
limite operacional do MPPT, o que é crucial para a validação de strings. O fallback para 200V
quando `tensao_mppt_min` também está ausente é um valor razoável e conservador para inversores
comuns.

**3. Proveniência, Contrato de Status e Substituição Manual:**
A proveniência (`origem=fallback_conservador`, `confianca=baixa`, `motivo=campo_ausente`) é
essencial para rastreabilidade e transparência. O contrato de status (`extraido`, `validado`,
`inferido_forte`, `fallback_conservador`) é um excelente mecanismo para a UI comunicar o estado
dos dados ao usuário sem alterar os componentes subjacentes. A estrutura para substituição manual
futura, com roles definidos e um contrato de substituição, é uma boa preparação para a correção
definitiva dos dados, embora sua ausência na implementação atual seja um ponto a ser observado.

**4. Riscos:**
*   **Dependência Contínua do Fallback:** A principal ressalva é que a solução atual
    depende do fallback para `tensao_partida`. Se a próxima sprint para extrair o valor real
    (`P1-PARSER-STARTVOLTAGE-01`) falhar ou atrasar, a dependência do fallback persistirá,
    potencialmente mascarando dados ausentes por mais tempo do que o ideal.
*   **Complexidade da UI:** Embora o contrato de status seja bom, a UI precisará ser adaptada
    para exibir claramente os valores de fallback e indicar a necessidade de correção manual.
*   **Escalabilidade das Regras Desligadas:** As demais regras de fallback estão documentadas
    mas desligadas. A ativação futura dessas regras exigirá validação cuidadosa para garantir
    que não introduzam novos problemas ou degradação de performance.

**5. Justificativa para APROVADO COM RESSALVAS:**
A sprint é aprovada devido à sua eficácia em resolver o problema imediato de dados ausentes
sem comprometer a integridade do Atlas. A arquitetura é robusta e a proveniência é bem tratada.
A ressalva se deve à dependência da próxima sprint para a correção definitiva do dado `tensao_partida`
e à necessidade de atenção futura na ativação das demais regras de fallback.

**Recomendação para Próxima Sprint:** Priorizar `P1-PARSER-STARTVOLTAGE-01` para reduzir a
dependência do fallback o mais rápido possível.
