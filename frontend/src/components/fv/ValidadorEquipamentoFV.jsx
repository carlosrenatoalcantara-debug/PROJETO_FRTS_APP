/**
 * ValidadorEquipamentoFV.jsx — S2.15-B.3A
 *
 * Componente de validação de equipamentos FV via barramento de engenharia.
 * Chama POST /api/engenharia/validar-equipamento e exibe o resultado do pipeline
 * de matching (5 camadas Dice + DatasheetPipelineService).
 *
 * Correções aplicadas sobre o rascunho original:
 *   [FIX-1] Race condition no AbortController: controller movido para dentro do
 *           useEffect (local por closure), não mais armazenado em ref.
 *           O finally checa `controller.signal.aborted` (variável local),
 *           não `abortControllerRef.current?.signal.aborted` (pode apontar
 *           para o controlador de um request posterior).
 *   [FIX-2] campos_faltantes.join() em array de objetos: corrigido para
 *           `campos_faltantes.map(f => f.campo).join(', ')`.
 *   [FIX-3] sug.potencia undefined: corrigido para sug.potencia_w
 *           (_resumoAmbiguidade emite { id, fabricante, modelo, potencia_w, score }).
 *   [FIX-4] segurança_eletrica com cedilha: corrigido para seguranca_eletrica
 *           (chave emitida pelo DatasheetPipelineService sem acento).
 *   [FIX-5] Mensagem de erro do servidor descartada: corrigido para ler o body
 *           JSON da resposta HTTP e usar `errBody.erro` antes do fallback genérico.
 *
 * Versão: 2.15.3-A
 */

import { useState, useEffect, useCallback } from 'react'

// ─── Constantes ───────────────────────────────────────────────────────────────

const API_ENDPOINT = '/api/engenharia/validar-equipamento'
const DEBOUNCE_MS  = 400

// Labels legíveis para os valores de seguranca_eletrica
const SEGURANCA_LABEL = {
  CHECK_OK:                              'Aprovado',
  FALHA_CONECTOR_FALTA_EQUIPAMENTO:      'Equipamento não mapeado',
  RETIDO_REVISAO_HUMANA_OBRIGATORIA:     'Retido — revisão humana obrigatória',
  REJEITADO_FALTA_DADOS_CRITICOS:        'Dados elétricos incompletos no catálogo',
  EQUIPAMENTO_ID_NAO_MAPEADO_NO_CATALOGO:'ID não mapeado no catálogo',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ValidadorEquipamentoFV({ onEquipamentoValidado }) {
  const [formData, setFormData] = useState({
    fabricante: '',
    modelo:     '',
    potencia:   '',
  })

  const [loading,   setLoading]   = useState(false)
  const [erro,      setErro]      = useState(null)
  const [resultado, setResultado] = useState(null)

  // ── Handler de input ────────────────────────────────────────────────────────

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  // ── Efeito principal — busca com debounce e AbortController local ───────────
  //
  // [FIX-1] O controller é criado dentro do efeito e capturado pela closure do
  // timer/fetch. O cleanup aborta o controller local — sem risco de apontar para
  // um request posterior que tenha substituído uma ref compartilhada.

  useEffect(() => {
    if (!formData.modelo.trim()) {
      setResultado(null)
      setErro(null)
      return
    }

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setLoading(true)
      setErro(null)

      // Monta body — omite campos vazios para não poluir a busca
      const body = { modelo: formData.modelo.trim() }
      if (formData.fabricante.trim()) body.fabricante = formData.fabricante.trim()
      if (formData.potencia.trim())   body.potencia   = formData.potencia.trim()

      try {
        const response = await fetch(API_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
          signal:  controller.signal,
        })

        // [FIX-5] Lê o body JSON antes de lançar o erro — o servidor retorna
        // { erro: string, dica?: string } em respostas 4xx/5xx.
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.erro || `Erro HTTP ${response.status}`)
        }

        const data = await response.json()
        setResultado(data)

        // Notifica o pai apenas quando equipamento aprovado sem pendências
        if (
          data.status !== 'datasheet_necessario' &&
          data.status !== 'equipamento_ambiguo'  &&
          !data.requer_upload_datasheet           &&
          onEquipamentoValidado
        ) {
          onEquipamentoValidado(data.equipamento_detectado)
        }

      } catch (err) {
        if (err.name === 'AbortError') return   // Ignorar cancelamentos
        setErro(err.message)
        setResultado(null)
      } finally {
        // [FIX-1] `controller` é local à closure — nunca aponta para outro request
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [formData.modelo, formData.fabricante, formData.potencia, onEquipamentoValidado])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="validador-equipamento-fv">
      <h3 className="validador__titulo">Validar Equipamento FV</h3>

      {/* Formulário */}
      <div className="validador__form">
        <div className="validador__campo">
          <label htmlFor="vef-fabricante">Fabricante</label>
          <input
            id="vef-fabricante"
            name="fabricante"
            type="text"
            placeholder="Ex.: Canadian Solar"
            value={formData.fabricante}
            onChange={handleChange}
          />
        </div>

        <div className="validador__campo validador__campo--obrigatorio">
          <label htmlFor="vef-modelo">Modelo *</label>
          <input
            id="vef-modelo"
            name="modelo"
            type="text"
            placeholder="Ex.: CS3W-450MS"
            value={formData.modelo}
            onChange={handleChange}
            autoComplete="off"
          />
        </div>

        <div className="validador__campo">
          <label htmlFor="vef-potencia">Potência</label>
          <input
            id="vef-potencia"
            name="potencia"
            type="text"
            placeholder="Ex.: 450, 450W, 5kW"
            value={formData.potencia}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Estado de carregamento */}
      {loading && (
        <div className="validador__loading" role="status" aria-live="polite">
          <span className="validador__spinner" aria-hidden="true" />
          Consultando catálogo…
        </div>
      )}

      {/* Erro */}
      {!loading && erro && (
        <div className="validador__erro" role="alert">
          <strong>Erro:</strong> {erro}
        </div>
      )}

      {/* Resultado */}
      {!loading && !erro && resultado && (
        <ResultadoPipeline resultado={resultado} />
      )}
    </div>
  )
}

// ─── Sub-componente: resultado do pipeline ────────────────────────────────────

function ResultadoPipeline({ resultado }) {
  const {
    status,
    equipamento_detectado,
    requer_upload_datasheet,
    motivo,
    campos_faltantes,
    sugestoes_match,
    auditoria,
  } = resultado

  const seguranca = auditoria?.seguranca_eletrica  // [FIX-4] sem cedilha

  return (
    <div className={`validador__resultado validador__resultado--${_cssStatus(status)}`}>

      {/* Cabeçalho do status */}
      <div className="validador__status">
        <span className="validador__status-icone" aria-hidden="true">
          {_iconeStatus(status)}
        </span>
        <span className="validador__status-texto">
          {SEGURANCA_LABEL[seguranca] ?? status}
        </span>
      </div>

      {/* Motivo */}
      {motivo && (
        <p className="validador__motivo">{motivo}</p>
      )}

      {/* Equipamento detectado */}
      {equipamento_detectado && (
        <div className="validador__equipamento">
          <h4>Equipamento identificado</h4>
          <dl className="validador__dl">
            <dt>Fabricante</dt>
            <dd>{equipamento_detectado.fabricante ?? '—'}</dd>
            <dt>Modelo</dt>
            <dd>{equipamento_detectado.modelo ?? '—'}</dd>
            <dt>Tipo</dt>
            <dd>{equipamento_detectado.tipo_equipamento ?? '—'}</dd>
            <dt>Potência</dt>
            <dd>
              {equipamento_detectado.potencia_w != null
                ? `${equipamento_detectado.potencia_w} W`
                : '—'}
            </dd>
            <dt>Score</dt>
            <dd>{_formatScore(equipamento_detectado.score_match)}</dd>
          </dl>
        </div>
      )}

      {/* Campos faltantes — [FIX-2] array de objetos { campo, descricao } */}
      {campos_faltantes?.length > 0 && (
        <div className="validador__campos-faltantes">
          <h4>Campos elétricos ausentes no catálogo</h4>
          <p className="validador__campos-resumo">
            {/* [FIX-2] .map(f => f.campo) antes do join */}
            {campos_faltantes.map(f => f.campo).join(', ')}
          </p>
          <ul className="validador__campos-lista">
            {campos_faltantes.map(f => (
              <li key={f.campo}>
                <code>{f.campo}</code>
                {f.descricao && <span> — {f.descricao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sugestões de match para status ambíguo */}
      {sugestoes_match?.length > 0 && (
        <div className="validador__sugestoes">
          <h4>Equipamentos similares encontrados</h4>
          <ul className="validador__sugestoes-lista">
            {sugestoes_match.map(sug => (
              <li key={sug.id} className="validador__sugestao-item">
                <strong>{sug.fabricante}</strong> {sug.modelo}
                {/* [FIX-3] potencia_w, não potencia */}
                {sug.potencia_w != null && (
                  <span className="validador__sugestao-potencia">
                    {' '}({sug.potencia_w} W)
                  </span>
                )}
                <span className="validador__sugestao-score">
                  {' '}score: {_formatScore(sug.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Indicação de upload */}
      {requer_upload_datasheet && (
        <div className="validador__upload-aviso">
          <strong>Ação necessária:</strong> envie o datasheet do equipamento para cadastro.
        </div>
      )}

      {/* Auditoria colapsável */}
      {auditoria && (
        <details className="validador__auditoria">
          <summary>Dados de auditoria</summary>
          <dl className="validador__dl">
            <dt>Versão matcher</dt>
            <dd>{auditoria.versao_matcher ?? '—'}</dd>
            <dt>Método de match</dt>
            <dd>{auditoria.metodo_match ?? '—'}</dd>
            <dt>Nível de confiança</dt>
            <dd>{auditoria.nivel_confianca ?? '—'}</dd>
            <dt>Camadas avaliadas</dt>
            <dd>{auditoria.camadas_avaliadas ?? '—'}</dd>
            <dt>Segurança elétrica</dt>
            {/* [FIX-4] seguranca_eletrica sem cedilha */}
            <dd>{auditoria.seguranca_eletrica ?? '—'}</dd>
            <dt>Auditado em</dt>
            <dd>{auditoria.auditado_em ?? '—'}</dd>
          </dl>
        </details>
      )}
    </div>
  )
}

// ─── Helpers de apresentação ──────────────────────────────────────────────────

function _cssStatus(status) {
  switch (status) {
    case 'equipamento_encontrado': return 'ok'
    case 'equipamento_ambiguo':    return 'aviso'
    case 'datasheet_necessario':   return 'pendente'
    default:                       return 'neutro'
  }
}

function _iconeStatus(status) {
  switch (status) {
    case 'equipamento_encontrado': return '✔'
    case 'equipamento_ambiguo':    return '⚠'
    case 'datasheet_necessario':   return '📄'
    default:                       return 'ℹ'
  }
}

function _formatScore(score) {
  if (score == null) return '—'
  return `${(score * 100).toFixed(1)}%`
}
