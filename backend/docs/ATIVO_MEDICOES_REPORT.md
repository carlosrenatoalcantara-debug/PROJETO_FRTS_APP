# ATIVO_MEDICOES_REPORT.md

**Sprint:** P5-ATIVO-MEDICOES-01
**Modelo:** Sonnet
**Data:** 2026-06-19
**Revisão Gemini:** Opcional

---

## OBJETIVO

Adicionar `medicoes[]` ao AtivoEquipamento — histórico de medições elétricas realizadas em campo (Voc, Isc, Vac, Iac, Potência), com observações livres, link externo para foto/documento e identificação do técnico.

A Forte Solar funciona como repositório de registros técnicos. Fotos e documentos são referenciados por link externo (OneDrive, Drive, etc.) — nunca armazenados na plataforma.

---

## FASE 1 — FORENSE

### Onde armazenar as medições

**Decisão: subdocumento embutido em AtivoEquipamento (array `medicoes[]`)**

Justificativa:
- Medições pertencem ao equipamento, não ao projeto
- Volume esperado: dezenas por ativo ao longo de anos (sem explosão de registros)
- Sem necessidade de querying cross-ativo
- Mesmo padrão do `historico[]` — embutido, append-preferencial
- `documentos: [Mixed]` já existia como RESERVADO → `medicoes[]` é um novo array tipado distinto

### Campo RESERVADO intacto

`AtivoEquipamento.documentos` não foi alterado. É distinto de `medicoes[]`.

---

## FASE 2 — SCHEMA

### `MedicaoSchema` adicionado em `backend/src/models/AtivoEquipamento.js`

```js
const MedicaoSchema = new mongoose.Schema({
  data:      { type: Date,   default: () => new Date() },
  tipo: {
    type: String,
    enum: ['COMISSIONAMENTO', 'GARANTIA', 'SUPORTE', 'AMPLIACAO', 'INSPECAO', 'OUTRO'],
    default: 'OUTRO',
  },
  observacao: { type: String, default: null },
  voc:        { type: Number, default: null },   // tensão em circuito aberto (V)
  isc:        { type: Number, default: null },   // corrente de curto-circuito (A)
  vac:        { type: Number, default: null },   // tensão AC (V)
  iac:        { type: Number, default: null },   // corrente AC (A)
  potencia:   { type: Number, default: null },   // potência (W)
  link_foto:  { type: String, default: null },   // link externo (OneDrive, Drive…)
  usuario:    { type: String, default: null },
})
```

**Campo adicionado ao schema principal:**
```js
medicoes: { type: [MedicaoSchema], default: [] },
```

**Adição ao enum de `HistoricoSchema`:**
```js
enum: ['criacao', ..., 'mudanca_status', 'medicao']
```

**Compatibilidade total:**
- Ativos existentes lêem `medicoes: []` sem erro (default: [])
- Nenhuma migração necessária
- Aditivo puro — sem alterar campos existentes

---

## FASE 3 — ENDPOINTS

### Rotas adicionadas em `backend/src/routes/ativos.js`

| Método | Rota | Função |
|---|---|---|
| POST | `/api/ativos/:id/medicoes` | `adicionarMedicao` |
| GET | `/api/ativos/:id/medicoes` | `listarMedicoes` |
| PUT | `/api/ativos/:id/medicoes/:medicaoId` | `atualizarMedicao` |
| DELETE | `/api/ativos/:id/medicoes/:medicaoId` | `removerMedicao` |

Todas as rotas ficam **antes** de `GET /:id` (para não ser capturada pela rota genérica).

### Comportamento dos endpoints

- `POST` — cria medição, registra evento `tipo: 'medicao'` no historico[]
- `GET` — retorna lista em ordem reversa (mais recente primeiro)
- `PUT` — atualiza campos da medição específica por `_id`
- `DELETE` — remove medição e registra evento no historico[]

---

## FASE 4 — CONTROLLER

**Funções adicionadas em `ativosController.js`:**

- `adicionarMedicao` — valida DB, cria subdoc, salva historico, retorna medicao
- `listarMedicoes` — projection `'medicoes'`, retorna em ordem reversa
- `atualizarMedicao` — usa `.id(medicaoId)` de Mongoose para localizar subdoc
- `removerMedicao` — usa `splice(idx, 1)`, registra historico

Campos numéricos (voc/isc/vac/iac/potencia): `''` e `null` tratados como ausência → armazenados como null.

---

## FASE 5 — FRONTEND

### `frontend/src/components/fv/MedicoesAtivoCard.jsx` (CRIADO)

- Estado: lista de medições, form aberto/fechado, editando (id ou null), salvando
- "Última medição": card destacado em verde (emerald-50) sempre visível quando existe medição
- "Ver histórico": botão expansível para demais medições
- Form: tipo (select), data, observação, Voc/Isc/Vac/Iac/Potência (number), link_foto (url), técnico
- Link foto: `target="_blank" rel="noopener noreferrer"` — abre em nova aba
- Editar/Remover: disponíveis para última medição (inline) e para cada item do histórico

### Integração em `AtivoQR.jsx`

- Import: `MedicoesAtivoCard from '../components/fv/MedicoesAtivoCard'`
- Posição: após `<MonitoramentoCard>`, antes do `{/* Histórico */}`
- Condicional: `{dados.ativo?._id && <MedicoesAtivoCard ativoId={dados.ativo._id} />}`

---

## FASE 6 — UX

| Situação | Exibição |
|---|---|
| Sem medições | Card com "Nenhuma medição registrada." + botão Nova medição |
| 1 medição | Destaque "Última medição" em verde |
| N medições | Última destacada + botão "Ver histórico (N-1 medição/ões)" expansível |
| Form novo | Campos de entrada + Cancelar/Salvar |
| Form editar | Mesmos campos pré-preenchidos |

---

## FASE 7 — REGRESSÃO

| Área | Status |
|---|---|
| ProjetoEV | Não tocado |
| QR / EtiquetaScanner | Intacto |
| Comissionamento | Intacto — MedicoesAtivoCard é paralelo, não sobrescreve |
| Monitoramento | Intacto — card mantido, medições adicionadas após |
| Segurança (AES-256-GCM) | Não afetada — medicoes[] não tem campos sensíveis |
| Snapshot / Governança | Não afetados |
| Homologação | Não afetada |
| Build frontend | ✓ 2331 módulos, 0 erros |

---

## ARQUIVOS ALTERADOS

| Arquivo | Tipo | Descrição |
|---|---|---|
| `backend/src/models/AtivoEquipamento.js` | MODIFICADO | `MedicaoSchema` + `medicoes[]` + enum `medicao` |
| `backend/src/controllers/ativosController.js` | MODIFICADO | 4 funções: adicionarMedicao, listarMedicoes, atualizarMedicao, removerMedicao |
| `backend/src/routes/ativos.js` | MODIFICADO | 4 rotas + imports |
| `frontend/src/components/fv/MedicoesAtivoCard.jsx` | CRIADO | Componente completo: lista + form + última medição |
| `frontend/src/pages/AtivoQR.jsx` | MODIFICADO | Import + `<MedicoesAtivoCard>` inserido |

---

## VALIDAÇÃO

| Teste | Executado | Resultado |
|---|---|---|
| Build de produção | ✓ | 2331 módulos, 0 erros |
| Retrocompatibilidade (leitura de código) | ✓ | `medicoes: []` para ativos legados — zero quebra |
| Persistência real (Atlas) | ✗ | Sem conexão Atlas disponível |
| Device móvel (AtivoQR) | ✗ | Não testado |
| Link foto externo | ✗ | Não testado sem URL real |

---

## NÃO IMPLEMENTADO (conforme restrições)

- Upload de arquivos / bucket / Azure Blob / S3 / GCS
- APIs externas (OneDrive, Google Drive, Dropbox)
- Telemetria automática
- Sistema de chamados / OS / agenda
- Workflow de aprovação de medições
- ProjetoEV / Segurança / Snapshot / Governança / Homologação (intocados)
