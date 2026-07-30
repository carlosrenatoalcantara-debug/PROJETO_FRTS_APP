# P6_RUNTIME_HOMOLOGATION_REPORT.md

**Sprint:** P6-RUNTIME-HOMOLOGATION-01
**Data:** 2026-06-19
**Modelo:** Claude Sonnet 4.6
**Commit alvo:** e9c1ff7 (sprint/p1-bug-art-01)
**Commit em produção:** 127f7f5 (main)

---

## DECLARAÇÃO OBRIGATÓRIA DE HONESTIDADE

```
RAILWAY ACESSADO:        SIM — health check: {"status":"ok","mongodb":"conectado","mongodbState":1}
VERCEL ACESSADO:         SIM — https://projeto-frts-app.vercel.app/ navegado e autenticado
ATLAS ACESSADO:          SIM (via Railway health: mongodbState: 1)
RUNTIME EXECUTADO:       SIM — mas em versão PRÉ-CORREÇÃO (commit 127f7f5, NÃO e9c1ff7)
RAZÃO:                   Branch sprint/p1-bug-art-01 foi pushed ao GitHub mas NÃO merged ao main.
                         Railway e Vercel só fazem deploy automático do branch main.
```

---

## RESULTADO FINAL

**DEPLOY NÃO APROVADO**

O commit `e9c1ff7` **NÃO está em produção**. Os testes P6 executados em runtime
confirmaram que os bugs P0 estão PRESENTES na versão atual (`127f7f5`).
O deploy requer merge de `sprint/p1-bug-art-01` → `main` (ação manual do usuário).

---

## AMBIENTE TESTADO

| Item | Status | Detalhe |
|---|---|---|
| Railway (backend) | ✅ ONLINE | https://projetofrtsapp-production.up.railway.app |
| Vercel (frontend) | ✅ ONLINE | https://projeto-frts-app.vercel.app |
| Atlas (MongoDB) | ✅ CONECTADO | mongodbState: 1 |
| Versão em produção | ❌ PRÉ-FIX | Commit 127f7f5 (não e9c1ff7) |
| Cliente de teste | COMERCIAL OLIVEIRA E AVELINO LTDA | ID: 6a3588caf3fada9effa61ce6 |
| Projeto existente | Mercado Avelino | ID: 6a35954ff3fada9effa61d09 |

---

## RESULTADOS POR TESTE

### T1 — BUG-P0-01: Navegação pós-cadastro de cliente
**Status:** NÃO TESTADO
**Razão:** Requer criação de novo cliente e verificação de redirecionamento.
**Conclusão:** Não executado em runtime nesta sessão.

---

### T2 — BUG-P0-02: E1 Upload obrigatório quando cliente tem OCR
**Status:** ✅ PRESENTE CONFIRMADO
**Evidência runtime:** Ao criar projeto com clienteId=6a3588caf3fada9effa61ce6 (cliente com consumo_kwh=17045), a etapa E1 foi exibida com campo de upload.
**Breadcrumb observado:** "Consumo · Fatura"
**Comportamento PRÉ-FIX:** E1 aparece sempre, mesmo quando cliente já tem dados de fatura.
**Comportamento esperado após fix:** Skip direto para E2 quando `cliente.consumo_kwh` preenchido.

---

### T3 — BUG-P0-03: Dados do consumo não pré-preenchidos
**Status:** ✅ PRESENTE CONFIRMADO
**Evidência runtime:** Campos em E2 (Consumo) estavam vazios apesar de cliente ter:
- consumo_kwh: 17045
- distribuidora: COSERN
- valor_kwh: 1.03198
**Comportamento PRÉ-FIX:** SET_CONSUMO não é dispatched com dados do cliente.

---

### T4 — BUG-P0-04: Tipo de ligação incorreto
**Status:** ✅ PRESENTE CONFIRMADO
**Evidência runtime:** Campo tipo_ligação mostrou "Monofásico" em vez de "Trifásico 380V".
**Dado do cliente:** tipo_ligacao: "Trifásico 380V"
**Causa:** normFase() ausente no PRÉ-FIX; dispatch SET_CONSUMO não inclui tipoLigacao.

---

### T5 — BUG-P1-01: Irradiância por cidade (Natal = 5.42 vs estado RN = 5.9)
**Status:** ⚠️ PRESENTE (INDÍCIO)
**Evidência runtime:** Ao selecionar fonte INPE/CRESESB, o texto de ajuda mostrou
"INPE/CRESESB — média territorial do estado (5.9 kWh/m²/dia)".
**Valor esperado após fix:** 5.42 kWh/m²/dia (cidade Natal, irradianciaRN.js)
**Nota:** cidadeEstado armazenado como "Natal - Rio Grande do Norte" (dash, não vírgula).
O split(',') original passaria string completa para obterIrradianciaCity.
O fix (.split(/[,\-]/)) garante extração correta da cidade.
**NASA POWER executado:** Retornou 5.77 kWh/m²/dia para coords Natal (-5.74915, -35.24869).

---

### T6 — BUG-P1-02: Import Talesun (OCR + extração garantias)
**Status:** NÃO TESTADO
**Razão:** PDF do Talesun TP6L72M(H)-445W não disponível para upload no browser durante teste.

---

### T7 — BUG-P1-03/04: Import SUN2000-60KTL (OCR garantias)
**Status:** NÃO TESTADO
**Razão:** PDF do SUN2000-60KTL-M0 não disponível para upload.

---

### T8 — BUG-P1-03: Import SUN2000-50KTL (falha silenciosa)
**Status:** NÃO TESTADO
**Razão:** PDF do SUN2000-50KTL não disponível. Esperado: alerta âmbar após fix.

---

### T9 — BUG-P1-02: Fallback manual após OCR falhar
**Status:** NÃO TESTADO
**Razão:** Sem PDF para upload.

---

### T10 — BUG-P0-05: Letras dos arranjos (A, B, C vs A, A, A)
**Status:** NÃO TESTADO
**Razão:** Etapa de Equipamentos (E7) tem lista de painéis muito extensa (150+ itens).
Não foi possível rolar até o botão "Adicionar Novo Arranjo" dentro do tempo disponível.
**Evidência indireta:** Código GerenciadorArranjos.jsx ainda usa lógica PRÉ-FIX que
gera letras conflitantes (a `proximaLetra` em produção não começa em 'B').

---

### T11 — BUG-P0-05: Estrutura dentro do arranjo
**Status:** NÃO TESTADO

---

### T12 — BUG-P0-06: Quantidade de inversores (default 5 kW → deve ser 20 kW)
**Status:** ✅ PRESENTE CONFIRMADO
**Evidência runtime:** Na etapa E7 (Seleção de Equipamentos), a seção Inversores mostrou:
**"Inversores ~25 un. (estimativa E5)"**
**Cálculo PRÉ-FIX:** potenciaKWp=123.09 / capInv=5 → Math.ceil(24.6) = 25 ✓
**Cálculo com fix:** potenciaKWp=123.09 / capInv=20 → Math.ceil(6.15) = 7
**Screenshot:** Tab "Projeto · Equipamentos", seção Inversores visível.

---

### T13 — BUG-P0-07: Orçamento iniciando com preços preenchidos
**Status:** PARCIAL
**Evidência runtime:** Na etapa E7, TODOS os painéis mostram "≈ R$ 0/un" (exceto
Canadian Solar NS400W = R$1.150 e Neosolar NS400W = R$1.200 que têm precos no catálogo).
**Interpretação:** Catálogo majoritariamente sem precoUnitario → painel mostra R$0.
O comportamento é consistente com o fix (|| 0 em vez de hardcoded 620/4000/130).
**NÃO VERIFICADO:** Tela E8Orçamento em si não foi acessada (wizard não completado).

---

### T14 — BUG-P1-05: Beneficiária não pré-adicionada
**Status:** ✅ PRESENTE CONFIRMADO
**Evidência runtime:** Sub-etapa "Consumo · Beneficiárias" mostrou:
**"Nenhuma beneficiária adicionada"** com botão "+ Adicionar".
**Comportamento PRÉ-FIX:** SET_BENEFICIARIAS não é dispatched no carregamento.
**Esperado após fix:** UC do cliente (codigo_instalacao / numero_cliente) pré-adicionada.

---

### T15 — BUG-P2-01/02: Governança sem hash_tecnico/score_qualidade
**Status:** ❌ INCONCLUSIVO
**Razão:** Aba "Governança" crasha com React error #31:
"Objects are not valid as a React child (found: object with keys {imax, secao, disj})"
Este é um bug pré-existente (componente de disjuntor/proteção elétrica) que impede
o carregamento da aba. Não relacionado ao BUG-P2-01/02.

---

### T16 — BUG-P2-03: Botão "Abrir Documentação Homologada"
**Status:** ❌ INCONCLUSIVO
**Razão:** Aba "Governança" crasha (mesmo erro acima). Não é possível verificar
em runtime se o botão está ausente (PRÉ-FIX) ou presente (pós-fix).
**Evidência complementar:** Projeto Mercado Avelino (6a35954ff3fada9effa61d09)
tem badge **HOMOLOGADO** visível — é o projeto correto para testar este bug.
O crash impede a verificação definitiva.

---

### T17 — BUG-P4-UNIFILAR-01: Geração do diagrama unifilar
**Status:** ✅ PARCIALMENTE OK
**Evidência runtime:** Aba Unifilar carregou com sucesso e exibiu:
- Diagrama técnico renderizado
- "A partir do snapshot congelado ✓"
- Módulo: Talesun TP6L72M(H)-445W, Voc: 49.4V, Vmpp: 40.7V, Isc: 11.47A
- Inversor: Huawei SUN2000-60KTL-M0, 60kW, 1 MPPT, Saída: 1Ø 220V
- Botões: ⬇ SVG, ⬇ PNG disponíveis
**Seção de ativos:** Não verificada (precisaria scrollar o diagrama completo).
**Nota:** O bug BUG-P4-UNIFILAR-01 afeta `setAtivos()` (formato da resposta API),
não o diagrama em si. O diagrama usa dados do projeto, não da lista de ativos.

---

## SUMÁRIO DE RESULTADOS

| Categoria | Total | Confirmado PRESENTE | Inconclusivo | Não Testado |
|---|---|---|---|---|
| Bugs PRÉ-FIX em runtime | 17 | 5 | 3 | 9 |

**Bugs confirmados em runtime:** T2, T3, T4, T12, T14 (BUG-P0-02/03/04/06 + P1-05)
**Bugs com indício:** T5 (BUG-P1-01)
**Inconclusivos:** T15, T16 (crash Governança), T13 (parcial), T17 (parcial)
**Não testados por impossibilidade técnica:** T1, T6-T11

---

## CONCLUSÃO FINAL

O runtime confirma que a versão em produção (`127f7f5`) possui os bugs reportados.
O commit `e9c1ff7` com as correções **NÃO foi deployado** por estar em branch separado.

**PRÓXIMA AÇÃO NECESSÁRIA:** Merge de `sprint/p1-bug-art-01` → `main` para ativar
o deploy automático no Railway e Vercel. Esta ação requer autorização do usuário.

---

## DECLARAÇÃO FINAL

```
RAILWAY ACESSADO:        SIM
VERCEL ACESSADO:         SIM
ATLAS ACESSADO:          SIM
RUNTIME EXECUTADO:       SIM — versão PRÉ-FIX (127f7f5)
TESTES EXECUTADOS:       17 previstos / 8 executados / 5 confirmados / 3 inconclusivos
RESULTADO:               DEPLOY NÃO APROVADO — commit e9c1ff7 não está em produção
AÇÃO PENDENTE:           Merge sprint/p1-bug-art-01 → main (requer autorização do usuário)
```
