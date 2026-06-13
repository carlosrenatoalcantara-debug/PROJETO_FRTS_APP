# ASSET CORE — Relatório de API

> Endpoints do Gêmeo Digital (backend apenas, sem telas). Montados em `/api/ativos`.

## Endpoints (5)

### 1. `GET /api/ativos/projeto/:id`
Lista os ativos de um projeto. Filtros opcionais: `?arranjo_id=&tipo=&status=`.
```jsonc
// 200
{ "sucesso": true, "total": 2, "por_tipo": { "modulo": 1, "inversor": 1 },
  "itens": [ { "_id": "...", "tipo": "modulo", "qr_code": "FORTE-MOD-000008",
              "status": "planejado", "arranjo_id": "arr_...", "quantidade": 18, "historico": [...] } ] }
```

### 2. `GET /api/ativos/:id`
Um ativo. `200` `{ sucesso, item }` · `404` se não existir.

### 3. `POST /api/ativos`
Cria um ativo avulso. `projeto_id` e `tipo` obrigatórios; gera `qr_code` se ausente.
```jsonc
// 201
{ "sucesso": true, "item": { "_id":"...", "qr_code":"FORTE-CARR-000001", "tipo":"carregador", "status":"planejado" } }
```

### 4. `PUT /api/ativos/:id`
Atualiza campos editáveis. `qr_code`/`chave_origem` são **imutáveis** (ignorados).
Transição de `status` validada pela máquina de estados:
```jsonc
// 200 (planejado → instalado)
{ "sucesso": true, "item": { "status":"instalado", "numero_serie":"...", "historico":[ ..., {"tipo":"mudanca_status"} ] } }
// 409 (instalado → substituido, inválido)
{ "erro": "Transição inválida: instalado → substituido", "transicoes_validas": ["operacional","desativado"] }
```

### 5. `POST /api/ativos/gerar/:projetoId`
Gera (idempotente) os ativos do projeto a partir de `arranjos[]`. `?dry_run=1` prevê sem gravar.
```jsonc
// 201
{ "sucesso": true, "dry_run": false, "criados": 2, "existentes": 0, "total": 2, "por_tipo": { "modulo":1, "inversor":1 } }
// re-execução → { "criados": 0, "existentes": 2 }  (idempotente)
```

## Máquina de estados (PUT)

| De | Para permitido |
|---|---|
| planejado | instalado, desativado |
| instalado | operacional, desativado |
| operacional | manutencao, substituido, desativado |
| manutencao | operacional, substituido |
| substituido | (terminal) |
| desativado | (terminal) |

## Regras de QR (gerados pelo backend)

`FORTE-<TIPO3>-<SEQ6>` — TIPO3 ∈ {MOD, INV, MICRO, OTIM, BESS, CARR}; sequência atômica por tipo
via coleção `contadores`. Único (índice unique parcial), imutável após criação.

## Fora do escopo CORE (intencional)

- **DELETE de ativo** — não exposto; usar `status=desativado` (preserva histórico).
- **Leitura de QR / render visual** — próxima sprint (P1-ASSET-QR-CODE-01).
- **Upload de fotos/documentos** — `documentos[]` reservado, sem endpoint.
- **Telas/UI** — backend apenas nesta sprint.

## Autenticação

Montado em `/api/ativos` (sem `protegerModulo` específico nesta fase CORE). A proteção por
perfil/RBAC deve ser adicionada na fase de exposição na UI (Mobile/O&M), alinhada ao padrão
`protegerModulo` já usado em `/api/gestao`.
