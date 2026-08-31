import EtapaPendente from '../../componentes/EtapaPendente'

/** EtapaExecucao — estruturada em FV-UX-010; agregado ainda não existe no domínio. */
export default function EtapaExecucao() {
  return (
    <EtapaPendente
      titulo="Execução"
      agregado="Execucao (não implementado)"
      sprint="FV-DOM-007 → FV-UX-014"
    >
      <p className="mt-4 text-xs text-slate-500">Nomenclatura a definir em ADR: o agregado de topologia já se chama Instalacao.</p>
    </EtapaPendente>
  )
}
