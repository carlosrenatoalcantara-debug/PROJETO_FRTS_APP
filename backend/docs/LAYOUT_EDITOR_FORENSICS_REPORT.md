# P0-LAYOUT-DIAGRAMA-FORENSICS-01 — Forense do Editor de Diagrama

> **Data:** 2026-06-17 · **Executor:** Sonnet 4.6 · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE  
> **Tipo:** READ-ONLY — nenhum código alterado, nenhum commit, nenhuma escrita no Atlas.

---

## VEREDITO

**Causa-raiz única:** o componente `InteractiveDiagram` é um **editor EV** (carregadores elétricos, NBR 5410) que foi copiado para a página FV sem adaptar o prop `calculos`. O campo `calculos_nbr` existe somente em `ProjetoEV`; `ProjetoFV` não tem esse campo. Resultado: `calculos = undefined` → condicional de inicialização falha → `"Dados incompletos para inicializar diagrama"`.

**Classificação:** MIGRAÇÃO_INCOMPLETA + INCOMPATIBILIDADE_DE_SCHEMA  
**Impacto:** 100% dos projetos FV (575/575) — todos, novos e antigos.  
**MULTIARRANJO:** sem impacto. Sprint P1-MULTIARRANJO-UX-RESTORE-01 não tocou o editor de diagrama.

---

## FASE 1 — Fluxo Completo do Botão "Editar Diagrama"

```
Botão "Editar Diagrama"
  └─ ProjetosFVDetalhes.jsx:179-185
  └─ onClick → abrirEditorDiagrama()
       └─ ProjetosFVDetalhes.jsx:67-73
       └─ carregarDiagramaLocal(`projeto-fv-${id}`)   ← leitura local localStorage
       └─ setModalEditorAberto(true)
            └─ Modal renderiza (ProjetosFVDetalhes.jsx:262-291)
                 └─ <InteractiveDiagram
                       calculos={projeto?.calculos_nbr}   ← ❌ SEMPRE UNDEFINED
                       projeto={{ projeto_nome, endereco, comprimento_cabo }}
                       onDiagramChange={setDiagramaEditado}
                       readOnly={false}
                    />
                         └─ InteractiveDiagram.jsx:87 — useEffect([calculos, projeto])
                              └─ if (calculos && projeto)   ← false (calculos = undefined)
                                   └─ else: setErro('Dados incompletos para inicializar diagrama')
                                        └─ InteractiveDiagram.jsx:539-548 — renderiza erro vermelho
```

---

## FASE 2 — Localização Exata da Mensagem de Erro

| Item | Detalhe |
|------|---------|
| **Arquivo** | `frontend/src/components/diagram/InteractiveDiagram.jsx` |
| **Função** | `useEffect` (hook de inicialização) |
| **Linha** | **131** |
| **Condição exata** | `if (calculos && projeto) { ... } else { setErro('Dados incompletos...') }` |
| **Linha da condição** | 87-132 |

**Código exato (linhas 87-132):**
```js
useEffect(() => {
  try {
    if (calculos && projeto) {            // ← calculos = undefined → false
      // ... inicializa nodes/edges
    } else {
      console.warn('⚠️ InteractiveDiagram: Faltam dados', { calculos, projeto });
      setErro('Dados incompletos para inicializar diagrama');  // ← LINHA 131
    }
  } catch (err) { ... }
}, [calculos, projeto]);
```

**Prop passada pelo caller (`ProjetosFVDetalhes.jsx:280`):**
```jsx
calculos={projeto?.calculos_nbr}   // projeto.calculos_nbr === undefined (campo não existe em FV)
```

---

## FASE 3 — Contrato Esperado pelo InteractiveDiagram

### Prop `calculos` (obrigatório — qualquer valor falsy dispara o erro)

| Campo | Tipo | Obrigatório | Uso |
|-------|------|-------------|-----|
| `corrente_projeto_a` | Number | ✅ | REDE: label + corrente |
| `disjuntor_a` | Number | ✅ | DISJUNTOR: label + corrente_a |
| `corrente_maxima_a` | Number | ⚪ | DISJUNTOR: corrente_maxima_a |
| `dps_kv` | Number | ✅ | DPS: tensao_kv / label |
| `dps_capacidade_a` | Number | ⚪ | DPS: capacidade_a |
| `dr_ma` | Number | ✅ | DR: ma / label |
| `bitola_cabo_mm2` | Number | ✅ | CABO: bitola + label |
| `queda_tensao_pct` | Number | ⚪ | specs panel |
| `tempo_seccionamento_s` | Number | ⚪ | specs panel |
| `materiais` | Array | ⚪ | specs panel |

### Prop `projeto` (obrigatório — mas os campos internos são opcionais)

| Campo | Tipo | Obrigatório | Uso |
|-------|------|-------------|-----|
| `projeto_nome` | String | ⚪ | specs panel + export filename |
| `cliente_nome` | String | ⚪ | specs panel |
| `endereco` | String | ⚪ | specs panel |
| `comprimento_cabo` | Number | ⚪ | CABO: comprimento_m (default 10) |
| `tensao` | String | ⚪ | REDE: fases / '220V' or '380V' |
| `carregador_potencia_kw` | Number | ⚪ | CARREGADOR: potencia_kw / label |
| `carregador_tipo` | String | ⚪ | CARREGADOR: tipo |
| `carregador_marca` | String | ⚪ | CARREGADOR: marca |
| `carregador_modelo` | String | ⚪ | CARREGADOR: modelo |
| `tecnico_nome` | String | ⚪ | specs panel |
| `tecnico_crea` | String | ⚪ | specs panel |

> **Nota crítica:** se `calculos` for qualquer valor truthy (mesmo `{}`), a inicialização não lança erro — ela apenas gera nodes com campos `undefined`. O trigger do erro é exclusivamente `calculos === undefined/null/0/false`.

---

## FASE 4 — Comparação Contrato vs Dados Reais

| Campo esperado | Valor em ProjetoFV | Resultado |
|---------------|-------------------|-----------|
| `calculos_nbr` (inteiro) | **NÃO EXISTE** (0/575 projetos) | ❌ `undefined` → erro |
| `calculos_nbr.corrente_projeto_a` | NÃO EXISTE | ❌ |
| `calculos_nbr.disjuntor_a` | NÃO EXISTE | ❌ |
| `calculos_nbr.dps_kv` | NÃO EXISTE | ❌ |
| `calculos_nbr.dr_ma` | NÃO EXISTE | ❌ |
| `calculos_nbr.bitola_cabo_mm2` | NÃO EXISTE | ❌ |
| `projeto.projeto_nome` | `projeto.nomeCliente` → ✅ passado | ✅ |
| `projeto.endereco` | `projeto.endereco` → ✅ passado | ✅ |
| `projeto.comprimento_cabo` | `projeto.comprimento_cabo_m \|\| 10` → ✅ | ✅ |
| `projeto.carregador_*` | **NÃO PASSADO** (FV não tem carregador) | ⚠️ `undefined` (não causa erro) |
| `projeto.cliente_nome` | **NÃO PASSADO** (esquecido na adaptação) | ⚠️ `undefined` (não causa erro) |

**Campo que impede a abertura: `calculos_nbr`** (não existe em ProjetoFV → é `undefined` → condição `if (calculos && projeto)` = false).

---

## FASE 5 — Análise de Impacto MULTIARRANJO

| Pergunta | Resposta | Evidência |
|---------|----------|-----------|
| O editor suporta múltiplos módulos? | N/A — não é um editor FV | `converterCalculosParaNodesEdges` não usa `arranjos`, `modulos` nem `inversores` |
| O editor suporta múltiplos inversores? | N/A — não é um editor FV | Idem |
| O editor ainda espera estrutura antiga? | N/A | Idem |
| Existe regressão causada pelo MULTIARRANJO? | **Não** | MULTIARRANJO tocou somente `GerenciadorArranjos.jsx` (wizard FV); `InteractiveDiagram` é arquivo separado, independente |

**Conclusão MULTIARRANJO:** sem impacto. O bug já existia antes do MULTIARRANJO (commit 08098a9, 2026-05-13).

---

## FASE 6 — Classificação

| Categoria | Aplicável? | Justificativa |
|-----------|-----------|---------------|
| **MIGRAÇÃO_INCOMPLETA** | ✅ | Componente EV foi migrado/copiado para página FV sem adaptar o prop `calculos` |
| **INCOMPATIBILIDADE_DE_SCHEMA** | ✅ | `calculos_nbr` existe em `ProjetoEV.js:51-62` mas não em `ProjetoFV.js` |
| BUG | ⚪ | É consequência da migração incompleta, não um bug isolado |
| REGRESSÃO | ❌ | O editor nunca funcionou em FV; foi adicionado com o bug desde o início |
| DADO_FALTANTE | ⚪ | O "dado faltante" é o próprio campo `calculos_nbr` que não faz sentido em FV |

---

## FASE 7 — Impacto

| Métrica | Valor |
|---------|-------|
| Projetos FV totais | 575 |
| Projetos FV afetados | **575 (100%)** |
| Projetos novos afetados | ✅ Sim |
| Projetos antigos afetados | ✅ Sim |
| Projetos EV afetados | 0 (funciona corretamente) |
| Dados Atlas corrompidos | ❌ Não |
| Campo `diagrama_editado` em FV (Atlas) | 0/575 (o save nunca ocorreu pois o editor não abre) |

**Severidade:** ALTA — o botão "Editar Diagrama" está no header principal, visível em todos os projetos FV. Todo clique resulta em erro vermelho. Não há workaround.

**Funcionalidades não afetadas:** todas as outras abas (Resumo, Layout, BESS, Financeiro, Unifilar, Governança, Documentos, Comercial, CRM, Homologação, Beneficiárias) funcionam normalmente.

---

## Origem do Bug

**Commit:** `08098a904137fb9ee14ec1f89607f74e8c814f6c`  
**Data:** 2026-05-13  
**Mensagem:** "feat: Adicionar diagrama interativo e página de detalhes para projetos EV"  
**Co-Author:** Claude Haiku 4.5  

O commit adicionou `InteractiveDiagram` corretamente ao `ProjetosEVDetalhes.jsx` (com todos os campos EV adequados), mas também o adicionou a `ProjetosFVDetalhes.jsx` sem adaptar o prop `calculos` para dados FV — nem mesmo criando um `calculos_nbr` equivalente para FV, pois FV usa cálculos fotovoltaicos completamente diferentes.

---

## Entregáveis

| Arquivo | Status |
|---------|--------|
| `LAYOUT_EDITOR_FORENSICS_REPORT.md` | ✅ Este arquivo |
| `LAYOUT_EDITOR_ROOT_CAUSE.json` | ✅ Gerado |
| `LAYOUT_EDITOR_SCHEMA_DIFF.json` | ✅ Gerado |
| `LAYOUT_EDITOR_IMPACT_ANALYSIS.json` | ✅ Gerado |

**Nenhum código foi alterado. Nenhum dado foi alterado. Nenhum commit foi criado.**
