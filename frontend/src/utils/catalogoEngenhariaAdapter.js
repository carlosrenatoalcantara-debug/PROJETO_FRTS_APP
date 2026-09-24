/**
 * catalogoEngenhariaAdapter.js — Sprint 8.1
 *
 * Adapter ÚNICO: converte Equipamento (Mongo) → contrato consumido pelo E7
 * (SeletorPaineis / SeletorInversores). NÃO altera o E7 nem o motor elétrico.
 *
 * Preserva o documento original em `_catalogo_original` para uso futuro
 * (unifilar/memorial/homologação/certificados). Marca `_fonte: 'catalogo'`.
 */

// P0-DIMENSIONAMENTO-ENGINEERING-RESTORE-01: reúso da fonte única de tecnologia (sem duplicar regras).
import { tecnologiaInversor } from '@fortesolar/fv-shared/engenharia/regras-plausibilidade'

const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const pick = (e, ks) => { for (const k of ks) { const v = num(e?.[k]); if (v !== null) return v } return null }
const pickStr = (e, ks) => { for (const k of ks) { const v = e?.[k]; if (v != null && v !== '') return v } return null }
const anos = (g) => (g && typeof g === 'object' ? num(g.value) : num(g))

// ─── MÓDULO → shape de SeletorPaineis ────────────────────────────────────────────
export function adaptarModulo(eq) {
  const e = eq.especificacoes || {}
  return {
    id: String(eq._id),
    marca: eq.fabricante || '—',
    modelo: eq.modelo || '—',
    /**
     * F3 — os `?? 0` saíram das grandezas ELÉTRICAS.
     *
     * Zero não é ausência: é um número que o motor aceita e com o qual calcula.
     * Um módulo com `voc: 0` passa em qualquer comparação contra a tensão
     * máxima do inversor, e o resultado é uma APROVAÇÃO construída sobre um
     * valor que o catálogo nunca afirmou — a mesma classe de defeito que a F2
     * removeu do oversizing, um nível acima.
     *
     * `potencia_wp` entrou na lista porque é o nome que o SSOT realmente usa
     * (54 de 54 módulos). Sem ele, os três aliases procurados não achavam nada
     * e TODO módulo do catálogo chegava ao motor com `potenciaW = 0` — potência
     * CC total zero, relação CC/CA zero, arranjo "subdimensionado". Acrescentar
     * o alias é normalização de nome, que é o que cabe a um adapter fazer.
     */
    potenciaW: pick(e, ['potencia_wp', 'potencia', 'potencia_w', 'potenciaW']),
    tecnologia: pickStr(e, ['tecnologia', 'tipo_celula']) || 'N-type',
    bifacial: !!(e.bifacial),
    eficiencia: pick(e, ['eficiencia', 'eficiencia_pct']),
    voc: pick(e, ['voc', 'voc_v']),
    vmpp: pick(e, ['vmpp', 'vmp', 'vmpp_v']),
    isc: pick(e, ['isc', 'isc_a']),
    /**
     * Coeficiente térmico de Voc, na unidade em que o SSOT o grava: %/°C
     * (`-0.25` = −0,25 %/°C). A conversão para fração acontece num ponto só do
     * sistema, em `coefParaFracao`, na entrada do classificador de tensão.
     * O adapter NÃO converte: converter aqui criaria a segunda conversão que a
     * FV-DOM-025 eliminou.
     */
    coef_temp_voc: pick(e, ['coef_temp_voc', 'coef_temp_voc_pct_c']),
    /** NOCT em °C. Nenhum dos 54 módulos cadastrados o declara — lacuna real. */
    temp_noct: pick(e, ['noct', 'noct_c', 'temp_noct']),
    imp: pick(e, ['imp', 'impp', 'imp_a']),                          // audit S8.1.1
    coef_temp_pmax: pick(e, ['coef_temp_pmax', 'coef_temp_potencia']), // audit S8.1.1
    dimensoes: {
      comprimento: pick(e, ['comprimento', 'comprimento_mm', 'alturaMm']),
      largura: pick(e, ['largura', 'largura_mm', 'larguraMm']),
      espessura: pick(e, ['espessura', 'espessura_mm']),
      peso: pick(e, ['peso', 'peso_kg']),
    },
    registro_inmetro: eq.certificacao?.inmetro?.numero ?? null,        // audit S8.1.1
    garantiaProduto: anos(eq.garantia_produto) ?? pick(e, ['garantia_produto']) ?? 12,
    garantiaPerformance: anos(eq.garantia_performance) ?? pick(e, ['garantia_performance']) ?? 25,
    percentualPerformance: pick(e, ['percentual_performance']) ?? 80,
    precoUnitario: num(eq.preco_sugerido) ?? 0,
    // governança / proveniência
    utilizavel_em_projeto: eq.utilizavel_em_projeto !== false,
    bloqueio_engenharia: eq.bloqueio_engenharia || [],
    _fonte: 'catalogo',
    _catalogo_original: eq,
  }
}

export function agruparPaineis(equipamentos) {
  const grupos = {}
  for (const eq of equipamentos) {
    const m = adaptarModulo(eq)
    ;(grupos[m.marca] = grupos[m.marca] || []).push(m)
  }
  return grupos
}

// ─── INVERSOR → tree tipo→marca→fase de SeletorInversores ─────────────────────────
export function adaptarInversor(eq) {
  const e = eq.especificacoes || {}
  // DEFAULT DE UI, e só isso: `_fases` agrupa a vitrine em tipo→marca→fase e
  // não entra em nenhuma decisão elétrica. 33 dos 39 inversores declaram o
  // campo; os 6 restantes caem no balde monofásico da tela. Nenhum motor lê
  // este valor — quem precisa de fases para engenharia lê o SSOT.
  const fases = pick(e, ['fases', 'fases_saida']) ?? 1
  return {
    id: String(eq._id),
    modelo: eq.modelo || '—',
    // F3: sem `?? 0` / `?? 1` — potência CA decide oversizing e nº de MPPT
    // decide a topologia. Ambos são 39/39 no SSOT; o default só mascarava.
    potenciaKW: pick(e, ['potencia_kw', 'potencia', 'potencia_ca']),
    nMppts: pick(e, ['mppts', 'n_mppts', 'numero_mppt']),
    garantia: anos(eq.garantia_produto) ?? pick(e, ['garantia']) ?? 5,
    precoUnitario: num(eq.preco_sugerido) ?? 0,
    utilizavel_em_projeto: eq.utilizavel_em_projeto !== false,
    bloqueio_engenharia: eq.bloqueio_engenharia || [],
    _fonte: 'catalogo',
    _catalogo_original: eq,
    // Dados elétricos inline (substituem DADOS_ELETRICOS_INVERSORES p/ itens do catálogo)
    _eletrico: {
      // RESTORE-01: lê também as chaves canônicas do enriquecimento (tensao_max_entrada, tensao_mppt_*,
      // corrente_max_por_mppt) — antes só lia voc_max/mppt_min/max e perdia o dado já existente no banco.
      tensao_max_entrada: pick(e, ['tensao_max_entrada', 'voc_max', 'voc_max_dc', 'tensao_max_dc']),
      mppt_min: pick(e, ['tensao_mppt_min', 'faixa_mppt_min', 'mppt_min']),
      mppt_max: pick(e, ['tensao_mppt_max', 'faixa_mppt_max', 'mppt_max']),
      /**
       * F3 — corrente de TRABALHO. `isc_max_mppt` saiu da lista de aliases:
       * era o limite de CURTO entrando no lugar do de trabalho, a mesma
       * substituição que a F1 proibiu no motor. As duas grandezas diferem em
       * todos os 19 inversores que declaram ambas.
       */
      corrente_max_mppt: pick(e, ['corrente_max_por_mppt', 'corrente_max_mppt', 'ipv_max']),
      /**
       * F3 — corrente de CURTO, com o nome que o consumidor realmente lê
       * (`dadosEletricosInversor` procura `corrente_isc_max`) e com o alias que
       * o SSOT realmente grava. Antes o campo saía como `isc_max_mppt` e
       * procurava `isc_max`: nenhum dos dois existe no catálogo, então os 19
       * inversores que DECLARAM `corrente_isc_max` chegavam ao wizard como se
       * não declarassem, e o critério de curto virava `nao_avaliado` à toa.
       *
       * `specs_canonicas.isc_max_por_mppt_a` NÃO entra aqui: a auditoria da F3
       * mostrou que, nos 20 inversores sem `corrente_isc_max`, esse campo é
       * numericamente idêntico à corrente de trabalho — é a substituição
       * proibida, já materializada dentro do próprio SSOT. Ler dali seria
       * importar o defeito. Fica registrado como saneamento documental.
       */
      corrente_isc_max: pick(e, ['corrente_isc_max', 'corrente_curto_mppt']),
      potencia_fv_max: pick(e, ['potencia_cc_max', 'potencia_dc_max', 'pdc_max']), // audit S8.1.1
      // F2: sem `?? 1.30`. Nenhum inversor do catálogo declara este campo, e o
      // default fazia o adaptador AFIRMAR um limite de fabricante que ninguém
      // publicou. Ausente ⇒ o critério de oversizing fica `nao_avaliado`.
      oversizing_max: pick(e, ['oversizing_max']),
      // F3: sem `?? 1`. 6 dos 39 declaram `entradas_por_mppt` e 27 declaram
      // `strings_por_mppt`; para os demais, "1" era presunção indistinguível
      // do dado real. Ausente ⇒ `null` ⇒ lacuna visível.
      entradas_por_mppt: pick(e, ['entradas_por_mppt', 'strings_por_mppt']),
    },
    registro_inmetro: eq.certificacao?.inmetro?.numero ?? null,
    _fases: fases,
  }
}

export function agruparInversores(equipamentos) {
  // tree: tecnologia → marca → fase → [modelos].
  // RESTORE-01: classifica via tecnologiaInversor (fonte única reusada) em vez do hard-code 'string'.
  const tree = {}
  for (const eq of equipamentos) {
    const inv = adaptarInversor(eq)
    const e = eq.especificacoes || {}
    const tec = tecnologiaInversor({
      fabricante: eq.fabricante,
      modelo:     eq.modelo,
      voc_max_dc_v:   pick(e, ['tensao_max_entrada', 'voc_max', 'voc_max_dc', 'tensao_max_dc']),
      potencia_kw_ca: pick(e, ['potencia_kw', 'potencia', 'potencia_ca']),
      n_mppts:        pick(e, ['n_mppts', 'mppts', 'numero_mppt']),
    })
    const tipo = tec === 'microinversor' ? 'micro' : tec   // micro | string | otimizador | hibrido
    const marca = eq.fabricante || '—'
    const fase = inv._fases === 3 ? 'trifasico' : 'monofasico'
    tree[tipo] = tree[tipo] || {}
    tree[tipo][marca] = tree[tipo][marca] || {}
    ;(tree[tipo][marca][fase] = tree[tipo][marca][fase] || []).push(inv)
  }
  return tree
}

// ─── Snapshot do equipamento no momento da seleção (versão congelada) ─────────────
// Clona em profundidade (snapshot IMUTÁVEL — independente de mudanças futuras no catálogo)
function clonar(v) {
  if (v == null) return v
  try { return structuredClone(v) } catch { return JSON.parse(JSON.stringify(v)) }
}

export function snapshotEquipamentoSelecao(obj) {
  const orig = obj?._catalogo_original || null
  return {
    equipamento_id: orig?._id || obj?.id || null,
    fabricante: obj?.marca || orig?.fabricante || null,
    modelo: obj?.modelo || orig?.modelo || null,
    versao_catalogo: orig?._schema_versao || null,
    fonte: obj?._fonte || 'local',
    data_selecao: new Date().toISOString(),
    // CÓPIA PROFUNDA — nunca referência ao documento vivo do catálogo
    dados_eletricos: orig ? clonar(orig.especificacoes || null) : {
      voc: obj?.voc, vmpp: obj?.vmpp, isc: obj?.isc, potenciaW: obj?.potenciaW,
      potenciaKW: obj?.potenciaKW, nMppts: obj?.nMppts,
    },
    // Prova documental futura: datasheet/hashes/versão (cópia de metadados)
    datasheet_original_url: orig?.datasheet_original?.nome || orig?.datasheet_url || null,
    hash_documento: orig?.datasheet_original?.hash || null,
    hash_certificado: orig?.certificacao?.inmetro?.certificado || null,
    documentos_tecnicos: (orig?.documentos_tecnicos || []).map((d) => ({ document_id: d._id || null, hash: d.hash, tipo: d.tipo })),
    certificacao: clonar(orig?.certificacao || null),
  }
}
