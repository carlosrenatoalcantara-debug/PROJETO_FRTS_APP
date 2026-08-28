import { useCallback, useEffect, useState } from 'react'
import {
  registrarParecer, obterParecer, confirmarParecer,
} from '../api/agregadosFvApi'

/**
 * ParecerDeAcesso — FV-UX-043.
 *
 * Três estados, os mesmos que a FV-DOM-042 modela:
 *
 *   nenhum      → registrar
 *   extraido    → revisar (conflitos, lacunas, validações) e confirmar
 *   confirmado  → somente leitura
 *
 * ── O que esta tela NÃO faz ─────────────────────────────────────────────────
 * Não valida, não normaliza, não compara e não decide. `validacao` e
 * `comparacao` chegam PRONTAS do servidor; a tela as renderiza. Revalidar aqui
 * criaria a segunda implementação que a FV-DOM-039 acabou de eliminar noutro
 * lugar — e, pior, poderia divergir do que o domínio decide.
 *
 * ── Por que não há upload do PDF ────────────────────────────────────────────
 * Não existe extrator: a FV-UX-041 auditou o legado e a FV-DOM-042 decidiu não
 * reativá-lo, e D5 proíbe enviar documento a provedor externo sem configuração
 * explícita. O que existe hoje é o método `manual`. Então o formulário captura
 * o NOME do arquivo — rastreabilidade de qual documento originou o dado — e os
 * campos digitados pelo operador. **O arquivo não é lido nem enviado a lugar
 * nenhum**, e a tela diz isso ao operador em vez de sugerir uma automação que
 * não existe.
 */

const ROTULOS = {
  'documento.numero_parecer': 'Número do parecer',
  'documento.emitido_em': 'Emitido em',
  'documento.distribuidora': 'Distribuidora',
  'cliente.nome': 'Cliente',
  'cliente.cpf_cnpj': 'CPF/CNPJ',
  'cliente.email': 'E-mail',
  'cliente.endereco': 'Endereço',
  'uc.numero_cliente': 'Número de cliente',
  'uc.tipo_ligacao': 'Tipo de ligação',
  'uc.tensao_v': 'Tensão',
  'uc.grupo_tarifario': 'Grupo tarifário',
  'uc.modalidade_gd': 'Modalidade de GD',
  'geracao.modulos': 'Módulos',
  'geracao.inversores': 'Inversores',
}
/** Rótulo legível; caminho desconhecido é exibido como veio, sem inventar nome. */
const rotular = (caminho) => ROTULOS[caminho] ?? ROTULOS[String(caminho).split(':')[0]] ?? caminho

const FORM_VAZIO = {
  arquivo_original_nome: '',
  numero_parecer: '',
  emitido_em: '',
  distribuidora: '',
  cliente_nome: '',
  cliente_cpf_cnpj: '',
  cliente_endereco: '',
  numero_cliente: '',
  tipo_ligacao: '',
  tensao_v: '',
  grupo_tarifario: '',
  modalidade_gd: '',
  modulo_marca: '',
  modulo_modelo: '',
  modulo_potencia_w: '',
  modulo_quantidade: '',
  inversor_marca: '',
  inversor_modelo: '',
  inversor_potencia_kw: '',
  inversor_quantidade: '',
  potencia_instalada_kwp: '',
}

/**
 * Formulário → corpo do contrato.
 *
 * Campo em branco vira `null`, nunca um valor plausível — é a mesma regra que o
 * domínio aplica do outro lado (FV-DOM-029). A tela não preenche nada por
 * omissão, e por isso o que chega ao servidor é o que o operador digitou.
 */
function paraContrato(f) {
  const t = (v) => (String(v ?? '').trim() === '' ? null : String(v).trim())
  const n = (v) => (String(v ?? '').trim() === '' ? null : Number(v))
  const item = (marca, modelo, potencia, campoPotencia, qtd) => {
    if (!t(marca) && !t(modelo)) return []
    return [{
      marca: t(marca), modelo: t(modelo),
      [campoPotencia]: n(potencia), quantidade: n(qtd),
    }]
  }
  return {
    numero_parecer: t(f.numero_parecer),
    emitido_em: t(f.emitido_em),
    cliente: {
      nome: t(f.cliente_nome),
      cpf_cnpj: t(f.cliente_cpf_cnpj),
      email: null,                 // o parecer não traz e-mail; nunca sintetizado
      endereco: t(f.cliente_endereco),
    },
    uc: {
      numero_cliente: t(f.numero_cliente),
      distribuidora: t(f.distribuidora),
      tipo_ligacao: t(f.tipo_ligacao),
      tensao_v: n(f.tensao_v),
      grupo_tarifario: t(f.grupo_tarifario),
      modalidade_gd: t(f.modalidade_gd),
    },
    geracao: {
      modulos: item(f.modulo_marca, f.modulo_modelo, f.modulo_potencia_w,
        'potencia_w', f.modulo_quantidade),
      inversores: item(f.inversor_marca, f.inversor_modelo, f.inversor_potencia_kw,
        'potencia_kw', f.inversor_quantidade),
      potencia_instalada_kwp: n(f.potencia_instalada_kwp),
    },
  }
}

const Campo = ({ rotulo, valor, onChange, tipo = 'text', dica = null }) => (
  <label className="block">
    <span className="text-xs text-slate-500">{rotulo}</span>
    <input
      type={tipo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={dica ?? ''}
      className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
    />
  </label>
)

/** Um valor do parecer, exibido como veio. Ausente é "—", nunca preenchido. */
const Linha = ({ rotulo, valor }) => (
  <div className="flex justify-between gap-3 text-sm">
    <dt className="text-slate-500">{rotulo}</dt>
    <dd className={valor == null || valor === '' ? 'text-slate-400' : 'text-slate-800'}>
      {valor == null || valor === '' ? '—' : String(valor)}
    </dd>
  </div>
)

export default function ParecerDeAcesso({ projetoId, liberado }) {
  const [envelope, setEnvelope] = useState(null)
  const [comparacao, setComparacao] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [abrindoForm, setAbrindoForm] = useState(false)

  const recarregar = useCallback(async () => {
    if (!projetoId) return
    setCarregando(true)
    setErro(null)
    try {
      setEnvelope(await obterParecer(projetoId))
    } catch (e) {
      setErro(e?.message ?? String(e))
    } finally {
      setCarregando(false)
    }
  }, [projetoId])

  useEffect(() => { recarregar() }, [recarregar])

  const editar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))

  async function registrar() {
    setOcupado('registrar')
    setErro(null)
    try {
      const r = await registrarParecer(projetoId, {
        metodo: 'manual',
        arquivo_original_nome: form.arquivo_original_nome || null,
        dados: paraContrato(form),
      })
      // A comparação só vem no registro — é a resposta daquele ato.
      setComparacao(r?.comparacao ?? null)
      setAbrindoForm(false)
      setForm(FORM_VAZIO)
      await recarregar()
    } catch (e) {
      setErro(e?.codigo ? `${e.message} (${e.codigo})` : (e?.message ?? String(e)))
    } finally {
      setOcupado(null)
    }
  }

  async function confirmar() {
    setOcupado('confirmar')
    setErro(null)
    try {
      await confirmarParecer(projetoId)
      await recarregar()
    } catch (e) {
      setErro(e?.codigo ? `${e.message} (${e.codigo})` : (e?.message ?? String(e)))
    } finally {
      setOcupado(null)
    }
  }

  if (carregando) {
    return (
      <div className="mt-4 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Parecer de Acesso</h3>
        <p className="mt-2 text-xs text-slate-500">Carregando…</p>
      </div>
    )
  }

  const dados = envelope?.dados ?? null
  const validacao = envelope?.validacao ?? null
  const confirmado = envelope?.confirmado === true
  const registrado = envelope?.registrado === true

  return (
    <div className={`mt-4 rounded border p-4 ${
      confirmado ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Parecer de Acesso</h3>
        {registrado && (
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
            confirmado ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
            {confirmado ? 'conferido' : 'extraído — aguarda conferência'}
          </span>
        )}
      </div>

      {erro && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{erro}</p>
      )}

      {/* ── Estado 1 · Nenhum parecer ─────────────────────────────────────── */}
      {!registrado && !abrindoForm && (
        <>
          <p className="mt-2 text-xs text-slate-600">
            Nenhum parecer registrado. O documento da concessionária pode ser
            registrado aqui para conferência.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            A leitura automática de PDF não está disponível: o registro é manual,
            e o arquivo não é enviado a nenhum serviço externo.
          </p>
          <button
            type="button"
            onClick={() => setAbrindoForm(true)}
            disabled={!liberado}
            className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white
              hover:bg-slate-700 disabled:bg-slate-400"
          >
            Registrar parecer manualmente
          </button>
          {!liberado && (
            <p className="mt-2 text-xs text-slate-500">
              O Gate bloqueia esta fase — o registro fica indisponível.
            </p>
          )}
        </>
      )}

      {/* ── Formulário de registro ────────────────────────────────────────── */}
      {!registrado && abrindoForm && (
        <div className="mt-3 space-y-3">
          <p className="rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            Selecionar o arquivo apenas registra o <strong>nome</strong> do
            documento, para rastreabilidade. O conteúdo não é lido nem enviado.
          </p>
          <label className="block">
            <span className="text-xs text-slate-500">Documento de origem</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => editar('arquivo_original_nome')(e.target.files?.[0]?.name ?? '')}
              className="mt-0.5 block w-full text-xs text-slate-600"
            />
            {form.arquivo_original_nome && (
              <span className="mt-1 block text-xs text-slate-500">
                Registrado como: {form.arquivo_original_nome}
              </span>
            )}
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Número do parecer" valor={form.numero_parecer}
              onChange={editar('numero_parecer')} />
            <Campo rotulo="Emitido em" valor={form.emitido_em}
              onChange={editar('emitido_em')} tipo="date" />
            <Campo rotulo="Distribuidora" valor={form.distribuidora}
              onChange={editar('distribuidora')} />
            <Campo rotulo="Número de cliente" valor={form.numero_cliente}
              onChange={editar('numero_cliente')} />
            <Campo rotulo="Cliente" valor={form.cliente_nome}
              onChange={editar('cliente_nome')} />
            <Campo rotulo="CPF/CNPJ" valor={form.cliente_cpf_cnpj}
              onChange={editar('cliente_cpf_cnpj')} dica="000.000.000-00" />
            <Campo rotulo="Tipo de ligação" valor={form.tipo_ligacao}
              onChange={editar('tipo_ligacao')} dica="Monofásico / Bifásico / Trifásico" />
            <Campo rotulo="Tensão (V)" valor={form.tensao_v}
              onChange={editar('tensao_v')} tipo="number" dica="127 / 220 / 380" />
            <Campo rotulo="Grupo tarifário" valor={form.grupo_tarifario}
              onChange={editar('grupo_tarifario')} dica="A / B" />
            <Campo rotulo="Modalidade de GD" valor={form.modalidade_gd}
              onChange={editar('modalidade_gd')} dica="GD II / GD III" />
          </div>

          <fieldset className="rounded border border-slate-200 p-2">
            <legend className="px-1 text-xs font-medium text-slate-600">Módulos</legend>
            <div className="grid gap-2 sm:grid-cols-4">
              <Campo rotulo="Marca" valor={form.modulo_marca} onChange={editar('modulo_marca')} />
              <Campo rotulo="Modelo" valor={form.modulo_modelo} onChange={editar('modulo_modelo')} />
              <Campo rotulo="Potência (W)" valor={form.modulo_potencia_w}
                onChange={editar('modulo_potencia_w')} tipo="number" />
              <Campo rotulo="Quantidade" valor={form.modulo_quantidade}
                onChange={editar('modulo_quantidade')} tipo="number" />
            </div>
          </fieldset>

          <fieldset className="rounded border border-slate-200 p-2">
            <legend className="px-1 text-xs font-medium text-slate-600">Inversores</legend>
            <div className="grid gap-2 sm:grid-cols-4">
              <Campo rotulo="Marca" valor={form.inversor_marca} onChange={editar('inversor_marca')} />
              <Campo rotulo="Modelo" valor={form.inversor_modelo} onChange={editar('inversor_modelo')} />
              <Campo rotulo="Potência (kW)" valor={form.inversor_potencia_kw}
                onChange={editar('inversor_potencia_kw')} tipo="number" />
              <Campo rotulo="Quantidade" valor={form.inversor_quantidade}
                onChange={editar('inversor_quantidade')} tipo="number" />
            </div>
          </fieldset>

          <Campo rotulo="Potência instalada declarada (kWp)"
            valor={form.potencia_instalada_kwp}
            onChange={editar('potencia_instalada_kwp')} tipo="number" />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={registrar}
              disabled={ocupado !== null}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white
                hover:bg-slate-700 disabled:bg-slate-400"
            >
              {/* Rótulo explícito: a fase já tem um "Registrar" (o do protocolo
                  na concessionária), e dois botões com o mesmo nome na mesma
                  tela deixam o operador em dúvida sobre o que está registrando. */}
              {ocupado === 'registrar' ? 'Registrando…' : 'Registrar parecer'}
            </button>
            <button
              type="button"
              onClick={() => { setAbrindoForm(false); setForm(FORM_VAZIO); setErro(null) }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Estados 2 e 3 · Revisar / conferido ───────────────────────────── */}
      {registrado && dados && (
        <div className="mt-3 space-y-3">
          <dl className="space-y-1">
            <Linha rotulo="Número do parecer" valor={dados.documento?.numero_parecer} />
            <Linha rotulo="Emitido em" valor={dados.documento?.emitido_em
              ? new Date(dados.documento.emitido_em).toLocaleDateString('pt-BR') : null} />
            <Linha rotulo="Distribuidora" valor={dados.documento?.distribuidora} />
            <Linha rotulo="Cliente" valor={dados.cliente?.nome} />
            <Linha rotulo="CPF/CNPJ" valor={dados.cliente?.cpf_cnpj} />
            <Linha rotulo="Número de cliente" valor={dados.uc?.numero_cliente} />
            <Linha rotulo="Ligação" valor={[dados.uc?.tipo_ligacao,
              dados.uc?.tensao_v ? `${dados.uc.tensao_v} V` : null].filter(Boolean).join(' · ') || null} />
            <Linha rotulo="Modalidade de GD" valor={dados.uc?.modalidade_gd} />
            {dados.uc?.modalidade_gd && dados.uc?.modalidade_gd_aceita === false && (
              <p className="text-xs text-amber-800">
                Esta modalidade está fora do vocabulário do domínio. O valor foi
                preservado como veio no documento — não foi convertido.
              </p>
            )}
            <Linha rotulo="Módulos" valor={(dados.geracao?.modulos ?? [])
              .map((m) => `${m.quantidade ?? '—'} × ${[m.marca, m.modelo].filter(Boolean).join(' ')}`)
              .join(' + ') || null} />
            <Linha rotulo="Inversores" valor={(dados.geracao?.inversores ?? [])
              .map((i) => `${i.quantidade ?? '—'} × ${[i.marca, i.modelo].filter(Boolean).join(' ')}`)
              .join(' + ') || null} />
            <Linha rotulo="Potência declarada" valor={dados.geracao?.potencia_instalada_kwp
              ? `${dados.geracao.potencia_instalada_kwp} kWp` : null} />
          </dl>

          {/* Conflitos — só aparecem logo após o registro, que é quando o
              servidor os calcula. Nada foi sobrescrito (FV-DOM-042/D4). */}
          {comparacao?.tem_conflito && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2">
              <p className="text-xs font-medium text-amber-900">
                {comparacao.conflitos.length} divergência(s) em relação ao que o projeto já registra
              </p>
              <ul className="mt-1 space-y-0.5">
                {comparacao.conflitos.map((c) => (
                  <li key={c.campo} className="text-xs text-amber-900">
                    <strong>{rotular(c.campo)}</strong>: parecer diz “{String(c.parecer)}”,
                    projeto diz “{String(c.projeto)}”
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-800">
                Nada foi alterado no projeto. A decisão sobre qual valor vale é sua.
              </p>
            </div>
          )}

          {validacao?.bloqueios?.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-2">
              <p className="text-xs font-medium text-red-800">
                Precisa de correção antes da conferência
              </p>
              <ul className="mt-1 list-disc pl-4">
                {validacao.bloqueios.map((b) => (
                  <li key={b} className="text-xs text-red-700">{b}</li>
                ))}
              </ul>
            </div>
          )}

          {validacao?.lacunas?.length > 0 && (
            <details className="rounded border border-slate-200 bg-slate-50 p-2">
              <summary className="cursor-pointer text-xs text-slate-600">
                {validacao.lacunas.length} dado(s) que o documento não informou
              </summary>
              <ul className="mt-1 flex flex-wrap gap-1">
                {validacao.lacunas.map((l) => (
                  <li key={l} className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">
                    {rotular(l)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!confirmado && (
            <>
              <button
                type="button"
                onClick={confirmar}
                disabled={!liberado || ocupado !== null || validacao?.confirmavel === false}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white
                  hover:bg-emerald-800 disabled:bg-slate-400"
              >
                {ocupado === 'confirmar' ? 'Confirmando…' : 'Confirmar conferência'}
              </button>
              <p className="text-xs text-slate-500">
                Confirmar registra que você conferiu o documento. Nenhum dado é
                copiado para o projeto — levar qualquer valor para equipamentos,
                arranjos ou fatura continua sendo ato explícito seu.
              </p>
            </>
          )}

          {confirmado && (
            <p className="text-xs text-emerald-800">
              Documento conferido pelo operador. Os dados acima permanecem como
              registro do que o parecer diz.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
