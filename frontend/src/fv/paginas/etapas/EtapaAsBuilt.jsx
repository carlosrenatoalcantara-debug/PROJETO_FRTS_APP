import EtapaPendente from '../../componentes/EtapaPendente'

/** EtapaAsBuilt — estruturada em FV-UX-010; agregado ainda não existe no domínio. */
export default function EtapaAsBuilt() {
  return (
    <EtapaPendente
      titulo="As-Built"
      agregado="AsBuilt (não implementado)"
      sprint="FV-DOM-007 → FV-UX-014"
    >
      <p className="mt-4 text-xs text-slate-500">Registro do executado, base do comissionamento e do pós-venda.</p>
    </EtapaPendente>
  )
}
