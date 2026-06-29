/**
 * catalogoTemplates.js — P0-CATALOGO-MESTRE-MATERIAIS (Fase 2B)
 *
 * 5 categorias consolidadas para uso operacional real.
 * NÃO é executado automaticamente. Para popular (idempotente), rode:
 *   cd backend && railway run npm run catalogo:seed-templates
 */

// Invariante: identidade ⟹ obrigatório.
const a = (chave, tipo, { unidade = null, obrigatorio = false, identidade = false, enumValores = [], rotulo = null } = {}) =>
  ({ chave, rotulo, tipo, unidade, obrigatorio: obrigatorio || identidade, identidade, enumValores })

export const TEMPLATES_CATEGORIA = [
  // ── Cabos ─────────────────────────────────────────────────────────────────
  {
    chave: 'cabos', rotulo: 'Cabos', classe: 'commodity',
    descricaoTemplate: 'Cabo {bitola_mm2}mm² {n_condutores}C {tensao_isolamento_v} {material_condutor}',
    atributos: [
      a('bitola_mm2', 'number', { unidade: 'mm²', identidade: true, rotulo: 'Bitola (mm²)' }),
      a('n_condutores', 'int', { identidade: true, rotulo: 'Nº de condutores' }),
      a('tensao_isolamento_v', 'enum', { identidade: true, enumValores: ['450/750', '0,6/1kV'], rotulo: 'Isolamento' }),
      a('material_condutor', 'enum', { identidade: true, enumValores: ['cobre', 'aluminio'], rotulo: 'Condutor' }),
    ],
  },
  // ── Proteção Elétrica ─────────────────────────────────────────────────────
  // Disjuntores, DR, DPS, Trilho DIN, Barramento, etc.
  {
    chave: 'protecao_eletrica', rotulo: 'Proteção Elétrica', classe: 'commodity',
    descricaoTemplate: '{tipo}',
    atributos: [
      a('tipo', 'string', { identidade: true, rotulo: 'Tipo de dispositivo' }),
    ],
  },
  // ── Quadros e Barramentos ─────────────────────────────────────────────────
  // Quadro de distribuição EV, Mob Box, etc.
  {
    chave: 'quadros_barramentos', rotulo: 'Quadros e Barramentos', classe: 'commodity',
    descricaoTemplate: '{tipo}',
    atributos: [
      a('tipo', 'string', { identidade: true, rotulo: 'Tipo' }),
    ],
  },
  // ── Conexões e Infraestrutura ─────────────────────────────────────────────
  // Eletroduto, Curva, Luva, Prensa-cabo, Box, Terminal tubular, Conector, Haste
  {
    chave: 'conexoes_infraestrutura', rotulo: 'Conexões e Infraestrutura', classe: 'commodity',
    descricaoTemplate: '{tipo}',
    atributos: [
      a('tipo', 'string', { identidade: true, rotulo: 'Tipo de componente' }),
    ],
  },
  // ── Fixação ───────────────────────────────────────────────────────────────
  // Abraçadeira, Bucha+parafuso, Fita isolante, etc.
  {
    chave: 'fixacao', rotulo: 'Fixação', classe: 'commodity',
    descricaoTemplate: '{tipo}',
    atributos: [
      a('tipo', 'string', { identidade: true, rotulo: 'Tipo' }),
    ],
  },
]

// Chaves antigas (Fase 2A) — removidas na consolidação para 5 categorias.
// O script de seed limpa esses registros do banco.
export const CHAVES_OBSOLETAS = ['cabo', 'eletroduto', 'curva', 'luva', 'bucha', 'disjuntor', 'dps', 'dr']
