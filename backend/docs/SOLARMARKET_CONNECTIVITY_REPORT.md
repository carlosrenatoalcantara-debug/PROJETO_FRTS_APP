# P0-SOLARMARKET-CONNECTIVITY-01 — Validação de conectividade (read-only)

> **Read-only.** Sem importar/gravar/sincronizar; sem alterar Atlas. Apenas autenticação real e
> **1 página** de leitura para validar credenciais e contar.

## FASE 1 — Credenciais no runtime

| Variável | Em `.env` (carregado por `dotenv/config`) | Em `.env.local` | Resultado |
|---|---|---|---|
| `SOLARMARKET_API_KEY` | vazio | **SET** (45 chars, formato `NNNN:…` mascarado) | presente em `.env.local` |
| `SOLARMARKET_API_URL` | vazio | **SET** (`https://business.solarmarket.com.br/api/v2`) | presente |
| `SOLARMARKET_API_TOKEN` | — | — | não existe (o SM usa **API_KEY** como token de signin) |

⚠ **Observação de configuração:** a credencial está em **`.env.local`**, que o `dotenv/config`
padrão **não carrega** (ele lê `.env`). O runtime padrão do servidor mostra as vars **vazias** —
foi necessário carregar `.env.local` explicitamente para este teste. **Verificar se o ambiente de
produção (Railway/Vercel) injeta a `SOLARMARKET_API_KEY` como variável real** (não via `.env.local`).

## FASE 2 — Autenticação real

| Passo | Resultado |
|---|---|
| `POST /api/v2/auth/signin` `{ token: API_KEY }` | **HTTP 200** ✓ |
| Token (JWT) recebido | **SIM** (`access_token`, 188 chars) ✓ |
| Permissões | suficientes para **leitura** de `/projects` e `/projects/:id/proposals` (HTTP 200) |

→ **Credenciais válidas e operacionais.**

## FASE 3 — Leitura de 1 página (somente contar)

| Consulta | Resultado |
|---|---|
| `GET /projects?page=1&limit=100` | **HTTP 200** · **100 itens** na página (cheia → existem mais) · sem `total` no payload |
| `GET /projects/2/proposals` (amostra) | **HTTP 200** · `pricingTable` = **10 itens** (equipamentos) · `variables` = **563** |
| Chaves do projeto | `id, name, description, **client**, responsible, representative, createdAt, **deletedAt**` |

**Confirmações estruturais:** o **cliente está embutido** no projeto (`client`); equipamentos vêm
no `pricingTable` da proposta; há **soft-delete** (`deletedAt`); **não há campo de documentos**
no payload do projeto (anexos provavelmente não expostos por essa rota).

## FASE 4 — Respostas

1. **Credenciais válidas?** **SIM** — auth HTTP 200 + JWT recebido.
2. **API acessível?** **SIM** — `/projects` e `/projects/:id/proposals` retornam HTTP 200.
3. **Quantos projetos existem?** **≥ 100 confirmados live** (página 1 cheia). Total exato **não
   vem no payload** → exige paginação completa (inventário). Consistente com o **~638 documentado**.
4. **Existem propostas?** **SIM** — o projeto amostrado tem proposta com `pricingTable` (10 itens)
   e `variables` (563).
5. **Existem equipamentos?** **SIM** — no `pricingTable[]` das propostas (não há catálogo separado).
6. **Existem documentos?** **Não evidenciados** — o payload do projeto **não traz campo de
   documentos/anexos**; nenhuma rota de documentos conhecida. (A confirmar com endpoint específico,
   se existir.)
7. **Estamos aptos para o inventário completo?** **SIM** — o bloqueio da sprint anterior
   (`P0-SOLARMARKET-LIVE-INVENTORY-01`) está **resolvido**: credencial válida + API acessível +
   endpoints retornando dados. O inventário completo pode ser executado (read-only, paginado).

### Conclusão
**Conectividade confirmada:** as credenciais do SolarMarket são **válidas e operacionais**
(auth 200 + JWT), a API responde e os dados existem (projetos ≥100, propostas, equipamentos no
`pricingTable`; clientes embutidos; documentos não expostos nessa rota). **Pendência de
configuração:** a chave está em `.env.local` (não no `.env` lido por padrão) — confirmar a
injeção em produção. **Apto para o inventário completo.** Nada foi importado/gravado (read-only).

**Próxima sprint recomendada:** **P0-SOLARMARKET-LIVE-INVENTORY-02** — agora desbloqueado:
paginar `/projects` (contagem real), amostrar `/proposals` (volumes de equipamentos/clientes) e
sondar a existência de endpoint de documentos.


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P0-SOLARMARKET-CONNECTIVITY-01

A revisão da sprint P0-SOLARMARKET-CONNECTIVITY-01 demonstra um processo de validação robusto e bem documentado. A metodologia adotada respeita estritamente o escopo "read-only", focando em autenticação e exploração de dados sem modificações.

**Análise dos pontos:**

1.  **Metodologia (read-only e escopo):** A abordagem de carregar `.env.local` explicitamente para a autenticação real e, em seguida, realizar uma única consulta paginada (`GET /projects?page=1&limit=100`) para validar a acessibilidade e a quantidade de dados, está perfeitamente alinhada com os requisitos de "read-only" e o escopo de validação de conectividade. A amostragem de propostas (`GET /projects/2/proposals`) também se encaixa nesse contexto.

2.  **Achado de configuração (.env.local vs .env):** Este achado é **altamente relevante**. A diferença entre `.env` e `.env.local` é uma fonte comum de problemas de configuração, especialmente em ambientes de produção onde `.env.local` geralmente não é versionado ou injetado. O reporte é claro e direto, destacando a necessidade de confirmação em produção.

3.  **Honestidade sobre projetos (≥100 vs ~638):** A honestidade é **adequada e crucial**. Reconhecer que o payload não fornece um total explícito e que a contagem real exigirá paginação completa é fundamental para o planejamento do inventário. A menção aos ~638 documentados fornece um contexto valioso.

4.  **Conclusões (apto para inventário, documentos não expostos):** As conclusões são **corretas** com base nas evidências apresentadas. A aptidão para inventário completo é justificada pela resolução do bloqueio anterior. A ausência de um campo de documentos no payload do projeto é uma observação importante, indicando que essa informação pode não estar acessível por essa rota ou que um endpoint específico é necessário.

5.  **Riscos/Efeitos colaterais:** Não há indícios de que a sondagem tenha alterado algo. A natureza "read-only" da operação minimiza riscos.

6.  **Veredito:** **APROVADO COM RESSALVAS**.

    *   **Aprovado:** A conectividade foi validada com sucesso, a API é acessível, credenciais funcionam e os dados essenciais para inventário (projetos, propostas, equipamentos) estão presentes.
    *   **Ressalvas:** A pendência de configuração sobre a injeção da chave em produção é um ponto crítico que precisa ser resolvido antes de considerar a sprint totalmente concluída e segura para operações em produção. A ausência de evidência de documentos também pode ser um ponto a ser investigado em etapas futuras, dependendo da necessidade.

A revisão é concisa, clara e fornece todas as informações necessárias para a tomada de decisão. A recomendação para a próxima sprint é lógica e bem fundamentada.
