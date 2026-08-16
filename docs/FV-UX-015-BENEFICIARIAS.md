# FV-UX-015 — Beneficiárias na nova UX

**Data:** 2026-08-14
**Resultado:** Beneficiárias sai da dependência do wizard legado e passa a ser etapa do fluxo `/fv`. Uma das 7 abas da AMB-2 removida da lista.

---

## O que a auditoria (FV-DOM-006) já tinha estabelecido

```
UnidadeBeneficiaria
├── Agregado : EXISTENTE (15 campos, ESCOPO_TENANT)
├── API      : EXISTENTE (7 rotas)
├── Domínio  : EXISTENTE (beneficiariaRateio, em @fortesolar/fv-shared)
└── Falta    : UX
```

Confirmado na execução. **Nenhuma rota criada, nenhum model tocado, nenhuma regra escrita.** A sprint foi só interface.

---

## Entregue

| Camada | Arquivo | Natureza |
|---|---|---|
| API cliente | `fv/api/agregadosFvApi.js` | +6 funções (26 exports) |
| Provider | `fv/providers/BeneficiariasProvider.jsx` | **novo** |
| Formulário | `fv/componentes/FormNovaBeneficiaria.jsx` | **novo** (cria e edita) |
| Tela | `fv/paginas/etapas/EtapaBeneficiarias.jsx` | **novo** |
| Fluxo | `fv/fluxo.js` | +etapa `beneficiarias`, grupo `origem` |
| Rota | `fv/rotas.jsx` | `/fv/projetos/:id/beneficiarias` |
| Composição | `fv/providers/FvProviders.jsx` | provider aninhado + reexport |

A etapa entra no grupo **Projeto**, não em Comercial: as unidades beneficiárias descrevem *quem recebe os créditos*, o que precede qualquer cotação.

---

## A decisão que sustenta a tela: nenhum rateio no cliente

O provider lê `GET /:id/beneficiarias/resumo`, que já devolve a lista **e** o rateio consolidado. A tela exibe `rateio.status` — `ok` / `incompleto` / `excedido` — sem somar um percentual sequer.

O motivo é o defeito que a FV-UX-004 mapeou: regra duplicada em cliente e servidor vira **duas verdades**. O limite de 100%, a soma e as modalidades GD são do domínio (`beneficiariaRateio`), e o servidor é quem recusa.

Comprovação na interface: tentar adicionar 10% com o rateio já em 100% devolveu a mensagem do servidor, literal —

```
Soma de percentuais ultrapassaria 100%. Disponível: 0.00%
```

— e não uma validação local que adivinhasse a mesma coisa.

---

## Dois ajustes que a validação exigiu

### 1. Mensagem de erro que se perdia

`agregadosFvApi.enviar()` lia apenas `corpo.erro`. As rotas de beneficiárias (S8.7, anteriores aos endpoints canônicos) respondem `corpo.mensagem`.

Sem o ajuste, *"Soma de percentuais ultrapassaria 100%"* chegaria ao usuário como **`criarBeneficiaria: 400`** — um número mudo. Fallback adicionado, mantendo `erro` com precedência.

### 2. `modalidades` não é lista de strings

O `/resumo` devolve `[{ id, label }]`, não `['autoconsumo_local', …]`. O `<select>` grava `id` e exibe `label`; a listagem traduz o id de volta pelo mesmo dicionário que o servidor mandou — sem tabela de rótulos duplicada no cliente.

---

## Check ampliado

`fluxoComercialEscrita.check.js` §15 verifica que **todo caminho chamado pela UX existe no router**. Ele lia só `routes/projetosFV.js` e acusou 5 órfãs — corretamente, do seu ponto de vista: beneficiárias vivem em router próprio, montado em `/api/projetos-fv/:id/beneficiarias` no `server.js`.

O check passou a ler os dois routers e a reprefixar os caminhos do segundo. **A verificação ficou mais forte, não mais frouxa** — se alguma função do cliente apontar para uma rota inexistente, ela continua sendo acusada.

---

## Validação pela interface

Ambiente isolado (`ambiente-validacao-fv.mjs`, MongoDB em memória na 37017), backend real na 5001, frontend real, operado pela UI:

| Passo | Resultado |
|---|---|
| Abrir a etapa | 2 unidades, badge **Rateio completo — 100%** |
| Criar excedendo 100% | recusado com a mensagem do servidor |
| Editar 40% → 30% | salvou; rateio virou **incompleto — faltam 10%** |
| Remover UC-002 | lista com 1 unidade; rateio **60%, faltam 40%** |
| Modalidade GD | rótulos legíveis no select e na listagem |

O rateio mudou nos três casos **porque o servidor recalculou**, não porque a tela somou.

---

## Regressão

| Check | Resultado |
|---|---|
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | **idêntica ao baseline** — 25 falhas em 6 arquivos |
| Checks de backend | 7 de 8 ✓ |

### A falha restante é pré-existente

`instalacaoRefEtapa.check.js` — 5 falhas, todas `403 TENANT_AUSENTE`.

O check chama `salvarEtapaProjetoFV` com um `req` fabricado **sem `auth`**, e o handler usa `aplicarEscopo` fail-closed. Verifiquei no `git HEAD`: o guard já está lá, anterior a esta sessão. O check é que ficou defasado do contrato de tenancy.

Não toca beneficiárias, frontend nem qualquer arquivo desta sprint. **Registrado, não corrigido** — consertá-lo é decidir como os checks autenticam, e isso não cabe numa sprint de UX.

---

## Estado da AMB-2

Antes: 7 abas só no legado. Agora **6** — Layout, BESS, Financeiro, Unifilar, Documentos, CRM.

Pela ordenação da FV-DOM-006, **Unifilar** é a próxima mais barata: 3 rotas e o `@fortesolar/diagram-engine` já prontos, também só UX.

**Produção intocada. Nada commitado.**
