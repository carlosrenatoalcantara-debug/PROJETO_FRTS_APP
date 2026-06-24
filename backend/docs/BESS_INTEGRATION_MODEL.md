# BESS_INTEGRATION_MODEL.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · READ-ONLY · conceitual

## FASE 12 — Integração FV ↔ BESS (vínculo sem dependência forte)

### Abordagens avaliadas
| Abordagem | Prós | Contras | Veredito |
|---|---|---|---|
| `fv_vinculado_id` (**referência simples**) | desacoplado; FV evolui sozinho; suporta L/K/M | dado FV pode mudar após o orçamento BESS | **base** |
| **Snapshot** dos dados FV consumidos | imutável p/ governança/homologação | precisa congelar no momento certo | **complemento** |
| **Replicação** (copiar dados FV) | leitura local rápida | drift/duplicação — anti-padrão | ❌ rejeitado |

### Decisão — **Referência + Snapshot no congelamento**
1. **Em edição:** `fv_vinculado_id` é referência **somente leitura**. O BESS lê do ProjetoFV (geração,
   curva, potência) por demanda. Nunca escreve no ProjetoFV.
2. **Na aprovação/congelamento:** grava-se um `snapshot_fv` embutido (geração anual, curva típica,
   potência, versão do FV) — espelha o padrão `snapshotEquipamentoSelecao`/snapshots do FV já usado.
   Isso dá **imutabilidade** para governança e homologação, sem replicar o projeto inteiro.
3. **Standalone (caso L):** `fv_vinculado_id = null`; nenhum acesso ao FV. O módulo funciona sozinho.

### Contrato de leitura (o que o BESS consome do FV)
`{ potencia_kwp, geracao_anual_kwh, curva_geracao_tipica[], n_inversores, acoplamento_sugerido }`.
→ Definir esse **contrato mínimo** evita o BESS ler campos internos do FV (acoplamento errado, risco R-DM-05).

## FASE 13 — Orçamento (itens BESS)
Reusar o engine `calcularOrcamento`; itens de linha do BESS:
`bateria/banco · PCS ou inversor híbrido · EMS · STS/ATS · quadros/proteções · mão de obra ·
comissionamento · frete · (container/HVAC no porte industrial)`.
Em FV+BESS: **cada módulo mantém seu orçamento por projeto**; um **resumo consolidado por referência**
soma FV+BESS (sem fundir engines). Modelo: `orcamento` próprio no ProjetoBESS + `consolidado` derivado.

## FASE 14 — Unifilar (elementos novos)
Reusar o motor SVG do FV; **novos elementos gráficos**:
`banco de baterias · PCS · inversor híbrido · EMS · STS/ATS · painel de carga crítica ·
fronteira ilha/rede (grid/island) · medidor bidirecional · barramento DC/AC`.
Persistir o diagrama editado como o EV faz (`diagrama_editado`: nodes/edges/posições/textos/conexões) —
**aplicar a lição EV-RDY-01** (garantir que a whitelist do POST persista o campo).

## FASE 15 — Homologação (documentos adicionais)
Reusar o framework FV (checklist + docs + persistência) e adicionar, por distribuidora:
- **Certificação do PCS / inversor híbrido** (INMETRO + anti-ilhamento).
- **Certificação/INMETRO da bateria** + datasheet.
- **Diagrama unifilar de armazenamento** + **memorial de cálculo do BESS**.
- **Memorial de proteções / coordenação** (DC e AC).
- **ART específica** + anexos de sistema de armazenamento da regulação de GD vigente.
- Declaração de modo de operação (on/off-grid, ilhamento).
Modelar `homologacao` com `checklist[]` + `documentos[]` (mesma forma do FV), templates BESS por concessionária.
