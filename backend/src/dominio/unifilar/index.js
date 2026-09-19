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
import { avaliarIntegridade, avaliarIntegridadeArranjo, MOTIVOS_UNIFILAR } from './integridade.js'
import { composicaoUnifilarDoProjeto, entradaDoArranjo, MODO, MOTIVO_COMPOSICAO } from './composicaoUnifilar.js'
import { comporUnifilarMultiarranjo } from './composicaoSVG.js'

export { adaptarProjetoParaUnifilar, lacunasDaProveniencia }
export { avaliarIntegridade, avaliarIntegridadeArranjo, MOTIVOS_UNIFILAR }
export { composicaoUnifilarDoProjeto, entradaDoArranjo, MODO, MOTIVO_COMPOSICAO }

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
  const composicao = composicaoUnifilarDoProjeto(projeto, { nomeCliente, moduloCatalogo, instalacao, catalogo })
  const { proveniencia } = composicao

  // ── Representabilidade — F14-6B ───────────────────────────────────────────
  // Antes de qualquer cálculo: o documento consegue representar ESTE projeto?
  // Topologia mista não é suportada, e a decisão da sprint é explícita — não se
  // escolhe um arranjo nem se classifica o projeto inteiro por maioria.
  if (composicao.modo === MODO.NAO_REPRESENTAVEL) {
    return recusar(impedimentoDaComposicao(composicao), proveniencia)
  }

  if (composicao.modo === MODO.SINGLE) {
    const arranjo = composicao.arranjos[0]
    const entrada = entradaDoArranjo(composicao, arranjo)

    /**
     * FV-DOM-056 — o portão. Sem topologia que sustente o desenho, o domínio
     * DECLARA o impedimento em vez de desenhar. Antes desta guarda,
     * `montarModeloEletrico` caía no ramo de compatibilidade e produzia um
     * sistema plausível e impossível (T07/T09: Voc 3933 V num inversor de 1000 V).
     *
     * Arranjo único continua avaliado pelo portão de PROJETO, campo a campo
     * como sempre: é o mesmo escopo, e mudá-lo aqui mudaria o veredito de todo
     * projeto que hoje desenha.
     */
    const impedimento = avaliarIntegridade(projeto, entrada, { instalacao, catalogo })
    if (impedimento) return recusar(impedimento, proveniencia)

    // FV-DOM-031C: microinversor tem desenho e modelo PRÓPRIOS. A bifurcação é
    // aqui, no domínio, e não dentro dos motores.
    if (entrada.topologia === 'micro') return gerarUnifilarMicro(entrada, proveniencia)
    return gerarUnifilarString(entrada, ativos, proveniencia, arranjo.modeloEletrico)
  }

  // ── MULTI — um diagrama por arranjo, num documento só ─────────────────────
  const blocos = []
  const resultados = []
  for (const arranjo of composicao.arranjos) {
    const entrada = entradaDoArranjo(composicao, arranjo)
    const canonico = composicao.canonico.arranjos.find((x) => x.id === arranjo.id) ?? null

    // Regras 3 e 4 do portão passam a valer POR ARRANJO (ver integridade.js).
    // Um arranjo irrepresentável recusa o DOCUMENTO inteiro: desenhar só a
    // parte que fecha entregaria um unifilar que descreve menos do que existe,
    // que é exatamente o defeito que esta sprint fecha.
    const impedimento = avaliarIntegridadeArranjo(projeto, entrada, canonico)
    if (impedimento) return recusar(impedimento, proveniencia)

    const r = entrada.topologia === 'micro'
      ? gerarUnifilarMicro(entrada, proveniencia)
      : gerarUnifilarString(entrada, ativosDoArranjo(ativos, arranjo.id), proveniencia, arranjo.modeloEletrico)

    resultados.push({ arranjo, resultado: r })
    blocos.push({
      titulo: arranjo.rotulo || arranjo.id || `Arranjo ${arranjo.ordem + 1}`,
      subtitulo: [
        r.especificacoes?.num_paineis != null ? `${r.especificacoes.num_paineis} módulos` : null,
        entrada.inversor?.modelo ? `${entrada.inversor.marca ?? ''} ${entrada.inversor.modelo}`.trim() : null,
      ].filter(Boolean).join(' · '),
      svg: r.svg,
    })
  }

  return {
    svg: comporUnifilarMultiarranjo(blocos),
    origem: 'dados_atuais',
    proveniencia,
    lacunas: [...new Set(resultados.flatMap(({ resultado }) => resultado.lacunas ?? []))],
    // Não existe UM modelo elétrico do projeto: existem N. Devolver um agregado
    // com a forma de modelo único seria fabricar um sistema que não é nenhum
    // dos arranjos — por isso `modelo: null` e a coleção declarada à parte.
    modelo: null,
    modelos: resultados.map(({ arranjo, resultado }) => ({
      arranjo_id: arranjo.id,
      rotulo: arranjo.rotulo,
      topologia: arranjo.topologia,
      modelo: resultado.modelo,
    })),
    especificacoes: agregarEspecificacoes(resultados),
  }
}

/** Ativos do gêmeo digital que pertencem a ESTE arranjo — nunca os dos outros. */
function ativosDoArranjo(ativos, id) {
  if (!Array.isArray(ativos) || !id) return []
  return ativos.filter((x) => String(x?.arranjo_id ?? '') === String(id))
}

/** Recusa por não-representabilidade, no mesmo formato dos demais impedimentos. */
function impedimentoDaComposicao(composicao) {
  return {
    codigo: MOTIVO_COMPOSICAO.TOPOLOGIA_MISTA_NAO_SUPORTADA,
    motivo: 'O projeto tem arranjos de microinversor e de string no mesmo sistema. '
      + 'O diagrama não representa as duas topologias no mesmo documento, e escolher '
      + 'uma delas descreveria um sistema diferente do projeto.',
    detalhe: {
      topologias_por_arranjo: composicao.arranjos.map((a) => ({ arranjo_id: a.id, topologia: a.topologia })),
    },
  }
}

/**
 * Unifilar de UM arranjo de strings.
 *
 * O `modelo` recebido é o que a composição já montou (F14-6B, Tarefa 3): o
 * motor desenha COM ele em vez de remontar a mesma engenharia. Sem ele, monta
 * aqui — é o caminho de quem chama esta função sem passar pela composição.
 */
function gerarUnifilarString(entrada, ativos, proveniencia, modeloPronto = null) {
  const modelo = modeloPronto ?? montarModeloEletrico({
    painel: entrada.painel,
    inversor: entrada.inversor,
    arranjoMPPTs: entrada.arranjoMPPTs,
    dimensionamento: entrada.dimensionamento,
    dadosConsumo: { tipoLigacao: entrada.tipo_ligacao, tensao: entrada.tensao },
    uf: entrada.uf,
  })

  const svg = gerarUnifilarSVG({ ...entrada, modeloEletrico: modelo }, ativos)

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
 * Especificações do PROJETO a partir das de cada arranjo — F14-6B.
 *
 * Como cada grandeza compõe (Tarefa 1): tensão compõe por MÁXIMO, corrente e
 * potência por SOMA. Cabo, disjuntor e DPS são dimensionados por trecho e não
 * têm valor de projeto: ficam `null`, com o valor de cada arranjo em
 * `por_arranjo`. Declarar um número único ali seria inventar um trecho que não
 * existe.
 */
function agregarEspecificacoes(resultados) {
  const specs = resultados.map(({ resultado }) => resultado.especificacoes ?? {})
  const soma = (campo) => {
    const vs = specs.map((s) => s?.[campo]).filter((v) => Number.isFinite(v))
    return vs.length > 0 ? +vs.reduce((a, b) => a + b, 0).toFixed(2) : null
  }
  const maximo = (campo) => {
    const vs = specs.map((s) => s?.[campo]).filter((v) => Number.isFinite(v))
    return vs.length > 0 ? Math.max(...vs) : null
  }
  // Grandeza do PROJETO (ligação e tensão da rede): só se todos concordarem.
  const unanime = (campo) => {
    const vs = [...new Set(specs.map((s) => s?.[campo]).filter((v) => v !== null && v !== undefined))]
    return vs.length === 1 ? vs[0] : null
  }

  return {
    potencia_cc_kwp: soma('potencia_cc_kwp'),
    potencia_ca_kw: soma('potencia_ca_kw'),
    num_paineis: soma('num_paineis'),
    num_strings: soma('num_strings'),
    num_mppts: soma('num_mppts'),
    num_microinversores: soma('num_microinversores'),
    voc_max_v: maximo('voc_max_v'),
    isc_total_a: soma('isc_total_a'),
    corrente_ac_a: soma('corrente_ac_a'),
    cabo_dc_mm2: null,
    cabo_ac_mm2: null,
    disjuntor_ac_a: null,
    dps: null,
    fases: unanime('fases'),
    tensao_ac_v: unanime('tensao_ac_v'),
    n_arranjos: resultados.length,
    por_arranjo: resultados.map(({ arranjo, resultado }) => ({
      arranjo_id: arranjo.id,
      rotulo: arranjo.rotulo,
      topologia: arranjo.topologia,
      especificacoes: resultado.especificacoes,
    })),
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
