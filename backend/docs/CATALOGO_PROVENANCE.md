# P1-CATALOG-PROVENANCE-01 — Restabelecimento da rastreabilidade

> Escopo exclusivo: **proveniência**. Sem alterar OCR, parsers, dimensionamento, unifilar, parecer ou catálogo técnico (SSOT).
> Fonte auditada: **Atlas `iva0pph` / `forte_solar` / `equipamentos`** (95 docs).

## FASE 1 — Pontos de criação de equipamentos (mapa)

| Caminho | Arquivo | Setava `origem.tipo`? |
|---|---|---|
| POST manual (cadastro/ficha) | `equipamentosController.js:criarEquipamento` | ❌ não → corrigido |
| Importação em lote | `equipamentosController.js` (loop) | ❌ não → corrigido |
| Sync de carregador EV (3 rotas) | `routes/carregadoresEV.js` | ❌ não → corrigido |
| Import SolarMarket | `integracoes/solarmarket/normalizer.js` → `deduplicator.js` | ✅ `import_solarmarket` |
| Enriquecimento via datasheet | `services/catalogoDatasheetEnriquecimento.js` | ✅ `datasheet_gemini` |
| Seeds | `seeds/initial.js` | — (dados de exemplo) |

**Causa-raiz (confirmada):** os caminhos de criação principais não setavam `origem`, e o hook `pre('save')` em `catalogoQualidade.js:439-441` defaultava `origem.tipo='desconhecido'` → 95/95 documentos ficaram `desconhecido`.

## FASE 2 — Correção da criação (novos registros)

Adicionado helper `resolverOrigem(body, fallback)` (validado contra o enum do schema):
`manual · datasheet_gemini · datasheet_pdfparse · import_planilha · import_solarmarket · import_legado · desconhecido`.

- **POST manual** e **lote** → `origem.tipo` do hint válido enviado pelo cliente (ex.: fluxo de datasheet envia `datasheet_pdfparse`/`datasheet_gemini`); **sem hint → `manual`** (a ação no catálogo é humana — evidência da ação, não chute).
- **Carregadores EV (sync)** → `import_legado` (catálogo embutido importado programaticamente).
- Hint **fora do enum** (ex.: `ocr`) cai no fallback — nunca grava valor inválido.

Como `origem.tipo` agora é setado na criação, o default `'desconhecido'` do hook **deixa de vencer** para novos registros.

## FASE 3 — Estratégia de backfill (só com evidência)

Categorias permitidas mapeadas ao enum do schema. Evidência aceita por documento:
`datasheet_original.origem` · `origem.fonte` (ex.: solarmarket) · `validacao.historico` (eventos `import` / `reprocessamento_gemini` / `correcao_manual`).
**Proibido adivinhar:** sem prova registrada → mantém `desconhecido`.

## FASE 4 — Backfill executado (antes → depois)

Inventário de evidência nos 95 docs: `origem.fonte = 0` · `datasheet_original = 0` · `documentos_tecnicos = 0` · `fonte_dados = 0` · `validacao.historico` só `validacao_automatica`. **Nenhum documento tem evidência registrada de proveniência.**

| | Antes | Depois |
|---|---|---|
| `desconhecido` | 95 | **95** |
| classificados | 0 | **0** |

→ **0 documentos backfillados** (0 com evidência). Decisão correta por "proibido adivinhar" e pelo critério "desconhecido mantido quando não houver prova". **Nenhuma escrita no Atlas** (o que seria adivinhação foi recusado).

## FASE 5 — Validação no Atlas real

Distribuição final de `origem.tipo` (real, lida do Atlas): **`desconhecido`: 95**. Inalterada e correta — os registros legados não carregam prova de origem; a rastreabilidade passa a valer para **registros futuros** via FASE 2.

## FASE 6 — Compatibilidade

- Mudança puramente **aditiva** (seta um campo na criação); não altera leitura, dimensionamento, SSOT, parsers.
- Testes: **588 passed** (+6 de `provenance.test.js`); 14 falhas pré-existentes de `diagram` (jsdom) inalteradas.
- Build: **OK**.

## Conclusão

- **Novos** equipamentos passam a registrar `origem.tipo` corretamente (manual/datasheet/import).
- **Antigos** permanecem `desconhecido` por ausência de prova (sem adivinhação).
- Recomendação para realizar a proveniência ponta-a-ponta no fluxo de datasheet: o **frontend** deve enviar `origem.tipo` (`datasheet_pdfparse`/`datasheet_gemini`) ao salvar a partir da importação assistida — backend já aceita o hint.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

**Revisão Sprint P1-CATALOG-PROVENANCE-01 (Rastreabilidade de Origem)**

**Avaliação:**

1.  **Correção de Criação (`resolverOrigem`):** A lógica do helper `resolverOrigem` é correta e segura. Utiliza um enum validado (`ORIGENS_VALIDAS`) para definir o `origem.tipo`. O fallback para `'manual'` quando não há hint válido é apropriado, pois reflete a ação humana direta no catálogo. A atribuição de `'import_legado'` para sync de carregadores EV é específica e justificada. A validação contra o enum impede a gravação de valores inválidos.

2.  **Decisão de NÃO fazer Backfill:** A decisão de não realizar backfill em nenhum dos 95 documentos é correta e respeita estritamente o princípio de "proibido adivinhar". A ausência total de evidências registradas (`origem.fonte`, `datasheet_original`, `validacao.historico`) torna qualquer tentativa de atribuir uma origem um chute. Manter como `'desconhecido'` é a abordagem mais segura e honesta.

3.  **Riscos/Regressões:** Os riscos são mínimos. A mudança é aditiva e focada na criação de novos registros. Não há alteração em OCR, parsers ou SSOT. A compatibilidade com leituras existentes é mantida. O principal risco seria a falta de adoção do novo campo em fluxos futuros, mas a recomendação de envolver o frontend mitiga isso.

**Veredito:**

**APROVADO**

A sprint abordou com rigor e segurança a complexa tarefa de restabelecer a rastreabilidade de origem. A correção na criação de novos registros é robusta, e a decisão de não realizar backfill em dados sem evidência é exemplar, alinhada com as melhores práticas de integridade de dados. A estratégia de focar a correção em novos registros, enquanto mantém os antigos como `'desconhecido'` por falta de prova, é a abordagem mais prudente. A recomendação para o frontend é um passo lógico para aprimorar a rastreabilidade ponta-a-ponta.
