# ASSET CORE — Relatório de Migração Controlada (Piloto)

> FASE 6 — geração de ativos para projetos reais, validada quanto a quantidade, vínculo,
> arranjo e topologia. Operação **aditiva** (coleção `ativos_equipamento` nova).

## Piloto executado

| Projeto (Atlas) | projeto_id | Ativos | Por tipo | Arranjos | Topologia |
|---|---|---|---|---|---|
| 207 - Paulo Carlos de Andrade Filho | `6a2aa1c8…396a` | 2 | modulo:1, inversor:1 | 1 | string |
| 197 - Escola Pinheiros | `6a2aa1c9…396e` | 2 | modulo:1, inversor:1 | 1 | string |
| 132.1 - Fazenda Alice | `6a2aa1bc…38aa` | 2 | modulo:1, inversor:1 | 1 | string |
| **Total** | | **6** | **modulo:3, inversor:3** | | |

Estado final dos 6 ativos: `status=planejado`, cada um com `qr_code` único, `projeto_id`,
`arranjo_id` e `historico:[{tipo:'criacao'}]`. Nenhuma mutação de teste persistida (o CRUD de
verificação foi limpo e os pilotos regenerados).

## Validações

| Verificação | Resultado |
|---|---|
| Quantidade coerente com o projeto | ✅ (1 módulo agregado + 1 inversor por projeto legado) |
| Vínculo `projeto_id` / `equipamento_id` / `cliente_id` | ✅ |
| `arranjo_id` preenchido (multiarranjo-ready) | ✅ |
| Topologia inferida | ✅ (string) |
| Idempotência (regerar não duplica) | ✅ (0 criados na 2ª execução) |
| QR único e imutável | ✅ (`FORTE-MOD-*`, `FORTE-INV-*`) |

## Por que cada piloto gerou 2 ativos

Os 3 projetos-piloto reais estão no **formato legado single-arranjo** (`equipamentos.inversor`).
O adaptador `normalizarArranjos` deriva **1 arranjo principal**, e a regra de agregação de
módulos produz **1 ativo módulo (quantidade=N) + 1 ativo inversor**. Quando esses projetos
forem editados na UI de arranjos (multiarranjo real), uma nova execução de `gerarAtivosProjeto`
acrescenta os ativos dos novos arranjos **sem duplicar** os já existentes (idempotência por
`chave_origem`).

## Estratégia de migração (sem big-bang)

- **Geração sob demanda**, projeto a projeto, via `POST /api/ativos/gerar/:projetoId`.
- **Idempotente** — pode ser re-executada com segurança a qualquer momento.
- **Reversível** — `ativos_equipamento` é coleção isolada; remover não afeta projetos/catálogo.
- **`dry_run`** disponível (`?dry_run=1`) para prever a geração sem persistir.

## Reversibilidade

Excluir a coleção `ativos_equipamento` (ou os ativos de um projeto) **não** corrompe nada:
`ProjetoFV` e Atlas permanecem a fonte de verdade do as-specified; os ativos são uma camada
as-built sobreposta.
