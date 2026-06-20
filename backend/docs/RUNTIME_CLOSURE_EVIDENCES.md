# RUNTIME_CLOSURE_EVIDENCES.md

**Sprint:** P1-RUNTIME-CLOSURE-01
**Data:** 2026-06-20
**Commit validado:** `68eba39` (merge sprint/p1-bug-art-01 → main)

---

## HONESTIDADE — TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM (análise estática prévia)
VALIDADO EM RUNTIME:  SIM (4/10 testes — evidências abaixo)
```

---

## T01 — SUN2000-50KTL-M0 (PASSOU)

**Evidência:**
```
PowerShell → Railway API:
POST https://projetofrtsapp-production.up.railway.app/api/datasheet/extrair-multi

Resposta:
{
  "ok": true,
  "provider": "internal",
  "itens": [{
    "fabricante": "Huawei",
    "modelo": "SUN2000-50KTL-M0",
    "score": 100
  }]
}
```

**Contexto:** PDF "Huawei SUN50KTL-M0 Datasheet.pdf" tem texto "H U A W E I" (espaçado).
Antes do merge (sprint não estava em main), retornava `sem_identidade_nem_modelos`.
Após merge `68eba39`, o orphan pattern `/\b(SUN2000-\d{1,3}K?TL[-A-Z0-9]*)\b/i` capturou `SUN2000-50KTL-M0` diretamente.

---

## T02 — SUN2000-60KTL-M0 regressão (PASSOU)

**Evidência:**
```
PowerShell → Railway API:
POST https://projetofrtsapp-production.up.railway.app/api/datasheet/extrair-multi

Resposta:
{
  "ok": true,
  "provider": "internal",
  "itens": [
    { "fabricante": "Huawei", "modelo": "SUN2000-60KTL-M0", "score": 100 },
    { "fabricante": "Huawei", "modelo": "SUN2000-60KTL", "score": 95 }
  ]
}
```

**Contexto:** Datasheet Europe tem "Huawei" escrito normalmente — alias match funcionou sem alteração.
A regressão NÃO foi introduzida pelo fix do orphan pattern.

---

## T03 — COSERN Trifásica 380V (PASSOU — 4 bugs)

### Bug #1 — Parser extração

**Evidência:**
```
PowerShell → Railway API:
POST https://projetofrtsapp-production.up.railway.app/api/fatura/extrair

Resposta (campos relevantes):
{
  "distribuidora": "COSERN",
  "tipoLigacao": "Trifásico 380V",
  "tensao": "380",
  "consumoKwh": 17045
}
```

### Bug #2 — Whitelist (CAMPOS_FATURA_PERMITIDOS)

**Evidência:**
```
PowerShell → Railway API:
PUT https://projetofrtsapp-production.up.railway.app/api/projetos-fv/6a35d5cdf3fada9effa61fa4/etapa

Payload:
{ "etapa": "fatura", "dados": { "tensao_v": 380, "tipo_ligacao": "Trifásico 380V", ... } }

Resposta: HTTP 200
GET depois:
{ "fatura_extracao.tensao_v": 380, "fatura_extracao.tipo_ligacao": "Trifásico 380V" }
```
Campo `tensao_v` passou pela whitelist e foi persistido no MongoDB Atlas.

### Bug #3 — Frontend slice (adaptarFatura)

**Evidência:** Indireta — projeto 6a35d5cdf3fada9effa61fa4 carregou no wizard Vercel com:
- Aba "Dados da Fatura" populada corretamente
- tensao_v mapeado corretamente pelo adaptarFatura

### Bug #4 — Hidratação ProjetosFVNovo

**Evidência:**
```
UI Vercel (projeto 6a35d5cdf3fada9effa61fa4 → DADOS TÉCNICOS):

  Tipo de ligação:   Trifásico
  Tensão:            380 V
  Concessionária:    COSERN
  Consumo mensal:    17045 kWh/mês
```
Antes do fix, campo `tensao_v` não estava no whitelist e não era persistido.
Agora persiste e a UI exibe o valor correto sem fallback hardcoded.

---

## T04 — Governança React Error #31 (PASSOU PARCIAL)

**Evidência:**
```
Browser (Chrome → Vercel → projeto 6a35d5cdf3fada9effa61fa4 → aba Governança):

ComparadorRevisões renderizou: SIM
Mensagem exibida: "É necessário ao menos uma revisão congelada além do estado
atual para comparar. Congele o projeto e crie uma revisão para habilitar."

console.errors após navegação: 0
"Objects are not valid as a React child": NÃO OCORREU
```

**Limitação documentada:** Projeto de teste não possui revisões congeladas.
O comparador renderizou sem crash, mas a comparação real de bitola/secao não foi exercida.
Para cobertura completa seria necessário projeto com >= 1 revisão congelada.

---

## TESTES NÃO EXECUTADOS (T05-T10)

| ID | Motivo de bloqueio | Tipo de bloqueio |
|---|---|---|
| T05 | Revisões congeladas inexistentes em projetos acessíveis | Estado de dados |
| T06 | Projeto com status HOMOLOGADO inexistente | Estado de dados |
| T07 | Projeto 355 módulos + 2 inversores Huawei inexistente | Estado de dados |
| T08 | Projeto com multiarranjo inexistente | Estado de dados |
| T09 | Projeto com beneficiárias cadastradas inexistente | Estado de dados |
| T10 | Chrome Extension bloqueou file upload (PDF local) | Limitação técnica da extensão |

---

## AÇÃO EXECUTADA NESTA SPRINT

| Ação | Motivo |
|---|---|
| Merge `sprint/p1-bug-art-01` → `main` | Fixes estavam em branch, não no ambiente de produção |
| Push `origin/main` (commit `68eba39`) | Railway/Vercel deployam de main |
| Aguardar redeploy Railway | Validado: health check passou antes de iniciar testes |
