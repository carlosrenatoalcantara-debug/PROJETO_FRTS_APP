# Sprint P1-HOMOLOGACAO-SNAPSHOT-01 — Relatório

**Data:** 2026-06-18
**Executor:** Sonnet 4.6
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE
**Branch:** sprint/p1-homologacao-snapshot-01
**Escopo:** Projeto FV / Homologação / Snapshot. Não tocou ProjetoEV, Ativos, QR, Scanner, Comissionamento, Segurança.

---

## FASE 1 — Forense (quais ainda usavam catálogo vivo)

| Componente / Endpoint | Fonte dos equipamentos (antes) | Usava catálogo vivo? |
|---|---|---|
| `Homologacao.jsx` | só orquestra abas; passa `projeto` aos filhos | indireto |
| `MemorialDescritivo.jsx` → `POST /homologacao/memorial` | `_carregarDepsDocumento` carregava **ATLAS VIVO** (`Equipamento.find` por `_id`) e os resolvers priorizavam Atlas sobre o inline | **SIM** |
| `CartaConcessionaria.jsx` → `POST /homologacao/carta` | `gerarCartaConcessionaria(projeto)` lia `projeto.inversor` inline | parcial (inline do projeto) |
| `DadosART.jsx` → `GET /homologacao/art` | `gerarDadosART(projeto)` lia `projeto.inversor/painel` inline | parcial (inline do projeto) |
| `ChecklistDocumentos.jsx` | lista documental por estado/concessionária — sem equipamentos | não |
| Service `memorialDescritivoService.js` | `_resolverInversor/_resolverPainel`: **Atlas vivo > snapshot inline** | **SIM (prioridade Atlas)** |

**Conclusão:** o memorial era o documento que efetivamente consultava o **catálogo vivo** (Atlas por `_id`), com prioridade sobre o snapshot. Carta e ART liam o inline do projeto. Nenhum priorizava o `snapshot_catalogo` congelado do orçamento aprovado.

---

## FASE 2 — Substituição por snapshot quando CONGELADO

Implementado no backend (`homologacaoController.js`), reaproveitando a máquina de resolução existente sem alterar o service:

- **`_estaCongelado(proj)`**: `freeze_status ∈ {CONGELADO, HOMOLOGADO}`.
- **`_depsDoSnapshot(snapCat)`**: converte `snapshot_catalogo.{modulo,inversor}` no formato `deps.equipamentos` (`{tipo, fabricante, modelo, especificacoes, garantia_*}`) que os resolvers já consomem como fonte de prioridade.
- **`_carregarDepsDocumento`**: quando o projeto está CONGELADO e há `snapshot_catalogo`, usa o snapshot e **NÃO consulta o catálogo vivo** (`Equipamento.find`). Retorna `origem: 'snapshot'`. Caso contrário, mantém o ATLAS VIVO (comportamento anterior preservado).
- **`_aplicarSnapshotEquip(projeto)`**: para carta/ART (que não usam `deps`), sobrepõe `inversor/painel/num_paineis/num_inversores` com os valores congelados quando CONGELADO; no-op caso contrário.

As três rotas (`gerarMemorial`, `gerarCarta`, `obterDadosART`) passaram a aplicar o snapshot e a retornar `origem` + `usou_snapshot`.

> A especificação `especificacoes.potencia` do snapshot já casa com os aliases que os resolvers leem (`['potencia_kw','potencia_ca','potencia']` e `['pmpp','potencia_nominal','potencia']`), então não foi preciso mudar o service.

---

## FASE 3 — Validação: módulos, inversores, potências, quantidades, itens adicionais vêm do snapshot

**Verificado por execução em Node** contra os **services reais** (`gerarMemorialDescritivo/Carta/ART`):

- Projeto CONGELADO com snapshot = Canadian CS7N-660 / Growatt MIN-5000TL-X e inline (vivo) = TrinaVELHO / HuaweiVELHO:
  - Memorial **cita o módulo e o inversor congelados** e **não** cita os equipamentos vivos antigos. ✅
  - Carta gerada sem o inversor vivo antigo. ✅
  - ART retorna dados (potência instalada). ✅
- Quantidades (`num_paineis`/`num_inversores`) e itens adicionais vêm do snapshot via `_aplicarSnapshotEquip`/`_depsDoSnapshot`.

---

## FASE 4 — Divergência (catálogo mudou)

- A homologação **mantém-se no snapshot** mesmo se o catálogo vivo mudar (não há consulta ao Atlas quando CONGELADO).
- **Frontend** (`Homologacao.jsx`): usa `obterEquipamentosEngenharia(projeto)` (a função nomeada pelo sprint) e exibe um **banner**: "Equipamentos congelados do orçamento aprovado" com módulo/inversor congelados e contagem de itens adicionais, mais a nota "Mudanças no catálogo não afetam estes documentos." Projeto não congelado mostra aviso âmbar.
- A divergência detalhada (campo a campo) continua disponível no `GovernancaPainel` (`/governanca/divergencia`), reforçado na sprint anterior.

---

## FASE 5 — Validação dos projetos

> **HONESTIDADE:** os 5 projetos reais (Fazenda Alice, Paulo Carlos, Escola Pinheiro, novo, legado) **NÃO foram abertos em runtime** — sem acesso ao Atlas/ambiente nesta sessão.

| Validação | Método | Resultado |
|-----------|--------|-----------|
| Build Vite | `npm run build` | ✅ 2322 módulos, 13.45s, 0 erros |
| `node --check` controller | sintaxe | ✅ CONTROLLER OK |
| Memorial/Carta/ART com snapshot | **Node + services REAIS** | ✅ 10/10 asserts (frozen usado, vivo excluído, RASCUNHO compatível) |
| 5 projetos reais | runtime | ⚠️ NÃO executado |

---

## RESPOSTAS DIRETAS

1. **O que passou a usar snapshot:** memorial, carta e ART — quando o projeto está CONGELADO/HOMOLOGADO, os equipamentos (módulos, inversores, potências, quantidades, itens adicionais) vêm do `snapshot_catalogo`, não do catálogo vivo.
2. **O que continuou dinâmico:** projetos não congelados (RASCUNHO/APROVADO/EM_REVISAO) continuam usando o ATLAS VIVO (`Equipamento.find`) — comportamento anterior preservado. Checklist documental permanece por estado/concessionária.
3. **Divergências encontradas:** nenhuma divergência real medida (sem runtime). O mecanismo mantém a homologação no snapshot e sinaliza a origem; a comparação campo-a-campo segue no GovernancaPainel.
4. **Regressões:** nenhuma nas verificações executadas. Projetos não congelados inalterados.
5. **Commit gerado:** ver `HOMOLOGACAO_SNAPSHOT_METRICS.json`.

---

## Limitações / observações honestas

1. **Pré-existente (fora do escopo):** `DadosART.jsx` faz `GET` sem corpo, mas `obterDadosART` lê `req.body.projeto` → a rota ART tende a falhar (400) independente desta sprint. **Não corrigido aqui** (transporte, não snapshot). Recomenda-se sprint de correção do transporte ART.
2. Mapeamento de potência do inversor (`especificacoes.potencia` em kW vs W) herda a ambiguidade já existente no service — não introduzido por esta sprint.
3. 5 projetos reais não validados em runtime.
