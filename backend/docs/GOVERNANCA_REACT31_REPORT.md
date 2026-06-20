# GOVERNANCA_REACT31_REPORT.md

**Sprint:** P1-GOVERNANCA-REACT31-RCA-01
**Data:** 2026-06-19
**Modelo:** Claude Sonnet 4.6

---

## DECLARAÇÃO DE HONESTIDADE

```
RAILWAY ACESSADO:     NÃO
VERCEL ACESSADO:      NÃO
RUNTIME EXECUTADO:    NÃO
BUILD EXECUTADO:      SIM — ✓ 0 erros, 13.95s, 2332 módulos
LEITURA DE CÓDIGO:    SIM — 6 arquivos lidos
```

---

## RESPOSTAS OBRIGATÓRIAS

### 1. Causa raiz

Campo errado em `diffRevisoes.js:36-37`. O código tentava ler `cabos.dc.bitola`, mas o
shape real do snapshot técnico usa `cabos.dc.secao`. O fallback `g(t, 'cabos.dc')` retornava
o **objeto inteiro** `{imax, secao, disj}`. Esse objeto chegava ao `ComparadorRevisoes.jsx`
como `l.de` / `l.para`, renderizados sem serialização → React Error #31.

---

### 2. Componente que crashou

**`ComparadorRevisoes.jsx:116-117`** — renderizava `{l.de ?? '—'}` sem verificar tipo:

```jsx
<td className="py-1.5 pr-3 text-slate-500">{l.de ?? '—'}</td>
<td ...>{l.para ?? '—'}</td>
```

Se `l.de` é um objeto, React lança Error #31: "Objects are not valid as a React child".

---

### 3. Linha exata da falha de origem

**`diffRevisoes.js:36-37`** — campo `.bitola` não existe no shape real:

```js
// ANTES (BUG):
'Cabo CC (mm²)': g(t, 'cabos.dc.bitola') ?? g(t, 'cabos.dc') ?? null,
'Cabo CA (mm²)': g(t, 'cabos.ac.bitola') ?? g(t, 'cabos.ac') ?? null,
```

---

### 4. Objeto exato

Shape retornado por `montarModeloEletrico` (`engenhariaNormativa.js:335`):

```js
cabos: {
  dc: { imax: <number>, secao: '<mm²>', disj: '<A>' },
  ac: { imax: <number>, secao: '<mm²>', disj: '<A>' },
  aterramento: '6',
}
```

O campo correto é `secao` (seção transversal em mm²), não `bitola`.

---

### 5. Cascata completa

```
engenhariaNormativa.js:335
  └─ cabos.dc = { imax, secao, disj }  ← shape correto

engenhariaGovernanca.js:118
  └─ snapshot_tecnico.cabos = modelo.cabos  ← armazena objeto aninhado

diffRevisoes.js:36  ← BUG: campo errado
  └─ g(t, 'cabos.dc.bitola')  → undefined
  └─ fallback: g(t, 'cabos.dc')  → { imax, secao, disj }  ← objeto vaza

diffRevisoes.js:91
  └─ linhas.push({ campo, de: {imax,secao,disj}, para: {imax,secao,disj}, ... })

ComparadorRevisoes.jsx:116  ← CRASH
  └─ {l.de ?? '—'}  → tenta renderizar objeto → React Error #31
```

---

### 6. Como foi corrigido

**Correção 1 — raiz (`diffRevisoes.js:36-37`):**

```js
// DEPOIS (CORRIGIDO):
'Cabo CC (mm²)': g(t, 'cabos.dc.secao') ?? g(t, 'cabos.dc.bitola') ?? null,
'Cabo CA (mm²)': g(t, 'cabos.ac.secao') ?? g(t, 'cabos.ac.bitola') ?? null,
```

Usa `secao` (campo real), com fallback para `bitola` (campo legado/futuro). O fallback
para o objeto inteiro foi removido.

**Correção 2 — segurança (`ComparadorRevisoes.jsx:63+116-117`):**

```js
// Helper adicionado:
const fmt = (v) => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

// Render protegido:
<td ...>{fmt(l.de)}</td>
<td ...>{fmt(l.para)}</td>
```

Garante que qualquer objeto futuro seja serializado em vez de causar crash.

---

### 7. Arquivos alterados

| Arquivo | Linhas | Tipo |
|---|---|---|
| `frontend/src/utils/diffRevisoes.js` | 36-37 (2 linhas mod.) | Correção raiz |
| `frontend/src/components/fv/ComparadorRevisoes.jsx` | +1 helper, 2 linhas mod. | Safety net |

---

### 8. Build

```
✓ 0 erros
✓ 13.95s
✓ 2332 módulos
⚠ 1 warning: chunk > 2000kB (pré-existente, não introduzido)
```

---

### 9. Por que não apareceu antes

`ComparadorRevisoes` só renderiza quando há **2+ revisões congeladas**. A seção é silenciosa
enquanto o projeto não tem revisão arquivada (`if (revisoes.length < 2) return <mensagem>`).
O crash só ocorre ao comparar revisões com snapshots contendo dados elétricos.

---

### 10. Regressões

Nenhuma. Alterações mínimas, sem remoção de props ou imports. O campo `secao` é o campo
correto do shape desde o início — a correção torna o diff mais fiel (exibe a seção do cabo
em vez de `null`).

---

## RESULTADO

| Item | Status |
|---|---|
| Causa raiz identificada | ✅ VALIDADO EM CÓDIGO |
| Componente que crashou | ✅ ComparadorRevisoes.jsx:116 |
| Linha de origem | ✅ diffRevisoes.js:36-37 |
| Objeto | ✅ {imax, secao, disj} de engenhariaNormativa.js |
| Correção aplicada | ✅ VALIDADO EM CÓDIGO |
| Build | ✅ 0 erros |
| Runtime T15 | ⏳ PENDENTE (necessário projeto com revisões congeladas) |
| Runtime T16 | ⏳ PENDENTE |
