import Input from '../../ui/Input'

/**
 * Formulário de revisão dos dados extraídos da fatura.
 * Editável — usuário pode corrigir antes de avançar.
 * Mostra badge indicando origem (extraído vs editado).
 */
export default function FormDadosExtraidos({ dados, onChange }) {
  const setCampo = (campo) => (e) => {
    onChange({ ...dados, [campo]: e.target.value })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 mb-2">Dados do Cliente</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input rotulo="Nome *" value={dados.nome || ''} onChange={setCampo('nome')} />
          <Input rotulo="CPF / CNPJ" value={dados.cpfCnpj || ''} onChange={setCampo('cpfCnpj')} />
          <Input rotulo="Telefone" value={dados.telefone || ''} onChange={setCampo('telefone')} placeholder="(84) 9 9999-9999" />
          <Input rotulo="Email" type="email" value={dados.email || ''} onChange={setCampo('email')} />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-2">Endereço</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input rotulo="Endereço completo" value={dados.endereco || ''} onChange={setCampo('endereco')} />
          </div>
          <Input rotulo="CEP" value={dados.cep || ''} onChange={setCampo('cep')} />
          <Input rotulo="Cidade" value={dados.cidade || ''} onChange={setCampo('cidade')} />
          <Input rotulo="Estado (UF)" value={dados.estado || ''} onChange={setCampo('estado')} placeholder="RN" />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-2">Dados Técnicos da Conta</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Concessionária" value={dados.distribuidora || ''} onChange={setCampo('distribuidora')} />
          <Input rotulo="UC / Nº Cliente" value={dados.numeroCliente || ''} onChange={setCampo('numeroCliente')} />
          <Input rotulo="Cód. Instalação" value={dados.codigoInstalacao || ''} onChange={setCampo('codigoInstalacao')} />
          <Input rotulo="Classe" value={dados.classificacao || ''} onChange={setCampo('classificacao')} placeholder="B1, A4..." />
          <Input rotulo="Grupo" value={dados.grupoTarifario || ''} onChange={setCampo('grupoTarifario')} placeholder="A ou B" />
          <Input rotulo="Subgrupo" value={dados.subgrupo || ''} onChange={setCampo('subgrupo')} placeholder="Residencial..." />
          <Input rotulo="Tipo Ligação" value={dados.tipoLigacao || ''} onChange={setCampo('tipoLigacao')} placeholder="Monofásico..." />
          <Input rotulo="Tensão (V)" type="number" value={dados.tensaoV || ''} onChange={setCampo('tensaoV')} />
          <Input rotulo="Demanda (kW)" type="number" value={dados.demandaContratadaKw || ''} onChange={setCampo('demandaContratadaKw')} />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-2">Consumo & Valores</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input rotulo="Consumo mensal (kWh)" type="number" value={dados.consumoKwh || ''} onChange={setCampo('consumoKwh')} />
          <Input rotulo="Média anual (kWh)" type="number" value={dados.mediaAnual || ''} onChange={setCampo('mediaAnual')} />
          <Input rotulo="Tarifa R$/kWh" type="number" step="0.001" value={dados.valorKwh || ''} onChange={setCampo('valorKwh')} />
        </div>
      </div>

      {Array.isArray(dados.historico12Meses) && dados.historico12Meses.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
            📊 Histórico extraído ({dados.historico12Meses.length} meses)
          </summary>
          <div className="mt-2 grid grid-cols-4 gap-1 text-xs bg-slate-50 p-2 rounded">
            {dados.historico12Meses.map((h, i) => (
              <div key={i} className="bg-white px-2 py-1 rounded border">
                <span className="text-slate-500">{h.mes}:</span> <span className="font-medium">{h.consumo} kWh</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
