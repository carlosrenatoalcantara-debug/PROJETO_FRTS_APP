/**
 * Aviso de persistência do wizard FV. O rascunho nasce no banco ao SAIR da
 * etapa 2 (consumo), desde que haja cliente cadastrado. Logo:
 *  - etapa 1: nada a dizer;
 *  - com projeto salvo: confirma o autosave;
 *  - com cliente cadastrado (?clienteId=) e sem projeto ainda: o rascunho vai
 *    nascer sozinho — não assusta com aviso;
 *  - sem cliente cadastrado: aí sim avisa, e pelo motivo certo (falta o
 *    cliente, não "concluir a etapa 2").
 * @returns {null | { tipo: 'salvo'|'aviso', texto?: string }}
 */
export function avisoRascunho({ etapa, projetoId, clienteId } = {}) {
  if (!(etapa > 1)) return null
  if (projetoId) return { tipo: 'salvo' }
  if (clienteId) return null
  return {
    tipo: 'aviso',
    texto: 'Rascunho ainda não salvo no servidor — este projeto não está ligado a um cliente cadastrado. '
      + 'Cadastre o cliente (ou abra o projeto a partir dele) para ativar o salvamento automático. '
      + 'Até lá, evite atualizar a página.',
  }
}
