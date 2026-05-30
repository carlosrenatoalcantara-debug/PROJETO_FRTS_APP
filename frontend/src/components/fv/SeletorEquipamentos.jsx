import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import ModalNovoModulo from '../equipamentos/ModalNovoModulo'
import ModalNovoInversor from '../equipamentos/ModalNovoInversor'
import ModalNovoCarregadorEV from '../equipamentos/ModalNovoCarregadorEV'

export default function SeletorEquipamentos({ onSelecionar }) {
  const [modulos, setModulos] = useState([])
  const [inversores, setInversores] = useState([])
  const [carregadores, setCarregadores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [selecionados, setSelecionados] = useState({
    modulo: null,
    inversor: null,
    carregador: null,
  })
  const [modalAberto, setModalAberto] = useState(null)

  useEffect(() => {
    carregarEquipamentos()
  }, [])

  async function carregarEquipamentos() {
    try {
      setCarregando(true)
      const [resModulos, resInversores, resCarregadores] = await Promise.all([
        fetch('/api/equipamentos?tipo=modulo&ativo=true'),
        fetch('/api/equipamentos?tipo=inversor&ativo=true'),
        fetch('/api/equipamentos?tipo=carregador-ev&ativo=true'),
      ])

      const dadosModulos = await resModulos.json()
      const dadosInversores = await resInversores.json()
      const dadosCarregadores = await resCarregadores.json()

      setModulos(dadosModulos.equipamentos || [])
      setInversores(dadosInversores.equipamentos || [])
      setCarregadores(dadosCarregadores.equipamentos || [])
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err)
    } finally {
      setCarregando(false)
    }
  }

  function handleSelecionarModulo(modulo) {
    setSelecionados({ ...selecionados, modulo })
    onSelecionar({ ...selecionados, modulo })
  }

  function handleSelecionarInversor(inversor) {
    setSelecionados({ ...selecionados, inversor })
    onSelecionar({ ...selecionados, inversor })
  }

  function handleSelecionarCarregador(carregador) {
    setSelecionados({ ...selecionados, carregador })
    onSelecionar({ ...selecionados, carregador })
  }

  function handleModalSalvar() {
    setModalAberto(null)
    carregarEquipamentos()
  }

  return (
    <div className="space-y-6">
      {/* Módulos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Seleção de Módulos Fotovoltaicos</span>
            <Button
              size="sm"
              onClick={() => setModalAberto('modulo')}
              className="flex items-center gap-1"
            >
              <Plus size={16} />
              Novo
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {carregando ? (
            <p className="text-slate-600">Carregando...</p>
          ) : modulos.length === 0 ? (
            <p className="text-slate-600">Nenhum módulo cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modulos.map((modulo) => (
                <div
                  key={modulo._id}
                  onClick={() => handleSelecionarModulo(modulo)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selecionados.modulo?._id === modulo._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{modulo.fabricante}</p>
                  <p className="text-sm text-slate-600">{modulo.modelo}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold">{modulo.especificacoes?.potencia_wp}Wp</p>
                      <p>Potência</p>
                    </div>
                    <div>
                      <p className="font-semibold">R$ {modulo.preco_sugerido}</p>
                      <p>Preço</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Inversores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Seleção de Inversores</span>
            <Button
              size="sm"
              onClick={() => setModalAberto('inversor')}
              className="flex items-center gap-1"
            >
              <Plus size={16} />
              Novo
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {carregando ? (
            <p className="text-slate-600">Carregando...</p>
          ) : inversores.length === 0 ? (
            <p className="text-slate-600">Nenhum inversor cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inversores.map((inversor) => (
                <div
                  key={inversor._id}
                  onClick={() => handleSelecionarInversor(inversor)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selecionados.inversor?._id === inversor._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{inversor.fabricante}</p>
                  <p className="text-sm text-slate-600">{inversor.modelo}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold">{inversor.especificacoes?.potencia_kw}kW</p>
                      <p>Potência</p>
                    </div>
                    <div>
                      <p className="font-semibold">R$ {inversor.preco_sugerido}</p>
                      <p>Preço</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Carregadores EV */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>Seleção de Carregadores EV</span>
            <Button
              size="sm"
              onClick={() => setModalAberto('carregador')}
              className="flex items-center gap-1"
            >
              <Plus size={16} />
              Novo
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {carregando ? (
            <p className="text-slate-600">Carregando...</p>
          ) : carregadores.length === 0 ? (
            <p className="text-slate-600">Nenhum carregador EV cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {carregadores.map((carregador) => (
                <div
                  key={carregador._id}
                  onClick={() => handleSelecionarCarregador(carregador)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selecionados.carregador?._id === carregador._id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{carregador.fabricante}</p>
                  <p className="text-sm text-slate-600">{carregador.modelo}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold">{carregador.especificacoes?.potencia_kw}kW</p>
                      <p>Potência</p>
                    </div>
                    <div>
                      <p className="font-semibold">R$ {carregador.preco_sugerido}</p>
                      <p>Preço</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modais */}
      {modalAberto === 'modulo' && (
        <ModalNovoModulo
          onClose={() => setModalAberto(null)}
          onSalvar={handleModalSalvar}
        />
      )}
      {modalAberto === 'inversor' && (
        <ModalNovoInversor
          onClose={() => setModalAberto(null)}
          onSalvar={handleModalSalvar}
        />
      )}
      {modalAberto === 'carregador' && (
        <ModalNovoCarregadorEV
          onClose={() => setModalAberto(null)}
          onSalvar={handleModalSalvar}
        />
      )}
    </div>
  )
}
