# P0-ASSET-MODEL-01 — Roadmap do Gêmeo Digital da Usina

> Sequência de sprints que constroem sobre a arquitetura definida nesta sprint, **sem
> refazê-la**. Cada fase só consome contratos já modelados em `AtivoEquipamento`.

## Visão geral

```
P0-ASSET-MODEL-01   (ESTA SPRINT)   → arquitetura/contratos (read-only)
        │
        ▼
P1-ASSET-CORE-01     (implementação) → models + CRUD + geração a partir dos arranjos
        │
        ▼
P1-ASSET-QR-CODE-01  → gera e renderiza QR; etiquetas imprimíveis
        │
        ▼
P1-ASSET-MOBILE-01   → leitura de QR em campo; check-in de instalação
        │
        ▼
P1-ASSET-OM-01       → operação e manutenção; garantia; falhas; monitoramento
```

> **Observação:** o briefing cita P1-ASSET-QR-CODE-01 / MOBILE-01 / OM-01. Inserimos um
> **P1-ASSET-CORE-01** antes do QR, pois é onde os models/coleções e o CRUD nascem — o QR
> precisa de ativos existindo para receber código.

---

## P1-ASSET-CORE-01 — Implementação da fundação

**Objetivo:** materializar o que esta sprint desenhou.

| Entrega | Detalhe |
|---|---|
| `models/AtivoEquipamento.js` | schema da FASE 1 (campos, enums, sub-docs histórico/conectividade) |
| `models/Contador.js` | sequência atômica para QR/serial |
| Índices | `qr_code` unique, `numero_serie` unique parcial, `{projeto_id,arranjo_id}`, `status` |
| `POST /api/ativos/gerar-de-projeto/:projetoId` | **materializa** ativos a partir de `ProjetoFV.arranjos[]` (1 ativo por unidade, status `planejado`, QR atribuído) |
| `GET /api/ativos?projeto_id=&arranjo_id=&status=` | listagem com filtros |
| `PATCH /api/ativos/:id/status` | transição de estado **validada** pela máquina da FASE 3 + registro em `historico` |
| Auditoria | reusa `AuditLog` (padrão já existente) |

**Critério:** gerar os ativos da Escola Pinheiro (2 arranjos, 140 módulos + 2 SE33.3) e
transicionar estados respeitando as regras. **Não toca** `ProjetoFV` nem Atlas.

---

## P1-ASSET-QR-CODE-01 — Geração e etiquetas

**Pré-requisito:** P1-ASSET-CORE-01 (ativos com `qr_code`).

| Entrega | Detalhe |
|---|---|
| Render de QR | `qr_code` → imagem (lib QR) apontando para `https://app.fortesolar.com.br/ativo/<qr_code>` |
| Folha de etiquetas | PDF imprimível (lote por projeto/arranjo) com QR + modelo + serial + posição |
| `GET /api/ativos/:id/qr.png` / `.../etiquetas.pdf` | endpoints de render |

**Sem refatoração:** o campo `qr_code` e o índice já existem desde o CORE — esta fase só
**desenha** o que já está modelado.

---

## P1-ASSET-MOBILE-01 — Campo / instalação

**Pré-requisito:** QR-CODE-01.

| Entrega | Detalhe |
|---|---|
| Leitura de QR (PWA/app) | resolve `qr_code` → `AtivoEquipamento` (O(1) via índice) |
| Check-in de instalação | técnico em campo: PLANEJADO→INSTALADO, captura `numero_serie` real, foto, `localizacao` |
| Captura de conectividade | `mac_wifi`, `firmware` (FASE 5) para equipamentos monitoráveis |
| Upload de documentos | ativa `documentos[]` (FASE 7): foto_instalacao, nota_fiscal — reusa o otimizador de imagem do projeto |

---

## P1-ASSET-OM-01 — Operação e Manutenção

**Pré-requisito:** MOBILE-01.

| Entrega | Detalhe |
|---|---|
| Painel O&M | ativos por status; alertas de `garantia_fim` próxima; MTBF por modelo |
| Fluxo de manutenção | OPERACIONAL⇄MANUTENCAO; ordens de serviço; registro de `falha`/`inspecao` |
| Substituição | OPERACIONAL/MANUTENCAO→SUBSTITUIDO + criação do ativo de reposição (cadeia `substitui_/substituido_por`) |
| Monitoramento | `senha_wifi` (criptografada), `endereco_ip`, `firmware` → integração com inversores/datalogger |
| Garantia | acionamento por ativo; documento `laudo`/`certificado` |

---

## Garantias de não-refatoração (por que a arquitetura é definitiva)

| Necessidade futura | Já previsto nesta sprint |
|---|---|
| QR único e rastreável | `qr_code` unique + `Contador` atômico |
| Ativo por arranjo (multiarranjo) | `arranjo_id` = `ProjetoFV.arranjos[].id` |
| Micro/otimizador/BESS distintos | `tipo` granular (6 valores) |
| Substituição de equipamento | estado `SUBSTITUIDO` + cadeia de troca |
| Ampliação de usina | novos ativos no `arranjo_id` da ampliação; existentes intactos |
| Histórico/linha do tempo | `historico[]` embutido (7 tipos de evento) |
| Documentos (manual/NF/foto/laudo) | `documentos[]` reservado (contrato pronto) |
| Conectividade/monitoramento | bloco `conectividade` + política por tipo |
| Sem tocar Projeto/Catálogo | vínculo por referência; coleção própria |

**Conclusão:** as fases QR/Mobile/O&M **consomem** contratos existentes; nenhuma exige
mudança estrutural na entidade `AtivoEquipamento`, em `ProjetoFV` ou no Atlas.
