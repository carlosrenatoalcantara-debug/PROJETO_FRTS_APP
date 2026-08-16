/**
 * dominio/unifilar — motor canônico de Unifilar FV — FV-DOM-007B.
 *
 * Fluxo aprovado:
 *
 *   engenharia normativa FV → domínio/Core → motor canônico → API → nova UX
 *
 * O cálculo elétrico (NBR 16690 / 5410 / 5419 / 16800) e o desenho vivem em
 * `@fortesolar/fv-shared/engenharia`. Aqui fica o que é do DOMÍNIO: traduzir um
 * ProjetoFV para a entrada do motor e declarar o que foi assumido.
 *
 * ── O que este módulo NÃO faz ────────────────────────────────────────────────
 * Não persiste. Gerar o diagrama é derivação pura (INV-58): o SVG sai dos dados
 * do projeto e não é um fato novo. O cache `ProjetoFV.unifilar` continua sendo
 * gravado por quem já o gravava — esta sprint não muda quem escreve.
 *
 * Também não decide congelamento: quem quiser o desenho da baseline lê
 * `governanca.snapshot_unifilar`. Este módulo sempre desenha o estado ATUAL, e
 * diz isso em `origem`.
 */
import { gerarUnifilarSVG } from '@fortesolar/fv-shared/engenharia/unifilar-svg'
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from './adaptarProjeto.js'

export { adaptarProjetoParaUnifilar, lacunasDaProveniencia }

/**
 * Gera o unifilar de um ProjetoFV.
 *
 * @param {object} projeto        documento (lean ou hidratado)
 * @param {object} [opts]
 * @param {Array}  [opts.ativos]  AtivoEquipamento do projeto — tornam os símbolos
 *                                clicáveis (gêmeo digital). Ausentes: desenho estático.
 * @param {string} [opts.nomeCliente]
 * @returns {{ svg, origem, proveniencia, lacunas, modelo, especificacoes }}
 */
export function gerarUnifilarDoProjeto(projeto, { ativos = [], nomeCliente = null } = {}) {
  const { entrada, proveniencia } = adaptarProjetoParaUnifilar(projeto, { nomeCliente })

  const svg = gerarUnifilarSVG(entrada, ativos)

  // O mesmo modelo elétrico que o desenho usou, exposto como dado. A UX mostra
  // números sem reextraí-los do SVG, e o memorial pode reusá-los sem recalcular.
  const modelo = montarModeloEletrico({
    painel: entrada.painel,
    inversor: entrada.inversor,
    arranjoMPPTs: entrada.arranjoMPPTs,
    dimensionamento: entrada.dimensionamento,
    dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao },
    uf: entrada.uf,
  })

  return {
    svg,
    origem: 'dados_atuais',
    proveniencia,
    lacunas: lacunasDaProveniencia(proveniencia),
    modelo,
    especificacoes: {
      potencia_cc_kwp: modelo.sistema.potenciaCC,
      potencia_ca_kw: modelo.sistema.potenciaCA,
      num_paineis: modelo.resumo.numPaineis,
      num_strings: modelo.resumo.numStrings,
      num_mppts: modelo.mppts.length,
      voc_max_v: modelo.resumo.vocMaxGlobal,
      isc_total_a: modelo.resumo.iscTotalDC,
      corrente_ac_a: modelo.iac,
      cabo_dc_mm2: modelo.cabos.dc.secao,
      cabo_ac_mm2: modelo.cabos.ac.secao,
      disjuntor_ac_a: modelo.protecoes.djACamp,
      dps: modelo.protecoes.dps,
      fases: modelo.sistema.fasesAC,
      tensao_ac_v: modelo.sistema.tensaoAC,
    },
  }
}
