import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clientes = lazy(() => import('./pages/Clientes'))
const ClienteGerenciamento = lazy(() => import('./pages/ClienteGerenciamento'))
const NovaProposta = lazy(() => import('./pages/NovaProposta'))
const NovaPropostaEV = lazy(() => import('./pages/NovaPropostaEV'))
const ProjetosFV = lazy(() => import('./pages/ProjetosFV'))
const ProjetosFVDetalhes = lazy(() => import('./pages/ProjetosFVDetalhes'))
const ProjetosFVNovo = lazy(() => import('./pages/ProjetosFVNovo'))
const ProjetosEVDetalhes = lazy(() => import('./pages/ProjetosEVDetalhes'))
const SimulacaoFV = lazy(() => import('./pages/SimulacaoFV'))
const SimulacaoFinanceira = lazy(() => import('./pages/SimulacaoFinanceira'))
const ComparacaoBESS = lazy(() => import('./pages/ComparacaoBESS'))
const CRM = lazy(() => import('./pages/CRM'))
const ProjetosEV = lazy(() => import('./pages/ProjetosEV'))
const Homologacao = lazy(() => import('./pages/Homologacao'))
const Catalogo = lazy(() => import('./pages/Catalogo'))
const Materiais = lazy(() => import('./pages/Materiais'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Modulos = lazy(() => import('./pages/Modulos'))
const Inversores = lazy(() => import('./pages/Inversores'))
const CarregadoresEV = lazy(() => import('./pages/CarregadoresEV'))
const Baterias = lazy(() => import('./pages/Baterias'))
const Calculadora = lazy(() => import('./pages/Calculadora'))
import Login               from './pages/Login'
const AdminCatalogoQualidade = lazy(() => import('./pages/AdminCatalogoQualidade'))
const RecomendacaoKits = lazy(() => import('./pages/RecomendacaoKits'))
const PropostaPublica = lazy(() => import('./pages/PropostaPublica'))
// FV-UX-035 — proposta do fluxo canônico: um link por grupo, todas as opções.
const PropostaFVPublica = lazy(() => import('./pages/PropostaFVPublica'))
const PainelExecutivo = lazy(() => import('./pages/PainelExecutivo'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const FaturaRevisao = lazy(() => import('./pages/FaturaRevisao'))
const SaudeCatalogo = lazy(() => import('./pages/SaudeCatalogo'))
const AlertCenter = lazy(() => import('./pages/AlertCenter'))
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha'))
const AtivoQR = lazy(() => import('./pages/AtivoQR'))
const Unifilar = lazy(() => import('./pages/Unifilar'))
import { rotasFv } from './fv/rotas'

/**
 * 2026-11-25: páginas carregadas sob demanda. O bundle único tinha 2,6 MB e
 * era baixado inteiro antes da primeira tela; agora cada página vem quando é
 * aberta. Login e Layout seguem no pacote inicial.
 */
const carregando = <p className="p-6 text-sm text-slate-500">Carregando…</p>
const P = (Pagina) => <Suspense fallback={carregando}><Pagina /></Suspense>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={P(RedefinirSenha)} />
      <Route path="/calculadora" element={P(Calculadora)} />
      <Route path="/p/:token" element={P(PropostaPublica)} />
      <Route path="/proposta/:token" element={P(PropostaFVPublica)} />
      <Route path="/ativo/:qr" element={P(AtivoQR)} />   {/* P1-ASSET-QR-CODE-01 — pública (campo) */}
      <Route path="/unifilar/:projetoId" element={P(Unifilar)} />   {/* P1-UNIFILAR-INTERATIVO-01 — pública (campo) */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"               element={P(Dashboard)} />
        <Route path="painel-executivo"        element={P(PainelExecutivo)} />
        <Route path="auditoria"               element={P(Auditoria)} />
        <Route path="clientes"                element={P(Clientes)} />
        <Route path="clientes/:clienteId"     element={P(ClienteGerenciamento)} />
        {/* DEPRECATED_DO_NOT_USE — Substituído por ProjetosFVNovo (/projetos-fv/novo).
            Mantido temporariamente apenas para retrocompat de links salvos.
            Ver auditoria: ProjetosFVNovo é o wizard oficial FV. */}
        <Route path="propostas/nova"          element={P(NovaProposta)} />
        <Route path="propostas-ev/nova"       element={P(NovaPropostaEV)} />
        <Route path="projetos-fv"             element={P(ProjetosFV)} />
        <Route path="faturas/revisao"         element={P(FaturaRevisao)} />
        <Route path="faturas/revisao/:id"     element={P(FaturaRevisao)} />
        <Route path="catalogo/saude"          element={P(SaudeCatalogo)} />
        <Route path="alertcenter"             element={P(AlertCenter)} />
        <Route path="projetos-fv/novo"        element={P(ProjetosFVNovo)} />
        <Route path="projetos-fv/simulacao"   element={P(SimulacaoFV)} />
        <Route path="projetos-fv/:id"         element={P(ProjetosFVDetalhes)} />
        <Route path="financeiro"              element={P(SimulacaoFinanceira)} />
        <Route path="comparacao-bess"         element={P(ComparacaoBESS)} />
        <Route path="crm"                     element={P(CRM)} />
        <Route path="projetos-ev"             element={P(ProjetosEV)} />
        <Route path="projetos-ev/:id/editar"  element={P(NovaPropostaEV)} />
        <Route path="projetos-ev/:id"         element={P(ProjetosEVDetalhes)} />
        <Route path="homologacao"             element={P(Homologacao)} />
        <Route path="catalogo"                element={P(Catalogo)} />
        <Route path="materiais"               element={P(Materiais)} />
        <Route path="configuracoes"           element={P(Configuracoes)} />
        <Route path="equipamentos/modulos"         element={P(Modulos)} />
        <Route path="equipamentos/inversores"      element={P(Inversores)} />
        <Route path="equipamentos/carregadores-ev" element={P(CarregadoresEV)} />
        <Route path="equipamentos/baterias"        element={P(Baterias)} />
        <Route path="admin/catalogo/qualidade"     element={P(AdminCatalogoQualidade)} />
        <Route path="kits/recomendar"              element={P(RecomendacaoKits)} />

        {/* FV-UX-010 — nova UX FV (fluxo canônico). Convive com as rotas
            clássicas acima, que permanecem inalteradas. */}
        {rotasFv}
      </Route>
    </Routes>
  )
}
