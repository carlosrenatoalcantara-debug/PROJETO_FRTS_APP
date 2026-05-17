import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ChevronDown } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Catalogo() {
  const [aba, setAba] = useState('modulos')
  const [modulos, setModulos] = useState([])
  const [inversores, setInversores] = useState([])
  const [kits, setKits] = useState([])
  const [fabricantes, setFabricantes] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [mostraFormModulo, setMostraFormModulo] = useState(false)
  const [mostraFormInversor, setMostraFormInversor] = useState(false)
  const [mostraFormKit, setMostraFormKit] = useState(false)

  const [formModulo, setFormModulo] = useState({ fabricanteId: '', modelo: '', potencia: '', voc: '', vmp: '', isc: '', garantia_produto: 12, garantia_performance: 25 })
  const [formInversor, setFormInversor] = useState({ fabricanteId: '', modelo: '', potenciaKW: '', mppts: 1, vocMax: '', mpptMin: '', mpptMax: '', imaxMppt: '' })
  const [formKit, setFormKit] = useState({ nome: '', distribuidor: 'Forte Solar', moduloId: '', inversorId: '', estrutura: 'Colonial', preco_total: '', potencia_total: '' })

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      setCarregando(true)
      const [fabRes, modRes, invRes, kitRes] = await Promise.all([
        fetch(`${API_URL}/api/equipamentos/fabricantes`),
        fetch(`${API_URL}/api/equipamentos/modulos`),
        fetch(`${API_URL}/api/equipamentos/inversores`),
        fetch(`${API_URL}/api/equipamentos/kits`),
      ])

      const fab = await fabRes.json()
      const mod = await modRes.json()
      const inv = await invRes.json()
      const kit = await kitRes.json()

      setFabricantes(fab)
      setModulos(mod)
      setInversores(inv)
      setKits(kit)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function criarModulo() {
    if (!formModulo.fabricanteId || !formModulo.modelo || !formModulo.potencia) return

    try {
      const res = await fetch(`${API_URL}/api/equipamentos/modulos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formModulo),
      })
      if (res.ok) {
        await carregarDados()
        setFormModulo({ fabricanteId: '', modelo: '', potencia: '', voc: '', vmp: '', isc: '', garantia_produto: 12, garantia_performance: 25 })
        setMostraFormModulo(false)
      }
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  async function criarInversor() {
    if (!formInversor.fabricanteId || !formInversor.modelo || !formInversor.potenciaKW) return

    try {
      const res = await fetch(`${API_URL}/api/equipamentos/inversores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formInversor),
      })
      if (res.ok) {
        await carregarDados()
        setFormInversor({ fabricanteId: '', modelo: '', potenciaKW: '', mppts: 1, vocMax: '', mpptMin: '', mpptMax: '', imaxMppt: '' })
        setMostraFormInversor(false)
      }
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  async function criarKit() {
    if (!formKit.nome || !formKit.moduloId || !formKit.inversorId) return

    try {
      const res = await fetch(`${API_URL}/api/equipamentos/kits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formKit),
      })
      if (res.ok) {
        await carregarDados()
        setFormKit({ nome: '', distribuidor: 'Forte Solar', moduloId: '', inversorId: '', estrutura: 'Colonial', preco_total: '', potencia_total: '' })
        setMostraFormKit(false)
      }
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  async function deletarModulo(id) {
    if (!confirm('Deletar este módulo?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/modulos/${id}`, { method: 'DELETE' })
      await carregarDados()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  async function deletarInversor(id) {
    if (!confirm('Deletar este inversor?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/inversores/${id}`, { method: 'DELETE' })
      await carregarDados()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  async function deletarKit(id) {
    if (!confirm('Deletar este kit?')) return
    try {
      await fetch(`${API_URL}/api/equipamentos/kits/${id}`, { method: 'DELETE' })
      await carregarDados()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  if (carregando) {
    return <div className="p-6 text-center text-slate-500">Carregando...</div>
  }

  const fabricantesOpcoes = fabricantes.map(f => ({ valor: f.id, rotulo: f.nome }))
  const modulosOpcoes = modulos.map(m => ({ valor: m.id, rotulo: `${fabricantes.find(f => f.id === m.fabricanteId)?.nome} - ${m.modelo}` }))
  const inversoresOpcoes = inversores.map(i => ({ valor: i.id, rotulo: `${fabricantes.find(f => f.id === i.fabricanteId)?.nome} - ${i.modelo}` }))

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Catálogo de Equipamentos</h1>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'modulos', label: 'Módulos' },
          { id: 'inversores', label: 'Inversores' },
          { id: 'kits', label: 'Kits' },
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
                <Select rotulo="Fabricante" opcoes={fabricantesOpcoes} value={formModulo.fabricanteId} onChange={e => setFormModulo({...formModulo, fabricanteId: e.target.value})} />
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
              const fab = fabricantes.find(f => f.id === mod.fabricanteId)
              return (
                <Card key={mod.id}>
                  <CardHeader className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{fab?.nome}</p>
                      <p className="text-xs text-slate-500">{mod.modelo}</p>
                    </div>
                    <button onClick={() => deletarModulo(mod.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Potência:</span><span className="font-medium">{mod.potencia}W</span></div>
                    {mod.voc && <div className="flex justify-between"><span className="text-slate-500">VOC:</span><span className="font-medium">{mod.voc}V</span></div>}
                    {mod.isc && <div className="flex justify-between"><span className="text-slate-500">ISC:</span><span className="font-medium">{mod.isc}A</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Garantia:</span><span className="font-medium">{mod.garantia_performance} anos</span></div>
                  </CardBody>
                </Card>
              )
            })}
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
                <Select rotulo="Fabricante" opcoes={fabricantesOpcoes} value={formInversor.fabricanteId} onChange={e => setFormInversor({...formInversor, fabricanteId: e.target.value})} />
                <Input rotulo="Modelo" value={formInversor.modelo} onChange={e => setFormInversor({...formInversor, modelo: e.target.value})} placeholder="Ex: Primo 5.0-1" />
                <div className="grid grid-cols-2 gap-3">
                  <Input rotulo="Potência (kW)" type="number" value={formInversor.potenciaKW} onChange={e => setFormInversor({...formInversor, potenciaKW: e.target.value})} />
                  <Input rotulo="MPPTs" type="number" value={formInversor.mppts} onChange={e => setFormInversor({...formInversor, mppts: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input rotulo="VOC Max (V)" type="number" value={formInversor.vocMax} onChange={e => setFormInversor({...formInversor, vocMax: e.target.value})} />
                  <Input rotulo="MPPT Min" type="number" value={formInversor.mpptMin} onChange={e => setFormInversor({...formInversor, mpptMin: e.target.value})} />
                  <Input rotulo="MPPT Max" type="number" value={formInversor.mpptMax} onChange={e => setFormInversor({...formInversor, mpptMax: e.target.value})} />
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
              const fab = fabricantes.find(f => f.id === inv.fabricanteId)
              return (
                <Card key={inv.id}>
                  <CardHeader className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{fab?.nome}</p>
                      <p className="text-xs text-slate-500">{inv.modelo}</p>
                    </div>
                    <button onClick={() => deletarInversor(inv.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Potência:</span><span className="font-medium">{inv.potenciaKW}kW</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">MPPTs:</span><span className="font-medium">{inv.mppts}</span></div>
                    {inv.vocMax && <div className="flex justify-between"><span className="text-slate-500">VOC Max:</span><span className="font-medium">{inv.vocMax}V</span></div>}
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {aba === 'kits' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Kits Pré-montados</h2>
            <Button icone={Plus} onClick={() => setMostraFormKit(!mostraFormKit)}>Novo Kit</Button>
          </div>

          {mostraFormKit && (
            <Card>
              <CardHeader>Adicionar Kit</CardHeader>
              <CardBody className="space-y-3">
                <Input rotulo="Nome do Kit" value={formKit.nome} onChange={e => setFormKit({...formKit, nome: e.target.value})} placeholder="Ex: Kit 5kWp Fronius" />
                <Input rotulo="Distribuidor" value={formKit.distribuidor} onChange={e => setFormKit({...formKit, distribuidor: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <Select rotulo="Módulo" opcoes={modulosOpcoes} value={formKit.moduloId} onChange={e => setFormKit({...formKit, moduloId: e.target.value})} />
                  <Select rotulo="Inversor" opcoes={inversoresOpcoes} value={formKit.inversorId} onChange={e => setFormKit({...formKit, inversorId: e.target.value})} />
                </div>
                <Input rotulo="Estrutura" value={formKit.estrutura} onChange={e => setFormKit({...formKit, estrutura: e.target.value})} placeholder="Ex: Colonial" />
                <div className="grid grid-cols-2 gap-3">
                  <Input rotulo="Preço Total (R$)" type="number" value={formKit.preco_total} onChange={e => setFormKit({...formKit, preco_total: e.target.value})} />
                  <Input rotulo="Potência Total (kWp)" type="number" value={formKit.potencia_total} onChange={e => setFormKit({...formKit, potencia_total: e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <Button variante="primario" onClick={criarKit}>Criar</Button>
                  <Button variante="secundario" onClick={() => setMostraFormKit(false)}>Cancelar</Button>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            {kits.map(kit => {
              const modulo = modulos.find(m => m.id === kit.moduloId)
              const inversor = inversores.find(i => i.id === kit.inversorId)
              return (
                <Card key={kit.id}>
                  <CardHeader className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{kit.nome}</p>
                      <p className="text-xs text-slate-500">{kit.distribuidor}</p>
                    </div>
                    <button onClick={() => deletarKit(kit.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 font-semibold">Módulo</p>
                        <p className="text-slate-900">{modulo?.modelo}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Inversor</p>
                        <p className="text-slate-900">{inversor?.modelo}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Estrutura</p>
                        <p className="text-slate-900">{kit.estrutura}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Preço</p>
                        <p className="text-slate-900 font-bold">R$ {kit.preco_total?.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
