/**
 * SeletorInversores.jsx — Sprint 2
 *
 * Tipos: String | Híbrido | Microinversor | Off-Grid | Otimizador
 * Exibe: MPPTs, Vmáx, Imáx CA, oversizing, entradas por MPPT
 * Puxa dados elétricos do catalogoEletrico para exibição e propagação
 */
import { useState, useEffect } from 'react'
import { AlertCircle, Lock, Database, AlertTriangle } from 'lucide-react'
import { DADOS_ELETRICOS_INVERSORES } from '../../data/catalogoEletrico'
import { buscarEquipamentosEngenharia, registrarFallback } from '../../services/catalogoEngenhariaApi'
import { agruparInversores } from '../../utils/catalogoEngenhariaAdapter'
import { obterFlags } from '../../services/catalogoFlags'  // CAT-P0-UNIFY
import { usePermissao } from '../../hooks/usePermissao'

// ─── Catálogo de inversores ───────────────────────────────────────────────────
// Estrutura: tipo → marca → fase → [modelos]

const INVERSORES_DATA = {
  string: {
    Fronius: {
      monofasico: [
        { id: 'fr5',  modelo: 'Primo 5.0-1',      potenciaKW: 5,    nMppts: 2, garantia: 10, precoUnitario: 5500  },
        { id: 'fr8',  modelo: 'Primo 8.2-1',      potenciaKW: 8.2,  nMppts: 2, garantia: 10, precoUnitario: 7200  },
      ],
      trifasico: [
        { id: 'fr20', modelo: 'Symo 20.0-3-M',    potenciaKW: 20,   nMppts: 3, garantia: 10, precoUnitario: 12000 },
        { id: 'fr25', modelo: 'Symo 25.0-3-M',    potenciaKW: 25,   nMppts: 3, garantia: 10, precoUnitario: 15000 },
      ],
    },
    Sungrow: {
      monofasico: [
        { id: 'sg5',  modelo: 'SG5.0RS',          potenciaKW: 5,    nMppts: 2, garantia: 10, precoUnitario: 3800  },
        { id: 'sg8',  modelo: 'SG8.0RS',          potenciaKW: 8,    nMppts: 2, garantia: 10, precoUnitario: 5200  },
        { id: 'sg10', modelo: 'SG10RS',           potenciaKW: 10,   nMppts: 2, garantia: 10, precoUnitario: 5800  },
      ],
      trifasico: [
        { id: 'sg15t', modelo: 'SG15RT',          potenciaKW: 15,   nMppts: 3, garantia: 10, precoUnitario: 8000  },
        { id: 'sg25t', modelo: 'SG25RT',          potenciaKW: 25,   nMppts: 3, garantia: 10, precoUnitario: 11000 },
      ],
    },
    Growatt: {
      monofasico: [
        { id: 'gw5s', modelo: 'MID 5000TL-X',    potenciaKW: 5,    nMppts: 2, garantia: 5,  precoUnitario: 2800  },
      ],
      trifasico: [
        { id: 'gw5t',  modelo: 'MOD 5000TL3-LV', potenciaKW: 5,    nMppts: 2, garantia: 5,  precoUnitario: 3200  },
        { id: 'gw10t', modelo: 'MOD 10000TL3-X', potenciaKW: 10,   nMppts: 2, garantia: 5,  precoUnitario: 4800  },
      ],
    },
    Deye: {
      monofasico: [
        { id: 'dy8',  modelo: 'SUN-8K-SG01LP1',  potenciaKW: 8,    nMppts: 2, garantia: 5,  precoUnitario: 4200  },
      ],
      trifasico: [
        { id: 'dy12t', modelo: 'SUN-12K-SG',     potenciaKW: 12,   nMppts: 3, garantia: 5,  precoUnitario: 6000  },
      ],
    },
    ABB: {
      monofasico: [
        { id: 'abb4', modelo: 'UNO-DM-4.6-TL-PLUS', potenciaKW: 4.6, nMppts: 1, garantia: 10, precoUnitario: 4500 },
      ],
      trifasico: [],
    },
    WEG: {
      monofasico: [],
      trifasico: [
        { id: 'weg6',  modelo: 'SIW500H TL 6kW',  potenciaKW: 6,  nMppts: 2, garantia: 5, precoUnitario: 4800  },
        { id: 'weg12', modelo: 'SIW500H TL 12kW', potenciaKW: 12, nMppts: 3, garantia: 5, precoUnitario: 8500  },
      ],
    },
  },

  hibrido: {
    Sungrow: {
      monofasico: [
        { id: 'sh5',  modelo: 'SH5.0RS',          potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 6800  },
        { id: 'sh8',  modelo: 'SH8.0RS',          potenciaKW: 8,  nMppts: 2, garantia: 10, precoUnitario: 8500  },
        { id: 'sh10', modelo: 'SH10RS',           potenciaKW: 10, nMppts: 2, garantia: 10, precoUnitario: 9500  },
      ],
      trifasico: [
        { id: 'sh15t', modelo: 'SH15T',           potenciaKW: 15, nMppts: 3, garantia: 10, precoUnitario: 15000 },
      ],
    },
    Growatt: {
      monofasico: [
        { id: 'sph5', modelo: 'SPH 5000TL BL-UP', potenciaKW: 5,  nMppts: 2, garantia: 5,  precoUnitario: 5200  },
        { id: 'sph8', modelo: 'SPH 8000TL BL-UP', potenciaKW: 8,  nMppts: 2, garantia: 5,  precoUnitario: 6800  },
      ],
      trifasico: [],
    },
    Deye: {
      monofasico: [
        { id: 'dh5', modelo: 'SUN-5K-SG04LP1',    potenciaKW: 5,  nMppts: 2, garantia: 5,  precoUnitario: 5500  },
        { id: 'dh8', modelo: 'SUN-8K-SG04LP1',    potenciaKW: 8,  nMppts: 2, garantia: 5,  precoUnitario: 7200  },
      ],
      trifasico: [
        { id: 'dh12t', modelo: 'SUN-12K-SG04LP3', potenciaKW: 12, nMppts: 3, garantia: 5,  precoUnitario: 11000 },
      ],
    },
    Goodwe: {
      monofasico: [
        { id: 'gw5h',  modelo: 'GW5K-ET',         potenciaKW: 5,  nMppts: 2, garantia: 10, precoUnitario: 6500  },
        { id: 'gw10h', modelo: 'GW10K-ET',        potenciaKW: 10, nMppts: 2, garantia: 10, precoUnitario: 9000  },
      ],
      trifasico: [],
    },
    Sofar: {
      monofasico: [
        { id: 'sf6h', modelo: 'HYD6000-ES',       potenciaKW: 6,  nMppts: 2, garantia: 10, precoUnitario: 6000  },
      ],
      trifasico: [],
    },
  },

  micro: {
    APsystems: {
      monofasico: [
        { id: 'aps400', modelo: 'EZ1-M 400W',     potenciaKW: 0.4,   nMppts: 1, garantia: 10, precoUnitario: 800  },
        { id: 'aps800', modelo: 'EZ1-M 800W',     potenciaKW: 0.8,   nMppts: 2, garantia: 10, precoUnitario: 1200 },
      ],
      trifasico: [],
    },
    Enphase: {
      monofasico: [
        { id: 'enph',   modelo: 'IQ8M',           potenciaKW: 0.366, nMppts: 1, garantia: 25, precoUnitario: 1400 },
        { id: 'enph8a', modelo: 'IQ8A',           potenciaKW: 0.384, nMppts: 1, garantia: 25, precoUnitario: 1500 },
      ],
      trifasico: [],
    },
  },

  'off-grid': {
    Victron: {
      monofasico: [
        { id: 'vic24_3', modelo: 'MultiPlus-II 24/3000/70', potenciaKW: 3, nMppts: 1, garantia: 5, precoUnitario: 4500 },
        { id: 'vic48_5', modelo: 'MultiPlus-II 48/5000/70', potenciaKW: 5, nMppts: 1, garantia: 5, precoUnitario: 7000 },
      ],
      trifasico: [],
    },
    Growatt: {
      monofasico: [
        { id: 'ofg3', modelo: 'OFF3000-19B',      potenciaKW: 3, nMppts: 1, garantia: 5, precoUnitario: 3200 },
        { id: 'ofg5', modelo: 'OFF5000-19B',      potenciaKW: 5, nMppts: 1, garantia: 5, precoUnitario: 4200 },
      ],
      trifasico: [],
    },
    Deye: {
      monofasico: [
        { id: 'dof5', modelo: 'SUN-5K-SG01LP1-EU', potenciaKW: 5, nMppts: 2, garantia: 5, precoUnitario: 4800 },
      ],
      trifasico: [],
    },
  },

  otimizador: {
    SolarEdge: {
      monofasico: [
        { id: 'se5k',  modelo: 'SE5000H HD-Wave',  potenciaKW: 5,   nMppts: 1, garantia: 12, precoUnitario: 8500  },
        { id: 'se7k',  modelo: 'SE7600H HD-Wave',  potenciaKW: 7.6, nMppts: 1, garantia: 12, precoUnitario: 10500 },
      ],
      trifasico: [
        { id: 'se20k', modelo: 'SE20K 3-Phase',    potenciaKW: 20,  nMppts: 1, garantia: 12, precoUnitario: 18000 },
      ],
    },
  },
}

const TIPO_ROTULOS = {
  string:     'String',
  hibrido:    'Híbrido (c/ bateria)',
  micro:      'Microinversor',
  'off-grid': 'Off-Grid',
  otimizador: 'Otimizador',
}

const TIPO_CORES = {
  string:     'border-blue-500 bg-blue-50 text-blue-700',
  hibrido:    'border-emerald-500 bg-emerald-50 text-emerald-700',
  micro:      'border-violet-500 bg-violet-50 text-violet-700',
  'off-grid': 'border-slate-500 bg-slate-100 text-slate-700',
  otimizador: 'border-orange-500 bg-orange-50 text-orange-700',
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SeletorInversores({ onSelecionar, selecionado }) {
  const [tipo,  setTipo]  = useState(selecionado?.tipo  ?? '')
  const [marca, setMarca] = useState(selecionado?.marca ?? '')
  const [rede,  setRede]  = useState('')

  // S8.1: catálogo Mongo como fonte; INVERSORES_DATA vira contingência
  // CAT-P0-UNIFY (FASE 4): fallback INVERSORES_DATA respeita a flag
  // ENABLE_INVERSORES_DATA. Com a flag OFF, catálogo vazio → vazio de verdade
  // (não mostra os inversores hardcoded). Inicia vazio até saber a flag.
  const [dataset, setDataset] = useState({})
  const [fonte, setFonte] = useState('carregando')
  const [incluirBloqueados, setIncluirBloqueados] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([
      buscarEquipamentosEngenharia('inversor', incluirBloqueados).catch((e) => { registrarFallback('inversor', e.message); return null }),
      obterFlags(),
    ])
      .then(([eqs, flags]) => {
        if (!vivo) return
        if (Array.isArray(eqs) && eqs.length > 0) {
          setDataset(agruparInversores(eqs)); setFonte('catalogo')
        } else if (flags?.ENABLE_INVERSORES_DATA) {
          setDataset(INVERSORES_DATA); setFonte('local')
        } else {
          // Flag OFF + catálogo vazio → catálogo realmente vazio
          setDataset({}); setFonte('vazio')
        }
      })
    return () => { vivo = false }
  }, [incluirBloqueados])

  // S8.1.1: em contingência, só Admin/Diretor operam
  const { perfil, anonimo } = usePermissao()
  const podeContingencia = anonimo || ['administrador', 'diretor', 'admin'].includes(perfil)
  const contingenciaBloqueada = fonte === 'local' && !podeContingencia

  const marcas  = tipo  ? Object.keys(dataset[tipo] ?? {}) : []
  const redes   = marca ? Object.keys(dataset[tipo]?.[marca] ?? {}) : []
  const modelos = (marca && rede) ? (dataset[tipo]?.[marca]?.[rede] ?? []) : []

  function handleSelect(inv) {
    if (inv.utilizavel_em_projeto === false) {
      alert(`Inversor não liberado para engenharia.\nFalta: ${(inv.bloqueio_engenharia || []).join(', ') || 'dados técnicos'}.`)
      return
    }
    // S8.1: dados elétricos inline (catálogo) têm prioridade sobre a base local
    const eletrico = inv._eletrico ?? DADOS_ELETRICOS_INVERSORES[inv.id] ?? null
    onSelecionar({
      id:            inv.id,
      tipo,
      marca,
      fases:         rede === 'trifasico' ? 3 : 1,
      modelo:        inv.modelo,
      potenciaKW:    inv.potenciaKW,
      nMppts:        inv.nMppts,
      garantia:      inv.garantia,
      precoUnitario: inv.precoUnitario,
      // Dados elétricos do catálogo para validações em E7
      tensaoMaxV:    eletrico?.tensao_max_entrada ?? null,
      mpptMinV:      eletrico?.mppt_min           ?? null,
      mpptMaxV:      eletrico?.mppt_max           ?? null,
      correnteMaxA:  eletrico?.corrente_max_mppt  ?? null,
      oversizingMax: eletrico?.oversizing_max     ?? 1.30,
      entradasPorMppt: eletrico?.entradas_por_mppt ?? 1,
      // S8.1: proveniência (snapshot/unifilar/homologação futura)
      _fonte:            inv._fonte || 'local',
      _catalogo_original: inv._catalogo_original || null,
    })
  }

  if (contingenciaBloqueada) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl text-center space-y-2">
        <Lock size={28} className="text-red-500 mx-auto" />
        <p className="font-semibold text-red-800">Catálogo técnico temporariamente indisponível</p>
        <p className="text-sm text-red-700">Contate engenharia/administração. Apenas Admin/Diretor podem operar em modo de contingência.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2">

      {/* S8.1: fonte + contingência + bloqueados */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {fonte === 'catalogo'
          ? <span className="text-xs text-emerald-700 flex items-center gap-1"><Database size={13} /> Fonte: Catálogo Forte Solar ✓</span>
          : <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={13} /> Modo contingência — usando base local.</span>}
        <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={incluirBloqueados} onChange={e => setIncluirBloqueados(e.target.checked)} className="accent-blue-500" disabled={fonte !== 'catalogo'} />
          Mostrar equipamentos incompletos
        </label>
      </div>

      {/* Passo 1: Tipo */}
      <div>
        <h4 className="font-semibold text-slate-700 text-sm mb-2">Tipo de Inversor</h4>
        <div className="flex flex-wrap gap-2">
          {Object.keys(dataset).map(t => {
            const sel = tipo === t
            const cor = sel ? TIPO_CORES[t] : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            return (
              <button
                key={t}
                onClick={() => { setTipo(t); setMarca(''); setRede('') }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${cor}`}
              >
                {TIPO_ROTULOS[t]}
              </button>
            )
          })}
        </div>
        {tipo === 'otimizador' && (
          <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
            ⚡ Sistema com otimizador: cada módulo recebe um otimizador de potência (P300/P370/P404).
            O inversor HD-Wave gerencia o arranjo via comunicação digital.
          </p>
        )}
        {tipo === 'micro' && (
          <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mt-2">
            ⚡ Microinversor: um inversor por módulo (ou par de módulos). Configuração MPPT individual —
            ideal para telhados com sombreamento parcial.
          </p>
        )}
      </div>

      {/* Passo 2: Marca */}
      {tipo && (
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-2">Marca</h4>
          <div className="flex flex-wrap gap-2">
            {marcas.map(m => (
              <button
                key={m}
                onClick={() => { setMarca(m); setRede('') }}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  marca === m
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Passo 3: Fase */}
      {marca && (
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-2">Fase da Rede</h4>
          <div className="flex flex-wrap gap-3">
            {redes.map(r => {
              const temModelos = (dataset[tipo]?.[marca]?.[r]?.length ?? 0) > 0
              return (
                <label key={r} className={`flex items-center gap-2 cursor-pointer ${!temModelos ? 'opacity-40' : ''}`}>
                  <input
                    type="radio" name="rede-inv" value={r}
                    checked={rede === r}
                    onChange={e => setRede(e.target.value)}
                    className="w-4 h-4" disabled={!temModelos}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {r === 'monofasico' ? 'Monofásico' : 'Trifásico'}
                    {!temModelos && ' (indisponível)'}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Passo 4: Modelo */}
      {rede && modelos.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-2">Modelo</h4>
          <div className="grid grid-cols-1 gap-2">
            {modelos.map(inv => {
              const eletrico = inv._eletrico ?? DADOS_ELETRICOS_INVERSORES[inv.id] ?? null
              const sel = selecionado?.id === inv.id
              const bloqueado = inv.utilizavel_em_projeto === false
              return (
                <div
                  key={inv.id}
                  onClick={() => handleSelect(inv)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    bloqueado ? 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
                      : sel ? 'border-blue-500 bg-blue-50 shadow-sm cursor-pointer'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer'
                  }`}
                >
                  {bloqueado && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mb-1">
                      <Lock size={12} /> Não liberado — Falta: {(inv.bloqueio_engenharia || []).join(', ') || 'dados técnicos'}
                    </div>
                  )}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      {/* Linha 1: Modelo + potência */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{inv.modelo}</p>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                          {inv.potenciaKW} kW CA
                        </span>
                      </div>

                      {/* Linha 2: Parâmetros elétricos (catálogo) */}
                      {eletrico ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-xs border-t border-slate-100 pt-2">
                          <InvParam label="MPPTs"       valor={`${inv.nMppts}`}                />
                          <InvParam label="Vmáx CC"     valor={`${eletrico.tensao_max_entrada} V`} />
                          <InvParam label="Imáx/MPPT"   valor={`${eletrico.corrente_max_mppt} A`} />
                          <InvParam label="Vmpp mín"    valor={`${eletrico.mppt_min} V`}          />
                          <InvParam label="Vmpp máx"    valor={`${eletrico.mppt_max} V`}          />
                          <InvParam label="Oversizing"  valor={`${((eletrico.oversizing_max ?? 1.30) * 100).toFixed(0)}%`} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <InvParam label="MPPTs"   valor={`${inv.nMppts}`}     />
                          <InvParam label="Garantia" valor={`${inv.garantia} anos`} />
                        </div>
                      )}

                      {/* Linha 3: Preço */}
                      <div className="mt-2 text-right text-xs text-emerald-700 font-medium">
                        ≈ R$ {inv.precoUnitario.toLocaleString('pt-BR')}
                      </div>
                    </div>
                    {sel && <span className="text-blue-600 font-bold ml-2 shrink-0">✓</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {rede && modelos.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          Nenhum modelo disponível para esta combinação. Escolha outra fase ou marca.
        </div>
      )}
    </div>
  )
}

function InvParam({ label, valor }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{valor}</p>
    </div>
  )
}
