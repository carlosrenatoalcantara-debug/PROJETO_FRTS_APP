# FV_REAL_WORKFLOW_FIXES_REPORT.md

**Sprint:** P0-FV-REAL-WORKFLOW-FIXES-01
**Modelo:** Sonnet 4.6
**Data:** 2026-06-19
**Revisão Gemini:** PENDENTE

---

## DECLARAÇÃO DE HONESTIDADE

Esta sprint foi executada **exclusivamente por análise estática de código**. Nenhum ambiente real foi acessado.

| Ambiente | Status |
|---|---|
| Railway (backend) | ✗ SEM ACESSO |
| Vercel (frontend) | ✗ SEM ACESSO |
| MongoDB Atlas | ✗ SEM ACESSO |
| Browser real | ✗ SEM ACESSO |

**Separação:**
- `[CÓDIGO]` = validado por leitura/análise de código e build
- `[EXEC]` = requer execução real — NÃO testado

---

## ORIGEM DA SPRINT

Bugs encontrados durante criação real de projeto FV:
- **Cliente:** Comercial Oliveira e Avelino Ltda
- **UC:** 963336, Natal/RN — COSERN, B3 Comercial Trifásico
- **Consumo:** 22.406 kWh/mês · R$ 19.806,90
- **Sistema:** 355 módulos Talesun TP6L72MH-440, 1× SUN2000-60KTL + 1× SUN2000-50KTL

---

## BUGS CORRIGIDOS — P0 (CRÍTICOS)

### BUG-P0-01 — Navegação após criar cliente `[CÓDIGO]`

**Problema:** Após `Novo Cliente com Fatura` → Salvar, o usuário ficava na lista de clientes em vez de ir para a página do cliente criado.

**Causa:** `handleNovoClienteSalvo` em `Clientes.jsx` só atualizava o array local. `navigate()` nunca era chamado.

**Fix:** `navigate(\`/clientes/${novoCliente._id}\`)` adicionado após `setClientes(...)`.

---

### BUG-P0-02/03/04 — Dados da fatura não pré-preenchidos no wizard `[CÓDIGO]`

**Problema:** Abrindo `/projetos-fv/novo?clienteId=X`, o wizard:
1. Pedia a fatura de novo (E1Upload) mesmo o cliente já tendo dados
2. Não preenchía `consumo_kwh`, `valor_kwh`, `classificacao`, `subgrupo`
3. Não preenchía `codigo_instalacao`, `numero_cliente`

**Causa:** Bloco `?clienteId=` no `ProjetosFVNovo.jsx` só fazia `SET_CONSUMO` com `concessionaria` + `distribuidora` + `tipoLigacao`. Todos os outros campos do `Cliente` model eram ignorados.

**Fix:**
- `SET_CONSUMO` agora inclui: `consumoMensal`, `valorKwh`, `classificacao`, `subgrupo`, `codigoInstalacao`, `numeroCliente`
- Se `cliente.consumo_kwh` existe → `dispatch({ type: 'IR_ETAPA', payload: 2 })` → pula E1Upload

---

### BUG-P0-05 — Letras de arranjos duplicadas após deleção `[CÓDIGO]`

**Problema:** `arranjoVazio(arranjos.length)` usava comprimento do array. Após deletar "Arranjo B" (length=1→0), novo arranjo virava "Arranjo A" (conflitando com o primário).

**Fix:** Função `proximaLetra(lista)` verifica as letras já em uso e retorna a próxima disponível a partir de `B`. Arranjos secundários nunca mais recebem a letra `A`.

---

### BUG-P0-06 — numInversores = potenciaKwp / 5 → resultado absurdo `[CÓDIGO]`

**Problema:** `Math.ceil(156 / 5) = 32 inversores` para sistema de 156 kWp com apenas 2 inversores reais.

**Fix:** `const capInv = state.equipamentos?.inversor?.potenciaKW || 20` — usa potência real do inversor se já selecionado, senão default conservador de 20 kW. Para 156 kWp → 8 estimados (E7 substitui com o número real).

---

### BUG-P0-07 — Orçamento detalhado com preços hardcoded × numInversores errado `[CÓDIGO]`

**Problema:** `precoInversor = || 4000` × `numInversores = 32` = R$128.000 só em inversores na tela de orçamento, com o usuário sem ter entrado nenhum dado.

**Fix:** Defaults alterados para `|| 0`. No modo detalhado, usuário parte de R$0 e preenche os preços reais, ou o catálogo fornece `precoUnitario`. Kit continua funcionando normalmente (zero por default, independente de numInversores).

---

## BUGS CORRIGIDOS — P1

### BUG-P1-01 — CRESESB usa 5.9 kWh/m²/dia para Natal (deveria ser 5.42) `[CÓDIGO]`

**Causa:** `aplicarFallback()` usava `regiao.irradiancia` de `regioesBrasil.js` que tem `RN: { irradiancia: 5.9 }` (média estadual).

**Fix:** Importado `obterIrradianciaCity` de `irradianciaRN.js`. Para Natal/RN → 5.42. O valor estadual (5.9) é mantido apenas como fallback quando cidade não encontrada na tabela.

---

### BUG-P1-02 — AssistenteDatasheet silencia quando extração falha `[CÓDIGO]`

**Fix:** Detecção de falha parcial (`fabricante || modelo === null`). Exibe alerta âmbar com botão "Usar dados parciais e preencher manualmente".

### BUG-P1-03 — SUN2000-50KTL-M0 falha no import `[CÓDIGO] / [EXEC PENDENTE]`

As regras de qualidade (`MPPT_INCOERENTE`, `VOC_MAX_DC_IMPLAUSIVEL`) e a tabela de confiança (`import_solarmarket`) já tinham fixes anteriores aplicados. A causa mais provável é o PDF do 50KTL não sendo parseável pelo Claude neste contexto específico → retorna fabricante/modelo null → BUG-P1-02 (corrigido) causava silêncio. Com P1-02 corrigido, usuário agora recebe aviso claro e pode preencher manualmente.

**Diagnóstico definitivo requer teste em Railway com o PDF real.**

---

### BUG-P1-04 — Garantia do módulo (15/25 anos) não extraída `[CÓDIGO]`

**Fix:** 1) `normalizar()`: `const r = flat` (corrige caso cache com envelope). 2) Aliases `garantia_fabrica_anos` / `garantia_potencia_anos` como fallback. 3) Prompt Claude ampliado com padrões BR/EN explícitos.

---

### BUG-P1-05 — Beneficiárias não pré-preenchidas a partir da UC do cliente `[CÓDIGO]`

**Fix:** Na hidratação `?clienteId=`, se `cliente.codigo_instalacao || cliente.numero_cliente` existe, despacha `SET_BENEFICIARIAS` com UC do cliente pré-preenchida (tipoRateio=percentual, valor=100). Usuário só precisa ajustar o rateio.

---

## BUGS CORRIGIDOS — P2

### BUG-P2-01 — Campos internos (hash_tecnico, score_qualidade) visíveis na governança `[CÓDIGO]`

**Fix:** `projetosFVController.js` — removidas verificações de campos internos do array `mudancas[]`. Apenas specs elétricas são comparadas e exibidas.

### BUG-P2-02 — Impacto genérico na divergência de governança `[CÓDIGO]`

**Fix:** `impacto` agora indica as áreas afetadas: `Engenharia`, `Unifilar`, `Orçamento`, `Homologação`.

### BUG-P2-03 — Sem acesso à documentação homologada `[CÓDIGO]`

**Fix:** Botão "Abrir Documentação Homologada" adicionado ao `GovernancaPainel` quando `status === 'HOMOLOGADO'`.

---

## BUGS CORRIGIDOS — PENDENTES P6

| ID | Arquivo | Fix |
|---|---|---|
| BUG-P4-UNIFILAR-01 (P1) | UnifilarFV.jsx:27 | `data?.itens` |
| BUG-P5-ALERTCENTER-01 (P2) | alertcenter.js:56 | `status $nin substituido/desativado` |
| BUG-P5-MEDICOES-01 (P2) | MedicoesAtivoCard.jsx | confirmação inline |
| BUG-P5-GARANTIA-01 (P3) | ativosController.js | ObjectId.isValid() check |

---

## BUILD

```
✓ 2332 modules transformed
✓ built in 9.80s
0 errors, 1 warning pré-existente (chunk > 2000kB)
```

---

## NÃO ALTERADO

- ProjetoEV e toda árvore EV
- Segurança (AES-256-GCM, JWT, RBAC, auditoria)
- Comissionamento
- Scanner / EtiquetaScanner
- Monitoramento
- Homologação controller
- ProjetoFV.js, AtivoEquipamento.js, Equipamento.js schemas
- irradianciaRN.js (apenas lido)
- regioesBrasil.js (fallback preservado)
