# E7_COMPONENT_MAP.md

**Sprint:** P0-E7-FINAL-UX-CONSOLIDATION-01 — FASE 0 (obrigatória, antes de codificar)
**Data:** 2026-06-20 · **Decisão:** CAMINHO A (unificação visual, persistência intacta)

## Mapa de componentes do E7

| Componente | Função | Usado por | Legado? | Remover? | Substituir por? |
|---|---|---|---|---|---|
| `etapas/E7Equipamentos.jsx` | Orquestrador da etapa E7 | Wizard FV | Não | Não | — (reorganizar internamente) |
| `SeletorPaineis.jsx` | Seleção de módulo (Arranjo A) | E7Equipamentos | Não | Não | mantido (fonte: catálogo Mongo) |
| `SeletorInversores.jsx` | Seleção de inversor (Arranjo A) | E7Equipamentos | Não | Não | mantido |
| `SeletorEstrutura.jsx` | Seleção de estrutura (Arranjo A) | E7Equipamentos | Não | Não | mantido |
| `ConfiguradorArranjoFV.jsx` | Config. elétrica + persistência `engenharia_eletrica` (Arranjo A) | E7Equipamentos | **Parcial** (visual legado) | **Não** (mantém por baixo — Caminho A) | apenas REPOSICIONAR (após inversor) |
| `GerenciadorArranjos.jsx` | Cards multiarranjo B/C/D (Módulo/Arquitetura/Inversor/Config/Estrutura/Fornecedor/Orçamento/Resumo) | E7Equipamentos | Não | Não | será a **referência visual** |
| `ResumoTecnicoArranjo.jsx` | Resumo técnico (P CC/CA, oversizing, MPPT, alocação) | E7 (A) + GerenciadorArranjos (B/C/D) | Não | Não | mantido (compartilhado) |
| `TopologiaMPPTEditor.jsx` | Editor entradas/strings por arranjo | ConfiguradorArranjoFV + GerenciadorArranjos | Não | Não | mantido |
| `SugestaoTopologiaReferencia.jsx` | Sugestão COSERN (card recolhido) | E7Equipamentos | Não | Não | mantido |
| `data/catalogoEletrico.js` | `dadosEletricosPainel/Inversor` (mapa estático por id) | ConfiguradorArranjoFV | **SIM (raiz do bug "não mapeados")** | Não | **corrigir** (fallback p/ specs inline do catálogo) |
| `utils/catalogoEngenhariaAdapter.js` | `adaptarModulo/Inversor` (Mongo → shape E7) | Seletores | Não | Não | mantido |
| `utils/agregarArranjosFV.js` | Agregação fonte única (E7→E8) + resumo técnico | E8 + ResumoTecnico | Não | Não | mantido |

## Respostas obrigatórias (antes de codificar)

1. **Quais componentes legados ainda existem?**
   Apenas **dois pontos legados**: (a) o **placement** visual do `ConfiguradorArranjoFV` no Arranjo A (fluxo antigo: módulo→inversor→estrutura→resumo→config, em vez de config logo após o inversor); (b) o `catalogoEletrico.js` (`dadosEletricosPainel/Inversor`) que resolve specs por **mapa estático** — origem do aviso "não mapeados". Nenhum componente inteiro é "morto".

2. **Quais serão removidos?**
   **Nenhum componente será removido.** Caminho A preserva tudo (incl. `ConfiguradorArranjoFV` por baixo). Apenas **reposicionamento** visual + **correção** do `catalogoEletrico`.

3. **Qual será a fonte única visual do E7?**
   O **container "Sistema FV"** contendo blocos de arranjo (A, B, C, D) com **a mesma estrutura visual** do card do `GerenciadorArranjos`. Ordem única: Módulo → Quantidade → Arquitetura FV → Inversor → Config. Elétrica → Estrutura → Distribuidor → Orçamento → Resumo Técnico.

4. **Quantos componentes serão aposentados?**
   **Zero** componentes aposentados/removidos. (Aposentadoria visual = a seção solta do Arranjo A vira um bloco do container "Sistema FV"; o componente em si permanece.)

5. **Existe risco de regressão no E8?**
   **Não** — a fonte única do E8 já é `agregarTotaisArranjos(state)` (E7 não recalcula; deriva de `equipamentos` + `state.arranjos`). A consolidação é **visual**; não altera `arranjos[]`, `engenharia_eletrica`, nem a agregação. O caso Avelino (354/2/157,53) permanece pois a matemática não muda.

---

## RCA OBRIGATÓRIA — "Dados elétricos não mapeados"

### Causa raiz (confirmada no código)
`frontend/src/data/catalogoEletrico.js` (linhas 197-204):
```js
export function dadosEletricosPainel(painel)   { return DADOS_ELETRICOS_PAINEIS[painel.id]   ?? null }
export function dadosEletricosInversor(inversor){ return DADOS_ELETRICOS_INVERSORES[inversor.id] ?? null }
```
- `DADOS_ELETRICOS_PAINEIS` / `DADOS_ELETRICOS_INVERSORES` são **mapas ESTÁTICOS** com chaves **hardcoded** (`cs550`, `fr20`, `sg10`…) do catálogo local antigo.
- Equipamentos vindos do **catálogo Mongo** (via `/engenharia` → `adaptarModulo/Inversor`) têm `id = String(_id)` (ObjectId). **Esse id nunca casa** uma chave do mapa estático → retorna `null`.
- `ConfiguradorArranjoFV`: `semMod = painel && !eletricoMod` / `semInv = inversor && !eletricoInv` → como `eletricoMod/eletricoInv` vêm `null`, dispara **"Dados elétricos do módulo/inversor não mapeados"** — mesmo o equipamento tendo cadastro completo.

### Por que parece "ter cadastro completo mas não mapeado"
O cadastro completo está nas **especificações do equipamento** (o `painel` já carrega `voc/vmpp/isc/coef_temp_voc/potenciaW`; o `inversor` já carrega `tensaoMaxV/mpptMinV/mpptMaxV/correnteMaxA/potenciaKW/entradasPorMppt`). Mas `dadosEletricosPainel/Inversor` **ignoram esses campos inline** e só olham o mapa estático por id. → **Não é falta de dado; é o adaptador olhando o lugar errado.**

### Componentes auditados
- **Adaptador de módulos** (`adaptarModulo`): OK — entrega voc/vmpp/isc inline no painel.
- **Adaptador de inversores** (`adaptarInversor`): OK — entrega `_eletrico` (tensao_max/mppt/corrente) → SeletorInversores expõe como tensaoMaxV/mpptMinV/etc.
- **Resumo Técnico** (`resumoTecnicoArranjo`): OK — já resolve specs do catálogo por modelo/_id (não usa o mapa estático).
- **Configurador Elétrico** (`ConfiguradorArranjoFV`): **defeituoso** — usa `dadosEletricosPainel/Inversor` (mapa estático).
- **Topologia MPPT** (`TopologiaMPPTEditor`): OK — recebe `eletricoMod/eletricoInv` do configurador (herda o bug se vier null).

### Correção (root-cause, não cosmética)
`dadosEletricosPainel/Inversor` passam a **cair para as specs inline** do equipamento quando o mapa estático não tem a chave (catálogo Mongo). Sem remover o aviso — o aviso só aparecerá se o equipamento realmente não tiver specs. **É correção de integração (não de persistência).**
