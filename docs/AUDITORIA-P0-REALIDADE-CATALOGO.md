# SPRINT P0-REALIDADE-CATALOGO — Auditoria Forense

> Modo: SOMENTE LEITURA. Nenhum dado, coleção, snapshot ou projeto foi alterado.
> Achados por análise estática do código. Itens marcados ⏳ exigem confirmação em
> runtime (sem Mongo/Claude ao vivo neste ambiente).

---

## FASE 1 — Fluxo de Inversores (onde quebra)

### Mapa do fluxo
```
ModalNovoInversor.processarItem()           frontend/.../ModalNovoInversor.jsx:66
  └─ POST /api/datasheet/extrair-datasheet   → routes/datasheet.js:18
       └─ datasheetController.extrairDatasheet  controllers/datasheetController.js:537
            ├─ OCR (PDFParse)                    datasheetController.js (textoOCR)
            ├─ extrairComClaude (Claude API)     datasheetController.js:585 — exige ANTHROPIC_API_KEY
            │   └─ (falha) extrairPorTexto       datasheetController.js:612
            ├─ fallback regex server-side        datasheetController.js:642
            └─ normalizar() → { sucesso, dados } datasheetController.js:531
  ← resposta { dados, texto_extraido, _diagnostico }
  └─ regex fallback client-side                ModalNovoInversor.jsx:88
  └─ guard IMPORTACAO_FALHOU (BOTH lixo)       ModalNovoInversor.jsx:104
  └─ POST /api/equipamentos                    ModalNovoInversor.jsx:184
       └─ criarEquipamento                       controllers/equipamentosController.js:168
            └─ guard 422 (EITHER lixo)            equipamentosController.js:190-201
            └─ Equipamento.save()                 equipamentosController.js:214
Listagem:
  Inversores.carregarInversores()             frontend/.../Inversores.jsx:202
  └─ GET /api/equipamentos?tipo=inversor&ativo=true
```

### Onde quebra — DUAS causas de código confirmadas

**CAUSA 1 — Assimetria do guard de "lixo" (gap de validação)** — P0
- `ModalNovoInversor.jsx:104` aborta **só se fabricante E modelo forem lixo** (`&&`).
- `equipamentosController.js:194` rejeita com **422 se fabricante OU modelo for lixo** (`||`).
- **Consequência:** se a extração trouxer fabricante bom mas modelo lixo (ex.: `"Deye" + "Inversor"`, comum quando Claude/parser acerta a marca mas erra o modelo), o **modal aceita e faz POST**, mas o **backend devolve 422** → `ModalNovoInversor.jsx:189` lança genérico `"Erro ao salvar no banco"`. O inversor **não é persistido** e o usuário vê um erro vago (ou nem percebe entre vários itens).

**CAUSA 2 — Inversores não têm coleção de fallback** — explica a assimetria com carregadores
- Carregadores: `carregadoresEV.js /upload-datasheet` salva **server-side** direto em `CarregadorEV` (e espelha em `Equipamento`), **sem passar pelo guard 422** de `criarEquipamento`. A listagem lê `CarregadorEV` via fallback → **sempre aparecem**.
- Inversores: dependem do **POST do frontend** para `criarEquipamento`, que **tem** o guard 422. Não há coleção `Inversor` legada para mascarar a falha. Por isso "carregador funciona, inversor não".

### Respostas diretas
| Pergunta | Resposta |
|---|---|
| OCR falha? | ⏳ Não necessariamente. `texto_extraido` é exposto (datasheetController.js:683). Confirmar `_diagnostico.ocr_chars` em runtime. |
| Parser falha? | Parcial. `detectarModelo` (datasheetController.js:246) **só tem padrões de MÓDULO** (ZXMR/JKM/CS…), **nenhum de inversor** (SUN-/RHI-/MIC-). Sem Claude, modelo de inversor = null → depende do regex fallback. |
| Persistência falha? | **SIM, em caso de modelo/fabricante parcialmente lixo** → 422 silencioso (CAUSA 1). |
| Grava em coleção errada? | Não. Grava (ou tenta) em `Equipamento{tipo:'inversor'}` — correto. |
| Grava mas UI não encontra? | Improvável: query alinhada (`tipo:'inversor'`, normalizado em CAT-P0-UNIFY). pre-save hook **nunca** seta `ativo:false` (catalogoQualidade.js:329-346 sempre `pode_ser_selecionado:true`). |

---

## FASE 2 — Auditoria de coleções

| Coleção | Existe? | Tipos | Origem das telas |
|---|---|---|---|
| `Equipamento` | ✅ | modulo, inversor, carregador_ev, bateria, estrutura | FV proposta, FV wizard, Inversores |
| `CarregadorEV` | ✅ (legada/paralela) | carregador EV | EV proposta + Carregadores (via fallback) |
| `Inversor` | ❌ **NÃO EXISTE** | — | — |
| Snapshots | dentro de `ProjetoFV.governanca` e `ProjetoEV.snapshot_carregador` | — | imutáveis |

**Quantidade real:** ⏳ requer Mongo ao vivo. Endpoint pronto: `GET /api/catalogo/diagnostico` (CAT-P0-UNIFY) conta por origem.

**Origem dos dados por tela:**
| Tela | Origem real |
|---|---|
| Equipamentos > Inversores | `Equipamento{tipo:inversor}` — sem fallback (vazio = vazio) |
| Equipamentos > Carregadores | `CarregadorEV` via fallback (equipamentosController.js:170+) |
| Projeto FV (NovaProposta) | `Equipamento` via `/api/equipamentos?tipo=inversor&ativo=true` (NovaProposta.jsx:339) — sem INVERSORES_DATA |
| Projeto FV (wizard E7) | `Equipamento` **+ fallback INVERSORES_DATA hardcoded** (SeletorInversores.jsx) — controlado por flag desde CAT-P0-UNIFY |
| Projeto EV | `CarregadorEV` via `/api/carregadores-ev` |

---

## FASE 3 — Projeto FV (resumo / documentos / unifilar)

### "Unifilar exibiu dados de outro projeto" — P0 (causa raiz encontrada)
- **Chave do localStorage por NOME, não por ID.** No wizard EV (`NovaPropostaEV` via `InteractiveDiagramWrapper`) e em fluxos de proposta, o diagrama é salvo com chave `proposta-${dados.nome_projeto}` (`diagramPersistence.salvarDiagramaLocal`, chave `diagrama_${projetoId}`).
- **Arquivo:** `frontend/src/components/diagram/utils/diagramPersistence.js:29` (`const chave = ${STORAGE_PREFIX}${projetoId}`).
- **Causa raiz:** quando o `projetoId` passado é o **nome do projeto** (ou vazio), **dois projetos com o mesmo nome compartilham a mesma chave** → o segundo carrega o diagrama do primeiro. Em `ProjetosFVDetalhes.jsx:55` a chave é correta (`projeto-fv-${id}` com `_id` estável), mas no fluxo de **criação/proposta** a chave deriva do nome.
- **Severidade:** P0 — dados cruzados entre projetos.

### "Resumo / documentos não recebem dados recém-salvos" — P1 ⏳
- `ProjetosFVDetalhes.carregarProjeto()` (`ProjetosFVDetalhes.jsx:40`) faz `fetch('/api/projetos-fv/${id}')` no mount. `AbaResumo` recebe `projeto` por prop.
- **Hipótese (requer runtime):** o wizard de criação grava parte dos dados no **Context/localStorage** mas o `id` navegado aponta para um documento Mongo que ainda **não tem** os campos (persistência incremental por slice). O detalhe busca do Mongo → campos ausentes. Não é cache HTTP; é **timing entre o save incremental e a navegação**. Confirmar com o payload real do POST e o `_id` retornado.

---

## FASE 4 — Microinversores (validação ausente) — P1 confirmado

- **Exemplo do usuário:** 20 módulos / 5 microinversores aceito.
- **Onde deveria bloquear:** `E7Equipamentos.validar()` (`E7Equipamentos.jsx:81-87`) **só verifica se painel/inversor/estrutura estão selecionados**. Não há nenhuma checagem de:
  - razão módulos ÷ microinversores (típico 1–4 módulos por micro),
  - `especificacoes.max_por_cabo_tronco`,
  - potência do módulo vs potência de entrada do micro.
- **Busca ampla:** nenhum arquivo em `frontend/src` ou `backend/src` (fora de testes) implementa `validarString`/`modulos_por_mppt`/limite de micros. **A validação física simplesmente não existe.**
- **Severidade:** P1 — aceita configuração fisicamente inválida, mas não corrompe dados nem cruza projetos.

---

## FASE 5 — Classificação dos bugs reproduzidos

| ID | Bug (reproduzido pelo usuário) | Causa raiz (arquivo:linha) | Severidade |
|---|---|---|---|
| B1 | Inversor não aparece após upload | 422 assimétrico: modal `&&` (ModalNovoInversor.jsx:104) vs backend `||` (equipamentosController.js:194); sem coleção de fallback | **P0** |
| B2 | Unifilar exibe dados de outro projeto | Chave localStorage por nome, não por `_id` (diagramPersistence.js:29 + uso no fluxo de proposta) | **P0** |
| B3 | Resumo/Documentos sem dados recém-salvos | Timing save-incremental ↔ navegação; detalhe busca Mongo antes do slice persistir ⏳ | **P1** |
| B4 | Microinversor aceita config inválida (20 mód / 5 micro) | `E7Equipamentos.validar()` não valida razão módulo/micro (E7Equipamentos.jsx:81) | **P1** |
| B5 | Parser de texto sem padrões de modelo de inversor | `detectarModelo` só tem padrões de módulo (datasheetController.js:246) | **P2** |

**Bugs já resolvidos (não reproduzir):**
- DELETE /api/equipamentos/undefined — corrigido em CAT-P0-UNIFY (fallback com `_id` + guarda de id).
- Carregadores EV: exclusão/OCR/catálogo — operacional (confirmado pelo usuário).

---

## Conclusão técnica

**Causa central da assimetria inversor×carregador:** carregadores têm coleção
legada `CarregadorEV` que mascara qualquer falha (sempre aparece via fallback);
inversores dependem do POST do frontend ao `criarEquipamento`, que rejeita com
**422 silencioso** quando fabricante OU modelo é parcialmente lixo — e não há
fallback. O fluxo "termina" porque o modal trata o 422 como erro de item, sem
interromper a fila.

**Dois P0 distintos:**
1. **Persistência de inversor** (gap de validação 422 + ausência de fallback).
2. **Cruzamento de unifilar entre projetos** (chave de localStorage por nome).

Nenhum desses corrompe snapshots existentes — os snapshots em `governanca` são
imutáveis e não foram tocados. A integridade histórica está preservada.

**Recomendação:** corrigir B1 e B2 (P0) numa sprint de correção dedicada, com:
- alinhar o guard de lixo (modal e backend usarem o mesmo critério) e exibir o
  motivo exato do 422 ao operador;
- trocar a chave de diagrama para sempre usar o `_id` do projeto (nunca o nome).
B4 (microinversor) e B3 (timing) entram como P1 na mesma sprint ou na seguinte.

> Nenhuma alteração de código foi feita nesta sprint de auditoria.
