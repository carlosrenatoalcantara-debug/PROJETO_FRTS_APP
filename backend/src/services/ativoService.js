/**
 * ativoService.js — P1-ASSET-CORE-01 (FASE 2 + FASE 4)
 *
 * Geração de ativos (Gêmeo Digital) a partir de um ProjetoFV, reusando a normalização
 * de arranjos (P1-MULTIINVERSOR) — funciona igual para projetos novos e legados.
 *
 * Regras (modo CORE / otimizado):
 *   - MÓDULOS: 1 ativo AGREGADO por (arranjo × modelo), com `quantidade = N`.
 *     (evita explosão de milhares de registros; individualização fica para O&M).
 *   - INVERSOR / MICRO / OTIMIZADOR: 1 ativo por UNIDADE (loop sobre `quantidade`).
 *   - BESS: 1 ativo por UNIDADE de bateria.
 *   - CARREGADOR EV: 1 ativo (se presente no arranjo).
 *
 * Idempotente: cada ativo recebe uma `chave_origem` determinística; a re-execução
 * NÃO cria duplicatas (índice único parcial + verificação prévia).
 */
import { AtivoEquipamento } from '../models/AtivoEquipamento.js'
import { Contador } from '../models/Contador.js'
import { normalizarArranjos } from './arranjosService.js'

// tipo do ativo → código de 3 letras do QR
const TIPO3 = {
  modulo: 'MOD', inversor: 'INV', microinversor: 'MICRO',
  otimizador: 'OTIM', bess: 'BESS', carregador: 'CARR',
}

/** Mapeia o `tipo` de um inversor do arranjo para o `tipo` do ativo. */
function tipoAtivoInversor(inv) {
  const t = (inv?.tipo || '').toLowerCase()
  if (/micro/.test(t)) return 'microinversor'
  if (/otimiz|optimi/.test(t)) return 'otimizador'
  return 'inversor'
}

/** Gera o próximo QR institucional FORTE-<TIPO3>-<SEQ6> (atômico, único). */
export async function gerarQrCode(tipoAtivo) {
  const cod = TIPO3[tipoAtivo] || 'GEN'
  const seq = await Contador.proximo(`qr_${cod}`)
  return `FORTE-${cod}-${String(seq).padStart(6, '0')}`
}

function normModelo(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Constrói as ESPECIFICAÇÕES dos ativos (sem tocar o banco) a partir do projeto.
 * Cada spec traz `chave_origem` determinística para idempotência.
 * @returns {Array<object>}
 */
export function montarSpecsAtivos(projeto) {
  const arranjos = normalizarArranjos(projeto)
  const projetoId = projeto._id?.toString() || projeto.id
  const clienteId = projeto.clienteId || projeto.cliente_id || null
  const specs = []

  for (const arr of arranjos) {
    const arrId = arr.id
    const topo = arr.topologia || null

    // Módulos — 1 ativo agregado por modelo
    for (const p of (arr.paineis || [])) {
      const qtd = Number(p.quantidade) || 0
      if (qtd <= 0 && !(p.marca || p.modelo)) continue
      specs.push({
        projeto_id: projetoId, arranjo_id: arrId, cliente_id: clienteId,
        equipamento_id: p.equipamento_id || null,
        tipo: 'modulo',
        fabricante: p.fabricante || p.marca || null,
        modelo: p.modelo || null,
        quantidade: qtd || 1,
        topologia: topo,
        chave_origem: `${projetoId}:${arrId}:modulo:${normModelo(p.modelo)}`,
      })
    }

    // Inversores — 1 ativo por unidade
    for (const inv of (arr.inversores || [])) {
      const tipoAtivo = tipoAtivoInversor(inv)
      const unidades = Math.max(1, Number(inv.quantidade) || 1)
      for (let i = 1; i <= unidades; i++) {
        specs.push({
          projeto_id: projetoId, arranjo_id: arrId, cliente_id: clienteId,
          equipamento_id: inv.equipamento_id || null,
          tipo: tipoAtivo,
          fabricante: inv.fabricante || inv.marca || null,
          modelo: inv.modelo || null,
          quantidade: 1,
          topologia: topo,
          chave_origem: `${projetoId}:${arrId}:${tipoAtivo}:${normModelo(inv.modelo)}:${i}`,
        })
      }
    }

    // BESS — 1 ativo por unidade de bateria
    for (const b of (arr.baterias || [])) {
      const unidades = Math.max(1, Number(b.quantidade) || 1)
      for (let i = 1; i <= unidades; i++) {
        specs.push({
          projeto_id: projetoId, arranjo_id: arrId, cliente_id: clienteId,
          equipamento_id: b.equipamento_id || null,
          tipo: 'bess',
          fabricante: b.fabricante || b.marca || null,
          modelo: b.modelo || null,
          quantidade: 1,
          topologia: topo || 'bess',
          observacoes: b.capacidade_kwh ? `${b.capacidade_kwh} kWh` : null,
          chave_origem: `${projetoId}:${arrId}:bess:${normModelo(b.modelo)}:${i}`,
        })
      }
    }

    // Carregador EV (se o arranjo trouxer)
    for (const c of (arr.carregadores || [])) {
      specs.push({
        projeto_id: projetoId, arranjo_id: arrId, cliente_id: clienteId,
        equipamento_id: c.equipamento_id || null,
        tipo: 'carregador',
        fabricante: c.fabricante || c.marca || null,
        modelo: c.modelo || null,
        quantidade: 1, topologia: topo,
        chave_origem: `${projetoId}:${arrId}:carregador:${normModelo(c.modelo)}`,
      })
    }
  }
  return specs
}

/**
 * Gera (persiste) os ativos de um projeto. Idempotente.
 * @param {object} projeto  ProjetoFV (lean ou hidratado)
 * @param {{usuario?:string, dry_run?:boolean}} opts
 * @returns {Promise<{criados:number, existentes:number, total_specs:number, ativos:Array, por_tipo:object}>}
 */
export async function gerarAtivosProjeto(projeto, opts = {}) {
  const { usuario = 'sistema', dry_run = false } = opts
  const specs = montarSpecsAtivos(projeto)

  const por_tipo = {}
  const ativos = []
  let criados = 0, existentes = 0

  for (const spec of specs) {
    por_tipo[spec.tipo] = (por_tipo[spec.tipo] || 0) + 1

    // idempotência: já existe por chave_origem?
    const jaExiste = await AtivoEquipamento.findOne({ chave_origem: spec.chave_origem }).lean()
    if (jaExiste) { existentes++; ativos.push(jaExiste); continue }

    if (dry_run) { ativos.push({ ...spec, qr_code: '(dry-run)' }); criados++; continue }

    const qr_code = await gerarQrCode(spec.tipo)
    const doc = await AtivoEquipamento.create({
      ...spec,
      qr_code,
      status: 'planejado',
      historico: [{ tipo: 'criacao', usuario, descricao: `Ativo gerado a partir do projeto (arranjo ${spec.arranjo_id})` }],
    })
    criados++
    ativos.push(doc.toObject())
  }

  return { criados, existentes, total_specs: specs.length, por_tipo, ativos }
}
