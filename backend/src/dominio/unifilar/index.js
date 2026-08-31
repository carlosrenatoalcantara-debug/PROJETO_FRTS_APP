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
import { gerarUnifilarMicroSVG } from '@fortesolar/fv-shared/engenharia/unifilar-micro-svg'
import { montarModeloMicro } from '@fortesolar/fv-shared/engenharia/microinversores'
import { montarModeloEletrico } from '@fortesolar/fv-shared/engenharia/normativa'
import { adaptarProjetoParaUnifilar, lacunasDaProveniencia } from './adaptarProjeto.js'
import { avaliarIntegridade, MOTIVOS_UNIFILAR } from './integridade.js'

export { adaptarProjetoParaUnifilar, lacunasDaProveniencia }
export { avaliarIntegridade, MOTIVOS_UNIFILAR }

/**
 * Recusa do desenho — FV-DOM-056. Mesmo formato de retorno do sucesso, com
 * `svg: null` e o motivo técnico. Não é erro: é o estado real do projeto.
 */
function recusar(impedimento, proveniencia) {
  return {
    svg: null,
    origem: 'dados_atuais',
    proveniencia,
    lacunas: lacunasDaProveniencia(proveniencia),
    impedimento,
    modelo: null,
    especificacoes: null,
  }
}

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
export function gerarUnifilarDoProjeto(projeto, { ativos = [], nomeCliente = null, moduloCatalogo = null, instalacao = null, catalogo = null } = {}) {
  const { entrada, proveniencia } = adaptarProjetoParaUnifilar(projeto, { nomeCliente, moduloCatalogo })

  /**
   * FV-DOM-056 — o portão. Sem topologia que sustente o desenho, o domínio
   * DECLARA o impedimento em vez de desenhar. Antes desta guarda,
   * `montarModeloEletrico` caía no ramo de compatibilidade e produzia um
   * sistema plausível e impossível (T07/T09: Voc 3933 V num inversor de 1000 V).
   */
  const impedimento = avaliarIntegridade(projeto, entrada, { instalacao, catalogo })
  if (impedimento) return recusar(impedimento, proveniencia)

  // FV-DOM-031C: microinversor tem desenho e modelo PRÓPRIOS. O caminho string
  // abaixo continua palavra por palavra o que era — a bifurcação é aqui, no
  // domínio, e não dentro dos motores.
  if (entrada.topologia === 'micro') {
    return gerarUnifilarMicro(entrada, proveniencia)
  }

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

/**
 * Unifilar de um sistema com MICROINVERSORES — FV-DOM-031C.
 *
 * Mesmo contrato de retorno do caminho string, para que a API e a UX não
 * precisem saber qual motor desenhou. O que muda é o conteúdo: `num_strings` e
 * `num_mppts` NÃO aparecem, porque não existem nesta topologia — declarar zero
 * seria afirmar um fato falso.
 *
 * As lacunas vêm de duas origens e são unidas: as da PROVENIÊNCIA (o que o
 * projeto não forneceu ao adapter) e as do MODELO (o que o catálogo não
 * declarou sobre módulo e micro).
 */
function gerarUnifilarMicro(entrada, proveniencia) {
  const modelo = montarModeloMicro({
    // FV-DOM-031D: os elétricos vêm do CATÁLOGO (`painelMicro`, lido pela SSOT);
    // marca/modelo/potência continuam vindo do projeto. Um objeto só, sem tocar
    // no `painel` que o caminho string consome.
    painel: { ...entrada.painel, ...(entrada.painelMicro ?? {}) },
    micros: entrada.micros,
    dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao },
    uf: entrada.uf,
  })

  const svg = gerarUnifilarMicroSVG(modelo, {
    cliente: entrada.nomeCliente,
    distribuidora: entrada.distribuidora,
    estrutura: entrada.estrutura,
  })

  return {
    svg,
    origem: 'dados_atuais',
    proveniencia,
    lacunas: [...new Set([...lacunasDaProveniencia(proveniencia), ...(modelo.lacunas ?? [])])],
    modelo,
    especificacoes: {
      topologia: 'micro',
      potencia_cc_kwp: modelo.sistema.potenciaCC,
      potencia_ca_kw: modelo.sistema.potenciaCA,
      num_paineis: modelo.sistema.numModulos,
      num_microinversores: modelo.sistema.numMicros,
      // Envelope por ENTRADA — o equivalente elétrico da string, nesta topologia.
      modulos_por_entrada: modelo.modelos[0]?.modulos_por_entrada ?? null,
      voc_entrada_v: modelo.modelos[0]?.voc_entrada_frio ?? null,
      vmpp_entrada_v: modelo.modelos[0]?.vmpp_entrada_quente ?? null,
      isc_entrada_a: modelo.modelos[0]?.isc_entrada ?? null,
      corrente_ac_a: modelo.sistema.iac,
      // MESMA FORMA do caminho string, campo a campo: `cabo_ac_mm2` é a seção
      // (texto) e `dps` é o OBJETO, que a UX lê como `.modelo · .nivel`.
      // Divergir aqui quebrou a tela com "Objects are not valid as a React
      // child" — o contrato de `especificacoes` é um só para as duas topologias.
      cabo_ac_mm2: modelo.cabos?.ca?.secao ?? null,
      disjuntor_ac_a: modelo.cabos?.ca?.disj ?? null,
      dps: modelo.protecoes?.dps_cc ?? null,
      fases: modelo.sistema.fasesAC,
      tensao_ac_v: modelo.sistema.tensaoAC,
    },
  }
}
