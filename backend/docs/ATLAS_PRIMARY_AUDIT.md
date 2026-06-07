# P1-ATLAS-PRIMARY-01 — Auditoria: Atlas é a fonte primária?

> **Auditoria apenas.** Nenhuma escrita, nenhuma alteração de Atlas/catálogo/OCR/parsers/SSOT/frontend.
> Pergunta central: o Atlas já é a fonte oficial de verdade, ou ainda há dependência operacional do `memory-storage.json`?

## FASE 1 — `USE_MEMORY_STORAGE`

| Local | Papel |
|---|---|
| `config/database.js:4,20` | Se `=== 'true'` → **pula o MongoDB completamente** (nem tenta conectar) |
| `.env` (runtime atual) | **`USE_MEMORY_STORAGE=true`** + **`SKIP_MONGODB_RETRIES=true`** |
| `scripts/auditCatalog.js` | só leitura (auditoria) |

➡️ No runtime local atual, o Mongo **nunca conecta** → o app opera **100% em memória**.

## FASE 2 — `memory-storage`

- `config/memoryStorage.js`: store em memória que **persiste em arquivo** `data/memory-storage.json` via `fs.writeFileSync` (em create/update/delete → `saveToFile()`).
- **`memory-storage.json` é VERSIONADO no git** (não está em `.gitignore`) — dado de runtime no controle de versão.
- Importado/usado em ~16 controllers/rotas (auth, clientes, equipamentos, projetosFV/EV, adminCatalogo, datasheet, fatura, parecer…).

## FASE 3 — Fallback local

Padrão: `const usarMemoryStorage = () => mongoose.connection.readyState !== 1`.
Quando o Mongo não está conectado, o fluxo desvia para o memory store. **~95 branches** de fallback em **~20 arquivos** (mais densos: `adminCatalogo` 21, `projetosFV` 14, `projetosEV` 12, `integrations` 10, `auth` 7). No catálogo: `equipamentosController` 3, `carregadoresEV` 2, rota `equipamentos` 1, `catalogoDiagnostico` 1.

## FASE 4 — Fluxo a fluxo (Atlas / Memory / Ambos)

| Fluxo | Código | Fonte | Comportamento em memory mode (config atual) |
|---|---|---|---|
| **Cadastro inversor** (single) | `criarEquipamento` (sem guarda) → `new Equipamento().save()` | **Atlas-only** | ⚠️ `.save()` bufferiza/falha (sem fallback) |
| **Cadastro módulo** (single) | mesmo `criarEquipamento` | **Atlas-only** | ⚠️ igual |
| **Cadastro EV** | `carregadoresEV.js` → `503 DB_OFFLINE` se `readyState!==1` | **Atlas-only** | ⚠️ retorna **503 DB_OFFLINE** |
| **Importação OCR** | extração não persiste; salva via lote ou single | depende | herda do caminho de save |
| **Importação assistida** (lote) | `criarInversoresLote` → branch `memoryStore.createEquipamento + saveToFile` | **Ambos** | grava em `memory-storage.json` |
| **Edição** | `atualizarEquipamento` → `findByIdAndUpdate` (sem guarda) | **Atlas-only** | ⚠️ falha sem Mongo |
| **Exclusão** | `excluirEquipamento` → `findByIdAndDelete` (sem guarda) | **Atlas-only** | ⚠️ falha sem Mongo |
| **Listagem** | `listarEquipamentos` → branch `memoryStore.findAllEquipamentos` | **Ambos** | lê do memory store (9 seeds) |

**Assimetria central:** *listagem* e *importação em lote* caem para memória; *cadastro single / edição / exclusão / EV* são Atlas-only e **quebram** em memory mode.

## FASE 5 — Risco de divergência

1. **Duas fontes de verdade coexistem:** `memory-storage.json` (9 seeds, versionado, escrito em runtime) vs **Atlas `forte_solar.equipamentos` (95 reais)**. Não há sincronização.
2. **Config atual mascara o Atlas:** com `USE_MEMORY_STORAGE=true`, o runtime local **lista os 9 seeds**, não os 95 do Atlas. Operadores no ambiente local veem/editam o store errado.
3. **Divergência silenciosa por assimetria:** importação em lote grava em arquivo local; cadastro single/edição/EV exigem Atlas. Resultado: dados parciais em lugares diferentes.
4. **Efemeridade:** em deploy com disco efêmero (Railway), `memory-storage.json` zera a cada redeploy → perda de dados gravados em memória.
5. **Histórico:** as primeiras auditorias liam o memory (9) achando ser o catálogo — só ao acessar o Atlas confirmamos os 95.

## FASE 6 — Plano para tornar o Atlas a única fonte (SEM executar)

1. **Flip de flags** (config, não código): `USE_MEMORY_STORAGE=false` e `SKIP_MONGODB_RETRIES=false` em todos os ambientes; garantir conectividade Atlas (allowlist já tem `0.0.0.0/0`; o bloqueio anterior era do sandbox, não de produção).
2. **Definir o papel do fallback** — duas opções:
   - (a) **Remover** o fallback de escrita: todos os fluxos passam a **falhar explícito (503)** quando o Mongo cai — comportamento que o cadastro EV já adota (consistência).
   - (b) Manter memory **somente-leitura** de emergência (cache), **nunca como destino de escrita**.
   Recomendado: (a) para o catálogo (writes sempre no Atlas ou 503), tornando os fluxos **simétricos**.
3. **Parar de versionar** `memory-storage.json` (adicionar ao `.gitignore`) e parar de tratá-lo como fonte.
4. **Migrar/descartar** os 9 seeds: verificar se há item único não presente nos 95 do Atlas; senão, descartar.
5. **Observabilidade:** `/api/health` já expõe `mongodb: conectado/desconectado` — usar como gate de prontidão.
6. **Ordem sugerida:** flags → verificar listagem mostra 95 → neutralizar writes de memória no catálogo → gitignore do arquivo → migração/descartes → estender ao resto do app.

## FASE 7 — Respostas

1. **O sistema ainda depende do memory-storage?** **Sim.** No runtime atual (`USE_MEMORY_STORAGE=true`), o app opera 100% em memória; listagem e importação em lote dependem do `memory-storage.json`.
2. **Quais fluxos estão inseguros?** (a) **Cadastro single / edição / exclusão / EV** são *Atlas-only* e **falham/retornam 503** em memory mode; (b) **listagem e importação em lote** caem para memória e **divergem silenciosamente** do Atlas.
3. **O Atlas já pode ser oficial?** **Tecnicamente sim** (95 docs íntegros, conexão validada). **Operacionalmente ainda não**, enquanto `USE_MEMORY_STORAGE=true` e a fallback assimétrica de escrita existirem.
4. **Esforço para eliminar o memory-storage?**
   - **Só catálogo:** baixo — 2 flags + neutralizar ~7 branches em 4 arquivos (`equipamentosController`, `carregadoresEV`, rota `equipamentos`, `catalogoDiagnostico`) + gitignore + descarte de 9 seeds.
   - **App inteiro:** médio — ~95 branches em ~20 arquivos (auth, projetos, integrações…). Não toca SSOT/parser/OCR.
5. **Próxima sprint?** **P1-ATLAS-CUTOVER-01** — flip de flags + tornar os writes do catálogo Atlas-only (ou memory read-only) + gitignore do arquivo + verificação de que a listagem passa a refletir os 95. Sprint de implementação (envolve config + possível migração), com janela de verificação.

### Conclusão
O Atlas **está pronto para ser a fonte oficial**, mas **ainda não é** na prática: a flag `USE_MEMORY_STORAGE=true` e o fallback de escrita assimétrico mantêm o `memory-storage.json` como dependência operacional e fonte de divergência. A eliminação é de **baixo esforço no catálogo** e não requer tocar SSOT/parsers/OCR.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Auditoria: Atlas como Fonte Primária

**1. Diagnóstico:** O diagnóstico é tecnicamente correto e bem fundamentado. A análise da assimetria entre listagem/lote (memória) e cadastro/edição/EV (Atlas-only) é precisa. A dependência operacional do `memory-storage.json` versionado, mascarando os 95 documentos do Atlas com 9 seeds locais sob `USE_MEMORY_STORAGE=true`, é claramente identificada.

**2. Plano para Tornar o Atlas Única Fonte:** O plano é são e seguro. A proposta de flip de flags, a definição clara do papel do fallback (preferencialmente falha explícita), a remoção do versionamento do `memory-storage.json` e a migração/descarte dos seeds locais são passos lógicos e necessários. A observabilidade via `/api/health` é um bom complemento.

**3. Estimativas de Esforço e Risco de Divergência:** As estimativas de esforço (baixo para catálogo, médio para o app inteiro) parecem realistas, considerando que não envolvem SSOT/parsers/OCR. O risco de divergência é bem articulado, destacando a coexistência de fontes, o mascaramento pelo modo de memória, a divergência silenciosa e a efemeridade do arquivo local.

**4. Veredito:** **APROVADO COM RESSALVAS**

**Justificativa:** O Atlas está tecnicamente pronto para ser a fonte primária, e o plano de transição é sólido. No entanto, a auditoria revela uma dependência operacional significativa e riscos de divergência que precisam ser ativamente mitigados. A aprovação com ressalvas reconhece a prontidão do Atlas e a adequação do plano, mas enfatiza a necessidade de execução cuidadosa e completa das etapas propostas para garantir a integridade dos dados e a estabilidade operacional. A próxima sprint focada no "ATLAS-CUTOVER" é crucial.
