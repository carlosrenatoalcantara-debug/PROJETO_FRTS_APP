# Forte Solar --- Manual de implementação do módulo de Orçamentos Fotovoltaicos

## Guia funcional, técnico e de execução para Claude Code

**Versão:** 1.0\
**Finalidade:** orientar a análise, implementação, validação e evolução
do módulo de orçamento fotovoltaico dentro do Forte Solar.\
**Público-alvo:** Claude Code, desenvolvedores e responsáveis pela
validação de engenharia/comercial.

------------------------------------------------------------------------

## 1. Objetivo do projeto

Implementar no Forte Solar um módulo nativo de **Orçamentos
Fotovoltaicos** que transforme dados comerciais, faturas de energia,
equipamentos homologados no catálogo e parâmetros de engenharia em uma
proposta técnica-comercial consistente, rastreável e exportável em PDF.

O módulo deve gerar, no mínimo, duas apresentações do mesmo orçamento:

-   **Proposta completa --- 8 páginas:** versão detalhada para
    apresentação técnica e comercial.
-   **Proposta resumida --- 4 páginas:** versão executiva, mais
    compacta, sem alterar os cálculos ou os valores da versão completa.

As duas versões devem derivar do mesmo objeto de orçamento e do mesmo
motor de cálculo. Não criar dois motores nem manter valores digitados
separadamente em cada PDF.

O resultado precisa preservar a identidade visual da Forte Solar e o
padrão aprovado nas propostas de referência, mas ser dinâmico: cliente,
consumo, distribuidoras, módulos, inversores, quantidades, preços,
condições e número de opções devem vir dos dados do orçamento.

### 1.1 Resultado esperado para o usuário

O usuário deverá conseguir:

1.  Cadastrar ou selecionar o cliente.
2.  Informar unidade consumidora, concessionária, modalidade tarifária e
    dados da fatura.
3.  Inserir o histórico de consumo e os valores de energia por posto
    tarifário.
4.  Selecionar equipamentos e fornecedores a partir dos cadastros/SSOT
    do Forte Solar.
5.  Criar uma ou mais opções de kit, cada uma com sua composição e
    custo.
6.  Definir estruturas de telhado e/ou solo, frete, serviços e condições
    comerciais.
7.  Conferir cálculos, alertas e diagramas preliminares.
8.  Visualizar uma prévia paginada das duas propostas.
9.  Aprovar e gerar PDFs, mantendo versão, data, autor e memória dos
    dados utilizados.

------------------------------------------------------------------------

## 2. Contexto do Forte Solar e princípios arquiteturais

O Forte Solar possui módulos de negócio FV, EV e BESS, além do Catálogo
Mestre de Materiais. A arquitetura conhecida utiliza:

-   Frontend: React + Tailwind CSS.
-   Backend: Node.js/API do projeto (confirmar estrutura e padrões
    existentes antes de criar endpoints).
-   Persistência: MongoDB Atlas.
-   Hospedagem: frontend na Vercel e backend no Railway.
-   Integrações e serviços de engenharia já existentes devem ser
    reutilizados quando aplicável.

Há histórico de trabalho com SSOT para equipamentos, catálogo mestre de
materiais, compatibilização de especificações FV, cálculos de
engenharia, geração de diagrama unifilar/SVG e integrações de dados. O
orçamento deve consumir esses recursos, não criar cadastros paralelos.

### 2.1 Princípios obrigatórios

1.  **SSOT:** módulo, inversor e material devem ter uma fonte canônica
    de dados.
2.  **Engenharia antes da estética:** não exibir configuração elétrica
    não validada como definitiva.
3.  **Separação de responsabilidades:** dados, cálculos, regras
    comerciais, renderização e PDF em camadas distintas.
4.  **Rastreabilidade:** registrar a origem dos preços, parâmetros,
    datasheets e premissas.
5.  **Sem duplicidade:** o mesmo valor não pode ser mantido em dois
    lugares independentes.
6.  **Sem invenção:** informação ausente deve aparecer como pendência,
    não ser preenchida por suposição.
7.  **Reprodutibilidade:** uma proposta emitida deve poder ser
    reconstruída a partir de um snapshot imutável dos dados utilizados.
8.  **Compatibilidade:** reutilizar padrões de autenticação, validação,
    tratamento de erros, logging, componentes e testes existentes.

### 2.2 Antes de alterar o código

Claude Code deve primeiro explorar o repositório e produzir um
diagnóstico. Não começar codificando.

Verificar:

-   Estrutura de pastas e convenções do projeto.
-   Modelos MongoDB existentes para cliente, unidade consumidora,
    projeto FV, equipamento, fornecedor, material e proposta.
-   Rotas e serviços já existentes para cálculos FV, geração,
    dimensionamento CC, diagramas e PDFs.
-   Como o catálogo SSOT representa módulos e inversores.
-   Como são tratados datasheets, garantias e histórico de preços.
-   Componentes de interface, identidade visual, logotipo e templates
    PDF já existentes.
-   Testes, scripts, lint, typecheck e comandos de build.
-   Histórico Git relacionado aos módulos FV, orçamento e PDF.

Entregar primeiro um mapa do fluxo atual, arquivos relevantes, lacunas e
plano de implementação. Não duplicar funcionalidade existente.

------------------------------------------------------------------------

## 3. Escopo funcional do módulo

### 3.1 Entidades principais

  -----------------------------------------------------------------------
  Entidade                            Responsabilidade
  ----------------------------------- -----------------------------------
  Cliente                             Dados cadastrais e contatos

  UnidadeConsumidora                  Endereço, concessionária, UC,
                                      modalidade e dados tarifários

  FaturaEnergia                       Leituras, consumo, valores,
                                      tributos, créditos e histórico

  Equipamento                         Módulos e inversores obtidos do
                                      SSOT

  Fornecedor/Distribuidora            Empresa fornecedora, cotação,
                                      prazo, frete e condições

  OpcaoKit                            Conjunto de equipamentos e
                                      materiais que forma uma alternativa

  ComposicaoCusto                     Custos diretos, serviços, frete,
                                      estrutura e outros componentes

  ParametrosProjetoFV                 Potência, orientação, inclinação,
                                      perdas e premissas de geração

  DimensionamentoCC                   Strings, MPPTs, limites elétricos e
                                      validações

  Proposta                            Documento comercial que agrupa uma
                                      ou mais opções

  PropostaVersao                      Snapshot imutável de cada
                                      emissão/revisão

  TemplateProposta                    Configuração de layout, paginação e
                                      identidade visual
  -----------------------------------------------------------------------

### 3.2 Fluxo de navegação sugerido

1.  **Orçamentos** --- lista, pesquisa, filtros, status e ações.
2.  **Novo orçamento** --- cliente e unidade consumidora.
3.  **Consumo e fatura** --- dados tarifários, histórico e médias.
4.  **Premissas FV** --- localização, orientação, inclinação, perdas e
    geração específica.
5.  **Opções de kits** --- criar, duplicar, ordenar e comparar opções.
6.  **Custos e investimento** --- composição detalhada, mão de obra,
    estrutura, frete e preço final.
7.  **Engenharia** --- compatibilidade CC/CA, strings, MPPTs e diagrama
    simplificado.
8.  **Condições e garantias** --- pagamento, validade, prazo, garantias,
    monitoramento e manutenção.
9.  **Prévia e emissão** --- conferir versão de 8 páginas e 4 páginas,
    validar e gerar PDFs.

O fluxo pode ser adaptado à navegação já existente do Forte Solar. Não
criar uma segunda experiência visual desconectada do restante do
sistema.

------------------------------------------------------------------------

## 4. Cadastro do cliente e unidade consumidora

### 4.1 Dados do cliente

Campos mínimos:

-   Nome/Razão social.
-   CPF/CNPJ, quando aplicável.
-   Nome de contato.
-   Telefone e e-mail.
-   Endereço de instalação.
-   Município/UF/CEP.
-   Observações comerciais.

### 4.2 Dados da unidade consumidora

-   Número da UC/instalação.
-   Concessionária/distribuidora de energia.
-   Grupo e subgrupo tarifário, quando disponível.
-   Modalidade tarifária.
-   Tensão de fornecimento e tipo de ligação.
-   Classe/subclasse, se necessária.
-   Data da fatura e período de leitura.
-   Quantidade de dias faturados.
-   Identificação da unidade geradora/beneficiária, quando houver
    compensação.

Validar campos obrigatórios sem bloquear o rascunho. Impedir emissão
final se dados essenciais à proposta estiverem ausentes.

------------------------------------------------------------------------

## 5. Entrada e interpretação da fatura de energia

O sistema deve permitir preenchimento manual e, quando já houver
infraestrutura OCR no Forte Solar, importação assistida. O OCR deve
sugerir valores e destacar confiança; não deve gravar silenciosamente
dados duvidosos.

### 5.1 Dados de consumo por posto tarifário

Guardar separadamente, sem misturar energia, tarifa e valor monetário:

-   Consumo Ponta (kWh).
-   Consumo Fora Ponta (kWh).
-   Consumo Reservado (kWh), se aplicável.
-   Energia injetada/compensada e créditos GD1, por posto e componente,
    quando disponíveis.
-   Consumo faturado, consumo medido e energia compensada, com distinção
    explícita.

### 5.2 Componentes tarifários e tributos

Registrar cada item da fatura como uma linha estruturada:

-   Descrição original da fatura.
-   Código/tipo normalizado.
-   Unidade.
-   Quantidade.
-   Preço unitário com tributos, se indicado.
-   Valor bruto.
-   Base de cálculo PIS/COFINS e ICMS, se disponíveis.
-   Alíquota e valor dos tributos.
-   Posto tarifário.
-   Componente: TUSD, TE, demanda, adicional, bandeira, crédito,
    contribuição ou outro.
-   Origem: OCR, digitação manual ou integração.
-   Referência da fatura e página/trecho de origem, se possível.

**Não assumir que o preço unitário exibido já inclui todos os
tributos.** O sistema deve distinguir preço unitário com tributos, preço
sem tributos e valor efetivamente faturado. Se a conta não permitir
identificar com segurança o custo final por kWh, apresentar pendência.

### 5.3 Custo efetivo em R\$/kWh por posto

Exibir para o cliente o custo efetivo por kWh de cada posto tarifário,
com impostos, conforme dados disponíveis.

Regra de cálculo recomendada:

`custo_efetivo_R$/kWh = valor_energético_e_tarifário_atribuível_ao_posto_com_tributos / kWh_correspondentes`

A definição do numerador deve ser configurável e documentada. Não
dividir o valor total da fatura por um único consumo quando houver
demanda, iluminação pública, multas, juros, serviços ou outros itens que
não sejam custo variável de energia.

Apresentar claramente quais componentes entraram no cálculo (por
exemplo, TE + TUSD + tributos atribuíveis) e quais foram excluídos. Se a
alocação de ICMS/PIS/COFINS não puder ser feita com confiabilidade,
mostrar "não calculado --- revisar fatura".

### 5.4 Dados corrigidos manualmente

O sistema deve manter trilha de auditoria quando o usuário corrigir um
valor importado. Exibir valor original, valor corrigido, usuário, data e
justificativa opcional.

------------------------------------------------------------------------

## 6. Histórico, média anual e análise de consumo

### 6.1 Histórico mensal

Guardar, para cada mês:

-   Competência.
-   Consumo em kWh.
-   Posto tarifário, se separado.
-   Dias faturados.
-   Fonte da informação.
-   Indicador de leitura estimada, real ou corrigida.

Não assumir que todos os meses têm 30 dias. Quando necessário, calcular
consumo médio diário e normalizar para comparação, sem substituir o dado
original.

### 6.2 Média anual

A média anual deve ser calculada com base nos meses válidos selecionados
e identificados na proposta.

`media_mensal_kWh = soma(consumos_mensais_validos) / quantidade_de_meses_validos`

Mostrar o período e a quantidade de meses usados. Se houver menos de 12
meses, chamar de "média do período disponível", não "média anual
completa".

O sistema deve permitir excluir mês atípico somente com justificativa e
manter visível a série original. Não excluir automaticamente meses de
alto consumo.

### 6.3 Destaque dos dois maiores consumos

O relatório deve identificar:

-   Maior consumo do período.
-   Segundo maior consumo do período.
-   Dois últimos meses disponíveis.
-   Percentual de aumento dos últimos dois meses em relação à média de
    referência.

Fórmula para variação percentual:

`variacao_percentual = ((consumo_referencia - media_mensal) / media_mensal) * 100`

A interface deve deixar explícito qual período foi comparado. Se o
usuário deseja comparar a média dos dois últimos meses, calcular:

`media_ultimos_2 = (consumo_mes_1 + consumo_mes_2) / 2`

`aumento_ultimos_2_pct = ((media_ultimos_2 / media_mensal) - 1) * 100`

Não usar a expressão "os dois últimos meses aumentaram X%" se o cálculo
foi feito apenas com um deles.

### 6.4 Dimensionamento pela média e cenário de pico

O sistema deve declarar que o dimensionamento base foi feito sobre a
média mensal selecionada.

Calcular separadamente a potência adicional estimada para cobrir o maior
consumo ou o segundo maior consumo, usando a produtividade específica do
projeto:

`potencia_adicional_kWp = energia_adicional_mensal_kWh / produtividade_especifica_kWh_por_kWp_mes`

`energia_adicional_mensal_kWh = max(0, consumo_alvo_kWh - geracao_total_atual_e_proposta_kWh)`

Não apresentar potência adicional como dimensionamento elétrico final; é
uma estimativa energética preliminar sujeita a área, orientação,
inversor, limites da rede, regras de compensação e validação de
engenharia.

------------------------------------------------------------------------

## 7. Geração estimada e comparação com o consumo

### 7.1 Premissas de geração

A geração deve ser calculada pelo motor FV existente ou por serviço
validado. Utilizar, conforme disponibilidade:

-   Localização geográfica.
-   Irradiação/recurso solar.
-   Orientação e inclinação.
-   Sombreamento.
-   Perdas CC/CA.
-   Temperatura e características dos módulos.
-   Eficiência do inversor.
-   Limitações de clipping.
-   Produtividade específica adotada.

Não fixar universalmente um valor de kWh/kWp/mês. Se houver uma
produtividade simplificada informada pelo usuário, identificá-la como
premissa e não como medição.

### 7.2 Separar geração existente e geração adicionada

A comparação deve distinguir visualmente:

1.  Consumo médio mensal.
2.  Geração da usina já existente.
3.  Geração adicional estimada do kit proposto.
4.  Geração total estimada (existente + nova).
5.  Déficit para a média.
6.  Déficit para o segundo maior consumo.
7.  Déficit para o maior consumo.

Fórmulas:

`geracao_total = geracao_existente + geracao_nova`

`deficit_media = max(0, consumo_medio - geracao_total)`

`deficit_segundo_maior = max(0, segundo_maior_consumo - geracao_total)`

`deficit_maior = max(0, maior_consumo - geracao_total)`

Não somar créditos financeiros ou saldos de energia como se fossem
geração mensal física. Se existirem saldos acumulados de créditos,
exibi-los em campo separado e explicar a diferença.

### 7.3 Gráfico de barras horizontais --- padrão aprovado

Para a maior conta analisada, usar uma barra horizontal segmentada com:

-   **Verde:** geração da usina atual.
-   **Azul:** geração adicional da nova proposta.
-   **Vermelho --- tom 1:** complemento que falta até o segundo maior
    consumo.
-   **Vermelho --- tom 2:** complemento adicional até alcançar o maior
    consumo.

Marcar no eixo/na própria barra os valores de consumo do segundo maior
mês e do maior mês. Exibir números em kWh e legenda. A barra deve deixar
claro que os segmentos representam quantidades de energia, e não
percentuais sem escala.

A geração atual e a geração adicionada devem ser calculadas e exibidas
separadamente. Nunca comparar consumo com apenas a geração nova quando
há uma usina existente.

Se a geração total já superar determinado marco de consumo, não desenhar
complemento negativo; indicar excedente estimado separadamente.

### 7.4 Gráfico de histórico anual

Apresentar consumo mensal e linha de média do período. Destacar
visualmente os dois meses recentes quando acima da média. Incluir valor
da média, período, maior mês e segundo maior mês.

Todos os gráficos devem ter título, unidade, legenda, fonte e premissa.
Devem continuar legíveis em PDF A4.

------------------------------------------------------------------------

## 8. Equipamentos, fornecedores e opções de kits

### 8.1 Equipamentos a partir do SSOT

Módulos e inversores devem ser selecionados do catálogo canônico. Não
permitir digitação livre como substituto do cadastro, exceto em fluxo de
equipamento provisório com status "pendente de validação".

Campos importantes do módulo:

-   Fabricante/marca.
-   Modelo exato.
-   Potência nominal (Wp).
-   Tecnologia e tipo (mono/bifacial, quando aplicável).
-   Dimensões e peso.
-   Voc, Vmp, Isc, Imp.
-   Coeficientes de temperatura.
-   Tensão máxima do sistema.
-   Fusível máximo em série.
-   Garantia de produto.
-   Garantia linear de geração.
-   Datasheet, revisão e origem.

Campos importantes do inversor:

-   Fabricante e modelo exato.
-   Potência CA nominal.
-   Potência CC máxima recomendada/admissível.
-   Faixa de tensão MPPT.
-   Tensão CC máxima.
-   Corrente máxima por MPPT e por entrada.
-   Número de MPPTs.
-   Número de entradas por MPPT.
-   Potência máxima de curto-circuito, quando especificada.
-   Garantia.
-   Datasheet, revisão e origem.

### 8.2 Fornecedor/distribuidora

Cada opção deve identificar primeiro a distribuidora/fornecedor e depois
os equipamentos.

Padrão de título:

`2.1 · Nome da distribuidora: módulos MARCA MODELO XXX Wp + inversor MARCA MODELO YY kW`

Exemplos históricos de nomes utilizados em propostas: TV Inteligente,
Lumea/Ribeiro e Alumifix. Esses nomes são exemplos de fornecedores de
uma cotação anterior, não valores fixos do sistema.

Cada cotação deve registrar data, validade, moeda, disponibilidade,
prazo, condição de pagamento, origem, frete e observações.

### 8.3 Estrutura variável por opção

Uma proposta pode ter 1, 2, 3 ou mais opções. Não codificar exatamente
três opções. A ordem e os títulos devem ser gerados a partir dos dados.

Cada opção deve conter:

-   Fornecedor.
-   Módulos e quantidade.
-   Inversor(es) e quantidade.
-   Potência CC instalada.
-   Potência CA instalada.
-   Relação CC/CA.
-   Materiais e estruturas de telhado.
-   Estrutura de solo, quando aplicável.
-   Frete.
-   Custos de engenharia/serviços.
-   Investimento final.
-   Geração estimada.
-   Cobertura do consumo.
-   Compatibilidade elétrica.
-   Garantias específicas.

### 8.4 Regras de apresentação

-   Não repetir a lista "itens do kit" se ela já estiver discriminada em
    outra parte e sua remoção for necessária para caber o conteúdo.
-   O nome da distribuidora deve iniciar o título de todas as opções.
-   O quadro inicial de cada opção deve apresentar geração estimada, não
    repetir MPPT/strings.
-   Dados de MPPT e strings devem ficar no diagrama elétrico
    simplificado.
-   Remover linhas duplicadas de "estrutura de solo" acima da média
    anual quando o valor já estiver discriminado na composição do
    investimento.
-   As três opções devem ter a mesma hierarquia e sequência de
    informações, mesmo que uma distribuidora tenha menos itens.
-   Não inventar dados ausentes para preencher visualmente um quadro.

------------------------------------------------------------------------

## 9. Compatibilidade de módulos e inversores

### 9.1 Indicador de capacidade CC

Exibir uma barra colorida que compare a potência CC instalada com a
capacidade CC admissível/recomendada do inversor, conforme definição do
fabricante e datasheet.

Exemplo ilustrativo, não dado de projeto:

-   Capacidade de referência: 190 módulos de 625 Wp.
-   Projeto: 178 módulos.
-   Utilização: 94%.

Fórmula:

`potencia_cc_projeto_kWp = quantidade_modulos * potencia_modulo_Wp / 1000`

`utilizacao_capacidade_pct = potencia_cc_projeto_kWp / capacidade_cc_referencia_kWp * 100`

A capacidade de referência deve ser calculada com base em uma regra
explicitamente identificada (potência CC máxima do inversor ou outro
limite de projeto). Não converter simplesmente potência CA em quantidade
de módulos sem considerar o datasheet e o critério de
sobredimensionamento.

Exibir: - Capacidade CC de referência. - Potência CC do projeto. -
Percentual utilizado. - Margem restante ou excedente. - Status de
validação.

### 9.2 Estados visuais

-   Verde: dentro da faixa validada.
-   Amarelo: próximo do limite ou requer revisão.
-   Vermelho: limite ultrapassado ou incompatibilidade identificada.
-   Cinza: dados insuficientes para validar.

Os limites devem ser configuráveis por engenharia e nunca arbitrários.

### 9.3 Regras elétricas

Validar, no mínimo:

-   Voc corrigida para a temperatura mínima de projeto não ultrapassa
    tensão máxima CC.
-   Vmp da string permanece dentro da faixa MPPT aplicável.
-   Corrente de operação por MPPT/entrada não excede limites.
-   Corrente de curto-circuito corrigida não excede limites de entrada.
-   Quantidade de strings por MPPT respeita o datasheet.
-   Quantidade de módulos por string é inteira e eletricamente viável.
-   Potência CC e relação CC/CA respeitam o critério adotado.

Usar cálculos de compatibilidade FV já existentes. Não criar uma segunda
implementação de regras elétricas sem justificar e migrar a anterior.

### 9.4 Distribuição de módulos por string

O diagrama deve mostrar: - Cada MPPT. - Quantidade de strings conectadas
a cada MPPT. - Quantidade de módulos em cada string. - Total de
módulos. - Total de strings. - Entradas disponíveis e utilizadas.

A equalização de strings deve ser calculada. Se não for possível
distribuir igualmente, mostrar a distribuição real (por exemplo, strings
com 10 e 11 módulos), não declarar igualdade falsa.

A distribuição visual não substitui validação elétrica. Se a
configuração for apenas preliminar, rotular "distribuição preliminar ---
sujeita à validação de engenharia".

------------------------------------------------------------------------

## 10. Composição de custos e investimento

Este bloco é crítico. O sistema deve explicar o que está incluído no
investimento e evitar que o cliente interprete serviços e materiais como
lucro integral.

### 10.1 Estrutura de custos por opção

Manter categorias independentes:

1.  Equipamentos do kit.
2.  Estrutura de telhado/fibrocimento ou outro tipo.
3.  Estrutura de solo.
4.  Frete/logística.
5.  Materiais elétricos de instalação.
6.  Projeto e documentação.
7.  Execução/instalação.
8.  Taxas técnicas/CRT e custos correlatos.
9.  Outros custos explicitamente cadastrados.
10. Impostos, despesas e margem conforme modelo comercial da empresa.

Cada componente deve ter quantidade, unidade, custo unitário, custo
total, origem e observações.

### 10.2 Estrutura de solo

Regra de referência aprovada para os orçamentos anteriores:

`custo_estrutura_solo = quantidade_modulos * R$ 125,00`

O valor de R\$ 125,00 por módulo é um parâmetro comercial do orçamento
de referência e deve ser configurável por proposta/empresa, não uma
constante espalhada pelo código.

A estrutura de solo deve aparecer uma única vez no quadro **Composição
do investimento**. Não repetir uma linha redundante acima da média anual
ou em outro quadro da opção.

Quando a cotação do fornecedor já incluir estrutura de
fibrocimento/telhado, manter essa composição separada da estrutura de
solo. Não substituir uma pela outra nem remover item da cotação sem
confirmação.

### 10.3 Mão de obra e rateio proporcional

Permitir definir mão de obra como: - Valor fixo por projeto; ou - Regra
proporcional (por kWp, módulo, hora ou percentual), conforme política
comercial.

Quando o usuário solicitar "recalcular proporcionalmente", a regra
precisa estar registrada e ser aplicada de forma explícita. Não presumir
qual base proporcional usar. Solicitar confirmação se a regra não
estiver definida.

Se a mão de obra for rateada entre opções, documentar o critério e
garantir que a soma dos rateios seja igual ao total de mão de obra
previsto.

### 10.4 Frete e condição FOB/CIF

Registrar separadamente: - Condição comercial informada pelo fornecedor
(FOB, CIF ou outra). - Valor de frete na cotação. - Quem paga o frete. -
Destino. - Se o frete está incluído no preço final do kit.

Exemplo de regra de interpretação: cotação descrita como FOB, mas com
frete efetivamente incluso até <município>/RN deve ser registrada como
"condição documental FOB; frete incluso no custo final até <município>/RN
(CIF na composição logística)", somente quando isso tiver sido
confirmado pelo usuário/fornecedor.

Não converter FOB em CIF automaticamente. Guardar texto original e
interpretação confirmada.

### 10.5 Apresentação comercial "Forte Solar"

Em vez de usar apenas "Serviço" ou "Mão de obra" como título amplo, o
quadro aprovado deve usar:

**Forte Solar**\
*(projeto, execução e material elétrico)*

A descrição deve refletir o conteúdo real da composição. O valor pode
incluir projeto, execução, materiais elétricos, taxas técnicas/CRT e
itens definidos no escopo. Não afirmar que algo está incluso se não
estiver registrado na composição.

O objetivo é demonstrar claramente o escopo de entrega, não esconder
custos ou apresentar custos internos como lucro.

### 10.6 Reconciliação do investimento

Fórmula geral:

`investimento_total = soma(custos_diretos) + servicos + frete_nao_incluso + taxas + impostos + margem_aplicavel`

A fórmula exata deve respeitar o modelo comercial já utilizado pelo
Forte Solar. Não aplicar margem ou imposto duas vezes.

Criar testes que reconciliem: - Total da cotação. - Total dos
componentes. - Valor Forte Solar. - Estrutura de solo. - Frete. -
Investimento final apresentado.

O total da proposta deve ser idêntico em todas as telas, tabelas,
gráficos e PDFs.

------------------------------------------------------------------------

## 11. Garantias e dados técnicos de referência

Garantias devem ser obtidas do SSOT/datasheet/termo oficial do
fabricante e armazenadas por modelo e revisão. Os valores abaixo são
referências fornecidas em conversas anteriores e precisam ser
confirmados no cadastro do equipamento antes de uso em nova proposta.

### 11.1 Módulos --- referências já corrigidas

  Fabricante/modelo                  Garantia de produto   Garantia linear de geração
  -------------------------------- --------------------- ----------------------------
  RONMA SOLAR RM-620W-182R/132TB                 15 anos                      30 anos
  HT Solar 615 W                                 15 anos                      30 anos
  JA Solar JAM66D45-625/LB                       12 anos                      30 anos

Observação: para Ronma e HT Solar, houve correção expressa de 5 para 15
anos. O sistema deve usar 15 anos como referência atual do histórico,
mas exigir confirmação documental/datasheet/termo do fabricante antes da
emissão.

### 11.2 Inversores --- referências já corrigidas

  ------------------------------------------------------------------------
  Fabricante/modelo                         Garantia Dados de topologia
                                                     conhecidos
  --------------------- ---------------------------- ---------------------
  Sungrow SG20RT-P2                          10 anos 2 MPPTs, 2 strings
                                                     por MPPT, total de 4
                                                     strings possíveis

  Huawei                                     10 anos 4 MPPTs, 2 entradas
  SUN2000-40KTL-M3                                   por MPPT, total de 8
                                                     strings possíveis

  Auxsolar ASN-25TL                          10 anos 2 MPPTs, 2 entradas
                                                     por MPPT, total de 4
                                                     strings possíveis
  ------------------------------------------------------------------------

Esses dados são parâmetros de referência. O sistema deve conferir a
ficha técnica da variante exata e revisão do modelo, principalmente
corrente por MPPT, tensão, entradas e capacidade CC.

Outro modelo citado em cotação anterior: Solplanet ASW75K-LT com AFCI,
75 kW. Não inferir número de MPPTs, entradas ou garantia sem datasheet
validado.

### 11.3 Regras de garantia

Separar sempre: - Garantia de produto/defeitos de fabricação. - Garantia
linear de geração do módulo. - Garantia do inversor. - Garantia de
instalação/serviço, se oferecida pela Forte Solar.

Exibir prazo, cobertura e ressalvas. Não somar garantias distintas nem
chamar garantia linear de "garantia do produto".

------------------------------------------------------------------------

## 12. Diagrama elétrico simplificado

Cada opção deve ter seu próprio diagrama, derivado do dimensionamento
validado.

### 12.1 Conteúdo obrigatório

-   Marca/modelo do inversor e potência.
-   Potência CC instalada.
-   Módulos e potência unitária.
-   MPPTs.
-   Entradas/strings por MPPT.
-   Quantidade de módulos em cada string.
-   Total de strings e módulos.
-   Fluxo simplificado CC → inversor → proteções CA/quadro → rede.

### 12.2 Regras visuais

O quadro **Dimensionamento CC** deve ficar dentro da seção "Diagrama
elétrico simplificado", junto ao inversor. Não deve aparecer como quadro
repetido no topo da opção.

O quadro inicial de cada opção deve priorizar geração estimada e dados
comerciais. Não repetir MPPT/strings no quadro inicial.

O diagrama deve ser simples, legível e coerente com o projeto. Não
desenhar configuração não validada. Identificar diagramas preliminares.

### 12.3 Dados ausentes ou incompatíveis

Se faltarem limites elétricos ou datasheet: - Bloquear status
"dimensionamento validado". - Mostrar pendência. - Permitir
rascunho/previsualização com aviso. - Não emitir documento como projeto
executivo ou diagrama definitivo.

------------------------------------------------------------------------

## 13. Estrutura das propostas PDF

Os PDFs devem ser produzidos por um único motor de apresentação com dois
templates de paginação. Não criar dois documentos independentes com
dados duplicados.

### 13.1 Identidade visual

-   Usar o logotipo oficial Forte Solar, de preferência como SVG/PNG com
    transparência.
-   Manter paleta azul institucional consistente.
-   Nas barras azuis do cabeçalho das páginas internas, usar a própria
    logomarca branca.
-   O fundo do logotipo deve ser transparente para não criar diferença
    de tom em relação à barra azul.
-   Se não for possível usar transparência, compor o fundo com
    exatamente o mesmo valor de cor do cabeçalho.
-   Preservar cabeçalho, rodapé, paginação e margens.
-   Não usar versões improvisadas, redesenhadas ou distorcidas do
    logotipo.

### 13.2 Tipografia e ocupação de página

-   Fontes legíveis em A4.
-   Evitar fontes pequenas e blocos comprimidos.
-   Distribuir o conteúdo verticalmente de forma equilibrada.
-   Evitar grandes vazios na parte inferior quando houver conteúdo que
    possa ser distribuído sem prejudicar a hierarquia.
-   Não aumentar espaços artificialmente a ponto de separar título do
    conteúdo correspondente.
-   Gráficos devem permanecer junto à opção a que pertencem.
-   Cada opção deve ocupar sua própria página na versão completa, sempre
    que o template de 8 páginas estiver configurado para isso.

### 13.3 Paginação de referência --- versão completa de 8 páginas

A paginação deve ser configurável, mas o padrão aprovado de referência
é:

1.  Capa e identificação da proposta.
2.  Resumo de consumo, fatura, histórico e média.
3.  Opção 2.1 --- primeira distribuidora/kit.
4.  Opção 2.2 --- segunda distribuidora/kit.
5.  Opção 2.3 --- terceira distribuidora/kit.
6.  Comparativo consolidado/retorno ou seção técnica/comercial conforme
    conteúdo aprovado.
7.  **4. Condições comerciais, escopo e garantias.**
8.  **5. Monitoramento, conectividade e manutenção.**

A sequência exata deve ser confirmada no template vigente do repositório
antes de implementar. Não deslocar conteúdo ou alterar numeração sem
atualizar o índice e os títulos.

### 13.4 Paginação de referência --- versão resumida de 4 páginas

A versão curta deve resumir: 1. Capa e dados principais. 2. Consumo,
média e cenário energético. 3. Comparativo das opções e composição do
investimento. 4. Condições, garantias, monitoramento e próximos passos.

A versão resumida deve utilizar os mesmos dados e cálculos da versão
completa.

### 13.5 Padronização entre opções

Todas as opções devem conter a mesma estrutura de informação: - Título
começando pelo nome da distribuidora. - Quadro inicial com equipamentos,
potências e geração estimada. - Indicador de capacidade do inversor. -
Gráfico de geração/consumo aplicável à opção. - Diagrama simplificado e
dimensionamento CC. - Composição do investimento. - Garantias e
observações pertinentes.

Se um dado não se aplicar, usar "Não aplicável" ou omitir de forma
consistente, nunca deixar uma opção com um layout estruturalmente
diferente sem motivo.

### 13.6 Numeração dos capítulos

A numeração é sequencial e única no documento: - Página 7:
`4. Condições comerciais, escopo e garantias`. - Página 8:
`5. Monitoramento, conectividade e manutenção`.

Não repetir o número 4 na página 8. A numeração deve vir de uma
configuração central do template, não ser digitada em componentes
independentes.

------------------------------------------------------------------------

## 14. Condições comerciais, pagamento e escopo

Campos configuráveis por proposta:

-   Valor total por opção.
-   Validade da proposta.
-   Prazo estimado de entrega dos equipamentos.
-   Prazo de execução.
-   Condição de pagamento.
-   Entrada, parcelas e marcos de pagamento.
-   Responsabilidades do cliente.
-   Responsabilidades da Forte Solar.
-   Exclusões do escopo.
-   Condições para início da obra.
-   Condições de acesso, telhado, estrutura e rede.
-   Taxas e documentação incluídas/excluídas.
-   Garantia dos serviços, se definida.

O sistema deve suportar condições específicas por cliente sem alterar o
código.

### 14.1 Monitoramento, conectividade e manutenção

Apresentar: - Solução de monitoramento prevista. - Conectividade
necessária. - Responsabilidade pela internet/roteador. - Limitações de
sinal e rede. - Procedimento de ativação. - Escopo e periodicidade de
manutenção, se contratada. - O que não está incluído.

Não prometer monitoramento remoto contínuo ou manutenção periódica se
isso não fizer parte do contrato.

------------------------------------------------------------------------

## 15. Modelo de dados sugerido

Ajustar ao padrão atual de schemas do Forte Solar. Exemplo conceitual em
JSON; não copiar cegamente sem mapear os modelos existentes.

``` json
{
  "clienteId": "ObjectId",
  "unidadeConsumidoraId": "ObjectId",
  "status": "rascunho",
  "versao": 1,
  "dataEmissao": null,
  "consumo": {
    "periodoInicio": "YYYY-MM",
    "periodoFim": "YYYY-MM",
    "meses": [
      {
        "competencia": "YYYY-MM",
        "consumoKWh": 0,
        "diasFaturados": 30,
        "fonte": "fatura",
        "validado": false
      }
    ],
    "postos": {
      "pontaKWh": 0,
      "foraPontaKWh": 0,
      "reservadoKWh": 0
    },
    "tarifas": [],
    "creditosGD": []
  },
  "premissasFV": {
    "localizacao": {},
    "produtividadeKWhKwpMes": null,
    "metodoEstimativa": null,
    "perdasPercentual": null,
    "usinaExistente": {
      "potenciaKwp": null,
      "geracaoMensalKWh": null,
      "fonte": null
    }
  },
  "opcoes": [
    {
      "ordem": 1,
      "fornecedorId": "ObjectId",
      "nomeFornecedorSnapshot": "Nome",
      "modulos": {
        "equipamentoId": "ObjectId",
        "modeloSnapshot": "Modelo exato",
        "quantidade": 0,
        "potenciaWp": 0
      },
      "inversores": [],
      "materiais": [],
      "dimensionamentoCC": {},
      "geracao": {},
      "custos": {},
      "investimentoTotal": 0
    }
  ],
  "condicoesComerciais": {},
  "documentos": {
    "completo8Paginas": null,
    "resumido4Paginas": null
  },
  "auditoria": {
    "criadoPor": "ObjectId",
    "criadoEm": "ISODate",
    "atualizadoPor": "ObjectId",
    "atualizadoEm": "ISODate"
  }
}
```

### 15.1 Snapshot e imutabilidade

Ao emitir: - Copiar para o snapshot os dados do cliente, equipamentos,
garantias, preços, fornecedor, premissas, cálculos e condições
comerciais. - Guardar versão do motor de cálculo e template. - Guardar
data/hora, usuário emissor e hash do conteúdo, se a arquitetura
permitir. - Alterações posteriores no catálogo não devem modificar PDFs
já emitidos. - Uma revisão deve criar nova versão, preservando a
anterior.

------------------------------------------------------------------------

## 16. Arquitetura de software sugerida

Ajustar aos padrões existentes. Separação lógica recomendada:

``` text
frontend/
  modules/orcamentos/
    pages/
    components/
    hooks/
    services/
    schemas/
    templates/
      propostaCompleta/
      propostaResumida/

backend/
  modules/orcamentos/
    models/
    routes/
    controllers/
    services/
      consumo/
      tarifas/
      geracao/
      dimensionamento/
      custos/
      propostas/
    validators/
    tests/

shared/
  schemas/
  types/
  constants/
```

Não criar exatamente essas pastas se o repositório já adota outra
organização. O importante é manter fronteiras claras.

### 16.1 Serviços de domínio

-   `ConsumoService`: normalização, média, máximos e variações.
-   `TarifaService`: custo efetivo por kWh com tributos e critérios
    explícitos.
-   `GeracaoService`: integração com motor FV existente.
-   `ComparativoEnergeticoService`: geração existente + nova e déficits.
-   `DimensionamentoCCService`: compatibilidade e strings.
-   `CustoOrcamentoService`: composição, rateios e reconciliação.
-   `PropostaSnapshotService`: congelamento dos dados.
-   `PropostaPdfService`: renderização de 8 e 4 páginas.
-   `PropostaValidationService`: validações bloqueantes e alertas.

### 16.2 API conceitual

Os endpoints devem seguir o padrão atual do backend. Sugestão de
recursos:

-   `POST /orcamentos`
-   `GET /orcamentos`
-   `GET /orcamentos/:id`
-   `PATCH /orcamentos/:id`
-   `POST /orcamentos/:id/opcoes`
-   `PATCH /orcamentos/:id/opcoes/:opcaoId`
-   `POST /orcamentos/:id/calcular`
-   `POST /orcamentos/:id/validar`
-   `POST /orcamentos/:id/preview`
-   `POST /orcamentos/:id/emitir?formato=completo`
-   `POST /orcamentos/:id/emitir?formato=resumido`
-   `GET /orcamentos/:id/versoes`

Os nomes finais devem seguir convenções REST já existentes. Validar
entrada no backend; não confiar apenas em validação do frontend.

------------------------------------------------------------------------

## 17. Interface e experiência do usuário

### 17.1 Painel de opções

Comparar lado a lado: - Distribuidora. - Marca/modelo do módulo. -
Quantidade e potência CC. - Marca/modelo do inversor. - Potência CA. -
Geração estimada. - Percentual da média coberta. - Capacidade CC
utilizada. - Investimento final. - Garantias. - Status de validação.

### 17.2 Alertas úteis

Exemplos: - Fatura sem período completo. - Média baseada em menos de 12
meses. - Dois últimos meses acima da média. - Geração estimada não cobre
a média. - Geração existente não informada. - Cotação vencida. - Frete
sem confirmação. - Garantia sem documento de origem. - Equipamento sem
datasheet. - String fora da faixa MPPT. - Corrente acima do limite. -
Estrutura de solo duplicada. - Divergência entre total da composição e
total da proposta.

Alertas devem explicar o problema e indicar o campo a corrigir.
Diferenciar aviso, pendência e bloqueio.

### 17.3 Prévia PDF

A prévia deve permitir: - Alternar entre 8 e 4 páginas. - Navegar página
por página. - Verificar cortes, sobreposições e páginas vazias. -
Confirmar logotipo, cores, fonte e rodapé. - Conferir todos os valores
com os dados da tela. - Voltar para corrigir sem perder o rascunho.

------------------------------------------------------------------------

## 18. Segurança, permissões e auditoria

-   Respeitar autenticação e autorização existentes.
-   Definir quem pode criar, editar, aprovar e emitir propostas.
-   Não expor custo interno/margem para perfis sem autorização.
-   Validar todos os dados no servidor.
-   Registrar alterações em preços, premissas, garantias e condições.
-   Proteger arquivos PDF e dados pessoais conforme políticas do
    sistema.
-   Não incluir credenciais, tokens ou dados sensíveis em logs.
-   Fazer backup/controle de versão conforme padrão do projeto.

------------------------------------------------------------------------

## 19. Plano de implementação por fases

### Fase 0 --- Diagnóstico e plano

1.  Mapear o repositório.
2.  Encontrar módulos FV, SSOT, catálogo, cálculos e PDF.
3.  Identificar funções reutilizáveis.
4.  Identificar lacunas e riscos.
5.  Apresentar arquitetura proposta e arquivos a alterar.
6.  Aguardar validação do plano antes de mudanças estruturais.

**Entrega:** relatório técnico e plano de implementação.

### Fase 1 --- Modelo de dados e domínio

1.  Criar/ajustar schemas.
2.  Implementar validações.
3.  Implementar snapshot/versionamento.
4.  Criar testes de schema e regras.
5.  Garantir compatibilidade com registros existentes.

**Entrega:** modelos e serviços de domínio testados.

### Fase 2 --- Consumo, tarifas e gráficos

1.  Cadastro/importação de fatura.
2.  Normalização de itens tarifários.
3.  Cálculo R\$/kWh por posto com impostos.
4.  Histórico mensal e média.
5.  Identificação dos maiores consumos.
6.  Cenários de geração e déficit.
7.  Gráficos de histórico e barra segmentada.

**Entrega:** painel energético com memória de cálculo.

### Fase 3 --- Kits, fornecedores e custos

1.  Seleção de equipamentos via SSOT.
2.  Cadastro de cotações.
3.  Composição de kits.
4.  Estrutura de telhado e solo.
5.  Frete FOB/CIF.
6.  Materiais e serviços Forte Solar.
7.  Rateios e totalização.
8.  Comparativo entre opções.

**Entrega:** opções calculadas e reconciliadas.

### Fase 4 --- Engenharia e diagramas

1.  Integração com dimensionamento FV existente.
2.  Validação CC/CA.
3.  Distribuição de módulos por string.
4.  Indicador de capacidade do inversor.
5.  Diagrama simplificado.
6.  Alertas de engenharia.

**Entrega:** diagrama e status de validação por opção.

### Fase 5 --- PDF e identidade visual

1.  Mapear o template de referência.
2.  Implementar versão 8 páginas.
3.  Implementar versão 4 páginas.
4.  Reutilizar dados e cálculos comuns.
5.  Padronizar títulos, cabeçalhos, logotipo, cores e paginação.
6.  Ajustar ocupação vertical e fontes.
7.  Validar visualmente todas as páginas.

**Entrega:** PDFs equivalentes ao padrão aprovado.

### Fase 6 --- QA, homologação e implantação

1.  Testes unitários e integração.
2.  Testes de regressão.
3.  Testes visuais dos PDFs.
4.  Testes de permissões.
5.  Testes com dados de referência.
6.  Homologação do usuário.
7.  Deploy controlado.
8.  Monitoramento e plano de rollback.

**Entrega:** módulo liberado com documentação e evidências.

------------------------------------------------------------------------

## 20. Casos de teste obrigatórios

### 20.1 Consumo e tarifas

-   Fatura com ponta e fora ponta.
-   Fatura com ponta, fora ponta e reservado.
-   Fatura sem discriminação tributária suficiente.
-   Histórico com 12 meses completos.
-   Histórico com menos de 12 meses.
-   Mês de consumo excepcionalmente alto.
-   Dois últimos meses acima da média.
-   Correção manual de OCR.
-   Créditos GD1 existentes e geração de usina já instalada.

### 20.2 Geração e comparativo

-   Usina existente igual a zero.
-   Usina existente informada.
-   Nova geração abaixo da média.
-   Geração total cobrindo média, mas não o pico.
-   Geração total cobrindo segundo maior e maior consumo.
-   Excedente de geração.
-   Ausência de produtividade específica validada.

### 20.3 Equipamentos e engenharia

-   Módulo e inversor compatíveis.
-   Tensão Voc excedida em temperatura mínima.
-   String abaixo da tensão mínima MPPT.
-   Corrente por MPPT excedida.
-   Número de strings maior que entradas disponíveis.
-   Distribuição desigual de módulos por string.
-   Datasheet ausente ou revisão divergente.

### 20.4 Custos

-   Estrutura de solo calculada por módulo.
-   Estrutura de telhado presente na cotação.
-   Estrutura de telhado e solo simultâneas.
-   Frete incluso e frete separado.
-   Cotação declarada FOB com frete confirmado incluso.
-   Rateio proporcional de mão de obra.
-   Alteração de quantidade de módulos.
-   Reconciliação exata do investimento final.

### 20.5 PDF

-   Proposta com 1, 2, 3 e mais opções.
-   PDF de 8 páginas.
-   PDF de 4 páginas.
-   Títulos com distribuidora no início.
-   Logotipo sem diferença de tom no cabeçalho.
-   Nenhuma linha de estrutura de solo duplicada.
-   Quadro inicial com geração estimada.
-   MPPT/strings somente no diagrama.
-   Página 7 capítulo 4 e página 8 capítulo 5.
-   Gráficos legíveis e posicionados na página da opção.
-   Sem cortes, sobreposições, texto fora da margem ou página vazia.

------------------------------------------------------------------------

## 21. Critérios de aceite

A implementação só pode ser considerada concluída quando:

-   [ ] O orçamento usa cadastro de cliente e UC do Forte Solar.
-   [ ] Módulos e inversores vêm do SSOT.
-   [ ] Materiais usam o Catálogo Mestre quando aplicável.
-   [ ] Fatura e histórico podem ser cadastrados e revisados.
-   [ ] R\$/kWh por posto é calculado com critério de tributos
    explícito.
-   [ ] Média e meses de maior consumo são demonstrados.
-   [ ] Geração existente é somada à geração nova no comparativo.
-   [ ] Déficit até média, segundo maior e maior consumo é mostrado.
-   [ ] Opções são dinâmicas e não limitadas a três.
-   [ ] Custos, estrutura, frete e serviços são reconciliados.
-   [ ] Estrutura de solo não aparece duplicada.
-   [ ] "Forte Solar (projeto, execução e material elétrico)" reflete a
    composição real.
-   [ ] Capacidade do inversor é apresentada com critério verificável.
-   [ ] Strings e MPPTs são validados com dados do datasheet.
-   [ ] Diagrama corresponde ao dimensionamento.
-   [ ] Garantias são separadas por tipo e têm fonte.
-   [ ] PDF completo e resumido usam o mesmo objeto de orçamento.
-   [ ] Identidade visual e logotipo são consistentes.
-   [ ] Distribuição vertical das páginas foi revisada visualmente.
-   [ ] Snapshot e histórico de versões funcionam.
-   [ ] Testes automatizados passam e não há regressões nos módulos
    FV/EV/BESS.

------------------------------------------------------------------------

## 22. Instruções de trabalho específicas para Claude Code

### 22.1 Regra principal

**Não implementar por aproximação.** Antes de escrever código, descobrir
como o Forte Solar já resolve cada problema e reutilizar o que estiver
correto.

### 22.2 Processo recomendado

1.  Explorar o repositório sem modificar arquivos.
2.  Ler `CLAUDE.md`, README, arquitetura e documentação local.
3.  Pesquisar implementações existentes por domínio (FV, catálogo, SSOT,
    fatura, PDF, diagrama).
4.  Traçar fluxo de dados frontend → API → serviços → MongoDB → PDF.
5.  Preparar plano com arquivos que serão criados/alterados.
6.  Identificar decisões que dependem do responsável técnico/comercial.
7.  Escrever testes para regras críticas antes da implementação.
8.  Implementar por fases pequenas.
9.  Executar testes, lint, typecheck e build.
10. Gerar PDFs de teste e inspecionar visualmente todas as páginas.
11. Entregar resumo, arquivos alterados, testes executados e pendências.
12. Não fazer deploy, migração destrutiva ou alteração de dados de
    produção sem autorização explícita.

### 22.3 Restrições

-   Não substituir banco, framework, biblioteca PDF ou arquitetura sem
    justificativa e aprovação.
-   Não criar tabelas/coleções paralelas para dados que já existam no
    SSOT.
-   Não modificar os módulos EV/BESS ou o catálogo fora do escopo sem
    necessidade demonstrada.
-   Não alterar o padrão de orçamento aprovado sem registrar a mudança.
-   Não inventar dados elétricos, tarifários, garantias, preços ou
    fretes.
-   Não tratar estimativa energética como projeto executivo.
-   Não gerar proposta final com incompatibilidade elétrica bloqueante.
-   Não remover testes para fazer o build passar.
-   Não usar dados de produção em testes sem anonimização e autorização.

### 22.4 Uso de CLAUDE.md, regras e skills

Manter o `CLAUDE.md` da raiz conciso: arquitetura, comandos, diretórios
e princípios globais. Colocar procedimentos longos em uma Skill
específica do Claude Code, por exemplo:

`.claude/skills/orcamento-fotovoltaico/SKILL.md`

Regras específicas de arquivos podem ficar em `.claude/rules/`. Usar
subagentes para tarefas independentes, como auditoria do SSOT, revisão
de cálculos, análise do template PDF e auditoria de testes. Hooks podem
automatizar lint, testes e verificações determinísticas.

A documentação do Claude Code recomenda separar contexto permanente de
procedimentos sob demanda e seguir um fluxo de exploração, planejamento,
implementação e validação. Referências oficiais: - [Claude Code --- Best
practices](https://code.claude.com/docs/en/best-practices) - [Steering
Claude Code: CLAUDE.md, skills, hooks, rules e
subagents](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more)

------------------------------------------------------------------------

## 23. Prompt inicial para executar no Claude Code

Copie o texto abaixo depois de colocar este manual no repositório, por
exemplo em `docs/MANUAL_MODULO_ORCAMENTOS_FV.md`.

> Leia integralmente `docs/MANUAL_MODULO_ORCAMENTOS_FV.md`.
>
> Estamos implementando o módulo nativo de Orçamentos Fotovoltaicos do
> Forte Solar. Antes de alterar qualquer arquivo, faça uma auditoria do
> repositório.
>
> **Não comece a programar ainda.**
>
> Identifique: 1. Estrutura atual do frontend, backend e MongoDB. 2.
> Modelos e serviços existentes de cliente, UC, fatura, equipamentos,
> SSOT, catálogo de materiais, geração FV, dimensionamento CC, diagramas
> e PDFs. 3. Funções que podem ser reutilizadas e pontos em que há
> duplicidade. 4. Como o sistema atual gera ou armazena propostas e
> documentos. 5. Quais informações do manual já estão implementadas e
> quais são lacunas. 6. Riscos de regressão para os módulos FV, EV, BESS
> e Catálogo Mestre.
>
> Em seguida, apresente: - Mapa do fluxo atual. - Arquivos e componentes
> relevantes. - Arquitetura recomendada integrada ao padrão existente. -
> Modelo de dados proposto, destacando o que já existe. - Plano de
> implementação por fases. - Testes necessários. - Dúvidas que exigem
> decisão do responsável técnico/comercial.
>
> Preserve os princípios SSOT, integridade dos dados, engenharia antes
> da apresentação e ausência de dados inventados. Não crie cadastros
> paralelos nem altere produção.
>
> Aguarde minha aprovação do plano antes de iniciar a implementação.

------------------------------------------------------------------------

## 24. Decisões que precisam ser confirmadas durante a implantação

O manual descreve as regras de negócio conhecidas, mas o Claude Code
deve confirmar no código e com o responsável as decisões abaixo:

1.  Qual serviço atual é a fonte oficial de produtividade/geração FV?
2.  Qual critério de tributos será utilizado para o custo efetivo
    R\$/kWh em cada modalidade tarifária?
3.  Como o Forte Solar representa créditos GD1 e saldos de energia por
    posto?
4.  Qual regra oficial de rateio de mão de obra entre opções?
5.  Qual política de margem, impostos e formação do preço final?
6.  Quais campos de cotação e frete já existem?
7.  Qual biblioteca/serviço atual gera PDFs e diagramas?
8.  Quais garantias estão documentalmente confirmadas no SSOT?
9.  Qual o template final vigente de 8 e 4 páginas e quais seções são
    obrigatórias?
10. Qual o fluxo de aprovação e emissão de proposta dentro do sistema?

Essas decisões não devem ser resolvidas por suposição do agente.

------------------------------------------------------------------------

## 25. Visão de evolução: orçamento como primeira etapa do processo FV

O orçamento é a etapa comercial inicial do ciclo, não um processo
isolado.

Após a aprovação do cliente, os dados já cadastrados devem alimentar as
próximas etapas, sem redigitação:

1.  **Orçamento:** opções, custos, estimativa de geração e condições.
2.  **Fechamento comercial:** escolha do kit, versão aprovada, escopo e
    pagamento.
3.  **Projeto FV:** dados definitivos, arranjo, módulos, inversores,
    strings e dimensionamento.
4.  **Diagramas:** unifilar, arranjo CC/CA, proteções e documentação.
5.  **BOM:** materiais e quantidades derivados do projeto aprovado.
6.  **Homologação:** documentação da concessionária, formulários e
    acompanhamento.
7.  **Execução:** checklist, instalação, comissionamento e evidências.
8.  **Entrega:** documentação final, monitoramento e manutenção.

A arquitetura do orçamento deve preparar essa continuidade, mas não
tentar implementar todas as etapas de projeto e homologação dentro do
escopo inicial. Deve preservar IDs, snapshots e dados técnicos
reutilizáveis para que as fases seguintes consumam a mesma fonte
confiável.

------------------------------------------------------------------------

## Conclusão

O módulo deve ser tratado como um **motor de orçamento técnico-comercial
integrado à engenharia do Forte Solar**. O PDF é apenas a saída final de
um processo estruturado.

O sucesso não será medido apenas pela semelhança visual com a proposta
de referência. Será medido pela consistência entre fatura, consumo,
geração, equipamentos, dimensionamento, custos, comparativo e documento
emitido --- com rastreabilidade e sem duplicidade de dados.

**Prioridade de implementação:** integridade dos dados → cálculos e
engenharia → automação → experiência do usuário → estética.
