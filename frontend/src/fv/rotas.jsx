import { Navigate, Route } from 'react-router-dom'
import ListaProjetos from './paginas/ListaProjetos'
import ProjetoFluxoLayout from './paginas/ProjetoFluxoLayout'
import EtapaProjeto from './paginas/etapas/EtapaProjeto'
import EtapaEquipamentos from './paginas/etapas/EtapaEquipamentos'
import EtapaEstrutura from './paginas/etapas/EtapaEstrutura'
import EtapaDimensionamento from './paginas/etapas/EtapaDimensionamento'
import EtapaMppt from './paginas/etapas/EtapaMppt'
import EtapaBeneficiarias from './paginas/etapas/EtapaBeneficiarias'
import EtapaCotacao from './paginas/etapas/EtapaCotacao'
import EtapaOrcamentos from './paginas/etapas/EtapaOrcamentos'
import EtapaAprovacao from './paginas/etapas/EtapaAprovacao'
import EtapaProposta from './paginas/etapas/EtapaProposta'
import EtapaFinanceiro from './paginas/etapas/EtapaFinanceiro'
import EtapaBaseline from './paginas/etapas/EtapaBaseline'
import EtapaGate from './paginas/etapas/EtapaGate'
import EtapaEngenharia from './paginas/etapas/EtapaEngenharia'
import EtapaHomologacao from './paginas/etapas/EtapaHomologacao'
import EtapaUnifilar from './paginas/etapas/EtapaUnifilar'
import EtapaExecutivo from './paginas/etapas/EtapaExecutivo'
import EtapaExecucao from './paginas/etapas/EtapaExecucao'
import EtapaAsBuilt from './paginas/etapas/EtapaAsBuilt'

/**
 * rotas.jsx — rotas da nova UX FV — FV-UX-010.
 *
 * Vivem sob `/fv/*`, separadas das rotas clássicas (`/projetos-fv/*`), que
 * permanecem intactas. É a convivência exigida pelo §6: nenhuma tela antiga foi
 * removida e nenhum comportamento existente mudou.
 *
 * Cada etapa é uma ROTA, não um passo de estado. Recarregar a página mantém o
 * lugar; compartilhar o link abre a mesma etapa.
 */
export const rotasFv = (
  <>
    {/* Entrada principal do módulo FV (FV-UX-011). */}
    <Route path="fv/projetos" element={<ListaProjetos />} />
    <Route path="fv/projetos/:id" element={<ProjetoFluxoLayout />}>
    <Route index element={<Navigate to="projeto" replace />} />
    <Route path="projeto"     element={<EtapaProjeto />} />
    <Route path="equipamentos" element={<EtapaEquipamentos />} />
    <Route path="estrutura"     element={<EtapaEstrutura />} />
    <Route path="dimensionamento" element={<EtapaDimensionamento />} />
    <Route path="mppt"          element={<EtapaMppt />} />
    <Route path="beneficiarias" element={<EtapaBeneficiarias />} />
    <Route path="cotacao"     element={<EtapaCotacao />} />
    <Route path="orcamentos"  element={<EtapaOrcamentos />} />
    <Route path="aprovacao"   element={<EtapaAprovacao />} />
    <Route path="proposta"    element={<EtapaProposta />} />
    <Route path="financeiro"  element={<EtapaFinanceiro />} />
    <Route path="baseline"    element={<EtapaBaseline />} />
    <Route path="gate"        element={<EtapaGate />} />
    <Route path="engenharia"  element={<EtapaEngenharia />} />
    <Route path="homologacao" element={<EtapaHomologacao />} />
    <Route path="unifilar"    element={<EtapaUnifilar />} />
    <Route path="executivo"   element={<EtapaExecutivo />} />
    <Route path="execucao"    element={<EtapaExecucao />} />
    <Route path="asbuilt"     element={<EtapaAsBuilt />} />
    </Route>
  </>
)

export default rotasFv
