import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import F1Conta from '../components/fv/funilv2/F1Conta'

/**
 * Shell do Funil v2 — orquestra as 4 fases (Pré-projeto → Engenharia → Comercial → Execução).
 *
 * Acessível via /propostas/nova?wizard=v2 (controlado pelo wrapper em NovaProposta.jsx).
 * Sprint 2 entrega APENAS a Fase 1 (Conta de energia). Demais fases serão liberadas
 * em sprints subsequentes.
 *
 * Estado é em memória — usuário pode navegar entre fases sem perder dados.
 * Após a Fase 1, projeto já está persistido (status=rascunho).
 */
export default function NovaPropostaV2() {
  const navigate = useNavigate()
  const [faseAtual, setFaseAtual] = useState(1)
  const [projeto, setProjeto] = useState(null)

  const fases = [
    { num: 1, nome: 'Conta de energia', habilitada: true },
    { num: 2, nome: 'Engenharia',      habilitada: false, sprint: 'S3' },
    { num: 3, nome: 'Comercial',       habilitada: false, sprint: 'S4-S5' },
    { num: 4, nome: 'Execução',        habilitada: false, sprint: 'S6-S7' },
  ]

  function aoConcluirF1(payload) {
    setProjeto(payload.projeto)
    setFaseAtual(2)  // mostra placeholder de "próxima fase virá em sprint"
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Proposta — Funil v2</h1>
          <p className="text-sm text-slate-500">Versão beta. Voltar ao <a href="/propostas/nova" className="text-blue-600 underline">funil clássico</a>.</p>
        </div>
      </div>

      {/* Stepper das fases */}
      <div className="flex items-center gap-2 mb-2">
        {fases.map((f, i) => (
          <div key={f.num} className="flex items-center gap-2 flex-1">
            <div className={`flex flex-col items-center flex-1 ${
              faseAtual > f.num ? 'opacity-100' : (faseAtual === f.num ? 'opacity-100' : 'opacity-50')
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                faseAtual > f.num ? 'bg-emerald-500 text-white' :
                faseAtual === f.num ? 'bg-orange-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {faseAtual > f.num ? <CheckCircle size={18} /> : f.num}
              </div>
              <div className="text-xs mt-1 text-center text-slate-700">{f.nome}</div>
              {!f.habilitada && <div className="text-[10px] text-slate-400">({f.sprint})</div>}
            </div>
            {i < fases.length - 1 && (
              <div className={`h-0.5 flex-1 ${faseAtual > f.num ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo da fase atual */}
      {faseAtual === 1 && <F1Conta onConcluido={aoConcluirF1} />}

      {faseAtual === 2 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <h2 className="font-bold text-amber-900">✓ Projeto criado: {projeto?.nome}</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-700 mb-4">
              <strong>Fase 1 (Conta de energia) concluída.</strong> O projeto foi salvo com
              dimensionamento automático e está em status <code className="px-1.5 py-0.5 bg-white rounded text-xs">rascunho</code>.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              <strong>Próximas fases</strong> (Engenharia, Comercial, Execução) serão liberadas
              nas próximas sprints. Por enquanto, você pode prosseguir editando o projeto pelo
              fluxo clássico ou criar outro projeto.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/projetos-fv/${projeto?._id}`)}>
                Ver projeto criado
              </Button>
              <Button variante="secundario" onClick={() => { setProjeto(null); setFaseAtual(1) }}>
                Importar outra conta
              </Button>
              <Button variante="fantasma" onClick={() => navigate('/projetos-fv')}>
                Voltar à lista
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
