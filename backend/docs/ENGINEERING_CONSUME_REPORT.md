# P1-ENGINEERING-CONSUME-01 — Consumo dos contratos de engenharia na UI

> Frontend. **Zero escrita no Atlas · zero alteração de catálogo/OCR/parser/SSOT · sem gravação manual.**
> Tudo runtime/visual, a partir dos contratos puros já aprovados (Fallback/Presentation).

## FASE 1 — Auditoria dos componentes mapeados

| Componente | Exibe `tensao_partida` como campo? | Decisão |
|---|---|---|
| `components/fv/FichaTecnicaModal.jsx` | ✅ sim (ficha por campo) | **badge integrado** |
| `pages/Inversores.jsx` | ✅ sim (`SPECS_DC` por campo) | **badge integrado** |
| `components/fv/SeletorInversores.jsx` | ❌ resumo (MPPTs/Vmáx/Imáx) | consumidor — fallback mantém funcional |
| `components/engenharia/PainelCompatibilidadeFV.jsx` | ❌ validações/margens (valor consumido) | consumidor — fallback mantém funcional |
| `components/fv/ConfiguradorArranjoFV.jsx` | ❌ cálculo de arranjo (valor consumido) | consumidor — fallback mantém funcional |

`tensao_partida` (único campo com regra de fallback ativa) é **exibido como campo** apenas
nas 2 primeiras → onde o badge faz sentido. As 3 calculadoras **consomem** o valor (e
seguem funcionando graças ao EngineeringFallback), sem campo rotulado para badge.

## FASE 2 — Consumo (ponte UI ↔ contratos)

- `frontend/src/utils/engenharia/engenhariaPayload.js`: importa os contratos PUROS do
  backend (`montarPayloadEngenharia`), mapeia dialeto→canônico (`voc_max`→`tensao_max_entrada`,
  `faixa_mppt_min`→`tensao_mppt_min`, `mppts`→`n_mppts`…) e expõe `itemPorChave`.
- `frontend/src/components/engenharia/BadgeEngenharia.jsx`: componente reutilizável.
- Build confirma que o módulo backend (ESM puro) **bundla no frontend** sem efeitos colaterais.

## FASE 3 — Badges

🟢 Extraído · 🔵 Validado · 🟡 Inferido Forte · 🟠 Fallback Conservador (cores Tailwind por status).
No catálogo (`Inversores.jsx`), campos **ausentes com fallback** (ex.: `tensao_partida`)
agora aparecem com o valor conservador + badge 🟠 — antes ficavam ocultos.

## FASE 4 — Detalhamento (hover/click)

O badge expõe, via `title` (tooltip), a justificativa do fallback:
`Origem: fallback_conservador · Confiança: baixa · Motivo: campo ausente`.

## FASE 5 — Preparação (botão "Corrigir Valor")

Botão **"Corrigir Valor"** renderizado **desabilitado**, apenas para perfis
`engenheiro / tecnico / administrador` (via `usePermissao()` + `podeSubstituir`). **Nenhuma
gravação** — apenas prepara a ação futura.

## FASE 6 — Auditoria

1. **Quantas telas foram integradas?** **2 com badge** (FichaTecnicaModal, Inversores.jsx);
   3 validadas como consumidoras (Seletor, PainelCompatibilidade, ConfiguradorArranjo).
2. **Quantos campos exibem badge?** Na ficha técnica, todos os campos elétricos exibidos
   recebem badge de origem; o campo com **fallback ativo** é **1** (`tensao_partida`).
3. **Quantos equipamentos exibem fallback?** **22 inversores** (badge 🟠 em `tensao_partida`).
4. **Existe risco de regressão?** **Baixo** — mudanças aditivas (novos elementos/linhas),
   nenhum fluxo removido; build OK; suíte **614 passed** (14 falhas pré-existentes de diagram
   inalteradas). Observação: o ambiente não roda testes de renderização React (jsdom), então
   a verificação visual fina deve ser feita em runtime.
5. **O Atlas continua imutável?** **Sim** — alterações 100% frontend/visuais; nenhuma escrita.

## FASE 7 — Testes

- `engenhariaPayload.test.js` (5): dialeto→canônico, payload, `itemPorChave`, não-mutação,
  badge 🟠 p/ `tensao_partida` ausente, 🟢 p/ campo presente.
- (Os contratos puros já têm 21 testes nas sprints anteriores.) Sem escrita no Atlas.

## FASE 8 — Respostas

1. **Como o usuário identifica valores estimados?** Pelo badge **🟠 "Fallback Conservador"**
   ao lado do valor + tooltip com origem/confiança/motivo. Valores reais: 🟢/🔵/🟡.
2. **Como funcionará a correção manual futura?** O botão "Corrigir Valor" (hoje desabilitado,
   visível só para engenheiro/técnico/admin) abrirá, na sprint futura, o fluxo que **grava o
   valor REAL no Atlas** e remove o fallback (via `validarSubstituicaoManual` já pronto).
3. **Quantos equipamentos usam fallback?** **22 inversores** (`tensao_partida`).
4. **Houve regressão?** **Não** — additive; build e suíte verdes (exceto as 14 falhas
   pré-existentes de diagram).
5. **Próxima sprint recomendada?** **P1-ENGINEERING-MANUAL-WRITE-01** — implementar a
   gravação manual (endpoint autorizado + ativar o botão), e **P1-PARSER-STARTVOLTAGE-01**
   (extrair o valor REAL de `tensao_partida`), reduzindo o uso do fallback.

### Conclusão
A UI agora **mostra** os valores estimados de forma inequívoca (badge 🟠 + justificativa) nas
telas de ficha/catálogo, e o botão de correção manual está **preparado e gated** por perfil —
tudo sem tocar no Atlas, no catálogo ou no SSOT.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-ENGINEERING-CONSUME-01

A sprint P1-ENGINEERING-CONSUME-01 foca na integração visual dos contratos de engenharia no frontend de um aplicativo solar, sem realizar gravações ou alterações no backend (Atlas, SSOT, parser). A abordagem é focada em consumo e apresentação de dados.

**1. Decisão de Integrar Badge Apenas Onde o Campo é Exibido:**

A decisão de integrar badges apenas nas telas onde `tensao_partida` é explicitamente exibido (`FichaTecnicaModal`, `Inversores.jsx`) e tratar as calculadoras como consumidoras é **tecnicamente correta e pragmática**. O badge tem o propósito de informar o usuário sobre a origem e a confiança de um valor apresentado diretamente. Nas calculadoras, onde o valor é consumido internamente para um cálculo, a exibição direta do campo rotulado não é o foco, e a funcionalidade via fallback garante a operação. Isso evita poluição visual e foca a informação onde ela é mais relevante para o usuário final.

**2. Adequação e Segurança da Abordagem:**

A abordagem é **adequada e segura**.
*   **Helper puro + componente reutilizável:** A importação do módulo puro do backend e a criação de um componente `BadgeEngenharia` reutilizável promovem modularidade e manutenibilidade.
*   **Tooltip:** O uso de `title` para tooltip com justificativa detalhada é uma boa prática para fornecer contexto sem sobrecarregar a interface.
*   **Botão desabilitado gated por role:** A preparação do botão "Corrigir Valor" desabilitado e controlado por permissões de usuário (`engenheiro`, `técnico`, `administrador`) é uma medida de segurança crucial, garantindo que apenas usuários autorizados possam interagir com funcionalidades de correção futura. A ausência de gravação nesta sprint reforça a segurança.

**3. Risco de Regressão:**

O risco de regressão é **baixo**. As mudanças são aditivas, sem remoção de fluxos existentes. O build bem-sucedido e a suíte de testes puros com 614 testes passados (considerando as falhas pré-existentes) indicam estabilidade. A ausência de testes de renderização React (jsdom) é uma limitação conhecida, mas a validação por build e testes unitários mitigam o risco. A verificação visual em runtime é essencial, como mencionado.

**4. Veredito:**

**APROVADO**

**Justificativa:** A sprint cumpre rigorosamente os objetivos de integrar visualmente os contratos de engenharia sem realizar gravações ou alterações no backend. A abordagem de exibir badges apenas onde o campo é apresentado é tecnicamente sólida. A segurança é garantida pela preparação do botão de correção com controle de permissão e a ausência de escrita. O risco de regressão é baixo, suportado por testes e build. As recomendações para as próximas sprints são pertinentes para avançar no fluxo de correção manual e na extração de dados.
