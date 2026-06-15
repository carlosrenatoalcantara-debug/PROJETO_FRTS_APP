# P1-ASSET-QR-CODE-01 — API (FASE 2 + FASE 3)

> Endpoints adicionados em `src/routes/ativos.js` + `src/controllers/ativosController.js`.
> Aditivos · somente leitura de ProjetoFV/Atlas/arranjos · nada removido/alterado nos endpoints existentes.

## FASE 2 — Render do QR (padrão, escaneável)

**`GET /api/ativos/qr/:qr/render.svg`** → imagem **SVG** do QR (lib `qrcode`, `errorCorrectionLevel: M`).

- O QR codifica a **URL da página** do ativo (`${APP_URL}/ativo/<QR>`) → escanear no celular abre a página.
  Fallback: se `APP_URL` não configurada, codifica o próprio código `FORTE-XXX-000000`.
- `Content-Type: image/svg+xml`; cacheável 24h.
- 404 se o QR não existir.

```
$ curl .../api/ativos/qr/FORTE-INV-000009/render.svg
HTTP 200 · image/svg+xml · 1643 bytes · <svg ... viewBox="0 0 31 31" ...>
```

## FASE 3 — Consulta por QR (fluxo QR → Ativo → Projeto → Arranjo → Equipamento)

**`GET /api/ativos/qr/:qr`** → JSON consolidado:

```jsonc
{
  "sucesso": true,
  "qr_code": "FORTE-INV-000009",
  "ativo": { "_id", "tipo", "fabricante", "modelo", "numero_serie", "quantidade",
             "status", "arranjo_id", "garantia_fim", "topologia", "localizacao", "historico": [] },
  "projeto": { "_id", "nome", "cliente" },          // somente leitura de ProjetoFV
  "arranjo": { "id", "rotulo", "tipo", "topologia", "origem", "fonte" },  // de arranjos[] OU do ativo.arranjo_id
  "total_arranjos_projeto": 0,
  "equipamento_catalogo": { "fabricante", "modelo", "tipo", "qualidade": { "nivel" } }  // Atlas (leitura)
}
```

- **Join 100% leitura:** `AtivoEquipamento` (por `qr_code`) → `ProjetoFV` (por `projeto_id`) →
  arranjo (`ProjetoFV.arranjos[]` por `arranjo_id`, com fallback ao `ativo.arranjo_id`) →
  `Equipamento`/Atlas (por `equipamento_id`).
- **Multiarranjo preservado:** o campo `arranjo` traz `fonte: 'projeto.arranjos'` quando o projeto tem
  `arranjos[]`, ou `fonte: 'ativo.arranjo_id'` (linkage preservado no Gêmeo Digital) para projeto legado.
- 404 se o QR não existir; 503 se DB offline.

### Roteamento
`/qr/:qr/render.svg` e `/qr/:qr` declarados **antes** de `/:id` (literal `qr` não colide com `:id`).

## Validação (3 casos reais — HTTP 200)

| QR | ativo | projeto | arranjo_id | catálogo |
|---|---|---|---|---|
| FORTE-INV-000009 | Tsun TSOL-MS2000 (planejado) | 207 - Paulo Carlos | arr_mqcqgwwv_1 | Tsun TSOL-MS2000 (invalido) |
| FORTE-INV-000010 | Solaredge SE 33.3K (planejado) | 197 - Escola Pinheiros | arr_mqcqgx9t_2 | Solaredge SE 33.3K |
| FORTE-INV-000011 | Deye SUN-3K-G (planejado) | 132.1 - Fazenda Alice | arr_mqcqgxme_3 | (sem bind) |

## Critério de aceite (API)
✅ QR renderizado (SVG) · ✅ Consulta por QR (join) · ✅ somente leitura · ✅ multiarranjo via `arranjo_id`.
