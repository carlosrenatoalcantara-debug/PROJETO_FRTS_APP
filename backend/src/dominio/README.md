# Domínio — Fundação Transversal (Fase 0)

Implementação dos conceitos estruturais da **ADR-021** (arquitetura congelada).
Esta pasta contém domínio puro: sem I/O, sem Express, sem Mongoose.

---

## Princípio de independência do Core

**O Core/SSOT é independente do legado.**

O modelo de domínio aqui implementado deriva exclusivamente da ADR-021. Ele
descreve como uma operação de engenharia **deve** funcionar — não como os dados
históricos existentes estão estruturados.

| Responsabilidade | Onde vive |
|---|---|
| Modelo canônico, agregados, baselines, invariantes | **Core** (esta pasta e os agregados) |
| Migração, normalização e reprocessamento histórico | **LME** |
| Dados importados de origens externas (ex.: SolarMarketing) | **LME** |

**Regras invioláveis:**

1. **Nenhuma decisão arquitetural do Core pode ser motivada por dados do
   SolarMarketing** — nem por qualquer outra origem legada. Formato de importação
   não é requisito de domínio.
2. **Nenhuma regra de legado é incorporada ao Core.** Se um dado histórico não
   couber no modelo canônico, o problema é do dado — resolve-se no LME, por
   normalização, nunca afrouxando o Core.
3. **O Core não conhece o LME.** A dependência é unidirecional: o LME conhece o
   modelo canônico e converte para ele. O inverso jamais.
4. Compatibilidade com o legado é obtida por **adaptadores de leitura** nas
   bordas, nunca por concessão no modelo.

O LME vive em `src/lme/` (ADR-022). O sentido da seta é verificado por check:
`node src/lme/__checks__/lme.check.js` falha se algum arquivo daqui importar de lá.

---

## Mapeamento conceitual (D-1)

| Arquitetura (ADR-021) | Implementação | Motivo |
|---|---|---|
| `Organização` (Tenant) | `empresa_id` | Consolidado em JWT, RBAC, models e índices. Renomear seria custo puro sem ganho funcional |

---

## Módulos

### `tenancy/` — Isolamento Organizacional (M-4)

**Responsabilidade:** ponto único de resolução e aplicação do escopo de organização.

| Elemento | Função |
|---|---|
| `TENANCY` | Classificação SSOT dos agregados (TENANT / GLOBAL / INFRAESTRUTURA) |
| `exigeTenant(model)` | O agregado exige isolamento? |
| `tenantDoReq(req)` | Extrai o tenant. Não lança |
| `exigirTenant(req)` | **Fail-closed** — lança `ErroTenantAusente` (403) |
| `aplicarEscopo(filtro, req)` | Filtro com escopo de organização |
| `carimbarTenant(dados, req)` | Carimba tenant em documento novo |

**Limites:**
- Não acessa banco, não conhece Mongoose, não conhece Express.

**Estado (Fase 0.5):** enforcement **aplicado**. `exigirOrganizacao` protege as
rotas que tocam Aggregate Roots TENANT; `aplicarEscopo`/`carimbarTenant` filtram
e carimbam nas consultas migradas. Cobertura por controller no relatório da fase.

**Dependências:** nenhuma.

---

### Classificação de agregados

| Categoria | Regra | Membros |
|---|---|---|
| **ESCOPO_TENANT** | Isolamento obrigatório. Dados de negócio da organização | ProjetoFV, ProjetoEV, Cliente, Local, Instalacao, UnidadeBeneficiaria, Lead, CrmLead, CrmFunil, CrmColuna, AtivoEquipamento, DocumentoTecnico, AlertaStatus, FaturaEnergia, Material, CategoriaMaterial, Tecnico, Vendedor, User |
| **GLOBAL** | Referência compartilhada entre organizações | Equipamento, CarregadorEV, Jurisdicao, DicionarioCanonico, AliasCampo, Empresa, EmpresaConfig |
| **INFRAESTRUTURA** | Sem semântica de negócio | ApiKey, AuditLog, Contador, BulkOperationLog, DatasheetCache, DatasheetProcessamento |

**Por que o Catálogo é GLOBAL:** ADR-021 A-8 — o equipamento é o mesmo em qualquer
organização e em qualquer país. O que varia é a **certificação por jurisdição**,
modelada separadamente (Fase 2). Isolar o catálogo por tenant duplicaria milhares
de registros idênticos.

---

## Agregado `Jurisdicao` (Contexto Regulatório)

**Responsabilidade:** território legal e convenções dele decorrentes.

| Contém | Natureza |
|---|---|
| país (ISO), nome | identidade |
| moeda, sistema de unidades, fuso, idioma | convenções (ADR-021 O-2/O-3) |
| subdivisões (UF/província) | composição |
| autoridades reguladoras | composição (vira AR próprio na Fase 2) |
| normas técnicas | composição |

**Fronteira:** a Jurisdição é o **país**. Subdivisões são internas — modelar cada
UF como jurisdição duplicaria moeda e normas nacionais 27 vezes.

**Tenancy:** GLOBAL.

**Limites:** nasce sem consumidores. Nenhum agregado a referencia.

**Fora do escopo (Fase 2):** Política Regulatória, Requisito Documental,
Regra de Validação, Agente de Conexão.

---

## Estado do enforcement (Fase 0.5)

| # | Item | Estado |
|---|---|---|
| 1 | RBAC fail-closed (anônimo → 401) | ✅ aplicado |
| 2 | `exigirOrganizacao` nas rotas TENANT | ✅ 15 rotas |
| 3 | Vazamento `$or:[{empresa_id},{empresa_id:null}]` | ✅ removido |
| 4 | Escopo nas consultas por controller | 🔄 parcial — ver relatório da fase |
| 5 | Backfill de `empresa_id` | ⛔ **LME** (fora do Core) |

**Consequência aceita:** com fail-closed ativo e sem backfill, registros com
`empresa_id: null` não são alcançáveis pelo Core. Isso é deliberado — dados
legados são responsabilidade do LME, não do Core. Tokens sem `empresa_id` são
rejeitados (403); compatibilidade com credenciais legadas não é implementada aqui.
