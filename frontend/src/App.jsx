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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/calculadora" element={<Calculadora />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"               element={<Dashboard />} />
        <Route path="clientes"                element={<Clientes />} />
        <Route path="clientes/:clienteId"     element={<ClienteGerenciamento />} />
        <Route path="propostas/nova"          element={<NovaProposta />} />
        <Route path="propostas-ev/nova"       element={<NovaPropostaEV />} />
        <Route path="projetos-fv"             element={<ProjetosFV />} />
        <Route path="projetos-fv/novo"        element={<ProjetosFVNovo />} />
        <Route path="projetos-fv/simulacao"   element={<SimulacaoFV />} />
        <Route path="projetos-fv/:id"         element={<ProjetosFVDetalhes />} />
        <Route path="financeiro"              element={<SimulacaoFinanceira />} />
        <Route path="comparacao-bess"         element={<ComparacaoBESS />} />
        <Route path="crm"                     element={<CRM />} />
        <Route path="projetos-ev"             element={<ProjetosEV />} />
        <Route path="homologacao"             element={<Homologacao />} />
        <Route path="catalogo"                element={<Catalogo />} />
        <Route path="configuracoes"           element={<Configuracoes />} />
        <Route path="equipamentos/modulos"         element={<Modulos />} />
        <Route path="equipamentos/inversores"      element={<Inversores />} />
        <Route path="equipamentos/carregadores-ev" element={<CarregadoresEV />} />
        <Route path="equipamentos/baterias"        element={<Baterias />} />
      </Route>
    </Routes>
  )
}
