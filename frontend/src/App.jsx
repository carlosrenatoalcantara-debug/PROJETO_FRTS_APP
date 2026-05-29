import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard      from './pages/Dashboard'
import Clientes       from './pages/Clientes'
import ClienteGerenciamento from './pages/ClienteGerenciamento'
import NovaProposta from './pages/NovaProposta'
import NovaPropostaEV from './pages/NovaPropostaEV'
import ProjetosFV     from './pages/ProjetosFV'
import ProjetosFVDetalhes from './pages/ProjetosFVDetalhes'
import ProjetosFVNovo from './pages/ProjetosFVNovo'
import ProjetosEVDetalhes from './pages/ProjetosEVDetalhes'
import SimulacaoFV         from './pages/SimulacaoFV'
import SimulacaoFinanceira from './pages/SimulacaoFinanceira'
import ComparacaoBESS      from './pages/ComparacaoBESS'
import CRM                 from './pages/CRM'
import ProjetosEV          from './pages/ProjetosEV'
import Homologacao         from './pages/Homologacao'
import Catalogo            from './pages/Catalogo'
import Configuracoes       from './pages/Configuracoes'
import Modulos             from './pages/Modulos'
import Inversores          from './pages/Inversores'
import CarregadoresEV      from './pages/CarregadoresEV'
import Baterias            from './pages/Baterias'
import Calculadora         from './pages/Calculadora'
import Login               from './pages/Login'
import AdminCatalogoQualidade from './pages/AdminCatalogoQualidade'
import RecomendacaoKits       from './pages/RecomendacaoKits'
import PropostaPublica        from './pages/PropostaPublica'
import PainelExecutivo        from './pages/PainelExecutivo'
import Auditoria              from './pages/Auditoria'
import FaturaRevisao          from './pages/FaturaRevisao'
import SaudeCatalogo          from './pages/SaudeCatalogo'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/calculadora" element={<Calculadora />} />
      <Route path="/p/:token" element={<PropostaPublica />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"               element={<Dashboard />} />
        <Route path="painel-executivo"        element={<PainelExecutivo />} />
        <Route path="auditoria"               element={<Auditoria />} />
        <Route path="clientes"                element={<Clientes />} />
        <Route path="clientes/:clienteId"     element={<ClienteGerenciamento />} />
        {/* DEPRECATED_DO_NOT_USE — Substituído por ProjetosFVNovo (/projetos-fv/novo).
            Mantido temporariamente apenas para retrocompat de links salvos.
            Ver auditoria: ProjetosFVNovo é o wizard oficial FV. */}
        <Route path="propostas/nova"          element={<NovaProposta />} />
        <Route path="propostas-ev/nova"       element={<NovaPropostaEV />} />
        <Route path="projetos-fv"             element={<ProjetosFV />} />
        <Route path="faturas/revisao"         element={<FaturaRevisao />} />
        <Route path="faturas/revisao/:id"     element={<FaturaRevisao />} />
        <Route path="catalogo/saude"          element={<SaudeCatalogo />} />
        <Route path="projetos-fv/novo"        element={<ProjetosFVNovo />} />
        <Route path="projetos-fv/simulacao"   element={<SimulacaoFV />} />
        <Route path="projetos-fv/:id"         element={<ProjetosFVDetalhes />} />
        <Route path="financeiro"              element={<SimulacaoFinanceira />} />
        <Route path="comparacao-bess"         element={<ComparacaoBESS />} />
        <Route path="crm"                     element={<CRM />} />
        <Route path="projetos-ev"             element={<ProjetosEV />} />
        <Route path="projetos-ev/:id"         element={<ProjetosEVDetalhes />} />
        <Route path="homologacao"             element={<Homologacao />} />
        <Route path="catalogo"                element={<Catalogo />} />
        <Route path="configuracoes"           element={<Configuracoes />} />
        <Route path="equipamentos/modulos"         element={<Modulos />} />
        <Route path="equipamentos/inversores"      element={<Inversores />} />
        <Route path="equipamentos/carregadores-ev" element={<CarregadoresEV />} />
        <Route path="equipamentos/baterias"        element={<Baterias />} />
        <Route path="admin/catalogo/qualidade"     element={<AdminCatalogoQualidade />} />
        <Route path="kits/recomendar"              element={<RecomendacaoKits />} />
      </Route>
    </Routes>
  )
}
