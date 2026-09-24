/**
 * utilizavelProjeto.js — reexport da regra canônica — F-06.
 *
 * A matriz de liberação para engenharia MUDOU DE LUGAR: vive em
 * `@fortesolar/fv-shared/utilizavel-projeto` e é consumida pelo backend e pelo
 * frontend a partir de lá.
 *
 * ── Por que mudou ───────────────────────────────────────────────────────────
 * Havia duas matrizes para a mesma pergunta — esta e uma cópia no frontend — e
 * elas discordavam. A daqui exigia `potencia_kw` e `numero_mppt`; a de lá
 * exigia também corrente e tensão, procurando `voc_max`/`voc_max_dc`, aliases
 * que o SSOT não usa (o nome real é `tensao_max_entrada`). O mesmo inversor era
 * "liberado" de um lado e "bloqueado" do outro.
 *
 * Além da divergência, a matriz daqui não pedia envelope de tensão nenhum: 6
 * inversores STRING sem `tensao_max_entrada` e sem faixa MPPT passavam como
 * utilizáveis, com `bloqueio_engenharia: []`, para uma etapa que não tem como
 * verificar sobretensão nem janela de MPPT neles.
 *
 * Este arquivo permanece para não quebrar quem já o importava.
 */
export { avaliarUtilizavel } from '@fortesolar/fv-shared/utilizavel-projeto'

export { default } from '@fortesolar/fv-shared/utilizavel-projeto'
