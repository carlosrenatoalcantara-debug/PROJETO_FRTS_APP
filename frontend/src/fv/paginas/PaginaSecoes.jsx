import { useEffect } from 'react'
import EtapaProjeto from './etapas/EtapaProjeto'
import EtapaDimensionamento from './etapas/EtapaDimensionamento'
import EtapaBeneficiarias from './etapas/EtapaBeneficiarias'
import EtapaEquipamentos from './etapas/EtapaEquipamentos'
import EtapaMppt from './etapas/EtapaMppt'

/**
 * PaginaSecoes — etapas que se complementam numa página só (2026-11-22).
 *
 * Cada seção é a MESMA etapa de antes, com o seu estado e o seu botão de
 * salvar: nada de regra ou de gravação mudou, só deixou de ser preciso trocar
 * de aba. Todas leem o mesmo `useProjeto()`, então salvar uma seção atualiza as
 * outras.
 *
 * `foco` = chave da seção a exibir primeiro (rota antiga `/dimensionamento`,
 * `/mppt`…): a página rola até ela.
 */
function PaginaSecoes({ secoes, foco = null }) {
  useEffect(() => {
    if (!foco) return
    const alvo = document.getElementById(`secao-${foco}`)
    if (alvo && typeof alvo.scrollIntoView === 'function') alvo.scrollIntoView({ block: 'start' })
  }, [foco])

  return (
    <div className="pb-10">
      <nav aria-label="Seções da página" className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
        <ul className="mx-auto flex max-w-3xl flex-wrap gap-2 px-6 py-2 text-xs">
          {secoes.map((s) => (
            <li key={s.chave}>
              <a href={`#secao-${s.chave}`} className="rounded px-2 py-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900">
                {s.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {secoes.map(({ chave, Componente }, i) => (
        <div key={chave} id={`secao-${chave}`} className={`scroll-mt-12 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
          <Componente />
        </div>
      ))}
    </div>
  )
}

/** Cadastro: dados do cliente/conta, dimensionamento e beneficiárias. */
export function PaginaCadastro({ foco = null }) {
  return (
    <PaginaSecoes foco={foco} secoes={[
      { chave: 'projeto', rotulo: 'Cadastro', Componente: EtapaProjeto },
      { chave: 'dimensionamento', rotulo: 'Dimensionamento', Componente: EtapaDimensionamento },
      { chave: 'beneficiarias', rotulo: 'Beneficiárias', Componente: EtapaBeneficiarias },
    ]} />
  )
}

/**
 * Equipamentos (2026-11-25): estrutura, módulos, tipo de topologia e inversor
 * numa seção só, com um botão de salvar; MPPT e strings logo abaixo.
 * A rota antiga `/estrutura` rola até `#secao-estrutura`, dentro da primeira.
 */
const MpptNaComposicao = () => <EtapaMppt naComposicao />

export function PaginaComposicao({ foco = null }) {
  return (
    <PaginaSecoes foco={foco} secoes={[
      { chave: 'equipamentos', rotulo: 'Estrutura, módulos e inversores', Componente: EtapaEquipamentos },
      { chave: 'mppt', rotulo: 'MPPT e strings', Componente: MpptNaComposicao },
    ]} />
  )
}

export default PaginaSecoes
