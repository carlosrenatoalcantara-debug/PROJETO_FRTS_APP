/**
 * aliases.js — fonte única dos aliases de resolução do frontend.
 *
 * Consumido por vite.config.js (build/dev) e vitest.config.js (testes). Antes os
 * dois arquivos mantinham cópias manuais da mesma lista, e um alias adicionado só
 * no vite.config passava no build e quebrava na suíte de testes.
 *
 * Recebe `dirname` porque os arquivos de config são carregados ora como ESM ora
 * como CJS pelo Vite — depender de `import.meta.url` aqui não é confiável.
 */
export function criarAliases(path, dirname) {
  return {
    '@': path.resolve(dirname, './src'),

    // P3-EV-UNIFILAR-ENGINE-01: motor de diagramas compartilhado (neutro EV/FV/BESS).
    // Subpaths primeiro (mais específicos) — o alias do Vite é substituição por prefixo.
    '@diagram-engine/symbols':  path.resolve(dirname, '../packages/diagram-engine/src/symbols.js'),
    '@diagram-engine/geometry': path.resolve(dirname, '../packages/diagram-engine/src/geometry.js'),
    '@diagram-engine':          path.resolve(dirname, '../packages/diagram-engine/index.js'),

    // FV-UX-003 (F2): lógica pura compartilhada com o backend. Substitui os imports
    // relativos para ../backend/src, que quebravam a separação Vercel/Railway.
    // Os subpaths espelham o campo "exports" de packages/fv-shared/package.json.
    '@fortesolar/fv-shared/inversores/dicionario':            path.resolve(dirname, '../packages/fv-shared/equipamentos/inversores/dicionarioInversor.js'),
    '@fortesolar/fv-shared/inversores':                       path.resolve(dirname, '../packages/fv-shared/equipamentos/inversores/index.js'),
    '@fortesolar/fv-shared/ai/campos-equipamento':            path.resolve(dirname, '../packages/fv-shared/ai/camposEquipamento.js'),
    '@fortesolar/fv-shared/ai/validacao-eletrica-inversor':   path.resolve(dirname, '../packages/fv-shared/ai/validacaoEletricaInversor.js'),
    '@fortesolar/fv-shared/beneficiarias/rateio':             path.resolve(dirname, '../packages/fv-shared/utils/beneficiarias/beneficiariaRateio.js'),
    '@fortesolar/fv-shared/fv/validacao-microinversores':     path.resolve(dirname, '../packages/fv-shared/utils/fv/validacaoMicroinversores.js'),
    '@fortesolar/fv-shared/catalogo/ficha-tecnica-map':       path.resolve(dirname, '../packages/fv-shared/utils/catalogo/fichaTecnicaMap.js'),
    // FV-DOM-009: motores financeiros consolidados (EPC, Lei 14.300, fluxo de caixa).
    '@fortesolar/fv-shared/financeiro/engine':                path.resolve(dirname, '../packages/fv-shared/financeiro/financeiroEngine.js'),
    '@fortesolar/fv-shared/financeiro/regulatorio-br':        path.resolve(dirname, '../packages/fv-shared/financeiro/regulatorioBR.js'),
    '@fortesolar/fv-shared/financeiro/fluxo-caixa':           path.resolve(dirname, '../packages/fv-shared/financeiro/fluxoCaixa.js'),
    // FV-DOM-011: caminhos restantes (dimensionamento e simulação com O&M).
    '@fortesolar/fv-shared/financeiro/dimensionamento-retorno': path.resolve(dirname, '../packages/fv-shared/financeiro/dimensionamentoRetorno.js'),
    '@fortesolar/fv-shared/financeiro/simulacao-om':          path.resolve(dirname, '../packages/fv-shared/financeiro/simulacaoOM.js'),
    '@fortesolar/fv-shared/financeiro/contrato-v1':           path.resolve(dirname, '../packages/fv-shared/financeiro/contratoV1.js'),

    // FV-DOM-007B: engenharia normativa e motor de unifilar. Saíram do frontend
    // para o domínio; o wizard legado ainda os alcança por shim enquanto existir.
    '@fortesolar/fv-shared/engenharia/catalogo-eletrico':     path.resolve(dirname, '../packages/fv-shared/engenharia/catalogoEletrico.js'),
    '@fortesolar/fv-shared/engenharia/normativa':             path.resolve(dirname, '../packages/fv-shared/engenharia/engenhariaNormativa.js'),
    '@fortesolar/fv-shared/engenharia/unifilar-svg':          path.resolve(dirname, '../packages/fv-shared/engenharia/unifilarSVG.js'),

    '@fortesolar/fv-shared/engenharia/regras-plausibilidade': path.resolve(dirname, '../packages/fv-shared/services/regrasPlausibilidade.js'),
    '@fortesolar/fv-shared/engenharia/presentation':          path.resolve(dirname, '../packages/fv-shared/services/engineeringPresentation.js'),
    '@fortesolar/fv-shared/engenharia/fallback':              path.resolve(dirname, '../packages/fv-shared/services/engineeringFallback.js'),

    // FV-UX-006 (F3.1): máquina de estados do Projeto FV — fonte única.
    '@fortesolar/fv-shared/estados/ciclo-vida':               path.resolve(dirname, '../packages/fv-shared/estados/cicloVida.js'),
    '@fortesolar/fv-shared/estados/workflow-comercial':       path.resolve(dirname, '../packages/fv-shared/estados/workflowComercial.js'),
    '@fortesolar/fv-shared/estados/governanca-freeze':        path.resolve(dirname, '../packages/fv-shared/estados/governancaFreeze.js'),
    '@fortesolar/fv-shared/estados/orcamento':                path.resolve(dirname, '../packages/fv-shared/estados/orcamento.js'),
    '@fortesolar/fv-shared/estados/congelamento':             path.resolve(dirname, '../packages/fv-shared/estados/congelamento.js'),
    '@fortesolar/fv-shared/estados':                          path.resolve(dirname, '../packages/fv-shared/estados/index.js'),
  }
}
