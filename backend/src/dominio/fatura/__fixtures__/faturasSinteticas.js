/**
 * Faturas SINTÉTICAS — layout do texto que o pdf-parse produz das faturas COSERN.
 *
 * Nenhum dado aqui é real: nome, CPF, UC, endereço, medidor, chave de acesso,
 * nota fiscal e valores foram inventados no MESMO FORMATO. A fatura real usada
 * para descobrir o layout nunca entra no repositório (repo público).
 *
 * Armadilhas propositais (não são a UC): código de débito (9 dígitos), medidor
 * (10), chave de acesso (44), nota fiscal.
 */

/** Histórico de 13 pontos, do mais recente para o mais antigo (OUT/26 … OUT/25). */
export const HISTORICO_13 = [
  ['OUT26', 410], ['SET26', 395], ['AGO26', 380], ['JUL26', 360], ['JUN26', 350],
  ['MAI26', 370], ['ABR26', 400], ['MAR26', 420], ['FEV26', 430], ['JAN26', 425],
  ['DEZ25', 415], ['NOV25', 405], ['OUT25', 300],
]
// 12 mais recentes: 4760 / 12 = 396,67 → 397. Com os 13: 5060 / 13 = 389,23 → 389.

const linhasHistorico = HISTORICO_13.map(([m, c]) => `${m} ${c} 30`).join('\n')

/** Formato ATUAL (REN 1.095/2024): "NÚMERO DA UNIDADE CONSUMIDORA" + NNN.NNN.NNN-NN. */
export const FATURA_COSERN_NOVA = `Consumo-TUSD kWh 410,00 0,41234567 169,06 0,00 169,06 17,00 28,74 0,41234567
Consumo-TE kWh 410,00 0,29876543 122,49 0,00 122,49 17,00 20,82 0,29876543
DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
COMPANHIA ENERGÉTICA DO RIO GRANDE DO NORTE
CLASSIFICAÇÃO: B1 RESIDENCIAL -RESIDENCIAL TIPO DE FORNECIMENTO: Conv. Monômia - Trifásico
NOME DO CLIENTE:
FULANO DE TAL TESTE
CPF: 123.4**.***-**
ENDEREÇO:
RUA DOS TESTES 100 BAIRRO FICTICIO
59000-000 CIDADE TESTE RN
NÚMERO DA UNIDADE CONSUMIDORA
001.234.567-89
NOTA FISCAL N° 000123456 - SÉRIE 001 / DATA DE EMISSÃO: 05/11/2026
Consulte pela Chave de Acesso em:
https://dfe-portal.svrs.rs.gov.br/Nf3e/consulta
chave de acesso:
1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234
CONSUMO / kWh
CONSUMO FATURADO N°DIAS FAT
${linhasHistorico}
MEDIDOR GRANDEZAS POSTOS LEITURA LEITURA CONST. CONSUMO
HORÁRIOS ANTERIOR ATUAL MEDIDOR kWh
9876543210 Energia Ativa Único 12.345,00 12.755,00 1,00000 410
11/2026 CÓDIGO DÉBITO EM CONTA 987654321 VENCIMENTO 20/11/2026 TOTAL A PAGAR R$ 345,67
PARA CADASTRAR SUA CONTA EM DÉBITO AUTOMÁTICO, UTILIZE O CÓDIGO ACIMA.
`

/** Formato LEGADO: "CÓDIGO DO CLIENTE" + só dígitos, CPF completo (fictício). */
export const FATURA_COSERN_LEGADA = `CLASSIFICAÇÃO: B1 RESIDENCIAL -RESIDENCIAL TIPO DE FORNECIMENTO: Conv. Monômia - Monofásico
NOME DO CLIENTE:
CICLANA DE TESTE
CPF: 111.222.333-44
CÓDIGO DO CLIENTE
7012345678
ENDEREÇO:
AVENIDA EXEMPLO 200
59100-000 CIDADE TESTE RN
CONSUMO / kWh
SET26 210 30
AGO26 1.050 30
JUL26 190 30
`
