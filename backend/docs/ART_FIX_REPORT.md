# BUG-ART-01 — Relatório de Correção

**Sprint:** P1-BUG-ART-01 · **Modelo:** Sonnet  
**Branch:** `sprint/p1-bug-art-01`  
**Data:** 2026-06-18  
**Revisão Gemini:** Não obrigatória (correção pontual)

---

## 1. Causa Raiz Confirmada

`DadosART.jsx` (fv/homologacao) executava `GET /api/projetos-fv/:id/homologacao/art`
sem corpo HTTP. O controller `obterDadosART` extrai `const { projeto } = req.body`,
que é sempre `undefined` em requisições GET sem body — retornando HTTP 400
`{ erro: 'Dados do projeto obrigatórios' }`.

A ART nunca foi obtida com sucesso via UI.

**Cadeia de falha:**

```
DadosART.jsx
  └─ fetch GET /art  (sem body)
       └─ Express route: router.get('/art', obterDadosART)
            └─ obterDadosART: const { projeto } = req.body
                 └─ projeto === undefined
                      └─ res.status(400) → "Dados do projeto obrigatórios"
```

---

## 2. Arquivos Alterados

| Arquivo | Linha | Antes | Depois |
|---|---|---|---|
| `frontend/src/components/fv/homologacao/DadosART.jsx` | 29–32 | `method: 'GET'`, sem body | `method: 'POST'`, `body: JSON.stringify({ projeto })` |
| `backend/src/routes/homologacao.js` | 61–62 | `router.get('/art', ...)` | `router.post('/art', ...)` |
| `backend/src/controllers/homologacaoController.js` | — | inalterado | inalterado (já correto) |

**Arquivos não alterados (conforme constraint da sprint):**
- ProjetoEV, Ativos, QR, Comissionamento, Segurança — inalterados
- Snapshots, homologacaoAssistida.js, concessionariaProvider.js — inalterados
- `components/homologacao/DadosART.jsx` (legado) — inalterado (usa `gerarDadosART()` local, sem fetch)

---

## 3. Contrato Final (POST)

```
POST /api/projetos-fv/:projetoId/homologacao/art
Content-Type: application/json

Body:
{
  "projeto": { /* objeto ProjetoFV populado — mesmo objeto já disponível como prop */ }
}

Response 200:
{
  "sucesso": true,
  "tipo": "dados_art",
  "dados": { /* campos ART extraídos via gerarDadosART() */ },
  "origem": "snapshot" | "projeto",
  "usou_snapshot": boolean,
  "data_geracao": "ISO 8601",
  "observacoes": { "1": "...", "2": "...", "3": "..." }
}

Response 400:
{
  "erro": "Dados do projeto obrigatórios"
}
```

---

## 4. Fluxo Corrigido

```
DadosART.jsx
  └─ fetch POST /art  { projeto }
       └─ Express route: router.post('/art', obterDadosART)
            └─ obterDadosART: const { projeto } = req.body
                 └─ projeto !== undefined
                      └─ _aplicarSnapshotEquip(projeto)
                           └─ gerarDadosART(projDoc, {})
                                └─ res.json({ sucesso: true, dados: ... })
```

O objeto `projeto` já está disponível como prop em `DadosART({ projetoId, projeto, estado })`.
Nenhuma chamada adicional ao banco de dados é necessária: o controller recebe o projeto
completo no body e o usa diretamente.

**Suporte a snapshot:** `_aplicarSnapshotEquip(projeto)` detecta se o projeto está congelado
e usa o snapshot de equipamentos automaticamente — comportamento preservado.

---

## 5. Análise de Regressões

| Área | Status | Evidência |
|---|---|---|
| ProjetoEV | ✅ Sem regressão | Nenhum arquivo dessa área tocado |
| Ativos / QR / Comissionamento | ✅ Sem regressão | Idem |
| Segurança (JWT/RBAC/AuditLog) | ✅ Sem regressão | Rota alterada apenas de GET → POST; middleware de auth não muda |
| Homologação — Memorial | ✅ Sem regressão | Rota `POST /memorial` não alterada |
| Homologação — Carta | ✅ Sem regressão | Rota `POST /carta` não alterada |
| Homologação — Checklist | ✅ Sem regressão | Rotas checklist não alteradas |
| Homologação — Status | ✅ Sem regressão | Rotas status não alteradas |
| Snapshots | ✅ Sem regressão | `_aplicarSnapshotEquip` inalterado; chamado normalmente |
| Legacy DadosART.jsx | ✅ Sem regressão | Usa `gerarDadosART()` local, sem fetch — não afetado |
| Vite build | ✅ Sem erro | `✓ built in 9.85s`, 0 erros de compilação |

**Nenhuma rota foi removida.** Somente o verbo HTTP foi alterado de GET para POST.
Não há clientes externos conhecidos que consumam `GET /art` diretamente.

---

## 6. Validação por Cenário

### Projeto novo (sem snapshot)

- `projeto.governanca.snapshot_catalogo` não existe ou `snapshotAtivo = false`
- `_aplicarSnapshotEquip(projeto)` retorna `{ projeto, origem: 'projeto' }`
- `gerarDadosART(projeto, {})` usa dados vivos
- `usou_snapshot: false`

### Projeto congelado (com snapshot)

- `projeto.governanca.snapshot_catalogo` existe e `snapshotAtivo = true`
- `_aplicarSnapshotEquip` substitui equipamentos pelo snapshot imutável
- `usou_snapshot: true`
- Dados da ART refletem estado na data de congelamento — correto por design

### Projeto sem RT atribuído

- `gerarDadosART()` gera campos com valores ausentes (ex.: `responsavel_tecnico: 'Não informado'`)
- Resposta 200 com dados parciais — idêntico ao comportamento pré-fix (o bug impedia chegar aqui)

---

## Honestidade

- Build Vite executado e passou: `✓ built in 9.85s`
- Teste de integração real (UI + Railway) **não executado** — Railway requer deploy
- O controller `obterDadosART` foi auditado por leitura; comportamento inferido do código
- Legacy `components/homologacao/DadosART.jsx` auditado: usa prop `dados` + função local, sem fetch — confirmado sem bug
