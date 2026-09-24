import { useEffect, useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import {
  listarCatalogo, validarCompatibilidadeEletrica, consultarInversoresCompativeis,
} from '../../api/agregadosFvApi'
import { calcularTemperaturas } from '@fortesolar/fv-shared/engenharia/normativa'
import {
  eletricoDoModulo, eletricoDoInversor, nMpptsDoInversor, lacunasEletricas,
} from '../../catalogo'
import {
  topologiaVazia, mpptVazio, inteiro, totalDoMppt, totalDistribuido, naoDistribuidos,
  mpptUtilizado, paraArranjoPersistido, daArranjoPersistido, arranjoParaValidacao,
  topologiaDesigual,
} from '../../topologia'
import { composicaoEhMicro, composicaoMista } from '../../microinversores'
import { inversorDoCatalogo } from '../../catalogo'
import { paraArranjos, daArranjos, projecaoLegado } from '../../composicao'
// Sprint D0 — configuração elétrica anterior ao inversor. Fonte única do nível
// preliminar; nunca toca em mppts[]/micros[], que são pós-inversor.
import {
  TIPOS_TOPOLOGIA, inteiroPositivo, lerPreliminar, lacunasPreliminar,
  preliminarCompleta, coerenciaDeModulos, paraArranjoPreliminar,
} from '../../topologiaPreliminar'
import EtapaMicroinversores from './EtapaMicroinversores'

/**
 * EtapaMppt — topologia do arranjo — FV-UX-026.
 *
 * Última lacuna do unifilar, e a única etapa técnica que NÃO calcula nada: aqui
 * o projetista AUTORA a topologia (Modelo A, FV-DOM-023/024). O sistema valida.
 *
 * ── Por que não há distribuição automática ───────────────────────────────────
 * MPPT desigual, entrada parcialmente ocupada e strings de comprimentos
 * diferentes por sombreamento ou geometria de telhado não são deriváveis sem
 * conhecer o telhado. A FV-UX-021 mediu o que acontece quando se tenta:
 * `/api/dimensionamento/strings` devolve uma configuração uniforme e três
 * módulos órfãos que não pertencem a string alguma.
 *
 * ── De onde vem cada número ──────────────────────────────────────────────────
 * Módulo e inversor: catálogo (FV-UX-019). Quantidade total: dimensionamento
 * (FV-UX-020). Voc, Vmpp, Isc e diagnósticos: validador canônico no servidor.
 * Deste lado só existe soma de módulos digitados.
 */

/** Só estes diagnósticos são por MPPT. Oversizing é do inversor inteiro. */
const CODIGOS_POR_MPPT = new Set([
  'VOC_EXCEDIDA_CRITICA', 'VOC_PROXIMO_LIMITE', 'MPPT_STRING_LONGA',
  'MPPT_STRING_CURTA', 'MPPT_PROXIMO_LIMITE', 'CORRENTE_ISC_EXCEDIDA',
  // Ajuste de corrente: os dois avisos novos também são por MPPT — a corrente
  // de operação e a de projeto valem para a entrada, não para o inversor todo.
  'CORRENTE_IMPP_ELEVADA', 'CORRENTE_PROJETO_ACIMA_DO_TRABALHO',
  'CORRENTE_PROXIMA_LIMITE', 'INPUT_INVALIDO', 'CLIMA_FALLBACK_APLICADO',
])

/**
 * Corrente de um candidato, com os valores medidos à vista — §10 do ajuste.
 *
 * A tela não recalcula nem reinterpreta: lê `avaliacao_corrente`, que o motor
 * canônico devolve por critério. Excesso de corrente de OPERAÇÃO aparece como
 * atenção; só o curto-circuito aparece como impedimento.
 */
function CorrenteDoCandidato({ avaliacao }) {
  if (!avaliacao) return null
  const { operacao, curto_circuito: curto, projeto_normativa: projeto } = avaliacao
  const linha = (rotulo, valor, limite, status, motivo) => (
    <li className={
      status === 'incompativel' ? 'text-red-700'
        : status === 'atencao' ? 'text-amber-700'
          : status === 'nao_avaliado' ? 'text-slate-500' : 'text-emerald-700'}
    >
      <span className="font-medium">
        {status === 'incompativel' ? '❌' : status === 'atencao' ? '⚠' : status === 'nao_avaliado' ? '—' : '✓'}
        {' '}{rotulo}:
      </span>{' '}
      {valor === null || valor === undefined ? 'não declarado' : `${valor} A`}
      {limite === null || limite === undefined
        ? ' · limite não cadastrado'
        : ` · limite ${limite} A`}
      {motivo ? ` — ${motivo}` : ''}
    </li>
  )
  return (
    <ul className="mt-1 space-y-0.5 text-xs" aria-label="Avaliação de corrente">
      {linha('Corrente de operação (Impp)', operacao.impp_total, operacao.limite_a,
        operacao.status, operacao.motivo)}
      {linha('Corrente de curto-circuito (Isc)', curto.isc_operacao, curto.limite_a,
        curto.status, curto.motivo)}
      <li className="text-slate-500">
        <span className="font-medium">Corrente de projeto (NBR 16690 §5.2):</span>{' '}
        {projeto.isc_total} A = Isc × {projeto.fator}
        {projeto.acima_do_trabalho
          ? ' · acima da corrente de trabalho — dimensiona cabo e proteção, não decide compatibilidade'
          : ''}
      </li>
    </ul>
  )
}

const bloqueante = (d) => d?.severidade === 'critico' || d?.nivel === 'critico'

export default function EtapaMppt() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [catalogo, setCatalogo] = useState(null)
  const [erroCatalogo, setErroCatalogo] = useState(null)
  const [topologia, setTopologia] = useState(null)
  const [resultados, setResultados] = useState(null)
  const [validando, setValidando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState(null)
  const [salvo, setSalvo] = useState(false)
  // Configuração preliminar em edição. `null` = mostra o que está persistido.
  const [prelim, setPrelim] = useState(null)
  const [salvandoPrelim, setSalvandoPrelim] = useState(false)
  const [prelimSalva, setPrelimSalva] = useState(false)
  // Sprint D2 — candidatos vindos do endpoint da D1. `null` = ainda não consultado.
  const [compat, setCompat] = useState(null)
  const [consultando, setConsultando] = useState(false)
  const [erroCompat, setErroCompat] = useState(null)
  const [marcaInv, setMarcaInv] = useState('')
  const [modeloInv, setModeloInv] = useState('')
  const [salvandoInv, setSalvandoInv] = useState(false)
  const [invSalvo, setInvSalvo] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([listarCatalogo('modulo'), listarCatalogo('inversor')])
      .then(([m, i]) => vivo && setCatalogo({ modulos: m?.equipamentos ?? [], inversores: i?.equipamentos ?? [] }))
      .catch((e) => vivo && setErroCatalogo(e.message))
    return () => { vivo = false }
  }, [])

  // FV-UX-029: a composição vive em `arranjos[]`; esta etapa consome a PROJEÇÃO
  // `equipamentos.*`, que carrega o primeiro módulo e o primeiro inversor.
  // Enquanto o validador canônico descrever um inversor por vez, é o que dá para
  // topologizar — e a limitação é declarada, nunca silenciada.
  const equip = projeto?.equipamentos ?? {}
  const painelSel = equip.paineis?.[0] ?? null
  const inversorSel = equip.inversor ?? null
  const arranjoPrincipal = (projeto?.arranjos ?? []).find((a) => a?.tipo === 'principal') ?? null
  const modelosNaComposicao = arranjoPrincipal?.paineis?.length ?? 0
  const inversoresNaComposicao = arranjoPrincipal?.inversores?.length ?? 0
  const unidadesDeInversor = (arranjoPrincipal?.inversores ?? [])
    .reduce((s, i) => s + (Number(i?.quantidade) > 0 ? Number(i.quantidade) : 0), 0)

  const moduloCat = useMemo(() => (catalogo?.modulos ?? [])
    .find((e) => String(e._id) === String(painelSel?.equipamento_id ?? painelSel?.id)) ?? null,
  [catalogo, painelSel])
  const inversorCat = useMemo(() => (catalogo?.inversores ?? [])
    .find((e) => String(e._id) === String(inversorSel?.equipamento_id ?? inversorSel?.id)) ?? null,
  [catalogo, inversorSel])

  const eletricoMod = useMemo(() => (moduloCat ? eletricoDoModulo(moduloCat) : null), [moduloCat])
  const eletricoInv = useMemo(() => (inversorCat ? eletricoDoInversor(inversorCat) : null), [inversorCat])
  const nMppts = inversorCat ? nMpptsDoInversor(inversorCat) : null
  const lacunas = useMemo(
    () => (eletricoMod && eletricoInv ? lacunasEletricas(eletricoMod, eletricoInv) : []),
    [eletricoMod, eletricoInv])

  const totalModulos = inteiro(projeto?.dimensionamento?.num_paineis ?? painelSel?.quantidade)

  /**
   * Sprint D0 — configuração elétrica PRELIMINAR, anterior ao inversor.
   *
   * Tudo o que ela guarda já tinha campo no schema: o tipo em
   * `arranjos[].topologia`, as fases em `fatura_extracao.tipo_ligacao`, o total
   * de módulos na composição, e o agrupamento série/paralelo em
   * `configuracao_eletrica`. Nenhum campo novo foi criado.
   *
   * `topologiaPreliminar` é o único lugar que lê e escreve esse nível. A
   * topologia DETALHADA (`n_mppts`, `mppts[]`, `micros[]`) continua exclusiva
   * desta tela, depois do inversor — a separação estrutural é essa.
   */
  const preliminar = useMemo(() => lerPreliminar(projeto), [projeto])
  const prelimEditada = prelim ?? preliminar
  const lacunasPrelim = lacunasPreliminar(prelimEditada)
  const coerenciaPrelim = coerenciaDeModulos(prelimEditada)

  /**
   * A FV-DOM-031 decidia o editor pela composição — ou seja, pelo inversor já
   * escolhido. A D0 inverte a dependência: quando o projetista DECLARA o tipo na
   * configuração preliminar, é a declaração que manda.
   *
   * A inferência pela composição permanece como fallback e atende os projetos
   * legados, que não têm `topologia` gravada. Nada foi migrado.
   */
  const microInferido = useMemo(
    () => composicaoEhMicro(arranjoPrincipal?.inversores ?? (inversorSel ? [inversorSel] : []), catalogo?.inversores),
    [arranjoPrincipal, inversorSel, catalogo])
  const ehComposicaoMicro = preliminar.tipo === null ? microInferido : preliminar.tipo === 'micro'
  const composicaoEhMista = useMemo(
    () => composicaoMista(arranjoPrincipal?.inversores ?? (inversorSel ? [inversorSel] : []), catalogo?.inversores),
    [arranjoPrincipal, inversorSel, catalogo])

  /**
   * Clima de projeto — A2 (FV-UX-028).
   *
   * A auditoria FV-UX-027 encontrou a etapa Dados Técnicos prometendo que a UF
   * "decide Tmin/Tmax", enquanto esta tela mandava dois `null` e o motor caía
   * no fallback nacional de 10/40 °C. A UF informada não tinha efeito algum.
   *
   * Precedência, sem tabela nova e sem fórmula copiada:
   *   1. Tmin/Tmax persistidos em `localizacao` — o que o projeto mediu;
   *   2. `calcularTemperaturas(uf)` — a tabela canônica de `fv-shared`;
   *   3. nada — o motor aplica o fallback dele e DECLARA o warning.
   */
  const clima = useMemo(() => {
    const loc = projeto?.localizacao ?? {}
    const tmin = loc.temperatura_min_historica_c ?? null
    const tmax = loc.temperatura_max_historica_c ?? null
    const uf = projeto?.local_resolvido?.estado ?? loc.estado ?? null
    if (tmin !== null && tmax !== null) {
      return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: 'localizacao' }
    }
    if (uf) {
      const t = calcularTemperaturas(uf)
      return {
        temperatura_min_historica_c: t.tmin, temperatura_max_historica_c: t.tmax,
        uf, fonte: 'uf',
      }
    }
    return { temperatura_min_historica_c: tmin, temperatura_max_historica_c: tmax, uf, fonte: null }
  }, [projeto])

  // Topologia persistida; na ausência dela, MPPTs VAZIOS — nada é sugerido.
  const persistida = useMemo(
    () => daArranjoPersistido(projeto?.engenharia_eletrica?.arranjo), [projeto])
  useEffect(() => {
    if (topologia !== null) return
    if (persistida) setTopologia(persistida)
    else if (nMppts !== null) setTopologia(topologiaVazia(nMppts))
  }, [persistida, nMppts, topologia])

  const distribuido = totalDistribuido(topologia)
  const restantes = naoDistribuidos(topologia, totalModulos)
  const desigual = topologiaDesigual(topologia)

  function mutar(fn) {
    setTopologia((prev) => {
      const copia = JSON.parse(JSON.stringify(prev ?? []))
      fn(copia)
      return copia
    })
    setResultados(null)
    setSalvo(false)
  }

  const addMppt = () => mutar((t) => t.push(mpptVazio()))
  const removerMppt = (i) => mutar((t) => t.splice(i, 1))
  const addEntrada = (i) => mutar((t) => t[i].entradas.push({ strings: [] }))
  const removerEntrada = (i, ei) => mutar((t) => t[i].entradas.splice(ei, 1))
  const addString = (i, ei) => mutar((t) => t[i].entradas[ei].strings.push({ modulos: '' }))
  const removerString = (i, ei, si) => mutar((t) => t[i].entradas[ei].strings.splice(si, 1))
  const setModulos = (i, ei, si, v) => mutar((t) => { t[i].entradas[ei].strings[si].modulos = v })

  async function validar() {
    if (!eletricoMod || !eletricoInv) return
    setValidando(true)
    setErroAcao(null)
    try {
      // Uma chamada por MPPT: Voc, Vmpp e Isc são grandezas por MPPT.
      const saidas = await Promise.all((topologia ?? []).map(async (m) => {
        const arranjo = arranjoParaValidacao(m)
        if (!arranjo) return null
        return validarCompatibilidadeEletrica({
          dados_eletricos_modulo: eletricoMod,
          dados_eletricos_inversor: eletricoInv,
          arranjo_proposto: arranjo,
          dados_climaticos_regiao: clima,
        })
      }))
      setResultados(saidas)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setValidando(false)
    }
  }

  const diagnosticos = (r) => [...(r?.erros ?? []), ...(r?.warnings ?? [])]
    .filter((d) => CODIGOS_POR_MPPT.has(d.codigo))
  const temBloqueio = (resultados ?? []).some((r) => diagnosticos(r).some(bloqueante))
  const validado = Array.isArray(resultados) && resultados.some(Boolean)

  /** Edita a configuração preliminar. Trocar o tipo limpa o que é só de string. */
  function editarPrelim(campo, valor) {
    const base = prelim ?? preliminar
    const proximo = campo === 'tipo' && valor !== 'string'
      ? { ...base, tipo: valor, modulos_por_string: null, quantidade_strings: null }
      : { ...base, [campo]: campo === 'tipo' ? valor : inteiroPositivo(valor) }
    setPrelim(proximo)
    setPrelimSalva(false)
  }

  /**
   * Grava só o nível preliminar, pela etapa `arranjos` que já existe.
   * `paraArranjoPreliminar` preserva composição, fornecedor, rótulo e toda a
   * topologia detalhada — esta gravação não pode apagar `mppts[]`/`micros[]`.
   */
  async function salvarPreliminar() {
    setSalvandoPrelim(true)
    setErroAcao(null)
    try {
      const outros = (projeto?.arranjos ?? []).filter((a) => a?.tipo !== 'principal')
      const atualizado = paraArranjoPreliminar(prelimEditada, arranjoPrincipal)
      await acoes.salvarEtapa('arranjos', { lista: [...outros, atualizado] })
      setPrelim(null)
      setPrelimSalva(true)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvandoPrelim(false)
    }
  }


  /**
   * Sprint D2 — assinatura da configuração que influencia a compatibilidade.
   *
   * Muda o tipo, a fase, o agrupamento ou o MÓDULO, muda a resposta do motor.
   * Guardar a assinatura junto do resultado permite detectar que a consulta
   * envelheceu sem reproduzir aqui nenhuma regra elétrica: a comparação é de
   * entradas, não de critérios.
   */
  const assinaturaCompat = [
    prelimEditada.tipo, prelimEditada.fases,
    prelimEditada.modulos_por_string, prelimEditada.quantidade_strings,
    String(painelSel?.equipamento_id ?? painelSel?.id ?? ''),
  ].join('|')

  const podeConsultar = preliminarCompleta(prelimEditada) && !!(painelSel?.equipamento_id ?? painelSel?.id)
  const compatAtual = compat && compat.assinatura === assinaturaCompat ? compat : null

  /** Consulta o endpoint da D1. Nunca chama com configuração incompleta. */
  async function consultarCompativeis() {
    if (!podeConsultar) return
    setConsultando(true); setErroCompat(null); setInvSalvo(false)
    try {
      const r = await consultarInversoresCompativeis({
        modulo_id: String(painelSel.equipamento_id ?? painelSel.id),
        configuracao: {
          tipo: prelimEditada.tipo,
          fases: prelimEditada.fases,
          modulos_por_string: prelimEditada.modulos_por_string,
          quantidade_strings: prelimEditada.quantidade_strings,
        },
      })
      setCompat({ ...r, assinatura: assinaturaCompat })
      setMarcaInv(''); setModeloInv('')
    } catch (e) {
      setErroCompat({ mensagem: e.message, codigo: e.codigo ?? null })
      setCompat(null)
    } finally {
      setConsultando(false)
    }
  }

  /**
   * O inversor persistido continua compatível com a configuração atual?
   * Só responde quando há consulta VÁLIDA para a configuração de agora — sem
   * consulta não afirma nada, porque ausência de informação não é incompatibilidade.
   */
  const inversorAindaCompativel = (() => {
    if (!inversorSel?.equipamento_id) return null
    if (!compatAtual?.ok) return null
    return compatAtual.compativeis.some(
      (c) => String(c.equipamento_id) === String(inversorSel.equipamento_id))
  })()

  const marcasCompativeis = (() => {
    const vistas = new Map()
    for (const c of compatAtual?.compativeis ?? []) {
      const m = (c.fabricante ?? '').trim() || '— sem marca declarada —'
      vistas.set(m, vistas.has(m) ? vistas.get(m) + 1 : 1)
    }
    return [...vistas.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  })()
  const modelosCompativeis = marcaInv === '' ? []
    : (compatAtual?.compativeis ?? []).filter(
      (c) => ((c.fabricante ?? '').trim() || '— sem marca declarada —') === marcaInv)

  /**
   * Grava o inversor escolhido na composição — mesma forma e mesmo
   * `equipamento_id` que a etapa Equipamentos usava. Nenhum identificador novo.
   */
  async function salvarInversor() {
    if (!modeloInv) return
    const eq = (catalogo?.inversores ?? []).find((e) => String(e._id) === modeloInv)
    if (!eq) return
    setSalvandoInv(true); setErroAcao(null)
    try {
      const daComposicao = daArranjos(projeto?.arranjos)
      const atualComp = daComposicao ?? { paineis: equip.paineis ?? [], inversores: [] }
      const composicao = {
        paineis: atualComp.paineis,
        inversores: [{ ...inversorDoCatalogo(eq), quantidade: 1 }],
      }
      const outros = (projeto?.arranjos ?? []).filter((a) => a?.tipo !== 'principal')
      const principal = paraArranjos(composicao, arranjoPrincipal)[0]
      await acoes.salvarEtapa('arranjos', { lista: [...outros, principal] })
      await acoes.salvarEtapa('equipamentos', projecaoLegado(composicao, projeto?.equipamentos))
      setInvSalvo(true)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvandoInv(false)
    }
  }

  async function salvar() {
    if (!validado || temBloqueio) return
    setSalvando(true)
    setErroAcao(null)
    try {
      const primeiro = (resultados ?? []).find(Boolean)
      await acoes.salvarEtapa('engenharia_eletrica', {
        arranjo: paraArranjoPersistido(topologia, nMppts),
        clima_utilizado: {
          cidade: projeto?.local_resolvido?.cidade ?? null,
          uf: clima.uf,
          temperatura_min_historica_c: primeiro?.clima_utilizado?.temperatura_min_historica_c ?? null,
          temperatura_max_historica_c: primeiro?.clima_utilizado?.temperatura_max_historica_c ?? null,
          // A2: registra DE ONDE vieram as temperaturas — `localizacao` (medidas)
          // ou `uf` (tabela canônica). Sem isso, o histórico não distingue as duas.
          fonte: primeiro?.clima_utilizado?.fonte ?? clima.fonte ?? null,
          usou_fallback: primeiro?.clima_utilizado?.usou_fallback ?? null,
        },
        compatibilidade: {
          versao_motor: 'canonico-fv-dom-025',
          compativel: !temBloqueio,
          diagnosticos: (resultados ?? []).flatMap((r, i) =>
            diagnosticos(r).map((d) => ({ ...d, mppt: i + 1 }))),
          calculos_principais: primeiro?.calculos ?? null,
          analisado_em: new Date().toISOString(),
        },
      })
      setSalvo(true)
      setResultados(null)
      setTopologia(null)
    } catch (e) {
      setErroAcao(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  /**
   * FV-DOM-031 (decisão 5): microinversor NÃO usa MPPT → strings → módulos.
   * A auditoria mediu o defeito: um Hoymiles de 4 entradas era renderizado
   * abaixo como "4 MPPTs" pedindo módulos em série. A composição de micro vai
   * para a tela irmã, que tem o modelo certo — este editor não é adaptado.
   *
   * ── Por que esta bifurcação vem ANTES de `carregando` (FV-DOM-031E) ─────────
   * `salvarEtapa` grava e RELÊ o servidor, e `recarregar()` liga `carregando`.
   * Com o teste abaixo, o `return <p>Carregando…</p>` DESMONTAVA
   * `EtapaMicroinversores` no meio do salvamento — e o estado local dela, com o
   * "Topologia salva.", morria junto. A gravação sempre funcionou (o `micros[]`
   * chegava ao banco); a confirmação é que nunca aparecia.
   *
   * `projeto` permanece populado durante a releitura (o provider só troca o
   * objeto quando o GET volta), então renderizar com ele é correto. Na primeira
   * carga `projeto` é `null` e o fluxo cai nos returns abaixo, como antes.
   */
  /**
   * Configuração elétrica preliminar — Sprint D0.
   *
   * Aparece nos DOIS caminhos (string e micro), antes de qualquer coisa que
   * dependa do inversor, porque é ela que declara qual dos dois vale. Não valida
   * compatibilidade: isso é do motor canônico, na Sprint D.
   */
  // `topo` só quando a seção é o elemento de primeiro nível (caminho micro).
  // No caminho string ela já vive dentro de um <section> com a mesma largura.
  const secaoPreliminar = ({ topo = false } = {}) => (
    <section className={topo ? 'mx-auto max-w-3xl px-6 pt-6' : 'mt-6'}>
      <h3 className="text-sm font-semibold text-slate-900">Configuração elétrica preliminar</h3>
      <p className="mt-1 text-xs text-slate-500">
        Definida antes do inversor — é ela que dirá, na próxima etapa, quais
        inversores são compatíveis. Não descreve MPPT nem entradas: isso depende
        do inversor e continua abaixo.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3">
        <label className="text-sm">
          <span className="block text-slate-600">Tipo de topologia</span>
          <select
            aria-label="Tipo de topologia" value={prelimEditada.tipo ?? ''}
            onChange={(e) => editarPrelim('tipo', e.target.value === '' ? null : e.target.value)}
            className="mt-1 w-48 rounded border border-slate-300 px-2 py-1"
          >
            <option value="">não definido</option>
            {TIPOS_TOPOLOGIA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>

        {prelimEditada.tipo === 'string' && (
          <>
            <label className="text-sm">
              <span className="block text-slate-600">Módulos por string</span>
              <input
                aria-label="Módulos por string" type="number" min="1"
                value={prelimEditada.modulos_por_string ?? ''}
                onChange={(e) => editarPrelim('modulos_por_string', e.target.value)}
                className="mt-1 w-32 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600">Quantidade de strings</span>
              <input
                aria-label="Quantidade de strings" type="number" min="1"
                value={prelimEditada.quantidade_strings ?? ''}
                onChange={(e) => editarPrelim('quantidade_strings', e.target.value)}
                className="mt-1 w-32 rounded border border-slate-300 px-2 py-1"
              />
            </label>
          </>
        )}

        <button
          type="button" onClick={salvarPreliminar} disabled={salvandoPrelim}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {salvandoPrelim ? 'Salvando…' : 'Salvar configuração'}
        </button>
        {prelimSalva && <span className="text-xs text-emerald-700">Configuração salva.</span>}
      </div>

      <dl className="mt-3 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        <div className="flex gap-2 px-4 py-2">
          <dt className="w-48 shrink-0 text-slate-500">Fases da instalação</dt>
          <dd className="flex-1 text-slate-900">
            {prelimEditada.fases ?? <span className="text-amber-700">não informada — etapa Projeto</span>}
          </dd>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <dt className="w-48 shrink-0 text-slate-500">Módulos na composição</dt>
          <dd className="flex-1 text-slate-900">
            {prelimEditada.total_modulos ?? <span className="text-amber-700">nenhum — etapa Equipamentos</span>}
            {coerenciaPrelim.declarado !== null && (
              <span className={`ml-2 text-xs ${coerenciaPrelim.diferenca === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {coerenciaPrelim.diferenca === 0
                  ? `confere com ${coerenciaPrelim.declarado} declarados`
                  : `agrupamento declara ${coerenciaPrelim.declarado}`}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {lacunasPrelim.length > 0 && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Falta para pedir os inversores compatíveis: {lacunasPrelim.join('; ')}.
        </p>
      )}
      {preliminarCompleta(prelimEditada) && (
        <p className="mt-2 text-xs text-slate-500">
          Configuração completa. O filtro de inversores compatíveis entra na
          próxima etapa — hoje o inversor ainda é escolhido em Equipamentos.
        </p>
      )}
    </section>
  )


  /**
   * Sprint D2 — inversores compatíveis → Marca → Modelo.
   *
   * A lista vem EXCLUSIVAMENTE do endpoint da D1, que roda o motor canônico.
   * Não há fallback para o catálogo completo: sem consulta válida, não há o que
   * escolher. Nenhuma regra elétrica é avaliada aqui — a tela só agrupa e exibe.
   */
  const secaoInversor = () => (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-slate-900">Inversor</h3>
      <p className="mt-1 text-xs text-slate-500">
        Os modelos abaixo são os que o motor elétrico aprovou para a configuração
        acima. Trocar a configuração exige consultar de novo.
      </p>

      {inversorSel?.modelo && (
        <p className={`mt-2 rounded border px-3 py-2 text-xs ${
          inversorAindaCompativel === false
            ? 'border-red-300 bg-red-50 text-red-800'
            : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          Inversor no projeto: <strong>{inversorSel.marca} {inversorSel.modelo}</strong>
          {inversorAindaCompativel === false && ' — NÃO é compatível com a configuração atual. Escolha outro abaixo.'}
          {inversorAindaCompativel === true && ' — compatível com a configuração atual.'}
          {inversorAindaCompativel === null && ' — compatibilidade não verificada para a configuração atual.'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3">
        <button
          type="button" onClick={consultarCompativeis} disabled={!podeConsultar || consultando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
        >
          {consultando ? 'Consultando…' : 'Consultar inversores compatíveis'}
        </button>
        {!podeConsultar && (
          <span className="text-xs text-amber-700">
            Complete a configuração preliminar e escolha o módulo em Equipamentos.
          </span>
        )}
      </div>

      {erroCompat && (
        <p role="alert" className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Não foi possível avaliar: {erroCompat.mensagem}
          {erroCompat.codigo ? ` (${erroCompat.codigo})` : ''}
        </p>
      )}

      {compatAtual?.ok && compatAtual.compativeis.length === 0 && (
        <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Nenhum inversor compatível encontrado para esta configuração.
          <span className="mt-1 block text-xs">
            {compatAtual.avaliados} avaliados. Nenhum modelo é oferecido — revise a
            configuração preliminar ou o módulo.
          </span>
        </p>
      )}

      {compatAtual?.ok && compatAtual.compativeis.length > 0 && (
        <>
          <p className="mt-2 text-xs text-slate-500">
            {compatAtual.compativeis.length} de {compatAtual.avaliados} inversores do
            catálogo atendem. Critério: {compatAtual.criterio === 'tecnologia_e_fase'
              ? 'tecnologia e fase — o envelope elétrico do microinversor é avaliado na distribuição por entradas'
              : 'avaliação elétrica preliminar pelo motor canônico'}.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3">
            <label className="text-sm">
              <span className="block text-slate-600">Marca do inversor</span>
              <select
                aria-label="Marca do inversor compatível" value={marcaInv}
                onChange={(e) => { setMarcaInv(e.target.value); setModeloInv(''); setInvSalvo(false) }}
                className="mt-1 w-56 rounded border border-slate-300 px-2 py-1"
              >
                <option value="">selecione a marca ({marcasCompativeis.length})</option>
                {marcasCompativeis.map(([m, n]) => <option key={m} value={m}>{m} ({n})</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-600">Modelo</span>
              <select
                aria-label="Modelo do inversor compatível" value={modeloInv}
                disabled={marcaInv === ''}
                onChange={(e) => { setModeloInv(e.target.value); setInvSalvo(false) }}
                className="mt-1 w-80 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
              >
                <option value="">{marcaInv === '' ? 'escolha a marca primeiro' : 'não selecionado'}</option>
                {modelosCompativeis.map((c) => (
                  <option key={c.equipamento_id} value={c.equipamento_id}>{c.modelo}</option>
                ))}
              </select>
            </label>
            <button
              type="button" onClick={salvarInversor} disabled={!modeloInv || salvandoInv}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {salvandoInv ? 'Salvando…' : 'Usar este inversor'}
            </button>
            {invSalvo && <span className="text-xs text-emerald-700">Inversor salvo.</span>}
          </div>

          {/* ── Corrente do modelo escolhido, com os números à vista ────── */}
          {(() => {
            const escolhido = (compatAtual.compativeis ?? [])
              .find((c) => String(c.equipamento_id) === String(modeloInv)) ?? null
            if (!escolhido) return null
            return (
              <div
                aria-label="Classificação de corrente do candidato"
                className={`mt-2 rounded border px-3 py-2 ${
                  escolhido.status === 'atencao'
                    ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
              >
                <p className="text-xs font-medium text-slate-700">
                  {escolhido.status === 'atencao' ? '⚠ Atenção' : '✓ Dentro dos limites avaliáveis'}
                </p>
                <CorrenteDoCandidato avaliacao={escolhido.avaliacao_corrente} />
                {(escolhido.avisos_detalhados ?? []).map((a) => (
                  <p key={a.codigo} className="mt-1 text-xs text-amber-800">{a.mensagem}</p>
                ))}
              </div>
            )
          })()}
        </>
      )}
    </section>
  )

  if (projeto && ehComposicaoMicro) {
    return (
      <>
        {secaoPreliminar({ topo: true })}
        <div className="mx-auto max-w-3xl px-6">{secaoInversor()}</div>
        {composicaoEhMista && (
          <p role="alert" className="mx-auto mt-6 max-w-3xl rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A composição mistura microinversores com inversores de outra
            topologia. Nenhum dos dois editores descreve essa mistura, e ela não
            é resolvida por conta própria — separe em arranjos ou revise a
            composição na etapa Equipamentos.
          </p>
        )}
        {/*
          Sprint E — as fases vêm da configuração PRELIMINAR (D0), que por sua
          vez as lê de `fatura_extracao.tipo_ligacao`. Não são relidas do
          inversor: o tipo de ligação é da instalação, não do equipamento.
        */}
        <EtapaMicroinversores
          catalogoInversores={catalogo?.inversores ?? []}
          arranjoPrincipal={arranjoPrincipal}
          totalModulos={totalModulos}
          potenciaModuloW={eletricoMod?.potencia_w ?? null}
          fases={prelimEditada.fases}
          /* Sprint E2 — Isc do módulo alimenta a avaliação de corrente da
             entrada CC. Ausente ⇒ `nao_avaliado`, nunca um valor assumido. */
          iscModuloA={eletricoMod?.isc ?? null}
          /* Impp: corrente de OPERAÇÃO do módulo. Sem ela o critério fica
             `nao_avaliado` — Isc NUNCA a substitui. */
          imppModuloA={eletricoMod?.impp ?? null}
        />
      </>
    )
  }

  // Caminho STRING — os mesmos guards de sempre, na mesma ordem.
  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const faltaEquip = !painelSel || !inversorSel

  return (
    <section className="mx-auto max-w-3xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Topologia MPPT</h2>
      <p className="mt-1 text-sm text-slate-500">
        A distribuição das strings é sua. O sistema valida contra os limites do
        inversor — não decide o arranjo.
      </p>

      {secaoPreliminar()}
      {secaoInversor()}

      {erroCatalogo && <p role="alert" className="mt-4 text-sm text-red-600">Catálogo indisponível: {erroCatalogo}</p>}

      <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
        {[
          ['Módulo', painelSel ? `${painelSel.marca ?? '—'} ${painelSel.modelo ?? ''}` : null, 'Equipamentos'],
          ['Inversor', inversorSel?.modelo ? `${inversorSel.marca ?? '—'} ${inversorSel.modelo}` : null, 'Equipamentos'],
          ['Módulos no projeto', totalModulos, 'Dimensionamento'],
          ['MPPTs do inversor', nMppts, 'Catálogo'],
          ['Tmin / Tmax de projeto',
            clima.temperatura_min_historica_c === null ? null
              : `${clima.temperatura_min_historica_c} / ${clima.temperatura_max_historica_c} °C` +
                (clima.fonte === 'uf' ? ` — tabela ${clima.uf}` : ' — medidos no local'),
            'Dados técnicos'],
        ].map(([k, v, origem]) => (
          <div key={k} className="flex gap-2 px-4 py-2">
            <dt className="w-48 shrink-0 text-slate-500">{k}</dt>
            <dd className="flex-1 text-slate-900">
              {v ?? <span className="text-amber-700">não informado — etapa {origem}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {(modelosNaComposicao > 1 || inversoresNaComposicao > 1 || unidadesDeInversor > 1) && (
        <p className="mt-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          A composição tem
          {modelosNaComposicao > 1 && ` ${modelosNaComposicao} modelos de módulo`}
          {modelosNaComposicao > 1 && (inversoresNaComposicao > 1 || unidadesDeInversor > 1) && ' e'}
          {inversoresNaComposicao > 1
            ? ` ${inversoresNaComposicao} modelos de inversor`
            : unidadesDeInversor > 1 && ` ${unidadesDeInversor} unidades do mesmo inversor`}
          . Esta etapa topologiza <strong>um inversor e um modelo de módulo por vez</strong> —
          os primeiros da composição. Distribuir entre vários inversores depende de
          decisão de domínio ainda pendente e não é assumido aqui.
        </p>
      )}

      {lacunas.length > 0 && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          O catálogo não declara {lacunas.length} dado(s) elétrico(s) — {lacunas.join(', ')}.
          A validação não pode ser feita sem eles, e nenhum valor será assumido.
        </p>
      )}

      {faltaEquip ? (
        <p className="mt-6 text-sm text-amber-700">
          Selecione módulo e inversor na etapa Equipamentos antes de montar a topologia.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {(topologia ?? []).map((mppt, i) => {
              const r = resultados?.[i] ?? null
              const diags = diagnosticos(r)
              const erroMppt = diags.some(bloqueante)
              return (
                <div key={i} className={`rounded border-2 bg-white p-4 ${
                  erroMppt ? 'border-red-300' : mpptUtilizado(mppt) ? 'border-slate-300' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    {/* A1: o separador não é decoração. Sem ele, "MPPT 1" seguido
                        de "12 módulo(s)" é lido como "MPPT 112" — só a margem CSS
                        separava os dois números. */}
                    <h3 className="text-sm font-semibold text-slate-900">
                      MPPT {i + 1}
                      <span className="ml-2 font-normal text-slate-500">
                        {' · '}{totalDoMppt(mppt)} módulo(s)
                        {!mpptUtilizado(mppt) && ' — livre'}
                      </span>
                    </h3>
                    <button type="button" onClick={() => removerMppt(i)}
                      className="text-xs text-slate-500 hover:text-red-600">remover MPPT</button>
                  </div>

                  {(mppt.entradas ?? []).map((entrada, ei) => (
                    <div key={ei} className="mt-3 rounded bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Entrada {ei + 1}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addString(i, ei)}
                            className="text-xs text-slate-700 underline">+ string</button>
                          <button type="button" onClick={() => removerEntrada(i, ei)}
                            className="text-xs text-slate-500 hover:text-red-600">remover entrada</button>
                        </div>
                      </div>
                      {(entrada.strings ?? []).length === 0 && (
                        <p className="mt-2 text-xs text-slate-400">nenhuma string nesta entrada</p>
                      )}
                      {(entrada.strings ?? []).map((s, si) => (
                        <div key={si} className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-slate-600">
                            String {si + 1} — módulos
                            <input
                              aria-label={`MPPT ${i + 1} entrada ${ei + 1} string ${si + 1} módulos`}
                              type="number" min="0" step="1" value={s.modulos}
                              onChange={(ev) => setModulos(i, ei, si, ev.target.value)}
                              className="ml-2 w-24 rounded border border-slate-300 px-2 py-1"
                            />
                          </label>
                          <button type="button" onClick={() => removerString(i, ei, si)}
                            className="text-xs text-slate-500 hover:text-red-600">remover</button>
                        </div>
                      ))}
                    </div>
                  ))}

                  <button type="button" onClick={() => addEntrada(i)}
                    className="mt-3 text-xs text-slate-700 underline">+ entrada física</button>

                  {diags.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {diags.map((d, k) => (
                        <li key={k} className={`text-xs ${bloqueante(d) ? 'text-red-700' : 'text-amber-700'}`}>
                          {bloqueante(d) ? '⛔' : '⚠'} {d.mensagem}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          <button type="button" onClick={addMppt}
            className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            + MPPT
          </button>

          <dl className="mt-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white text-sm">
            <div className="flex gap-2 px-4 py-2">
              <dt className="w-48 shrink-0 text-slate-500">Total distribuído</dt>
              <dd className="text-slate-900">{distribuido} módulo(s)</dd>
            </div>
            <div className="flex gap-2 px-4 py-2">
              <dt className="w-48 shrink-0 text-slate-500">Não distribuídos</dt>
              <dd className={restantes === null ? 'text-amber-700' : restantes === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                {restantes === null
                  ? 'quantidade total não informada — etapa Dimensionamento'
                  : `${restantes} módulo(s)`}
              </dd>
            </div>
          </dl>

          {desigual && (
            <p className="mt-3 text-xs text-slate-500">
              MPPTs com configurações diferentes. Cada um é validado por si; o
              oversizing CC/CA do inversor inteiro não é avaliado pelo validador
              canônico nesse caso e permanece pendente.
            </p>
          )}

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button" onClick={validar}
              disabled={validando || lacunas.length > 0 || distribuido === 0}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {validando ? 'Validando…' : 'Validar arranjo'}
            </button>
            <button
              type="button" onClick={salvar}
              disabled={salvando || !validado || temBloqueio}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
            >
              {salvando ? 'Salvando…' : 'Salvar topologia'}
            </button>
            {temBloqueio && (
              <span className="text-xs text-red-700">
                Corrija os erros elétricos antes de salvar.
              </span>
            )}
          </div>
        </>
      )}

      {erroAcao && <p role="alert" className="mt-4 text-sm text-red-600">{erroAcao}</p>}
      {salvo && <p className="mt-4 text-sm text-emerald-700">Topologia salva.</p>}
    </section>
  )
}
