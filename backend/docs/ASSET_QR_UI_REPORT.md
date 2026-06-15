# P1-ASSET-QR-CODE-01 — UI (FASE 4)

> Página pública `frontend/src/pages/AtivoQR.jsx` + rota `/ativo/:qr` em `App.jsx`.
> Mobile-first (uso em campo). Sem login (como `/p/:token`). Apenas leitura via `/api/ativos/qr/:qr`.

## Página `/ativo/:qr`

Fluxo: técnico **escaneia o QR** → abre `/ativo/<QR>` → a página consulta `GET /api/ativos/qr/<QR>`
e renderiza:

| Bloco | Conteúdo |
|---|---|
| **Cabeçalho** | "FORTE SOLAR · GÊMEO DIGITAL" + código `FORTE-XXX-000000` |
| **QR + status** | `<img src="/api/ativos/qr/<QR>/render.svg">` + badge de status colorido |
| **Equipamento (instalado)** | fabricante + modelo · tipo · quantidade · nº série · topologia · garantia |
| **Projeto / Arranjo** | projeto · cliente · **arranjo (id/rótulo)** · nº de arranjos no projeto |
| **Catálogo (Atlas)** | modelo de catálogo vinculado + nível de qualidade (quando há bind) |
| **Histórico** | eventos do ativo (criação/instalação/troca…) |

Estados tratados: carregando · erro/404 ("QR não encontrado") · sucesso.
Badge de status por cor (planejado/instalado/operacional/manutenção/substituído/desativado).

## Verificação (preview real)

- Dev server Vite (5173) → `/ativo/FORTE-INV-000009` renderizou:
  - QR escaneável visível (`<img alt="QR …">` presente)
  - "Tsun TSOL-MS2000" · inversor · qtd 1 · topologia string
  - Projeto "207 - Paulo Carlos de Andrade Filho" · Arranjo `arr_mqcqgwwv_1` · Arranjos no projeto 1
  - Catálogo "Tsun TSOL-MS2000" · qualidade invalido
  - Histórico "criacao — Ativo gerado a partir do projeto…"
- **0 erros de console.** Screenshot capturado (layout mobile, cards arredondados).

## Roteamento
Rota **pública** `/ativo/:qr` registrada em `App.jsx` fora do `<Layout>` (igual a `/p/:token`),
para escaneamento direto em campo sem necessidade de login.

## Multiarranjo na UI
A página exibe o **arranjo do ativo** (`arr_…_N`) e o **total de arranjos do projeto**. Cada ativo de um
arranjo distinto abre sua própria ficha — preservando a separação multiarranjo do Gêmeo Digital.

## Critério de aceite (UI)
✅ Página funcional · ✅ exibe QR + equipamento + projeto + arranjo + status · ✅ multiarranjo visível · ✅ verificada no preview.
