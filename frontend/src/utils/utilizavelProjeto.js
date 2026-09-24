/**
 * utilizavelProjeto.js (frontend) — reexport da regra canônica — F-06.
 *
 * Este arquivo era uma CÓPIA da matriz do backend e discordava dela: exigia
 * corrente e tensão máxima, mas procurava `voc_max`/`voc_max_dc`/`tensao_max_dc`
 * — nunca `tensao_max_entrada`, que é o nome que os 52 inversores do catálogo
 * realmente usam. O mesmo equipamento aparecia "Bloqueado" aqui e "Liberado" no
 * backend, sobre o mesmo documento.
 *
 * A regra passou a viver em `@fortesolar/fv-shared/utilizavel-projeto`, com os
 * aliases do SSOT e com a matriz de STRING separada da de MICRO. Aqui fica só o
 * reexport, para os importadores existentes (`Catalogo`, `FichaTecnicaModal`)
 * continuarem funcionando.
 *
 * Quem avalia INVERSOR deve passar o terceiro argumento — `{ fabricante,
 * modelo }` — para que a topologia seja classificada pelo SSOT. Sem ele, a
 * classificação usa apenas `especificacoes`.
 */
export { avaliarUtilizavel } from '@fortesolar/fv-shared/utilizavel-projeto'

export { default } from '@fortesolar/fv-shared/utilizavel-projeto'
