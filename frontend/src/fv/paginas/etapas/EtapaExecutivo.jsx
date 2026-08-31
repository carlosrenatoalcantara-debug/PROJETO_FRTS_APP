import EtapaPendente from '../../componentes/EtapaPendente'

/** EtapaExecutivo — estruturada em FV-UX-010; agregado ainda não existe no domínio. */
export default function EtapaExecutivo() {
  return (
    <EtapaPendente
      titulo="Projeto Executivo"
      agregado="ProjetoExecutivo (não implementado)"
      sprint="FV-DOM-006"
    >
      <p className="mt-4 text-xs text-slate-500">Emitido quando Engenharia e Homologação concluem.</p>
    </EtapaPendente>
  )
}
