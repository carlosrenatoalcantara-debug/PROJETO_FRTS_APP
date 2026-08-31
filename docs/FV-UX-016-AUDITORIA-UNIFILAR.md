# FV-UX-016 — Auditoria do Unifilar (§1) — **PARADA ANTES DE IMPLEMENTAR**

**Data:** 2026-08-14
**Natureza:** auditoria. Nenhum arquivo de código alterado.
**Resultado:** a auditoria **contradiz a premissa da sprint**. Migrar a UX como especificado exige uma decisão que não é minha.

---

## A premissa que não se sustenta

O prompt da sprint parte da FV-DOM-006:

> engine de Unifilar: EXISTENTE · API: EXISTENTE · 3 rotas: EXISTENTES · agregado: NÃO NECESSÁRIO · backend novo: NÃO NECESSÁRIO · **pendência principal: UX**

As três rotas existem. A engine do backend existe. **Mas ela não é a que produz o desenho que o usuário vê.**

A aba Unifilar do wizard **não chama o backend**. Ela desenha no cliente.

Aquela auditoria também afirmava *"o motor é o `@fortesolar/diagram-engine`"*. **O `diagram-engine` não tem adapter FV** — tem `ev.js`, `bomEV.js`, `especificacaoEV.js`, e o `gerarPDFUnifilar.js` do backend importa `adapters/ev`. Eu escrevi aquela linha na FV-DOM-006 sem abrir o pacote; está errada.

---

## O que existe de fato: quatro desenhos, não um

| # | Onde | Tamanho | Quem consome | O que sabe desenhar |
|---|---|---|---|---|
| 1 | `backend/utils/simbolosUnifilar.js` + `gerarUnifilarFV` | 277 + 80 | **ninguém no FV** | string simples, inversor único |
| 2 | `frontend/utils/gerarUnifilarSVG.js` | **507** | a aba do wizard | MPPT, micro, condutores, proteções, ativos |
| 3 | `packages/diagram-engine` | pacote | EV (PDF, propostas) | **sem adapter FV** |
| 4 | `frontend/pages/Unifilar.jsx` | 150 | rota pública `/unifilar/:id` | ativos em campo (gêmeo digital) |

### 1 · A engine do backend — órfã e mais pobre

`POST /api/unifilar/fv/gerar` e `POST /api/projetos-fv/:id/unifilar/gerar`.

Busquei consumidores no frontend: **zero para FV**. O único chamador de `/api/unifilar/*` é `UnifilarEV.jsx`, que usa `/ev/gerar`. `/arquitetura` não tem chamador nenhum.

E o que ela desenha, quando chamada pela rota do projeto (`gerarUnifilarProjeto`), é isto:

```js
inversor: { potenciaKW: dim.potenciaArredondada, modelo: 'Fronius SYMO' },
tensao_rede: 'trifasico',
bess: null,
```

Marca e modelo **hardcoded**, trifásico fixo, BESS sempre nulo, disjuntor `'63A'` literal. Um projeto Deye monofásico com BESS sai como um Fronius trifásico sem bateria. Não é uma engine incompleta — é uma engine que **afirma coisas falsas sobre o projeto**.

Ela também **não persiste nada**: devolve o SVG e encerra. O cache `projeto.unifilar` só é gravado por `salvarEtapaProjetoFV` com `etapa: 'unifilar'`, cujo `default:` faz `$set[etapa] = dados` — ou seja, **o cliente escolhe o conteúdo do cache**. Não há invalidação nem regeneração automática.

Sem guard de tenancy: `app.use('/api/unifilar', rotasUnifilar)` entra sem `protegerModulo` nem `exigirOrganizacao`. A rota `/:id/unifilar/gerar` tem escopo (`aplicarEscopo`), a de `/api/unifilar` não.

### 2 · O gerador do frontend — o que os usuários realmente veem

`gerarUnifilarSVG(projeto, ativos)` desenha por MPPT, distingue micro de string, numera condutores, rotula proteções, e injeta `data-qr` nos símbolos para o clique abrir o ativo comissionado.

E ele depende disto:

```js
import { montarModeloEletrico } from './engenhariaNormativa'
```

`frontend/src/utils/engenhariaNormativa.js` — **341 linhas de cálculo elétrico normativo**, declarando NBR 16690, NBR 5410, NBR 5419, NBR 16800 e IEC 60364-7-712: Voc corrigida por temperatura mínima, Vmpp por temperatura de célula, tabela `TEMPERATURAS_UF`, dimensionamento de condutores e de proteções.

**Não existe equivalente no backend nem no `fv-shared`.** Procurei `montarModeloEletrico` em `backend/src` e em `packages/`: nada.

---

## O bloqueio

Isto é o achado R1 da FV-DOM-006 outra vez — regra crítica vivendo só no cliente — **mas maior**. Lá era cálculo financeiro; aqui é dimensionamento elétrico sob norma ABNT.

As proibições da sprint colidem entre si neste terreno:

> NÃO reimplementar geração do SVG no frontend · NÃO duplicar regras de engenharia · NÃO criar segunda fonte de verdade · NÃO criar API nova · NÃO criar engine paralelo

Os dois caminhos possíveis violam alguma delas:

**A · Nova UX consome a engine do backend** — respeita "backend é a fonte", mas o desenho **regride**: perde MPPT, micro, condutores, proteções e o vínculo com ativos, e passa a rotular todo inversor como Fronius SYMO. Trocaria um desenho correto por um errado, dentro da tela nova. Não é migração, é perda de função.

**B · Nova UX reusa `gerarUnifilarSVG` do frontend** — preserva o desenho e não *cria* segunda fonte (ela já existe há sprints), mas consolida a engenharia normativa no cliente e contraria o espírito da sprint. Entrega rápida, dívida mantida.

**C · Mover `engenhariaNormativa` + geração para o domínio** — é o único caminho que satisfaz as proibições de fato. Mas é uma sprint de **domínio**, não de UX: 848 linhas migradas (341 normativas + 507 de desenho), com o `catalogoEletrico` que elas leem, e exige verificação de que o SVG resultante é idêntico ao atual antes de trocar.

Nenhuma leitura é obviamente a pretendida, e cada uma produz um trabalho diferente. Por isso **parei aqui**, como em FV-API-002 (*"se a operação não existir no domínio: PARAR e reportar"*) e FV-UX-013 (*"dependência ambígua → PARAR E REPORTAR"*).

---

## O resto da auditoria (para quando a decisão vier)

### Acoplamento da tela legada — baixo

`UnifilarFV.jsx` (202 linhas) recebe `projeto` por prop de `ProjetosFVDetalhes:260`. **Não usa `ProjetoFVContext` nem `projetoFVApi`.** A única chamada de rede é `GET /api/ativos/projeto/:id`.

Migrar a *casca* é barato: cabeçalho com 4 indicadores, botão gerar, download SVG/PNG, badge de origem (`snapshot` × `dados_atuais`) e o clique que navega para `/ativo/:qr`. O caro é decidir **de onde vem o SVG**.

### Um comportamento que merece sobreviver

A tela distingue explicitamente **snapshot congelado** de **dados atuais**, com aviso visível quando é o segundo. Isso é o M-2 aparecendo na interface — um projeto congelado mostra o desenho da baseline, não o de agora. Qualquer migração precisa preservar essa distinção; perdê-la seria pior que não migrar.

### Onde a etapa entraria

```
/fv/projetos/:id
  └── grupo `execucao` → etapa `unifilar`
        └── UnifilarProvider  (a definir: qual fonte)
              └── ProjetoProvider (projeto + governanca.snapshot_unifilar)
              └── GET /api/ativos/projeto/:id
```

Grupo `execucao`, junto de Engenharia: o unifilar é produto da engenharia elétrica, não do comercial.

---

## O que eu recomendo

**Caminho C, como sprint de domínio (FV-DOM-007B), antes da UX.**

Motivo: as opções A e B são as duas metades ruins do mesmo problema — A entrega uma tela nova que mente sobre o projeto, B entrega uma tela nova que mantém cálculo normativo no navegador. O unifilar é peça de **homologação junto à concessionária**; um diagrama que declara o inversor errado não é um detalhe estético.

Se a prioridade for reduzir a AMB-2 rápido, **B é aceitável como passo explicitamente provisório** — mas então a sprint precisa dizer isso, porque hoje ela proíbe.

Sequência sugerida: **FV-DOM-007** (financeiro, R1) e **FV-DOM-007B** (elétrico normativo) tratam o mesmo defeito estrutural — regra de engenharia no cliente. Fazer as duas juntas é mais barato que separadas.

---

## Nada foi alterado

Nenhum arquivo de código tocado. Nenhuma rota, engine, agregado ou dado. Produção intocada. Sem commit.

**Aguardando decisão entre A, B e C para prosseguir.**
