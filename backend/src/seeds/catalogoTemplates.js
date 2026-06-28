/**
 * catalogoTemplates.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 2A)
 *
 * Definições dos Templates de Categoria (infraestrutura do catálogo, versionada).
 * É a fonte de verdade das categorias, atributos (obrigatório/identidade), tipos e
 * dos padrões de descrição automática.
 *
 * NÃO é executado automaticamente. Para popular (idempotente), rode:
 *   npm run catalogo:seed-templates
 * Requer MONGODB_URI (Atlas). NÃO cadastra nenhum MATERIAL — apenas os templates.
 */

// Invariante: identidade ⟹ obrigatório (uma identidade estável não pode ter
// componente ausente). Aplicado centralmente aqui.
const a = (chave, tipo, { unidade = null, obrigatorio = false, identidade = false, enumValores = [], rotulo = null } = {}) =>
  ({ chave, rotulo, tipo, unidade, obrigatorio: obrigatorio || identidade, identidade, enumValores })

export const TEMPLATES_CATEGORIA = [
  // ── Commodities ────────────────────────────────────────────────────────────
  {
    chave: 'cabo', rotulo: 'Cabo', classe: 'commodity',
    descricaoTemplate: 'Cabo {tipo_cabo} {bitola_mm2} mm² {tensao_isolamento_v} {material_condutor}',
    atributos: [
      a('bitola_mm2', 'number', { unidade: 'mm²', obrigatorio: true, identidade: true, rotulo: 'Bitola (mm²)' }),
      a('tensao_isolamento_v', 'enum', { unidade: 'V', obrigatorio: true, identidade: true, enumValores: ['450/750', '0,6/1kV'], rotulo: 'Isolamento' }),
      a('material_condutor', 'enum', { obrigatorio: true, identidade: true, enumValores: ['cobre', 'aluminio'], rotulo: 'Condutor' }),
      a('tipo_cabo', 'enum', { obrigatorio: true, identidade: true, enumValores: ['flexivel', 'rigido'], rotulo: 'Tipo' }),
      a('n_condutores', 'int', { identidade: true, rotulo: 'Nº de condutores' }),
    ],
  },
  {
    chave: 'eletroduto', rotulo: 'Eletroduto', classe: 'commodity',
    descricaoTemplate: 'Eletroduto {material} {tipo} {diametro_mm} mm',
    atributos: [
      a('diametro_mm', 'number', { unidade: 'mm', obrigatorio: true, identidade: true, rotulo: 'Diâmetro (mm)' }),
      a('material', 'enum', { obrigatorio: true, identidade: true, enumValores: ['pvc', 'aco', 'pead'], rotulo: 'Material' }),
      a('tipo', 'enum', { obrigatorio: true, identidade: true, enumValores: ['rigido', 'flexivel', 'corrugado'], rotulo: 'Tipo' }),
    ],
  },
  {
    chave: 'curva', rotulo: 'Curva', classe: 'commodity',
    descricaoTemplate: 'Curva {material} {diametro_mm} mm {angulo_graus}°',
    atributos: [
      a('diametro_mm', 'number', { unidade: 'mm', obrigatorio: true, identidade: true, rotulo: 'Diâmetro (mm)' }),
      a('angulo_graus', 'enum', { unidade: '°', obrigatorio: true, identidade: true, enumValores: ['45', '90'], rotulo: 'Ângulo' }),
      a('material', 'enum', { obrigatorio: true, identidade: true, enumValores: ['pvc', 'aco'], rotulo: 'Material' }),
    ],
  },
  {
    chave: 'luva', rotulo: 'Luva', classe: 'commodity',
    descricaoTemplate: 'Luva {material} {diametro_mm} mm {tipo}',
    atributos: [
      a('diametro_mm', 'number', { unidade: 'mm', obrigatorio: true, identidade: true, rotulo: 'Diâmetro (mm)' }),
      a('tipo', 'enum', { obrigatorio: true, identidade: true, enumValores: ['rosca', 'soldavel', 'pressao'], rotulo: 'Tipo' }),
      a('material', 'enum', { obrigatorio: true, identidade: true, enumValores: ['pvc', 'aco'], rotulo: 'Material' }),
    ],
  },
  {
    chave: 'bucha', rotulo: 'Bucha', classe: 'commodity',
    descricaoTemplate: 'Bucha {material} {tamanho}',
    atributos: [
      a('tamanho', 'string', { obrigatorio: true, identidade: true, rotulo: 'Tamanho' }),
      a('material', 'enum', { obrigatorio: true, identidade: true, enumValores: ['nylon', 'pvc'], rotulo: 'Material' }),
    ],
  },
  // ── Engenharia (fabricante/modelo são campos próprios do Material) ───────────
  {
    chave: 'disjuntor', rotulo: 'Disjuntor', classe: 'engenharia',
    descricaoTemplate: 'Disjuntor {fabricante} {modelo} {corrente_nominal_a}A Curva {curva} {polos}P',
    atributos: [
      a('corrente_nominal_a', 'number', { unidade: 'A', obrigatorio: true, identidade: true, rotulo: 'Corrente (A)' }),
      a('curva', 'enum', { obrigatorio: true, identidade: true, enumValores: ['B', 'C', 'D'], rotulo: 'Curva' }),
      a('polos', 'int', { obrigatorio: true, identidade: true, rotulo: 'Polos' }),
      a('capacidade_interrupcao_ka', 'number', { unidade: 'kA', identidade: true, rotulo: 'Icc (kA)' }),
    ],
  },
  {
    chave: 'dps', rotulo: 'DPS', classe: 'engenharia',
    descricaoTemplate: 'DPS {fabricante} {modelo} Classe {classe_dps} {tensao_maxima_uc_v}V {corrente_in_ka}/{corrente_imax_ka}kA {polos}P',
    atributos: [
      a('classe_dps', 'enum', { obrigatorio: true, identidade: true, enumValores: ['I', 'II', 'III'], rotulo: 'Classe' }),
      a('tensao_maxima_uc_v', 'number', { unidade: 'V', obrigatorio: true, identidade: true, rotulo: 'Uc (V)' }),
      a('corrente_in_ka', 'number', { unidade: 'kA', obrigatorio: true, identidade: true, rotulo: 'In (kA)' }),
      a('corrente_imax_ka', 'number', { unidade: 'kA', obrigatorio: true, identidade: true, rotulo: 'Imax (kA)' }),
      a('polos', 'int', { obrigatorio: true, identidade: true, rotulo: 'Polos' }),
    ],
  },
  {
    chave: 'dr', rotulo: 'DR', classe: 'engenharia',
    descricaoTemplate: 'DR {fabricante} {modelo} {corrente_nominal_a}A {sensibilidade_ma}mA Tipo {tipo_dr} {polos}P',
    atributos: [
      a('corrente_nominal_a', 'number', { unidade: 'A', obrigatorio: true, identidade: true, rotulo: 'Corrente (A)' }),
      a('sensibilidade_ma', 'number', { unidade: 'mA', obrigatorio: true, identidade: true, rotulo: 'Sensibilidade (mA)' }),
      a('tipo_dr', 'enum', { obrigatorio: true, identidade: true, enumValores: ['AC', 'A', 'B'], rotulo: 'Tipo' }),
      a('polos', 'int', { obrigatorio: true, identidade: true, rotulo: 'Polos' }),
    ],
  },
]
