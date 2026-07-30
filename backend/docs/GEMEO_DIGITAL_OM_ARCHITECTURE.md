# GÊMEO DIGITAL — PROPOSTA DE ARQUITETURA O&M

**Sprint:** P4-GEMEO-DIGITAL-OM-FORENSICS-01
**Data:** 2026-06-19
**Status:** PROPOSTA — NÃO IMPLEMENTADA. Nenhum código foi escrito.
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

> Este documento descreve **o que deveria existir**. É um esboço de modelo de dados e de
> relações. Nenhuma migração, schema ou endpoint foi criado nesta sprint. Os nomes de
> campo são sugestões alinhadas ao estilo do codebase (snake_case em português, padrão
> de `AtivoEquipamento.js`).

---

## 1. PRINCÍPIO ARQUITETURAL

O `AtivoEquipamento` é o **gêmeo digital granular** (1 documento = 1 unidade física ou 1
agregado de módulos). Seu `historico[]` embutido é excelente para registrar **o que
aconteceu com aquele ativo**. Ele **não** é o lugar para entidades que:

- agregam múltiplos ativos (uma visita toca N ativos);
- têm ciclo de vida e fila próprios (um chamado tem SLA);
- crescem indefinidamente no tempo (leituras de telemetria; 25 anos de visitas).

Regra de ouro adotada: **agregadores transversais e séries temporais = coleção própria;
efeito pontual num ativo = evento no `historico[]` do ativo (referência leve).**

---

## 2. ENTIDADE `VisitaTecnica` (coleção própria — `visitas_tecnicas`)

### Justificativa
Uma visita é um evento de campo que: é **agendada**, tem um **responsável**, **toca de 0
a N ativos** de **1 projeto/usina**, produz um **resultado** (checklist, laudo, fotos) e
pode **originar** chamados/substituições. Nenhuma dessas propriedades cabe em um subdoc de
um único ativo nem em um evento solto. Padrão de consulta dominante: "visitas do
técnico X no mês", "última visita da usina Y", "visitas pendentes" — todas consultas
**sobre visitas**, exigindo coleção indexável.

### Esboço de modelo
```
VisitaTecnica {
  _id
  projeto_id        ObjectId ref ProjetoFV   (required, index)
  cliente_id        ObjectId ref Cliente      (index)
  codigo            String  // ex.: VT-000123 (sequencial via Contador, padrão do QR)

  tipo              enum [preventiva, corretiva, inspecao, comissionamento, ampliacao]
  status            enum [agendada, em_andamento, concluida, cancelada]  (index)

  agendada_para     Date
  iniciada_em       Date
  concluida_em      Date

  tecnico_id        ObjectId ref Tecnico
  responsavel       String   // nome/email de quem executou

  // Ativos tocados — referência leve (não embute o ativo)
  ativos: [{
    ativo_id        ObjectId ref AtivoEquipamento
    qr_code         String   // denormalizado p/ leitura rápida em campo
    acao            enum [inspecionado, manutencao, substituido, reparado, sem_acao]
    observacao      String
  }]

  // Resultado da visita
  checklist         [{ item: String, ok: Boolean, observacao: String }]
  laudo             String
  fotos             [String]   // refs/base64 ou URLs (decidir storage — ver GAP-OM-10)
  custo_r           Number

  // Rastreabilidade
  chamado_id        ObjectId ref Chamado   (default null)  // se originada de chamado
  historico         [{ em: Date, por: String, acao: String, detalhe: String }]
}
timestamps: true
```

### Relações
- `VisitaTecnica.projeto_id` → `ProjetoFV` (a usina).
- `VisitaTecnica.ativos[].ativo_id` → `AtivoEquipamento` (N ativos).
- `VisitaTecnica.chamado_id` → `Chamado` (opcional; quando a visita resolve um chamado).

### Integração com `AtivoEquipamento.historico[]`
Ao concluir a visita, para cada ativo tocado, **espelhar** um evento leve no histórico do
ativo, reusando o `HistoricoSchema` existente (tipos `manutencao`/`inspecao`/`troca`):
```
ativo.historico.push({
  tipo: 'manutencao',            // ou 'inspecao' / 'troca' conforme acao
  data: visita.concluida_em,
  usuario: visita.responsavel,
  descricao: 'Visita VT-000123 — <acao>',
})
```
Assim, o ativo conhece **o efeito**, e a visita continua sendo a fonte de verdade do
**evento agregador**. Não duplica dados pesados (fotos/laudo ficam só na visita).

---

## 3. ENTIDADE `Chamado` (coleção própria — `chamados`)

### Justificativa
Um chamado tem **ciclo de vida e fila próprios**, **SLA**, **prioridade** e
**solicitante**. Frequentemente **gera** uma visita e/ou uma substituição. Modelá-lo como
evento de histórico impediria filas, SLA e relatórios de atendimento. Padrão de consulta:
"chamados abertos", "chamados vencendo SLA", "chamados do cliente X".

### Esboço de modelo
```
Chamado {
  _id
  codigo            String   // ex.: CH-000045 (sequencial via Contador)
  projeto_id        ObjectId ref ProjetoFV   (index)
  cliente_id        ObjectId ref Cliente      (index)
  ativos            [ObjectId ref AtivoEquipamento]   // 0..N ativos relacionados

  origem            enum [cliente, telemetria, inspecao, interno]
  categoria         enum [falha, duvida, manutencao, garantia, ampliacao]
  prioridade        enum [baixa, media, alta, critica]  (index)

  status            enum [aberto, triagem, em_atendimento, aguardando_cliente,
                          resolvido, fechado, cancelado]  (index)

  titulo            String
  descricao         String
  solicitante       String

  // SLA
  aberto_em         Date
  sla_limite        Date
  resolvido_em      Date
  fechado_em        Date

  // Vínculos de saída
  visita_id         ObjectId ref VisitaTecnica  (default null)  // se gerou visita
  substituicao_ativo_id ObjectId ref AtivoEquipamento (default null)

  historico         [{ em: Date, por: String, de: String, para: String, observacao: String }]
}
timestamps: true
```

### Relações
- `Chamado.ativos[]` → `AtivoEquipamento`.
- `Chamado.visita_id` → `VisitaTecnica` (chamado gera visita).
- Reaproveita o modelo `AlertaStatus` existente como inspiração de "estado de resolução".

### Integração com o ecossistema existente
- Um detector de telemetria (futuro, GAP-OM-07) ou de garantia (GAP-OM-02) pode **abrir
  chamado automaticamente** (`origem: telemetria`/`interno`).
- O `historico[]` do ativo recebe um evento `falha` referenciando `chamado_id`.

---

## 4. GARANTIA E SUBSTITUIÇÃO — SEM NOVA ENTIDADE

Estas duas dimensões **não exigem coleção nova** — reaproveitam `AtivoEquipamento` +
`historico[]`. Precisam apenas de **lógica de domínio** (endpoints/serviços).

### 4.1 Garantia (P5-GARANTIA)
- Derivar `garantia_fim = garantia_inicio + Equipamento.garantia_produto` (via
  `equipamento_id`), no comissionamento ou em rotina dedicada.
- Gravar evento `garantia` no `historico[]` quando definida/alterada.
- Novo detector no `AlertCenter` (origem `ativo`): "garantia vence em < N dias".

### 4.2 Substituição (P5-SUBSTITUICAO)
Endpoint atômico `POST /api/ativos/:id/substituir` que, em uma transação:
1. cria o ativo substituto (herdando projeto/arranjo/tipo/localização);
2. seta `antigo.substituido_por_ativo_id = novo._id` e
   `novo.substitui_ativo_id = antigo._id`;
3. transiciona `antigo.status → substituido` e `novo.status → instalado`;
4. grava evento `troca` no `historico[]` de **ambos**, com `motivo`, `serial_defeituoso`
   e `numero_rma` (novos campos do evento ou do ativo — GAP-OM-04).

---

## 5. TIMELINE DO GÊMEO DIGITAL (incluindo fases O&M)

```
[as-designed]            [as-built]                    [O&M — proposto]
ProjetoFV  ──gerar──▶  AtivoEquipamento  ──────────────────────────────────────▶
                       │  criacao (✓ hoje)
                       │  instalacao
                       │  comissionamento (✓ hoje, QR/OCR)
                       │  homologacao  (GAP-OM-11: espelhar do projeto)
                       │  operacional
                       │  ┌──────────── CICLO O&M (loop por 25 anos) ───────────┐
                       │  │  Chamado aberto (origem cliente/telemetria)          │
                       │  │     └─▶ VisitaTecnica (preventiva/corretiva)         │
                       │  │            └─▶ evento manutencao/inspecao/falha       │
                       │  │            └─▶ Substituicao (troca, cadeia A↔B)       │
                       │  │  Garantia vencendo → alerta (AlertCenter)            │
                       │  │  Telemetria → leitura diária / offline / alarme      │
                       │  └─────────────────────────────────────────────────────┘
                       │  desativado (terminal)
                       ▼
```

Hoje, a timeline cobre com solidez **criacao → comissionamento** e o esqueleto de status.
O bloco "CICLO O&M" é o que esta arquitetura propõe construir.

---

## 6. SEQUÊNCIA DE PRIORIDADE RECOMENDADA

| Ordem | Sprint | Entidades novas | Esforço | Por que primeiro |
|-------|--------|-----------------|---------|------------------|
| 1 | **P5-GARANTIA** | nenhuma | S | Quick-win; reusa ativo+histórico+AlertCenter; valor de compliance/retenção imediato |
| 2 | **P5-SUBSTITUICAO** | nenhuma | M | Fecha o ciclo de troca; base de dados para warranty claim; reusa cadeia já no schema |
| 3 | **P5-OM** | VisitaTecnica + Chamado | L | Coração do O&M; depende das decisões de coleção própria deste documento |
| 4 | **P5-TELEMETRIA** | Leituras (série temporal) | XL | Maior esforço; depende de integrações externas; alimenta chamados automáticos |

**Racional da ordem:** começar pelo que reusa a arquitetura existente (1 e 2, zero
entidades novas, alto ROI), depois introduzir as coleções agregadoras (3), e por último a
ingestão externa de telemetria (4), que é a mais cara e a mais dependente de terceiros.

---

## 7. DECISÕES DE ARQUITETURA — RESUMO

| Questão | Decisão | Justificativa |
|---------|---------|---------------|
| VisitaTecnica: coleção / subdoc / evento? | **Coleção própria** + espelho no histórico | Agregador transversal (1→N ativos), volume temporal, consultas sobre visitas |
| Chamado: entidade própria / evento? | **Entidade própria** | Ciclo de vida, SLA, fila, prioridade; gera visitas/substituições |
| Garantia: nova entidade? | **Não** | Reusa ativo + histórico + AlertCenter |
| Substituição: nova entidade? | **Não** | Cadeia já no schema; falta só lógica de domínio atômica |
| Telemetria (leituras): onde? | **Coleção própria de série temporal** | Crescimento ilimitado; não embutir no ativo |
| Documentação por ativo | Implementar `documentos[]` (hoje reservado) | Anexar laudos/fotos/termos ao ativo as-built |
