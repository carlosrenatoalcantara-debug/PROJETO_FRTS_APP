# E7_UX_CLEANUP_REPORT.md

**Sprint:** P0-E7-UX-CLEANUP-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Commit:** `8b125f8`

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).
> Evidência: VALIDADO EM CÓDIGO (build OK + teste de dedup/agregação); UI não exercida em navegador.

---

## BUG-01 — Arranjo A duplicado

1. **Onde ocorre a duplicação:** o Arranjo A primário é renderizado na **seção principal** do `E7Equipamentos` (a partir de `equipamentos`). Ao mesmo tempo, a hidratação (`E7Equipamentos:59`) carregava `projeto.arranjos` — que inclui o bloco `tipo: 'principal'` (gerado por `montarArranjosPayload`) — em `state.arranjos`, e o `GerenciadorArranjos` renderiza **todo** `state.arranjos` → Arranjo A aparecia **duas vezes**. (Bônus: a agregação da E8 também contava o Arranjo A em dobro.)
2. **Como foi corrigida:**
   - **Hidratação:** ao carregar, filtra `tipo !== 'principal' && rotulo !== 'Arranjo A'` antes do `SET_ARRANJOS` (exceto `ampliacao`, que usa `state.arranjos` como fonte).
   - **GerenciadorArranjos (defensivo):** o `map` pula o bloco principal preservando o índice real (`map → filter → map`), garantindo que só **Arranjo B/C/D…** sejam renderizados.
3. **Runtime validado:** teste de agregação (projeto reaberto):
   - **Sem fix:** 534 módulos / 3 inversores / 237,63 kWp (A em dobro).
   - **Com fix:** **354 / 2 / 157,53 kWp**; GerenciadorArranjos renderiza apenas **"Arranjo B"**. Double-count eliminado.

---

## BUG-02 — Painel "Topologia de referência COSERN" no topo

1. **Onde era exibido:** `<SugestaoTopologiaReferencia>` estava no **topo** do E7, **acima do Arranjo A** (renderizado sempre que a concessionária era COSERN).
2. **Nova localização:** movido para um **card recolhido "Sugestões Técnicas"**, posicionado **abaixo** do `GerenciadorArranjos` (nunca acima do Arranjo A), exibido **somente quando concessionária = COSERN** e **recolhido por padrão** (`sugestoesAberto = false`).
3. **Runtime validado:** build OK; o card só monta o conteúdo quando `ehCosern` é verdadeiro e o usuário expande. (Render em navegador não exercido — sem ferramenta de wizard.)

---

## BUG-03 — Ordem visual

Ordem do card de arranjo (GerenciadorArranjos) após a correção:

```
Módulo → (Quantidade) → Arquitetura → Inversor → (Quantidade inversores) →
Estrutura → Fornecedor → Orçamento → [Orientação*] → Resumo Técnico → Configuração Elétrica
```
A **Configuração Elétrica** (topologia detalhada) foi movida para o **fim**, após o Resumo Técnico — conforme a ordem canônica.

**Existe algum componente ainda fora dessa ordem?**
- **Arranjos secundários (B/C/D):** em ordem. (`Orientação/Inclinação` é um campo informativo extra entre Orçamento e Resumo — não previsto na lista canônica, mantido por ser opcional.)
- **Arranjo A primário (seção principal do E7):** **PARCIALMENTE fora da ordem** — usa `SeletorPaineis` → `SeletorInversores` → `SeletorEstrutura` → `ResumoTecnicoArranjo` → `ConfiguradorArranjoFV`, **sem** os blocos explícitos de **Arquitetura / Fornecedor / Orçamento** (a quantidade fica dentro do configurador). Alinhar o Arranjo A à mesma estrutura exigiria migrá-lo para o mesmo card do GerenciadorArranjos — fora do escopo deste cleanup (documentado como dívida de UX).

---

## RESULTADO

```
APROVADO — BUG-01 e BUG-02 corrigidos e validados; BUG-03 reordenado (config elétrica
por último). Ressalva honesta: o Arranjo A primário ainda difere estruturalmente dos
secundários (asimetria conhecida ConfiguradorArranjoFV ↔ card).
```

Backend/persistência/governança/homologação/snapshot/EV/BESS/OCR/datasheet **intocados**.

### Entregáveis
- E7_UX_CLEANUP_REPORT.md · E7_UX_CLEANUP_DIFF.json · E7_UX_CLEANUP_RUNTIME.json
