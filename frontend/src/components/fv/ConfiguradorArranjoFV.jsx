/**
 * ConfiguradorArranjoFV.jsx — Sprint 2 (completo)
 *
 * Configurador elétrico profissional multi-MPPT com:
 *  - Quantidade explícita de módulos (user-defined, propagada ao contexto)
 *  - Configuração por MPPT (strings_paralelo independentes + global módulos/string)
 *  - MPPT tree visualization
 *  - Validações elétricas locais (Voc, Vmpp, Isc, oversizing, área, mono/tri)
 *  - Hook de compatibilidade backend (POST /api/engenharia/compatibilidade-eletrica)
 *  - Optimizer (S2.12) mantido
 *  - Save/re-hidratação sem regressões
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Sliders, Thermometer, AlertTriangle, Loader2, Info,
  Save, CheckCircle2, XCircle, ChevronRight, Wand2,
  ZapOff, Zap, GitBranch,
} from 'lucide-react'
import {
  dadosEletricosPainel,
  dadosEletricosInversor,
  CLIMA_PADRAO_UF,
} from '../../data/catalogoEletrico'
// F1: veredito de corrente vem do classificador canonico do dominio — a mesma
// implementacao que `analisarCompatibilidade` usa no backend.
import { classificarCorrenteCC, STATUS_CORRENTE } from '@fortesolar/fv-shared/engenharia/classificacao-corrente-cc'
import { useCompatibilidadeEletrica } from '../../hooks/useCompatibilidadeEletrica'
import PainelCompatibilidadeFV from '../engenharia/PainelCompatibilidadeFV'
// F2: tensão e oversizing seguem o mesmo caminho da corrente.
import { classificarTensaoCC, STATUS_TENSAO } from '@fortesolar/fv-shared/engenharia/classificacao-tensao-cc'
import {
  classificarOversizing, STATUS_OVERSIZING, LIMITE_CRITICO_CC_CA,
} from '@fortesolar/fv-shared/engenharia/classificacao-oversizing'
// F1/F2: `correnteProjeto`, `FATOR_ISC_NBR16690`, `fatorTermico`,
// `temperaturaCelula` e `coefParaFracao` saíram — quem os aplica agora são os
// classificadores. Mantê-los importados convidaria a comparação manual de volta.
import { classificarTopologia } from '../../utils/topologiaInversor'
import { dimensionarMicroinversor, resumoDistribuicao } from '../../utils/dimensionarMicro'
// P1-MPPT-TOPOLOGY-IMPLEMENTATION-01 — editor da topologia real (entradas/strings)
import TopologiaMPPTEditor, { derivarTopologia, resumoTopologia, topologiaVazia } from './TopologiaMPPTEditor'

const VERSAO_MOTOR = '2.0.0-sprint2'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * SUGESTÃO VISUAL de arranjo distribuído entre MPPTs — NÃO é engenharia.
 *
 * Modelo A (FV-DOM-023/024): `mppts[]` é topologia AUTORADA pelo projetista. O
 * sistema valida; não distribui strings. Esta função só preenche o formulário
 * com um ponto de partida editável.
 *
 * As constantes abaixo (14 máx. módulos/string, 6 mín., divisor 1,5) não têm
 * origem normativa — são conveniência de UI. Nenhum resultado de engenharia
 * pode derivar delas, e nenhum diagnóstico as consulta: quem valida é
 * `validarArranjo` (regras canônicas) e o motor do backend.
 */
function sugerirMPPTs(numPaineis, nMppts) {
  if (!numPaineis || numPaineis <= 0 || !nMppts) return Array(1).fill({ numStrings: 1, modulosPorString: 8 })
  const modsPorStr = Math.min(14, Math.max(6, Math.ceil(numPaineis / Math.max(nMppts, 1) / 1.5)))
  const stringsTotal = Math.ceil(numPaineis / modsPorStr)
  const stringsBase  = Math.floor(stringsTotal / nMppts)
  const resto        = stringsTotal - stringsBase * nMppts
  return Array.from({ length: nMppts }, (_, i) => ({
    numStrings:       stringsBase + (i < resto ? 1 : 0),
    modulosPorString: modsPorStr,
  }))
}

// ─── Regras elétricas: fonte única (FV-DOM-025) ──────────────────────────────
//
// `coefVmpp`, `vocFrio` e `vmppQuente` viviam aqui e eram a TERCEIRA
// implementação das mesmas fórmulas. A FV-DOM-023 mediu o estrago:
//
//  • unidade (Q4) — o coeficiente vinha do catálogo Mongo em %/°C e era usado
//    como fração. Voc frio de 565 V virava 2179 V, e o máximo de módulos em
//    série caía de 11 para 3. Módulos do catálogo estático não sofriam, o que
//    escondeu o defeito por completo;
//  • coeficiente de Vmpp (Q2) — o `× 0,75` era declarado "estimativa", sem norma;
//  • critério de Vmpp mínimo (Q3) — comparava STC, não a condição quente.
//
// As três agora vêm de `fv-shared/engenharia/normativa`. O que permanece local
// é o que NÃO é regra de domínio: o laço por MPPT, o balanceamento entre
// strings, a compatibilidade mono/trifásica e a área — avisos de edição que o
// motor do backend não produz.

/**
 * F2 — tensão de UM MPPT pelo classificador canônico.
 *
 * `vocFrio` e `vmppQuente` viviam aqui e compunham as primitivas certas, mas as
 * COMPARAÇÕES que as consumiam eram próprias desta tela, e divergiam do motor:
 * o wizard media o Vmpp QUENTE contra o MPPT máximo, e o quente é o menor dos
 * dois — o critério nunca disparava. Os cartões por MPPT iam além e comparavam
 * o Vmpp em STC contra o MPPT mínimo, terceira leitura da mesma regra.
 *
 * Agora a tela não compara nada: pede o veredito e o exibe. Os números na tela
 * são os mesmos que o motor usa, porque saem da mesma chamada.
 */
function tensaoDoMppt(eletricoMod, eletricoInv, modulosPorString, tmin, tmax) {
  if (!eletricoMod || !eletricoInv) return null
  return classificarTensaoCC({
    voc:  eletricoMod.voc,
    vmpp: eletricoMod.vmpp,
    coefTempVoc: eletricoMod.coef_temp_voc,
    tempNoct:    eletricoMod.temp_noct,
    modulosPorString,
    tensaoMaxEntrada: eletricoInv.tensao_max_entrada,
    mpptMin: eletricoInv.mppt_min,
    mpptMax: eletricoInv.mppt_max,
    tMin: tmin, tMax: tmax,
  })
}

// ─── Validações elétricas locais ──────────────────────────────────────────────

/**
 * Retorna { avisos: string[], bloqueios: string[] }
 * Avisos = amarelo | Bloqueios = vermelho (impedem avanço seguro)
 */
function validarArranjo({ mppts, modulosPorString, totalModulos = 0, eletricoMod, eletricoInv, clima, tipoLigacao, fases, areaDisponivel }) {
  const avisos   = []
  const bloqueios = []

  if (!eletricoMod || !eletricoInv) return { avisos, bloqueios }

  const tmin = clima?.temperatura_min_historica_c ?? 10
  const tmax = clima?.temperatura_max_historica_c ?? 40

  // ── Por MPPT ──────────────────────────────────────────────────────────────
  mppts.forEach((mppt, i) => {
    const idx    = i + 1
    const mps    = mppt.modulosPorString
    const nStr   = mppt.numStrings

    /**
     * 1–3. Tensão — F2: veredito do classificador canônico, como já era a
     * corrente. A tela não recompara Voc frio, Vmpp frio nem Vmpp quente.
     *
     *   Voc frio    > tensão máxima de entrada → bloqueio (destrói o inversor)
     *   Vmpp frio   > MPPT máximo              → bloqueio (string longa demais)
     *   Vmpp quente < MPPT mínimo              → bloqueio (string curta demais)
     *
     * O teto de MPPT era AVISO aqui e ERRO no motor, e era medido no quente —
     * nunca disparava. O motor sempre foi a referência; a tela passa a segui-lo.
     */
    const tensao = tensaoDoMppt(eletricoMod, eletricoInv, mps, tmin, tmax)
    const { voc_string_max, vmpp_string_frio, vmpp_string_quente } = tensao.tensoes

    if (tensao.voc.status === STATUS_TENSAO.INCOMPATIVEL) {
      bloqueios.push(
        `MPPT ${idx}: Voc frio (${voc_string_max.toFixed(0)} V) excede Vmáx do inversor (${eletricoInv.tensao_max_entrada} V). Reduza módulos/string.`
      )
    } else if (tensao.voc.status === STATUS_TENSAO.ATENCAO) {
      avisos.push(
        `MPPT ${idx}: Voc frio (${voc_string_max.toFixed(0)} V) a menos de 5% do Vmáx do inversor (${eletricoInv.tensao_max_entrada} V). Margem pequena para o pior inverno.`
      )
    }

    if (tensao.mppt_min.status === STATUS_TENSAO.INCOMPATIVEL) {
      bloqueios.push(
        `MPPT ${idx}: Vmpp no calor (${vmpp_string_quente.toFixed(0)} V) abaixo do mínimo MPPT (${eletricoInv.mppt_min} V). Adicione módulos/string.`
      )
    }

    if (tensao.mppt_max.status === STATUS_TENSAO.INCOMPATIVEL) {
      bloqueios.push(
        `MPPT ${idx}: Vmpp no frio (${vmpp_string_frio.toFixed(0)} V) excede a faixa MPPT máxima (${eletricoInv.mppt_max} V). Reduza módulos/string.`
      )
    } else if (tensao.mppt_max.status === STATUS_TENSAO.ATENCAO) {
      avisos.push(
        `MPPT ${idx}: Vmpp no frio (${vmpp_string_frio.toFixed(0)} V) a menos de 5% do teto da faixa MPPT (${eletricoInv.mppt_max} V).`
      )
    }

    if (tensao.status === STATUS_TENSAO.NAO_AVALIADO) {
      avisos.push(
        `MPPT ${idx}: tensão não avaliada — faltam dados do módulo, do inversor ou do clima para fechar o critério.`
      )
    }

    /**
     * 4. Corrente — F1: o veredito é do classificador canônico, não desta tela.
     *
     * Antes havia aqui `correnteProjeto(isc, nStr) > corrente_max_mppt →
     * bloqueio`. Depois que o motor foi corrigido, essa comparação passou a
     * discordar dele: o wizard reprovava o que o motor classificava como
     * ATENÇÃO. Agora os dois consomem a mesma função.
     *
     *   Isc  > limite de CURTO     → bloqueio (limite absoluto)
     *   Impp > limite de TRABALHO  → aviso (limita geração, não impede)
     *   Isc × 1,25 acima do trab.  → aviso (dimensiona condutor)
     *   sem limite de curto         → lacuna declarada, nunca aprovação muda
     */
    const corrente = classificarCorrenteCC({
      isc: eletricoMod.isc,
      impp: eletricoMod.impp,
      strings: nStr,
      limiteTrabalho: eletricoInv.corrente_max_mppt,
      limiteCurto: eletricoInv.corrente_isc_max_mppt,
    })

    if (corrente.curto_circuito.status === STATUS_CORRENTE.INCOMPATIVEL) {
      bloqueios.push(
        `MPPT ${idx}: Isc do arranjo (${corrente.curto_circuito.isc_operacao} A) excede a corrente ` +
        `máxima de curto-circuito do inversor (${corrente.curto_circuito.limite_a} A). Limite absoluto.`
      )
    }
    if (corrente.operacao.status === STATUS_CORRENTE.ATENCAO) {
      avisos.push(
        `MPPT ${idx}: corrente de operação (Impp ${corrente.operacao.impp_total} A) acima da corrente ` +
        `máxima de trabalho da entrada (${corrente.operacao.limite_a} A). Haverá limitação nos picos; ` +
        `não é impedimento elétrico.`
      )
    }
    if (corrente.projeto_normativa.acima_do_trabalho === true) {
      avisos.push(
        `MPPT ${idx}: corrente de projeto (${corrente.projeto_normativa.isc_total} A, ` +
        `NBR 16690 §5.2) acima da corrente de trabalho (${corrente.projeto_normativa.limite_trabalho_a} A). ` +
        `Dimensione cabo e proteção por ela — não é limite do inversor.`
      )
    }
    if (corrente.curto_circuito.status === STATUS_CORRENTE.NAO_AVALIADO) {
      avisos.push(
        `MPPT ${idx}: corrente de curto-circuito não avaliada — o catálogo não declara ` +
        `\`corrente_isc_max\` para este inversor.`
      )
    }
  })

  // ── Oversizing DC/CA ──────────────────────────────────────────────────────
  // F-01: o total vem de fora, já derivado da topologia real. Somar `mppts`
  // aqui era uma segunda contagem do mesmo arranjo — no modo detalhado ela
  // divergia da soma exata por entrada/string, e a tela passava a discordar de
  // si mesma sobre quantos módulos existem.
  const totalKwp = (totalModulos * eletricoMod.potencia_w) / 1000
  /**
   * F2 — o `?? 1.30` saiu. Nenhum dos inversores do catálogo declara
   * `oversizing_max`, então o default fabricava o limite do fabricante em todos
   * os casos e o aviso saía contra número inventado. Sem o dado, o critério é
   * declarado não avaliado. O teto de 1,50× é do SISTEMA e continua valendo.
   */
  const oversizing = classificarOversizing({
    potenciaCcKwp: totalKwp,
    potenciaCaKw:  eletricoInv.potencia_ca_kw,
    limiteFabricante: eletricoInv.oversizing_max,
  })

  if (oversizing.status === STATUS_OVERSIZING.INCOMPATIVEL) {
    bloqueios.push(
      `Oversizing DC/CA (${oversizing.fator.toFixed(2)}×) acima do limite de segurança de ` +
      `${LIMITE_CRITICO_CC_CA.toFixed(2)}×. Risco de clipping excessivo e dano ao inversor.`
    )
  } else if (oversizing.status === STATUS_OVERSIZING.ATENCAO) {
    avisos.push(
      `Oversizing DC/CA (${oversizing.fator.toFixed(2)}×) acima do recomendado pelo fabricante ` +
      `(${(oversizing.limite_fabricante * 100).toFixed(0)}%).`
    )
  } else if (oversizing.status === STATUS_OVERSIZING.NAO_AVALIADO && oversizing.fator !== null) {
    avisos.push(
      `Oversizing DC/CA (${oversizing.fator.toFixed(2)}×) sem veredito: o catálogo não declara ` +
      `o limite CC/CA deste inversor. Abaixo do teto de segurança, nada é assumido no lugar.`
    )
  }

  if (oversizing.subdimensionado === true) {
    avisos.push(
      `Oversizing DC/CA (${oversizing.fator.toFixed(2)}×) abaixo de 1,0. O inversor está superdimensionado para este arranjo.`
    )
  }

  // ── Strings desbalanceadas ────────────────────────────────────────────────
  const modulosList = mppts.map(m => m.modulosPorString)
  const minMods = Math.min(...modulosList)
  const maxMods = Math.max(...modulosList)
  if (maxMods - minMods > 2 && mppts.length > 1) {
    avisos.push(
      `Strings com módulos muito diferentes entre MPPTs (${minMods}–${maxMods} mód/string). Strings desbalanceadas reduzem eficiência.`
    )
  }

  // ── Incompatibilidade mono/trifásica ──────────────────────────────────────
  if (tipoLigacao === 'monofasico' && fases === 3) {
    avisos.push('Inversor trifásico em instalação monofásica. Verificar permissão da distribuidora (normalmente não permitido abaixo de 75 kW).')
  }
  if (tipoLigacao === 'trifasico' && fases === 1) {
    avisos.push('Inversor monofásico em instalação trifásica. Considere inversor trifásico para melhor balanceamento de fases.')
  }

  // ── Área insuficiente ─────────────────────────────────────────────────────
  const areaNecess   = totalModulos * 2.0   // 2 m² por módulo (estimativa)
  const areaNum      = parseFloat(areaDisponivel)
  if (areaNum > 0 && areaNecess > areaNum) {
    avisos.push(
      `Área insuficiente: ${totalModulos} módulos precisam de ~${areaNecess.toFixed(0)} m², disponível: ${areaNum} m².`
    )
  }

  return { avisos, bloqueios }
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function ConfiguradorArranjoFV({
  painel,
  inversor,
  numPaineis     = 0,
  uf,
  projetoId,
  initialValues,
  areaDisponivel,
  tipoLigacao,
  dispatch,        // ProjetoFV dispatch para atualizar numPaineis real
  onSaved,
  onSaveAndNext,
}) {

  // ── Dados elétricos do catálogo ─────────────────────────────────────────
  const eletricoMod = useMemo(() => dadosEletricosPainel(painel),    [painel?.id])
  const eletricoInv = useMemo(() => dadosEletricosInversor(inversor), [inversor?.id])
  const nMppts       = inversor?.nMppts ?? 1

  // ── Estado central: MPPTs ───────────────────────────────────────────────
  const [mppts, setMppts] = useState(() => sugerirMPPTs(numPaineis, nMppts))

  // ── P1-MPPT-TOPOLOGY-IMPLEMENTATION-01: topologia detalhada (entradas/strings)
  // Entradas por MPPT sugeridas pelo catálogo do inversor (Huawei=2, etc.)
  const entradasPorMppt = inversor?.entradasPorMppt ?? eletricoInv?.entradas_por_mppt ?? 2
  const [modoDetalhado, setModoDetalhado] = useState(false)
  const [topologia2, setTopologia2] = useState(null)   // [{ entradas:[{strings:[{modulos}]}] }]

  // Liga/desliga o modo detalhado, derivando do modelo simples na 1ª ativação
  function alternarDetalhado() {
    if (!modoDetalhado) {
      setTopologia2(prev => prev ?? derivarTopologia(mppts, entradasPorMppt))
    }
    setModoDetalhado(v => !v)
  }

  // ── Quantidade alvo (user-defined) ─────────────────────────────────────
  // Em modo detalhado a soma é EXATA (módulos por string podem variar); no modo
  // simples mantém numStrings × modulosPorString.
  const totalModulosArranjo = useMemo(
    () => (modoDetalhado && topologia2)
      ? resumoTopologia(topologia2).totalModulos
      : mppts.reduce((s, m) => s + m.numStrings * m.modulosPorString, 0),
    [mppts, modoDetalhado, topologia2]
  )

  // ── Topologia explícita (string / micro / otimizador) ───────────────────
  const topologia = useMemo(() => classificarTopologia(inversor, eletricoInv), [inversor?.id, inversor?.modelo, eletricoInv])
  const ehMicro = topologia === 'micro'
  const dimMicro = useMemo(() => {
    if (!ehMicro || !eletricoMod) return null
    const numMod = totalModulosArranjo || numPaineis || 0
    return dimensionarMicroinversor({ numModulos: numMod, potenciaModuloW: eletricoMod.potencia_w, micro: eletricoInv || {} })
  }, [ehMicro, eletricoMod, eletricoInv, totalModulosArranjo, numPaineis])

  // ── Clima ───────────────────────────────────────────────────────────────
  const climaPadrao = CLIMA_PADRAO_UF[uf] ?? { tmin: 10, tmax: 40 }
  const [tmin, setTmin] = useState(climaPadrao.tmin)
  const [tmax, setTmax] = useState(climaPadrao.tmax)
  const [cidadeClima, setCidadeClima] = useState('')

  // ── Anti-loop: reidratação única ────────────────────────────────────────
  const reidratadoRef = useRef(false)

  useEffect(() => {
    if (reidratadoRef.current) return
    reidratadoRef.current = true
    if (!initialValues) return

    if (initialValues.arranjo?.mppts?.length > 0) {
      setMppts(initialValues.arranjo.mppts.map(m => ({
        numStrings:       m.strings_paralelo ?? 1,
        modulosPorString: m.modulos_por_string ?? 8,
      })))
      // P1-MPPT-TOPOLOGY-IMPLEMENTATION-01: se há topologia detalhada persistida,
      // reidrata o editor de entradas e liga o modo detalhado.
      const temEntradas = initialValues.arranjo.mppts.some(m => Array.isArray(m.entradas) && m.entradas.length > 0)
      if (temEntradas) {
        setTopologia2(initialValues.arranjo.mppts.map(m => ({
          entradas: (m.entradas || []).map(e => ({
            strings: (e.strings || []).map(s => ({ modulos: s.modulos ?? 0 })),
          })),
        })))
        setModoDetalhado(true)
      }
    } else if (initialValues.arranjo) {
      const { quantidade_modulos_por_string: mps, quantidade_strings_paralelo: s } = initialValues.arranjo
      if (mps > 0 && s > 0) {
        setMppts(Array.from({ length: nMppts }, (_, i) => ({
          numStrings:       i === 0 ? s : 0,
          modulosPorString: mps,
        })))
      }
    }

    if (initialValues.clima_utilizado) {
      const c = initialValues.clima_utilizado
      if (c.temperatura_min_historica_c != null) setTmin(c.temperatura_min_historica_c)
      if (c.temperatura_max_historica_c != null) setTmax(c.temperatura_max_historica_c)
      if (c.cidade)                              setCidadeClima(c.cidade)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-inicializa MPPTs quando inversor muda (nMppts diferente)
  const prevNMpptsRef = useRef(nMppts)
  useEffect(() => {
    if (prevNMpptsRef.current !== nMppts && !reidratadoRef.current) {
      setMppts(sugerirMPPTs(totalModulosArranjo || numPaineis, nMppts))
    }
    prevNMpptsRef.current = nMppts
  }, [nMppts])

  // P1-MPPT-TOPOLOGY-IMPLEMENTATION-01: em modo detalhado, sincroniza o modelo
  // simples (mppts) a partir da topologia real, para manter validações, árvore,
  // propagação e unifilar coerentes. numStrings = nº de strings com módulos;
  // modulosPorString = pior caso (máx) — Voc frio conservador.
  useEffect(() => {
    if (!modoDetalhado || !topologia2) return
    const legacy = topologia2.map((m) => {
      const strings = (m.entradas || []).flatMap((e) => (e.strings || []).filter((s) => (s.modulos || 0) > 0))
      const mods = strings.map((s) => s.modulos)
      return { numStrings: strings.length, modulosPorString: mods.length ? Math.max(...mods) : 0 }
    })
    setMppts(legacy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoDetalhado, topologia2])

  // ── Helpers de mutação de estado ────────────────────────────────────────
  function setMpptField(idx, campo, valor) {
    setMppts(prev => prev.map((m, i) => i === idx ? { ...m, [campo]: Math.max(0, Number(valor) || 0) } : m))
  }

  function setModulosPorStringGlobal(v) {
    setMppts(prev => prev.map(m => ({ ...m, modulosPorString: Math.max(1, Math.min(30, Number(v) || 1)) })))
  }

  // ── Autoconfigurar pela quantidade alvo ─────────────────────────────────
  function autoConfigurar(qtdAlvo) {
    const mps = Math.min(14, Math.max(6, Math.ceil(qtdAlvo / nMppts / 1.5)))
    const stringsTotal = Math.ceil(qtdAlvo / mps)
    const base  = Math.floor(stringsTotal / nMppts)
    const resto = stringsTotal - base * nMppts
    setMppts(Array.from({ length: nMppts }, (_, i) => ({
      numStrings:       base + (i < resto ? 1 : 0),
      modulosPorString: mps,
    })))
  }

  // ── Propagação ao contexto ──────────────────────────────────────────────
  // Quando o total de módulos muda, atualiza numPaineis, potenciaRealKwp e
  // numStrings (usado por gerarUnifilarSVG via dim.numStrings) no contexto
  useEffect(() => {
    if (!dispatch || !totalModulosArranjo || !painel?.potenciaW) return
    const potRealKwp    = +(totalModulosArranjo * painel.potenciaW / 1000).toFixed(3)
    const totalStrings  = mppts.reduce((s, m) => s + m.numStrings, 0)
    dispatch({
      type: 'SET_DIMENSIONAMENTO',
      payload: {
        numPaineis:      totalModulosArranjo,
        potenciaRealKwp: potRealKwp,
        numStrings:      totalStrings,         // ← unifilar usa este campo
      },
    })
    dispatch({
      type: 'SET_EQUIPAMENTO',
      payload: { tipo: 'quantidadeModulos', item: totalModulosArranjo },
    })
    dispatch({
      type: 'SET_EQUIPAMENTO',
      payload: { tipo: 'arranjoMPPTs', item: mppts },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalModulosArranjo, painel?.potenciaW])

  // ── Objetos para o hook de compatibilidade ──────────────────────────────
  // Usa o MPPT com mais módulos/string como worst-case para a API
  const piorCaso = useMemo(() => {
    if (!mppts.length) return null
    return mppts.reduce((max, m) => m.modulosPorString > max.modulosPorString ? m : max, mppts[0])
  }, [mppts])

  /**
   * F-01 — totais REAIS do arranjo, para os critérios de sistema.
   *
   * `totalModulosArranjo` já soma a topologia (exata no modo detalhado, e
   * `strings × módulos` por MPPT no modo simples). Ele é a fonte do total nesta
   * tela desde sempre — é o número que a tela mostra e o que se persiste em
   * `engenharia_eletrica.arranjo.total_modulos`. Aqui ele passa a ser também o
   * número que o motor usa, em vez de o motor reconstruir o seu próprio.
   */
  const totalStringsArranjo = useMemo(
    () => (modoDetalhado && topologia2)
      ? resumoTopologia(topologia2).totalStrings
      : mppts.reduce((s, m) => s + (m.numStrings || 0), 0),
    [mppts, modoDetalhado, topologia2]
  )

  /**
   * MPPTs efetivamente OCUPADOS — não o número de MPPTs do inversor.
   *
   * Era `nMppts` aqui, e essa foi a metade do defeito: um inversor de 3 MPPTs
   * com um único MPPT povoado declarava 3 ao motor, que replicava o pior caso
   * nos três. A outra metade era o motor multiplicar; as duas foram corrigidas.
   */
  const mpptsOcupados = useMemo(() => {
    if (modoDetalhado && topologia2) {
      return topologia2.filter((m) => (m.entradas || []).some(
        (e) => (e.strings || []).some((s) => (s.modulos || 0) > 0))).length || 1
    }
    return mppts.filter((m) => (m.numStrings || 0) > 0 && (m.modulosPorString || 0) > 0).length || 1
  }, [mppts, modoDetalhado, topologia2])

  const arranjoApi = useMemo(() => ({
    // Pior MPPT — decide tensão de string e corrente de entrada.
    quantidade_modulos_por_string: piorCaso?.modulosPorString ?? 0,
    quantidade_strings_paralelo:   piorCaso?.numStrings       ?? 0,
    num_mppt_usados:               mpptsOcupados,
    // Arranjo inteiro — decide relação CC/CA e corrente total.
    total_modulos_arranjo:         totalModulosArranjo || null,
    total_strings_arranjo:         totalStringsArranjo || null,
  }), [piorCaso, mpptsOcupados, totalModulosArranjo, totalStringsArranjo])

  const climaObj = useMemo(() => ({
    temperatura_min_historica_c: tmin,
    temperatura_max_historica_c: tmax,
    cidade: cidadeClima || uf || null,
    uf:     uf || null,
  }), [tmin, tmax, cidadeClima, uf])

  // ── Hook de compatibilidade (debounced, API) ─────────────────────────────
  const { resultado, carregando, erro: erroApi } = useCompatibilidadeEletrica(
    eletricoMod, eletricoInv, arranjoApi, climaObj,
  )

  // ── Validações locais síncronas ─────────────────────────────────────────
  const { avisos, bloqueios } = useMemo(() => validarArranjo({
    mppts,
    modulosPorString: piorCaso?.modulosPorString ?? 0,
    // F-01: fonte única do total, derivada da topologia real.
    totalModulos: totalModulosArranjo,
    eletricoMod,
    eletricoInv,
    clima: climaObj,
    tipoLigacao,
    fases: inversor?.fases ?? 1,
    areaDisponivel,
  }), [mppts, totalModulosArranjo, eletricoMod, eletricoInv, climaObj, tipoLigacao, inversor?.fases, areaDisponivel])

  // ── Cálculos elétricos para exibição ─────────────────────────────────────
  const totalKwp = eletricoMod
    ? +(totalModulosArranjo * eletricoMod.potencia_w / 1000).toFixed(3)
    : null
  const oversizingVal = (totalKwp && eletricoInv)
    ? +(totalKwp / eletricoInv.potencia_ca_kw).toFixed(2)
    : null

  // ── Save ─────────────────────────────────────────────────────────────────
  const [saveStatus,   setSaveStatus]   = useState('idle')
  const [saveMensagem, setSaveMensagem] = useState('')

  const montarPayload = useCallback(() => {
    if (!resultado) return null
    const { calculos, warnings, erros, clima_utilizado: cu } = resultado
    return {
      topologia,
      micro: (ehMicro && dimMicro?.valido) ? {
        qtd_microinversores:   dimMicro.qtdMicros,
        modulos_por_micro:     dimMicro.modulosPorMicro,
        entradas_por_micro:    dimMicro.entradasPorMicro,
        distribuicao_modulos:  dimMicro.distribuicao,
        micros_completos:      dimMicro.microsCompletos,
        micros_parciais:       dimMicro.microsParciais,
        potencia_cc_kw:        dimMicro.potenciaCcKw,
        potencia_ca_kw:        dimMicro.potenciaCaKw,
        relacao_dc_ac:         dimMicro.relacaoDcAc,
        aproveitamento:        dimMicro.aproveitamento,
        oversizing_ok:         dimMicro.oversizingOk,
      } : null,
      arranjo: {
        // Legacy (backward compat)
        quantidade_modulos_por_string: piorCaso?.modulosPorString ?? 0,
        quantidade_strings_paralelo:   piorCaso?.numStrings       ?? 0,
        total_modulos:                 totalModulosArranjo,
        // Multi-MPPT. F-01: OCUPADOS, não o total do inversor — o campo se
        // chama "usados" e passou a valer o que o nome diz. `mppts[]` abaixo
        // continua sendo a composição real de onde tudo isto deriva.
        num_mppts_usados: mpptsOcupados,
        // P1-MPPT-TOPOLOGY-IMPLEMENTATION-01: em modo detalhado persiste a
        // topologia REAL (entradas[].strings[].modulos) + resumo derivado por MPPT.
        // No modo simples mantém o resumo por MPPT como antes.
        mppts: (modoDetalhado && topologia2)
          ? topologia2.map((m, i) => {
              const strings = (m.entradas || []).flatMap(e => (e.strings || []).filter(s => (s.modulos || 0) > 0))
              const mods = strings.map(s => s.modulos)
              return {
                mppt:               i + 1,
                strings_paralelo:   strings.length,
                modulos_por_string: mods.length ? Math.max(...mods) : 0,
                total_modulos:      mods.reduce((a, b) => a + b, 0),
                entradas: (m.entradas || []).map((e, ei) => ({
                  entrada: ei + 1,
                  strings: (e.strings || []).map(s => ({ modulos: s.modulos || 0 })),
                })),
              }
            })
          : mppts.map((m, i) => ({
              mppt:                i + 1,
              strings_paralelo:    m.numStrings,
              modulos_por_string:  m.modulosPorString,
              total_modulos:       m.numStrings * m.modulosPorString,
            })),
      },
      clima_utilizado: {
        cidade: cu?.cidade ?? cidadeClima ?? null,
        uf:     cu?.uf     ?? uf ?? null,
        temperatura_min_historica_c: cu?.temperatura_min_c ?? tmin,
        temperatura_max_historica_c: cu?.temperatura_max_c ?? tmax,
        fonte:         cu?.fonte ?? 'manual',
        usou_fallback: cu?.usou_fallback ?? false,
      },
      compatibilidade: {
        versao_motor:  VERSAO_MOTOR,
        compativel:    resultado.compativel,
        /**
         * F2 — `validacoes_locais: { bloqueios, avisos }` saiu daqui.
         *
         * O campo gravava o veredito PRÓPRIO do wizard ao lado do veredito do
         * motor, com peso igual e nome de validação. Era escrito neste único
         * ponto e lido em lugar nenhum do código — verdade persistida sem
         * consumidor, e uma segunda verdade elétrica no mesmo documento.
         *
         * Depois da F2 a tela não tem mais veredito elétrico próprio: tensão,
         * corrente e oversizing vêm dos classificadores canônicos, os mesmos
         * que o motor usa, e o resultado do motor já está em `diagnosticos`.
         * O que sobra em `avisos` é edição de tela — balanceamento entre MPPTs,
         * mono/trifásico, área — que orienta enquanto se edita e não é estado
         * do projeto. Documentos antigos que já têm o campo não são tocados.
         */
        diagnosticos:  [...(erros ?? []), ...(warnings ?? [])],
        margens: calculos ? {
          margem_tensao_percentual:     calculos.margem_tensao_percentual,
          margem_mppt_max_percentual:   calculos.margem_mppt_max_percentual,
          margem_mppt_min_percentual:   calculos.margem_mppt_min_percentual,
          margem_oversizing_percentual: calculos.margem_oversizing_percentual,
        } : null,
        calculos_principais: calculos ? {
          voc_string_max:     calculos.voc_string_max,
          vmpp_string_frio:   calculos.vmpp_string_frio,
          vmpp_string_quente: calculos.vmpp_string_quente,
          isc_total:          calculos.isc_total,
          fator_oversizing:   calculos.fator_oversizing,
          potencia_cc_total:  calculos.potencia_cc_total,
          total_modulos:      calculos.total_modulos,
        } : null,
        analisado_em: new Date().toISOString(),
      },
    }
  }, [resultado, mppts, piorCaso, totalModulosArranjo, mpptsOcupados, cidadeClima, uf, tmin, tmax, bloqueios, avisos, topologia, ehMicro, dimMicro, modoDetalhado, topologia2])

  const salvar = useCallback(async () => {
    if (!projetoId) {
      setSaveStatus('erro'); setSaveMensagem('Projeto ainda não foi criado. Complete as etapas anteriores.')
      return null
    }
    if (!resultado) {
      setSaveStatus('erro'); setSaveMensagem('Aguarde a análise de compatibilidade.')
      return null
    }
    const payload = montarPayload()
    if (!payload) return null
    setSaveStatus('saving'); setSaveMensagem('')
    try {
      const resp = await fetch(`/api/projetos-fv/${projetoId}/etapa`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: 'engenharia_eletrica', dados: payload }),
      })
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro ?? `HTTP ${resp.status}`)
      setSaveStatus('ok'); setSaveMensagem('Configuração elétrica salva.')
      onSaved?.()
      setTimeout(() => setSaveStatus('idle'), 4000)
      return payload
    } catch (err) {
      setSaveStatus('erro'); setSaveMensagem(err.message ?? 'Erro ao salvar.')
      return null
    }
  }, [projetoId, resultado, montarPayload, onSaved])

  const salvarEAvancar = useCallback(async () => {
    const ok = await salvar()
    if (ok !== null) onSaveAndNext?.()
  }, [salvar, onSaveAndNext])

  const podeSalvar = !!resultado && !carregando && !!projetoId

  // ─── Render ────────────────────────────────────────────────────────────────
  const semMod = painel   && !eletricoMod
  const semInv = inversor && !eletricoInv

  return (
    <div className="space-y-5">

      {/* Aviso: dados elétricos ausentes */}
      {(semMod || semInv) && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          {semMod && 'Dados elétricos do módulo não mapeados. '}
          {semInv && 'Dados elétricos do inversor não mapeados. '}
          Análise de compatibilidade indisponível.
        </div>
      )}

      {!projetoId && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          Salve o projeto para habilitar a persistência da configuração elétrica.
        </div>
      )}

      {/* ── 1. Quantidade de módulos ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700">Quantidade de Módulos</h3>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Total configurado</label>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-slate-900">{totalModulosArranjo}</span>
              <span className="text-sm text-slate-400 font-medium">módulos</span>
            </div>
            {numPaineis > 0 && totalModulosArranjo !== numPaineis && (
              <p className="text-xs text-amber-600 mt-1">
                Dimensionamento E5 sugeria {numPaineis} módulos
                {totalModulosArranjo > numPaineis ? ` (+${totalModulosArranjo - numPaineis})` : ` (−${numPaineis - totalModulosArranjo})`}
              </p>
            )}
          </div>

          {eletricoMod && (
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-slate-400">Potência CC real</p>
                <p className="font-bold text-slate-800">{totalKwp} kWp</p>
              </div>
              {oversizingVal && (
                <div>
                  <p className="text-xs text-slate-400">Oversizing DC/CA</p>
                  <p className={`font-bold ${oversizingVal > 1.3 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {oversizingVal}×
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Área mínima</p>
                <p className="font-bold text-slate-800">{(totalModulosArranjo * 2).toFixed(0)} m²</p>
              </div>
            </div>
          )}

          <button
            onClick={() => autoConfigurar(numPaineis || totalModulosArranjo)}
            className="text-xs bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg font-medium transition-colors"
          >
            ↺ Auto-configurar pelo E5
          </button>
        </div>
      </div>

      {/* ── Sistema Microinversor (topologia = micro): SEM string/MPPT ─────── */}
      {ehMicro && (
        <div className="bg-white border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-amber-700">⚡ Sistema Microinversor</h3>
            <span className="ml-auto text-xs text-slate-500">{inversor?.marca} {inversor?.modelo}</span>
          </div>
          {dimMicro?.valido ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-xs text-slate-400">Módulos</p><p className="font-bold text-slate-800">{dimMicro.numModulos}</p></div>
                <div><p className="text-xs text-slate-400">Microinversores</p><p className="font-bold text-amber-700 text-lg">{dimMicro.qtdMicros}</p></div>
                <div><p className="text-xs text-slate-400">Módulos por micro</p><p className="font-bold text-slate-800">{dimMicro.modulosPorMicro} <span className="text-xs text-slate-400">({dimMicro.entradasPorMicro} entradas)</span></p></div>
                <div><p className="text-xs text-slate-400">Aproveitamento entradas</p><p className="font-bold text-slate-800">{(dimMicro.aproveitamento * 100).toFixed(0)}%</p></div>
                <div><p className="text-xs text-slate-400">Potência CC</p><p className="font-bold text-slate-800">{dimMicro.potenciaCcKw} kWp</p></div>
                <div><p className="text-xs text-slate-400">Potência CA</p><p className="font-bold text-slate-800">{dimMicro.potenciaCaKw} kW</p></div>
                <div><p className="text-xs text-slate-400">Relação DC/AC</p><p className={`font-bold ${dimMicro.oversizingOk ? 'text-emerald-700' : 'text-amber-600'}`}>{dimMicro.relacaoDcAc}× {dimMicro.oversizingOk ? '✓' : '⚠'}</p></div>
                <div><p className="text-xs text-slate-400">Distribuição</p><p className="font-semibold text-slate-700">{resumoDistribuicao(dimMicro)}</p></div>
              </div>
              <p className="text-xs text-slate-400">Cada módulo conecta a uma entrada do micro — <strong>sem strings, sem MPPT, sem strings paralelas</strong>.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Selecione módulo e quantidade para dimensionar o sistema microinversor.</p>
          )}
        </div>
      )}

      {/* ── 2. Configuração por MPPT (apenas STRING) ───────────────────────── */}
      {!ehMicro && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Configuração do Arranjo por MPPT</h3>
          </div>
          {/* P1-MPPT-TOPOLOGY-IMPLEMENTATION-01: alterna simples ↔ topologia real */}
          <button
            type="button"
            onClick={alternarDetalhado}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              modoDetalhado
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
            }`}
          >
            {modoDetalhado ? '← Modo simples' : 'Topologia detalhada (entradas/strings) →'}
          </button>
        </div>

        {/* ── Modo DETALHADO: editor de entradas/strings real ── */}
        {modoDetalhado && topologia2 && (
          <TopologiaMPPTEditor
            value={topologia2}
            onChange={setTopologia2}
            eletricoMod={eletricoMod}
            eletricoInv={eletricoInv}
            tmin={tmin}
          />
        )}

        {/* ── Modo SIMPLES: Módulos/string global + strings por MPPT ── */}
        {!modoDetalhado && (<>

        {/* Módulos/string global */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Módulos por string (em série) — aplica a todos os MPPTs
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={1} max={30}
              value={mppts[0]?.modulosPorString ?? 8}
              onChange={e => setModulosPorStringGlobal(e.target.value)}
              className="flex-1 accent-blue-600"
            />
            <input
              type="number" min={1} max={30}
              value={mppts[0]?.modulosPorString ?? 8}
              onChange={e => setModulosPorStringGlobal(e.target.value)}
              className="w-16 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {eletricoMod && (
            <p className="text-[11px] text-slate-400 mt-1">
              Voc STC por string: ~{(eletricoMod.voc * (mppts[0]?.modulosPorString ?? 8)).toFixed(0)} V |
              Vmpp STC: ~{(eletricoMod.vmpp * (mppts[0]?.modulosPorString ?? 8)).toFixed(0)} V
            </p>
          )}
        </div>

        {/* Strings por MPPT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mppts.map((mppt, i) => {
            // F2: os números do cartão saem do mesmo veredito que valida o
            // arranjo. `vmppF` era Vmpp em STC comparado ao MPPT mínimo —
            // terceira leitura da regra; agora é o Vmpp frio do classificador.
            const tensaoLocal = tensaoDoMppt(eletricoMod, eletricoInv, mppt.modulosPorString, tmin, tmax)
            const eletricoLocal = tensaoLocal ? {
              vocStr: tensaoLocal.tensoes.voc_string_max,
              vmppQ:  tensaoLocal.tensoes.vmpp_string_quente,
              vmppF:  tensaoLocal.tensoes.vmpp_string_frio,
              iscT:   eletricoMod.isc * mppt.numStrings,
            } : null

            const vocOk   = tensaoLocal ? tensaoLocal.voc.status      !== STATUS_TENSAO.INCOMPATIVEL : true
            const mpptOk  = tensaoLocal ? tensaoLocal.mppt_min.status !== STATUS_TENSAO.INCOMPATIVEL
                                       && tensaoLocal.mppt_max.status !== STATUS_TENSAO.INCOMPATIVEL : true
            // F1: o cartao pinta pelo veredito canonico. So o limite ABSOLUTO
            // (curto-circuito) invalida; excesso de trabalho e atencao, nao erro.
            const iscOk   = eletricoLocal
              ? classificarCorrenteCC({
                  isc: eletricoMod.isc, impp: eletricoMod.impp, strings: mppt.numStrings,
                  limiteTrabalho: eletricoInv.corrente_max_mppt,
                  limiteCurto: eletricoInv.corrente_isc_max_mppt,
                }).curto_circuito.status !== STATUS_CORRENTE.INCOMPATIVEL
              : true

            return (
              <div key={i} className={`p-4 rounded-xl border-2 space-y-3 ${
                (!vocOk || !mpptOk || !iscOk) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-blue-500" />
                    <span className="text-sm font-semibold text-slate-800">MPPT {i + 1}</span>
                    {(!vocOk || !mpptOk || !iscOk) && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
                        ⚠ INVÁLIDO
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {mppt.numStrings} × {mppt.modulosPorString} = {mppt.numStrings * mppt.modulosPorString} mód
                  </span>
                </div>

                {/* Strings paralelas neste MPPT */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 w-24 shrink-0">Strings paralelas</label>
                  <input
                    type="range" min={0} max={10}
                    value={mppt.numStrings}
                    onChange={e => setMpptField(i, 'numStrings', e.target.value)}
                    className="flex-1 accent-blue-600"
                  />
                  <input
                    type="number" min={0} max={10}
                    value={mppt.numStrings}
                    onChange={e => setMpptField(i, 'numStrings', e.target.value)}
                    className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Parâmetros calculados */}
                {eletricoLocal && (
                  <div className="grid grid-cols-3 gap-2 text-[11px] border-t border-slate-200 pt-2">
                    <div className={!vocOk ? 'text-red-700' : 'text-slate-600'}>
                      <p className="text-slate-400">Voc frio</p>
                      <p className="font-mono font-semibold">{eletricoLocal.vocStr.toFixed(0)} V {!vocOk ? '⛔' : '✓'}</p>
                    </div>
                    <div className={!mpptOk ? 'text-red-700' : 'text-slate-600'}>
                      <p className="text-slate-400">Vmpp frio</p>
                      <p className="font-mono font-semibold">{eletricoLocal.vmppF.toFixed(0)} V {!mpptOk ? '⛔' : '✓'}</p>
                    </div>
                    <div className={!iscOk ? 'text-red-700' : 'text-slate-600'}>
                      <p className="text-slate-400">Isc total</p>
                      <p className="font-mono font-semibold">{eletricoLocal.iscT.toFixed(1)} A {!iscOk ? '⛔' : '✓'}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </>)}
      </div>
      )}

      {/* ── 3. MPPT Tree Visualization (apenas STRING) ─────────────────────── */}
      {!ehMicro && eletricoMod && (
        <div className="bg-slate-950 text-slate-100 rounded-xl p-5 space-y-4 font-mono text-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-semibold">Topologia do Arranjo CC</span>
            <span className="ml-auto text-slate-500 text-xs">{painel?.marca} {painel?.modelo}</span>
          </div>

          {mppts.map((mppt, i) => {
            // F2: mesmo veredito canônico dos cartões acima — nada é recomparado aqui.
            const tensaoLocal = tensaoDoMppt(eletricoMod, eletricoInv, mppt.modulosPorString, tmin, tmax)
            const vocStr  = (tensaoLocal?.tensoes.voc_string_max
              ?? eletricoMod.voc * mppt.modulosPorString).toFixed(0)
            const vmppF   = (tensaoLocal?.tensoes.vmpp_string_frio
              ?? eletricoMod.vmpp * mppt.modulosPorString).toFixed(0)
            const vmppQ   = (tensaoLocal?.tensoes.vmpp_string_quente
              ?? eletricoMod.vmpp * mppt.modulosPorString).toFixed(0)
            const iscStr  = eletricoMod.isc.toFixed(2)
            const kWp     = ((mppt.numStrings * mppt.modulosPorString * eletricoMod.potencia_w) / 1000).toFixed(2)

            const vocOk   = tensaoLocal ? tensaoLocal.voc.status      !== STATUS_TENSAO.INCOMPATIVEL : true
            const mpptOk  = tensaoLocal ? tensaoLocal.mppt_min.status !== STATUS_TENSAO.INCOMPATIVEL
                                       && tensaoLocal.mppt_max.status !== STATUS_TENSAO.INCOMPATIVEL : true
            // F1: mesmo veredito canonico do cartao acima.
            const iscOk   = eletricoInv
              ? classificarCorrenteCC({
                  isc: eletricoMod.isc, impp: eletricoMod.impp, strings: mppt.numStrings,
                  limiteTrabalho: eletricoInv.corrente_max_mppt,
                  limiteCurto: eletricoInv.corrente_isc_max_mppt,
                }).curto_circuito.status !== STATUS_CORRENTE.INCOMPATIVEL
              : true

            const status  = (!vocOk || !mpptOk || !iscOk) ? '⛔' : '✓'

            return (
              <div key={i} className="space-y-1">
                {/* Cabeçalho MPPT */}
                <div className={`flex items-center gap-2 ${(!vocOk || !mpptOk || !iscOk) ? 'text-red-400' : 'text-blue-400'}`}>
                  <span>MPPT {i + 1}</span>
                  <span className="text-slate-500">
                    [{mppt.numStrings} string{mppt.numStrings !== 1 ? 's' : ''} × {mppt.modulosPorString} mód = {kWp} kWp]
                  </span>
                  <span className="ml-auto text-xs">
                    Voc:{vocStr}V {status} | Vmpp:{vmppF}–{vmppQ}V | Isc:{iscStr}A/str
                  </span>
                </div>

                {/* Strings */}
                {Array.from({ length: mppt.numStrings }, (_, s) => {
                  const isLast = s === mppt.numStrings - 1
                  return (
                    <div key={s} className="flex items-center gap-2 text-slate-300 pl-2">
                      <span className="text-slate-600">{isLast ? '└──' : '├──'}</span>
                      <span className="text-emerald-400">String {s + 1}</span>
                      <span className="text-slate-500">→</span>
                      <span>{mppt.modulosPorString} módulos em série</span>
                    </div>
                  )
                })}

                {mppt.numStrings === 0 && (
                  <div className="pl-2 text-slate-600">└── (sem strings configuradas)</div>
                )}

                {i < mppts.length - 1 && <div className="border-t border-slate-800 mt-1" />}
              </div>
            )
          })}

          {/* Totais */}
          <div className="border-t border-slate-700 pt-3 text-xs text-slate-400 flex flex-wrap gap-4">
            <span>Total: <strong className="text-slate-200">{totalModulosArranjo}</strong> módulos</span>
            {totalKwp && <span>Potência CC: <strong className="text-amber-400">{totalKwp} kWp</strong></span>}
            {oversizingVal && <span>Oversizing: <strong className={oversizingVal > 1.3 ? 'text-amber-400' : 'text-emerald-400'}>{oversizingVal}×</strong></span>}
          </div>
        </div>
      )}

      {/* ── 4. Validações locais ────────────────────────────────────────────── */}
      {(bloqueios.length > 0 || avisos.length > 0) && (
        <div className="space-y-2">
          {bloqueios.map((b, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <ZapOff className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{b}</span>
            </div>
          ))}
          {avisos.map((a, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 5. Dados climáticos ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Dados Climáticos da Região</h3>
          </div>
          {uf && CLIMA_PADRAO_UF[uf] && (
            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              Padrão {uf} pré-carregado
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Tmin histórica (°C)</label>
            <input
              type="number" value={tmin} min={-30} max={25} step={1}
              onChange={e => setTmin(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">Pior caso Voc frio</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Tmax histórica (°C)</label>
            <input
              type="number" value={tmax} min={20} max={55} step={1}
              onChange={e => setTmax(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">Pior caso Vmpp quente</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Cidade / identificação</label>
            <input
              type="text" placeholder="Ex: Natal-RN" value={cidadeClima}
              onChange={e => setCidadeClima(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-50 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Fallback nacional: Tmin=10°C / Tmax=40°C (NBR 16690). Use INMET ou NASA POWER para precisão.
        </p>
      </div>

      {/* ── 6. Resultado API de compatibilidade ─────────────────────────────── */}
      {carregando && (
        <div className="flex items-center gap-3 py-4 px-5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          Analisando compatibilidade elétrica via motor backend...
        </div>
      )}
      {erroApi && !carregando && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold">Erro na análise de compatibilidade</p>
            <p className="text-xs mt-0.5 font-mono">{erroApi}</p>
          </div>
        </div>
      )}
      {resultado && !carregando && <PainelCompatibilidadeFV resultado={resultado} />}

      {/* ── 7. Optimizer inteligente ─────────────────────────────────────────── */}
      {(eletricoMod || eletricoInv) && (
        <SecaoOptimizer
          eletricoModulo={eletricoMod}
          eletricoInversor={eletricoInv}
          clima={climaObj}
          mppts={mppts}
          onAplicar={(m, s) => {
            const sugestao = sugerirMPPTs(m * s, nMppts)
            setMppts(sugestao)
          }}
        />
      )}

      {/* ── 8. Barra de save ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-h-[28px]">
            {saveStatus === 'saving' && <><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-sm text-slate-500">Salvando...</span></>}
            {saveStatus === 'ok'     && <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm text-emerald-700 font-medium">{saveMensagem}</span></>}
            {saveStatus === 'erro'   && <><XCircle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-700">{saveMensagem}</span></>}
            {saveStatus === 'idle' && resultado && projetoId && (
              <span className="text-xs text-slate-400">
                {bloqueios.length > 0
                  ? `⛔ ${bloqueios.length} bloqueio(s) — resolva antes de prosseguir`
                  : resultado.compativel ? '✓ Arranjo compatível — pronto para salvar' : '⚠ Arranjo com avisos — pode salvar mesmo assim'}
              </span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={salvar}
              disabled={!podeSalvar || saveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                podeSalvar && saveStatus !== 'saving'
                  ? 'bg-slate-700 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" /> Salvar configuração
            </button>
            {onSaveAndNext && (
              <button
                onClick={salvarEAvancar}
                disabled={!podeSalvar || saveStatus === 'saving' || bloqueios.length > 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  podeSalvar && saveStatus !== 'saving' && bloqueios.length === 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Salvar e avançar <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {bloqueios.length > 0 && (
          <p className="text-xs text-red-600 mt-2">
            ⛔ Resolva os {bloqueios.length} bloqueio(s) elétrico(s) antes de avançar para o orçamento.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Chip auxiliar ────────────────────────────────────────────────────────────
function Chip({ label, valor, unidade }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
      <span className="text-slate-500">{label}:</span>
      <span className="font-mono font-bold text-slate-800">{valor}</span>
      {unidade && <span className="text-slate-400">{unidade}</span>}
    </div>
  )
}

// ─── Optimizer inteligente (mantido do S2.12) ────────────────────────────────
function SecaoOptimizer({ eletricoModulo, eletricoInversor, clima, mppts, onAplicar }) {
  const [status,    setStatus]    = useState('idle')
  const [resultado, setResultado] = useState(null)
  const [erroMsg,   setErroMsg]   = useState('')
  const podeOtimizar = !!eletricoModulo && !!eletricoInversor

  async function sugerir() {
    if (!podeOtimizar) return
    setStatus('loading'); setErroMsg('')
    try {
      const resp = await fetch('/api/engenharia/optimizer-arranjo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dados_eletricos_modulo:   eletricoModulo,
          dados_eletricos_inversor: eletricoInversor,
          dados_climaticos_regiao:  clima ? {
            temperatura_min_historica_c: clima.temperatura_min_historica_c,
            temperatura_max_historica_c: clima.temperatura_max_historica_c,
          } : null,
        }),
      })
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro ?? `HTTP ${resp.status}`)
      setResultado(await resp.json()); setStatus('ok')
    } catch (err) { setErroMsg(err.message ?? 'Erro ao executar optimizer.'); setStatus('erro') }
  }

  const top3  = resultado?.configuracoes_validas?.slice(0, 3) ?? []
  const stats = resultado?.resumo_estatistico

  // mppt ativo (pior caso)
  const mpsAtivo = mppts.reduce((max, m) => m.modulosPorString > max ? m.modulosPorString : max, 0)
  const sAtivo   = mppts.reduce((s, m) => s + m.numStrings, 0)

  return (
    <div className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-700">Optimizer de Arranjo</h3>
          <span className="text-[10px] font-bold tracking-widest text-violet-500 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">GRID SEARCH</span>
        </div>
        <button
          onClick={sugerir} disabled={!podeOtimizar || status === 'loading'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            podeOtimizar && status !== 'loading'
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {status === 'loading' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando...</> : <><Wand2 className="w-3.5 h-3.5" /> Sugerir Melhor Arranjo</>}
        </button>
      </div>

      {!podeOtimizar && <p className="text-xs text-slate-400">Selecione módulo e inversor para habilitar.</p>}
      {status === 'erro' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />{erroMsg}
        </div>
      )}
      {status === 'ok' && top3.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Nenhuma configuração válida encontrada. Verifique os dados elétricos.
        </p>
      )}
      {status === 'ok' && stats && (
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
          <span className="bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-mono">{stats.total_testadas} combinações testadas</span>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2.5 py-0.5 font-mono">{stats.total_validas} válidas</span>
          <span className="bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 font-mono">{stats.tempo_execucao_ms}ms</span>
        </div>
      )}

      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {top3.map((cfg, idx) => {
            const ativo = mpsAtivo === cfg.modulos_por_string && sAtivo === cfg.strings_paralelo
            const foOk  = cfg.calculos_principais?.fator_oversizing >= 1.15 && cfg.calculos_principais?.fator_oversizing <= 1.30
            const tOk   = cfg.calculos_principais?.margem_tensao_percentual <= 85
            const med   = ['🥇', '🥈', '🥉'][idx]
            return (
              <button key={`${cfg.modulos_por_string}-${cfg.strings_paralelo}`}
                onClick={() => onAplicar(cfg.modulos_por_string, cfg.strings_paralelo)}
                className={`w-full text-left rounded-xl border-2 p-4 space-y-2 transition-all ${
                  ativo ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 hover:border-violet-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{med}</span>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">Score</span>
                    <span className="text-xl font-black text-violet-700">{cfg.score_final}</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Mód/string</span><span className="font-mono font-bold">{cfg.modulos_por_string}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Strings</span><span className="font-mono font-bold">{cfg.strings_paralelo}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-mono font-bold">{cfg.total_modulos}</span></div>
                  {cfg.calculos_principais?.fator_oversizing != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Oversizing</span>
                      <span className={`font-mono font-bold ${foOk ? 'text-emerald-700' : 'text-amber-600'}`}>{cfg.calculos_principais.fator_oversizing.toFixed(2)}×</span>
                    </div>
                  )}
                  {cfg.calculos_principais?.margem_tensao_percentual != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Uso Voc/Vmáx</span>
                      <span className={`font-mono font-bold ${tOk ? 'text-emerald-700' : 'text-amber-600'}`}>{cfg.calculos_principais.margem_tensao_percentual}%</span>
                    </div>
                  )}
                </div>
                {ativo && <div className="text-[11px] text-violet-600 font-semibold text-center bg-violet-100 rounded-lg py-1">✓ Aplicado</div>}
              </button>
            )
          })}
        </div>
      )}
      {top3.length > 0 && (
        <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Clicar aplica a sugestão nas strings acima. Use "Salvar configuração" para persistir.
        </p>
      )}
    </div>
  )
}
