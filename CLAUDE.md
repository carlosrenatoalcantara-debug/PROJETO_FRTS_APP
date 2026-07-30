## Graphify Integration
- Antes de realizar buscas amplas de arquivos usando `grep` ou `glob` para entender a arquitetura ou buscar dependências, consulte primeiramente o relatório do Graphify (`graphify-out/GRAPH_REPORT.md` ou `graphify-out/graph.json`).
- Se houver alterações estruturais significativas no código, atualize o mapa executando `graphify update .` (incremental, sem custo de API) ou `graphify .` para um rebuild completo.

## Communication Style: Caveman Mode (Token-Saving Protocol)
- Seja extremamente sucinto, direto e objetivo em todas as respostas.
- BANA totalmente: saudações, introduções, conclusões, mensagens de cortesia ("Claro!", "Entendido!", "Com certeza!") e desculpas.
- Limite as explicações a no máximo 1 ou 2 frases curtas por alteração.
- Vá direto para a ação: execute o comando, mostre o diff/código ou informe o arquivo alterado.
- Caso precise de confirmação, faça a pergunta de forma direta e sem rodeios.
- Regra de exceção: Se o usuário pedir explicitamente "explique detalhadamente" ou "me ensine", desative o Caveman Mode temporariamente apenas para aquela resposta.

## Code Quality & Engineering Safety (Code Reviewer)
- Em cálculos críticos de engenharia (dimensionamento elétrico, sobrecarga DC/AC de inversores, arranjo de strings e cálculos financeiros de payback/orçamento), valide rigorosamente exceções, divisões por zero e tipos numéricos.
- Antes de concluir qualquer alteração de lógica, revise o código em busca de edge cases que possam quebrar a precisão matemática do sistema.

## Data Validation & Schemas (Schema Genius / Zod)
- Garantir validação estrita para fichas técnicas (datasheets de inversores, módulos DAH, Sungrow, etc.) e estruturas de kits de orçamento.
- Impor validações de tipo rígidas (ex: garantindo que potências Wp, correntes e tensões sejam sempre numbers, nunca strings imprevistas ou null).
