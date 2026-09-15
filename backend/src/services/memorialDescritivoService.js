import { montarPayloadEngenharia } from './engineeringPresentation.js'

// ── P1-PARECER-ENGINEERING-WIRE-01 — helpers do fluxo de documentos ──────────
const DISCLAIMER_FALLBACK = 'Valor estimado conservadoramente — sujeito à validação técnica.'
/** Lê o 1º alias não-vazio (tolera dialeto snake/camel). */
const _pick = (obj, keys, def = null) => {
  for (const k of keys) { const v = obj?.[k]; if (v !== undefined && v !== null && v !== '') return v }
  return def
}
/** especificacoes do Atlas (dialeto) → visão canônica p/ engineeringPresentation. */
function _canonInversor(esp = {}) {
  return {
    potencia_kw: _pick(esp, ['potencia_kw', 'potencia_ca', 'potencia']),
    tensao_max_entrada: _pick(esp, ['tensao_max_entrada', 'voc_max', 'vpv_max', 'tensao_max_dc']),
    tensao_mppt_min: _pick(esp, ['tensao_mppt_min', 'faixa_mppt_min', 'mppt_min']),
    tensao_mppt_max: _pick(esp, ['tensao_mppt_max', 'faixa_mppt_max', 'mppt_max']),
    n_mppts: _pick(esp, ['n_mppts', 'mppts', 'numero_mppt']),
    tensao_partida: _pick(esp, ['tensao_partida']),
    corrente_max_por_mppt: _pick(esp, ['corrente_max_por_mppt', 'ipv_max']),
  }
}
/** Resolve specs do inversor priorizando ATLAS VIVO (equipamentos) sobre o snapshot. */
function _resolverInversor(snapshot = {}, equipamentos = []) {
  const eq = (equipamentos || []).find(e => e?.tipo === 'inversor')
  const esp = eq?.especificacoes || {}
  return {
    fonte: eq ? 'atlas' : 'snapshot',
    marca: _pick(eq, ['fabricante']) ?? _pick(snapshot, ['marca', 'fabricante']),
    modelo: _pick(eq, ['modelo']) ?? _pick(snapshot, ['modelo']),
    potenciaKW: _pick(esp, ['potencia_kw', 'potencia_ca', 'potencia']) ?? _pick(snapshot, ['potencia_kw', 'potenciaKW']),
    nMppts: _pick(esp, ['n_mppts', 'mppts', 'numero_mppt']) ?? _pick(snapshot, ['n_mppts', 'nMppts']),
    fases: _pick(esp, ['fases', 'fases_saida']) ?? _pick(snapshot, ['fases']),
    tipo: _pick(esp, ['tipo_topologia']) ?? _pick(snapshot, ['tipo']),
    garantia: _pick(eq, ['garantia_produto']) ?? _pick(snapshot, ['garantia']),
    certificacao: eq?.certificacao || null,
    _esp: esp,
  }
}
/** Resolve specs do módulo priorizando ATLAS VIVO sobre o snapshot. */
function _resolverPainel(snapshot = {}, equipamentos = []) {
  const eq = (equipamentos || []).find(e => e?.tipo === 'modulo')
  const esp = eq?.especificacoes || {}
  return {
    fonte: eq ? 'atlas' : 'snapshot',
    marca: _pick(eq, ['fabricante']) ?? _pick(snapshot, ['marca']),
    modelo: _pick(eq, ['modelo']) ?? _pick(snapshot, ['modelo']),
    pmpp: _pick(esp, ['pmpp', 'potencia_nominal', 'potencia']) ?? _pick(snapshot, ['pmpp']),
    voc: _pick(esp, ['voc', 'voc_stc']) ?? _pick(snapshot, ['voc']),
    isc: _pick(esp, ['isc', 'isc_stc']) ?? _pick(snapshot, ['isc']),
    eficiencia: _pick(esp, ['eficiencia']) ?? _pick(snapshot, ['eficiencia']),
    garantia_produto: _pick(esp, ['garantia_produto']) ?? _pick(snapshot, ['garantia_produto']),
    garantia_performance: _pick(esp, ['garantia_performance']) ?? _pick(snapshot, ['garantia_performance']),
    certificacao: eq?.certificacao || null,
  }
}
/** FASE 3 — campos do inversor servidos por fallback conservador. */
function _engenhariaInversor(inv) {
  try {
    const payload = montarPayloadEngenharia(_canonInversor(inv?._esp || {}), {})
    const inferidos = Object.entries(payload.campos || {})
      .filter(([, v]) => v.status === 'fallback_conservador').map(([k]) => k)
    return { tem_fallback: !!payload.tem_fallback, inferidos }
  } catch { return { tem_fallback: false, inferidos: [] } }
}
/** FASE 5 — certificações que entram automaticamente (do Atlas). */
function _secaoCertificacoes(...eqs) {
  const linhas = []
  for (const eq of eqs.filter(Boolean)) {
    const c = eq.certificacao || {}
    const nome = `${eq.marca || ''} ${eq.modelo || ''}`.trim() || 'equipamento'
    if (c.inmetro?.numero) linhas.push(`  ✓ INMETRO ${c.inmetro.numero} — ${nome}`)
    for (const n of (Array.isArray(c.normas_iec) ? c.normas_iec : [])) {
      const norma = n?.norma || n
      if (norma) linhas.push(`  ✓ ${norma} — ${nome}`)
    }
  }
  return linhas.length ? linhas.join('\n') : '  (Certificações a validar no checklist de homologação assistida)'
}
/** FASE 4 — UC principal + beneficiárias + rateio. */
function _secaoBeneficiarias(beneficiarias = []) {
  const ativas = (beneficiarias || []).filter(b => b.ativa !== false)
  if (!ativas.length) return '  (Sem unidades beneficiárias cadastradas — autoconsumo local)'
  const linhas = ativas.map((b, i) => {
    const papel = i === 0 ? 'UC Principal' : `Beneficiária ${i}`
    const rateio = b.tipoRateio === 'percentual' ? `${b.valor}%` : `prioridade ${b.valor}`
    return `  • ${papel}: UC ${b.contaContrato || 'N/A'}${b.titular ? ' — ' + b.titular : ''} | Rateio: ${rateio}`
  })
  const soma = ativas.filter(b => b.tipoRateio === 'percentual').reduce((s, b) => s + (Number(b.valor) || 0), 0)
  if (soma) linhas.push(`  Soma do rateio percentual: ${soma}% ${Math.abs(100 - soma) < 0.01 ? '✓' : '⚠ (deve somar 100%)'}`)
  return linhas.join('\n')
}

/**
 * Seção "arranjo" do memorial, por TOPOLOGIA — FV-DOM-031C.
 *
 * Antes havia uma só, escrita em linguagem de string: "ARRANJO DAS STRINGS",
 * "Módulos por String", "Strings em paralelo conectadas ao inversor". Num
 * sistema com microinversores nada disso descreve o que foi instalado.
 *
 * `micros[]` preenchido é o fato que decide — a mesma regra que o unifilar usa.
 * Sem ele, o texto de string continua PALAVRA POR PALAVRA o que era.
 */
function _secaoArranjo(strings, micros) {
  if (!Array.isArray(micros) || micros.length === 0) {
    return `5. ARRANJO DAS STRINGS
────────────────────────────────────────────────────────────────────────────
Número de Strings: ${strings?.totalStrings || 1}
Módulos por String: ${strings?.modulosPorString || 'N/A'}
Configuração DC: Strings em paralelo conectadas ao inversor`
  }

  const totalMicros = micros.reduce((s, m) => s + (Number(m?.quantidade) || 0), 0)
  const linhas = micros.map((m, i) => {
    const nome = [m?.marca, m?.modelo].filter(Boolean).join(' ') || 'N/A'
    const dist = Array.isArray(m?.distribuicao) && m.distribuicao.length
      ? m.distribuicao.join(' / ') : 'N/A'
    return `  ${i + 1}. ${nome}: ${m?.quantidade ?? 'N/A'} un. × ` +
      `${m?.entradas_por_micro ?? 'N/A'} entradas × ${m?.modulos_por_entrada ?? 'N/A'} módulo(s)/entrada` +
      `\n     Módulos por microinversor: ${dist}`
  }).join('\n')

  return `5. ARRANJO DOS MICROINVERSORES
────────────────────────────────────────────────────────────────────────────
Topologia: microinversor → entradas CC → módulos (sem MPPT, sem strings)
Total de Microinversores: ${totalMicros || 'N/A'}
Modelos:
${linhas}
Configuração DC: cada módulo conectado a uma entrada independente do microinversor
Configuração CA: microinversores em paralelo no barramento de corrente alternada`
}

/** Seção "inversor", por topologia. MPPT só existe no caminho string. */
function _secaoInversor(inversor, micros, _fonteNota, eng) {
  const ehMicro = Array.isArray(micros) && micros.length > 0
  const rotuloTipo = ehMicro ? 'Microinversor' : (inversor?.tipo || 'String')
  const linhaMppt = ehMicro
    ? `Entradas CC por Microinversor: ${micros[0]?.entradas_por_micro ?? 'N/A'}`
    : `Número de MPPT: ${inversor?.nMppts || 'N/A'}`
  return `6. COMPONENTES - ${ehMicro ? 'MICROINVERSORES' : 'INVERSOR'}
────────────────────────────────────────────────────────────────────────────
Tipo: ${rotuloTipo}
Marca: ${inversor?.marca || 'N/A'}
Modelo: ${inversor?.modelo || 'N/A'}
Potência Nominal: ${inversor?.potenciaKW || 'N/A'} kW
Fases: ${inversor?.fases === 3 ? 'Trifásico' : 'Monofásico'} (${inversor?.fases || 1}F)
Tensão de Saída: ${inversor?.fases === 3 ? '380V' : '220V'}
${linhaMppt}
Garantia: ${inversor?.garantia || 'N/A'} anos
Eficiência: ≥ 97% (típico)
Fonte dos dados: ${_fonteNota}${eng.tem_fallback ? `
⚠ Valores inferidos (${eng.inferidos.join(', ')}): ${DISCLAIMER_FALLBACK}` : ''}`
}

// ─── F14-5 · representação documental por arranjo ───────────────────────────

const _n = (v) => (v === null || v === undefined || v === '' ? null : v)

/** Potência CC: a do adapter quando existe; senão a do modelo plano. */
function _potenciaInstalada(potenciaPlana, doc) {
  const v = _n(doc?.potencia_cc_kwp)
  return v ?? (potenciaPlana || 'N/A')
}

/**
 * Potência CA: soma de TODOS os inversores, não a do primeiro.
 *
 * Sem a projeção, cai no inversor plano — e aí precisa do MESMO `_pick` de
 * antes: a carta e a ART recebem o dialeto cru (`potencia_kw`/`potencia_ca`),
 * enquanto o memorial recebe o já resolvido (`potenciaKW`). Ler só um deles
 * quebrava o outro.
 */
function _potenciaCA(inversor, doc) {
  const v = _n(doc?.potencia_ca_kw)
  return v ?? _pick(inversor, ['potenciaKW', 'potencia_kw', 'potencia_ca'], 'N/A')
}

/** Modelos de inversor, um por grupo. `[]` quando não há projeção. */
function _listaInversores(doc) {
  return (doc?.grupos ?? [])
    .filter((g) => g.inversor)
    .map((g) => ({
      fabricante: g.inversor_catalogo?.fabricante ?? g.inversor.fabricante ?? null,
      modelo: g.inversor_catalogo?.modelo ?? g.inversor.modelo ?? null,
      potencia_kw: g.inversor.potencia_kw ?? null,
      quantidade: g.n_inversores,
      arranjos: g.arranjos_ids,
    }))
}

/**
 * Linha de modelos para a CARTA — só quando há mais de um.
 *
 * A carta cita potência, não equipamento. Com dois modelos, calar seria deixar
 * o leitor supor um só; listar resolve sem reescrever o documento.
 */
function _linhaInversores(doc) {
  const lista = _listaInversores(doc)
  if (lista.length <= 1) return ''
  const txt = lista
    .map((i) => `${[i.fabricante, i.modelo].filter(Boolean).join(' ')} (${i.quantidade}×)`)
    .join(', ')
  return `\nInversores: ${txt}`
}

/** Linha de resumo — só aparece quando há mais de um arranjo. */
function _resumoArranjos(doc) {
  if (!doc?.multiarranjo) return ''
  const consolidacao = doc.consolidado
    ? ` (${doc.grupos.length} grupo(s) de inversor — arranjos de mesmo modelo agrupados)`
    : ''
  return `\nArranjos: ${doc.n_arranjos}${consolidacao}`
    + `\nTotal de Módulos: ${doc.n_modulos_total}`
}

/** Especificação do módulo — catálogo quando vinculado, senão a composição. */
function _specModulo(g) {
  const cat = g.modulo_catalogo?.especificacoes ?? {}
  const m = g.modulo ?? {}
  return {
    marca: g.modulo_catalogo?.fabricante ?? m.fabricante ?? 'N/A',
    modelo: g.modulo_catalogo?.modelo ?? m.modelo ?? 'N/A',
    pmpp: cat.potencia ?? m.potencia_w ?? 'N/A',
    voc: cat.voc ?? 'N/A',
    isc: cat.isc ?? 'N/A',
    eficiencia: cat.eficiencia ?? 'N/A',
    garantia_produto: g.modulo_catalogo?.garantia_produto?.value ?? 'N/A',
    garantia_performance: g.modulo_catalogo?.garantia_performance?.value ?? 'N/A',
  }
}

/** Especificação do inversor — catálogo quando vinculado, senão a composição. */
function _specInversor(g) {
  const cat = g.inversor_catalogo?.especificacoes ?? {}
  const i = g.inversor ?? {}
  return {
    marca: g.inversor_catalogo?.fabricante ?? i.fabricante ?? 'N/A',
    modelo: g.inversor_catalogo?.modelo ?? i.modelo ?? 'N/A',
    potencia_kw: cat.potencia_kw ?? cat.potencia ?? i.potencia_kw ?? 'N/A',
    n_mppts: cat.n_mppts ?? cat.mppts ?? 'N/A',
    tensao_max: cat.tensao_max_entrada ?? 'N/A',
    garantia: g.inversor_catalogo?.garantia_produto?.value ?? 'N/A',
  }
}

/**
 * Seções 4/5/6, uma por GRUPO de inversor.
 *
 * Cada grupo nomeia os arranjos que o compõem — a associação arranjo ↔
 * equipamento não se perde na consolidação. Grupos de modelos diferentes nunca
 * são fundidos: é o que impede o documento de descrever uma usina que não é a
 * projetada.
 */
function _secoesPorArranjo(doc, micros, fonteNota) {
  const varios = doc.grupos.length > 1
  const blocos = doc.grupos.map((g, idx) => {
    const m = _specModulo(g)
    const i = _specInversor(g)
    const titulo = varios
      ? `4.${idx + 1} ARRANJO ${g.rotulos.join(' + ')} — ${i.marca} ${i.modelo}`
      : '4. COMPONENTES - MÓDULOS FOTOVOLTAICOS'
    const microsDoGrupo = g.micros?.length > 0 ? g.micros : null
    return `${titulo}
────────────────────────────────────────────────────────────────────────────
Arranjo(s): ${g.arranjos_ids.join(', ')}
Módulos — Marca: ${m.marca}  |  Modelo: ${m.modelo}
Potência Nominal: ${m.pmpp} W
Tensão de Circuito Aberto (Voc): ${m.voc} V
Corrente de Curto-circuito (Isc): ${m.isc} A
Eficiência do Módulo: ${m.eficiencia}%
Garantia de Produto: ${m.garantia_produto} anos
Garantia de Performance: ${m.garantia_performance}% aos 25 anos
Número de Módulos: ${g.n_modulos}

Inversor — Marca: ${i.marca}  |  Modelo: ${i.modelo}
Tipo: ${microsDoGrupo ? 'Microinversor' : 'String'}
Potência Nominal (CA): ${i.potencia_kw} kW
Quantidade: ${g.n_inversores}
${microsDoGrupo
      ? `Topologia: microinversor → entradas CC → módulos (sem MPPT, sem strings)
Entradas CC por Microinversor: ${microsDoGrupo[0]?.entradas_por_micro ?? 'N/A'}`
      : `Número de MPPTs: ${i.n_mppts}
Tensão Máxima de Entrada: ${i.tensao_max} V`}
Garantia: ${i.garantia} anos`
  })

  const cabecalho = varios
    ? `4. COMPONENTES POR ARRANJO
────────────────────────────────────────────────────────────────────────────
O sistema tem ${doc.n_arranjos} arranjo(s), descritos individualmente abaixo.
Cada bloco identifica os arranjos que o compõem e o equipamento respectivo.

`
    : ''
  return cabecalho + blocos.join('\n\n') + `\n\n${fonteNota}`
}

export function gerarMemorialDescritivo(projeto, cliente, opts = {}) {
  const { equipamentos = [], beneficiarias = [] } = opts
  /**
   * F14-5 · projeção documental por arranjo, quando o chamador a fornece.
   *
   * Ausente ⇒ o memorial de sempre, intacto — é o caminho dos chamadores que
   * ainda passam o modelo plano. Presente ⇒ uma seção de equipamentos por grupo
   * de inversor, em vez de descrever o primeiro como se fosse o sistema.
   */
  const arranjosDoc = opts.arranjosDoc ?? null
  // FV-DOM-031C: `micros[]` vem de `arranjos[].configuracao_eletrica.micros`,
  // resolvido por quem monta o payload. Ausente ⇒ o memorial de string, intacto.
  const micros = opts.micros ?? projeto.micros ?? null
  const {
    potencia_kwp = 0,
    strings = {},
    estrutura = {},
    telhado = {},
    estado = '',
    concessionaria = '',
    endereco_completo = '',
  } = projeto
  // Atlas vivo > snapshot; dialeto tolerado
  const inversor = _resolverInversor(projeto.inversor || {}, equipamentos)
  const painel = _resolverPainel(projeto.painel || {}, equipamentos)
  const eng = _engenhariaInversor(inversor)
  const eqInv = (equipamentos || []).find(e => e?.tipo === 'inversor')
  const eqMod = (equipamentos || []).find(e => e?.tipo === 'modulo')
  const _fonteNota = inversor.fonte === 'atlas'
    ? 'Especificações técnicas obtidas do catálogo (Atlas) no momento da geração.'
    : 'Especificações do snapshot do projeto (catálogo não vinculado por ID).'

  const dataTentativa = new Date().toLocaleDateString('pt-BR')
  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'

  const memorial = `
═══════════════════════════════════════════════════════════════════════════
                        MEMORIAL DESCRITIVO
            SISTEMA DE GERAÇÃO DE ENERGIA SOLAR FOTOVOLTAICA
═══════════════════════════════════════════════════════════════════════════

1. DADOS DO SOLICITANTE
────────────────────────────────────────────────────────────────────────────
Nome: ${cliente?.nome || 'N/A'}
CPF/CNPJ: ${cliente?.cpf_cnpj || 'N/A'}
Telefone: ${cliente?.telefone || 'N/A'}
Email: ${cliente?.email || 'N/A'}

2. DADOS DA INSTALAÇÃO
────────────────────────────────────────────────────────────────────────────
Endereço: ${endereco_completo || 'N/A'}
Estado: ${estado || 'N/A'}
Concessionária: ${concessionaria || 'N/A'}
Tipo de Ligação: Monofásica / Trifásica
Tensão Nominal: 127/220V ou 380V (conforme ligação)
Modalidade: Autoconsumo Remoto com Compensação de Energia

2.1 UNIDADES BENEFICIÁRIAS / RATEIO (Lei 14.300/2022)
────────────────────────────────────────────────────────────────────────────
${_secaoBeneficiarias(beneficiarias)}

3. DADOS DO SISTEMA
────────────────────────────────────────────────────────────────────────────
Potência Instalada: ${_potenciaInstalada(potencia_kwp, arranjosDoc)} kWp
Potência Máxima (CA): ${_potenciaCA(inversor, arranjosDoc)} kW${_resumoArranjos(arranjosDoc)}

${arranjosDoc
    ? _secoesPorArranjo(arranjosDoc, micros, _fonteNota)
    : `4. COMPONENTES - MÓDULOS FOTOVOLTAICOS
────────────────────────────────────────────────────────────────────────────
Marca: ${painel?.marca || 'N/A'}
Modelo: ${painel?.modelo || 'N/A'}
Potência Nominal: ${painel?.pmpp || 'N/A'} W
Tecnologia: Silício Cristalino
Tensão de Circuito Aberto (Voc): ${painel?.voc || 'N/A'} V
Corrente de Curto-circuito (Isc): ${painel?.isc || 'N/A'} A
Eficiência do Módulo: ${painel?.eficiencia || 'N/A'}%
Garantia de Produto: ${painel?.garantia_produto || 'N/A'} anos
Garantia de Performance: ${painel?.garantia_performance || 'N/A'}% aos 25 anos
Número de Módulos: ${strings?.totalModulos || 'N/A'}

${_secaoArranjo(strings, micros)}

${_secaoInversor(inversor, micros, _fonteNota, eng)}`}

7. COMPONENTES - ESTRUTURA
────────────────────────────────────────────────────────────────────────────
Tipo: ${estrutura?.tipo || 'Fibrocimento'}
Material: ${estrutura?.material || 'Alumínio anodizado'}
Inclinação: Conforme geometria do telhado
Orientação: Conforme exposição solar ótima
Fixação: Conforme normas ABNT e manual do fabricante

8. SISTEMA DE PROTEÇÃO
────────────────────────────────────────────────────────────────────────────
Lado DC (Entrada):
  - Disjuntor Seccionadora: 125A / 1000V DC (ou conforme cálculo)
  - DPS (Proteção contra Surtos): Tipo 2, coordenado com painel

Lado AC (Saída):
  - Disjuntor Geral: 63A / 250V ou 380V (conforme cálculo)
  - DR (Proteção Diferencial Residual): 30mA tipo A
  - DPS AC: Tipo 2, coordenado com inversor

Aterramento:
  - Eletrodo de aterramento: Haste tipo cantoneira L50x50x5mm, comprimento 2,4m
  - Resistência: ≤ 10Ω (ou conforme norma local)
  - Condutor de aterramento: Cobre nu, seção dimensionada conforme ABNT NBR 16690
  - Continuidade: Barramento de terra centralizado

9. CABEAMENTO E CONDUTOS
────────────────────────────────────────────────────────────────────────────
Lado DC:
  - Condutor DC: Cobre isolado, seção conforme queda de tensão <3%
  - Conduto: Eletroduto flexível ou rígido, classe de proteção conforme ambiente

Lado AC:
  - Condutor AC: Cobre isolado, seção conforme queda de tensão <1%
  - Conduto: Eletroduto rígido, classe de proteção IP65 (ou superior)

10. NORMAS E REGULAMENTAÇÕES APLICÁVEIS
────────────────────────────────────────────────────────────────────────────
  ✓ ABNT NBR 16690:2019 - Sistemas fotovoltaicos - Instalação
  ✓ ABNT NBR 5410:2008 - Instalações elétricas de baixa tensão
  ✓ ABNT NBR 14039:2005 - Instalações elétricas de média tensão (13,8kV)
  ✓ NR10 - Segurança em instalações e serviços em eletricidade
  ✓ ABNT NBR IEC 61936-1:2015 - Segurança de sistemas elétricos
  ✓ Resolução ANEEL nº 482/2012 - Microgeração distribuída
  ✓ Norma Técnica da Concessionária Local (${concessionaria || 'N/A'})

10.1 CERTIFICAÇÕES DOS EQUIPAMENTOS (catálogo)
────────────────────────────────────────────────────────────────────────────
${_secaoCertificacoes({ ...inversor, marca: inversor.marca, modelo: inversor.modelo, certificacao: eqInv?.certificacao }, { marca: painel.marca, modelo: painel.modelo, certificacao: eqMod?.certificacao })}

11. CARACTERIZAÇÃO DO PROJETO
────────────────────────────────────────────────────────────────────────────
Tipo de Projeto: Microgeração fotovoltaica conectada à rede elétrica
Modalidade: Compensação de energia (net metering)
Geração Esperada: ${(potencia_kwp * 131.44).toFixed(0)} kWh/ano (aproximado)
Redução de Consumo: Até 100% em cenários favoráveis
Vida Útil Esperada: ≥ 25 anos

12. RESPONSABILIDADES
────────────────────────────────────────────────────────────────────────────
Responsável Técnico: ${responsavelTecnico}
Empresa Instaladora: Forte Solar Energia
Data do Projeto: ${dataTentativa}
Assinado por: _________________________________
                 ${responsavelTecnico}
                 ${process.env.CREA_NÚMERO || 'CREA/CFT nº'}

════════════════════════════════════════════════════════════════════════════
Documento gerado automaticamente em ${dataTentativa}
Válido como documento técnico de referência
════════════════════════════════════════════════════════════════════════════
  `.trim()

  return memorial
}

export function gerarCartaConcessionaria(projeto, cliente, opts = {}) {
  // F14-5: a carta cita a potência CA. Sem a projeção, ela vinha do PRIMEIRO
  // inversor — 60 kW num sistema de 110. Com ela, é a soma de todos.
  const arranjosDoc = opts.arranjosDoc ?? null
  const {
    potencia_kwp = 0,
    inversor = {},
    estado = '',
    concessionaria = '',
    endereco_completo = '',
  } = projeto

  const dataAtual = new Date().toLocaleDateString('pt-BR')
  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'

  const carta = `
════════════════════════════════════════════════════════════════════════════

Forte Solar Energia
${process.env.EMPRESA_CNPJ || 'CNPJ: XX.XXX.XXX/XXXX-XX'}
${process.env.EMPRESA_ENDERECO || 'Endereço: N/A'}

${dataAtual}

Prezados Senhores,

Vimos por meio desta solicitar a análise e aprovação técnica para conexão
de um sistema de micro geração distribuída (microgeração fotovoltaica)
na unidade consumidora abaixo discriminada.

════════════════════════════════════════════════════════════════════════════
DADOS DO TITULAR
════════════════════════════════════════════════════════════════════════════

Nome: ${cliente?.nome || 'N/A'}
CPF/CNPJ: ${cliente?.cpf_cnpj || 'N/A'}
Telefone: ${cliente?.telefone || 'N/A'}
Email: ${cliente?.email || 'N/A'}

════════════════════════════════════════════════════════════════════════════
DADOS DA INSTALAÇÃO
════════════════════════════════════════════════════════════════════════════

Concessionária: ${concessionaria || 'N/A'}
Estado: ${estado || 'N/A'}
Endereço: ${endereco_completo || 'N/A'}
Tipo de Ligação: Monofásica / Trifásica (conforme UC)
Tensão: 127/220V ou 380V (conforme ligação existente)

════════════════════════════════════════════════════════════════════════════
DADOS DO SISTEMA FOTOVOLTAICO
════════════════════════════════════════════════════════════════════════════

Potência Instalada: ${_potenciaInstalada(potencia_kwp, arranjosDoc)} kWp
Potência CA: ${_potenciaCA(inversor, arranjosDoc)} kW${_linhaInversores(arranjosDoc)}
Modalidade: Autoconsumo com Compensação de Energia
Geração Estimada: ${(potencia_kwp * 131.44).toFixed(0)} kWh/ano

════════════════════════════════════════════════════════════════════════════
DOCUMENTAÇÃO ANEXADA
════════════════════════════════════════════════════════════════════════════

[✓] Memorial Descritivo do Sistema
[✓] Diagrama Unifilar
[✓] ART (Anotação de Responsabilidade Técnica)
[✓] Projeto de Aterramento
[✓] Relatório Técnico da Concessionária Local
[✓] Comprovante de Propriedade do Imóvel
[✓] Identidade e CPF/CNPJ do Titular

════════════════════════════════════════════════════════════════════════════
INFORMAÇÕES TÉCNICAS
════════════════════════════════════════════════════════════════════════════

O sistema foi dimensionado conforme normas técnicas:
• ABNT NBR 16690:2019 (Instalação de sistemas fotovoltaicos)
• ABNT NBR 5410:2008 (Instalações elétricas de baixa tensão)
• Resolução ANEEL nº 482/2012 (Microgeração distribuída)
• Normas técnicas de ${concessionaria || 'sua concessionária'}

O sistema possui:
• Proteção contra surtos (DPS)
• Proteção diferencial (DR 30mA)
• Aterramento conforme norma
• Chaveamento para isolamento em caso de falha

════════════════════════════════════════════════════════════════════════════
RESPONSÁVEL TÉCNICO
════════════════════════════════════════════════════════════════════════════

Nome: ${responsavelTecnico}
Registro: ${process.env.CREA_NÚMERO || 'CREA/CFT nº'}
Empresa: Forte Solar Energia

════════════════════════════════════════════════════════════════════════════

Solicitamos que proceda com a avaliação técnica e administrativa desta
solicitação, bem como a emissão de parecer de aceitação ou observações
para correção.

Colocamo-nos à disposição para esclarecer dúvidas e providenciar
informações adicionais que se fizerem necessárias.

Atenciosamente,

_________________________________
${responsavelTecnico}
Responsável Técnico
Forte Solar Energia

════════════════════════════════════════════════════════════════════════════
Documento gerado em ${dataAtual}
════════════════════════════════════════════════════════════════════════════
  `.trim()

  return carta
}

export function gerarDadosART(projeto, cliente, opts = {}) {
  // F14-5: mesma correção da carta — `potencia_ac` era a do primeiro inversor.
  const arranjosDoc = opts.arranjosDoc ?? null
  const {
    potencia_kwp = 0,
    inversor = {},
    painel = {},
    endereco_completo = '',
  } = projeto

  const responsavelTecnico = process.env.RESPONSAVEL_TECNICO || 'Engenheiro Responsável'
  const creaNumero = process.env.CREA_NÚMERO || 'CREA/CFT nº'
  const dataAtual = new Date().toLocaleDateString('pt-BR')

  // Cálculo estimado de valor da ART (referência CREA)
  const valorART = potencia_kwp <= 5 ? 150 : potencia_kwp <= 10 ? 250 : 400

  const dadosART = {
    responsavel_tecnico: responsavelTecnico,
    crea_numero: creaNumero,
    tipo_atividade: 'Projeto e Execução de Sistema de Geração Fotovoltaica',
    potencia_instalada: `${_potenciaInstalada(potencia_kwp, arranjosDoc)} kWp`,
    potencia_ac: `${_potenciaCA(inversor, arranjosDoc)} kW`,
    // F14-5: quando há mais de um modelo, a ART lista todos em vez de citar um.
    inversores: _listaInversores(arranjosDoc),
    endereco_obra: endereco_completo || 'N/A',
    tipo_obra: 'Instalação em Edificação Existente',
    data_inicio_prevista: dataAtual,
    duracao_estimada: '7 a 10 dias',
    valor_art_sugerido: `R$ ${valorART.toFixed(2)}`,
    observacoes: 'Microgeração Distribuída conforme Resolução ANEEL 482/2012',
    normas_aplicaveis: [
      'ABNT NBR 16690:2019',
      'ABNT NBR 5410:2008',
      'NR10 - Eletricidade',
      'Resolução ANEEL 482/2012',
    ],
  }

  return dadosART
}

export function gerarChecklistDocumentos(estado, concessionaria) {
  const concessionariasChecklistMap = {
    COSERN: [
      { documento: 'Memorial Descritivo', obrigatorio: true, descricao: 'Descrição técnica do sistema' },
      { documento: 'Diagrama Unifilar', obrigatorio: true, descricao: 'Esquema de ligação do sistema' },
      { documento: 'ART (Anotação de Responsabilidade Técnica)', obrigatorio: true, descricao: 'Registro profissional do engenheiro' },
      { documento: 'Projeto de Aterramento', obrigatorio: true, descricao: 'Cálculo e esquema de aterramento' },
      { documento: 'Comprovante de Propriedade', obrigatorio: true, descricao: 'Escritura ou contrato do imóvel' },
      { documento: 'Identidade e CPF do Titular', obrigatorio: true, descricao: 'Cópias dos documentos' },
      { documento: 'Procuração (se aplicável)', obrigatorio: false, descricao: 'Se representante assina documentos' },
    ],
    CPFL: [
      { documento: 'Memorial Descritivo', obrigatorio: true, descricao: 'Descrição técnica do sistema' },
      { documento: 'Diagrama Unifilar', obrigatorio: true, descricao: 'Esquema de ligação' },
      { documento: 'ART', obrigatorio: true, descricao: 'Anotação de Responsabilidade Técnica' },
      { documento: 'Formulário de Conexão CPFL', obrigatorio: true, descricao: 'Formulário próprio da concessionária' },
      { documento: 'Planta da Edificação', obrigatorio: false, descricao: 'Localização dos componentes' },
      { documento: 'Comprovante de Propriedade', obrigatorio: true, descricao: 'Escritura ou contrato' },
    ],
    CEMIG: [
      { documento: 'Memorial Descritivo', obrigatorio: true },
      { documento: 'Diagrama Unifilar', obrigatorio: true },
      { documento: 'ART', obrigatorio: true },
      { documento: 'Formulário de Solicitação CEMIG', obrigatorio: true },
      { documento: 'Comprovante de Propriedade', obrigatorio: true },
      { documento: 'RG e CPF', obrigatorio: true },
    ],
  }

  const checklist = concessionariasChecklistMap[concessionaria] || concessionariasChecklistMap.COSERN

  return {
    concessionaria: concessionaria || 'Não informada',
    estado: estado || 'N/A',
    documentos: checklist.map(doc => ({
      ...doc,
      concluido: false,
    })),
    status: 'rascunho',
    data_criacao: new Date().toISOString(),
  }
}
