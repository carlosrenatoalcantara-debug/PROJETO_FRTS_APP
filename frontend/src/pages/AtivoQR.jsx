// P1-ASSET-QR-CODE-01 + P1-ASSET-COMMISSIONING-01
// Página pública por QR (uso em campo): consulta + comissionamento (dados reais instalados).
// Lê/escreve SOMENTE AtivoEquipamento via /api/ativos/qr/:qr (não toca projeto/Atlas/arranjos).
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import EtiquetaScanner from './EtiquetaScanner'

const STATUS_COR = {
  planejado: 'bg-slate-100 text-slate-700',
  instalado: 'bg-blue-100 text-blue-700',
  operacional: 'bg-green-100 text-green-700',
  manutencao: 'bg-amber-100 text-amber-700',
  substituido: 'bg-purple-100 text-purple-700',
  desativado: 'bg-red-100 text-red-700',
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{rotulo}</span>
      <span className="text-slate-900 text-sm font-medium text-right break-all">{valor ?? '—'}</span>
    </div>
  )
}

const MON_CAMPOS = [
  ['portal', 'Portal'], ['plant_id', 'Plant ID'], ['gateway_sn', 'Gateway SN'],
  ['logger_id', 'Logger ID'], ['url', 'URL'], ['usuario', 'Usuário'], ['senha', 'Senha'],
]

// FASE 5 — Aba Monitoramento (registro permanente; usuario/senha criptografados no backend)
function MonitoramentoCard({ ativoId }) {
  const [mon, setMon] = useState(null)
  const [editar, setEditar] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/ativos/${ativoId}/monitoramento`)
      if (r.ok) { const j = await r.json(); setMon(j.monitoramento) }
    } catch { /* silencioso */ }
  }, [ativoId])
  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setSalvando(true); setMsg(null)
    try {
      const payload = {}
      for (const [k] of MON_CAMPOS) if (form[k] !== '' && form[k] != null) payload[k] = form[k]
      const r = await fetch(`/api/ativos/${ativoId}/monitoramento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) { setMsg(j.erro || 'Erro ao salvar'); return }
      setMon(j.monitoramento); setEditar(false); setForm({}); setMsg('Monitoramento salvo.')
    } catch { setMsg('Falha de conexão') } finally { setSalvando(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-400 uppercase">Monitoramento</div>
        {!editar && <button onClick={() => { setEditar(true); setForm({}); setMsg(null) }} className="text-emerald-700 text-xs font-semibold">Editar</button>}
      </div>
      {msg && <div className="text-xs text-emerald-700 mb-2">{msg}</div>}
      {!editar && (
        <div>
          <Linha rotulo="Portal" valor={mon?.portal} />
          <Linha rotulo="Plant ID" valor={mon?.plant_id} />
          <Linha rotulo="Gateway SN" valor={mon?.gateway_sn} />
          <Linha rotulo="Logger ID" valor={mon?.logger_id} />
          <Linha rotulo="URL" valor={mon?.url} />
          <Linha rotulo="Usuário" valor={mon?.usuario_definido ? '•••••• (definido)' : null} />
          <Linha rotulo="Senha" valor={mon?.senha_definida ? '•••••• (definida)' : null} />
        </div>
      )}
      {editar && (
        <div className="space-y-2">
          {MON_CAMPOS.map(([k, rotulo]) => (
            <label key={k} className="block">
              <span className="text-xs text-slate-500">{rotulo}</span>
              <input type={k === 'senha' ? 'password' : 'text'} value={form[k] ?? ''} autoComplete="off"
                onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
                placeholder={k === 'senha' && mon?.senha_definida ? '(manter atual)' : (k === 'usuario' && mon?.usuario_definido ? '(manter atual)' : '')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditar(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const CAMPOS = [
  ['numero_serie', 'Nº de série'],
  ['mac_address', 'MAC address'],
  ['firmware', 'Firmware'],
  ['ip_local', 'IP local'],
  ['wifi_ssid', 'Wi‑Fi SSID'],
  ['wifi_senha', 'Wi‑Fi senha'],
  ['comissionado_por', 'Comissionado por'],
]

export default function AtivoQR() {
  const { qr } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [editar, setEditar] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [scanAberto, setScanAberto] = useState(false)

  // Recebe os campos lidos da etiqueta (QR/OCR) e pré-preenche o formulário (usuário confirma).
  function aoCapturar(campos, fonte) {
    setForm(f => ({ ...f, ...campos }))
    setScanAberto(false); setEditar(true)
    setMsg({ tipo: 'ok', txt: `Etiqueta lida (${fonte || 'scan'}): ${Object.keys(campos).join(', ')}. Confira e salve.` })
  }

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/ativos/qr/${encodeURIComponent(qr)}`)
      if (r.status === 404) { setErro('QR não encontrado'); return }
      if (!r.ok) { setErro('Erro ao consultar o ativo'); return }
      const j = await r.json()
      setDados(j)
      const c = j.ativo?.conectividade || {}
      setForm({
        numero_serie: j.ativo?.numero_serie || '', mac_address: c.mac_wifi || '',
        firmware: c.firmware || '', ip_local: c.endereco_ip || '', wifi_ssid: c.wifi_ssid || '',
        wifi_senha: '', comissionado_por: j.ativo?.comissionado_por || '',
      })
    } catch { setErro('Falha de conexão') } finally { setCarregando(false) }
  }, [qr])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setSalvando(true); setMsg(null)
    try {
      // só envia campos preenchidos (senha em branco = não altera)
      const payload = {}
      for (const [k] of CAMPOS) if (form[k] !== '' && form[k] != null) payload[k] = form[k]
      const r = await fetch(`/api/ativos/qr/${encodeURIComponent(qr)}/comissionar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) { setMsg({ tipo: 'erro', txt: j.erro || 'Erro ao salvar' }); return }
      setMsg({ tipo: 'ok', txt: j.sem_mudanca ? 'Nenhuma mudança.' : `${j.alteracoes_registradas} campo(s) registrado(s).` })
      setEditar(false)
      await carregar()
    } catch { setMsg({ tipo: 'erro', txt: 'Falha de conexão' }) } finally { setSalvando(false) }
  }

  const c = dados?.ativo?.conectividade

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="text-xs font-semibold tracking-widest text-emerald-600">FORTE SOLAR · GÊMEO DIGITAL</div>
          <div className="font-mono text-lg font-bold text-slate-800">{qr}</div>
        </div>

        {carregando && <div className="text-center text-slate-500 py-10">Carregando…</div>}
        {erro && (
          <div className="bg-white rounded-2xl shadow p-6 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-red-600 font-semibold">{erro}</div>
            <div className="text-slate-500 text-sm mt-1">Verifique o código {qr}.</div>
          </div>
        )}

        {dados && !erro && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-5 flex flex-col items-center">
              <img src={`/api/ativos/qr/${encodeURIComponent(qr)}/render.svg`} alt={`QR ${qr}`}
                width={200} height={200} className="border border-slate-100 rounded-lg" />
              <span className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase ${STATUS_COR[dados.ativo?.status] || 'bg-slate-100 text-slate-600'}`}>
                {dados.ativo?.status || '—'}
              </span>
            </div>

            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Equipamento (instalado)</div>
              <div className="text-lg font-bold text-slate-900">{dados.ativo?.fabricante} {dados.ativo?.modelo}</div>
              <div className="mt-2">
                <Linha rotulo="Tipo" valor={dados.ativo?.tipo} />
                <Linha rotulo="Nº de série" valor={dados.ativo?.numero_serie} />
                <Linha rotulo="Topologia" valor={dados.ativo?.topologia} />
                <Linha rotulo="Comissionado" valor={dados.ativo?.data_comissionamento ? `${new Date(dados.ativo.data_comissionamento).toLocaleDateString('pt-BR')} · ${dados.ativo?.comissionado_por || ''}` : null} />
              </div>
            </div>

            {/* Dados de rede (as-built) */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Conectividade</div>
              <Linha rotulo="MAC" valor={c?.mac_wifi} />
              <Linha rotulo="Wi‑Fi SSID" valor={c?.wifi_ssid} />
              <Linha rotulo="Firmware" valor={c?.firmware} />
              <Linha rotulo="IP local" valor={c?.endereco_ip} />
              <Linha rotulo="Senha Wi‑Fi" valor={c?.senha_definida ? '•••••• (definida)' : null} />
            </div>

            <div className="bg-white rounded-2xl shadow p-5">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Projeto / Arranjo</div>
              <Linha rotulo="Projeto" valor={dados.projeto?.nome} />
              <Linha rotulo="Arranjo" valor={dados.arranjo?.rotulo || dados.arranjo?.id} />
            </div>

            {/* Comissionamento (form mobile) */}
            {!editar && (
              <div className="space-y-2">
                <button onClick={() => { setScanAberto(true); setMsg(null) }}
                  className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-2xl shadow active:scale-[0.99]">
                  📷 Escanear etiqueta
                </button>
                <button onClick={() => { setEditar(true); setMsg(null) }}
                  className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-2xl">
                  Registrar manualmente
                </button>
              </div>
            )}
            {msg && (
              <div className={`rounded-xl p-3 text-sm text-center ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.txt}</div>
            )}
            {editar && (
              <div className="bg-white rounded-2xl shadow p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-400 uppercase">Comissionamento</div>
                  <button onClick={() => setScanAberto(true)} className="text-emerald-700 text-xs font-semibold">📷 Escanear</button>
                </div>
                {CAMPOS.map(([k, rotulo]) => (
                  <label key={k} className="block">
                    <span className="text-xs text-slate-500">{rotulo}</span>
                    <input
                      type={k === 'wifi_senha' ? 'password' : 'text'}
                      value={form[k] ?? ''} onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder={k === 'wifi_senha' && c?.senha_definida ? '(manter atual)' : ''}
                      autoComplete="off"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setEditar(false); setMsg(null) }} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl">Cancelar</button>
                  <button onClick={salvar} disabled={salvando} className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Monitoramento (registro permanente) */}
            {dados.ativo?._id && <MonitoramentoCard ativoId={dados.ativo._id} />}

            {/* Histórico */}
            {dados.ativo?.historico?.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Histórico</div>
                {dados.ativo.historico.slice().reverse().map((h, i) => (
                  <div key={i} className="text-sm text-slate-600 py-1.5 border-b border-slate-100 last:border-0">
                    <div><span className="font-medium text-slate-800">{h.tipo}</span>
                      <span className="text-slate-400"> · {h.usuario || '—'} · {h.data ? new Date(h.data).toLocaleDateString('pt-BR') : ''}</span></div>
                    {h.status_de && h.status_para && h.status_de !== h.status_para && (
                      <div className="text-xs text-slate-500">status: {h.status_de} → {h.status_para}</div>)}
                    {Array.isArray(h.alteracoes) && h.alteracoes.map((a, j) => (
                      <div key={j} className="text-xs text-slate-500">{a.campo}: <span className="line-through text-slate-400">{String(a.de ?? '—')}</span> → {String(a.para ?? '—')}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {scanAberto && (
          <EtiquetaScanner
            fabricante={dados?.ativo?.fabricante}
            onCapture={aoCapturar}
            onClose={() => setScanAberto(false)}
          />
        )}
      </div>
    </div>
  )
}
