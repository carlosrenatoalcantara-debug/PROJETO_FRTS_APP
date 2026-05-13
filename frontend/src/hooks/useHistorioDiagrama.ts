import { useState, useCallback, useEffect } from 'react'
import { Node, Edge } from 'reactflow'

interface HistoricoSnapshot {
  timestamp: number
  nodes: Node[]
  edges: Edge[]
  description: string
}

interface UseHistorioDiagrama {
  historia: HistoricoSnapshot[]
  posicaoAtual: number
  podeDesfazer: boolean
  podeRefazer: boolean
  desfazer: () => void
  refazer: () => void
  adicionar: (nodes: Node[], edges: Edge[], description: string) => void
  limpar: () => void
  snapshotAtual: HistoricoSnapshot | null
}

const STORAGE_KEY_PREFIX = 'diagrama_historico_'
const MAX_SNAPSHOTS = 20

/**
 * Hook customizado para gerenciar histórico de diagramas (Undo/Redo)
 * Persiste em localStorage automaticamente
 *
 * @param projetoId - ID único do projeto (usado como chave no localStorage)
 * @returns Interface de controle do histórico
 */
export function useHistorioDiagrama(projetoId: string): UseHistorioDiagrama {
  const [historia, setHistoria] = useState<HistoricoSnapshot[]>([])
  const [posicaoAtual, setPosicaoAtual] = useState(-1)

  // Carrega histórico do localStorage ao montar
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${projetoId}`
    const historicoSalvo = localStorage.getItem(storageKey)

    if (historicoSalvo) {
      try {
        const parsed = JSON.parse(historicoSalvo)
        setHistoria(parsed)
        setPosicaoAtual(parsed.length - 1)
      } catch (err) {
        console.error('❌ Erro ao carregar histórico:', err)
        setHistoria([])
        setPosicaoAtual(-1)
      }
    }
  }, [projetoId])

  // Salva histórico em localStorage sempre que muda
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${projetoId}`
    localStorage.setItem(storageKey, JSON.stringify(historia))
  }, [historia, projetoId])

  const adicionar = useCallback(
    (nodes: Node[], edges: Edge[], description: string) => {
      // Cria deep copy para evitar referências circulares
      const novoSnapshot: HistoricoSnapshot = {
        timestamp: Date.now(),
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        description
      }

      // Remove "future" se usuário está em meio da história
      const novaHistoria = historia.slice(0, posicaoAtual + 1)
      novaHistoria.push(novoSnapshot)

      // Limita a MAX_SNAPSHOTS (remove mais antigo se necessário)
      if (novaHistoria.length > MAX_SNAPSHOTS) {
        novaHistoria.shift()
        setPosicaoAtual(novaHistoria.length - 1)
      } else {
        setPosicaoAtual(novaHistoria.length - 1)
      }

      setHistoria(novaHistoria)
    },
    [historia, posicaoAtual]
  )

  const desfazer = useCallback(() => {
    if (posicaoAtual > 0) {
      setPosicaoAtual(posicaoAtual - 1)
    }
  }, [posicaoAtual])

  const refazer = useCallback(() => {
    if (posicaoAtual < historia.length - 1) {
      setPosicaoAtual(posicaoAtual + 1)
    }
  }, [posicaoAtual, historia])

  const limpar = useCallback(() => {
    setHistoria([])
    setPosicaoAtual(-1)
    const storageKey = `${STORAGE_KEY_PREFIX}${projetoId}`
    localStorage.removeItem(storageKey)
  }, [projetoId])

  // Snapshot atual (ou null se nenhum snapshot)
  const snapshotAtual = posicaoAtual >= 0 ? historia[posicaoAtual] : null

  return {
    historia,
    posicaoAtual,
    podeDesfazer: posicaoAtual > 0,
    podeRefazer: posicaoAtual < historia.length - 1,
    desfazer,
    refazer,
    adicionar,
    limpar,
    snapshotAtual
  }
}
