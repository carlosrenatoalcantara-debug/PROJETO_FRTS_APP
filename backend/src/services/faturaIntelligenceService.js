/**
 * faturaIntelligenceService.js — Sprint 8.5
 * Orquestra detecção + parsing + validação. Não chama Gemini diretamente aqui
 * (esse caminho já existe em `faturaController.extrairDadosFatura`), mas aceita
 * um payload pré-extraído por Gemini como entrada complementar (mescla).
 *
 * Filosofia: parser puro PRIMEIRO (determinístico), Gemini APENAS para preencher
 * lacunas/dúvidas — assim a confiança é controlada por camada, não por sorte.
 */
import { detectarConcessionaria } from '../utils/fatura/concessionariaDetector.js'
import { parsearFatura } from '../utils/fatura/faturaParser.js'
import { validarFatura } from '../utils/fatura/faturaValidador.js'

/**
 * Constrói a FaturaEnergia normalizada a partir de texto cru (PDF/OCR) e/ou
 * payload Gemini opcional.
 *
 * @param {object} input
 * @param {string} input.texto      texto extraído (PDF.parse / OCR / colado)
 * @param {object} [input.gemini]   resultado do Gemini (mesmo schema do PROMPT_FATURA)
 * @param {string} [input.fonte]    'PDF'|'OCR'|'TEXTO'|'MANUAL' (default 'PDF')
 */
export function montarFaturaInteligente({ texto = '', gemini = null, fonte = 'PDF' } = {}) {
  const conc = detectarConcessionaria(texto)
  const base = parsearFatura(texto, { fonte, concessionaria: conc.concessionaria })

  // Mescla Gemini sobre o parser (Gemini ganha apenas onde o parser falhou).
  if (gemini && typeof gemini === 'object') {
    const set = (campo, valor, conf = 0.85) => {
      if (valor == null || valor === '') return
      const atual = obterPorCaminho(base, campo)
      if (!atual || atual.valor == null) definirPorCaminho(base, campo, { valor, fonte: 'Gemini', confianca: conf })
    }
    set('cliente.nome',       gemini.nome)
    set('cliente.cpf_cnpj',   gemini.cpfCnpj)
    set('cliente.endereco',   gemini.endereco)
    set('cliente.cidade',     gemini.cidade)
    set('cliente.uf',         gemini.estado)
    set('cliente.cep',        gemini.cep)
    set('unidade_consumidora.numero_uc',     gemini.numeroCliente || gemini.codigoInstalacao)
    set('unidade_consumidora.concessionaria', gemini.distribuidora)
    set('classificacao.classe',  gemini.classificacao)
    set('classificacao.subgrupo', gemini.subgrupo)
    set('classificacao.grupo',   gemini.grupoTarifario)
    set('ligacao.tipo',          (gemini.tipoLigacao || '').toLowerCase().replace('ó', 'o'))
    set('ligacao.tensao_nominal', gemini.tensaoV)
    set('consumo_atual_kwh',     gemini.consumoKwh)
    // histórico do Gemini (se parser não pegou ao menos 12 meses, complementa)
    if (Array.isArray(gemini.historico12meses) && base.historico_consumo.length < gemini.historico12meses.length) {
      base.historico_consumo = gemini.historico12meses.map((h) => ({
        mes: String(h.mes || '').slice(0, 3).toUpperCase(),
        ano: Number(String(h.mes || '').slice(-2)) + 2000,
        kwh: Number(h.consumo) || 0,
      }))
      // recalcula análise
      const arr = base.historico_consumo.map((x) => x.kwh).filter((n) => Number.isFinite(n) && n > 0)
      if (arr.length) {
        const soma = arr.reduce((s, n) => s + n, 0)
        base.analise = { consumo_medio_12m: Number((soma / arr.length).toFixed(2)), maior_consumo: Math.max(...arr), menor_consumo: Math.min(...arr) }
        base.flags.historico_incompleto = arr.length < 12
      }
    }
  }

  // Sobrescreve a concessionária detectada (sempre o resultado do detector tem prioridade na meta)
  base.unidade_consumidora.concessionaria = {
    valor: conc.concessionaria,
    fonte: 'PDF',
    confianca: conc.confianca,
  }

  const validacao = validarFatura(base)
  return {
    concessionaria_detectada: conc,
    ...base,
    alertas: validacao.alertas,
    necessita_revisao: validacao.necessita_revisao,
    status_revisao: validacao.necessita_revisao ? 'pendente' : 'revisada',
    valida: validacao.ok,
  }
}

// Helpers pequenos para get/set por caminho "a.b.c"
function obterPorCaminho(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
function definirPorCaminho(obj, caminho, valor) {
  const partes = caminho.split('.')
  let cursor = obj
  for (let i = 0; i < partes.length - 1; i++) {
    if (cursor[partes[i]] == null || typeof cursor[partes[i]] !== 'object') cursor[partes[i]] = {}
    cursor = cursor[partes[i]]
  }
  cursor[partes[partes.length - 1]] = valor
}
