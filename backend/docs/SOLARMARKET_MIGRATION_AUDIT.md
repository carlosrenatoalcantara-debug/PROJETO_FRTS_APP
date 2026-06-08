# P0-SOLARMARKET-MIGRATION-AUDIT-01 — Auditoria de migração (read-only)

> **100% read-only.** Sem alterar código/Atlas/SolarMarket; sem importações. Mapeia o que a
> integração suporta hoje e o gap para o Forte Solar substituir o SolarMarket (SM).

## FASE 1 — Inventário (o que a integração realmente cobre)

A integração SM no código é declaradamente **auxiliar e só de catálogo** (`integracoes/solarmarket/
index.js`: *"NÃO sincroniza: clientes, projetos, propostas, CRM, webhooks. O que importamos:
fabricantes, modelos, kits, nomenclaturas, preços de referência."*).

| Entidade | Suporte no código | Observação |
|---|---|---|
| **Equipamentos / Módulos / Inversores** | **ETL completo** | extractor→normalizer→matcher→dedup→importer → `Equipamento` (origem `import_solarmarket`) |
| Estruturas, kits, preços de referência | Importador | `importadorSolarMarket` (admin) + produtos/kits da API |
| **Baterias** | ❌ ausente | não há `tipo: bateria` no catálogo |
| **Carregadores EV** | parcial | há `CarregadorEV`/`tipo: carregador_ev` no Atlas, **mas não vêm do ETL SM** |
| **Clientes** | ❌ não sincronizado | sem importador (modelo `Cliente` existe como destino) |
| **Projetos** | ⚠ só utilitário | `variablesNormalizer` mapeia proposta SM→`ProjetoFV` canônico, **não wired** |
| **Orçamentos / Propostas** | ⚠ só leitura | `buscarPropostas` lê (para minerar equipamento); coleção `propostas` = **0** |
| **Documentos / Datasheets** | ❌ não migrado | app tem `DocumentoTecnico`/`DatasheetCache` próprios |
| **Histórico / Usuários / Fluxos comerciais (CRM)** | ❌ não migrado | Forte Solar tem CRM próprio (`CrmFunil/CrmColuna/CrmLead`, `Vendedor`) |

**API SM:** cliente real para `business.solarmarket.com.br/api/v2` (auth + propostas + produtos/
kits) — **requer `SOLARMARKET_API_KEY`** (não configurada → não é possível enumerar o SM real aqui).

## FASE 2 — Equipamentos (Atlas atual)

| Tipo | Qtde no Atlas | Status de migração |
|---|---|---|
| Módulos | **56** | catálogo presente |
| Inversores | **41** | catálogo presente |
| Carregadores EV | **16** | presente |
| **Baterias** | **0** | **não migrado** (tipo inexistente) |

**Proveniência:** `origem.tipo` = **94 desconhecido + 19 manual + 0 `import_solarmarket`** → o
catálogo atual **NÃO veio do ETL SM** (entrada manual/seed). Ou seja: **"já migrado via SM" = 0**;
o ETL existe e é **capaz**, mas não foi a fonte do catálogo atual. (Sem API key não dá para
comparar com o inventário real do SM.)

## FASE 3 — Clientes

`Cliente` existe como destino (7 clientes próprios no Atlas). **Migração direta:** nome, CPF/CNPJ,
contato, endereço (mapeamento 1:1). **Com transformação:** vínculo a UC/concessionária, normalização
de telefone/CEP. **Não suportado hoje:** **não existe importador de clientes do SM** → 0 automático.

## FASE 4 — Projetos

`variablesNormalizer` + `SEMANTIC_ALIASES` já mapeiam variáveis de proposta SM → canônico
`ProjetoFV` (`consumo_mensal_kwh`, `geracao_mensal_kwh`, potência, etc.). **Dependências:**
- equipamentos: resolvidos pelo `matcher` (catálogo) + vínculo `equipamento_id` (já implementado);
- UC/localização/rateio: precisam de mapeamento adicional;
- **memorial/parecer: gerados pelo Forte Solar** (não vêm do SM).
→ **Capacidade existe (utilitário), mas o fluxo de persistência de projeto não está wired.**

## FASE 5 — Orçamentos e Propostas

Coleção `propostas` = **0**. O extractor **lê** propostas só para minerar equipamento. **Não há
importação de:** composição de preço, desconto, margem, geração estimada persistida, anexos.
**Reaproveitamento atual: baixo** (apenas o mapeamento semântico de variáveis é reutilizável).

## FASE 6 — Documentos

PDFs/propostas/datasheets/imagens do SM **não são migrados**. O Forte Solar tem pipeline próprio
(`DocumentoTecnico`, `DatasheetCache`, `documentOCRService`, upload de datasheet). **Onde ficariam:**
datasheets→`DatasheetCache`/`DocumentoTecnico`; propostas/anexos→storage do projeto. **Migráveis?**
Sim, **quando houver importador** (não existe hoje).

## FASE 7 — GAP Analysis

| Prioridade | Gap | Impacto |
|---|---|---|
| **P0 (bloqueador)** | Sem importador de **clientes/projetos/orçamentos/propostas/documentos** do SM | o **histórico comercial** não migra |
| **P0 (bloqueador)** | **API key SM não configurada** | impossível **enumerar/dimensionar** o SM real |
| **P1 (importante)** | Catálogo sem proveniência SM (origem desconhecido) + **baterias ausentes** | rastreabilidade/cobertura |
| **P1 (importante)** | `variablesNormalizer` não wired a um fluxo de criação de projeto | capacidade ociosa |
| **P2 (desejável)** | Migração de documentos/anexos + sync automatizado de preço/kit | conveniência |

## FASE 8 — Plano de migração (roadmap)

| Fase | Escopo | Esforço | Risco | Dependências |
|---|---|---|---|---|
| **Fase 1 — Inventário live** | Configurar `SOLARMARKET_API_KEY`; enumerar clientes/projetos/propostas/produtos reais do SM | **Baixo** | Baixo | API key |
| **Fase 2 — Catálogo + Clientes** | Rodar/validar ETL de catálogo (já existe, com dedup) marcando origem; importador de **clientes** (modelo pronto) | **Médio** | Baixo | Fase 1 |
| **Fase 3 — Projetos + Propostas + Docs** | Importador de projetos (via `variablesNormalizer` + `matcher` + `equipamento_id`), propostas/preços e documentos/anexos | **Alto** | Médio | Fases 1–2; mapeamento semântico de UC/rateio |

## FASE 9 — Respostas finais

1. **O Forte Solar já substitui o SolarMarket hoje?** **Para operação NOVA, sim** — é um sistema
   completo (CRM, clientes, projetos FV/EV, catálogo, UC/rateio, parecer/memorial, técnicos,
   usuários), **autossuficiente em runtime**. **Para o HISTÓRICO que vive no SM SaaS, não** (sem
   importador de clientes/projetos/propostas/documentos).
2. **O que ainda depende do SolarMarket?** **Nada em runtime** (a app não chama o SM em operação;
   o catálogo atual nem veio do SM). A dependência é o **acervo histórico comercial** no SM
   externo + a **referência de preços/kits**.
3. **Qual o maior bloqueador?** **P0** — ausência de importadores de clientes/projetos/propostas/
   documentos **e** API key não configurada (sem ela não se enumera/dimensiona o SM).
4. **Quantos dados migram automaticamente?** **Catálogo de equipamentos** (capacidade via ETL
   existente, com dedup). **Clientes/projetos/propostas/documentos = 0 automático hoje.**
5. **Quantos exigem intervenção manual?** **Todo o histórico comercial** (clientes, projetos,
   orçamentos, propostas, documentos) — hoje 100% manual por falta de importador.
6. **Qual o esforço para desligar o SolarMarket?** **Operação nova: ~0** (já pronto). **Histórico:
   médio-alto** — ~3 sprints (inventário live → catálogo+clientes → projetos+propostas+docs),
   dependente da API key e do mapeamento semântico de UC/rateio.
7. **Próxima sprint recomendada?** **P0-SOLARMARKET-LIVE-INVENTORY-01** — configurar a API key e
   **enumerar o SM real** (volumes de clientes/projetos/propostas/produtos). Sem esse inventário
   não é possível dimensionar o esforço das fases 2–3.

### Conclusão
No código, o SolarMarket é apenas um **ETL auxiliar de catálogo** — o Forte Solar é um sistema
**completo e autossuficiente** para operação nova. O bloqueio ao desligamento total não é técnico
de runtime, e sim a **migração do acervo histórico** (clientes/projetos/propostas/documentos), para
a qual **não há importador** e **falta API key** para sequer dimensionar. Recomenda-se começar pelo
**inventário live**. Nenhuma alteração foi feita (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Auditoria de Migração SolarMarket → Forte Solar

A auditoria apresenta um diagnóstico claro e conciso da situação atual da integração entre SolarMarket e Forte Solar, focando na capacidade de substituição e migração de dados. A abordagem "read-only" é apropriada para uma auditoria inicial.

**Avaliação dos Pontos:**

1.  **Distinção "substituir para operação nova" vs. "migrar histórico":**
    *   **Correção e Honestidade:** **Sim, a distinção é correta e honesta.** O relatório deixa explícito que o Forte Solar é autossuficiente para novas operações, mas a migração do histórico é um desafio significativo devido à falta de importadores. A clareza sobre o que pode ser "substituído" (funcionalidade de runtime) e o que não pode (histórico de dados) é crucial e bem comunicada.

2.  **Metodologia (ler código + contar Atlas + checar origem/proveniência + checar wiring):**
    *   **Solidez:** **Sim, a metodologia é sólida e abrangente para uma auditoria inicial.** A combinação de análise de código (para entender a funcionalidade declarada), inspeção de dados (Atlas) e verificação de fluxos (wiring) fornece uma visão holística. A checagem de origem/proveniência é particularmente importante para entender o estado atual do catálogo.

3.  **Classificação P0/P1/P2 e Roadmap:**
    *   **Adequação:** **Sim, a classificação e o roadmap são adequados.**
        *   **P0:** Os bloqueadores identificados (falta de importadores e API key) são corretamente classificados como P0, pois impedem a migração do histórico e a compreensão do escopo real.
        *   **P1/P2:** As demais lacunas são logicamente priorizadas.
        *   **Roadmap:** A divisão em fases é lógica e progressiva, começando pela obtenção de informações essenciais (inventário live) antes de abordar a migração de dados mais complexos.

4.  **Algo importante deixado passar?**
    *   **Potencialmente:** Embora a auditoria foque nos aspectos de migração e substituição, um ponto a considerar seria a **análise de risco de negócio** associada à não migração do histórico. Por exemplo, quais são as implicações de perder dados de clientes, projetos e propostas passadas para a tomada de decisões futuras, relatórios ou conformidade? Isso pode influenciar a priorização ou o investimento na migração do histórico. No entanto, para uma auditoria técnica inicial, o escopo está bem definido.

5.  **Recomendação de começar pelo inventário live (API key):**
    *   **Certeza:** **Sim, esta é a recomendação certa.** Sem entender o volume e a natureza dos dados existentes no SolarMarket real (através da API), qualquer planejamento de migração de histórico seria baseado em suposições. A API key é o primeiro passo para obter visibilidade e dimensionar o esforço.

6.  **Veredito:**
    *   **APROVADO COM RESSALVAS.**

**Justificativa do Veredito:**

A auditoria é **aprovada** pela sua clareza, metodologia sólida e conclusões bem fundamentadas. A distinção entre substituição para operação nova e migração de histórico é um ponto forte.

As **ressalvas** surgem da necessidade de considerar o impacto de negócio da não migração do histórico (ponto 4) e da necessidade de um plano mais detalhado para as fases de migração de dados, que, embora delineadas, exigirão um esforço considerável (estimado em ~3 sprints). A auditoria identifica corretamente os bloqueadores, mas a execução da migração do histórico será um projeto complexo que exigirá planejamento detalhado e recursos.

**Recomendações Adicionais:**

*   **Análise de Impacto de Negócio:** Realizar uma análise mais aprofundada sobre o valor e o risco de não migrar o histórico de dados do SolarMarket.
*   **Detalhamento das Fases de Migração:** Para as fases 2 e 3 do roadmap, detalhar os requisitos técnicos e funcionais específicos para cada importador (clientes, projetos, propostas, documentos).
*   **Estratégia de Dados Legados:** Definir uma estratégia clara para o que fazer com os dados que não forem migrados (arquivamento, acesso limitado, etc.).

Em suma, a auditoria fornece uma base excelente para os próximos passos, com um foco acertado nos bloqueadores imediatos.
