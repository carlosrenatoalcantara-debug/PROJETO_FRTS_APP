import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Catálogo de Equipamentos
 *
 * ⚠️ Restauração FASE 2A:
 * - Endpoints antigos `/api/equipamentos/modulos|inversores|kits|fabricantes`
 *   NÃO existem no backend (retornavam HTTP 500).
 * - Agora usa `/api/equipamentos?tipo=modulo|inversor` (endpoint real).
 * - "Fabricantes" é derivado de módulos+inversores (sem endpoint próprio).
 * - "Kits" não tem backend correspondente — aba mantida só como placeholder.
 *
 * Para gestão completa, prefira /equipamentos/modulos e /equipamentos/inversores
 * (Modulos.jsx / Inversores.jsx), que já estavam corretas.
 */
export default function Catalogo() {
  const [aba, setAba] = useState('modulos')
  const [modulos, setModulos] = useState([])
  const [inversores, setInversores] = useState([])
  const [fabricantes, setFabricantes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(null)

  const [mostraFormModulo, setMostraFormModulo] = useState(false)
  const [mostraFormInversor, setMostraFormInversor] = useState(false)

  const [formModulo, setFormModulo] = useState({
    fabricante: '', modelo: '',
    potencia: '', voc: '', vmp: '', isc: '',
    garantia_produto: 12, garantia_performance: 25,
  })
  const [formInversor, setFormInversor] = useState({
    fabricante: '', modelo: '',
    potencia: '', mppts: 1,
    voc_max: '', mppt_min: '', mppt_max: '',
  })

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      setCarregando(true)
      setErroCarga(null)

      const [modRes, invRes] = await Promise.all([
        fetch(`${API_URL}/api/equipamentos?tipo=modulo`),
        fetch(`${API_URL}/api/equipamentos?tipo=inversor`),
      ])

      if (!modRes.ok || !invRes.ok) {
        throw new Error(`Backend retornou erro (${modRes.status}/${invRes.status})`)
      }

      // Endpoint retorna { total, equipamentos: [...] } OU array — suportar ambos
      const modJson = await modRes.json()
      const invJson = await invRes.json()

      const mod = Array.isArray(modJson) ? modJson : (modJson.equipamentos || [])
      const inv = Array.isArray(invJson) ? invJson : (invJson.equipamentos || [])

      setModulos(mod)
      setInversores(inv)

      // Derivar fabricantes únicos a partir dos módulos + inversores
      const nomesUnicos = [...new Set(
        [...mod, ...inv]
          .map(e => e.fabricante)
          .filter(Boolean)
      )].sort()
      setFabricantes(nomesUnicos.map(nome => ({ id: nome, nome })))
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err)
      setErroCarga(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criarModulo() {
    if (!formModulo.fabricante || !formModulo.modelo || !formModulo.potencia) return
    try {
      const payload = {
        tipo: 'modulo',
        fabricante: formModulo.fabricante,
        modelo: formModulo.modelo,
        especificacoes: {
          potencia: Number(formModulo.potencia) || 0,
          voc: Number(formModulo.voc) || 0,
          vmp: Number(formModulo.vmp) || 0,
          isc: Number(formModulo.isc) || 0,
        },
        garantia_produto: { value: Number(formModulo.garantia_produto) || 12, unit: 'anos' },
        garantia_performance: { value: Number(formModulo.garantia_performance) || 25, unit: 'anos' },
        ativo: true,
      }
      const res = await fetch(`${API_URL}/api/equipamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await carregarDados()
        setFormModulo({ fabricante: '', modelo: '', potencia: '', voc: '', vmp: '', isc: '', garantia_produto: 12, garantia_performance: 25 })
        setMostraFormModulo(false)
      } else {
        alert('Erro ao criar módulo: ' + res.status)
      }
    } catch (err) {
      console.error('Erro:', err)
      alert('Erro ao criar módulo: ' + err.message)
    }
  }

  async function criarInversor() {
    if (!formInversor.fabricante || !formInversor.modelo || !formInversor.potencia) return
    try {
      const payload = {
        tipo: 'inversor',
        fabricante: formInversor.fabricante,
        modelo: formInversor.modelo,
        especificacoes: {
          potencia: Number(formInversor.potencia) || 0,
          mppts: Number(formInversor.mppts) || 1,
          voc_max: Number(formInversor.voc_max) || 0,
          mppt_min: Number(formInversor.mppt_min) || 0,
          mppt_max: Number(formInversor.mppt_max) || 0,
        },
        ativo: true,
      }
      const res = await fetch(`${API_URL}/api/equipamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await carregarDados()
        setFormInversor({ fabricante: '', modelo: '', potencia: '', mppts: 1, voc_max: '', mppt_min: '', mppt_max: '' })
        setMostraFormInversor(false)
      } else {
        alert('Erro ao criar inversor: ' + res.status)
      }
    } catch (err) {
      console.error('Erro:', err)
      alert('Erro ao criar inversor: ' + err.message)
    }
  }

  async function deletarEquipamento(id, nome) {
    if (!confirm(`Deletar "${nome}"?`)) return
    try {
      const res = await fetch(`${API_URL}/api/equipamentos/${id}`, { method: 'DELETE' })
      if (res.ok) await carregarDados()
      else alert('Erro ao deletar: ' + res.status)
    } catch (err) {
      console.error('Erro:', err)
      alert('Erro ao deletar: ' + err.message)
    }
  }

  if (carregando) {
    return <div className="p-6 text-center text-slate-500">Carregando catálogo...</div>
  }

  if (erroCarga) {
    return (
      <div className="p-6">
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-amber-600 font-medium mb-1">⚠️ Servidor temporariamente indisponível</div>
            <div className="text-slate-500 text-sm mb-3">{erroCarga}</div>
            <button onClick={carregarDados} className="text-sm text-blue-600 hover:text-blue-800 underline">
              Tentar novamente
            </button>
          </CardBody>
        </Card>
      </div>
    )
  }

  const fabricantesOpcoes = fabricantes.map(f => ({ valor: f.nome, rotulo: f.nome }))

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Catálogo de Equipamentos</h1>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'modulos',    label: `Módulos (${modulos.length})` },
          { id: 'inversores', label: `Inversores (${inversores.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              aba === tab.id
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'modulos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Módulos Fotovoltaicos</h2>
            <Button icone={Plus} onClick={() => setMostraFormModulo(!mostraFormModulo)}>Novo Módulo</Button>
          </div>

          {mostraFormModulo && (
            <Card>
              <CardHeader>Adicionar Módulo</CardHeader>
              <CardBody className="space-y-3">
                <Input rotulo="Fabricante" value={formModulo.fabricante} onChange={e => setFormModulo({...formModulo, fabricante: e.target.value})} placeholder="Ex: Canadian Solar" />
                <Input rotulo="Modelo" value={formModulo.modelo} onChange={e => setFormModulo({...formModulo, modelo: e.target.value})} placeholder="Ex: CS6W-550MS" />
                <div className="grid grid-cols-3 gap-3">
                  <Input rotulo="Potência (W)" type="number" value={formModulo.potencia} onChange={e => setFormModulo({...formModulo, potencia: e.target.value})} />
                  <Input rotulo="VOC (V)" type="number" value={formModulo.voc} onChange={e => setFormModulo({...formModulo, voc: e.target.value})} />
                  <Input rotulo="VMP (V)" type="number" value={formModulo.vmp} onChange={e => setFormModulo({...formModulo, vmp: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input rotulo="ISC (A)" type="number" value={formModulo.isc} onChange={e => setFormModulo({...formModulo, isc: e.target.value})} />
                  <Input rotulo="Garantia Produto (anos)" type="number" value={formModulo.garantia_produto} onChange={e => setFormModulo({...formModulo, garantia_produto: e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <Button variante="primario" onClick={criarModulo}>Criar</Button>
                  <Button variante="secundario" onClick={() => setMostraFormModulo(false)}>Cancelar</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modulos.map(mod => {
              const esp = mod.especificacoes || {}
              return (
                <Card key={mod._id}>
                  <CardHeader className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{mod.fabricante || '—'}</p>
                      <p className="text-xs text-slate-500">{mod.modelo}</p>
                    </div>
                    <button onClick={() => deletarEquipamento(mod._id, `${mod.fabricante} ${mod.modelo}`)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    {esp.potencia != null && <div className="flex justify-between"><span className="text-slate-500">Potência:</span><span className="font-medium">{esp.potencia}W</span></div>}
                    {esp.voc != null && <div className="flex justify-between"><span className="text-slate-500">VOC:</span><span className="font-medium">{esp.voc}V</span></div>}
                    {esp.isc != null && <div className="flex justify-between"><span className="text-slate-500">ISC:</span><span className="font-medium">{esp.isc}A</span></div>}
                    {esp.eficiencia != null && <div className="flex justify-between"><span className="text-slate-500">Eficiência:</span><span className="font-medium">{esp.eficiencia}%</span></div>}
                    {mod.garantia_performance?.value && <div className="flex justify-between"><span className="text-slate-500">Garantia perf.:</span><span className="font-medium">{mod.garantia_performance.value} {mod.garantia_performance.unit || 'anos'}</span></div>}
                  </CardBody>
                </Card>
              )
            })}
            {modulos.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">
                Nenhum módulo cadastrado.
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'inversores' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Inversores</h2>
            <Button icone={Plus} onClick={() => setMostraFormInversor(!mostraFormInversor)}>Novo Inversor</Button>
          </div>

          {mostraFormInversor && (
            <Card>
              <CardHeader>Adicionar Inversor</CardHeader>
              <CardBody className="space-y-3">
                <Input rotulo="Fabricante" value={formInversor.fabricante} onChange={e => setFormInversor({...formInversor, fabricante: e.target.value})} placeholder="Ex: Growatt" />
                <Input rotulo="Modelo" value={formInversor.modelo} onChange={e => setFormInversor({...formInversor, modelo: e.target.value})} placeholder="Ex: MIC 5000TL-X" />
                <div className="grid grid-cols-2 gap-3">
                  <Input rotulo="Potência (kW)" type="number" value={formInversor.potencia} onChange={e => setFormInversor({...formInversor, potencia: e.target.value})} />
                  <Input rotulo="MPPTs" type="number" value={formInversor.mppts} onChange={e => setFormInversor({...formInversor, mppts: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input rotulo="VOC Max (V)" type="number" value={formInversor.voc_max} onChange={e => setFormInversor({...formInversor, voc_max: e.target.value})} />
                  <Input rotulo="MPPT Min" type="number" value={formInversor.mppt_min} onChange={e => setFormInversor({...formInversor, mppt_min: e.target.value})} />
                  <Input rotulo="MPPT Max" type="number" value={formInversor.mppt_max} onChange={e => setFormInversor({...formInversor, mppt_max: e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <Button variante="primario" onClick={criarInversor}>Criar</Button>
                  <Button variante="secundario" onClick={() => setMostraFormInversor(false)}>Cancelar</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inversores.map(inv => {
              const esp = inv.especificacoes || {}
              return (
                <Card key={inv._id}>
                  <CardHeader className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{inv.fabricante || '—'}</p>
                      <p className="text-xs text-slate-500">{inv.modelo}</p>
                    </div>
                    <button onClick={() => deletarEquipamento(inv._id, `${inv.fabricante} ${inv.modelo}`)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    {esp.potencia != null && <div className="flex justify-between"><span className="text-slate-500">Potência:</span><span className="font-medium">{esp.potencia}kW</span></div>}
                    {esp.mppts != null && <div className="flex justify-between"><span className="text-slate-500">MPPTs:</span><span className="font-medium">{esp.mppts}</span></div>}
                    {esp.voc_max != null && <div className="flex justify-between"><span className="text-slate-500">VOC Max:</span><span className="font-medium">{esp.voc_max}V</span></div>}
                  </CardBody>
                </Card>
              )
            })}
            {inversores.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">
                Nenhum inversor cadastrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
