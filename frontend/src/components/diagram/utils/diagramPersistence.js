/**
 * Diagram Persistence Utilities
 * Salva e carrega diagramas do localStorage
 * Estrutura: localStorage['diagrama_${projetoId}'] = { nodes, edges, timestamp }
 */

const STORAGE_PREFIX = 'diagrama_';

/**
 * P0-03 — Guarda contra chaves ambíguas/compartilhadas.
 * Causa raiz do bug "unifilar de outro projeto": chaves derivadas do NOME do
 * projeto (ex.: `proposta-${nome}` ou `proposta-sem-nome`) faziam dois projetos
 * distintos compartilharem o mesmo slot de localStorage. Esta função rejeita
 * chaves vazias ou notoriamente ambíguas para que a persistência falhe de forma
 * explícita em vez de cruzar dados entre projetos.
 *
 * Chaves válidas devem ser estáveis e únicas por projeto:
 *   - `projeto-fv-<_id>` / `projeto-ev-<_id>` (projetos persistidos)
 *   - `ev-draft-...` / `fv-draft-...` (rascunho único por sessão do wizard)
 *   - ObjectId (24 hex) puro
 * @param {string} projetoId
 * @returns {boolean} true se a chave é segura para persistir
 */
export function chaveProjetoValida(projetoId) {
  if (projetoId === null || projetoId === undefined) return false;
  const id = String(projetoId).trim();
  if (id === '') return false;
  // Sentinelas de "sem identidade" — nunca devem virar chave compartilhada.
  const ambiguas = ['undefined', 'null', 'sem-nome', 'proposta-sem-nome', 'proposta-', 'nan'];
  if (ambiguas.includes(id.toLowerCase())) return false;
  return true;
}

/**
 * Salvar diagrama no localStorage
 * @param {string} projetoId - ID único do projeto
 * @param {Array} nodes - Nós do diagrama
 * @param {Array} edges - Arestas do diagrama
 * @param {Object} metadata - Metadados opcionais (projeto_nome, cliente, etc)
 * @returns {boolean} Sucesso da operação
 */
export function salvarDiagramaLocal(projetoId, nodes, edges, metadata = {}) {
  try {
    if (!chaveProjetoValida(projetoId)) {
      console.error(`[P0-03] Chave de projeto inválida/ambígua ("${projetoId}") — diagrama NÃO salvo para evitar cruzar dados entre projetos.`);
      return false;
    }
    const dados = {
      nodes,
      edges,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        versao: 1
      }
    };

    const chave = `${STORAGE_PREFIX}${projetoId}`;
    localStorage.setItem(chave, JSON.stringify(dados));
    console.log(`Diagrama ${projetoId} salvo com sucesso`);
    return true;
  } catch (error) {
    console.error('Erro ao salvar diagrama:', error);
    return false;
  }
}

/**
 * Carregar diagrama do localStorage
 * @param {string} projetoId - ID único do projeto
 * @returns {Object|null} { nodes, edges, metadata } ou null se não encontrado
 */
export function carregarDiagramaLocal(projetoId) {
  try {
    if (!chaveProjetoValida(projetoId)) {
      console.warn(`[P0-03] Chave de projeto inválida/ambígua ("${projetoId}") — nada carregado.`);
      return null;
    }
    const chave = `${STORAGE_PREFIX}${projetoId}`;
    const dados = localStorage.getItem(chave);

    if (!dados) {
      console.log(`Nenhum diagrama salvo para ${projetoId}`);
      return null;
    }

    const diagrama = JSON.parse(dados);
    console.log(`Diagrama ${projetoId} carregado com sucesso`);
    return diagrama;
  } catch (error) {
    console.error('Erro ao carregar diagrama:', error);
    return null;
  }
}

/**
 * Deletar diagrama do localStorage
 * @param {string} projetoId - ID único do projeto
 * @returns {boolean} Sucesso da operação
 */
export function deletarDiagramaLocal(projetoId) {
  try {
    const chave = `${STORAGE_PREFIX}${projetoId}`;
    localStorage.removeItem(chave);
    console.log(`Diagrama ${projetoId} deletado`);
    return true;
  } catch (error) {
    console.error('Erro ao deletar diagrama:', error);
    return false;
  }
}

/**
 * Listar todos os diagramas salvos
 * @returns {Array} Lista de { projetoId, projeto_nome, timestamp }
 */
export function listarDiagramasSalvos() {
  try {
    const diagramas = [];

    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);

      if (chave?.startsWith(STORAGE_PREFIX)) {
        try {
          const dados = JSON.parse(localStorage.getItem(chave));
          const projetoId = chave.substring(STORAGE_PREFIX.length);

          diagramas.push({
            projetoId,
            projeto_nome: dados.metadata?.projeto_nome || projetoId,
            cliente_nome: dados.metadata?.cliente_nome,
            timestamp: dados.metadata?.timestamp,
            tamanho: dados.nodes?.length || 0
          });
        } catch (e) {
          console.warn(`Erro ao parsear diagrama ${chave}`);
        }
      }
    }

    return diagramas.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  } catch (error) {
    console.error('Erro ao listar diagramas:', error);
    return [];
  }
}

/**
 * Verificar se existe diagrama salvo para um projeto
 * @param {string} projetoId - ID único do projeto
 * @returns {boolean}
 */
export function existeDiagramaSalvo(projetoId) {
  const chave = `${STORAGE_PREFIX}${projetoId}`;
  return localStorage.getItem(chave) !== null;
}

/**
 * Exportar diagrama como arquivo JSON
 * @param {string} projetoId - ID único do projeto
 * @param {string} nomeArquivo - Nome do arquivo (opcional)
 * @returns {boolean} Sucesso da operação
 */
export function exportarDiagramaArquivo(projetoId, nomeArquivo = null) {
  try {
    const diagrama = carregarDiagramaLocal(projetoId);

    if (!diagrama) {
      console.warn('Diagrama não encontrado para exportação');
      return false;
    }

    const dados = JSON.stringify(diagrama, null, 2);
    const blob = new Blob([dados], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = nomeArquivo || `diagrama-${projetoId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Diagrama exportado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao exportar diagrama:', error);
    return false;
  }
}

/**
 * Importar diagrama de arquivo JSON
 * @param {File} arquivo - Arquivo JSON selecionado
 * @returns {Promise<Object|null>} { nodes, edges, metadata } ou null
 */
export async function importarDiagramaArquivo(arquivo) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onload = event => {
        try {
          const diagrama = JSON.parse(event.target.result);

          if (diagrama.nodes && diagrama.edges) {
            console.log('Diagrama importado com sucesso');
            resolve(diagrama);
          } else {
            reject(new Error('Arquivo não contém estrutura válida de diagrama'));
          }
        } catch (parseError) {
          reject(new Error('Erro ao parsear arquivo JSON'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo'));
      };

      reader.readAsText(arquivo);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Obter histórico de versões de um diagrama
 * (Implementação futura com versionamento)
 * @param {string} projetoId
 * @returns {Array} Histórico de versões
 */
export function obterHistoricoDiagrama(projetoId) {
  // Implementação futura
  const chave = `${STORAGE_PREFIX}${projetoId}_historico`;
  try {
    const historico = localStorage.getItem(chave);
    return historico ? JSON.parse(historico) : [];
  } catch {
    return [];
  }
}

/**
 * Limpar todos os diagramas (CUIDADO!)
 * @param {boolean} confirmar - Require confirmação
 * @returns {boolean} Sucesso da operação
 */
export function limparTodosDiagramas(confirmar = false) {
  if (!confirmar) {
    console.warn('Operação requer confirmação');
    return false;
  }

  try {
    const chaves = [];

    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (chave?.startsWith(STORAGE_PREFIX)) {
        chaves.push(chave);
      }
    }

    chaves.forEach(chave => localStorage.removeItem(chave));
    console.log(`${chaves.length} diagramas deletados`);
    return true;
  } catch (error) {
    console.error('Erro ao limpar diagramas:', error);
    return false;
  }
}

/**
 * Validar estrutura de diagrama
 * @param {Object} diagrama - Objeto com nodes e edges
 * @returns {Object} { valido: boolean, erros: [] }
 */
export function validarEstruturaDiagrama(diagrama) {
  const erros = [];

  if (!diagrama) {
    erros.push('Diagrama não fornecido');
  }

  if (!Array.isArray(diagrama?.nodes)) {
    erros.push('nodes deve ser um array');
  }

  if (!Array.isArray(diagrama?.edges)) {
    erros.push('edges deve ser um array');
  }

  if (diagrama?.nodes?.length === 0) {
    erros.push('Diagrama deve ter pelo menos um nó');
  }

  // Validar estrutura de nós
  diagrama?.nodes?.forEach((node, idx) => {
    if (!node.id) {
      erros.push(`Node ${idx} falta ID`);
    }
    if (!node.data) {
      erros.push(`Node ${node.id} falta data`);
    }
    if (typeof node.position !== 'object' || !('x' in node.position) || !('y' in node.position)) {
      erros.push(`Node ${node.id} falta posição válida`);
    }
  });

  // Validar estrutura de arestas
  diagrama?.edges?.forEach((edge, idx) => {
    if (!edge.id) {
      erros.push(`Edge ${idx} falta ID`);
    }
    if (!edge.source) {
      erros.push(`Edge ${edge.id} falta source`);
    }
    if (!edge.target) {
      erros.push(`Edge ${edge.id} falta target`);
    }
  });

  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Criar backup automático
 * Salva 5 últimas versões de cada diagrama
 * @param {string} projetoId
 * @param {Array} nodes
 * @param {Array} edges
 * @param {Object} metadata
 */
export function criarBackupAutomatico(projetoId, nodes, edges, metadata = {}) {
  try {
    const chave = `${STORAGE_PREFIX}${projetoId}_backup`;
    let backups = [];

    try {
      const backupsSalvos = localStorage.getItem(chave);
      if (backupsSalvos) {
        backups = JSON.parse(backupsSalvos);
      }
    } catch {
      backups = [];
    }

    // Adicionar novo backup
    backups.unshift({
      timestamp: new Date().toISOString(),
      nodes,
      edges,
      metadata
    });

    // Manter apenas últimos 5
    if (backups.length > 5) {
      backups = backups.slice(0, 5);
    }

    localStorage.setItem(chave, JSON.stringify(backups));
    return true;
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    return false;
  }
}
