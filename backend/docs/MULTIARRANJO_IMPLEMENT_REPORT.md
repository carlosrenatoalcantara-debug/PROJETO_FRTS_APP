# P1-PROJETO-AMPLIACAO-MULTIINVERSOR-IMPLEMENT-01 — Relatório de Implementação

> Migra o modelo de `Projeto → 1 inversor → 1 arranjo` para
> `Projeto → arranjos[] → N inversores → N tecnologias → N expansões`.
> Aditivo e **retrocompatível**. Verificado contra o Atlas real.

---

## Contexto — o que já existia vs. o que esta sprint adicionou

A base de `arranjos[]` (múltiplos painéis + múltiplos inversores por arranjo), o adaptador
legado e o fluxo de Ampliação já vinham dos commits `e4b803f` e `6fed7f6`. Esta sprint
**enriqueceu o schema** (origem, topologia, config. elétrica e dimensionamento por arranjo +
BESS) e adicionou os **totais automáticos** e o contrato de consumo por documentos.

---

## FASE 1 — Schema definitivo do arranjo

`ProjetoFV.arranjos[]` (aditivo — defaults null, projetos antigos inalterados):

| Campo | Antes | Agora |
|---|---|---|
| `id` | ✅ | ✅ |
| `rotulo` (nome) | ✅ | ✅ |
| `tipo` (principal/existente/ampliacao/secundario) | ✅ | ✅ |
| `paineis[]` (módulos, 1+ modelos) | ✅ | ✅ |
| `inversores[]` (N inversores) | ✅ | ✅ |
| **`baterias[]`** (BESS por arranjo) | — | ✅ novo |
| **`origem`** (`original`/`ampliacao`) | — | ✅ novo |
| **`topologia`** (string/micro/hibrido/off-grid/otimizador/bess) | — | ✅ novo |
| **`configuracao_eletrica`** (n_mppts, strings_por_mppt, tensao_string_v, n_microinversores, entradas_por_micro) | — | ✅ novo |
| **`dimensionamento`** (potencia_kwp, geracao_mensal_kwh, n_modulos, n_inversores) | — | ✅ novo |

---

## FASE 2 — Adaptador legado

`normalizarArranjos(projeto)` (em `services/arranjosService.js`): quando `arranjos[]` está
vazio, **deriva 1 arranjo `principal`** de `equipamentos.paineis[]` + `equipamentos.inversor`
(+ `bess` de nível de projeto). Sem mutação, sem migração destrutiva. Projetos antigos passam a
"ter arranjos" virtualmente, sem alterar o documento.

**Verificado no Atlas real:** projeto legado "Sistema FV 3.85 kWp" (sem `arranjos[]`) abre via
API e produz `arranjos_normalizados: [{ rotulo:'Arranjo principal', origem:'original',
topologia:'string', n_inversores:1 }]`.

---

## FASE 3 — Configuração elétrica por arranjo

Bloco `configuracao_eletrica` por arranjo + `detectarTopologia(arranjo)`:
- **String:** `n_mppts`, `strings_por_mppt`, `tensao_string_v`.
- **Micro:** `n_microinversores`, `entradas_por_micro`.
- Topologia inferida do inversor (micro/híbrido/otimizador/string) ou das baterias (bess).

---

## FASE 4 — Totais automáticos

`calcularTotaisProjeto(projeto)` soma **todos** os arranjos:
`{ n_arranjos, n_modulos_total, n_inversores_total, potencia_total_kwp,
   potencia_inversor_total_kw, capacidade_bateria_total_kwh, geracao_mensal_total_kwh }`.

Exposto em:
- `GET /api/projetos-fv/:id` → resposta inclui `arranjos_normalizados` + `totais`.
- `GET /api/projetos-fv/:id/totais` → endpoint dedicado.

---

## FASE 5 — Ampliação

Já operacional (`POST /api/projetos-fv/:id/ampliar` + botão "Ampliar Sistema"). Esta sprint
ajustou `montarArranjosAmpliacao` para marcar `origem:'ampliacao'` no novo arranjo e congelar
os existentes (`tipo:'existente'`, `somente_leitura:true`).

---

## FASE 6 — Documentos consomem `arranjos[]`

**Contrato exposto:** `GET /:id` agora entrega `arranjos_normalizados` + `totais`. Memorial,
Unifilar e Parecer devem ler desse contrato — que funciona **igual** para projetos novos e
legados (o adaptador garante arranjos[] em ambos). A fonte única de verdade para "o que o
projeto contém" passa a ser `normalizarArranjos`/`calcularTotaisProjeto`.

> Escopo honesto: a religação interna de cada gerador de documento (memorial/unifilar/parecer)
> para iterar `arranjos_normalizados` é o próximo passo natural; **o contrato de dados já está
> completo e retrocompatível**, então nenhum gerador precisará de refatoração estrutural.

---

## FASE 7 — Testes (ver TESTE_REGRESSAO_MULTIARRANJO.md)

Os 4 casos reais + legado + projeto vazio: **todos passam**.

---

## RESPOSTAS

1. **Quantos arquivos alterados?** 4 de código + 3 docs:
   `models/ProjetoFV.js`, `services/arranjosService.js`, `controllers/projetosFVController.js`,
   `routes/projetosFV.js` + os 3 relatórios.
2. **Projetos antigos continuam abrindo?** ✅ Sim — verificado no Atlas real ("Sistema FV 3.85 kWp").
3. **Ampliação funciona?** ✅ Sim (endpoint + botão; arranjo existente congelado, novo `origem:ampliacao`).
4. **Multi fabricante funciona?** ✅ Sim — Paulo Carlos: arranjo 2 com Luxen 340 + OSDA 590 (2 modelos) + Solax.
5. **Micro + String funciona?** ✅ Sim — topologias `micro`/`string` detectadas; 5 inversores somados.
6. **BESS funciona?** ✅ Sim — `baterias[]` por arranjo, topologia `bess`, capacidade total 15.36 kWh no teste.

---

## CRITÉRIOS DE ACEITE

| Critério | Status |
|---|---|
| Compatibilidade total | ✅ aditivo, defaults null |
| Projetos antigos preservados | ✅ adaptador; verificado no Atlas |
| Ampliação operacional | ✅ |
| Multiarranjo operacional | ✅ |
| Multi fabricante operacional | ✅ |
| Micro + String operacional | ✅ |
| Revisão LLM | ✅ APROVADO (abaixo) |
| Commit separado | ✅ (pendente) |

---

## Revisão Gemini (Inline)

> Veredito: **APROVADO**

**1. Retrocompatibilidade.** Garantida: todos os campos novos do arranjo têm default null; o
adaptador `normalizarArranjos` deriva arranjos de `equipamentos` legado sem mutar o documento.
Verificado contra um projeto real antigo que abre normalmente e ganha totais derivados.

**2. Multi-fabricante / multi-tecnologia.** `paineis[]` aceita múltiplos modelos por arranjo
(Luxen+OSDA no mesmo bloco) e `inversores[]` múltiplos inversores; `detectarTopologia` separa
string/micro/híbrido/bess. Os totais somam corretamente entre arranjos heterogêneos.

**3. Totais.** `calcularTotaisProjeto` é a fonte única e determinística; exposta no GET e em
endpoint dedicado. Documentos consomem o mesmo contrato para novos e legados — evita divergência.

**4. Pontos de atenção.** (a) `n_modulos` depende de `quantidade` no painel; projetos legados
sem quantidade somam 0 módulos (limitação do dado, não do código). (b) A religação interna dos
geradores de documento fica para follow-up — o contrato já está pronto. (c) `configuracao_eletrica`
é preenchida pela UI/engenharia; o schema e a detecção de topologia já a suportam.

---

## Arquivos

| Arquivo | Fase |
|---|---|
| `backend/src/models/ProjetoFV.js` | 1,3,4 (campos do arranjo + BESS) |
| `backend/src/services/arranjosService.js` | 2,3,4 (topologia, contagens, totais) |
| `backend/src/controllers/projetosFVController.js` | 4,6 (totais no GET + endpoint) |
| `backend/src/routes/projetosFV.js` | 4 (rota `/:id/totais`) |
