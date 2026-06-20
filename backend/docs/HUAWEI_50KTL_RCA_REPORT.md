# HUAWEI_50KTL_RCA_REPORT.md

**Sprint:** P1-HUAWEI-50KTL-RCA-01
**Data:** 2026-06-19
**Modelo:** Claude Sonnet 4.6

---

## DECLARAÇÃO DE HONESTIDADE

```
RAILWAY ACESSADO:     NÃO
VERCEL ACESSADO:      NÃO
RUNTIME EXECUTADO:    NÃO
BUILD EXECUTADO:      SIM — ✓ 0 erros, 12.89s, 2332 módulos
LEITURA DE CÓDIGO:    SIM — 12 arquivos lidos
```

---

## RESPOSTAS OBRIGATÓRIAS

### 1. Causa raiz

Regex com `\w*` em `fabricanteModeloFallback.js:94-95`. Em JavaScript, `\w = [A-Za-z0-9_]` — **não inclui hífen**. O modelo `SUN2000-50KTL-M0` tem o sufixo `-M0` separado por hífen, que `\w*` não consegue capturar. O padrão capturava apenas `SUN2000-50KTL`, truncando o sufixo.

Causa secundária: ausência de entrada no catálogo de modelos órfãos para `SUN2000-`. PDFs Huawei frequentemente têm a marca "Huawei" apenas em logotipo/imagem — não no corpo OCR — de modo que o gate de alias nunca é satisfeito, e nem o pattern com alias nem o genérico são tentados.

---

### 2. Etapa onde falhava

```
InternalAdapter.extrair()
  └─ extrairFabricanteModelo(texto)
        └─ PADROES[Huawei].aliases: "huawei" não encontrado no OCR → pula bloco
        └─ modelosOrfaos: SUN2000 não listado → sem match
        └─ retorna { fabricante: null, modelo: null }

  ← normalizarMulti(raw) → itens: []   (raw.modelo == null, sem variantes)
  ← ModalNovoInversor.jsx:78 lança IMPORTACAO_FALHOU
```

Mesmo quando "huawei" estava no OCR, o padrão `\w*` capturava `SUN2000-50KTL` (sem `-M0`) — o modelo truncado diferia do esperado pelo usuário mas não causava falha de importação. O caminho de falha total ocorria quando "huawei" estava ausente do OCR (marca apenas em imagem).

---

### 3. Linha exata da falha

**`fabricanteModeloFallback.js:94`** (antes da correção):

```js
/\b(SUN2000-\d{1,3}K?TL\w*)\b/i,   // \w* = [A-Za-z0-9_] — para no hífen
```

Para `SUN2000-50KTL-M0`:
- `\d{1,3}` casa `50`
- `K?` casa nada (não tem K antes de TL)  
- `TL` casa `TL`
- `\w*` casa `''` (próximo char é `-`, que não é `\w`)
- Resultado: captura `SUN2000-50KTL`, perde `-M0`

---

### 4. Por que SUN2000-60KTL funcionava

`SUN2000-60KTL` tem **zero sufixo após `TL`**. O padrão `TL\w*` casa `TL` + zero caracteres `\w` e o `\b` fecha na posição final. Resultado correto: `SUN2000-60KTL`.

`SUN2000-50KTL-M0` tem `-M0` após `TL`. O `\b` fecha logo após `TL` (o próximo char `-` não é `\w`, então é word boundary). Resultado truncado: `SUN2000-50KTL`.

---

### 5. Cascata completa de falha

```
PDF do SUN2000-50KTL-M0 → OCR extrai texto
  
ModalNovoInversor.jsx → POST /api/datasheet/extrair-multi
  
datasheetMultiController.js
  └─ AIOrchestrator.extrairMulti()
        └─ GeminiAdapter.extrair()  → Gemini Vision → sem modelo (falha API ou PDF scan)
        └─ ClaudeAdapter.extrair()  → throw ('sem extrator injetado')  ← sempre falha
        └─ InternalAdapter.extrair()
              └─ extrairFabricanteModelo(texto)
                    ├─ ALIAS: "huawei" não encontrado em OCR → skip
                    └─ ÓRFÃO: SUN2000-* não estava na lista → null

              retorna { fabricante: null, modelo: null, variantes: [] }
              
        Orchestrator: !temIdentidade && !temModelosValidos → cascade exausta
  
  normalizarMulti(raw): raw.modelo == null, variantes vazias → itens = []
  
  datasheetMultiController retorna { itens: [] }
  
  ModalNovoInversor.jsx:78:
    if (itens.length === 0) throw new Error('IMPORTACAO_FALHOU: ...')
```

---

### 6. Como foi corrigido

**Correção 1 — padrão com alias (`fabricanteModeloFallback.js:94-98`)**:

```js
// ANTES (BUG):
/\b(SUN2000-\d{1,3}K?TL\w*)\b/i,           // \w* para no hífen
/\b(SUN2000-\d{1,3}\w*)\b/i,

// DEPOIS (CORRIGIDO):
/\b(SUN2000-\d{1,3}K?TL[-A-Z0-9]*)\b/i,    // SUN2000-50KTL-M0, SUN2000-100KTL-H1
/\b(SUN2000-\d{1,3}[-A-Z0-9]*)\b/i,         // fallback genérico SUN2000
```

`[-A-Z0-9]*` captura a parte após `TL`: `-M0`, `-H1`, `-H3`, `-US`, etc.

**Correção 2 — padrão órfão (`fabricanteModeloFallback.js:407`)**:

```js
// ADICIONADO:
{ regex: /\b(SUN2000-\d{1,3}K?TL[-A-Z0-9]*)\b/i, fabricante: 'Huawei' },
```

Ativa quando "Huawei" está apenas no logotipo/imagem, não no corpo OCR.

---

### 7. Arquivos alterados

| Arquivo | Tipo | Detalhes |
|---|---|---|
| `backend/src/utils/catalogo/fabricanteModeloFallback.js` | Correção raiz + orphan | Linhas 94-98 e 407 |

---

### 8. Build

```
✓ 0 erros
✓ 12.89s
✓ 2332 módulos
⚠ 1 warning: chunk > 2000kB (pré-existente)
```

---

### 9. SUN2000-60KTL continua funcionando?

Sim. `[-A-Z0-9]*` com zero ocorrências casa `SUN2000-60KTL` da mesma forma que `\w*` com zero ocorrências. Nenhuma regressão para modelos sem sufixo.

---

### 10. SUN2000-50KTL-M0 passou a funcionar?

VALIDADO EM CÓDIGO — a regex `SUN2000-\d{1,3}K?TL[-A-Z0-9]*` captura corretamente `SUN2000-50KTL-M0`.

VALIDADO EM RUNTIME: NÃO — requer teste com PDF real no ambiente Railway.

---

### 11. Regressões

Nenhuma. `[-A-Z0-9]*` é estritamente um superconjunto de `\w*` para os caracteres relevantes de modelos Huawei. Modelos sem sufixo continuam capturados normalmente.

---

## RESULTADO

| Item | Status |
|---|---|
| Causa raiz identificada | ✅ VALIDADO EM CÓDIGO |
| Etapa de falha | ✅ InternalAdapter → fabricanteModeloFallback.js:94 |
| Regex com bug | ✅ `\w*` não captura hífen |
| Por que 60KTL funcionava | ✅ Zero sufixo após TL |
| Correção alias aplicada | ✅ VALIDADO EM CÓDIGO |
| Correção orphan aplicada | ✅ VALIDADO EM CÓDIGO |
| Build | ✅ 0 erros |
| Runtime 50KTL-M0 | ⏳ PENDENTE (necessário PDF real em Railway) |
| Runtime 60KTL sem regressão | ⏳ PENDENTE (necessário PDF real em Railway) |
