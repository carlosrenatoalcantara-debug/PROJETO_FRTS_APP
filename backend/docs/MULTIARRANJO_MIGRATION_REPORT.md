# MULTIARRANJO — Relatório de Migração / Compatibilidade

> Como o modelo antigo (`equipamentos.inversor` único) convive com `arranjos[]` **sem
> migração destrutiva** e **sem alterar documentos existentes**.

## Estratégia: adaptação em leitura (não migração em massa)

Nenhum `UPDATE` em massa foi executado. Os documentos antigos permanecem como estão; a
conversão para `arranjos[]` acontece **em tempo de leitura** via `normalizarArranjos`.

```
Projeto LEGADO (no banco, intocado)          Visão normalizada (em runtime)
┌──────────────────────────────┐             ┌────────────────────────────────────┐
│ equipamentos: {              │   adapter   │ arranjos: [{                        │
│   paineis: [ {Jinko 550 x18} ]│  ────────▶  │   id, rotulo:'Arranjo principal',   │
│   inversor: {Growatt MIN 10k} │             │   tipo:'principal', origem:'original',│
│ }                             │             │   topologia:'string',               │
│ // sem arranjos[]            │             │   paineis:[...], inversores:[...],  │
└──────────────────────────────┘             │   dimensionamento:{n_modulos,n_inv} │
                                              │ }]                                  │
                                              └────────────────────────────────────┘
```

## Regras de derivação

| Situação do documento | Resultado de `normalizarArranjos` |
|---|---|
| Tem `arranjos[]` não-vazio | usa-os (enriquecidos com topologia/dimensionamento) |
| Só `equipamentos.paineis/inversor` | deriva **1 arranjo `principal`** (`origem:'original'`) |
| Tem `bess.presente` | inclui `baterias[]` no arranjo derivado |
| Vazio | `[]` (sem erro) |

## Compatibilidade — o que NÃO muda

- **`equipamentos.paineis/inversor`** continua válido e é a fonte do arranjo derivado.
- **Documentos antigos** não são reescritos; abrem normalmente (verificado no Atlas:
  "Sistema FV 3.85 kWp" abre e ganha `arranjos_normalizados` + `totais`).
- **Atlas (catálogo)** intocado.
- **APIs existentes** inalteradas; o GET só **acrescenta** `arranjos_normalizados` + `totais`.

## Caminho de "materialização" (opcional, futuro)

Quando um projeto legado é editado na UI de arranjos, o front passa a gravar `arranjos[]`
explicitamente (via slice `arranjos` já existente). A partir daí o projeto tem arranjos
persistidos; antes disso, segue derivando em leitura. Os dois estados produzem a **mesma**
visão normalizada → zero divergência durante a transição.

## Risco e reversibilidade

- **Risco:** baixo — mudança aditiva, defaults null, sem escrita em documentos legados.
- **Reversível:** remover os campos novos do schema não corromperia dados (todos opcionais).
- **Idempotente:** ler o mesmo projeto N vezes produz o mesmo `arranjos_normalizados`.
