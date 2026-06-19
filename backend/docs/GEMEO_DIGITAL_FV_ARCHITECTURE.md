# GEMEO_DIGITAL_FV_ARCHITECTURE.md

**Sprint:** P3-GEMEO-DIGITAL-FV-FORENSICS-01
**Tipo:** Proposta de Arquitetura (sem implementação)
**Data:** 2026-06-19

---

## PRINCÍPIO CENTRAL

**O Gêmeo Digital FV já existe.** `AtivoEquipamento` é declarado pelo próprio código como
"O Gêmeo Digital: registra O QUE FOI EFETIVAMENTE INSTALADO (as-built)".

A arquitetura proposta abaixo NÃO recria esta entidade. Ela **adiciona as camadas faltantes**
(O&M, telemetria, linkagem visual, garantias) reutilizando ao máximo o que existe.

---

## ENTIDADES EXISTENTES A REUTILIZAR

```
ProjetoFV ──────────────────────────────────────────────────────────────
  │  .governanca.freeze_status (RASCUNHO→CONGELADO→HOMOLOGADO)
  │  .governanca.snapshot_* (8 snapshots congelados)
  │  .arranjos[] (multi-inversor, multi-arranjo)
  │  .tipo_projeto (novo | ampliacao)
  │  .projeto_origem_id → ProjetoFV (pai, para ampliação)
  │  .homologacao.* (status, protocolo, checklist, histórico)
  │
  ├── AtivoEquipamento (GÊMEO DIGITAL) ──────────────────────────────
  │     .qr_code: FORTE-<TIPO>-<SEQ>     ← identidade canônica física
  │     .numero_serie                    ← identidade do fabricante
  │     .tipo: modulo|inversor|...
  │     .status: planejado→operacional→substituido
  │     .arranjo_id → ProjetoFV.arranjos[].id
  │     .equipamento_id → Equipamento (catálogo)
  │     .conectividade {mac, ssid, ip, firmware, senha_wifi(AES)}
  │     .monitoramento {portal, plant_id, gateway_sn, credenciais(AES)}
  │     .garantia_inicio / .garantia_fim
  │     .substitui_ativo_id ↔ substituido_por_ativo_id
  │     .historico[] {tipo, data, usuario, alteracoes[{campo,de,para}]}
  │     .documentos[] (RESERVADO)
  │
  └── Equipamento (CATÁLOGO) ─────────────────────────────────────────
        .fabricante, .modelo, .especificacoes
        .garantia_produto, .garantia_performance
        .qualidade.score_global
```

---

## CAMADAS A ADICIONAR (proposta)

### Camada 1 — Linkagem Unifilar ↔ Ativo (GAP-DT-01)

**Entidade: nenhuma nova.** Adição de atributo no SVG gerado.

```
gerarUnifilarSVG(projeto, ativos)
  └── Para cada elemento (módulo/inversor no SVG):
       - busca AtivoEquipamento por arranjo_id + tipo + índice
       - adiciona data-qr="FORTE-MOD-000123" ao elemento SVG
       → clique no UnifilarFV abre /ativo/qr/FORTE-MOD-000123

AtivoQR.jsx
  └── Exibe link de volta para o Unifilar do projeto
```

**Impacto:** Sem novo model. Apenas dados extras no SVG + event handler no React.

---

### Camada 2 — Visita Técnica (O&M Básico) (GAP-DT-03)

**Nova entidade: `VisitaTecnica`** (nova coleção)

```
VisitaTecnica
  .projeto_id   → ProjetoFV
  .ativos_id[]  → AtivoEquipamento[] (quais foram inspecionados)
  .tipo         : preventiva | corretiva | garantia | inspecao_inicial
  .tecnico_id   → User/Tecnico
  .data_visita  : Date
  .status       : agendada | em_andamento | concluida | cancelada
  .checklist[]  : [{item, ok, observacao}]
  .fotos[]      : [url_storage]
  .observacoes  : String
  .os_numero    : String (gerado)
  .historico_ativos_gerado: Boolean (se o evento foi adicionado ao AtivoEquipamento.historico)
```

**Integração com AtivoEquipamento existente:**
- Ao concluir a visita, adiciona evento `tipo=inspecao` no `historico[]` de cada ativo inspecionado
- Preserva todos os dados existentes

---

### Camada 3 — Telemetria de Produção (GAP-DT-02)

**Nova entidade: `TelemetriaFV`** (nova coleção — somente após GAP-DT-01+02)

```
TelemetriaFV
  .ativo_id    → AtivoEquipamento
  .projeto_id  → ProjetoFV
  .periodo     : Date (início do período: hora, dia, mês)
  .granularidade: 'hora' | 'dia' | 'mes'
  .energia_kwh : Number
  .potencia_w  : Number (pico do período)
  .performance_ratio : Number (real/estimado)
  .fonte       : 'solarman' | 'soliscloud' | 'shinephone' | 'manual'
  .coletado_em : Date
```

**Integração:**
- Usa `AtivoEquipamento.monitoramento.{portal, plant_id, credenciais}` para autenticação
- Os dados climáticos do snapshot técnico (irradiância) são usados para calcular o PR
- A geração estimada vem de `governanca.snapshot_financeiro.retorno.geracao_anual_kwh`

**Nota de honestidade:** cada portal tem API diferente. Solarman, SolisCloud e ShinePhone têm APIs
documentadas mas requerem review legal (termos de uso) antes de integrar.

---

### Camada 4 — Garantia e Alertas (GAP-DT-06)

**Sem nova entidade.** Extensão do fluxo existente:

```
Ao gerar AtivoEquipamento (ativoService.js):
  1. Lê Equipamento.garantia_produto (ex.: "10 anos")
  2. Se data_instalacao preenchida: garantia_fim = data_instalacao + N anos
  3. Se equipamento_id nulo: garantia_fim fica null (usuário preenche)

AlertaGarantia (cron mensal):
  1. Busca AtivoEquipamento onde garantia_fim BETWEEN (hoje) AND (hoje+90dias)
  2. Envia notificação ao responsável do projeto
  3. Registra no historico[]: tipo=garantia, descricao="Garantia expira em {data}"
```

---

## RELACIONAMENTOS DO GÊMEO DIGITAL (completo)

```
ProjetoFV  (1) ←────────────────────── (N) AtivoEquipamento
    │                                         │         │
    │  .arranjos[].id ←── .arranjo_id ────────┘         │
    │                                                     │
    │  .governanca.snapshot_unifilar.svg                  │
    │       ↑                                             │
    │  [GAP-DT-01: adicionar data-qr ao SVG] ────────────┘
    │
    ├── (1) ProjetoFV (pai) ←─── .projeto_origem_id (ampliação)
    │
    └── (N) VisitaTecnica [PROPOSTO]
              └── (N) AtivoEquipamento (via ativos_id[])

AtivoEquipamento (1) ←──── (N) TelemetriaFV [PROPOSTO]
AtivoEquipamento ←── .substitui_ativo_id ──→ AtivoEquipamento (substituído)
AtivoEquipamento ←── .equipamento_id ──────→ Equipamento (catálogo)
```

---

## TIMELINE DO GÊMEO DIGITAL

```
Projeto           Instalação        Comissionamento   Operação          O&M
─────────────────────────────────────────────────────────────────────────────▶
ProjetoFV         AtivoEquipamento  POST /comissionar TelemetriaFV      VisitaTecnica
.freeze=CONGELADO .status=instalado .status=operacional .energia_kwh    .tipo=preventiva
snapshot_tecnico  .data_instalacao  .numero_serie     .performance_ratio .checklist[]
snapshot_catalogo                   .conectividade    alertas           .historico ativo
                                    .historico[]      garantia expira
                                    [comissionamento]
```

---

## ESTRATÉGIA DE EXPANSÃO RECOMENDADA

### Sem nova arquitetura principal — evoluir o que existe

```
Fase A (preparação — XS/S):
  1. GAP-DT-10: ENEL no concessionariaProvider.js [XS]
  2. GAP-DT-06: auto-preencher garantia_fim na geração de ativos [S]
  3. BUG-EQ-ID-01: backfill equipamento_id (autorização Atlas pendente) [M]

Fase B (linkagem — M):
  4. GAP-DT-01: Unifilar ↔ AtivoEquipamento (data-qr no SVG + clique) [M]
  5. GAP-DT-04: Fluxo UI de substituição de equipamento [M]

Fase C (O&M básico — L):
  6. GAP-DT-03: VisitaTecnica (nova entidade) + tela mobile [L]
  7. GAP-DT-07: documentos[] do ativo (foto upload) [M]
  8. GAP-DT-09: Wizard de Ampliação de Usina [L]

Fase D (operação — XL):
  9. GAP-DT-02: Telemetria (coletor Solarman/SolisCloud) [XL]
  10. Dashboard de performance (PR, geração real vs. estimada) [L]
```

---

## PRÓXIMA SPRINT RECOMENDADA

**P4-GEMEO-DIGITAL-UNIFILAR-ATIVO-01** (GAP-DT-01)

- Adicionar `data-qr` aos elementos do SVG gerado por `gerarUnifilarSVG`
- Adicionar handler de clique no `UnifilarFV.jsx`
- Exibir card sumário do AtivoEquipamento (status, série, garantia)
- Adicionar link de volta ao Unifilar na página `AtivoQR.jsx`

**Justificativa:** Zero modelo novo; impacto visual imediato; transforma o unifilar de diagrama
estático em interface viva do Digital Twin. Estimativa: 1 sprint, 1 engenheiro.

---

## PRINCÍPIOS DA ARQUITETURA PROPOSTA

1. **AtivoEquipamento é imutável** (substituído ≠ deletado — chain preservada)
2. **Snapshot é a fonte de verdade após congelamento** (obterEquipamentosEngenharia)
3. **QR code é a âncora física** (etiqueta → AtivoQR.jsx → Digital Twin)
4. **Histórico sempre cresce** (append-only — nunca sobrescrever)
5. **Credenciais criptografadas** (AES-256-GCM — monitoramento e Wi-Fi)
6. **Zero duplicação de snapshot** (unifilar lê governanca.snapshot_catalogo)
7. **Substituição preserva cadeia** (substitui_ativo_id ↔ substituido_por_ativo_id)
