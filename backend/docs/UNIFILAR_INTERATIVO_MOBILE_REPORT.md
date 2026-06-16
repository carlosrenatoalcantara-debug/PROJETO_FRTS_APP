# P1-UNIFILAR-INTERATIVO-01 — Mobile (FASE 4)

> `frontend/src/pages/Unifilar.jsx` — rota pública `/unifilar/:projetoId`. Mobile-first (uso em obra).

## Design mobile

| Aspecto | Implementação |
|---|---|
| **Responsividade** | SVG com `viewBox="0 0 320 H"` + `width="100%"` → escala para qualquer largura; container `max-w-md` |
| **Tela vertical** | layout em coluna: módulos → inversor → REDE; arranjos empilhados em cards |
| **Alvos de toque** | retângulos grandes (150×54px) — confortável para dedo; `role="button"` + Enter (acessibilidade) |
| **Zoom** | `touch-action: manipulation` no SVG; o navegador faz pinch-zoom da página sem capturar o gesto |
| **Scroll** | conteúdo flui verticalmente; vários arranjos roláveis |
| **Clique em símbolos pequenos** | o "símbolo" é o card inteiro (rótulo + modelo) — não um ícone minúsculo → erro de toque minimizado |
| **Status visual** | cor de preenchimento/borda por `status` (planejado/instalado/…); legenda no rodapé |

## Verificação (preview, viewport ~380px)

- Projeto **Paulo Carlos** (`/unifilar/6a2aa1c81222567143ff396a`):
  - Render: **ARRANJO 1** · **MOD-01** (Pulling PU-620, ×8) · **INV-01** (Tsun TSOL-MS2000, **azul = instalado**) · **REDE** · legenda.
  - **2 símbolos clicáveis** (`g[role="button"]`).
  - **Clique em INV-01 → navegou para `/ativo/FORTE-INV-000009`** (asset correto). ✅
- Screenshot capturado (single-line vertical, cards arredondados, cores de status).

## Android / iPhone

- O desenho usa **SVG vetorial responsivo** + HTML/Tailwind padrão → comportamento equivalente em
  Chrome/Android e Safari/iOS (sem APIs específicas de plataforma).
- **Ressalva honesta:** a verificação foi em **viewport mobile no preview**, **não em aparelho físico**
  Android/iPhone. Recomenda-se um teste rápido em device real antes do uso em campo em escala.

## Acessibilidade / robustez
- Símbolos navegáveis por teclado (`tabIndex`, Enter).
- Estados tratados: carregando · erro/conexão · projeto sem ativos.

## Critério de aceite (mobile)
✅ Funciona em celular (viewport mobile) · ✅ vertical/zoom/scroll · ✅ toque em símbolos · ✅ clique abre o ativo.
