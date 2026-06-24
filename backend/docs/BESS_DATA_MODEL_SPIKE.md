# BESS_DATA_MODEL_SPIKE.md

**Sprint:** P1-BESS-DATA-MODEL-SPIKE-01 · **Modelo:** Claude Opus 4.8 · **Data:** 2026-06-24
**Tipo:** Spike de Modelo de Dados — **READ-ONLY** (sem schema, sem collection, sem código de produção)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  padrão real ProjetoEV (strict controlado, orcamento/financeiro/diagrama_editado,
                     snapshot) e ProjetoFV (agregado arranjo→string→módulo) — espelhados aqui.
NÃO TESTADO:         nada a testar — é modelagem conceitual.
ENTREGA:             modelo conceitual fechado; nenhum schema/collection criado.
```

## FASE 3 — Modelo conceitual `ProjetoBESS` (agregados)
> Notação conceitual (NÃO é schema). Espelha ProjetoEV/ProjetoFV. Camadas: spec=catálogo,
> proj=projeto, sim=simulação.

```
ProjetoBESS
  identificacao        { cliente, localizacao(reuso E3), distribuidora, porte }
  composicao           { fv_vinculado_id?:ref, snapshot_fv?:obj, modo: standalone|fv_bess|fv_ev_bess }
  objetivos[]          { tipo: backup|autoconsumo|peak_shaving|demand_charge|arbitragem|off_grid|microgrid,
                         prioridade }                                                        // proj
  topologia            { acoplamento_default: ac_coupled|dc_coupled|hibrido }               // proj
  consumo              { reuso E2: curva/fatura; curva_horaria? p/ peak/demand }            // proj

  bancos[]                                                                                  // agregado
    BancoBaterias      { modulo_id:ref-catalogo, modulos_por_rack, n_racks, acoplamento,
                         kwh_nominal_calc, tensao_dc_calc, quimica(spec) }
  conversao[]          { tipo: pcs|inversor_hibrido, equip_id:ref, quantidade, modo_operacao }// proj
  ems                  { equip_id:ref, estrategia }                                          // proj
  transferencia        { sts_id?:ref }                                                       // proj
  cargas_criticas[]    { descricao, potencia_kw, prioridade, essencial }                     // proj

  parametros_operacao  { dod_operacional, soc_min, soc_max, soc_reserva_backup,
                         autonomia_alvo_h?, c_rate_operacional_calc }                        // proj
  simulacao            { kwh_uteis, autonomia_calculada_h, soc_curva[], ciclos_por_dia,
                         ciclos_por_ano, degradacao_pct_ano, soh_curva[],
                         vida_util_estimada_anos, round_trip_efetivo, %autoconsumo }         // sim
  orcamento            { itens[], total }   financeiro { ... }                               // proj
  unifilar/diagrama_editado { nodes, edges, posicoes, textos, conexoes }                     // proj
  homologacao          { checklist[], documentos[] }                                          // proj
  snapshots[]          { versao congelada — governança }                                      // proj
  meta                 { strict controlado; whitelist de POST cobre TODOS os campos (lição EV-RDY-01) }
```

## Entidades e relações (resumo)
- **ProjetoBESS** 1—N **BancoBaterias** 1—N **Rack** 1—N **ModuloBateria(catálogo)**.
- **ProjetoBESS** 1—N **PCS|InversorHibrido(catálogo)**; 1—1 **EMS**; 0—1 **STS**; 1—N **CargaCritica**.
- **ProjetoBESS** 0—1 **ProjetoFV** (por `fv_vinculado_id`, referência; `snapshot_fv` no congelamento).
- Catálogo: **único `Equipamento`** com tipos `bateria`(existe) + aditivos `pcs`/`ems`/`sts`/`inversor_hibrido`.

## RESPOSTAS OBRIGATÓRIAS
1. **Modelo recomendado?** `ProjetoBESS` agregado (espelho de ProjetoEV) com bancos[] (módulo→rack→banco),
   conversao[] (PCS/híbrido), ems, cargas_criticas[], parametros_operacao (proj) e simulacao (resultado),
   separando rigorosamente spec×projeto×simulação.
2. **AC e DC coexistem?** SIM — `acoplamento` modelado por banco/subsistema, com default no projeto
   (V1 pode restringir a 1/projeto, mas o modelo permite por-subsistema p/ não refatorar).
3. **DoD?** `dod_max` (bateria/spec) × `dod_operacional` (projeto). kWh úteis = nominal×dod_op×round_trip.
4. **SOC?** Limites no projeto (`soc_min/soc_max/soc_reserva_backup`); SOC instantâneo é série da **simulação**, nunca estático.
5. **C-rate?** Limites na bateria (`c_rate_carga/descarga_max`); `c_rate_operacional` derivado (PCS÷banco); instantâneo na simulação.
6. **Autonomia?** AMBOS: `autonomia_alvo_h` (entrada, objetivo=backup) + `autonomia_calculada_h` (resultado da simulação).
7. **Ciclos?** Spec na bateria (`vida_ciclos`, garantia, SOH-fim); `ciclos/dia·ano`, `degradacao`, `soh_curva`, `vida_util` na simulação.
8. **Vínculo FV↔BESS?** **Referência** (`fv_vinculado_id`, leitura) + **snapshot** no congelamento. NUNCA replicação; NUNCA escrever no ProjetoFV.
9. **Maior risco de modelagem?** Misturar spec×projeto×simulação (ex.: persistir SOC/DoD como dado fixo do equipamento) → cálculo errado + migração. (Top-10 em BESS_RISKS.json.)
10. **Próxima sprint recomendada?** `P1-BESS-CATALOG-TYPES-01` — estender o catálogo único com os tipos aditivos (pcs/ems/sts/inversor_hibrido) e os campos de spec da bateria (DoD/C-rate/ciclos/química), reusando o gate de qualidade.

## CRITÉRIO DE APROVAÇÃO — aferição
✅ modelo conceitual fechado · ✅ entidades/relações · ✅ AC e DC definidos · ✅ DoD/SOC/C-rate ·
✅ autonomia · ✅ ciclos · ✅ integração FV · ✅ roadmap técnico (BESS_ROADMAP_V1.md).
**Sem implementação, sem schema, sem collection, sem código.**
