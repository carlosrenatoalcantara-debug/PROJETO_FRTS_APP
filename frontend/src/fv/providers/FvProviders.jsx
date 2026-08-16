import { ProjetoProvider } from './ProjetoProvider'
import { CotacoesProvider } from './CotacoesProvider'
import { OrcamentosProvider } from './OrcamentosProvider'
import { ContratoProvider } from './ContratoProvider'
import { FasesProvider } from './FasesProvider'
import { BeneficiariasProvider } from './BeneficiariasProvider'
import { UnifilarProvider } from './UnifilarProvider'

/**
 * FvProviders — composição dos providers da nova UX FV.
 *
 * Cada provider lê SEU endpoint canônico. A aninhação restante existe por uma
 * dependência real: `Cotacoes` precisa do `cotacao_ref` do orçamento vigente
 * para marcar qual cotação deu origem ao orçamento (M-1).
 *
 * `Contrato` e `Fases` são independentes — leem os próprios endpoints.
 */
export function FvProviders({ projetoId, children }) {
  return (
    <ProjetoProvider projetoId={projetoId}>
      <OrcamentosProvider>
        <CotacoesProvider>
          <ContratoProvider>
            <FasesProvider>
              <BeneficiariasProvider>
                <UnifilarProvider>
                  {children}
                </UnifilarProvider>
              </BeneficiariasProvider>
            </FasesProvider>
          </ContratoProvider>
        </CotacoesProvider>
      </OrcamentosProvider>
    </ProjetoProvider>
  )
}

export { useProjeto } from './ProjetoProvider'
export { useCotacoes } from './CotacoesProvider'
export { useOrcamentos } from './OrcamentosProvider'
export { useContrato } from './ContratoProvider'
export { useFases } from './FasesProvider'
export { useBeneficiarias } from './BeneficiariasProvider'
export { useUnifilar } from './UnifilarProvider'
