# FV-DOM-007B — Motor canônico de Unifilar FV

**Data:** 2026-08-14
**Resultado:** a engenharia normativa FV saiu do navegador. O unifilar passa a ser derivado no domínio e servido pela API — **sem alterar uma linha de fórmula**.

---

## O fluxo aprovado, implementado

```
engenharia normativa FV → domínio/Core → motor canônico → API → nova UX
```

| Camada | Onde | Linhas |
|---|---|---|
| Engenharia normativa | `packages/fv-shared/engenharia/engenhariaNormativa.js` | 345 |
| Catálogo elétrico | `packages/fv-shared/engenharia/catalogoEletrico.js` | 271 |
| Motor de desenho | `packages/fv-shared/engenharia/unifilarSVG.js` | 488 |
| **Adapter de domínio** | `backend/src/dominio/unifilar/adaptarProjeto.js` | **189 (novo)** |
| **Motor canônico** | `backend/src/dominio/unifilar/index.js` | **76 (novo)** |
| API | `POST /:id/unifilar/gerar` — **rota existente, implementação trocada** | — |

**Nenhuma rota nova. Nenhum agregado. Nenhum engine paralelo.**

### Por que no pacote compartilhado e não dentro de `backend/src`

O wizard legado ainda existe e ainda desenha. Se o código fosse copiado para o backend, haveria **duas cópias vivas** durante toda a transição — exatamente a segunda fonte de verdade que a sprint proíbe.

No pacote, há **um arquivo**. O backend o consome como dependência (vendorizado, `@fortesolar/fv-shared@0.1.6`), e o frontend legado o alcança por re-export. O wizard e o servidor executam **o mesmo código**, não códigos equivalentes. Quando a UX migrar, os shims morrem e nada mais precisa ser reconciliado.

As duas funções que dependiam de DOM — `baixarUnifilarSVG` e `converterSVGparaPNG` — **não foram movidas**: são entrega, não geração, e continuam no frontend.

---

## A prova de que o desenho não mudou

Mover cálculo normativo é a operação em que um erro passa despercebido: um sinal trocado num coeficiente térmico não quebra teste nenhum — só produz um unifilar que a concessionária reprova meses depois.

Por isso a verificação não é por amostragem. `unifilarEquivalencia.check.js` reconstrói o motor **original a partir do `git HEAD`**, carrega os dois lado a lado e compara **byte a byte**:

| Fixture | Bytes | Igual |
|---|---|---|
| multi-MPPT · 2 MPPTs assimétricos · RN | 27 653 | ✓ |
| string única · monofásico 220 V | 21 940 | ✓ |
| micro · bifásico · RS (Tmin −8 °C) | 22 276 | ✓ |
| sem `arranjoMPPTs` — fallback legado | 22 087 | ✓ |
| projeto vazio — só defaults | 16 446 | ✓ |
| string longa — corte "+N" | 21 640 | ✓ |
| escape XML (`&`, `<`, `>`) | 16 592 | ✓ |
| as 3 primeiras **com ativos vinculados** | — | ✓ |

Mais: o corpo de `engenhariaNormativa.js` é comparado byte a byte com o do `HEAD` (só cabeçalho de documentação e caminho de import podiam mudar), e seis fórmulas sensíveis são conferidas por valor — Voc_max a −8 °C, Isc × 1,25, corrente AC mono e trifásica, cabo DC mínimo de 4 mm², faixa do DPS.

**A referência não é uma cópia que eu mantenho à mão — é o arquivo como estava antes desta sprint.**

---

## O adapter: a única coisa que muda o desenho

Aqui está o achado que a auditoria FV-UX-016 não tinha alcançado.

O motor nasceu dentro do wizard e espera o formato do **contexto do wizard**: `painel`, `inversor`, `arranjoMPPTs`, `tipo_ligacao`, `tensao` — camelCase, tudo na raiz. O documento **persistido** tem outra forma: `equipamentos.paineis[]`, `equipamentos.inversor`, `dimensionamento.num_paineis`, `fatura_extracao.tipo_ligacao` — snake_case e aninhado.

**As duas formas nunca foram reconciliadas.** A aba legada entrega o documento cru ao motor, o motor não encontra nenhum dos campos que procura, e cai nos defaults internos:

```
módulo 550 W / 49,5 V · inversor 5 kW · 1 MPPT · monofásico 220 V · 6 módulos
```

Ou seja: para um projeto salvo, **boa parte do diagrama exibido hoje não descreve o projeto**. A engine órfã do backend mentia por estar hardcoded; a do frontend mente por não conseguir ler o documento. O adapter é o que corrige isso.

Medido no ambiente isolado, mesmo projeto, antes e depois:

| | Aba legada (documento cru) | API canônica (com adapter) |
|---|---|---|
| Inversor | *default* 5 kW, 1 MPPT | **Deye SUN-8K-G03**, 8 kW, 2 MPPT |
| Módulos | *default* 6 | **26** |
| Potência CC | 3,3 kWp | **14,3 kWp** |
| Ligação | *default* mono 220 V | **trifásico 380 V** |
| Topologia | 1 string | **2×9 + 1×8 por MPPT** |
| Voc_max | 314,2 V (Tmin padrão) | **459,7 V** (Tmin de RN) |

### Proveniência em vez de fallback silencioso

Todo campo declara de onde veio (M-3). O que o projeto não fornece aparece em `lacunas`, e o motor aplica o default **dele** — a diferença é que o default deixa de ser invisível:

```json
"proveniencia": { "painel": "equipamentos.paineis[0]", "uf": "localizacao.estado", … }
"lacunas": []
```

Isso já pagou por si: a proveniência apontou `uf: null` num projeto que eu havia semeado com `estado: 'RN'`. O campo `estado` **não existe na raiz** de `ProjetoFV` — pertence a `localizacao`, e o strict-mode do Mongoose descartava silenciosamente o valor que o wizard mandava solto. Sem a proveniência, o diagrama teria saído com a temperatura errada e ninguém veria.

A UF é o campo de maior efeito elétrico do adapter: ela define Tmin, que define Voc_max, que define o DPS. O check comprova a sensibilidade — o mesmo projeto em RS produz Voc_max 488,1 V contra 459,7 V em RN.

---

## O que a API devolve agora

```
POST /api/projetos-fv/:id/unifilar/gerar
→ { sucesso, svg, origem, proveniencia, lacunas, especificacoes }
```

`especificacoes` traz o modelo elétrico como **dado** — potências, Voc_max, Icc, correntes, seções de cabo, disjuntor, DPS, fases. A UX mostra números sem reextraí-los do SVG, e o memorial pode reusá-los sem recalcular.

`origem` é sempre `dados_atuais`. **O desenho congelado é outro fato** e continua em `governanca.snapshot_unifilar` — a distinção que a FV-UX-016 marcou como M-2 na interface está preservada, e a rota não a apaga.

O domínio **não persiste**: gerar o diagrama é derivação pura (INV-58). O cache `ProjetoFV.unifilar` continua sendo escrito por quem já o escrevia; esta sprint não muda quem escreve.

---

## Regressão

| Verificação | Resultado |
|---|---|
| `unifilarEquivalencia.check.js` | ✓ equivalência byte a byte, 7 fixtures + ativos |
| `unifilarDominio.check.js` | ✓ 11 seções (adapter, proveniência, pureza, contrato da rota) |
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | **idêntica ao baseline** — 25 falhas em 6 arquivos |
| Demais checks de backend | 8 de 9 ✓ |
| Produção | intocada |

`instalacaoRefEtapa.check.js` segue falhando com `TENANT_AUSENTE` — pré-existente, registrado na FV-UX-015: o check fabrica `req` sem `auth` contra um `aplicarEscopo` fail-closed que já está no `HEAD`.

### Um susto que não era um defeito

A suíte completa terminou em **segmentation fault** três vezes seguidas. Não era o código: o MongoDB de validação e o backend estavam no ar disputando memória com os 76 arquivos de teste. Parados eles, a suíte concluiu normalmente com exatamente as 25 falhas do baseline. Verifiquei também por diretório (components 23 · utils 2 · pages 0 = 25) antes de concluir isso.

---

## O que continua pendente

**A engine órfã do backend não foi removida.** `unifilarController.gerarUnifilarFV` e `simbolosUnifilar.js` (357 linhas) agora estão duplamente órfãos para FV — mas o mesmo controller serve `POST /api/unifilar/ev/gerar`, que **o `UnifilarEV.jsx` usa de verdade**. Remover exige separar FV de EV ali, e isso é outra sprint.

**`POST /api/unifilar/*` continua sem guard de tenancy** — entra em `server.js` sem `protegerModulo` nem `exigirOrganizacao`. A rota canônica (`/:id/unifilar/gerar`) tem escopo; aquela não. Registrado, não corrigido: mexer nela afeta EV, fora do escopo desta sprint.

**A UX ainda não consome a API.** Esta sprint entregou o motor e o endpoint; a aba legada segue desenhando no cliente pelo shim — executando o mesmo código, mas alimentada pelo documento cru, com os defaults descritos acima. Fechar isso é a FV-UX-016, agora desbloqueada: o caminho C existe e está provado.

---

**Nada commitado. Produção intocada.**
