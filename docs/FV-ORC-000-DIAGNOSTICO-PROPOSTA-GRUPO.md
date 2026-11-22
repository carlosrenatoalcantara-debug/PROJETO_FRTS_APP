# FV-ORC-000 — Diagnóstico: proposta de 8/4 páginas a partir do Forte Solar

**Data:** 2026-11-21 · **Base:** `origin/main` @ `e882e0a`
**Insumos analisados:**
- PDF final `Proposta_<cliente-B>_8_paginas.pdf` (resultado-alvo)
- `docs/MANUAL_MODULO_ORCAMENTOS_FV.md` (manual gerado pelo ChatGPT)
- Chat 1 "Orçamento Energia Solar" (Cliente A / usina nova — origem do padrão)
- Chat 2 "Elaborar novo orçamento" (Cliente B / ampliação — versão final)

Fase 0 do manual: diagnóstico e plano. **Nenhum código alterado.**

---

## 1. Conclusão

1. O PDF do ChatGPT é uma **proposta de GRUPO**: uma fatura, N opções (distribuidores), um comparativo e textos padrão. O Forte Solar já modela o grupo (`ProjetoFV.proposta_grupo_id` + `opcao_numero`), mas **gera PDF por opção** (`propostaComercialService.gerarPropostaComercial`). Essa é a lacuna estrutural nº 1.
2. **~60% dos dados já existem** no fluxo canônico (`/fv/projetos`): cliente, composição por opção (`arranjos[]`), fornecedor por arranjo, catálogo com MPPT/entradas/garantias, classificadores de tensão/corrente/oversizing, envio com snapshot e aceite digital.
3. **Faltam 4 coisas**: (a) fatura detalhada por posto tarifário + crédito GD; (b) cotação do distribuidor estruturada; (c) política comercial FV (estrutura de solo, pacote Forte Solar, parcelas); (d) os cálculos do comparativo energético e a distribuição automática de strings — todos funções puras.
4. O ChatGPT **não tem motor**: fez cálculos à mão a cada rodada e cometeu ao menos um erro elétrico (ver §3). Integrar significa o Forte Solar calcular e o PDF só exibir.

---

## 2. Bloco a bloco: PDF × Forte Solar

| # | Bloco do PDF | Dados / cálculo | Já existe | Lacuna |
|---|---|---|---|---|
| p1 | Capa | cliente, UC, data, emissor (razão social, CNPJ, endereço, fone, e-mail), local de entrega | `Cliente`; `Empresa` (nome, cnpj, branding.cores); `EmpresaConfig.branding` | PDF atual lê emissor de `process.env.EMPRESA_*` com placeholder `XX.XXX…`. Logo oficial não usado. |
| p2 | Diagnóstico da fatura | titular, classe/subgrupo, ligação, mês ref. + dias, total R$, consumo **por posto** (FP 13.777 + Reservado 4.741) | `textoFatura.extrairDadosDoTexto`: classificação, subgrupo, ligação, valorR, valorKwh | **Postos tarifários, dias faturados, mês de referência** não extraídos. |
| p2 | Histórico 12 meses + gráfico | média 12m, 2 últimos meses e % acima, média dos 2 últimos | `historico12Meses`, `mediaAnual` (12 mais recentes, commit `5de7b99`) | Picos/variação/“média do período disponível” — cálculo puro inexistente. Gráfico inexistente no PDF backend. |
| p2 | Custo R$/kWh com tributos | TUSD + TE por posto (coluna “Preço Unit. com Trib.”) | `valorKwh` (um número só) | **TUSD/TE por posto** não extraídos. |
| p2 | Crédito GD1 (só em ampliação, D3) | 3.395,75 kWh, contado 1× (aparece em TUSD e TE) | `FaturaEnergia.geracao_existente` (Mixed, sem extrator); ampliação com arranjo `existente` congelado (`ampliarProjetoFV`) | Extração e regra “contar uma vez”; botão “Ampliar” no fluxo canônico. |
| p3-5 | Título da opção | `2.N · Distribuidor: módulos X + inversor Y` | `opcao_numero`, `opcao_rotulo`, `arranjos[].fornecedor.nome`, composição | Só montagem do texto. |
| p3-5 | Cotação do distribuidor | nº, data, validade, frete (FOB/CIF, destino, incluso?), itens inclusos (estrutura fibrocimento, cabos) | `arranjos[].fornecedor{nome,contato,observacoes}` + `orcamento_distribuidor` (só arquivo) | **Campos estruturados da cotação**. |
| p3-5 | Potência CC/CA | 178 × 620 Wp = 110,36 kWp | `composicao.potenciaCcKwp/potenciaCaKw` | — |
| p3-5 | Geração estimada | kWp × HSP × 30 × eficiência (D1) | HSP por local (NASA/CRESESB); eficiência padrão em Configurações + ajuste manual na etapa Dimensionamento | Eficiência usada **não é persistida** no projeto (`dimensionamento.performance_ratio` fica `null`). |
| p3-5 | Cobertura / déficit / kWp adicional | crédito + nova vs média, mês pico 2, mês pico 1; `kWp = déficit / produtividade` | nada | **Motor `comparativoEnergetico`** (puro). |
| p3-5 | Garantias | módulo: produto + linear; inversor | `Equipamento.garantia_produto`, `garantia_performance`, `garantia_padrao_meses` | Cobertura real do catálogo a auditar (Ronma/HT/JA/Sungrow/Huawei/Solplanet/Auxsol). |
| p3-5 | Diagrama MPPT/strings | n MPPT × strings/MPPT, distribuição equalizada (11/12) | catálogo `numero_mppt`, `entradas_por_mppt`/`strings_por_mppt`, `corrente_max_entrada`; `topologia.js` (manual, EtapaMppt); `classificarTensaoCC`, `classificarCorrenteCC` | **Sugestão automática** de distribuição; versão “simplificada” do diagrama para o PDF (`unifilarSVG` é o unifilar completo). |
| p3-5 | Barra capacidade CC | projeto ÷ potência FV recomendada (98,1% / 105,4% / 84%) | `classificarOversizing`; catálogo `potencia_cc_max` | Catálogo: **0 de 39 inversores declaram `oversizing_max`** (F2). Precisa dado de datasheet. |
| p3-5 | Composição do investimento | kit + estrutura de solo (R$ 125 × módulos) + “Forte Solar (projeto, execução e material elétrico)” = total | `Orcamento.itens[]` (material/serviço, sem categoria); legado `ProjetoFV.orcamento.kit` | **Política comercial FV** (não existe; EV tem `politica_comercial_ev`). Itens sem **categoria** e sem **pagador**. |
| p6 | Comparativo das opções | tabela energia + kWp adicional por referência | nada | Mesmo motor do p3-5, agregado no grupo. |
| p7 | Condições comerciais | equipamento pago direto à distribuidora; Forte Solar: entrada R$ 1.000 + 50% na entrega + 50% no término; (Cliente A: 12× no cartão) | `Orcamento.condicoes{validade_dias, prazo_execucao_dias, forma_pagamento (texto), observacoes}` | Marcos de pagamento estruturados; textos padrão (escopo, ressalvas, garantia de serviço 1 ano). |
| p8 | Monitoramento, conectividade, manutenção, plano opcional | texto padrão da empresa | nada | **Textos padrão em `EmpresaConfig`** (editáveis, versionados no snapshot). |
| p8 | Aceite | cliente, assinatura, alternativa escolhida | aceite digital: `EnvioPropostaService` (snapshot + hash), `PropostaFVPublica`, `proposta_aceite` | Só o bloco impresso. |

---

## 3. Regras de negócio extraídas dos dois chats

Explícitas — passam a ser parâmetros, nunca constantes no código.

| Regra | Valor nos chats | Onde deve morar |
|---|---|---|
| Produtividade | 130 kWh/kWp/mês | `EmpresaConfig.fv_padroes` ou motor por local (D1) |
| Custo extra por tipo de estrutura | R$/módulo por tipo de `TIPOS_ESTRUTURA` (fv-shared): Solo 125; Laje ex. 25 (blocos + AC3 + mão de obra); Fibrocimento, Cerâmico, Metálico 0. Linha única na composição, só quando > 0 | Configurações (D2, decidido) |
| Pacote Forte Solar | **Decidido (D2): % configurável** sobre (kit + extra de estrutura). Histórico: Cliente A v1 60%; Cliente A v2 fixo R$ 35.000; Cliente B ≈ 39,9% | Configurações; ajustável por proposta |
| Custos adicionais do pacote | instalação por placa, material, imposto, outros (viagem, combustível, alimentação, hospedagem…) — lista aberta | Configurações; somados ao pacote, o cliente vê só o total “Forte Solar” |
| Percentual oculto | o cliente nunca vê o % do serviço | regra do renderizador |
| Pagador | equipamento → distribuidora; serviço → Forte Solar | campo `pagador` por item |
| Parcelas Forte Solar | entrada R$ 1.000 + 50% saldo na entrega + 50% no término; arredondamento: última parcela absorve o centavo (35.162,10 / 35.162,09) | política comercial FV |
| Cartão | 12 × R$ 3.400 (total R$ 40.800, com acréscimo) | política comercial FV (opcional) |
| Frete | todas as opções CIF até o local de entrega; texto original da cotação preservado quando diz FOB | cotação estruturada |
| Garantia de serviço | 1 ano; depois, visita técnica cobrada | texto padrão |
| Dimensionamento | sobre a média de 12 meses; picos só como alerta + kWp adicional | motor comparativo |
| Crédito GD1 | somado à geração nova; contado 1× | motor comparativo (D3) |
| Título da opção | nome do distribuidor primeiro | renderizador |
| MPPT/strings | só no diagrama, nunca no quadro inicial | renderizador |
| Numeração | capítulos sequenciais (p7 = 4, p8 = 5) | config central do template |

### Erros do PDF do ChatGPT que o motor deve impedir

1. **Strings desiguais no mesmo MPPT** — opção Lumea (177 módulos, 8 MPPT × 2): o diagrama coloca S1 = 11 e S2 = 12 no mesmo MPPT. Strings em paralelo no mesmo MPPT precisam ter o mesmo comprimento. Distribuição válida, por exemplo: 6 MPPT × (2 × 12) + 1 MPPT × (2 × 11) + 1 MPPT × (1 × 11) = 177, 15 strings.
2. **Distribuição sem checar tensão** — “preencher todas as entradas e dividir” ignora Voc na temperatura mínima e a janela MPPT. Toda sugestão passa por `classificarTensaoCC` e `classificarCorrenteCC`.
3. **Corrente acima do limite não bloqueia** — no Cliente A, a JA 625 W (Imp 15,45 A) contra 15 A por entrada do Sungrow foi só um comentário. No Forte Solar vira status `incompativel` / `atencao`.
4. **Regra do pacote muda dentro da mesma proposta** (proporcional em duas opções, fixo na terceira) sem aviso. O sistema registra o modo por opção e o exibe na memória de cálculo interna.
5. **Garantias contraditórias entre rodadas** (Ronma/HT: 5 → 15 anos). O sistema lê do catálogo com fonte, e não do texto da conversa.

---

## 4. Arquitetura de integração

Princípio: **o PDF só exibe**. Todo número sai de função pura testada, a partir de dados que já têm dono.

```
Fatura (FaturaEnergia)  ─┐
Opções (ProjetoFV × N,   │   montarDocumentoProposta(grupoId)   ┌─ renderer 8 págs (pdfkit)
  arranjos[], cotação)  ─┼─► view-model JSON, sem I/O de PDF ───┤
Catálogo (SSOT)         ─┤   + snapshot no envio (já existe)    └─ renderer 4 págs (pdfkit)
Política comercial FV   ─┤
Textos padrão empresa   ─┘
```

### Novos módulos (puros, em `packages/fv-shared`, usados pelo front e pelo back)

| Módulo | Responsabilidade |
|---|---|
| `financeiro/comparativoEnergetico.js` | média do período, 2 maiores, 2 últimos, variação %, cobertura, déficits, kWp adicional |
| `engenharia/distribuicaoStrings.js` | sugere distribuição respeitando: mesmo comprimento por MPPT, entradas do catálogo, janela de tensão e corrente (via classificadores existentes); devolve `preliminar` + lacunas |
| `financeiro/precificacaoOpcao.js` | linhas da composição: kit; extra de estrutura (R$/módulo pelo tipo); pacote Forte Solar = % × (kit + extra) + custos adicionais; parcelas com arredondamento determinístico; reconciliação do total. Parâmetros vêm de Configurações, com override por proposta |

### Alterações de dados (aditivas)

| Onde | O quê |
|---|---|
| `FaturaEnergia` + `textoFatura.js` | `postos[] {posto, kwh, tusd_r_kwh_com_trib, te_r_kwh_com_trib}`, `mes_referencia`, `dias_faturados`, `credito_gd_kwh` |
| `arranjos[].fornecedor` | `cotacao {numero, data, validade, valor_kit_r, frete {modalidade_documental, incluso, destino}, itens_inclusos[]}` |
| Configurações › Financeiras (CFG-04, **já existe**: `EmpresaContext` → `/api/empresa`, hoje lido só pelo wizard legado `E8Orcamento`) | acrescentar: `pacote_pct` (% sobre kit + extra de estrutura); `extra_estrutura_r_por_modulo {Solo: 125, Laje: 25, Fibrocimento: 0, …}` com chave = `TIPOS_ESTRUTURA`; `custos_adicionais[] {descricao, base: por_modulo|fixo|pct, valor}` (viagem, combustível, hospedagem…); `pagamento {entrada_r, marcos[]}`. Reaproveitar os campos existentes: `precoMaoDeObra` (instalação por placa), `impostosPct`, `parcelasPadraoCartao`, `cartaoTaxaMesPct`. Todos sobrescrevíveis por proposta |
| `EmpresaConfig.textos_proposta_fv` | condições gerais, escopo, garantia de serviço, monitoramento, conectividade, manutenção, plano opcional |
| `Orcamento.itens[]` | `categoria` (kit, estrutura_solo, pacote_forte_solar, frete, outro) e `pagador` (distribuidora, forte_solar) |
| emissor do PDF | ler de `Empresa` em vez de `process.env.EMPRESA_*` |

### Onde cada dado entra no fluxo canônico `/fv/projetos/:id`

| Etapa | Novo |
|---|---|
| `projeto` | revisão da fatura: postos, TUSD/TE, crédito GD, histórico |
| `equipamentos` | cotação estruturada do distribuidor (o upload do PDF já existe) |
| `mppt` | botão “sugerir distribuição” (chama `distribuicaoStrings`) |
| `orcamentos` | itens gerados pela política comercial; o operador ajusta e justifica |
| `proposta` | “PDF da proposta — completa (8 págs.)” e “resumida (4 págs.)” no nível do grupo; prévia |

---

## 5. Plano por fases

Critério de aceite transversal: **teste golden** com os números do PDF Cliente B, em fixture anonimizada.

| Valor esperado | Origem |
|---|---|
| 178 × 620 = 110,36 kWp; 14.347 kWh/mês; +3.395,75 GD = 17.743; 177,3% da média 10.009 | p3 |
| falta out/26 = 775 kWh → 6,0 kWp | p3 |
| estrutura de solo 178 × 125 = R$ 22.250,00 | p3 |
| pacote 0,398857 × (156.571,66 + 22.250) = R$ 71.324,19; parcelas 1.000 / 35.162,10 / 35.162,09 | p7 |
| Alumifix: 82 × 615 = 50,43 kWp; +0,4 kWp para a média; +52,5 kWp para a média set/out | p5 |
| 178 módulos → 14 strings × 11 + 2 × 12 (no mesmo MPPT) | p3 |

| Fase | Entrega | Depende de |
|---|---|---|
| 1 · Motores puros | `comparativoEnergetico`, `precificacaoOpcao`, `distribuicaoStrings` + testes golden | D1, D2, D3 |
| 2 · Dados | campos aditivos acima; extrator Cosern de postos/TUSD/TE/GD com fixture sintética | — |
| 3 · Documento | `montarDocumentoProposta(grupoId)` + renderer 8 págs. + endpoint por grupo; emissor do `Empresa`; snapshot no envio | Fase 1 |
| 4 · Resumida | renderer 4 págs. do mesmo view-model | Fase 3 |
| 5 · UI | campos nas etapas `projeto`, `equipamentos`, `mppt`, `orcamentos`, `proposta`; prévia; botão **Ampliar** no fluxo canônico (reusa `POST /:id/ampliar`) com a usina antiga exibida somente leitura | Fases 2-3 |
| Paralelo · Catálogo | cadastrar/validar com datasheet: Solplanet ASW75K-LT, Sungrow SG75CX-P2/SG20RT-P2/SG40CX-P2, Huawei SUN2000-40KTL-M3/10K-LC0, Auxsol ASN-25TL, Ronma RM-620W-182R/132TB, JA JAM66D45-625/LB, HT 615, DMEGC 625 — MPPT, entradas, corrente, potência FV recomendada, garantias | dado, não código |

Renderer: **pdfkit** (já é dependência e já gera a proposta atual). Gráficos e diagrama com primitivas do pdfkit; sem navegador headless no Railway.

---

## 6. Decisões pendentes (do responsável comercial)

- **D1 · Produtividade:** **decidido (2026-11-21)** — por localização: `kWh/kWp/mês = HSP × 30 × eficiência`.
  - A eficiência padrão vem de Configurações › Padrões FV (`EmpresaConfig.fv_padroes.eficiencia_padrao`, **já existe**, commit `031ee4c`; o operador usa 75%, ex.: Natal 5,75 HSP → 129 kWh/kWp/mês).
  - O operador pode ajustar à mão por projeto (campo de perdas da etapa Dimensionamento, **já existe**).
  - **Lacuna:** `EtapaDimensionamento.salvar()` não grava a eficiência usada — `dimensionamento.performance_ratio` existe no schema e fica `null`. Gravar `performance_ratio` e a origem (configurado | manual | padrão do sistema). A proposta lê HSP + eficiência e exibe a premissa.
- **D2 · Pacote Forte Solar:** **decidido (2026-11-21)** — % configurável em Configurações sobre (kit + extra de estrutura), mais custos adicionais configuráveis. Extra por tipo de estrutura em R$/módulo (Solo 125, Laje configurável, telhados 0).
  - *Interpretação a confirmar:* custos adicionais (viagem, hospedagem…) **somam-se** ao valor do %, e não entram na base do %.
- **D3 · Geração existente / crédito GD:** **decidido (2026-11-21)** — só existe em **ampliação** (Cliente B). Usina nova (Cliente A) não tem bloco de geração existente nem crédito GD.
  - **Ampliação com projeto de origem no sistema:** `POST /api/projetos-fv/:id/ampliar` (**já existe**, `ampliarProjetoFV`) clona o projeto, herda fatura, consumo e localização, e congela a usina antiga em `arranjos[]` (`tipo: 'existente'`, `somente_leitura: true`) + arranjo `ampliacao`. A geração existente = kWp do arranjo existente × produtividade do local. O crédito GD da fatura aparece como conferência.
  - **Usina antiga feita fora do sistema:** o operador informa a potência existente (kWp) ou o crédito GD da fatura.
  - **Lacuna:** o botão "Ampliar" só existe na lista legada (`ProjetosFV.jsx`), que navega ao wizard legado. Falta no fluxo canônico (`/fv/projetos`).
- **D4 · Formato:** **decidido (2026-11-21)** — 8 páginas primeiro; 4 páginas é o resumo, gerado do mesmo view-model.
  - **Número de opções é variável: 1, 2, 3, 4 ou mais**, conforme a demanda (já suportado: `proposta_grupo_id` + `criarOpcao`). Paginação derivada da contagem, nunca fixa:
    - completa: 1 página por opção; com 1 opção só, a página de comparativo vira um quadro na própria página da opção;
    - resumida: 2 opções por página; o total de páginas varia (1 opção ≈ 3 págs.; 3-4 opções = 4 págs.; 5+ cresce).
  - A numeração de capítulos (condições = cap. N, monitoramento = cap. N+1) também é derivada.

---

## 7. Riscos e pendências fora deste escopo

- **UC canônica ausente do código** (`numero_unidade_consumidora` não existe em nenhum commit — ver memória de 15/11). A capa usa UC; resolver antes da Fase 3.
- **Catálogo de inversores**: lacuna de envelope MPPT e de `oversizing_max` (F2). Sem dado, a barra de capacidade e o diagrama saem como “não avaliado” — comportamento correto, mas o PDF fica com lacunas visíveis.
- **Dados reais de cliente** (Cliente B, Cliente A) não entram no repositório; fixtures anonimizadas.
