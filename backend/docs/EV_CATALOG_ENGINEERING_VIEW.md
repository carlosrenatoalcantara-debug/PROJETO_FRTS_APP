# EV_CATALOG_ENGINEERING_VIEW.md

**Sprint:** P0-EV-CATALOG-ENGINEERING-VIEW-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-25
**Commits:** `3e60aee` (View de Engenharia) · correção de dado BelEnergy (runtime)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  build de produção do frontend OK (vite). Chaves dos blocos alinhadas ao doc derivado.
VALIDADO EM RUNTIME: a View consome /api/equipamentos?tipo=carregador-ev (origem=carregador_ev_fonte_unica);
                     12/24 campos preenchidos por carregador (resto → "Não informado"); BelEnergy corrigido.
NÃO TESTADO:         render no navegador (sem proxy local p/ Railway); validado por build + alinhamento de dados.
NÃO ALTERADO:        CarregadorEV (model), SSOT, Mapper, OCR, Score, persistência (arquitetura), projetos EV.
```

## View de Engenharia (apresentação)
Reestruturado o card expandido do catálogo (`frontend/src/pages/CarregadoresEV.jsx`) em **12 blocos**:
Identificação · Entrada Elétrica · Saída · Conectores · Comunicação · Protocolos · Controle · Proteções ·
Mecânica · Ambiental · Certificações · Garantia.

- **Todos os campos do modelo são exibidos**; valor ausente → **"Não informado"** (itálico).
- **Nunca oculta** (removido o `filter(... != null)` que escondia campos vazios).
- **Nunca concatena** atributos distintos; **nunca infere** (rótulos como "Monofásico" são apresentação
  fiel do valor armazenado `numero_fases`, não inferência).

### Bug REAL corrigido (chaves desalinhadas)
A View lia chaves que **não existem** no doc derivado (SSOT): `tensao_entrada`, `eficiencia`,
`dimensoes`, `tipo_conector_saida` — enquanto o mapper produz `tensao_entrada_v`, `eficiencia_pct`,
`dimensoes_mm`, `tipo_conector`. Por isso quase tudo aparecia vazio. Chaves **realinhadas** e
adicionados `tipo_carregador`, `qtd_conectores`, `ocpp` (antes ausentes da tela).

## AUDITORIA OBRIGATÓRIA — BelEnergy CVBE-MO-220V-7 (trifásico errado)
**Causa raiz determinada: OCR.**
- `carregadorEVControllerGemini.js:150-172` (detecção de fases): o regex de **trifásico**
  (`TRIFÁSICO|THREE PHASE|3 FASES|3F\+N`) casou no texto do datasheet do BelEnergy → `numero_fases=3`;
  a **normalização** (`:358` `numero_fases===3 → tipo='AC_Tri'`) derivou o tipo trifásico.
- **Mapper:** fiel (repassa `numero_fases`). **View:** fiel (exibia `3 → Trifásico` corretamente para o
  dado armazenado). → Nem Mapper nem View originam o erro.
- O modelo "**MO**" = monofásico, 220 V, 7,4 kW (≈ 32 A mono) — coerente com o datasheet (mono/bifásico).

**Remediação (sancionada pela auditoria):** como **OCR está na lista "Não alterar"**, a correção foi no
**DADO** (não no código OCR): `PUT /api/carregadores-ev/:id` → `tipo: AC_Mono`, `numero_fases: 1`
(valor do datasheet, **não inventado**). Runtime: ANTES `AC_Tri/3` → DEPOIS `AC_Mono/1`.

> **Bug latente de OCR permanece** (regex de fase false-positivo). Corrigi-lo exige tocar OCR →
> fica para uma sprint com OCR no escopo (proposta: `P1-EV-OCR-PHASE-DETECTION-FIX-01`).

## CRITÉRIOS DE ACEITE — aferição
| Critério | Status |
|---|---|
| Todos os campos de CarregadorEV exibidos | ✅ 12 blocos, "Não informado" quando vazio |
| Os três carregadores evidenciam diferenças técnicas | ✅ a View expõe todos os campos (diferenças reais aparecem; os 3 atuais são 7,4 kW mono Type 2, logo diferem em modelo/IP/temperatura/frequência) |
| Zero alteração na persistência (arquitetura) | ✅ (apenas 1 correção de valor de dado, mandada pela auditoria) |
| Zero alteração no SSOT | ✅ |
| Zero alteração no OCR | ✅ (root cause identificado, não alterado; corrigido o dado) |
| Zero alteração no Score | ✅ |
| Zero regressão | ✅ build OK; leitura via fonte única; nada removido do modelo |

## RESPOSTA À AUDITORIA (origem do trifásico)
1. **OCR?** SIM — causa raiz (regex de fase false-positivo).
2. **Normalização?** Consequência (tipo derivado de numero_fases=3).
3. **Mapper?** Não (fiel).
4. **View?** Não (fiel ao dado armazenado).
**Correção aplicada:** dado (AC_Mono/1 fase), pois OCR é off-limits nesta sprint.
