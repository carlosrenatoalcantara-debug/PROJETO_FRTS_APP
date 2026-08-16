import { useCallback, useEffect, useState } from 'react'

/**
 * usarRecurso — carregamento de um recurso da API canônica — FV-API-001.
 *
 * Um único lugar com o ciclo {dados, carregando, erro, recarregar}, para que os
 * providers não repitam a mesma máquina quatro vezes.
 *
 * `vivo` descarta respostas obsoletas: se `chave` mudar durante o carregamento,
 * a resposta antiga não sobrescreve a nova nem escreve em componente desmontado.
 */
export function usarRecurso(carregador, chave) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [gatilho, setGatilho] = useState(0)

  /** Força um novo carregamento sem duplicar a lógica do efeito. */
  const recarregar = useCallback(() => setGatilho((n) => n + 1), [])

  useEffect(() => {
    let vivo = true

    if (!chave) {
      setDados(null)
      setCarregando(false)
      return () => { vivo = false }
    }

    setCarregando(true)
    setErro(null)

    carregador(chave)
      .then((r) => { if (vivo) setDados(r) })
      .catch((e) => { if (vivo) { setErro(e.message); setDados(null) } })
      .finally(() => { if (vivo) setCarregando(false) })

    return () => { vivo = false }
    // `carregador` vem do módulo de API — referência estável entre renders.
  }, [carregador, chave, gatilho])

  return { dados, carregando, erro, recarregar }
}
