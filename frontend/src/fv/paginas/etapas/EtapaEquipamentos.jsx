import { useEffect, useMemo, useState } from 'react'
import { useProjeto } from '../../providers/ProjetoProvider'
import { listarCatalogo } from '../../api/agregadosFvApi'
import {
  painelDoCatalogo, inversorDoCatalogo, idSelecionado,
  potenciaDoModulo, potenciaDoInversor, rotuloDoEquipamento,
} from '../../catalogo'

/**
 * EtapaEquipamentos — módulo e inversor do projeto — FV-UX-019.
 *
 * Segundo bloqueio P0 da FV-OPS-001. Como o primeiro, não faltava domínio:
 * `PUT /:id/etapa` já aceita a etapa `equipamentos`, o schema já guarda
 * `equipamentos.paineis[]` e `equipamentos.inversor`, e o catálogo já tem uma
 * API oficial de engenharia. Faltava a tela.
 *
 * ── A seleção é por REFERÊNCIA ───────────────────────────────────────────────
 * O usuário escolhe um `Equipamento` que já existe no catálogo. Não há campo
 * livre de marca, modelo ou potência: nada entra no projeto sem estar cadastrado.
 * `equipamento_id` guarda o vínculo; os campos ao lado são a cópia que o schema
 * mantém e que o adapter do unifilar lê.
 *
 * ── Substituição integral ────────────────────────────────────────────────────
 * O handler da etapa `equipamentos` faz `$set.equipamentos = dados` — objeto
 * inteiro, sem whitelist. Por isso o envio parte de uma CÓPIA do que o servidor
 * devolveu: mandar só `{paineis, inversor}` apagaria `estrutura`.
 *
 * ── O que esta tela não faz ──────────────────────────────────────────────────
 * Não dimensiona, não calcula compatibilidade, não monta arranjo, não escolhe
 * MPPT, não completa especificação ausente. Potência que o catálogo não declara
 * aparece como não informada e é gravada como `null`.
 */

/** Documento → texto do input. Ausência vira '', e `0` continua "0". */
const texto = (v) => (v === null || v === undefined ? '' : String(v))

export default function EtapaEquipamentos() {
  const { projeto, carregando, erro, acoes } = useProjeto()

  const [modulos, setModulos] = useState(null)
  const [inversores, setInversores] = useState(null)
  const [erroCatalogo, setErroCatalogo] = useState(null)

  const [rascunho, setRascunho] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([listarCatalogo('modulo'), listarCatalogo('inversor')])
      .then(([m, i]) => {
        if (!vivo) return
        setModulos(m?.equipamentos ?? [])
        setInversores(i?.equipamentos ?? [])
      })
      .catch((e) => { if (vivo) setErroCatalogo(e.message) })
    return () => { vivo = false }
  }, [])

  /** Seleção persistida, na forma que o formulário edita. */
  const original = useMemo(() => {
    const eq = projeto?.equipamentos ?? {}
    const painel = Array.isArray(eq.paineis) ? eq.paineis[0] : null
    return {
      moduloId: idSelecionado(painel),
      quantidade: texto(painel?.quantidade),
      inversorId: idSelecionado(eq.inversor),
    }
  }, [projeto])

  const valores = rascunho ?? original
  const alterado = ['moduloId', 'quantidade', 'inversorId'].some((k) => valores[k] !== original[k])

  const moduloEscolhido = (modulos ?? []).find((e) => String(e._id) === valores.moduloId) ?? null
  const inversorEscolhido = (inversores ?? []).find((e) => String(e._id) === valores.inversorId) ?? null

  function editar(chave, valor) {
    setRascunho({ ...valores, [chave]: valor })
    setSalvo(false)
  }

  async function salvar(ev) {
    ev.preventDefault()
    if (!alterado) return
    setSalvando(true)
    setErroSalvar(null)
    try {
      const atual = projeto?.equipamentos ?? {}
      const painel = moduloEscolhido ? painelDoCatalogo(moduloEscolhido, valores.quantidade) : null
      const inversor = inversorEscolhido ? inversorDoCatalogo(inversorEscolhido) : null
      await acoes.salvarEtapa('equipamentos', {
        ...atual,
        paineis: painel ? [painel] : [],
        inversor: inversor ?? {},
      })
      setRascunho(null)
      setSalvo(true)
    } catch (e) {
      setErroSalvar(e.codigo ? `${e.message} (${e.codigo})` : e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>
  if (erro) return <p className="p-6 text-sm text-red-600">{erro}</p>
  if (!projeto) return <p className="p-6 text-sm text-slate-500">Projeto não encontrado.</p>

  const catalogoCarregando = modulos === null || inversores === null
  const potModulo = moduloEscolhido ? potenciaDoModulo(moduloEscolhido) : null
  const potInversor = inversorEscolhido ? potenciaDoInversor(inversorEscolhido) : null

  return (
    <section className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900">Equipamentos</h2>
      <p className="mt-1 text-sm text-slate-500">
        Módulo e inversor vêm do catálogo. Não há entrada livre — o que não está
        cadastrado não entra no projeto.
      </p>

      {erroCatalogo && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          Catálogo indisponível: {erroCatalogo}
        </p>
      )}

      <form onSubmit={salvar} className="mt-6 rounded border border-slate-300 bg-white p-4">
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Módulo</span>
            <select
              aria-label="Módulo"
              disabled={catalogoCarregando}
              value={valores.moduloId}
              onChange={(e) => editar('moduloId', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            >
              <option value="">{catalogoCarregando ? 'carregando catálogo…' : 'não selecionado'}</option>
              {(modulos ?? []).map((e) => (
                <option key={e._id} value={String(e._id)}>
                  {rotuloDoEquipamento(e, potenciaDoModulo(e), 'W')}
                </option>
              ))}
            </select>
            {moduloEscolhido && potModulo === null && (
              <span className="mt-1 block text-xs text-amber-700">
                O catálogo não declara a potência deste módulo. Será gravada como não informada.
              </span>
            )}
          </label>

          <label className="text-sm">
            <span className="text-slate-600">Quantidade de módulos</span>
            <input
              aria-label="Quantidade de módulos"
              type="number" min="0" step="1"
              value={valores.quantidade}
              onChange={(e) => editar('quantidade', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Quantidade informada. Nada é dimensionado a partir dela nesta etapa.
            </span>
          </label>

          <label className="text-sm">
            <span className="text-slate-600">Inversor</span>
            <select
              aria-label="Inversor"
              disabled={catalogoCarregando}
              value={valores.inversorId}
              onChange={(e) => editar('inversorId', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            >
              <option value="">{catalogoCarregando ? 'carregando catálogo…' : 'não selecionado'}</option>
              {(inversores ?? []).map((e) => (
                <option key={e._id} value={String(e._id)}>
                  {rotuloDoEquipamento(e, potenciaDoInversor(e), 'kW')}
                </option>
              ))}
            </select>
            {inversorEscolhido && potInversor === null && (
              <span className="mt-1 block text-xs text-amber-700">
                O catálogo não declara a potência deste inversor. Será gravada como não informada.
              </span>
            )}
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Arranjo, strings e MPPT não são definidos aqui — continuam pendentes.
        </p>

        {erroSalvar && <p role="alert" className="mt-3 text-xs text-red-600">{erroSalvar}</p>}
        {salvo && !alterado && <p className="mt-3 text-xs text-emerald-700">Equipamentos salvos.</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={salvando || !alterado}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {salvando ? 'Salvando…' : 'Salvar equipamentos'}
          </button>
          {alterado && !salvando && (
            <button
              type="button"
              onClick={() => { setRascunho(null); setErroSalvar(null) }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Descartar alterações
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
