/**
 * FvPadroesConfig.jsx — padrões do módulo FV da empresa.
 * Eficiência padrão (%) com que um projeto NOVO nasce. Não altera projeto salvo.
 */
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import Card, { CardHeader, CardBody } from '../ui/Card'
import Button from '../ui/Button'
import { buscarFvPadroes, salvarFvPadroes } from '../../services/fvPadroesApi'
import {
  EFICIENCIA_FALLBACK, EFICIENCIA_MIN, EFICIENCIA_MAX,
} from '../../utils/eficienciaPadrao'

const pct = (f) => String(Math.round(f * 100))

export default function FvPadroesConfig() {
  const [valor, setValor] = useState('')       // em %, texto do input
  const [configurada, setConfigurada] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    buscarFvPadroes()
      .then(({ eficiencia_padrao: e }) => {
        if (e !== null) { setValor(pct(e)); setConfigurada(true) }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const n = valor.trim() === '' ? null : Number(valor)
  const invalido = n !== null
    && (!Number.isFinite(n) || n < EFICIENCIA_MIN * 100 || n > EFICIENCIA_MAX * 100)

  async function salvar(limpar = false) {
    setSalvando(true); setErro(null); setSalvo(false)
    try {
      await salvarFvPadroes({ eficiencia_padrao: limpar || n === null ? null : n / 100 })
      if (limpar || n === null) { setValor(''); setConfigurada(false) } else setConfigurada(true)
      setSalvo(true)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-900">Padrões do módulo FV</h2>
      </CardHeader>
      <CardBody>
        <label className="block text-sm text-slate-700" htmlFor="fv-eficiencia-padrao">
          Eficiência padrão do sistema (%)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="fv-eficiencia-padrao" type="number" min={EFICIENCIA_MIN * 100} max={EFICIENCIA_MAX * 100} step="1"
            value={valor} disabled={carregando}
            placeholder={pct(EFICIENCIA_FALLBACK)}
            onChange={(e) => { setValor(e.target.value); setSalvo(false) }}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <span className="text-sm text-slate-500">entre {EFICIENCIA_MIN * 100} e {EFICIENCIA_MAX * 100}</span>
          <Button icone={Save} tamanho="sm" onClick={() => salvar(false)} disabled={salvando || invalido || n === null}>
            Salvar
          </Button>
          {configurada && (
            <Button variante="secundario" tamanho="sm" onClick={() => salvar(true)} disabled={salvando}>
              Voltar ao padrão do sistema
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fator da geração estimada (HSP × 30 × eficiência). Vale para projetos NOVOS; projeto
          já salvo mantém o valor dele e continua ajustável por projeto.{' '}
          {configurada
            ? 'Padrão definido pela empresa.'
            : `Nenhum padrão configurado: o sistema usa ${pct(EFICIENCIA_FALLBACK)}%.`}
        </p>
        {invalido && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            Informe um valor entre {EFICIENCIA_MIN * 100} e {EFICIENCIA_MAX * 100}.
          </p>
        )}
        {erro && <p role="alert" className="mt-1 text-xs text-red-600">{erro}</p>}
        {salvo && <p className="mt-1 text-xs text-emerald-700">Padrão salvo.</p>}
      </CardBody>
    </Card>
  )
}
