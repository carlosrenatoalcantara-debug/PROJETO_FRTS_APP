import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useProjeto } from './ProjetoProvider'
import { gerarUnifilar } from '../api/agregadosFvApi'

/**
 * UnifilarProvider — FV-UX-016.
 *
 * Consome `POST /api/projetos-fv/:id/unifilar/gerar` — o endpoint canônico da
 * FV-DOM-007B — e repassa a resposta INTACTA.
 *
 * ── Zero engenharia aqui ─────────────────────────────────────────────────────
 * Nada de Voc, temperatura, condutor, proteção, MPPT, string, fase ou NBR. O
 * SVG chega pronto e os números chegam em `especificacoes`. Recalcular qualquer
 * um deles reabriria o defeito que a FV-DOM-007B fechou: engenharia normativa no
 * navegador, divergindo do servidor.
 *
 * ── Duas coisas diferentes, nunca misturadas ─────────────────────────────────
 *   `atual`    → o que o motor desenha AGORA, a partir dos dados do projeto
 *   `snapshot` → o desenho congelado em `governanca.snapshot_unifilar` (M-2)
 *
 * O provider não escolhe um "o certo" nem funde os dois — expõe ambos e deixa a
 * tela dizer qual está sendo exibido. O snapshot é lido do projeto e NUNCA
 * escrito por esta sprint.
 */

const Ctx = createContext(null)

export function UnifilarProvider({ children }) {
  const { projetoId, projeto } = useProjeto()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const gerar = useCallback(async () => {
    if (!projetoId) return
    setCarregando(true)
    setErro(null)
    try {
      setDados(await gerarUnifilar(projetoId))
    } catch (e) {
      // Mensagem e código são do servidor — a UI não os reinterpreta.
      setErro(e.codigo ? `${e.message} (${e.codigo})` : e.message)
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }, [projetoId])

  // Gerar ao abrir a etapa: a operação é derivação pura, sem efeito colateral.
  useEffect(() => { gerar() }, [gerar])

  const snapshot = projeto?.governanca?.snapshot_unifilar ?? null

  const valor = useMemo(() => ({
    // ── Resultado canônico (servidor) ─────────────────────────────────────────
    svg: dados?.svg ?? null,
    origem: dados?.origem ?? null,
    proveniencia: dados?.proveniencia ?? null,
    /** Campos que o projeto não forneceu. Nunca preenchidos no cliente. */
    lacunas: dados?.lacunas ?? [],
    especificacoes: dados?.especificacoes ?? null,

    // ── Desenho congelado (M-2) ───────────────────────────────────────────────
    snapshot,
    temSnapshot: !!snapshot?.svg,

    carregando,
    erro,
    gerar,
  }), [dados, snapshot, carregando, erro, gerar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useUnifilar() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUnifilar precisa estar dentro de UnifilarProvider')
  return ctx
}
