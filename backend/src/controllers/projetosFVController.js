import { ProjetoFV, FREEZE_STATUS, FREEZE_STATUS_TRAVADOS, ehFreezeStatusValido } from '../models/ProjetoFV.js'
// FV-UX-006 (F3.1): máquina de estados do Projeto FV — fonte única.
import {
  ESTADOS_CONGELADOS as CONGELADOS_COMERCIAL, TRANSICOES_FREEZE,
  statusJuridicoDeEstado, validarTransicaoComercial, normalizarFreezeLegado,
} from '@fortesolar/fv-shared/estados'
import { Equipamento } from '../models/Equipamento.js'
import { Tecnico } from '../models/Tecnico.js'
import mongoose from 'mongoose'
import { memoryStore } from '../config/memoryStorage.js'
import { montarSnapshotRT } from '../utils/snapshotRT.js'
import { montarArranjosAmpliacao, composicaoDoProjeto, garantirIdentidade } from '../services/arranjosService.js'
import { obterLocalProjeto } from '../dominio/local/index.js'
// FV-UX-038 (D2): regra da estrutura no domínio, não só na interface.
import { validarEstrutura } from '../dominio/estrutura/index.js'
// FV-DOM-002: convergência do domínio comercial para Cotacao/Orcamento/Baseline.
import { obterOrcamentoProjeto, totaisDeItens } from '../dominio/orcamento/obterOrcamentoProjeto.js'
import { OrcamentoService } from '../services/OrcamentoService.js'
// FV-UX-035 — envio da proposta e regra única de aceite (pública e interna).
import { EnvioPropostaService } from '../services/EnvioPropostaService.js'
import {
  exigirAceitavel, montarEvidenciaAceite, avaliarEnvio, ehEnvioCanonico,
  envioVigente, ErroProposta, MOTIVOS_PROPOSTA,
} from '../dominio/proposta/index.js'
// FV-DOM-042 — Parecer de Acesso: normalização, validação e conflito no domínio.
import {
  montarEnvelope, confirmar as confirmarParecer, compararComCanonico,
  ErroParecer, MOTIVOS_PARECER,
} from '../dominio/parecer/index.js'
// FV-DOM-047 — lê o estado da opção pelo MESMO domínio que o Gate usa. Só
// leitura: o Gate não é alterado nem passa a saber que conexão existe.
import { estadoDaOpcao } from '../dominio/gate/index.js'
// FV-DOM-047 — conexão física da usina: fato, não máquina de estado.
import {
  conexaoVazia, estaConectada, normalizarConexao, exigirRegistroValido,
  avaliarDivergencia, exigirOpcaoEscolhida, lacunasDaConexao, ErroConexao,
} from '../dominio/conexao/index.js'
import { resolverCongelamento } from '../dominio/congelamento/resolverCongelamento.js'
// S3: camada de acesso ÚNICA à topologia (Instalação → nova; senão → Arranjo).
// Proibido ler projeto.arranjos direto fora deste adapter.
import { obterTopologiaProjeto } from '../dominio/topologia/index.js'
import { arranjosCanonicos } from '../dominio/topologia/arranjosCanonicos.js'
// Fase 0.5 — M-4: escopo de organização (ponto único).
// `carimbarTenant` faltava neste import: `criarProjetoFV`, `duplicarProjetoFV` e
// `ampliarProjetoFV` já o usavam, e as três estouravam ReferenceError em runtime.
// Defeito pré-existente, encontrado ao exercitar a criação pela nova UX (FV-UX-014).
import { aplicarEscopo, exigirTenant, tenantDoReq, carimbarTenant } from '../dominio/tenancy/index.js'
import {
  derivarStatusSeguro, paraModel, podeExcluirDefinitivo, avaliarLegacy, MOTIVOS_ARQUIVAMENTO, STATUS,
} from '../utils/statusLifecycle.js'
import { AuditLog } from '../models/AuditLog.js'
// FV-INFRA-058: origem pública pela fonte única.
import { urlPublica } from '../config/origens.js'

// S8.4 — auditoria de ciclo de vida (reaproveita AuditLog; nunca quebra a request)
async function auditarCiclo(req, acao, projetoId, detalhe = null) {
  try {
    if (mongoose.connection.readyState !== 1) return
    await AuditLog.create({
      timestamp: new Date(), usuario: req.auth?.id || req.auth?.email || req.body?.usuario || 'anonymous',
      perfil: req.auth?.perfil || null, empresa: req.auth?.empresa_id || null,
      modulo: 'fv', acao, metodo: 'EVENT',
      path: `projeto:${projetoId}${detalhe ? ' ' + String(detalhe).slice(0, 240) : ''}`, status: 200,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    })
  } catch { /* silencioso */ }
}

// S8.4 — enriquece o projeto com derivados não-persistidos (status_display, legacy)
function enriquecer(p) {
  if (!p) return p
  const obj = typeof p.toObject === 'function' ? p.toObject() : { ...p }
  const av = avaliarLegacy(obj)
  obj.status_display = derivarStatusSeguro(obj)
  obj.legacy = obj.legacy || av.legacy
  obj.necessita_revisao = obj.necessita_revisao || av.necessita_revisao
  obj.legacy_motivos = av.motivos
  obj.pode_excluir_definitivo = podeExcluirDefinitivo(obj)
  return obj
}

export const listarProjetosFV = async (req, res) => {
  try {
    let projetos
    // S8.4: por padrão esconde excluídos; ?incluir_excluidos=1 mostra (lixeira).
    const incluirExcluidos = ['1', 'true', 'yes'].includes(String(req?.query?.incluir_excluidos || '').toLowerCase())
    const incluirArquivados = ['1', 'true', 'yes'].includes(String(req?.query?.incluir_arquivados || '1').toLowerCase()) // default mostra arquivados
    // Fase 0.5 — M-4: escopo de organização vem do TOKEN, nunca de query string.
    // Removido o `$or:[{empresa_id},{empresa_id:null}]`, que vazava projetos de
    // empresa_id null para qualquer organização, e o fallback "sem filtro → todos".
    const filtro = aplicarEscopo({}, req, { contexto: 'listarProjetosFV' })
    if (!incluirExcluidos) filtro.excluido = { $ne: true }
    if (!incluirArquivados) filtro.status = { $ne: 'arquivado' }

    if (mongoose.connection.readyState === 1) {
      projetos = await ProjetoFV.find(filtro).populate('clienteId').sort({ createdAt: -1 })
    } else {
      // Memory storage fallback
      projetos = memoryStore.findAllProjetoFV().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      projetos = projetos.filter(p => incluirExcluidos || p.excluido !== true)
      projetos = projetos.map(p => ({ ...p, clienteId: memoryStore.findClienteById(p.clienteId) }))
    }
    // S8.4: enriquecer com status_display + legacy (não persiste; só leitura)
    const enriquecidos = projetos.map(enriquecer)
    console.log(`✓ GET /api/projetos-fv - Listando ${enriquecidos.length} projetos (excluidos=${incluirExcluidos})`)
    res.json(enriquecidos)
  } catch (err) {
    console.error('❌ Erro ao listar projetos FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const buscarProjetoFV = async (req, res) => {
  try {
    let p
    if (mongoose.connection.readyState === 1) {
      // S1.5: popula local_ref para que o agregado Local acompanhe a resposta.
      // Enquanto local_ref = null (pré-backfill), populate é no-op → resposta idêntica.
      p = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).populate('clienteId').populate('local_ref')
    } else {
      // Memory storage fallback
      p = memoryStore.findProjetoFV(req.params.id)
      if (p) {
        p = {
          ...p,
          clienteId: memoryStore.findClienteById(p.clienteId)
        }
      }
    }
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    // P1-MULTIINVERSOR (FASE 4/6): expõe arranjos normalizados + totais para os
    // consumidores (memorial, unifilar, parecer) lerem SEMPRE de arranjos[],
    // inclusive em projetos legados (derivação do equipamentos.inversor único).
    const base = enriquecer(p)
    const plano = typeof p.toObject === 'function' ? p.toObject() : p
    // S3: Instalação dormente → adapter delega a Arranjo (saída idêntica à atual).
    const topo = obterTopologiaProjeto(plano)
    base.arranjos_normalizados = topo.arranjos_normalizados
    base.totais = topo.totais
    // FV-UX-003 (F2): Local resolvido pelo adapter do Core. Antes o frontend
    // importava obterLocalProjeto direto de backend/src/dominio — o Core não sai
    // do backend. Derivado (INV-58): só na resposta, nunca persistido.
    base.local_resolvido = obterLocalProjeto(plano)
    // FV-DOM-002: o orçamento vem do agregado `Orcamento` (fonte operacional),
    // projetado na forma legada para não alterar a UX nesta sprint. Projetos
    // históricos, sem agregado, continuam devolvendo o subdoc como está.
    const orcVigente = await OrcamentoService.vigenteDoProjeto({
      projeto_ref: plano._id, empresa_id: tenantDoReq(req),
    })
    // FV-DOM-003: o agregado é exposto NA SUA FORMA PRÓPRIA. É daqui que a UX
    // passa a ler — não mais de `orcamento`, que é a projeção legada.
    base.orcamento_vigente = orcVigente
      ? {
          _id: orcVigente._id,
          estado: orcVigente.estado,
          numero: orcVigente.numero,
          versao: orcVigente.versao,
          cotacao_ref: orcVigente.cotacao_ref,
          baseline_ref: orcVigente.baseline_ref,
          itens: orcVigente.itens,
          condicoes: orcVigente.condicoes,
          totais: totaisDeItens(orcVigente.itens),
        }
      : null
    // @deprecated FV-DOM-003 — projeção legada mantida SÓ para os projetos
    // históricos que nunca passaram pelo agregado (7 em produção). Nenhum
    // consumidor funcional depende dela. Sai com o backfill (LME).
    base.orcamento = obterOrcamentoProjeto(plano, orcVigente)
    res.json(base)
  } catch (err) {
    console.error('❌ Erro ao buscar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// P1-PROJETO-AMPLIACAO-MULTIINVERSOR-IMPLEMENT-01 (FASE 4) — totais consolidados
export const totaisProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const p = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).lean()
    if (!p) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    const topo = obterTopologiaProjeto(p)
    res.json({
      sucesso: true,
      projeto_id: p._id,
      arranjos: topo.arranjos_normalizados,
      totais: topo.totais,
    })
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const criarProjetoFV = async (req, res) => {
  try {
    const {
      clienteId,
      nome,
      status,
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
    } = req.body

    if (!clienteId || !nome) {
      return res.status(400).json({ erro: 'Campos clienteId e nome são obrigatórios' })
    }

    console.log(`[DEBUG] criarProjetoFV: readyState=${mongoose.connection.readyState}, clienteId=${clienteId}`)

    // Se MongoDB está disponível, usar Mongoose
    if (mongoose.connection.readyState === 1) {
      // Validar que clienteId é um ObjectId válido
      if (!mongoose.Types.ObjectId.isValid(clienteId)) {
        return res.status(400).json({ erro: 'ClienteId inválido' })
      }

      const novo = new ProjetoFV(carimbarTenant({
        clienteId,
        nome,
        status: status || 'rascunho',
        endereco_completo: endereco_completo || '',
        latitude: latitude === undefined || latitude === null || latitude === '' ? null : Number(latitude),
        longitude: longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude),
        geocoding_origem: geocoding_origem || null,
        geocoding_confianca: geocoding_confianca !== undefined && geocoding_confianca !== null ? Number(geocoding_confianca) : null,
        geocodificado_em: geocodificado_em ? new Date(geocodificado_em) : null,
        irradiancia_local: 131.44,
      }, req, { contexto: 'projetoFV.criar' }))

      await novo.save()
      await novo.populate('clienteId')
      console.log('✓ Projeto FV criado:', novo._id)
      res.status(201).json(novo)
    } else {
      // Fallback para memory storage
      console.log('💾 Usando memory storage para criar projeto FV')

      // Validar que cliente existe em memory storage
      const cliente = memoryStore.findClienteById(clienteId)
      if (!cliente) {
        return res.status(404).json({ erro: 'Cliente não encontrado' })
      }

      const novo = memoryStore.createProjetoFV({
        clienteId,
        nome,
        status: status || 'rascunho',
        endereco_completo: endereco_completo || '',
        latitude: latitude === undefined || latitude === null || latitude === '' ? null : Number(latitude),
        longitude: longitude === undefined || longitude === null || longitude === '' ? null : Number(longitude),
        geocoding_origem: geocoding_origem || null,
        geocoding_confianca: geocoding_confianca !== undefined && geocoding_confianca !== null ? Number(geocoding_confianca) : null,
        geocodificado_em: geocodificado_em ? new Date(geocodificado_em) : null,
        irradiancia_local: 131.44,
      })

      console.log('✓ Projeto FV criado em memory storage:', novo._id)
      res.status(201).json({ ...novo, clienteId: cliente })
    }
  } catch (err) {
    console.error('❌ Erro ao criar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const atualizarProjetoFV = async (req, res) => {
  try {
    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findOneAndUpdate(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV.atualizar' }), req.body, { new: true }).populate('clienteId')
    } else {
      // Memory storage fallback
      projeto = memoryStore.updateProjetoFV(req.params.id, req.body)
      if (projeto) {
        projeto = {
          ...projeto,
          clienteId: memoryStore.findClienteById(projeto.clienteId)
        }
      }
    }
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    console.log('✓ Projeto FV atualizado:', req.params.id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao atualizar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * S8.4 — EXCLUIR. Regra:
 *  - Se rascunho + sem freeze + sem assinatura + sem documentos → HARD DELETE.
 *  - Senão → SOFT DELETE (excluido=true, fica preservado p/ histórico/auditoria).
 *  - ?definitivo=1 força tentativa de hard; rejeita se a regra não permite.
 */
export const excluirProjetoFV = async (req, res) => {
  try {
    const definitivo = ['1', 'true', 'yes'].includes(String(req.query?.definitivo || '').toLowerCase())
    if (mongoose.connection.readyState !== 1) {
      // Memory storage: soft delete não disponível → mantém comportamento legado
      const removido = memoryStore.deleteProjetoFV(req.params.id)
      if (!removido) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
      return res.status(204).end()
    }
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    if (podeExcluirDefinitivo(projeto)) {
      await ProjetoFV.findOneAndDelete(aplicarEscopo({ _id: projeto._id }, req, { contexto: 'projetoFV.excluir' }))
      auditarCiclo(req, 'PROJETO_EXCLUIDO', projeto._id, 'hard delete (regra ok)')
      return res.status(204).end()
    }
    if (definitivo) {
      return res.status(409).json({
        erro: 'Exclusão definitiva bloqueada (projeto possui freeze, assinatura ou documentos).',
        sugestao: 'Use arquivamento — preserva histórico.',
      })
    }
    // Soft delete
    projeto.excluido = true
    projeto.excluido_em = new Date()
    projeto.excluido_por = req.auth?.id || req.auth?.email || req.body?.usuario || null
    await projeto.save()
    auditarCiclo(req, 'PROJETO_EXCLUIDO', projeto._id, 'soft delete')
    res.json({ sucesso: true, soft: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao excluir projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * S8.4 — DUPLICAR. Copia cliente/consumo/localização/equipamentos/layout/dimensionamento.
 * Reseta: _id, freeze, assinaturas, auditoria, documentos congelados. Status: RASCUNHO.
 */
export const duplicarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const orig = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).lean()
    if (!orig) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (orig.excluido) return res.status(400).json({ erro: 'Não é possível duplicar projeto excluído.' })

    // Campos a NÃO copiar (resetar)
    const {
      _id, createdAt, updatedAt, __v,
      governanca, // contém freeze + assinaturas + auditoria + revisoes
      documentos, documentos_tecnicos,
      excluido, excluido_em, excluido_por,
      arquivado_em, arquivado_por, motivo_arquivamento,
      ...resto
    } = orig

    const copia = {
      ...resto,
      status: 'rascunho',
      excluido: false, excluido_em: null, excluido_por: null,
      arquivado_em: null, arquivado_por: null, motivo_arquivamento: null,
      legacy: false, necessita_revisao: false,
      // governança zerada (sem snapshots, sem assinaturas, sem revisões)
      governanca: null,
      // marca a origem na descrição (não-funcional)
      nome: `${resto.nome || 'Projeto'} (cópia)`,
    }
    const novo = await ProjetoFV.create(carimbarTenant(copia, req, { contexto: 'projetoFV.duplicar' }))
    auditarCiclo(req, 'PROJETO_DUPLICADO', novo._id, `origem=${_id}`)
    res.status(201).json({ sucesso: true, item: enriquecer(novo), origem: _id })
  } catch (err) {
    console.error('❌ Erro ao duplicar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// P1-UX-CORE-EVOLUTION-01 (FASE 4) — AMPLIAR USINA
// Clona um projeto aplicando Herança de Dados (fatura/consumo/concessionária/localização),
// congela o(s) arranjo(s) executado(s) como 'existente'/somente-leitura e abre um novo
// arranjo 'ampliacao' editável. O registro é marcado como tipo_projeto='ampliacao' e
// vinculado ao projeto-pai via projeto_origem_id.
export const ampliarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const orig = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).lean()
    if (!orig) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (orig.excluido) return res.status(400).json({ erro: 'Não é possível ampliar projeto excluído.' })

    // Campos a NÃO herdar (resetar para uma nova proposta limpa)
    const {
      _id, createdAt, updatedAt, __v,
      governanca, documentos, documentos_tecnicos,
      excluido, excluido_em, excluido_por,
      arquivado_em, arquivado_por, motivo_arquivamento,
      financeiro,                    // financeiro recalculado para a ampliação
      equipamentos,                  // arranjo único legado vira arranjo 'existente' congelado
      arranjos: _arranjosOrig,       // reconstruídos por montarArranjosAmpliacao
      ...heranca                     // fatura, consumo, concessionária, localização → herdados
    } = orig

    const arranjos = montarArranjosAmpliacao(orig)
    const nomeBase = (heranca.nome || 'Projeto').replace(/\s*\(cópia\)\s*$/i, '')

    const ampliacao = {
      ...heranca,
      nome: `Ampliação - ${nomeBase}`,
      tipo_projeto: 'ampliacao',
      projeto_origem_id: _id,
      status: 'rascunho',
      excluido: false, excluido_em: null, excluido_por: null,
      arquivado_em: null, arquivado_por: null, motivo_arquivamento: null,
      legacy: false, necessita_revisao: false,
      governanca: null,
      financeiro: null,
      // equipamentos legado fica vazio: o arranjo executado agora vive em arranjos[] (congelado)
      equipamentos: { paineis: [], inversor: {}, estrutura: equipamentos?.estrutura || {} },
      arranjos,
    }

    const novo = await ProjetoFV.create(carimbarTenant(ampliacao, req, { contexto: 'projetoFV.ampliar' }))
    auditarCiclo(req, 'PROJETO_AMPLIADO', novo._id, `origem=${_id} arranjos=${arranjos.length}`)
    res.status(201).json({
      sucesso: true,
      item: enriquecer(novo),
      origem: _id,
      arranjos_congelados: arranjos.filter(a => a.somente_leitura).length,
      arranjo_ampliacao_id: arranjos.find(a => a.tipo === 'ampliacao')?.id || null,
    })
  } catch (err) {
    console.error('❌ Erro ao ampliar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// S8.4 — ARQUIVAR (obriga motivo)
export const arquivarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { motivo, usuario } = req.body || {}
    if (!motivo) return res.status(400).json({ erro: 'motivo obrigatório', motivos_validos: MOTIVOS_ARQUIVAMENTO })
    if (!MOTIVOS_ARQUIVAMENTO.includes(motivo)) {
      return res.status(400).json({ erro: `motivo inválido (use um de: ${MOTIVOS_ARQUIVAMENTO.join(', ')})` })
    }
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    projeto.status = 'arquivado'
    projeto.arquivado_em = new Date()
    projeto.arquivado_por = req.auth?.id || req.auth?.email || usuario || null
    projeto.motivo_arquivamento = motivo
    await projeto.save()
    auditarCiclo(req, 'PROJETO_ARQUIVADO', projeto._id, `motivo=${motivo}`)
    res.json({ sucesso: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao arquivar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// S8.4 — RESTAURAR (volta a RASCUNHO se vinha de arquivado/excluído; preserva histórico)
export const restaurarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    const veioDe = projeto.excluido ? 'excluido' : (projeto.status === 'arquivado' ? 'arquivado' : 'nada')
    if (veioDe === 'nada') return res.status(400).json({ erro: 'Projeto não está arquivado nem excluído.' })

    projeto.excluido = false
    projeto.excluido_em = null
    projeto.excluido_por = null
    if (projeto.status === 'arquivado') projeto.status = 'rascunho'
    projeto.arquivado_em = null
    projeto.arquivado_por = null
    projeto.motivo_arquivamento = null
    await projeto.save()
    auditarCiclo(req, 'PROJETO_RESTAURADO', projeto._id, `de=${veioDe}`)
    res.json({ sucesso: true, item: enriquecer(projeto) })
  } catch (err) {
    console.error('❌ Erro ao restaurar projeto FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// S8.4 — Alterar status do ciclo (rascunho/em_analise/proposta/aprovado/em_execucao/concluido/perdido/cancelado)
export const alterarStatusCiclo = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ erro: 'status obrigatório' })
    // FV-UX-005 (F3.2 / defeito I-1): status desconhecido é ERRO, não fallback.
    // Antes, `paraModel` devolvia 'rascunho' para qualquer entrada inválida e a
    // gravação seguia com 200 — inclusive regredindo projetos já concluídos.
    const informado = String(status).toUpperCase()
    const novo = paraModel(informado)
    if (novo === null) {
      return res.status(422).json({
        erro: `Status "${status}" não pertence ao ciclo de vida do projeto.`,
        codigo: 'STATUS_INVALIDO',
        status_validos: STATUS,
      })
    }
    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    const antes = projeto.status
    if (antes === novo) return res.json({ sucesso: true, item: enriquecer(projeto), inalterado: true })
    projeto.status = novo
    await projeto.save()
    auditarCiclo(req, 'STATUS_ALTERADO', projeto._id, `${antes} → ${novo}`)
    res.json({ sucesso: true, item: enriquecer(projeto), alteracao: { antes, depois: novo } })
  } catch (err) {
    console.error('❌ Erro ao alterar status FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const listarProjetosFVPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(clienteId)) {
      return res.status(400).json({ erro: 'ClienteId inválido' })
    }

    let projetosDocliente
    if (mongoose.connection.readyState === 1) {
      projetosDocliente = await ProjetoFV.find(aplicarEscopo({ clienteId }, req, { contexto: 'projetoFV.porCliente' })).sort({ createdAt: -1 })
    } else {
      // Memory storage fallback
      projetosDocliente = memoryStore.findProjetoFVByCliente(clienteId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    console.log(`✓ Listando ${projetosDocliente.length} projetos do cliente ${clienteId}`)
    res.json(projetosDocliente)
  } catch (err) {
    console.error('❌ Erro ao listar projetos por cliente:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const salvarTelhado = async (req, res) => {
  try {
    const { id } = req.params
    const {
      endereco_completo,
      latitude,
      longitude,
      geocoding_origem,
      geocoding_confianca,
      geocodificado_em,
      telhado,
    } = req.body

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    } else {
      projeto = memoryStore.findProjetoFV(id)
    }
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    if (endereco_completo) projeto.endereco_completo = endereco_completo
    if (latitude !== undefined) {
      projeto.latitude = latitude === null || latitude === '' ? null : Number(latitude)
    }
    if (longitude !== undefined) {
      projeto.longitude = longitude === null || longitude === '' ? null : Number(longitude)
    }
    if (geocoding_origem !== undefined) projeto.geocoding_origem = geocoding_origem || null
    if (geocoding_confianca !== undefined) {
      projeto.geocoding_confianca = geocoding_confianca === null || geocoding_confianca === '' ? null : Number(geocoding_confianca)
    }
    if (geocodificado_em !== undefined) projeto.geocodificado_em = geocodificado_em ? new Date(geocodificado_em) : null
    if (telhado) {
      projeto.telhado = {
        pontos: telhado.pontos || [],
        area_m2: Number(telhado.area_m2) || 0,
      }
    }

    if (mongoose.connection.readyState === 1) {
      await projeto.save()
    } else {
      // Memory storage fallback
      memoryStore.updateProjetoFV(id, {
        endereco_completo: projeto.endereco_completo,
        latitude: projeto.latitude,
        longitude: projeto.longitude,
        geocoding_origem: projeto.geocoding_origem,
        geocoding_confianca: projeto.geocoding_confianca,
        geocodificado_em: projeto.geocodificado_em,
        telhado: projeto.telhado,
      })
    }

    console.log('✓ Telhado salvo para projeto:', id)
    res.json(projeto)
  } catch (err) {
    console.error('❌ Erro ao salvar telhado:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

export const obterTelhado = async (req, res) => {
  try {
    const { id } = req.params

    // Skip ObjectId validation if memory storage is active
    if (mongoose.connection.readyState === 1 && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    let projeto
    if (mongoose.connection.readyState === 1) {
      projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' })).populate('local_ref')
    } else {
      projeto = memoryStore.findProjetoFV(id)
    }
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    // S1.5: leitura de localização/telhado via adapter oficial (Local-first,
    // fallback por campo). geocoding_* não pertencem ao Local → do projeto.
    const local = obterLocalProjeto(projeto)
    res.json({
      id: projeto._id,
      nome: projeto.nome,
      endereco_completo: local.endereco_completo,
      latitude: local.latitude,
      longitude: local.longitude,
      geocoding_origem: projeto.geocoding_origem,
      geocoding_confianca: projeto.geocoding_confianca,
      geocodificado_em: projeto.geocodificado_em,
      telhado: local.telhado,
    })
  } catch (err) {
    console.error('❌ Erro ao obter telhado:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ─── S2.7: Persistência incremental por etapa do Wizard v2 ──────────────────
/**
 * PUT /api/projetos-fv/:id/etapa
 *
 * Persiste um slice individual do Wizard v2 SEM sobrescrever o documento inteiro.
 * Usa $set cirúrgico — apenas o subdoc da etapa é atualizado.
 *
 * Body: { etapa: string, dados: object }
 *
 * Etapas suportadas:
 *   localizacao    → projeto.localizacao + espelha latitude/longitude/endereco_completo
 *   dimensionamento → projeto.dimensionamento + espelha potencia_kwp/geracao_mensal_kwh
 *   equipamentos   → projeto.equipamentos
 *   layout_solar   → projeto.layout_solar + espelha telhado
 *   protecoes      → projeto.protecoes
 *   orcamento      → agregado `Orcamento` (FV-DOM-003) + espelha financeiro.*
 *   proposta       → projeto.proposta
 *   workflow       → projeto.workflow
 *   unifilar       → projeto.unifilar
 *   fatura         → projeto.fatura_extracao (somente campos seguros)
 */
export const salvarEtapaProjetoFV = async (req, res) => {
  try {
    const { id } = req.params
    const { etapa, dados } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }
    if (!etapa || typeof etapa !== 'string') {
      return res.status(400).json({ erro: 'Campo "etapa" é obrigatório (string)' })
    }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return res.status(400).json({ erro: 'Campo "dados" é obrigatório (object)' })
    }

    // Etapas permitidas — lista fechada para evitar escrita arbitrária
    const ETAPAS_PERMITIDAS = [
      'localizacao', 'dimensionamento', 'equipamentos', 'layout_solar',
      'protecoes', 'orcamento', 'proposta', 'workflow', 'unifilar', 'fatura',
      'engenharia_eletrica',  // S2.11.2 — arranjo + clima + resultado de compatibilidade
      'arranjos',             // P1-UX-FRONT-CONNECT-01 — múltiplos arranjos de componentes
      'instalacao_ref',       // S4C-0 — vínculo persistente ProjetoFV → Instalacao (só o link)
    ]
    if (!ETAPAS_PERMITIDAS.includes(etapa)) {
      return res.status(400).json({
        erro: `Etapa "${etapa}" não reconhecida.`,
        etapas_validas: ETAPAS_PERMITIDAS,
      })
    }

    // FV-UX-038 (D2): a regra da estrutura passa a valer na API, não só na
    // tela. Medido na FV-UX-037: `{ tipo: 'Outro', descricao: '' }` entrava com
    // HTTP 200. Ausência continua sendo LACUNA (não erro) — só `"Outro"` mudo e
    // tipo desconhecido são recusados.
    if (etapa === 'equipamentos' && dados?.estrutura !== undefined) {
      const v = validarEstrutura(dados.estrutura)
      if (!v.valida) {
        return res.status(400).json({
          erro: v.erros[0], erros: v.erros, codigo: 'ESTRUTURA_INVALIDA',
        })
      }
    }

    // Monta $set para o subdoc principal + campos legados espelhados
    const $set = {}

    switch (etapa) {
      case 'localizacao': {
        $set.localizacao = dados
        // Espelha campos flat de v2 para manter compatibilidade
        if (dados.latitude     !== undefined) $set.latitude            = dados.latitude
        if (dados.longitude    !== undefined) $set.longitude           = dados.longitude
        if (dados.endereco_completo !== undefined) $set.endereco_completo = dados.endereco_completo
        if (dados.geocoding_origem  !== undefined) $set.geocoding_origem  = dados.geocoding_origem
        if (dados.geocoding_confianca !== undefined) $set.geocoding_confianca = dados.geocoding_confianca
        if (dados.geocodificado_em  !== undefined) $set.geocodificado_em  = dados.geocodificado_em
        if (dados.irradiancia_kwh_kwp_dia !== undefined) $set.irradiancia_local = dados.irradiancia_kwh_kwp_dia
        break
      }
      case 'dimensionamento': {
        $set.dimensionamento = dados
        // Espelha campos flat de v2
        if (dados.potencia_kwp      !== undefined) $set.potencia_kwp       = dados.potencia_kwp
        if (dados.geracao_mensal_kwh !== undefined) $set.geracao_mensal_kwh = dados.geracao_mensal_kwh
        break
      }
      case 'layout_solar': {
        $set.layout_solar = dados
        // Espelha para `telhado` legado
        if (dados.pontos || dados.area_util_m2 || dados.orientacao || dados.inclinacao_graus) {
          $set.telhado = {
            pontos:      dados.pontos      ?? undefined,
            area_m2:     dados.area_util_m2 ?? undefined,
            orientacao:  dados.orientacao   ?? undefined,
            inclinacao:  dados.inclinacao_graus ?? undefined,
          }
        }
        break
      }
      case 'orcamento': {
        // FV-DOM-003: a escrita em `ProjetoFV.orcamento` foi REMOVIDA. A etapa
        // grava exclusivamente no agregado `Orcamento` (adiante neste handler).
        // O subdocumento passa a ser somente-leitura: nenhum caminho da aplicação
        // o escreve; ele só guarda o que projetos históricos já tinham.
        //
        // `financeiro.*` continua sendo espelhado porque NÃO é o subdocumento
        // legado — é o campo de indicadores financeiros do próprio ProjetoFV, e
        // o agregado deliberadamente não os persiste (INV-58: são derivados).
        if (dados.payback_anos !== undefined) $set['financeiro.payback_anos'] = dados.payback_anos
        if (dados.irr_pct      !== undefined) $set['financeiro.irr_pct']      = dados.irr_pct
        if (dados.npv_r        !== undefined) $set['financeiro.npv_r']        = dados.npv_r
        break
      }
      case 'fatura': {
        // Permite atualizar apenas um subconjunto seguro de fatura_extracao
        // (não permite sobrescrever dados_brutos ou arquivo_original_nome via esta rota)
        const CAMPOS_FATURA_PERMITIDOS = [
          'confirmado_pelo_usuario', 'concessionaria', 'grupo_tarifario',
          'classificacao', 'tipo_ligacao', 'tensao_v', 'consumo_mensal_kwh', 'media_anual_kwh',
          'historico_12meses', 'valor_total_r', 'valor_kwh', 'irradiancia_local',
        ]
        for (const campo of CAMPOS_FATURA_PERMITIDOS) {
          if (dados[campo] !== undefined) {
            $set[`fatura_extracao.${campo}`] = dados[campo]
          }
        }
        if (Object.keys($set).length === 0) {
          return res.status(400).json({ erro: 'Nenhum campo de fatura permitido encontrado em "dados"' })
        }
        break
      }
      case 'engenharia_eletrica': {
        // S2.11.2 — Merge seguro por dot-notation.
        // Grava apenas os subcampos enviados, preservando quaisquer subcampos
        // existentes que o frontend não tenha incluído no payload.
        //
        // Subcampos aceitos: arranjo, clima_utilizado, compatibilidade
        // Campos desconhecidos são ignorados (lista de permissão explícita).
        const SUBCAMPOS = ['arranjo', 'clima_utilizado', 'compatibilidade']
        for (const sub of SUBCAMPOS) {
          if (dados[sub] !== undefined) {
            $set[`engenharia_eletrica.${sub}`] = dados[sub]
          }
        }
        if (Object.keys($set).length === 0) {
          return res.status(400).json({
            erro: 'engenharia_eletrica: nenhum subcampo válido recebido.',
            subcampos_validos: SUBCAMPOS,
          })
        }
        break
      }

      case 'arranjos': {
        // P1-UX-FRONT-CONNECT-01 — recebe { lista: [...] } (array embrulhado p/ passar
        // pela validação que rejeita `dados` array). Substitui o array inteiro de arranjos:
        // a remoção de um bloco no frontend já limpa o índice antes do envio.
        //
        // F13 — identidade garantida na ESCRITA, nunca na leitura.
        //
        // O frontend chegava aqui com o id que cada bloco carregava, e um deles
        // era o literal `'arr_primario'`: bastava um arranjo já persistido com
        // esse id voltar na lista para o documento passar a ter dois. Daí em
        // diante `find(tipo === 'principal')` escolhia o primeiro em silêncio,
        // inclusive ao montar o documento de homologação.
        //
        // `garantirIdentidade` preenche id ausente e desempata repetido —
        // mantendo a PRIMEIRA ocorrência, que é a única escolha que não troca a
        // identidade de um arranjo já correto. Nenhum outro campo é tocado:
        // equipamento, potência, quantidade e tipo passam intactos.
        //
        // Corrigir na leitura seria mais fácil e estaria errado: a identidade
        // mudaria a cada GET e nada seria estável.
        $set.arranjos = garantirIdentidade(Array.isArray(dados.lista) ? dados.lista : [])
        break
      }

      case 'instalacao_ref': {
        // S4C-0 — persiste APENAS o vínculo ProjetoFV → Instalacao. Não cria/gera
        // topologia. Recebe { id }: ObjectId (vincula) ou null (remove o vínculo).
        const id = dados.id ?? null
        if (id !== null && !mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ erro: 'instalacao_ref: id deve ser ObjectId válido ou null' })
        }
        $set.instalacao_ref = id
        break
      }

      default:
        // equipamentos, protecoes, proposta, workflow, unifilar — set direto
        $set[etapa] = dados
    }

    // ⚠️ FIX defensivo: garantir que `workflow` não seja null antes de tocar subcampos.
    // Sem isso, MongoDB lança "Cannot create field 'ultima_atividade' in element {workflow: null}"
    // pois $set em path dot-notation falha quando o ancestral é null.
    const projetoAtual = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' })).select('workflow governanca.freeze_status governanca.comercial.workflow_status').lean()
    if (!projetoAtual) return res.status(404).json({ erro: 'Projeto não encontrado' })

    // ── S3.5/S4.2: Freeze guard ────────────────────────────────────────────────
    // Projetos CONGELADO/HOMOLOGADO (técnico) ou ASSINADO (comercial) não aceitam
    // recálculo nem alteração silenciosa. Apenas a etapa 'workflow' é tolerada.
    // Snapshots e mudança de status passam por endpoints dedicados.
    // FV-DOM-002A: a decisão vem do CONTRATO ÚNICO — orçamento aprovado +
    // baseline válida — com cláusula de compatibilidade para projetos legados.
    // Antes, este guard reimplementava o booleano por conta própria e não
    // enxergava o Baseline.
    const freezeStatus = projetoAtual.governanca?.freeze_status
    const comStatus    = projetoAtual.governanca?.comercial?.workflow_status
    const congelamento = await resolverCongelamento({
      _id: projetoAtual._id ?? id,
      empresa_id: tenantDoReq(req),
      governanca: projetoAtual.governanca,
    })
    if (congelamento.congelado && etapa !== 'workflow') {
      return res.status(409).json({
        erro: `Projeto congelado — alteração de "${etapa}" bloqueada.`,
        codigo: 'PROJETO_CONGELADO',
        motivo: congelamento.motivo,
        detalhe: congelamento.detalhe,
        freeze_status: freezeStatus,
        workflow_comercial: comStatus,
        dica: 'Crie uma revisão (técnica ou comercial) para reabrir antes de editar.',
      })
    }

    if (!projetoAtual.workflow) {
      await ProjetoFV.updateOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV.workflow' }), { $set: { workflow: {} } })
    }

    // P0-ENGENHARIA-ELETRICA-PERSIST-FIX-01: mesmo null-guard para engenharia_eletrica.
    // O campo tem default:null e o save usa dot-notation ($set['engenharia_eletrica.arranjo']),
    // que falha com "Cannot create field 'arranjo' in element {engenharia_eletrica: null}".
    // updateOne condicional (filtro engenharia_eletrica:null) inicializa {} apenas quando
    // ainda é null — idempotente e nunca sobrescreve dados existentes.
    if (etapa === 'engenharia_eletrica') {
      await ProjetoFV.updateOne(aplicarEscopo({ _id: id, engenharia_eletrica: null }, req, { contexto: 'projetoFV.engenharia' }), { $set: { engenharia_eletrica: {} } })
    }

    // Sempre atualiza ultima_atividade + schema_version.
    // Quando etapa === 'workflow', o switch default já fez $set.workflow = dados (objeto inteiro);
    // nesse caso, embutimos ultima_atividade dentro do objeto para evitar conflito de path
    // "Updating the path 'workflow.ultima_atividade' would create a conflict at 'workflow'".
    if (etapa === 'workflow') {
      $set.workflow = { ...dados, ultima_atividade: new Date() }
    } else {
      $set['workflow.ultima_atividade'] = new Date()
    }
    $set.schema_version = 3  // documento passa a ser v3 a partir do primeiro save via wizard

    const projeto = await ProjetoFV.findOneAndUpdate(
      aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV.salvarEtapa' }),
      { $set },
      { new: true, runValidators: true }
    ).populate('clienteId')

    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    // ── FV-DOM-003: o agregado `Orcamento` é a ÚNICA fonte da etapa ───────────
    // A ponte legada (`$set.orcamento`) foi removida. Consequência: falhar aqui
    // em silêncio PERDERIA o orçamento — não há mais onde ele caia. Por isso a
    // falha passou a ser FATAL, fechando o achado A-3 da FV-DOM-002.
    let orcamento_agregado = null
    if (etapa === 'orcamento') {
      const r = await OrcamentoService.gravarEtapaOrcamento({
        projeto: projeto.toObject(),
        dados,
        empresa_id: tenantDoReq(req),
        por: req.auth?.email ?? req.auth?.userId ?? null,
      })
      orcamento_agregado = { _id: r.orcamento?._id, estado: r.orcamento?.estado, acao: r.acao }
    }

    console.log(`✓ Etapa "${etapa}" salva para projeto ${id}`)
    res.json({
      sucesso: true,
      etapa,
      projeto_id: projeto._id,
      schema_version: projeto.schema_version,
      ...(orcamento_agregado ? { orcamento_agregado } : {}),
      // Retorna apenas o subdoc atualizado + metadados básicos (não o doc inteiro)
      [etapa === 'fatura' ? 'fatura_extracao' : etapa]: projeto[etapa === 'fatura' ? 'fatura_extracao' : etapa],
    })
  } catch (err) {
    console.error('❌ Erro ao salvar etapa FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/unifilar/gerar — unifilar do projeto pelo motor canônico (FV-DOM-007B).
 *
 * ── O que esta rota fazia antes ──────────────────────────────────────────────
 * Delegava ao `unifilarController.gerarUnifilarFV` montando o corpo à mão com
 * `modelo: 'Fronius SYMO'`, `tensao_rede: 'trifasico'` e `bess: null` FIXOS — e
 * lia `dim.numPaineis`/`dim.numStrings`, que não existem no documento (o schema
 * usa `num_paineis`/`num_strings`). Resultado: `Array(undefined)` estourava, ou o
 * diagrama saía descrevendo um inversor que o projeto não tem.
 *
 * Agora chama o motor do domínio, que usa a engenharia normativa real e desenha
 * o equipamento, a topologia MPPT e a ligação do projeto.
 *
 * A rota é a MESMA — nenhum endpoint novo foi criado. O que mudou foi de onde
 * vem o desenho.
 *
 * Sempre desenha o estado ATUAL (`origem: 'dados_atuais'`). O desenho congelado
 * é outro fato e vive em `governanca.snapshot_unifilar` (M-2).
 */
export const gerarUnifilarProjeto = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: 'ID inválido' })
    }

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
      .populate('clienteId', 'nome')
      .lean()
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    // Ativos tornam os símbolos clicáveis (gêmeo digital). São opcionais: sem
    // eles o diagrama sai igual, apenas estático — por isso a falha aqui não
    // derruba a geração.
    let ativos = []
    try {
      const { AtivoEquipamento } = await import('../models/AtivoEquipamento.js')
      ativos = await AtivoEquipamento.find(
        aplicarEscopo({ projeto_id: id }, req, { contexto: 'unifilar.ativos' }),
      ).lean()
    } catch (e) {
      console.warn('⚠️ unifilar: ativos indisponíveis —', e.message)
    }

    // FV-DOM-031D: o módulo do catálogo, para que o unifilar de MICROINVERSORES
    // leia Voc/Vmpp/Isc/coef. térmico pela SSOT em vez de declarar lacuna. Mesmo
    // padrão do carregamento de `ativos` acima: best-effort, nunca derruba o PDF
    // nem o desenho. O caminho STRING não consome este dado.
    let moduloCatalogo = null
    try {
      const refModulo = projeto?.equipamentos?.paineis?.[0]?.equipamento_id
      if (refModulo && mongoose.Types.ObjectId.isValid(refModulo)) {
        const { Equipamento } = await import('../models/Equipamento.js')
        // SEM `aplicarEscopo`: o catálogo de equipamentos é GLOBAL — não tem
        // `empresa_id` e nenhum outro caminho do sistema o escopa (ver
        // `equipamentosController`). Escopar aqui faria `aplicarEscopo` lançar
        // `TENANT_AUSENTE` (fail-closed), o `catch` engoliria, e o módulo
        // voltaria `null` em silêncio — foi o que aconteceu na primeira versão.
        moduloCatalogo = await Equipamento.findById(refModulo).lean()
      }
    } catch (e) {
      console.warn('⚠️ unifilar: módulo do catálogo indisponível —', e.message)
    }

    const { gerarUnifilarDoProjeto } = await import('../dominio/unifilar/index.js')
    const resultado = gerarUnifilarDoProjeto(projeto, {
      ativos,
      nomeCliente: projeto.clienteId?.nome ?? null,
      moduloCatalogo,
    })

    res.json({
      sucesso: true,
      svg: resultado.svg,
      origem: resultado.origem,
      // Sem fallback silencioso: quem consome sabe qual campo veio do projeto e
      // qual foi assumido pelo motor.
      proveniencia: resultado.proveniencia,
      lacunas: resultado.lacunas,
      especificacoes: resultado.especificacoes,
      // FV-DOM-056: quando o domínio recusa desenhar, `svg` vem `null` e o
      // motivo técnico vem aqui. Não é erro HTTP — é o estado do projeto.
      impedimento: resultado.impedimento ?? null,
    })
  } catch (err) {
    console.error('❌ Erro ao gerar unifilar:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S3.5 — GOVERNANÇA TÉCNICA
//
// Congelamento de snapshots, versionamento de engenharia, revisões, auditoria e
// detecção de divergência com o catálogo vivo. Tudo additive: projetos antigos
// (governanca === null) seguem funcionando sem nenhuma alteração de comportamento.
// ═══════════════════════════════════════════════════════════════════════════════

function _exigirMongo(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ erro: 'MongoDB indisponível.', codigo: 'DB_OFFLINE' })
    return false
  }
  return true
}

// Próxima letra de revisão: A→B→C... (após Z, usa AA, AB... improvável mas seguro)
function _proximaRevisao(atual) {
  if (!atual) return 'A'
  const ultima = String(atual).trim().toUpperCase()
  const cod = ultima.charCodeAt(ultima.length - 1)
  if (cod >= 65 && cod < 90) return ultima.slice(0, -1) + String.fromCharCode(cod + 1)
  if (cod === 90) return ultima + 'A' // Z → ZA
  return 'A'
}

/**
 * POST /:id/governanca/congelar
 * Congela os snapshots enviados pelo frontend e trava o projeto.
 * Body: { snapshots: { tecnico, catalogo, unifilar, memorial, financeiro },
 *         engineering_version, usuario, motivo, novo_status }
 */
export const congelarProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const {
      snapshots = {},
      engineering_version = null,
      usuario = null,
      motivo = null,
      novo_status = 'CONGELADO',
    } = req.body || {}

    // Subconjunto deliberado do vocabulário canônico: este endpoint captura
    // snapshot, então só produz estados travados (FV-UX-005 / F3.3).
    if (!FREEZE_STATUS_TRAVADOS.includes(novo_status)) {
      return res.status(400).json({ erro: `novo_status deve ser um de: ${FREEZE_STATUS_TRAVADOS.join(', ')}` })
    }

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = projeto.governanca || {}
    const agora = new Date()
    const revAtual = gov.revisao_atual || 'A'

    // S8.3.2 — snapshot imutável do Responsável Técnico (congela o cadastro no momento
    // do freeze; documentos futuros usam o snapshot, não o cadastro vivo).
    let snapshotRT = snapshots.responsavel_tecnico ?? gov.snapshot_responsavel_tecnico ?? null
    if (!snapshotRT) {
      const tecnicoId = projeto.tecnico_principal_id || projeto.tecnico_id || null
      if (tecnicoId && mongoose.Types.ObjectId.isValid(tecnicoId)) {
        try {
          const tec = await Tecnico.findOne(aplicarEscopo({ _id: tecnicoId }, req, { contexto: 'tecnico' })).lean()
          if (tec) snapshotRT = montarSnapshotRT(tec, agora)
        } catch { /* segue sem snapshot RT */ }
      }
    }

    // Monta o subdoc de governança congelado
    const novaGovernanca = {
      ...((projeto.governanca && projeto.governanca.toObject?.()) || gov),
      engineering_version: engineering_version || gov.engineering_version || null,
      freeze_status: novo_status,
      revisao_atual: revAtual,
      congelado_em: agora,
      congelado_por: usuario,
      snapshot_responsavel_tecnico: snapshotRT,
      snapshot_tecnico:    snapshots.tecnico    ?? gov.snapshot_tecnico    ?? null,
      snapshot_geoespacial: snapshots.geoespacial ?? gov.snapshot_geoespacial ?? null,
      snapshot_empresa:    snapshots.empresa    ?? gov.snapshot_empresa    ?? null,
      snapshot_tecnico_identificacao: snapshots.tecnico_identificacao ?? gov.snapshot_tecnico_identificacao ?? null,
      snapshot_catalogo:   snapshots.catalogo   ?? gov.snapshot_catalogo   ?? null,
      snapshot_unifilar:   snapshots.unifilar   ?? gov.snapshot_unifilar   ?? null,
      snapshot_memorial:   snapshots.memorial   ?? gov.snapshot_memorial   ?? null,
      snapshot_financeiro: snapshots.financeiro ?? gov.snapshot_financeiro ?? null,
    }

    // Garante arrays existentes
    novaGovernanca.revisoes  = Array.isArray(gov.revisoes)  ? [...gov.revisoes]  : []
    novaGovernanca.auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    novaGovernanca.historico = Array.isArray(gov.historico) ? [...gov.historico] : []

    // Registra/atualiza a revisão atual com cópia dos snapshots
    const idxRev = novaGovernanca.revisoes.findIndex(r => r.rev === revAtual)
    const registroRev = {
      rev: revAtual,
      timestamp: agora,
      usuario,
      motivo: motivo || `Proposta ${novo_status.toLowerCase()}`,
      alteracoes: 'Snapshots técnicos, catálogo, unifilar, memorial e financeiro congelados.',
      engineering_version: novaGovernanca.engineering_version,
      snapshots: {
        responsavel_tecnico: novaGovernanca.snapshot_responsavel_tecnico,
        tecnico:    novaGovernanca.snapshot_tecnico,
        geoespacial: novaGovernanca.snapshot_geoespacial,
        catalogo:   novaGovernanca.snapshot_catalogo,
        unifilar:   novaGovernanca.snapshot_unifilar,
        memorial:   novaGovernanca.snapshot_memorial,
        financeiro: novaGovernanca.snapshot_financeiro,
      },
    }
    if (idxRev >= 0) novaGovernanca.revisoes[idxRev] = registroRev
    else novaGovernanca.revisoes.push(registroRev)

    novaGovernanca.auditoria.push({
      timestamp: agora, usuario, acao: 'congelamento',
      detalhe: `Projeto ${novo_status} na revisão ${revAtual} (motor ${novaGovernanca.engineering_version || '—'}).`,
      contexto: { motivo },
    })
    // S8.3.2 — auditoria do snapshot do RT (quando houver técnico atribuído)
    if (snapshotRT) {
      novaGovernanca.auditoria.push({
        timestamp: agora, usuario, acao: 'SNAPSHOT_RT_CRIADO',
        detalhe: `RT congelado: ${snapshotRT.nome || '—'} (${snapshotRT.tipo_registro || ''} ${snapshotRT.numero_registro || ''}).`,
        contexto: { uf: snapshotRT.uf, modalidade: snapshotRT.modalidade },
      })
    }
    novaGovernanca.historico.push({
      timestamp: agora,
      tipo: novo_status === 'HOMOLOGADO' ? 'homologado' : 'congelado',
      descricao: `Rev ${revAtual} — proposta ${novo_status.toLowerCase()}.`,
    })

    projeto.governanca = novaGovernanca
    await projeto.save()

    console.log(`🔒 Projeto ${id} ${novo_status} (Rev ${revAtual})`)
    res.json({ sucesso: true, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao congelar projeto:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/revisao
 * Cria nova revisão (Rev A→B→C) e reabre a engenharia (volta a EM_REVISAO).
 * Body: { usuario, motivo, alteracoes }
 */
export const criarRevisaoProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { usuario = null, motivo = null, alteracoes = null } = req.body || {}

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = (projeto.governanca && projeto.governanca.toObject?.()) || projeto.governanca || {}
    const agora = new Date()
    const novaRev = _proximaRevisao(gov.revisao_atual || 'A')

    const revisoes  = Array.isArray(gov.revisoes)  ? [...gov.revisoes]  : []
    const auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    const historico = Array.isArray(gov.historico) ? [...gov.historico] : []

    revisoes.push({
      rev: novaRev, timestamp: agora, usuario,
      motivo: motivo || 'Revisão aberta para edição',
      alteracoes,
      engineering_version: gov.engineering_version || null,
      snapshots: null, // ainda não congelada
    })
    auditoria.push({
      timestamp: agora, usuario, acao: 'revisao_criada',
      detalhe: `Revisão ${novaRev} criada. Engenharia reaberta (EM_REVISAO).`,
      contexto: { motivo, alteracoes },
    })
    historico.push({
      timestamp: agora, tipo: 'revisao',
      descricao: `Rev ${novaRev} criada — projeto reaberto para edição.`,
    })

    projeto.governanca = {
      ...gov,
      freeze_status: 'EM_REVISAO',
      revisao_atual: novaRev,
      revisoes, auditoria, historico,
    }
    await projeto.save()

    console.log(`📝 Projeto ${id} reaberto — Rev ${novaRev}`)
    res.json({ sucesso: true, revisao_atual: novaRev, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao criar revisão:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * PUT /:id/governanca/status
 * Altera o status de governança manualmente (RASCUNHO/EM_REVISAO/CONGELADO/HOMOLOGADO).
 * Body: { status, usuario }
 */
export const alterarStatusGovernanca = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { status, usuario = null } = req.body || {}
    // FV-UX-005 (F3.3): vocabulário vem da fonte única, não de uma cópia local.
    if (!ehFreezeStatusValido(status)) {
      return res.status(400).json({ erro: `status deve ser um de: ${FREEZE_STATUS.join(', ')}` })
    }

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const gov = (projeto.governanca && projeto.governanca.toObject?.()) || projeto.governanca || {}
    const agora = new Date()
    const auditoria = Array.isArray(gov.auditoria) ? [...gov.auditoria] : []
    const historico = Array.isArray(gov.historico) ? [...gov.historico] : []
    const anterior = gov.freeze_status || 'RASCUNHO'

    // P1-FV-FREEZE-TO-ENGINEERING-01: valida a transição do ciclo de vida.
    // CONGELADO/HOMOLOGADO via /governanca/congelar (capturam snapshot); aqui
    // tratamos as transições de status sem snapshot (aprovação, reabertura).
    // FV-UX-006 (F3.1): tabela vem da fonte única (era inline e duplicada na UI).
    const TRANSICOES_VALIDAS = TRANSICOES_FREEZE
    if (status !== anterior && !(TRANSICOES_VALIDAS[anterior] || []).includes(status)) {
      return res.status(422).json({
        erro: `Transição inválida: ${anterior} → ${status}.`,
        transicoes_validas: TRANSICOES_VALIDAS[anterior] || [],
        codigo: 'TRANSICAO_INVALIDA',
      })
    }

    auditoria.push({
      timestamp: agora, usuario, acao: 'status_alterado',
      detalhe: `Status: ${anterior} → ${status}.`,
    })
    historico.push({
      timestamp: agora, tipo: status === 'HOMOLOGADO' ? 'homologado' : status.toLowerCase(),
      descricao: `Status alterado para ${status}.`,
    })

    projeto.governanca = {
      ...gov,
      freeze_status: status,
      ...(status === 'HOMOLOGADO' ? {} : {}),
      auditoria, historico,
    }
    await projeto.save()

    res.json({ sucesso: true, freeze_status: status, governanca: projeto.governanca })
  } catch (err) {
    console.error('❌ Erro ao alterar status de governança:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * GET /:id/governanca/divergencia
 * Compara o snapshot_catalogo congelado com o catálogo vivo (Equipamento).
 * Detecta equipamentos que mudaram de specs/score/validação desde o congelamento.
 */
export const detectarDivergenciaProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' })).lean()
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const snapCat = projeto.governanca?.snapshot_catalogo
    if (!snapCat) {
      return res.json({
        sucesso: true,
        tem_snapshot: false,
        mensagem: 'Projeto sem snapshot de catálogo — nada para comparar.',
        divergencias: [],
      })
    }

    // snapshot_catalogo: { modulo: {...}, inversor: {...}, itens_adicionais: [...], ... }
    const divergencias = []

    for (const [chave, snap] of Object.entries(snapCat)) {
      if (!snap || typeof snap !== 'object') continue
      // P1-FV-FREEZE-TO-ENGINEERING-01: ignora chaves não-equipamento.
      // (criado_em é string; itens_adicionais/arranjos_extra são arrays; equipamentos
      //  têm equipamento_id ou fabricante+modelo). Itens adicionais são livres — não
      //  existem no catálogo vivo, logo não geram divergência de catálogo.
      if (Array.isArray(snap)) continue
      if (!snap.equipamento_id && !(snap.fabricante && snap.modelo)) continue

      // Localiza o equipamento atual: por id, senão por fabricante+modelo
      let atual = null
      if (snap.equipamento_id && mongoose.Types.ObjectId.isValid(snap.equipamento_id)) {
        atual = await Equipamento.findById(snap.equipamento_id).lean()
      }
      if (!atual && snap.fabricante && snap.modelo) {
        atual = await Equipamento.findOne({
          fabricante: snap.fabricante,
          modelo: snap.modelo,
        }).lean()
      }

      if (!atual) {
        divergencias.push({
          chave, fabricante: snap.fabricante, modelo: snap.modelo,
          tipo_divergencia: 'removido_do_catalogo',
          impacto: 'Equipamento não encontrado no catálogo atual.',
          mudancas: [],
        })
        continue
      }

      // Compara specs elétricas (campos técnicos visíveis — sem campos internos de qualidade/hash)
      const mudancas = []
      const espSnap = snap.especificacoes || {}
      const espAtual = atual.especificacoes || {}
      for (const campo of Object.keys(espSnap)) {
        if (espAtual[campo] !== undefined && espSnap[campo] !== espAtual[campo]) {
          mudancas.push({ campo, de: espSnap[campo], para: espAtual[campo] })
        }
      }

      if (mudancas.length > 0) {
        const impactosAreas = []
        const camposEng   = ['potencia_wp', 'potencia_nominal_kw', 'voc', 'vmp', 'isc', 'n_mppts', 'tensao_max_entrada']
        const camposUnif  = ['tensao_max_entrada', 'n_mppts', 'strings_por_mppt', 'potencia_nominal_kw']
        const camposOrca  = ['potencia_wp', 'potencia_nominal_kw']
        if (mudancas.some(m => camposEng.includes(m.campo)))  impactosAreas.push('Engenharia')
        if (mudancas.some(m => camposUnif.includes(m.campo))) impactosAreas.push('Unifilar')
        if (mudancas.some(m => camposOrca.includes(m.campo))) impactosAreas.push('Orçamento')
        impactosAreas.push('Homologação')
        divergencias.push({
          chave, fabricante: snap.fabricante, modelo: snap.modelo,
          tipo_divergencia: 'specs_alteradas',
          impacto: `Impacta: ${impactosAreas.join(', ')} — recálculo necessário.`,
          mudancas,
        })
      }
    }

    res.json({
      sucesso: true,
      tem_snapshot: true,
      congelado_em: projeto.governanca?.congelado_em ?? null,
      engineering_version: projeto.governanca?.engineering_version ?? null,
      total_divergencias: divergencias.length,
      divergente: divergencias.length > 0,
      // P1-FV-FREEZE-TO-ENGINEERING-01: mensagem orientada ao orçamento aprovado.
      // A engenharia permanece usando o snapshot congelado mesmo com divergência.
      mensagem: divergencias.length > 0
        ? 'Equipamento divergiu do orçamento aprovado. A engenharia continua usando o snapshot congelado.'
        : 'Equipamentos congelados idênticos ao catálogo atual.',
      divergencias,
    })
  } catch (err) {
    console.error('❌ Erro ao detectar divergência:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S4.2 — COMERCIAL ENTERPRISE
// Workflow comercial, cenários, desconto/aprovação, assinaturas e snapshot
// comercial congelável. Additive: projetos sem governanca.comercial seguem iguais.
// ═══════════════════════════════════════════════════════════════════════════════

function _carregarComercial(gov) {
  const govObj = (gov && gov.toObject?.()) || gov || {}
  const com = govObj.comercial || {}
  return {
    govObj,
    com: {
      ...com,
      assinaturas: Array.isArray(com.assinaturas) ? [...com.assinaturas] : [],
      historico: Array.isArray(com.historico) ? [...com.historico] : [],
    },
  }
}

// FV-UX-006 (F3.1): as tabelas WORKFLOW_COMERCIAL / TRANSICOES_COMERCIAL /
// ORDEM_COMERCIAL / CONGELADOS_COMERCIAL e as funções de validação viviam aqui,
// duplicadas em frontend/src/utils/comercialStateMachine.js. Agora vêm da fonte
// única. Os aliases locais preservam os nomes usados no restante do arquivo.
const _statusJuridicoDeEstado = statusJuridicoDeEstado
const _validarTransicaoComercial = validarTransicaoComercial

function _proximaRevComercial(atual) {
  return _proximaRevisao(atual || 'A')
}

/**
 * POST /:id/governanca/comercial/snapshot
 * Salva/congela o snapshot comercial: cenários, comparativos, desconto, PDF.
 * Body: { snapshot_comercial, cenarios, comparativos, desconto_pct, congelar, usuario }
 */
export const salvarComercialProjetoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { snapshot_comercial = null, cenarios = null, comparativos = null,
      desconto_pct, desconto_limite_pct, margem_liquida_pct = null,
      cenarios_congelados = null, congelar = false, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    if (CONGELADOS_COMERCIAL.includes(com.workflow_status)) {
      return res.status(409).json({ erro: `Proposta ${com.workflow_status} — crie uma revisão comercial antes de alterar.`, codigo: 'COMERCIAL_CONGELADO' })
    }

    // S4.3: proteção de margem ao congelar (impede venda destrutiva)
    if (congelar && margem_liquida_pct != null) {
      const pol = com.politicas || {}
      const bloqueio = pol.margem_bloqueio_pct ?? 0
      const minima = pol.margem_minima_pct ?? 8
      if (Number(margem_liquida_pct) < bloqueio) {
        return res.status(422).json({ erro: `Margem ${margem_liquida_pct}% abaixo do bloqueio (${bloqueio}%). Congelamento impedido.`, codigo: 'MARGEM_BLOQUEIO' })
      }
      if (Number(margem_liquida_pct) < minima && !com.aprovacao) {
        return res.status(422).json({ erro: `Margem ${margem_liquida_pct}% abaixo da mínima (${minima}%). Requer aprovação gerencial antes de congelar.`, codigo: 'MARGEM_REQUER_APROVACAO' })
      }
    }
    if (cenarios_congelados != null) com.cenarios_congelados = cenarios_congelados

    if (cenarios != null)            com.cenarios = cenarios
    if (comparativos != null)        com.comparativos = comparativos
    if (snapshot_comercial != null)  com.snapshot_comercial = snapshot_comercial
    if (desconto_pct != null)        com.desconto_pct = desconto_pct
    if (desconto_limite_pct != null) com.desconto_limite_pct = desconto_limite_pct
    if (congelar)                    com.congelado_em = agora

    com.historico.push({
      timestamp: agora, usuario, acao: congelar ? 'snapshot_comercial_congelado' : 'snapshot_comercial_salvo',
      detalhe: `Cenários e comparativos ${congelar ? 'congelados' : 'atualizados'}.`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao salvar comercial:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * PUT /:id/governanca/comercial/workflow
 * Altera o status do workflow comercial. ASSINADO congela (freeze comercial).
 * Body: { status, usuario }
 */
export const atualizarWorkflowComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { status, usuario = null, motivo = null } = req.body || {}
    if (!WORKFLOW_COMERCIAL.includes(status)) {
      return res.status(400).json({ erro: `status deve ser um de: ${WORKFLOW_COMERCIAL.join(', ')}` })
    }

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const anterior = com.workflow_status || 'EM_ANALISE'

    // S4.3: valida transição na máquina de estados
    const val = _validarTransicaoComercial(anterior, status)
    if (!val.ok) {
      return res.status(409).json({
        erro: val.motivo, codigo: val.requer_revisao ? 'REQUER_REVISAO' : 'TRANSICAO_INVALIDA',
        de: anterior, para: status,
      })
    }

    com.workflow_status = status
    com.status_juridico = _statusJuridicoDeEstado(status)
    if (status === 'ASSINADO') com.congelado_em = com.congelado_em || agora
    com.historico.push({
      timestamp: agora, usuario, acao: 'workflow_alterado',
      detalhe: `Workflow: ${anterior} → ${status}.${motivo ? ' Motivo: ' + motivo : ''}`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, workflow_status: status, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro no workflow comercial:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/assinatura
 * Registra assinatura digital simples (hash + timestamp).
 * Body: { papel, nome, hash, usuario }
 */
export const registrarAssinaturaComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { papel, nome, hash, hash_documento = null, hash_snapshot = null, algoritmo = 'sha256', usuario = null, usuario_id = null } = req.body || {}
    const PAPEIS = ['cliente', 'vendedor', 'tecnico']
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel deve ser: ${PAPEIS.join(', ')}` })
    if (!nome || !hash) return res.status(400).json({ erro: 'nome e hash são obrigatórios' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    // S4.3: trilha auditável — ip, user-agent, hashes, id único
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || null
    const user_agent = req.headers['user-agent'] || null
    const assinatura_id = `SIG-${papel.toUpperCase()}-${agora.getTime().toString(36)}`

    // Substitui assinatura existente do mesmo papel (re-assinatura)
    com.assinaturas = com.assinaturas.filter(a => a.papel !== papel)
    com.assinaturas.push({ assinatura_id, usuario_id, papel, nome, hash, algoritmo, hash_documento, hash_snapshot, ip, user_agent, timestamp: agora })
    com.historico.push({ timestamp: agora, usuario: usuario || nome, acao: 'assinatura', detalhe: `Assinatura ${papel}: ${nome} (${assinatura_id}).` })

    // Se as três assinaturas estão presentes, marca ASSINADO
    const papeisAssinados = new Set(com.assinaturas.map(a => a.papel))
    if (PAPEIS.every(p => papeisAssinados.has(p)) && com.workflow_status !== 'ASSINADO') {
      com.workflow_status = 'ASSINADO'
      com.status_juridico = 'ASSINADO'
      com.congelado_em = com.congelado_em || agora
      com.historico.push({ timestamp: agora, usuario, acao: 'workflow_alterado', detalhe: 'Workflow: ASSINADO (todas as assinaturas coletadas).' })
    }

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar assinatura:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/aprovacao
 * Registra aprovação gerencial de desconto/margem/exceção.
 * Body: { tipo, aprovado_por, observacao, usuario }
 */
export const registrarAprovacaoComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { tipo, aprovado_por, observacao = null, usuario = null } = req.body || {}
    const TIPOS = ['aprovacao_desconto', 'aprovacao_margem', 'aprovacao_excecao']
    if (!TIPOS.includes(tipo)) return res.status(400).json({ erro: `tipo deve ser: ${TIPOS.join(', ')}` })
    if (!aprovado_por) return res.status(400).json({ erro: 'aprovado_por é obrigatório' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    com.aprovacao = { tipo, aprovado_por, em: agora, observacao }
    com.desconto_aprovado_por = aprovado_por
    if (tipo === 'aprovacao_excecao') com.desconto_excecao = true
    com.historico.push({ timestamp: agora, usuario: usuario || aprovado_por, acao: 'aprovacao', detalhe: `${tipo} por ${aprovado_por}.` })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar aprovação:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// Diff raso entre dois snapshots comerciais (campos-chave)
function _diffComercial(antigo, novo) {
  const campos = [
    ['proposta_final', 'Proposta final'],
    ['desconto_pct', 'Desconto'],
    ['cenario_exibicao', 'Cenário base'],
  ]
  const diff = []
  const a = antigo || {}, b = novo || {}
  for (const [campo, rotulo] of campos) {
    if (a[campo] !== b[campo]) diff.push({ campo: rotulo, de: a[campo] ?? null, para: b[campo] ?? null })
  }
  return diff
}

/**
 * POST /:id/governanca/comercial/revisao
 * Cria nova revisão comercial: clona o snapshot atual, gera diff, preserva
 * histórico e reabre o workflow (EM_ANALISE). Permite reabrir proposta ASSINADA.
 * Body: { usuario, motivo, snapshot_comercial (novo, opcional) }
 */
export const criarRevisaoComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })

    const { usuario = null, motivo = null, snapshot_comercial: novoSnap = null } = req.body || {}

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const revAtual = com.revisao_comercial_atual || 'A'
    const novaRev = _proximaRevComercial(revAtual)

    const revisoes = Array.isArray(com.revisoes_comerciais) ? [...com.revisoes_comerciais] : []
    const snapAnterior = com.snapshot_comercial || null
    const diff = _diffComercial(snapAnterior, novoSnap || snapAnterior)

    // Arquiva a revisão anterior (clone do snapshot)
    revisoes.push({
      rev: revAtual, timestamp: agora, usuario,
      motivo: motivo || 'Revisão comercial',
      diff,
      snapshot_comercial: snapAnterior,
    })

    com.revisoes_comerciais = revisoes
    com.revisao_comercial_atual = novaRev
    com.workflow_status = 'EM_ANALISE'
    com.status_juridico = 'EM_REVISAO'
    com.congelado_em = null
    com.aprovacao = null
    com.desconto_excecao = false
    com.assinaturas = []   // assinaturas anteriores ficam arquivadas na revisão
    if (novoSnap) com.snapshot_comercial = novoSnap
    com.historico.push({
      timestamp: agora, usuario, acao: 'revisao_comercial',
      detalhe: `Revisão comercial ${revAtual} → ${novaRev}. Proposta reaberta (EM_ANALISE).${motivo ? ' Motivo: ' + motivo : ''}`,
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, revisao_atual: novaRev, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao criar revisão comercial:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S4.3.1 — GOVERNANÇA INDIVIDUAL POR CENÁRIO + AUDITORIA REAL DE IP
// ═══════════════════════════════════════════════════════════════════════════════

// Extrai a trilha de IP real (trust proxy ativo → req.ip é o cliente).
function _ipReal(req) {
  const fwd = req.headers['x-forwarded-for'] || ''
  const proxy_chain = fwd ? fwd.split(',').map(s => s.trim()).filter(Boolean) : []
  const ip_real = req.ip || proxy_chain[0] || req.socket?.remoteAddress || null
  return { ip_real, forwarded_for: fwd || null, proxy_chain, user_agent: req.headers['user-agent'] || null }
}

// FV-UX-006 (F3.1): a normalização do vocabulário legado dos cenários (FV-UX-005 /
// defeito I-2) passou para a fonte única — `normalizarFreezeLegado`.
const _normalizarFreezeCenario = normalizarFreezeLegado

/**
 * Grava `freeze_status` num cenário rejeitando valor fora do vocabulário canônico.
 * O schema não protege este caminho (Mixed), então a validação é em runtime.
 */
function _definirFreezeCenario(cen, valor) {
  if (!ehFreezeStatusValido(valor)) {
    throw Object.assign(
      new Error(`freeze_status "${valor}" fora do vocabulário canônico: ${FREEZE_STATUS.join(', ')}`),
      { status: 422, codigo: 'FREEZE_STATUS_INVALIDO' },
    )
  }
  cen.freeze_status = valor
}

// Carrega/inicializa o objeto de governança de um cenário específico.
function _carregarCenarioGov(com, scenarioId) {
  const mapa = (com.cenarios_governanca && typeof com.cenarios_governanca === 'object')
    ? { ...com.cenarios_governanca } : {}
  const atual = mapa[scenarioId] || {
    scenario_id: scenarioId,
    freeze_status: 'RASCUNHO',          // vocabulário canônico (FREEZE_STATUS)
    workflow_status: 'EM_ANALISE',
    status_juridico: 'PENDENTE_ASSINATURA',
    snapshot_comercial: null,
    snapshot_financeiro: null,
    snapshot_regulatorio: null,
    hash: null,
    assinaturas: [],
    revisoes: [],
    timeline: [],
    revisao_atual: 'A',
    congelado_em: null,
  }
  // Garante arrays
  atual.assinaturas = Array.isArray(atual.assinaturas) ? [...atual.assinaturas] : []
  atual.revisoes = Array.isArray(atual.revisoes) ? [...atual.revisoes] : []
  atual.timeline = Array.isArray(atual.timeline) ? [...atual.timeline] : []
  // FV-UX-005 (F3.3): converte 'EDITAVEL' legado para o canônico ao carregar.
  atual.freeze_status = _normalizarFreezeCenario(atual.freeze_status)
  return { mapa, cen: atual }
}

async function _salvarCenario(projeto, govObj, com, mapa, cen, res) {
  mapa[cen.scenario_id] = cen
  com.cenarios_governanca = mapa
  projeto.governanca = { ...govObj, comercial: com }
  await projeto.save()
  res.json({ sucesso: true, scenario_id: cen.scenario_id, cenario: cen, comercial: projeto.governanca.comercial })
}

/**
 * POST /:id/governanca/comercial/cenario/freeze
 * Congela UM cenário (os demais permanecem editáveis).
 * Body: { scenario_id, snapshots:{comercial,financeiro,regulatorio}, hash, usuario }
 */
export const congelarCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, snapshots = {}, hash = null, usuario = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()

    if (cen.freeze_status === 'CONGELADO') {
      return res.status(409).json({ erro: `Cenário ${scenario_id} já está CONGELADO — crie revisão para alterar.`, codigo: 'CENARIO_CONGELADO' })
    }

    _definirFreezeCenario(cen, 'CONGELADO')
    cen.congelado_em = agora
    cen.hash = hash || cen.hash
    if (snapshots.comercial   != null) cen.snapshot_comercial   = snapshots.comercial
    if (snapshots.financeiro  != null) cen.snapshot_financeiro  = snapshots.financeiro
    if (snapshots.regulatorio != null) cen.snapshot_regulatorio = snapshots.regulatorio
    cen.timeline.push({ timestamp: agora, usuario, acao: 'congelamento', detalhe: `Cenário ${scenario_id} congelado individualmente.` })
    com.historico.push({ timestamp: agora, usuario, acao: 'cenario_congelado', detalhe: `Cenário ${scenario_id} congelado.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro ao congelar cenário:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * PUT /:id/governanca/comercial/cenario/workflow
 * Workflow individual do cenário (valida transição na mesma máquina de estados).
 * Body: { scenario_id, status, usuario }
 */
export const workflowCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, status, usuario = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })
    if (!WORKFLOW_COMERCIAL.includes(status)) return res.status(400).json({ erro: `status inválido` })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const anterior = cen.workflow_status || 'EM_ANALISE'

    const val = _validarTransicaoComercial(anterior, status)
    if (!val.ok) return res.status(409).json({ erro: val.motivo, codigo: val.requer_revisao ? 'REQUER_REVISAO' : 'TRANSICAO_INVALIDA' })

    const agora = new Date()
    cen.workflow_status = status
    cen.status_juridico = _statusJuridicoDeEstado(status)
    if (CONGELADOS_COMERCIAL.includes(status)) { _definirFreezeCenario(cen, 'CONGELADO'); cen.congelado_em = cen.congelado_em || agora }
    cen.timeline.push({ timestamp: agora, usuario, acao: 'workflow', detalhe: `Cenário ${scenario_id}: ${anterior} → ${status}.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro no workflow do cenário:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/cenario/assinatura
 * Assinatura individual do cenário com IP real e cadeia de auditoria.
 * Body: { scenario_id, papel, nome, hash, hash_documento, hash_snapshot, hash_cenario, usuario }
 */
export const assinarCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, papel, nome, hash, hash_documento = null, hash_snapshot = null, hash_cenario = null, algoritmo = 'sha256', usuario = null } = req.body || {}
    const PAPEIS = ['cliente', 'vendedor', 'tecnico']
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })
    if (!PAPEIS.includes(papel)) return res.status(400).json({ erro: `papel deve ser: ${PAPEIS.join(', ')}` })
    if (!nome || !hash) return res.status(400).json({ erro: 'nome e hash são obrigatórios' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()
    const aud = _ipReal(req)
    const assinatura_id = `SIG-${scenario_id}-${papel.toUpperCase()}-${agora.getTime().toString(36)}`

    cen.assinaturas = cen.assinaturas.filter(a => a.papel !== papel)
    cen.assinaturas.push({
      assinatura_id, papel, nome, hash, algoritmo,
      hash_documento, hash_snapshot, hash_cenario,
      ip: aud.ip_real, ip_real: aud.ip_real, forwarded_for: aud.forwarded_for, proxy_chain: aud.proxy_chain,
      user_agent: aud.user_agent, timestamp: agora,
    })
    cen.timeline.push({ timestamp: agora, usuario: usuario || nome, acao: 'assinatura', detalhe: `Assinatura ${papel} (${nome}) no cenário ${scenario_id}. IP ${aud.ip_real || '—'}.` })

    const papeisAssinados = new Set(cen.assinaturas.map(a => a.papel))
    if (PAPEIS.every(p => papeisAssinados.has(p))) {
      cen.workflow_status = 'ASSINADO'
      cen.status_juridico = 'ASSINADO'
      _definirFreezeCenario(cen, 'CONGELADO')
      cen.congelado_em = cen.congelado_em || agora
      cen.timeline.push({ timestamp: agora, usuario, acao: 'workflow', detalhe: `Cenário ${scenario_id} ASSINADO (todas as assinaturas).` })
    }

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro ao assinar cenário:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/cenario/revisao
 * Revisão individual do cenário (não afeta os outros cenários).
 * Body: { scenario_id, usuario, motivo }
 */
export const revisaoCenarioComercial = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { scenario_id, usuario = null, motivo = null } = req.body || {}
    if (!scenario_id) return res.status(400).json({ erro: 'scenario_id é obrigatório' })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const { mapa, cen } = _carregarCenarioGov(com, scenario_id)
    const agora = new Date()
    const revAtual = cen.revisao_atual || 'A'
    const novaRev = _proximaRevComercial(revAtual)

    cen.revisoes.push({
      rev: revAtual, timestamp: agora, usuario, motivo: motivo || 'Revisão de cenário',
      snapshot_comercial: cen.snapshot_comercial || null,
    })
    cen.revisao_atual = novaRev
    // FV-UX-005 (F3.3): revisão reabre o cenário — 'EDITAVEL' era o vocabulário
    // paralelo; o equivalente canônico de 'reaberto após revisão' é EM_REVISAO.
    _definirFreezeCenario(cen, 'EM_REVISAO')
    cen.workflow_status = 'EM_ANALISE'
    cen.status_juridico = 'EM_REVISAO'
    cen.congelado_em = null
    cen.assinaturas = []
    cen.timeline.push({ timestamp: agora, usuario, acao: 'revisao', detalhe: `Cenário ${scenario_id}: revisão ${revAtual} → ${novaRev}. Reaberto.` })

    await _salvarCenario(projeto, govObj, com, mapa, cen, res)
  } catch (err) {
    console.error('❌ Erro na revisão do cenário:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// S5 — CRM OPERACIONAL LEVE + COMUNICAÇÃO AUDITÁVEL
// Reutiliza governanca.comercial.historico como timeline ÚNICA (sem paralelas).
// ═══════════════════════════════════════════════════════════════════════════════

const CRM_PIPELINE = ['LEAD', 'QUALIFICADO', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO', 'IMPLANTACAO']

/**
 * PUT /:id/governanca/comercial/crm
 * Atualiza pipeline CRM e follow-up. Alimenta o historico (timeline única).
 * Body: { crm_pipeline, followup:{status,data,observacao}, usuario }
 */
export const atualizarCrm = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { crm_pipeline = null, followup = null, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()

    if (crm_pipeline) {
      if (!CRM_PIPELINE.includes(crm_pipeline)) return res.status(400).json({ erro: `crm_pipeline inválido` })
      const anterior = com.crm_pipeline || 'LEAD'
      com.crm_pipeline = crm_pipeline
      if (anterior !== crm_pipeline) {
        com.historico.push({ timestamp: agora, usuario, acao: 'crm_pipeline', detalhe: `Pipeline CRM: ${anterior} → ${crm_pipeline}.` })
      }
    }
    if (followup) {
      com.followup = {
        status: followup.status ?? com.followup?.status ?? null,
        data: followup.data ?? com.followup?.data ?? null,
        observacao: followup.observacao ?? com.followup?.observacao ?? null,
      }
      com.historico.push({ timestamp: agora, usuario, acao: 'followup', detalhe: `Follow-up: ${followup.status || ''}${followup.observacao ? ' — ' + followup.observacao : ''}.` })
    }

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao atualizar CRM:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/comunicacao
 * Registra uma comunicação auditável (whatsapp/email/share/followup).
 * Body: { canal, destinatario, cenario_id, revisao, snapshot_hash, resumo, usuario }
 */
export const registrarComunicacao = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { canal, destinatario = null, cenario_id = null, revisao = null, snapshot_hash = null, resumo = null, usuario = null } = req.body || {}
    const CANAIS = ['whatsapp', 'email', 'compartilhamento', 'followup', 'outro']
    if (!CANAIS.includes(canal)) return res.status(400).json({ erro: `canal deve ser: ${CANAIS.join(', ')}` })

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)
    const agora = new Date()
    const partes = [`Comunicação via ${canal}`]
    if (destinatario) partes.push(`para ${destinatario}`)
    if (cenario_id) partes.push(`cenário ${cenario_id}`)
    if (revisao) partes.push(`Rev ${revisao}`)
    if (resumo) partes.push(`— ${resumo}`)

    com.historico.push({
      timestamp: agora, usuario, acao: `comunicacao_${canal}`,
      detalhe: partes.join(' '),
      contexto: { canal, destinatario, cenario_id, revisao, snapshot_hash },
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao registrar comunicação:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /:id/governanca/comercial/compartilhar
 * Cria um link público seguro que abre o SNAPSHOT CONGELADO (somente leitura).
 * Engineering lock: exige snapshot congelado (global ou de cenário). Nunca dinâmico.
 * Body: { cenario_id, validade_dias, usuario }
 */
export const criarCompartilhamento = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ erro: 'ID inválido' })
    const { cenario_id = null, validade_dias = 30, usuario = null } = req.body || {}

    const projeto = await ProjetoFV.findOne(aplicarEscopo({ _id: id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })

    const { govObj, com } = _carregarComercial(projeto.governanca)

    // Determina o snapshot congelado a compartilhar
    let snapshot = null, hash = null, revisao = com.revisao_comercial_atual || 'A', freezeOk = false
    if (cenario_id) {
      const cg = (com.cenarios_governanca || {})[cenario_id]
      if (cg && cg.freeze_status === 'CONGELADO') {
        snapshot = { tipo: 'cenario', cenario_id, comercial: cg.snapshot_comercial, financeiro: cg.snapshot_financeiro, regulatorio: cg.snapshot_regulatorio }
        hash = cg.hash || null
        revisao = cg.revisao_atual || revisao
        freezeOk = true
      }
    } else if (com.snapshot_comercial && CONGELADOS_COMERCIAL.includes(com.workflow_status)) {
      snapshot = { tipo: 'global', comercial: com.snapshot_comercial }
      hash = com.snapshot_comercial?.hash || null
      freezeOk = true
    }

    if (!freezeOk) {
      return res.status(409).json({
        erro: 'Congele a proposta (ou o cenário) antes de compartilhar. O link público sempre abre um snapshot congelado.',
        codigo: 'SEM_SNAPSHOT_CONGELADO',
      })
    }

    const agora = new Date()
    const token = `${id.slice(-6)}${agora.getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const share_id = `SHARE-${agora.getTime().toString(36)}`
    const validade = new Date(agora.getTime() + (Number(validade_dias) || 30) * 86400000)

    com.compartilhamentos = Array.isArray(com.compartilhamentos) ? [...com.compartilhamentos] : []
    com.compartilhamentos.push({
      share_id, token, cenario_id, revisao, snapshot_hash: hash,
      criado_em: agora, criado_por: usuario, validade, somente_leitura: true,
      snapshot,
      tracking: { visualizacoes: 0, primeiro_acesso: null, ultimo_acesso: null, acessos: [] },
    })
    com.historico.push({
      timestamp: agora, usuario, acao: 'comunicacao_compartilhamento',
      detalhe: `Link compartilhável criado${cenario_id ? ' (cenário ' + cenario_id + ')' : ''}, Rev ${revisao}, validade ${validade.toLocaleDateString('pt-BR')}.`,
      contexto: { share_id, cenario_id, revisao, snapshot_hash: hash },
    })

    projeto.governanca = { ...govObj, comercial: com }
    await projeto.save()
    res.json({ sucesso: true, share_id, token, validade, comercial: projeto.governanca.comercial })
  } catch (err) {
    console.error('❌ Erro ao criar compartilhamento:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * GET /api/publico/proposta/:token  (rota pública, sem auth)
 * Retorna o snapshot CONGELADO do compartilhamento e registra tracking leve.
 * NUNCA recalcula — apenas devolve o snapshot persistido.
 */
export const obterPropostaPublica = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { token } = req.params
    if (!token) return res.status(400).json({ erro: 'token ausente' })

    // EXCEÇÃO DELIBERADA A M-4 — rota PÚBLICA (/api/publico/proposta/:token),
    // sem autenticação por design: o token de compartilhamento É a credencial.
    // Aplicar escopo de organização aqui quebraria o compartilhamento de proposta
    // com o cliente final, que não possui login. O token é aleatório, single-purpose
    // e só expõe a proposta à qual pertence — não há travessia entre organizações.
    const projeto = await ProjetoFV.findOne(
      { 'governanca.comercial.compartilhamentos.token': token }
    )
      .populate('clienteId', 'nome email telefone')
      .populate('vendedor_id', 'nome telefone email')
      .populate('tecnico_principal_id', 'nome tipo_registro registro uf modalidade')
    if (!projeto) return res.status(404).json({ erro: 'Proposta não encontrada ou link inválido.' })

    const com = projeto.governanca?.comercial
    const share = (com?.compartilhamentos || []).find(s => s.token === token)
    if (!share) return res.status(404).json({ erro: 'Compartilhamento não encontrado.' })

    if (share.validade && new Date(share.validade) < new Date()) {
      return res.status(410).json({ erro: 'Este link expirou.', codigo: 'LINK_EXPIRADO', expirado_em: share.validade })
    }

    // Tracking leve
    const agora = new Date()
    const ip = _ipReal(req).ip_real
    share.tracking = share.tracking || { visualizacoes: 0, acessos: [] }
    share.tracking.visualizacoes = (share.tracking.visualizacoes || 0) + 1
    share.tracking.ultimo_acesso = agora
    if (!share.tracking.primeiro_acesso) share.tracking.primeiro_acesso = agora
    share.tracking.acessos = Array.isArray(share.tracking.acessos) ? share.tracking.acessos : []
    if (share.tracking.acessos.length < 200) share.tracking.acessos.push({ timestamp: agora, ip })
    projeto.markModified('governanca.comercial.compartilhamentos')
    await projeto.save()

    res.json({
      sucesso: true,
      somente_leitura: true,
      cliente: projeto.clienteId ? { nome: projeto.clienteId.nome } : null,
      projeto_nome: projeto.nome,
      // S7.1: identidade institucional congelada (logo/nome/RT)
      empresa: projeto.governanca?.snapshot_empresa ?? null,
      responsavel_tecnico: projeto.governanca?.snapshot_tecnico_identificacao ?? null,
      // S7.2.1: equipe responsável (técnico/vendedor do projeto)
      vendedor: projeto.vendedor_id ? { nome: projeto.vendedor_id.nome } : null,
      tecnico: projeto.tecnico_principal_id ? {
        nome: projeto.tecnico_principal_id.nome,
        registro: `${projeto.tecnico_principal_id.tipo_registro || ''} ${projeto.tecnico_principal_id.registro || ''}`.trim(),
      } : null,
      cenario_id: share.cenario_id,
      revisao: share.revisao,
      snapshot_hash: share.snapshot_hash,
      criado_em: share.criado_em,
      validade: share.validade,
      snapshot: share.snapshot,   // snapshot congelado — fonte única de verdade
    })
  } catch (err) {
    console.error('❌ Erro ao obter proposta pública:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

// ─── FV-DOM-032 · Opções concorrentes da mesma proposta ──────────────────────
//
// A auditoria da sprint mediu o impedimento: duas opções não cabem num
// ProjetoFV só. Oito campos são únicos no documento e os agregados travam por
// projeto (`unico_aprovado_por_projeto`, `unico_baseline_por_projeto`). Cada
// opção é, então, um ProjetoFV COMPLETO — mesmo padrão que `ampliarProjetoFV`
// já usa em produção, com duas diferenças:
//
//   • o vínculo é `proposta_grupo_id` (PARES) e não `projeto_origem_id`
//     (derivação), para que nenhuma opção seja privilegiada;
//   • nada técnico é herdado: composição, dimensionamento, engenharia,
//     estrutura e documentos nascem vazios e são próprios da opção.

/** Campos que NENHUMA opção herda: são o estado técnico e contratual próprio. */
const _NAO_HERDADOS_POR_OPCAO = [
  '_id', 'createdAt', 'updatedAt', '__v',
  'governanca', 'documentos', 'documentos_tecnicos',
  'excluido', 'excluido_em', 'excluido_por',
  'arquivado_em', 'arquivado_por', 'motivo_arquivamento',
  'financeiro', 'equipamentos', 'arranjos', 'dimensionamento',
  'engenharia_eletrica', 'unifilar', 'strings', 'layout_solar',
  'homologacao', 'proposta', 'proposta_aceite', 'workflow',
  'instalacao_ref', 'orcamento',
]

/** Rótulo estável da opção. "Opção 01", "Opção 02"… */
const _rotuloDaOpcao = (n) => `Opção ${String(n).padStart(2, '0')}`

/**
 * POST /api/projetos-fv/:id/opcoes — cria uma opção irmã.
 *
 * A primeira chamada converte o projeto de origem na Opção 01 (carimba grupo,
 * número e rótulo) e cria a Opção 02. As seguintes só acrescentam.
 */
export const criarOpcaoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const base = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!base) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (base.excluido) return res.status(400).json({ erro: 'Não é possível criar opção de projeto excluído.' })
    if (base.tipo_projeto === 'ampliacao') {
      return res.status(400).json({
        erro: 'Ampliação não recebe opções concorrentes — são relações diferentes.',
        codigo: 'AMPLIACAO_NAO_TEM_OPCOES',
      })
    }

    // Grupo: o que já existe, ou um novo carimbado também no projeto de origem.
    let grupo = base.proposta_grupo_id
    if (!grupo) {
      grupo = new mongoose.Types.ObjectId()
      base.proposta_grupo_id = grupo
      base.tipo_projeto = 'opcao'
      base.opcao_numero = 1
      base.opcao_rotulo = _rotuloDaOpcao(1)
      await base.save()
    }

    const irmas = await ProjetoFV.find(
      aplicarEscopo({ proposta_grupo_id: grupo, excluido: { $ne: true } }, req,
        { contexto: 'projetoFV.opcoes' })).lean()
    const numero = Math.max(0, ...irmas.map((p) => Number(p.opcao_numero) || 0)) + 1

    const orig = base.toObject()
    const heranca = { ...orig }
    for (const campo of _NAO_HERDADOS_POR_OPCAO) delete heranca[campo]

    const nomeBase = String(orig.nome || 'Projeto').replace(/\s*—\s*Opção \d+\s*$/i, '')
    const nova = {
      ...heranca,                       // cliente, fatura, consumo, concessionária, localização
      nome: `${nomeBase} — ${_rotuloDaOpcao(numero)}`,
      tipo_projeto: 'opcao',
      proposta_grupo_id: grupo,
      opcao_numero: numero,
      opcao_rotulo: req.body?.rotulo || _rotuloDaOpcao(numero),
      status: 'rascunho',
      // Estado técnico e contratual NASCE VAZIO — nada é compartilhado.
      equipamentos: { paineis: [], inversor: {}, estrutura: {} },
      arranjos: [],
      governanca: null,
      financeiro: null,
      proposta_aceite: { aceita: false, aceita_em: null, aceita_por: null, motivo: null },
      excluido: false, excluido_em: null, excluido_por: null,
      arquivado_em: null, arquivado_por: null, motivo_arquivamento: null,
      legacy: false, necessita_revisao: false,
    }

    const criada = await ProjetoFV.create(
      carimbarTenant(nova, req, { contexto: 'projetoFV.opcao' }))
    auditarCiclo(req, 'PROJETO_OPCAO_CRIADA', criada._id, `grupo=${grupo} numero=${numero}`)

    res.status(201).json({
      sucesso: true,
      item: enriquecer(criada),
      proposta_grupo_id: grupo,
      opcao_numero: numero,
      total_opcoes: irmas.length + 1,
    })
  } catch (err) {
    console.error('❌ Erro ao criar opção FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/** GET /api/projetos-fv/:id/opcoes — as irmãs do grupo, na ordem. */
export const listarOpcoesFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const base = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).lean()
    if (!base) return res.status(404).json({ mensagem: 'Projeto não encontrado' })
    if (!base.proposta_grupo_id) {
      return res.json({ sucesso: true, proposta_grupo_id: null, opcoes: [], aceita: null })
    }
    const opcoes = await ProjetoFV.find(
      aplicarEscopo({ proposta_grupo_id: base.proposta_grupo_id, excluido: { $ne: true } },
        req, { contexto: 'projetoFV.opcoes' }))
      .select('nome tipo_projeto opcao_numero opcao_rotulo proposta_aceite status '
        + 'dimensionamento.potencia_kwp dimensionamento.num_paineis '
        + 'equipamentos.inversor equipamentos.paineis equipamentos.estrutura '
        + 'arranjos.topologia arranjos.paineis arranjos.inversores '
        + 'arranjos.configuracao_eletrica.micros engenharia_eletrica.arranjo.mppts')
      .sort({ opcao_numero: 1 }).lean()

    /**
     * FV-UX-033 (item 8) — orçamento, Baseline e Gate de CADA opção.
     *
     * Vem daqui, e não da listagem de projetos, por dois motivos: este endpoint
     * já é o leitor canônico do grupo, e enriquecer `GET /api/projetos-fv`
     * cobraria estas três consultas de TODO projeto, inclusive os que não são
     * opção. Nenhum estado novo é derivado — cada campo é lido de quem já o
     * possui, e o Gate é a MESMA decisão que bloqueia no domínio.
     */
    const { BaselineService } = await import('../services/BaselineService.js')
    const tenant = tenantDoReq(req)
    const detalhados = await Promise.all(opcoes.map(async (o) => {
      const filtro = { projeto_ref: o._id, empresa_id: tenant }
      const [orc, baseline, gEng] = await Promise.all([
        OrcamentoService.vigenteDoProjeto(filtro).catch(() => null),
        BaselineService.doProjeto(filtro).catch(() => null),
        BaselineService.avaliarGate('engenharia', filtro).catch(() => null),
      ])
      const composicao = composicaoDoProjeto(o)
      // ── F14-3C · topologia resolvida pelo ADAPTER ──────────────────────────
      //
      // Antes, aqui:
      //
      //   const arranjo = (o.arranjos ?? [])[0] ?? null
      //   const topologia = arranjo?.configuracao_eletrica?.micros?.length ? 'micro'
      //     : (arranjo?.topologia ?? (o.engenharia_eletrica?.arranjo?.mppts?.length ? 'string' : null))
      //
      // Era a MESMA expressão de `EnvioPropostaService`, copiada — e o fato de
      // existir duas vezes é o que fazia a regra divergir sozinha. Migrado na
      // F14-3B lá, aqui agora; a precedência vive no adapter desde a F14-3A:
      //   micros[] > arranjo.topologia > LEGADO atribuível > ausência.
      //
      // `topologiaProjeto.efetiva` deriva de TODOS os arranjos. Unânime entre os
      // conhecidos devolve o valor; classificações diferentes devolvem `null`,
      // em vez de mostrar a do primeiro como se fosse a do sistema.
      //
      // O `.select()` acima NÃO foi ampliado: o rótulo não depende de
      // `arranjos.id` nem de `arranjos.tipo`, e este retorno faz `{ ...o }` —
      // campo a mais no `select` viraria campo a mais na resposta.
      const topologia = arranjosCanonicos(o).topologiaProjeto.efetiva
      return {
        ...o,
        topologia,
        // FV-UX-038 (D1): a quantidade e a pluralidade vêm da composição
        // canônica, não de `equipamentos.inversor` — que é objeto único e não
        // persiste `quantidade`. `inversor` continua na resposta como resumo
        // legível; quem precisa da verdade usa `inversores[]`.
        inversores: composicao.inversores,
        inversor: composicao.inversores.length === 1
          ? composicao.inversores[0].modelo
          : (composicao.inversores.length > 1
            ? `${composicao.inversores.length} modelos`
            : null),
        estrutura: o.equipamentos?.estrutura?.tipo ?? null,
        // FV-UX-035: `orc.totais` nunca existiu — totais são derivados a cada
        // leitura (INV-58), e este read devolvia `null` desde a FV-UX-033.
        orcamento: orc ? { estado: orc.estado, numero: orc.numero, versao: orc.versao,
          total_venda_r: totaisDeItens(orc.itens).total_venda_r } : null,
        baseline: baseline ? { hash: baseline.hash, congelado_em: baseline.congelado_em } : null,
        gate: gEng ? { liberado: gEng.liberado, motivo: gEng.motivo ?? null } : null,
      }
    }))

    res.json({
      sucesso: true,
      proposta_grupo_id: base.proposta_grupo_id,
      opcoes: detalhados,
      aceita: detalhados.find((o) => o.proposta_aceite?.aceita) ?? null,
    })
  } catch (err) {
    console.error('❌ Erro ao listar opções FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /api/projetos-fv/:id/proposta/aceitar — regra 4.
 *
 * Ato SEPARADO da aprovação do orçamento (regra 3). Escolhe UMA opção do grupo;
 * as demais continuam existindo, consultáveis, com Baseline intacta (regras 6 e
 * 7) e bloqueadas apenas no Gate (regras 5 e 9).
 */
export const aceitarOpcaoDaProposta = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // FV-UX-035 — a decisão é do domínio, não deste controller. O caminho
    // PÚBLICO (`aceitarPropostaPublica`) chama exatamente as mesmas funções:
    // "não criar um segundo mecanismo de aceite".
    const irmas = projeto.proposta_grupo_id
      ? await ProjetoFV.find(aplicarEscopo({
        proposta_grupo_id: projeto.proposta_grupo_id, excluido: { $ne: true },
      }, req, { contexto: 'projetoFV.opcoes' })).select('_id nome opcao_rotulo proposta_aceite').lean()
      : []
    const envio = await EnvioPropostaService.estadoDeEnvio({
      projeto, empresaId: tenantDoReq(req),
    })

    const { repetido } = exigirAceitavel({ opcao: projeto, irmas, envio, origem: 'interno' })
    if (!repetido) {
      projeto.proposta_aceite = montarEvidenciaAceite({
        origem: 'interno',
        usuario: req.auth?.id || req.auth?.email || req.body?.usuario || null,
        motivo: req.body?.motivo || null,
        ip: _ipReal(req).ip_real,
        envio,
      })
      await projeto.save()
      auditarCiclo(req, 'PROPOSTA_OPCAO_ACEITA', projeto._id,
        `grupo=${projeto.proposta_grupo_id} opcao=${projeto.opcao_numero} origem=interno`)
    }

    res.json({
      sucesso: true,
      item: enriquecer(projeto),
      aceita_em: projeto.proposta_aceite.aceita_em,
      repetido,
    })
  } catch (err) {
    if (err instanceof ErroProposta) {
      return res.status(err.status).json({
        erro: err.message, codigo: err.codigo,
        ...(err.aceita_ref ? { aceita_ref: err.aceita_ref } : {}),
      })
    }
    // O índice parcial `unica_opcao_aceita_por_proposta` é a última linha:
    // duas requisições simultâneas passam pela leitura, só uma passa no banco.
    if (err?.code === 11000) {
      return res.status(409).json({
        erro: 'A proposta já tem uma opção aceita.',
        codigo: 'PROPOSTA_JA_ACEITA',
      })
    }
    console.error('❌ Erro ao aceitar opção da proposta:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * POST /api/projetos-fv/:id/proposta/enviar — FV-UX-035.
 *
 * Disponibiliza a proposta INTEIRA (todas as opções do grupo) ao cliente, num
 * único link. Depois disto — e só depois — o aceite é possível.
 */
export const enviarPropostaFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
      .populate('clienteId', 'nome email')
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    const resultado = await EnvioPropostaService.enviarProposta({
      projeto,
      empresaId: tenantDoReq(req),
      cliente: projeto.clienteId ?? null,
      validade_dias: req.body?.validade_dias,
      destinatario: req.body?.destinatario ?? null,
      usuario: req.auth?.id || req.auth?.email || null,
    })
    auditarCiclo(req, 'PROPOSTA_ENVIADA', projeto._id,
      `grupo=${projeto.proposta_grupo_id} share=${resultado.share_id} `
      + `opcoes=${resultado.opcoes} email=${resultado.email.enviado}`)

    res.json({ sucesso: true, ...resultado })
  } catch (err) {
    if (err instanceof ErroProposta) {
      return res.status(err.status).json({ erro: err.message, codigo: err.codigo })
    }
    console.error('❌ Erro ao enviar proposta:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * GET /api/projetos-fv/:id/proposta/envio — estado do envio (leitura interna).
 */
export const obterEnvioDaProposta = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' })).lean()
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // FV-UX-038 (D4): o envio é do GRUPO — o tracking também. Lê-lo só desta
    // irmã reportava 0 visualizações mesmo com o cliente tendo aberto o link.
    const envio = avaliarEnvio({
      grupoId: projeto.proposta_grupo_id,
      compartilhamentos: await EnvioPropostaService.compartilhamentosDoGrupo({
        projeto, empresaId: tenantDoReq(req),
      }),
    })
    res.json({
      sucesso: true,
      enviada: envio.enviada,
      vigente: envio.vigente,
      envios: envio.envios,
      // O link é devolvido para que o operador possa reenviá-lo por outro meio.
      ultimo: envio.ultimo ? {
        share_id: envio.ultimo.share_id,
        token: envio.ultimo.token,
        // FV-INFRA-058: mesma origem que gerou o link no envio, pela fonte única.
        url: urlPublica(`/proposta/${envio.ultimo.token}`),
        criado_em: envio.ultimo.criado_em,
        validade: envio.ultimo.validade,
        snapshot_hash: envio.ultimo.snapshot_hash,
        visualizacoes: envio.ultimo.tracking?.visualizacoes ?? 0,
        primeiro_acesso: envio.ultimo.tracking?.primeiro_acesso ?? null,
        ultimo_acesso: envio.ultimo.tracking?.ultimo_acesso ?? null,
      } : null,
    })
  } catch (err) {
    console.error('❌ Erro ao ler envio da proposta:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * GET /api/publico/proposta-fv/:token — página do cliente (SEM auth).
 *
 * EXCEÇÃO DELIBERADA A M-4, pelo mesmo motivo já documentado em
 * `obterPropostaPublica`: o token É a credencial, e o cliente final não tem
 * login. A rota é irmã daquela, não substituta — a legada continua servindo os
 * compartilhamentos do wizard. Esta serve o envio canônico, que é por GRUPO.
 *
 * NUNCA recalcula: devolve o snapshot congelado no envio.
 */
export const obterPropostaFVPublica = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { token } = req.params
    if (!token) return res.status(400).json({ erro: 'token ausente' })

    const projeto = await ProjetoFV.findOne({
      'governanca.comercial.compartilhamentos.token': token,
    })
    if (!projeto) return res.status(404).json({ erro: 'Proposta não encontrada ou link inválido.' })

    const shares = projeto.governanca?.comercial?.compartilhamentos ?? []
    const share = shares.find((s) => s.token === token)
    if (!share || !ehEnvioCanonico(share, projeto.proposta_grupo_id)) {
      return res.status(404).json({ erro: 'Compartilhamento não encontrado.' })
    }
    if (!envioVigente(share)) {
      return res.status(410).json({
        erro: 'Este link expirou.', codigo: MOTIVOS_PROPOSTA.ENVIO_EXPIRADO,
        expirado_em: share.validade,
      })
    }

    // Tracking leve — mesmo comportamento da rota pública legada.
    const agora = new Date()
    const ip = _ipReal(req).ip_real
    share.tracking = share.tracking || { visualizacoes: 0, acessos: [] }
    share.tracking.visualizacoes = (share.tracking.visualizacoes || 0) + 1
    share.tracking.ultimo_acesso = agora
    if (!share.tracking.primeiro_acesso) share.tracking.primeiro_acesso = agora
    share.tracking.acessos = Array.isArray(share.tracking.acessos) ? share.tracking.acessos : []
    if (share.tracking.acessos.length < 200) share.tracking.acessos.push({ timestamp: agora, ip })
    projeto.markModified('governanca.comercial.compartilhamentos')
    await projeto.save()

    // Qual opção já foi aceita, se alguma — o cliente precisa ver a própria escolha.
    const aceita = await ProjetoFV.findOne({
      proposta_grupo_id: projeto.proposta_grupo_id,
      'proposta_aceite.aceita': true, excluido: { $ne: true },
    }).select('_id opcao_numero opcao_rotulo proposta_aceite').lean()

    res.json({
      sucesso: true,
      somente_leitura: false,   // esta página aceita — decisão da FV-UX-035
      empresa: projeto.governanca?.snapshot_empresa ?? null,
      criado_em: share.criado_em,
      validade: share.validade,
      snapshot_hash: share.snapshot_hash,
      snapshot: share.snapshot,     // proposta congelada — fonte única
      aceita: aceita ? {
        projeto_ref: String(aceita._id),
        opcao_rotulo: aceita.opcao_rotulo,
        aceita_em: aceita.proposta_aceite?.aceita_em ?? null,
      } : null,
    })
  } catch (err) {
    console.error('❌ Erro ao abrir proposta pública FV:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /api/publico/proposta-fv/:token/aceitar — o CLIENTE aceita (SEM auth).
 *
 * Converge para o MESMO domínio do aceite interno — `exigirAceitavel` e
 * `montarEvidenciaAceite`. A decisão de negócio foi explícita: "não criar um
 * segundo mecanismo de aceite". O que muda é só a evidência: aqui a origem é
 * `cliente` e a credencial registrada é o token, não um usuário.
 */
export const aceitarPropostaFVPublica = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const { token } = req.params
    const { projeto_ref } = req.body || {}
    if (!token) return res.status(400).json({ erro: 'token ausente' })
    if (!mongoose.Types.ObjectId.isValid(projeto_ref ?? '')) {
      return res.status(400).json({ erro: 'Informe a opção escolhida (`projeto_ref`).' })
    }

    // O token identifica o GRUPO; a opção escolhida tem de pertencer a ele.
    const portador = await ProjetoFV.findOne({
      'governanca.comercial.compartilhamentos.token': token,
    }).select('proposta_grupo_id governanca.comercial.compartilhamentos empresa_id').lean()
    if (!portador) return res.status(404).json({ erro: 'Proposta não encontrada ou link inválido.' })

    const share = (portador.governanca?.comercial?.compartilhamentos ?? [])
      .find((s) => s.token === token)
    if (!share || !ehEnvioCanonico(share, portador.proposta_grupo_id)) {
      return res.status(404).json({ erro: 'Compartilhamento não encontrado.' })
    }

    const escolhida = await ProjetoFV.findOne({
      _id: projeto_ref,
      proposta_grupo_id: portador.proposta_grupo_id,
      excluido: { $ne: true },
    })
    if (!escolhida) {
      return res.status(404).json({
        erro: 'Opção não pertence a esta proposta.',
        codigo: MOTIVOS_PROPOSTA.OPCAO_FORA_DO_ENVIO,
      })
    }

    const irmas = await ProjetoFV.find({
      proposta_grupo_id: portador.proposta_grupo_id, excluido: { $ne: true },
    }).select('_id nome opcao_rotulo proposta_aceite').lean()
    const envio = avaliarEnvio({
      grupoId: portador.proposta_grupo_id,
      compartilhamentos: await EnvioPropostaService.compartilhamentosDoGrupo({
        projeto: portador, empresaId: portador.empresa_id ?? null,
      }),
    })

    const { repetido } = exigirAceitavel({ opcao: escolhida, irmas, envio, origem: 'cliente' })
    if (!repetido) {
      escolhida.proposta_aceite = montarEvidenciaAceite({
        origem: 'cliente',
        token,
        ip: _ipReal(req).ip_real,
        motivo: req.body?.motivo ?? null,
        envio,
      })
      await escolhida.save()
    }

    res.json({
      sucesso: true,
      repetido,
      opcao: { projeto_ref: String(escolhida._id), opcao_rotulo: escolhida.opcao_rotulo },
      aceita_em: escolhida.proposta_aceite.aceita_em,
    })
  } catch (err) {
    if (err instanceof ErroProposta) {
      return res.status(err.status).json({
        erro: err.message, codigo: err.codigo,
        ...(err.aceita_ref ? { aceita_ref: err.aceita_ref } : {}),
      })
    }
    if (err?.code === 11000) {
      return res.status(409).json({
        erro: 'A proposta já tem uma opção aceita.', codigo: MOTIVOS_PROPOSTA.PROPOSTA_JA_ACEITA,
      })
    }
    console.error('❌ Erro ao aceitar proposta pública FV:', err)
    res.status(err.status || 500).json({ erro: err.message, codigo: err.codigo })
  }
}

/**
 * ═══ Parecer de Acesso — FV-DOM-042 ════════════════════════════════════════
 *
 * O parecer pertence a um ProjetoFV que JÁ EXISTE (D2). Estes endpoints não
 * criam cliente nem projeto — foi exatamente esse contorno do fluxo que a
 * FV-UX-041 apontou no extrator legado.
 *
 * Fronteiras do contrato, cada uma no seu lugar:
 *   EXTRAÇÃO      fora daqui (nenhum provedor é chamado — D5)
 *   NORMALIZAÇÃO  `dominio/parecer`
 *   VALIDAÇÃO     `dominio/parecer`
 *   CONFIRMAÇÃO   `POST /parecer/confirmar` — o portão humano
 *   FLUXO         só depois da confirmação, e pelas etapas canônicas
 */

/**
 * POST /api/projetos-fv/:id/parecer — registra uma extração no projeto.
 *
 * O corpo traz os dados JÁ extraídos e o `metodo` DECLARADO. Nenhuma credencial
 * é descoberta nem usada automaticamente (D5): `llm_externo` só passa quando o
 * provedor está explicitamente configurado, e sem isso a resposta declara a
 * lacuna sem ter enviado documento nenhum para fora.
 */
export const registrarParecerFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // Já confirmado não é sobrescrito por uma extração nova (D4).
    if (projeto.parecer_extracao?.confirmado_pelo_usuario === true) {
      return res.status(409).json({
        erro: 'Este projeto já tem um parecer confirmado. Registrar outro apagaria a origem do dado.',
        codigo: MOTIVOS_PARECER.JA_CONFIRMADO,
      })
    }

    const envelope = montarEnvelope({
      bruto: req.body?.dados ?? req.body ?? {},
      metodo: req.body?.metodo,
      arquivo: req.body?.arquivo_original_nome ?? null,
      confianca: req.body?.confianca ?? null,
      // O provedor externo é uma capacidade DECLARADA pelo ambiente, nunca
      // descoberta a partir de uma chave achada por aí (D5).
      provedorConfigurado: process.env.PARECER_PROVEDOR_EXTERNO === 'habilitado',
    })

    projeto.parecer_extracao = envelope
    projeto.markModified('parecer_extracao')
    await projeto.save()
    auditarCiclo(req, 'PARECER_REGISTRADO', projeto._id,
      `metodo=${envelope.metodo} parecer=${envelope.numero_parecer ?? '—'}`)

    res.json({
      sucesso: true,
      estado: envelope.estado,
      numero_parecer: envelope.numero_parecer,
      emitido_em: envelope.emitido_em,
      dados: envelope.dados,
      validacao: envelope.validacao,
      // D4: o que o parecer diz × o que o projeto já afirma. Nada foi gravado
      // fora do envelope; conflito é informação, não decisão tomada.
      comparacao: compararComCanonico(envelope.dados, {
        cliente: {
          nome: projeto.fatura_extracao?.nome ?? null,
          cpf_cnpj: projeto.fatura_extracao?.cpf_cnpj ?? null,
        },
        uc: {
          numero_cliente: projeto.fatura_extracao?.numero_cliente ?? null,
          tipo_ligacao: projeto.fatura_extracao?.tipo_ligacao ?? null,
          tensao_v: projeto.fatura_extracao?.tensao_v ?? null,
        },
        concessionaria: projeto.fatura_extracao?.concessionaria ?? null,
      }),
    })
  } catch (err) {
    if (err instanceof ErroParecer) {
      return res.status(err.status).json({ erro: err.message, codigo: err.codigo })
    }
    console.error('❌ Erro ao registrar parecer:', err)
    res.status(500).json({ erro: err.message })
  }
}

/** GET /api/projetos-fv/:id/parecer — leitura do envelope. */
export const obterParecerFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
      .select('parecer_extracao fatura_extracao').lean()
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    const env = projeto.parecer_extracao ?? null
    res.json({
      sucesso: true,
      registrado: !!env?.estado,
      estado: env?.estado ?? null,
      confirmado: env?.confirmado_pelo_usuario === true,
      numero_parecer: env?.numero_parecer ?? null,
      emitido_em: env?.emitido_em ?? null,
      metodo: env?.metodo ?? null,
      confianca: env?.confianca ?? null,
      dados: env?.dados ?? null,
      validacao: env?.validacao ?? null,
    })
  } catch (err) {
    console.error('❌ Erro ao ler parecer:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * POST /api/projetos-fv/:id/parecer/confirmar — o portão humano.
 *
 * Até aqui os dados do parecer são CANDIDATOS. A confirmação não copia nada
 * para o projeto: ela declara que um humano conferiu. Levar o dado confirmado
 * para `equipamentos`/`arranjos`/`fatura` continua sendo ato explícito, pelas
 * etapas canônicas — nada é sobrescrito em silêncio (D4).
 */
export const confirmarParecerFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    const envelope = confirmarParecer(projeto.parecer_extracao, {
      usuario: req.auth?.id || req.auth?.email || req.body?.usuario || null,
    })
    projeto.parecer_extracao = envelope
    projeto.markModified('parecer_extracao')
    await projeto.save()
    auditarCiclo(req, 'PARECER_CONFIRMADO', projeto._id,
      `parecer=${envelope.numero_parecer ?? '—'} por=${envelope.confirmado_por ?? '—'}`)

    res.json({
      sucesso: true,
      estado: envelope.estado,
      confirmado_em: envelope.confirmado_em,
      confirmado_por: envelope.confirmado_por,
      // A confirmação NÃO move dado nenhum. Quem aplica é o operador, pelas etapas.
      aplicado_ao_projeto: false,
    })
  } catch (err) {
    if (err instanceof ErroParecer) {
      return res.status(err.status).json({ erro: err.message, codigo: err.codigo })
    }
    console.error('❌ Erro ao confirmar parecer:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * ═══ Conexão física da usina — FV-DOM-047 ══════════════════════════════════
 *
 * Registra o FATO de a usina estar ligada à rede. Não é homologação, não é
 * máquina de estado, e não produz efeito colateral nenhum: Gate, Baseline e
 * `projeto.status` seguem exatamente como estavam (FV-DOM-046/D2).
 *
 * ── Auditoria é obrigatória aqui ────────────────────────────────────────────
 * A máquina legada `homologacao.status` grava sem auditar — e é por isso que a
 * data e o autor de todo `conectado` existente se perderam para sempre
 * (FV-DOM-045 §1.7). O contrato desta sprint não tem `registrada_por`
 * justamente porque o autor passa a viver no `AuditLog`. Sem `auditarCiclo`
 * abaixo, repetiríamos o defeito que a auditoria encontrou.
 *
 * Autorização: `editar` em `fv`, aplicado pelo router (`protegerModulo`).
 * Nenhum controle novo — aprovar orçamento, que congela a Baseline e é
 * irreversível, também exige apenas `editar` (FV-DOM-046/D1).
 */

/** GET /api/projetos-fv/:id/conexao — o fato, as lacunas e a divergência. */
export const obterConexaoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
      .select('conexao homologacao.status_homologacao homologacao.status').lean()
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    const conexao = projeto.conexao ?? conexaoVazia()
    res.json({
      sucesso: true,
      conectada: estaConectada(conexao),
      conexao,
      lacunas: lacunasDaConexao(conexao),
      // DERIVADA a cada leitura — nunca persistida (INV-58).
      divergencia: avaliarDivergencia({
        conexao, statusHomologacao: projeto.homologacao?.status_homologacao ?? null,
      }),
      // Registro histórico da máquina legada, exibido como veio. Não é migrado
      // nem convertido: a data daquele valor nunca existiu (FV-DOM-045/D6).
      legado_conectado: projeto.homologacao?.status === 'conectado',
    })
  } catch (err) {
    console.error('❌ Erro ao ler conexão:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * PUT /api/projetos-fv/:id/conexao — registra ou corrige a conexão.
 *
 * Idempotente por natureza: o fato é um só, e corrigir a data é corrigir o
 * registro do mesmo fato — não é uma segunda conexão.
 */
export const registrarConexaoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    // Regra 5 da FV-DOM-032: a opção não escolhida nunca é construída. Lê o
    // estado da opção pelo MESMO domínio que o Gate usa — sem alterá-lo.
    const irmas = projeto.proposta_grupo_id
      ? await ProjetoFV.find(aplicarEscopo({
        proposta_grupo_id: projeto.proposta_grupo_id, excluido: { $ne: true },
      }, req, { contexto: 'projetoFV.opcoes' }))
        .select('_id proposta_grupo_id proposta_aceite opcao_rotulo').lean()
      : []
    exigirOpcaoEscolhida(estadoDaOpcao(projeto, irmas))

    const entrada = normalizarConexao(req.body ?? {})
    const data = exigirRegistroValido({ conectada_em: entrada.conectada_em })

    const antes = projeto.conexao?.conectada_em ?? null
    projeto.conexao = {
      conectada_em: data,
      numero_medidor: entrada.numero_medidor,
      observacoes: entrada.observacoes,
    }
    projeto.markModified('conexao')
    await projeto.save()

    // OBRIGATÓRIA — ver o cabeçalho desta seção.
    auditarCiclo(req, antes ? 'CONEXAO_CORRIGIDA' : 'CONEXAO_REGISTRADA', projeto._id,
      `${antes ? `${new Date(antes).toISOString()} → ` : ''}${data.toISOString()}`
      + `${entrada.numero_medidor ? ` medidor=${entrada.numero_medidor}` : ''}`)

    res.json({
      sucesso: true,
      conectada: true,
      conexao: projeto.conexao,
      lacunas: lacunasDaConexao(projeto.conexao),
      divergencia: avaliarDivergencia({
        conexao: projeto.conexao,
        statusHomologacao: projeto.homologacao?.status_homologacao ?? null,
      }),
      // O que esta operação deliberadamente NÃO fez.
      efeitos: { projeto_status: 'inalterado', gate: 'inalterado', baseline: 'inalterada' },
    })
  } catch (err) {
    if (err instanceof ErroConexao) {
      return res.status(err.status).json({ erro: err.message, codigo: err.codigo })
    }
    console.error('❌ Erro ao registrar conexão:', err)
    res.status(500).json({ erro: err.message })
  }
}

/**
 * DELETE /api/projetos-fv/:id/conexao — desfaz um registro equivocado.
 *
 * Não é "desconectar a usina" — é corrigir um lançamento errado. A remoção fica
 * na auditoria, como fica a do protocolo da concessionária.
 */
export const removerConexaoFV = async (req, res) => {
  try {
    if (!_exigirMongo(res)) return
    const projeto = await ProjetoFV.findOne(
      aplicarEscopo({ _id: req.params.id }, req, { contexto: 'projetoFV' }))
    if (!projeto) return res.status(404).json({ mensagem: 'Projeto não encontrado' })

    const antes = projeto.conexao?.conectada_em ?? null
    projeto.conexao = conexaoVazia()
    projeto.markModified('conexao')
    await projeto.save()
    auditarCiclo(req, 'CONEXAO_REMOVIDA', projeto._id,
      antes ? new Date(antes).toISOString() : '(não havia registro)')

    res.json({ sucesso: true, conectada: false, conexao: projeto.conexao })
  } catch (err) {
    console.error('❌ Erro ao remover conexão:', err)
    res.status(500).json({ erro: err.message })
  }
}
