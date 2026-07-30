# P0-DIMENSIONAMENTO-REGRESSION-FORENSICS-01 — Forense do fluxo Novo Projeto FV

> **READ ONLY.** Nenhum código alterado, nenhum commit. Apenas diagnóstico.
> - **Data:** 2026-06-14 · **Executor:** Sonnet · **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE
> - Dados: `DIMENSIONAMENTO_REGRESSION_MATRIX.json`, `DIMENSIONAMENTO_ROOT_CAUSE.json`

## VEREDITO

A regressão central (só aparece **String**; marcas micro/otimizador misturadas) tem **uma causa-raiz
única**: o adaptador do catálogo **hard-codeia a tecnologia como `"string"`**. Os "?W/?kW" são
**122 inversores sem potência** no catálogo. Multiarranjo e quantidade **não regrediram** (estão
implementados / foram realocados). Zoom do mapa é **configuração** (sem cap artificial).

---

## FASE 1 — Tipo de inversor

1. **Onde deveria aparecer [String]/[Micro]/[Otimizado]?** → `frontend/src/components/fv/SeletorInversores.jsx`,
   bloco **"Tipo de Inversor"** (abas geradas por `Object.keys(dataset)`; rótulos/cores `TIPO_ROTULOS`/`TIPO_CORES`
   já definem string/micro/otimizador/híbrido).
2. **Por que só String aparece?** → `frontend/src/utils/catalogoEngenhariaAdapter.js`, função **`agruparInversores`**,
   **linha 98:** `const tipo = 'string'` (comentário: *"Catálogo não traz tipo → assume 'string'"*). **Todo** inversor
   do catálogo é colocado no bucket `string` → o `dataset` só tem a chave `string` → só a aba String renderiza.
3. **O dado existe no catálogo?** → **Parcialmente.** `Equipamento.tipo = 'inversor'` (sem subdivisão). **0 de 175**
   inversores têm `tipo_inversor`/`subtipo`/`tipo` na `especificacoes`. A tecnologia é **derivável** (heurística:
   16 micro / 9 otimizador / 1 híbrido / 149 string), mas **não está armazenada** e o adaptador **não a deriva**.
4. **Frontend filtrando errado?** → **SIM.** Ignora a tecnologia real e força `'string'`.
5. **Regressão de componente?** → **SIM.** O fallback local `INVERSORES_DATA` (mesmo arquivo) tem a **árvore correta**
   (string/micro/otimizador, com micros reais APsystems/Enphase e otimizador SolarEdge). Ao migrar a **fonte** para o
   catálogo Mongo (S8.1), `agruparInversores` colapsou tudo em `'string'`.
6. **Em qual commit desapareceu?** → **Sprint 8.1 — commit `506979e`** ("feat(catalogo): catálogo Mongo como fonte de
   engenharia (E7) + fallback"), quando `agruparInversores` foi criado com o literal `'string'`.

## FASE 2 — Filtro de marcas

1. **Como a tecnologia é armazenada?** → **Não há campo dedicado.** `Equipamento.tipo='inversor'`. (`especificacoes.tipo_inversor`
   existe no leitor de qualidade, mas **0 populados**.)
2. **Catálogo tem classificação correta?** → **NÃO** (0/175).
3. **Quantos por tecnologia (heurística nome/Voc):** **micro 16 · string 149 · otimizador 9 · híbrido 1.**
4. **O filtro está sendo ignorado?** → **SIM** (consequência do hard-code `'string'`). Hoymiles/APsystems/TSUN (micro)
   e SolarEdge (otimizador) caem no bucket String.
5. **Em qual componente ocorre?** → `agruparInversores` (`catalogoEngenhariaAdapter.js`), consumido por `SeletorInversores.jsx`.

## FASE 3 — Potência sumindo ("?")

1. **O dado existe no catálogo?** → **Parcial.** **122/175 inversores SEM potência**; **3/186 módulos** sem potência.
2. **Chega ao frontend?** → **Sim.** `GET /api/equipamentos/engenharia` envia `especificacoes` completas. Vira `'?'`
   quando a potência **não existe** no documento.
3. **Em qual ponto vira undefined?** → quando `especificacoes.potencia_kw|potencia|potencia_ca` ausente (inversor) ou
   `potencia_w|potencia|potencia_wp` ausente (módulo) → cadeia de fallback resolve para `'?'`.
4. **Qual componente renderiza o "?":** → `frontend/src/components/fv/GerenciadorArranjos.jsx:26-27`
   (``${e.potencia_w||e.potenciaW||e.especificacoes?.potencia_wp||'?'}W`` / `…||'?'}kW`). Também badges em `E7Equipamentos.jsx`.
5. **Quantos sofrem isso?** → **~122 inversores (?kW)** + **~3 módulos (?W)**. (Obs.: 15 módulos têm `potencia_w` sem
   `potencia_wp`, mas resolvem via `potenciaW` do adaptador — não viram "?".)

## FASE 4 — Múltiplos arranjos

1. Backend? **SIM** (`ProjetoFV.arranjos[]`). · 2. Frontend? **SIM** (`GerenciadorArranjos` + `ConfiguradorArranjoFV`).
3. Persistência Mongo? **SIM** (`salvarEtapa('arranjos')`). · 4. API? **SIM** (`salvarArranjos`). · 5. Incompleta? **Parcial**
(funcional; degradada por F1/F3). · 6. Escondida? **NÃO** (renderizada em E7). · 7. Quebrada? **NÃO**. · 8. **% implementado: ~85%**
(estrutura completa; a seleção por tecnologia que a alimenta está quebrada).

## FASE 5 — Quantidade de módulos e inversores

1. Suporte manual? **SIM** (`E7`/`ConfiguradorArranjoFV`: módulos/string, strings paralelo, quantidade alvo).
2. Cálculo automático? **SIM** (`E5`: `numPaineis=ceil(kWp·1000/REF_W)`, `numInversores=ceil(kWp/5)`).
3. Persistência? **SIM** (`quantidade_modulos_por_string`, `quantidade`).
4. **Em qual sprint desapareceu?** → **NÃO desapareceu.** Foi **realocada de E5 para E7** (cabeçalho de
   `E5Dimensionamento`: *"REMOVIDO: quantidade/modelo de painéis e inversores (hardware → E7)"*). É **mudança de etapa**, não perda.

## FASE 6 — Mapa e panos

1. **maxZoom configurado?** → **NÃO** explicitamente (sem prop `maxZoom` no `<Map>` de `MapaTelhado.jsx`).
2. **Zoom realmente disponível?** → **SIM** (`zoomControl=true`, `mapTypeId="hybrid"`); zoom inicial `LOCAL_ZOOM=17`; o
   usuário pode ampliar até o máximo do Google.
3. **Limitação Google?** → **SIM** — tiles satélite/híbrido têm maxZoom dependente da região (rural BR às vezes ~19-20).
4. **Limitação do componente?** → **Não impõe cap artificial** (sem `maxZoom`). O incômodo é o **zoom inicial 17** (longe).
5. **Usuário chega ao nível para desenhar telhado?** → **SIM, ampliando manualmente.** Não **inicia** no nível ideal.
6. **vs Google Maps padrão:** equivalente (mesma fonte de tiles via `@vis.gl/react-google-maps`; sem cap extra). Diferença
   prática = **zoom inicial** (17 vs o esperado ~19-20).

## FASE 7 — Classificação

| Item | Classificação |
|---|---|
| F1 — só String | **REGRESSÃO + BUG** (hard-code introduzido em S8.1) |
| F2 — marcas misturadas | **REGRESSÃO** (mesma causa) + **FUNCIONALIDADE INCOMPLETA** (catálogo sem classificação) |
| F3 — "?" potência | **BUG de exibição** + **FUNCIONALIDADE INCOMPLETA** (122 inversores SEM_ESPECIFICACOES) |
| F4 — multiarranjo | **FUNCIONAL** (não-bug; ~85%) |
| F5 — quantidade | **CONFIGURAÇÃO/PERCEPÇÃO** (realocada, não regressão) |
| F6 — zoom | **CONFIGURAÇÃO** (zoom inicial; sem maxZoom) |

## FASE 8 — Priorização

| Prioridade | Item | Esforço | Risco | Dependências |
|---|---|---|---|---|
| **P0 — impede venda** | F1+F2 (só String → não dá para vender projeto micro/otimizador) | **Baixo** (derivar tecnologia no `agruparInversores`, reusando a heurística `tecnologiaInversor` já criada) | Baixo | nenhuma (frontend) |
| **P1 — impede engenharia** | F3 (122 inversores "?kW" → dimensionamento elétrico incorreto) | **Médio** (enriquecimento de datasheet — já em andamento nas waves) | Médio | waves de datasheet |
| **P2 — degrada UX** | F6 (zoom inicial 17 → subir `LOCAL_ZOOM`) · F5 (documentar realocação) · F4 (polish multiarranjo) | Baixo | Baixo | — |

## Entregáveis
- `DIMENSIONAMENTO_REGRESSION_FORENSICS_REPORT.md` (este)
- `DIMENSIONAMENTO_REGRESSION_MATRIX.json` — matriz item × classificação × prioridade
- `DIMENSIONAMENTO_ROOT_CAUSE.json` — causa-raiz + evidência quantitativa

## Conclusão (uma frase por dor)
- **Tipo de inversor:** 1 linha hard-coded (`tipo='string'`) em `agruparInversores` (S8.1) → P0, fix trivial.
- **"?" potência:** 122 inversores sem specs (problema de dado, não de código) → P1, resolvido pelas waves de datasheet.
- **Multiarranjo / quantidade:** existem (realocados); **não houve regressão** — percepção de etapa.
- **Zoom:** sem bug; só o zoom inicial (config).
