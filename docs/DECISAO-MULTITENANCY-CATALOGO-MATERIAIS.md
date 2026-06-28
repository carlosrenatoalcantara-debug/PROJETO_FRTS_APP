# Decisão Arquitetural — Catálogo Mestre de Materiais

Status: **Aprovado** · Fase 1 (P0-CATALOGO-MESTRE-MATERIAIS) · Data: 2026-06-28

Este documento registra formalmente duas decisões e uma dívida técnica monitorada,
conforme solicitado na aprovação da Fase 1.

---

## 1. Multi-tenancy — `empresa_id` permanece no modelo

### Decisão
O modelo `Material` (e `CategoriaMaterial`) carrega o campo **`empresa_id`**
(`ObjectId, ref 'Empresa', default null`), com índice único composto
`{ empresa_id, chaveCanonica }` (resp. `{ empresa_id, chave }`).

### Justificativa arquitetural (banco compartilhado)
A plataforma Forte Solar usa **um único banco MongoDB compartilhado** (uma `MONGODB_URI`),
com **tenancy por linha** via `empresa_id`. Evidências no código:

- Convenção `empresa_id` (snake_case, `ref Empresa`, `default null`) já presente em
  `ProjetoFV`, `User`, `Tecnico`, `Vendedor`, `FaturaEnergia`.
- O JWT carrega `empresa_id`, exposto em `req.auth.empresa_id` pelo middleware global
  `decodificarUsuario` (`middleware/rbacMiddleware.js`).
- Não há isolamento por banco/conexão por empresa — é um único cluster.

Como o catálogo é **SSOT compartilhado por todos os módulos**, e preço/estoque são
**por empresa**, manter `empresa_id` desde já:

- alinha-se à convenção estabelecida da plataforma (zero divergência de padrão);
- evita um retrofit caro quando o particionamento por empresa for efetivamente ativado;
- custa um único campo que espelha modelos existentes (não é abstração nova).

Hoje `empresa_id` é tipicamente `null` (tenant "default"), exatamente como nos demais
modelos — o campo está pronto para o particionamento sem alterar o schema.

### Gatilho de reavaliação
Se a plataforma **migrar para um banco por empresa** (DB-per-tenant), `empresa_id`
torna-se redundante e **deve ser reavaliado/removido** antes da expansão do catálogo.
Enquanto o modelo for de banco compartilhado, o campo permanece.

---

## 2. `CategoriaMaterial` como entidade própria (estrutura, sem conteúdo)

### Decisão
Criada a entidade `CategoriaMaterial` (`models/CategoriaMaterial.js`) — **apenas a
estrutura**, sem nenhum registro e sem seed.

`Material.categoria` permanece como **String** e funciona como **referência por chave
natural (slug)** a `CategoriaMaterial.chave`.

### Justificativa
- **Evita migração futura** `categoria:String → relacionamento`: o valor já gravado em
  `Material.categoria` é exatamente a `chave` da categoria. Popular a taxonomia depois
  não altera nenhum documento de `Material`.
- **Não acopla conteúdo à infraestrutura**: materiais continuam podendo ser criados com
  o catálogo de categorias vazio (categorias são conteúdo da Fase 2).
- **Coerência**: mesmo padrão de vocabulário controlado por chave natural já usado em
  `DicionarioCanonico` (especificações EAV).
- A enforcement `Material.categoria ∈ CategoriaMaterial.chave` fica para a **Fase 2**
  (quando a taxonomia for populada), análoga à validação de especificações.

---

## 3. Dívida técnica monitorada — busca por regex

A busca textual (`GET /api/materiais?q=`) usa **regex case-insensitive** sobre
`descricao` + `aliases` (`controllers/materiaisController.js`).

- **Monitorar**: quando o catálogo crescer significativamente, substituir por um
  **índice dedicado** (text index do MongoDB ou Atlas Search) para preservar performance.
- **Não otimizar agora** (decisão aprovada): o volume atual não justifica, e regex cobre
  buscas por substring (ex.: `q=10mm`) que o `$text` não atende bem.
