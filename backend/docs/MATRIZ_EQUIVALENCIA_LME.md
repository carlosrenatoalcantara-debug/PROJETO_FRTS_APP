# Matriz de Equivalência — SolarMarket → Canônico → Forte Solar

**LME · ADR-022** · derivada do código, não de suposição. Toda linha cita origem.
Fontes: `src/integracoes/solarmarket/{extractor,normalizer,semantic_aliases}.js`,
`src/models/{Equipamento,ProjetoFV}.js`.

**Status:** `MAPEADO` (mesmo nome e semântica) · `RENOMEADO` (existe, outro nome/forma/unidade) ·
`NOVO` (Forte Solar sem origem SM) · `DESCARTADO` (SM sem destino canônico).

---

## Bloco A — Catálogo: line item SM → `Equipamento`

Único caminho **wired** (roda em produção). `extractor.js:290-298` → `normalizer.js:254` → `Equipamento`.

| Campo SolarMarket | Campo Canônico | Campo Forte Solar | Status | Justificativa |
|---|---|---|---|---|
| `marca` | fabricante | `fabricante` | MAPEADO | Ausente → inferido do nome por lista de 30 marcas (`normalizer.js:396`). Sem fabricante o item é descartado |
| `modelo` → `nome` → `sku`/`codigo`/`code`/`part_number` | modelo | `modelo` | RENOMEADO | Cascata de 4 fallbacks; o modelo raramente vem limpo do SM |
| `categoria` + `nome` + `_sm_raw.{category,subcategory,type}` | tipo | `tipo` | RENOMEADO | Não existe campo de tipo no SM: inferido por regex (`TIPO_MAP`, `normalizer.js:39`). Fallback `'modulo'` porque o schema exige |
| `_sm_raw.{power_w,power,potencia_w,potencia,watt,watts,wp,peak_power}` | potência | `especificacoes.potencia_w` + `.potencia_pico` (módulo) / `.potencia_kw` + `.potencia_nominal` (inversor) | RENOMEADO | Unidade não vem declarada — inferida por magnitude. **Ver R-1** |
| `nome`/`modelo`/`description` (regex `550W`, `5kW`) | potência | idem | RENOMEADO | Último recurso: extrai potência do texto livre |
| `_sm_raw.{efficiency,eficiencia}` | eficiencia | `especificacoes.eficiencia` | MAPEADO | — |
| `_sm_raw.{cells,celulas}` | celulas | `especificacoes.celulas` | MAPEADO | — |
| `_sm_raw.{cell_type,tipo_celula}` | tipo_celula | `especificacoes.tipo_celula` | MAPEADO | — |
| `_sm_raw.{voc,open_circuit_voltage}` | voc | `especificacoes.voc` | MAPEADO | Sem validação numérica — entra como veio |
| `_sm_raw.{isc,short_circuit_current}` | isc | `especificacoes.isc` | MAPEADO | idem |
| `_sm_raw.{mppt,num_mppt}` | mppt | `especificacoes.mppt` | MAPEADO | **Contagem**, não envelope. Não preenche `entradas_por_mppt` (lacuna já conhecida do catálogo) |
| `_sm_raw.{phases,fases}` | fases | `especificacoes.fases` | MAPEADO | — |
| `_sm_raw.{output_voltage,tensao_saida}` | tensao_saida | `especificacoes.tensao_saida` | MAPEADO | — |
| `_sm_raw.{weight,peso}` | peso_kg | `especificacoes.peso_kg` | RENOMEADO | Sufixo `_kg` **assumido**; SM não declara unidade. **Ver R-2** |
| `_sm_raw.{dimensions,dimensoes}` | dimensoes | `especificacoes.dimensoes` | MAPEADO | String livre, sem parse |
| `_sm_raw.{ip_rating,ip}` | ip | `especificacoes.ip` | MAPEADO | — |
| `_sm_raw.{warranty,garantia,warranty_years}` | garantia | `especificacoes.garantia_produto` | RENOMEADO | Cai em `especificacoes` (Mixed), **não** no campo tipado `garantia_produto {value,unit}`. **Ver R-3** |
| `preco_unitario` ou `preco_total / quantidade` | preco | `preco_sugerido` | RENOMEADO | Só grava se > 0; arredonda 2 casas |
| — (derivado) | hash_unico | `identificacao.hash_unico` | NOVO | Chave de idempotência: hash(fabricante_norm + modelo_norm) |
| — (derivado) | fabricante/modelo normalizados | `identificacao.{fabricante_normalizado,modelo_normalizado}` | NOVO | Base do matching |
| — (constante) | origem | `origem.tipo='import_solarmarket'`, `origem.fonte='solarmarket_api_v2'` | NOVO | Proveniência exigida pelo catálogo |
| `quantidade` | — | — | DESCARTADO | Quantidade é do orçamento, não do catálogo. Catálogo é `GLOBAL` |
| `preco_total` | — | — | DESCARTADO | Derivável de `preco_unitario × quantidade` |
| `_sm_proposta_id`, `_sm_item_id` | — | — | DESCARTADO | Fica só em `meta` da normalização; **não** persiste no `Equipamento`. **Ver R-4** |
| itens que casam `SKIP_REGEX` (serviço, instalação, mão de obra, frete, desconto, taxa, garantia estendida) | — | — | DESCARTADO | Não são equipamento (`normalizer.js:53`) |

---

## Bloco B — Proposta SM → `ProjetoFV` v3

`semantic_aliases.js` define **18 chaves canônicas / 199 aliases** indexados
(`estatisticasAliasIndex()`, verificado em execução).
⚠ **Nenhum consumidor:** `normalizarVariables` não está wired em nenhum controller —
o mapeamento existe, mas nada grava em `ProjetoFV` hoje.

| Campo SolarMarket (aliases) | Campo Canônico | Campo Forte Solar | Status | Justificativa |
|---|---|---|---|---|
| `geracaoMensal`, `v_geracao_estimada`, `energiaPrevista`, +18 | `geracao_mensal_kwh` | `dimensionamento.geracao_mensal_kwh` (+ flat legado `geracao_mensal_kwh`) | MAPEADO | Nome idêntico; campo mais crítico do ProjetoFV |
| `consumo_medio`, `v_consumo`, `consumoKwh`, +12 | `consumo_mensal_kwh` | `unidades_consumidoras[].consumo_mensal_kwh` | MAPEADO | **Cardinalidade divergente:** SM é escalar, Forte Solar é por UC. Exige decisão de rateio na normalização |
| `potencia_kwp`, `v_potencia`, `kwp`, +10 | `potencia_instalada_kwp` | `dimensionamento.potencia_kwp` | RENOMEADO | Prefixo `instalada` não existe no destino |
| `qtd_modulos`, `paineis`, `panels`, +10 | `num_modulos` | `dimensionamento.num_paineis` | RENOMEADO | Domínio usa *painel*, o SM usa *módulo* |
| `potencia_painel`, `wp_modulo`, `wp`, +7 | `potencia_modulo_wp` | `equipamentos.paineis[].potencia_w` | RENOMEADO | Não há campo agregado em `dimensionamento`: a potência unitária vive no item de equipamento |
| `qtd_inversores`, `inverters`, +7 | `num_inversores` | `dimensionamento.num_inversores` | MAPEADO | — |
| `potencia_inversor`, `kw_inversor`, +4 | `potencia_inversor_kw` | `arranjos[].dimensionamento.potencia_inversor_kw` | RENOMEADO | Por arranjo no destino, escalar na origem |
| `pricingTable.custo`, `valor_kit`, `custo_equipamentos`, +7 | `custo_kit` | `orcamento.custo_equipamentos_r` (ou `orcamento.kit.valor_kit_r`) | RENOMEADO | Sufixo `_r` (reais) é convenção do destino; **dois destinos possíveis** conforme `orcamento.modo` (`kit` \| `detalhado`) |
| `valor_instalacao`, `custo_mao_obra`, `labor_cost`, +7 | `custo_instalacao` | `orcamento.custo_mao_obra_r` | RENOMEADO | Alias `instalacao`/`servico` é genérico demais — risco de captura errada |
| `valor_total`, `total`, `valor_proposta`, +7 | `custo_total` | `orcamento.custo_total_r` | RENOMEADO | Alias `total` é o mais genérico do mapa |
| `irradiacao`, `hsp`, `horas_sol_pico`, +8 | `irradiacao_local` | `irradiancia_local` | RENOMEADO | **irradiação ≠ irradiância** e a unidade diverge. **Ver R-5** |
| `area_telhado`, `area_necessaria`, `roof_area`, +7 | `area_necessaria_m2` | `dimensionamento.area_total_m2` / `layout_solar.area_util_m2` / `telhado.area_m2` | RENOMEADO | **Três destinos com semânticas distintas** (necessária ≠ útil ≠ bruta). Exige decisão explícita |
| `payback`, `roi_anos`, `tempo_retorno`, +6 | `payback_anos` | `orcamento.payback_anos` | MAPEADO | — |
| `economiaAnual`, `economia_kwh`, `economia_mensal`, +6 | `economia_anual` | `orcamento.economia_anual_r` | RENOMEADO | **Mistura unidade e período no mesmo canônico. Ver R-6** |
| `co2_evitado`, `carbono_evitado`, +8 | `co2_evitado_ton` | `orcamento.co2_evitado_t` | RENOMEADO | Mesma unidade, abreviação diferente |
| `tarifa`, `preco_kwh`, `valor_kwh`, +5 | `tarifa_kwh` | `orcamento.tarifa_kwh` (+ `unidades_consumidoras[].tarifa_media`) | MAPEADO | Dois destinos: global e por UC |
| `city`, `municipio`, `localidade`, `v_cidade` | `cidade` | `localizacao.cidade` | MAPEADO | — |
| `estado`, `uf`, `state`, `v_estado` | `estado_uf` | `localizacao.estado` | RENOMEADO | — |
| qualquer chave sem alias | `unmapped_<chave>` | — | DESCARTADO | Preservada com prefixo para triagem (`variablesNormalizer.js:114`), mas não persiste em lugar nenhum. É o **gap declarado** do legado |

---

## Bloco C — Forte Solar sem origem SM (`NOVO`)

O SM não tem equivalente; nascem no Core ou em motores próprios.

| Campo Forte Solar | Justificativa |
|---|---|
| `qualidade.*` (score, nível, alertas, campos_faltantes) | Motor de qualidade do catálogo; avalia o dado **depois** de importado |
| `status_operacional.*`, `utilizavel_em_projeto`, `bloqueio_engenharia` | Governança de engenharia: o SM não sabe se o equipamento pode entrar num projeto |
| `aprovacao_tecnica.*` | Workflow de aprovação (rascunho→pendente→aprovado→bloqueado) |
| `certificacao.inmetro`, `certificacao.normas_iec` | Certificação por jurisdição (ADR-021, Fase 2) |
| `documentos_tecnicos[]`, `datasheet_original`, `datasheet_url` | Biblioteca documental própria |
| `specs_canonicas`, `fonte_dados` | Especificação canônica e proveniência por campo |
| `garantia_produto{value,unit}`, `garantia_performance{value,unit}` | Garantia tipada com unidade; SM manda número solto |
| `suporte.*` | Contato do fabricante |
| `validacao.historico[]` | Trilha de auditoria |
| `empresa_id` | Não se aplica ao catálogo (`Equipamento` é **GLOBAL**, ADR-021 A-8) |
| `dimensionamento.{num_strings,performance_ratio,fator_capacidade}` | Saída do motor de dimensionamento, não da proposta |
| `orcamento.{margem_pct,preco_venda_r,irr_pct,npv_r,economia_25anos_r,reajuste_anual_pct}` | Motor financeiro próprio |
| `protecoes`, `engenharia_eletrica`, `unifilar`, `governanca`, `comercial` | Disciplinas que o SM não modela |
| `Instalacao` (Gerador/MPPT/String) | Topologia real; o SM só tem contagens |

---

## Bloco D — Entidades inteiras descartadas

Declarado em `integracoes/solarmarket/index.js:11-15` e confirmado em `docs/SOLARMARKET_MIGRATION_AUDIT.md`.

| Entidade SM | Status | Justificativa |
|---|---|---|
| Clientes | DESCARTADO | Sem importador; `Cliente` existe como destino, nunca alimentado pelo SM |
| Projetos / Propostas | DESCARTADO | `buscarPropostas` lê **só para minerar equipamento**; coleção `propostas` = 0 |
| CRM (funil, colunas, leads) | DESCARTADO | Forte Solar tem CRM próprio |
| Documentos / Datasheets | DESCARTADO | Biblioteca documental própria (`DocumentoTecnico`, `DatasheetCache`) |
| Usuários / histórico | DESCARTADO | Fora do domínio |
| Baterias | — | Não existem no ETL **nem** no catálogo (0 registros) — lacuna, não descarte |

---

## Riscos detectados na matriz

| # | Risco | Onde | Impacto |
|---|---|---|---|
| **R-1** | Unidade da potência inferida por magnitude: `n < 20 → kW`, senão W (`normalizer.js:171`). Inversor de **25 kW** vira `25 W` → `potencia_kw = 0.03` | `extrairPotenciaW` | **Alto** — corrompe dimensionamento de inversores ≥ 20 kW |
| **R-2** | `weight` gravado como `peso_kg` sem o SM declarar unidade | `extrairEspecificacoes` | Baixo — peso não entra em cálculo elétrico |
| **R-3** | Garantia cai em `especificacoes.garantia_produto` (Mixed) e não no campo tipado `garantia_produto{value,unit}` | `extrairEspecificacoes` | Médio — garantia importada fica invisível para quem lê o campo tipado |
| **R-4** | `sm_proposta_id`/`sm_item_id` não persistem no documento: perde-se o vínculo com a origem | `normalizer.js:335` | Médio — impede reconciliação futura; o ledger do LME mitiga só a partir de agora |
| **R-5** | `irradiacao_local` (hsp, kWh/m²/**dia**) → `irradiancia_local` (default **131.44**, comentado como kWh/kWp/dia mas com magnitude mensal) | `ProjetoFV.js:646` | **Alto** — fator ~30× em geração estimada se mapeado direto |
| **R-6** | `economia_anual` agrega aliases de **energia** (`economia_kwh`, `savings_kwh`), de **reais** (`economia_reais`) e de **mês** (`economia_mensal`) | `semantic_aliases.js:231` | **Alto** — valor final pode ser kWh, R$/mês ou R$/ano indistinguíveis |
| **R-7** | Aliases genéricos (`total`, `area`, `instalacao`, `servico`, `consumo`, `geracao`) capturam campos alheios | `semantic_aliases.js` | Médio — mitigado só pela detecção de colisão no build do índice |

**Nenhum destes riscos é resolvido afrouxando o Core** (ADR-021, regra 2): todos se
resolvem na normalização do LME. R-1, R-5 e R-6 exigem **conversão explícita com
unidade declarada** antes de qualquer backfill.

---

## Pendente

1. Versão máquina desta matriz (`matriz_equivalencia.json`) consumida pelo normalizador — hoje o mapa vive espalhado em 3 arquivos.
2. Correção de R-1, R-5, R-6 antes de qualquer execução com `dryRun: false`.
3. Decisão de rateio para `consumo_mensal_kwh` (escalar SM → array de UCs).
4. Decisão de destino para `area_necessaria_m2` (3 candidatos).
