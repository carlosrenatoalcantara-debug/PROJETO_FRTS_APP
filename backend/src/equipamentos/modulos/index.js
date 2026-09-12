/**
 * Shim de re-exportação — FV-DOM-031D.
 *
 * A implementação vive em @fortesolar/fv-shared (@fortesolar/fv-shared/modulos),
 * consumida também pelo frontend. Este arquivo existe para que o backend importe
 * o SSOT do MÓDULO pelo mesmo caminho que já usa para inversores e baterias
 * (`../equipamentos/<tipo>/index.js`). Não contém lógica.
 */
export * from '@fortesolar/fv-shared/modulos'
