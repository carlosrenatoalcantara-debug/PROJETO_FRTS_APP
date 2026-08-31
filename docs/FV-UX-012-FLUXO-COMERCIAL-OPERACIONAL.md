# FV-UX-012 — Fluxo comercial operacional na nova UX

**Data:** 2026-08-12
**Resultado:** a nova UX deixou de ser somente leitura. Projeto → Cotação → Orçamento → Emissão → Aprovação → Baseline → Gate executável sem o wizard legado.

---

## FASE 1 — Auditoria da árvore `frontend/src/fv/`

A sprint foi encontrada **parcialmente executada** (rodada anterior interrompida). Estado no início:

| Camada | Situação | Faltava |
|---|---|---|
| `api/agregadosFvApi.js` | ✅ 7 operações de escrita | — |
| `providers/CotacoesProvider` | ✅ `acoes.criar` | — |
| `providers/OrcamentosProvider` | ✅ `acoes.{criar,editar,emitir,aprovar,rejeitar,cancelar}` | — |
| `componentes/BotaoAcao` | ✅ estados + erro do servidor | — |
| `paginas/etapas/EtapaAprovacao` | ✅ emitir · aprovar · rejeitar | — |
| **`paginas/etapas/EtapaCotacao`** | ❌ somente leitura | **criar cotação** |
| **`paginas/etapas/EtapaOrcamentos`** | ❌ somente leitura | **criar orçamento · emitir · cancelar** |

Ou seja: infraestrutura pronta, **telas de Cotação e Orçamentos ainda sem ação**.

---

## FASE 3 — Cotação

Criado [`FormNovaCotacao.jsx`](../frontend/src/fv/componentes/FormNovaCotacao.jsx) (124 linhas), integrado ao cabeçalho de `EtapaCotacao`.

| Garantia | Como |
|---|---|
| N cotações por projeto | o formulário não limita; o domínio também não |
| Não vira orçamento automaticamente | criar cotação só chama `CotacaoService.criar` |
| Não abre Engenharia / Homologação / Gate | nenhuma delas depende de cotação |
| Validação é do domínio | tecnologia ausente → erro do `CotacaoService`, exibido como veio |

**Único tratamento local é de TIPO:** campo numérico vazio vira `undefined`, não `0`. Enviar `0` afirmaria uma premissa que o usuário não informou.

Após criar, a nova cotação é automaticamente selecionada na tela.

---

## FASE 4 — Orçamento

Criado [`FormNovoOrcamento.jsx`](../frontend/src/fv/componentes/FormNovoOrcamento.jsx) (145 linhas) e `CartaoOrcamento` ganhou ações contextuais.

| Garantia | Como |
|---|---|
| N orçamentos por projeto | sem limite no formulário |
| `cotacao_ref` obrigatório | seletor de cotação; **é aqui que a cotação é escolhida** (M-1) |
| Botão desabilitado sem cotação | com explicação: *"o orçamento deriva dela (M-1)"* |
| Histórico preservado | cancelar mantém o orçamento na lista |
| Vigente vem do service | a UX não deduz |
| **Totais não são enviados** | derivados dos itens no servidor (INV-58) — verificado no check |

### Ações por estado

| Estado | Ações oferecidas |
|---|---|
| `RASCUNHO` | Emitir · Cancelar |
| `EMITIDO` | Cancelar (Aprovar/Rejeitar ficam em `EtapaAprovacao`) |
| `APROVADO` · `REJEITADO` · `CANCELADO` | nenhuma — terminais |

**Ocultar um botão é conveniência de interface, não regra.** A máquina de estados vive no `OrcamentoService`; se a ação for forçada, o domínio recusa com 422 `TRANSICAO_INVALIDA`. O `BotaoAcao` exibe a mensagem do servidor sem reinterpretá-la.

---

## Nenhuma regra migrou para o cliente

Este era o risco central da sprint. Verificado por varredura estática nos 10 arquivos da UX que tocam escrita:

```
nenhuma regra de domínio copiada para o cliente
```

O check procura por `TRANSICOES_ORCAMENTO`, `validarTransicaoOrcamento`, `avaliarCongelamento`, `conteudoTravado` e `ORCAMENTO_CONTEUDO_TRAVADO` — nenhum aparece.

O cliente faz três coisas: monta o payload, chama **uma** operação, exibe o erro do servidor.

---

## Validação

[`fluxoComercialEscrita.check.js`](../backend/src/controllers/__checks__/fluxoComercialEscrita.check.js), seção 16 nova:

```
✓ cliente cobre as 7 operações de escrita (nenhuma faltando)
✓ CotacoesProvider expõe a mutação de criação
✓ OrcamentosProvider expõe as 6 mutações de orçamento
✓ 4 telas disparam escrita (todas)
✓ nenhuma regra de domínio copiada para o cliente
✓ formulário de orçamento NÃO envia totais (INV-58 — derivados no servidor)
✓ formulário de orçamento envia `cotacao_ref` — a escolha da cotação (M-1)
✓ todo caminho chamado pela UX existe no router (nenhum órfão)
✓ ordem correta: /orcamentos/vigente antes de /orcamentos/:orcamentoId
```

Verificação em modo dev: **30/30 módulos carregam**, 7/7 operações no cliente, 4 arquivos disparam escrita.

### Dois falsos positivos que investiguei

A varredura por `.orcamento` (subdoc legado) apontou dois arquivos. Ambos são falsos positivos:

- `OrcamentosProvider:59` — `vig.dados?.orcamento` é o **envelope da resposta** de `GET /orcamentos/vigente`
- `EtapaBaseline:29,51` — `conteudo?.orcamento` é o **snapshot congelado dentro da Baseline**

Nenhum é `ProjetoFV.orcamento`.

### Regressão

| Check | Resultado |
|---|---|
| Backend boot | ✓ |
| 8 checks de domínio e API | ✓ todos |
| Build frontend | ✓ 2393 → **2395 módulos** |
| Suíte frontend | **idêntica ao baseline** — 25 falhas, 940 passando |
| Arquivos de backend alterados | apenas o **check** (extensão da seção 16) |

---

## Critério de conclusão

| Exigência | Status |
|---|---|
| Fluxo comercial executável na nova UX | ✅ criar cotação → criar orçamento → emitir → aprovar → Baseline → Gate |
| Sem o wizard legado como caminho operacional | ✅ entrada em `/fv/projetos` desde a FV-UX-011 |
| API-002 é a autoridade da escrita | ✅ 7/7 operações; delegação pura |
| Sem regra duplicada no frontend | ✅ verificado por varredura |
| Sem `ProjetoFV.orcamento` como fonte | ✅ |
| Sem regressão | ✅ |

**Nada commitado.**
