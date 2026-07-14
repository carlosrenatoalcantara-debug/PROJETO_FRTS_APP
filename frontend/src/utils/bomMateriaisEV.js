/**
 * bomMateriaisEV.js — RE-EXPORT do motor de BOM compartilhado.
 *
 * BUG-021 FASE 2: o gerador da Lista de Materiais foi movido para o pacote neutro
 * (packages/diagram-engine/adapters/bomEV.js) para ser o MESMO nos dois lados. Antes ele
 * vivia só no frontend e o backend não tinha gerador nenhum — apenas imprimia a lista que
 * estava salva. Resultado: um projeto ainda não migrado imprimia no PDF a lista ANTIGA
 * (ex.: 2 DPS num trifásico) enquanto o Memorial e o desenho já mostravam a especificação
 * correta. Com um único motor, os dois derivam a lista da MESMA especificação executiva.
 *
 * Este arquivo mantém os imports existentes do frontend funcionando, sem duplicar lógica.
 */
export {
  gerarBOM,
  CATEGORIAS_BOM,
  REGRAS_BOM,
} from '../../../packages/diagram-engine/adapters/bomEV.js'
