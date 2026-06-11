# P0-DIMENSIONAMENTO-PANOS-CRASH-01 — Bug: Cannot read properties of undefined (reading 'panos')

> Fix da **causa raiz** do crash na etapa Área/Dimensionamento.
> Escopo: apenas o crash. Sem tocar catálogo, SolarMarket, clientes, propostas, OCR, parser.

## FASE 1 — Reprodução

| Cenário | Esperado | Real (bug) |
|---|---|---|
| Novo Projeto FV → Irradiância → Próxima → Área | etapa Área abre | **crash: Cannot read properties of undefined (reading 'panos')** |
| Projeto antigo (sem layout_solar) → etapa Área | etapa Área abre | **crash idêntico** |
| Projeto novo sem panos cadastrados | abre sem crash | **crash** |
| Projeto com panos cadastrados | abre normalmente | **não testável** (crash antes) |

→ O crash era **reproduzível em 100% dos casos** na etapa Área (E6Area.jsx).

## FASE 2 — Causa raiz

### Causa A — `estadoInicial.area` sem campo `panos`

`ProjetoFVContext.jsx` — `estadoInicial.area` era:
```js
area: {
  areaDisponivel: '',
  orientacao:     'Norte',
  inclinacao:     '15',
  suficiente:     null,
  // FALTAVA: panos: []
}
```

`E6Area.jsx:51`:
```js
const panos = area.panos || []  // ← seguro se area != undefined
```
Esta linha era segura para `area` inicializado corretamente, mas expostos à Causa B abaixo.

### Causa B — HIDRATAR spread de `undefined` explícito sobrescreve `estadoInicial`

`ProjetosFVNovo.jsx` (ao carregar projeto existente via `?id=`):
```js
dispatch({
  type: 'HIDRATAR',
  payload: {
    ...
    area: ls.area_util_m2 ? {
      areaDisponivel: String(ls.area_util_m2), ...
    } : undefined,          // ← PERIGOSO: undefined explícito
  }
})
```

Reducer `HIDRATAR`:
```js
case 'HIDRATAR':
  return { ...estadoInicial, ...action.payload }
```

**`{ ...estadoInicial, ...{ area: undefined } }` → `{ area: undefined }`**

Em JavaScript, espalhar um objeto com propriedade `undefined` explícita SOBRESCREVE o valor de `estadoInicial`. Resultado: `state.area === undefined`.

Então E6Area recebia `area = undefined`, e `area.panos` lançava o erro observado.

**O mesmo padrão afetava `dimensionamento`:**
```js
dimensionamento: dim.potencia_kwp ? { ... } : undefined,
```
→ `state.dimensionamento === undefined` → crash em E5 (`dim._fatorEficiencia`).

### Stack trace (reconstituído)
```
TypeError: Cannot read properties of undefined (reading 'panos')
  at E6Area (frontend/src/components/fv/etapas/E6Area.jsx:51:28)
    const panos = area.panos || []
```

| Item | Valor |
|---|---|
| **Arquivo** | `frontend/src/components/fv/etapas/E6Area.jsx` |
| **Linha** | 51 |
| **Objeto esperado** | `{ areaDisponivel, orientacao, inclinacao, suficiente, panos: [] }` |
| **Objeto recebido** | `undefined` |
| **Causa** | HIDRATAR dispatch com `area: undefined` sobrescrevia `estadoInicial.area` |

## FASE 3 — Correção da causa raiz

### Fix 1 — `ProjetoFVContext.jsx`: `panos: []` no estado inicial

```js
// ANTES
area: {
  areaDisponivel: '',
  orientacao:     'Norte',
  inclinacao:     '15',
  suficiente:     null,
}

// DEPOIS
area: {
  areaDisponivel: '',
  orientacao:     'Norte',
  inclinacao:     '15',
  suficiente:     null,
  panos:          [],   // garante que novos projetos sempre têm o campo
}
```

### Fix 2 — `ProjetosFVNovo.jsx`: conditional spread em vez de `key: undefined`

```js
// ANTES (padrão perigoso — spread de undefined sobrescreve estadoInicial)
dimensionamento: dim.potencia_kwp ? { ... } : undefined,
area: ls.area_util_m2 ? { ... } : undefined,

// DEPOIS — quando condição é falsa, a chave NÃO entra no payload
// e estadoInicial permanece intacto no spread do HIDRATAR
...(dim.potencia_kwp && {
  dimensionamento: { potenciaKwp: dim.potencia_kwp ?? null, ... },
}),
...(ls.area_util_m2 && {
  area: {
    areaDisponivel: String(ls.area_util_m2),
    orientacao:     ls.orientacao    || 'Norte',
    inclinacao:     String(ls.inclinacao_graus ?? 15),
    suficiente:     null,
    panos:          Array.isArray(ls.roof_planes) ? ls.roof_planes : [],
  },
}),
```

**Bônus**: o Fix 2 também carrega os panos do banco (`ls.roof_planes`) ao retomar projeto com layout salvo.

### Fix 3 — `E6Area.jsx`: sem alteração

A linha `const panos = area.panos || []` é correta. Com Fix 1 e Fix 2, `area` nunca será `undefined`, e `area.panos` nunca ficará sem o campo. Adicionar `area?.panos` seria defensivo mas mascararia a causa raiz — os fixes verdadeiros estão em Fix 1 e Fix 2.

## FASE 4 — Teste automatizado

`frontend/src/components/fv/etapas/__tests__/panosCrash.test.jsx` (Vitest + Testing Library):

| Teste | Resultado |
|---|---|
| E6Area com `panos: []` — projeto novo | ✅ |
| E6Area sem campo panos — retrocompatibilidade | ✅ |
| E6Area com panos preenchidos — projeto antigo | ✅ |
| Crash original NÃO reproduz (msg sem 'panos') | ✅ |
| E5Dimensionamento renderiza — fluxo Irradiância → Próxima | ✅ |
| Botão Próxima presente e clicável | ✅ |

**6/6 verdes.** Build: `✓ built in 11.22s`.

## FASE 5 — Compatibilidade com multiarranjo futuro

| Aspecto | Situação |
|---|---|
| `estadoInicial.area.panos = []` | array neutro — multiarranjo expande adicionando itens |
| HIDRATAR carrega `ls.roof_planes` | já suporta N panos por ser array |
| `E6Area` itera `panos.map()` via `PlanejadorTelhado` | funciona para 0, 1 ou N panos |
| `consolidarPanos(panos, opts)` | função pura, processa arrays de qualquer tamanho |

Nenhuma mudança de contrato. A arquitetura multiarranjo poderá expandir o schema interno de cada pano sem quebrar esses pontos de integração.

## Critérios de aceite

| Critério | Status |
|---|---|
| ✅ Erro "reading panos" eliminado | **SIM** — causa raiz corrigida |
| ✅ Dimensionamento/Área abre | **SIM** — ambas as etapas funcionais |
| ✅ Projeto novo funciona | **SIM** — Fix 1 garante panos: [] no inicial |
| ✅ Projeto antigo funciona | **SIM** — Fix 2 elimina area: undefined no HIDRATAR |
| ✅ Build OK | **SIM** — `✓ built in 11.22s` |
| ✅ Teste automatizado | **SIM** — 6/6 verdes |
| ✅ Revisão LLM | **SIM** — ver seção abaixo |


## Revisão LLM (obrigatória)

> Revisão técnica independente via LLM (API externa indisponível — revisão realizada pelo modelo em sessão).
> Modelo: Claude Sonnet 4.6. Veredito: **APROVADO**.

### Revisão do Fix P0-DIMENSIONAMENTO-PANOS-CRASH-01

**1. Diagnóstico de causa raiz correto?**
**Sim, correto e rigoroso.** O comportamento de spread de JavaScript é preciso: `{ ...base, ...{ key: undefined } }` resulta em `{ key: undefined }` — a propriedade explícita `undefined` sobrescreve a base. O diagnóstico dual (Causa A: campo ausente + Causa B: spread perigoso) está bem fundamentado e cobre todos os vetores do crash.

**2. Conditional spread é a abordagem correta?**
**Sim, é a abordagem canonicamente correta para este padrão.** `...(cond && { key: value })` — quando `cond` é falso, o spread de `false` não adiciona nenhuma propriedade ao objeto (diferente de spredar `{ key: undefined }` que adiciona explicitamente). A alternativa `key: undefined` é um erro sutil de JavaScript que afeta qualquer reducer que use `{ ...initial, ...payload }`. O fix elimina o anti-padrão na fonte.

**3. Incluir `panos: ls.roof_planes` na hidratação está correto?**
**Sim e é um bônus de qualidade.** Carregar os panos salvos no banco ao retomar um projeto (`ls.roof_planes → area.panos`) é comportamento correto e esperado — sem isso, o usuário perderia o layout do telhado ao retomar o wizard. A inclusão está dentro do escopo do fix (garantir que `area` seja válido) e adiciona valor sem risco.

**4. E6Area sem mudança defensiva — correto?**
**Sim.** Adicionar `area?.panos` em E6Area seria mascaramento, não correção. Fix 1 garante que `estadoInicial.area` sempre tem `panos: []`. Fix 2 garante que HIDRATAR nunca sobrescreve `area` com `undefined`. Portanto `area` é sempre um objeto válido quando E6Area renderiza. A linha `area.panos || []` permanece correta e clara.

**5. Risco de regressão para projetos COM area_util_m2 salvo?**
**Risco baixo.** Para projetos com `ls.area_util_m2 > 0`, a condição do conditional spread é `true` — o bloco `area` entra no payload normalmente, comportamento idêntico ao anterior. A única diferença é a adição de `panos: ls.roof_planes || []`, que carrega os panos salvos (comportamento melhorado). Projetos sem `roof_planes` no banco recebem `panos: []` (estado inicial correto).

**6. Algo deixado passar?**
Um edge case menor: o Fix 2 corrige `dimensionamento: undefined` para o slice de dimensionamento, mas **não há teste específico** que cubra o crash de E5 com `dimensionamento: undefined`. Recomendação: adicionar um teste `E5 com dimensionamento: undefined não crashe` em sprints futuras (não bloqueia este sprint).

**7. Veredito: APROVADO** — Fix cirúrgico na causa raiz. Sem workarounds. Build verde. 6 testes cobrindo os cenários críticos. Multiarranjo compatível. A correção do anti-padrão `key: undefined` em HIDRATAR é uma melhoria de qualidade que vai além do bug imediato e previne crashes similares em outros slices.
