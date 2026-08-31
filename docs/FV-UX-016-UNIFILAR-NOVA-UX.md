# FV-UX-016 — Unifilar na nova UX

**Data:** 2026-08-14
**Resultado:** o Unifilar entra em `/fv/projetos/:id/unifilar` consumindo o motor canônico. A AMB-2 cai de 6 para 5 abas.

---

## O fluxo obrigatório, implementado

```
ProjetoFV → POST /api/projetos-fv/:id/unifilar/gerar → motor canônico
          → svg + proveniência + lacunas + especificações → nova UX
```

| Camada | Arquivo | Natureza |
|---|---|---|
| API cliente | `fv/api/agregadosFvApi.js` | `+gerarUnifilar()` |
| Provider | `fv/providers/UnifilarProvider.jsx` | **novo** |
| Tela | `fv/paginas/etapas/EtapaUnifilar.jsx` | **novo** |
| Fluxo | `fv/fluxo.js` | +etapa `unifilar`, grupo `execucao` |
| Rota | `fv/rotas.jsx` | `/fv/projetos/:id/unifilar` |
| Teste | `fv/__tests__/unifilarSemDefaults.test.jsx` | **novo — 8 casos** |

**Nenhum endpoint criado.** O da FV-DOM-007B bastou. `/api/unifilar/*` não foi tocado, a engine do EV não foi alterada e `snapshot_unifilar` não foi escrito.

A etapa entra em **Execução**, ao lado de Engenharia: o unifilar é produto da engenharia elétrica. Não tem agregado próprio — é derivado do `ProjetoFV` (INV-58).

---

## §3 — Nenhuma engenharia no cliente

O provider e a tela não calculam Voc, não corrigem por temperatura, não dimensionam condutor nem proteção, não interpretam MPPT, não decidem fases nem BESS, não geram topologia e não remontam o SVG.

Isso não é uma promessa no comentário: o teste **varre o fonte dos dois arquivos** e falha se aparecer `montarModeloEletrico`, `calcularVocMaxString`, `calcularVmppMinString`, `calcularIscMax`, `calcularCorrenteAC`, `selecionarCabo`, `selecionarDPS`, `gerarUnifilarSVG`, `engenhariaNormativa`, `catalogoEletrico`, `TEMPERATURAS_UF` — ou mesmo um `Math.sqrt`.

O `POST` dispara ao abrir a etapa. É seguro porque o domínio **não persiste**: gerar é derivação pura, sem efeito colateral.

---

## §4 — A prova contra o defeito anterior

O projeto do enunciado, exercitado pela interface no ambiente isolado:

| Esperado | Na tela | Default que **não** apareceu |
|---|---|---|
| Deye SUN-8K-G03 | ✓ | ~~Fronius SYMO~~ |
| 8 kW | ✓ Potência CA 8 kW | ~~5 kW~~ |
| 2 MPPT | ✓ MPPT 1 (2×9) · MPPT 2 (1×8) | ~~1 MPPT~~ |
| 26 módulos | ✓ | ~~6 módulos~~ |
| 14,3 kWp | ✓ | ~~3,3 kWp~~ |
| trifásico 380 V | ✓ 3Ø 380 V — **de `fatura_extracao`** | ~~trifásico por default~~ |

O teste automatizado cobre os dois lados: afirma os valores reais **e** varre o DOM garantindo que nenhum dos cinco valores de default aparece. O caso com BESS entra pelo SVG do domínio — a UX não decide BESS, apenas exibe o que o motor desenhou.

Também confirmado no diagrama: Tmin de 14 °C (RN), Voc_max 459,7 V, cabo DC 4 mm², DJ 3P — todos do servidor.

---

## §5 — Proveniência e lacunas

A tela mostra, sob demanda, de onde veio cada dado:

```
Módulo fotovoltaico     → equipamentos.paineis[0]
Topologia por MPPT      → engenharia_eletrica.arranjo.mppts
Tipo de ligação         → fatura_extracao.tipo_ligacao
UF (temp. de projeto)   → localizacao.estado
```

E quando o servidor declara lacuna, ela aparece — não vira valor padrão silencioso.

Demonstrado ao remover a UF do projeto de validação:

```
1 dado(s) ausente(s) no projeto
  UF (temperatura de projeto)
  "O motor usou valores padrão para desenhar. Os itens abaixo NÃO descrevem
   este projeto — preencha-os antes de usar o diagrama para homologação."
```

E o efeito ficou visível na mesma tela: **Voc_max saltou de 459,7 V para 471,3 V**, porque sem UF o motor usa Tmin padrão em vez do de RN. Antes, esse número trocaria sozinho e ninguém saberia por quê.

---

## §6 — Snapshot × dados atuais

Os dois nunca são fundidos. Quando existe `governanca.snapshot_unifilar`, a tela oferece a escolha e diz o que está exibindo:

- **Dados atuais** (padrão) — diagrama, especificações, lacunas e proveniência;
- **Snapshot congelado** — só o desenho, com data e revisão, sob a legenda *"não reflete alterações posteriores do projeto"*.

Ao exibir o snapshot, as especificações e as lacunas **somem** — elas descrevem os dados atuais, e mostrá-las junto do desenho congelado seria misturar dois fatos. Verificado na interface: com o snapshot selecionado, o DOM contém `DESENHO CONGELADO` e não contém `SUN-8K-G03`.

O snapshot é apenas **lido**. Esta sprint não o escreve.

---

## §2.10 — Congelamento/gate sem booleano local

A tela pergunta ao contrato existente:

```js
const liberada = liberadaPara('engenharia')
const motivo   = motivoDe('engenharia')
```

Nenhum booleano de "congelado" é construído no cliente — a redução que a FV-UX-004 identificou como defeito (17 reimplementações do mesmo booleano). Na validação, o servidor respondeu bloqueio e a tela exibiu o motivo dele, literal:

> Engenharia ainda não liberada pelo Gate: **SEM_BASELINE**

O teste confirma que `liberadaPara` é chamado com `'engenharia'` e que o aviso aparece quando a resposta é `false`.

---

## Regressão

| Verificação | Resultado |
|---|---|
| Build frontend | ✓ 2396 módulos |
| Suíte frontend | 25 falhas em 6 arquivos — **idêntica ao baseline**; 973 testes (+8 novos, todos passando) |
| Checks de backend | 9 de 10 ✓ |
| Produção | intocada |

A falha restante é `instalacaoRefEtapa.check.js` (`TENANT_AUSENTE`) — pré-existente, já registrada na FV-UX-015 e na FV-DOM-007B: o check fabrica `req` sem `auth` contra um `aplicarEscopo` fail-closed que já está no `HEAD`.

---

## Estado da AMB-2

Antes: Layout, BESS, Financeiro, **Unifilar**, Documentos, CRM.
Agora: **5 abas** — Layout, BESS, Financeiro, Documentos, CRM.

A aba do wizard **não foi removida** (a sprint proíbe) e continua funcionando pelo shim — executando o mesmo motor, mas alimentada pelo documento cru, com os defaults descritos na FV-DOM-007B. Removê-la é a sprint que encerrar o wizard; a partir daí os shims de `gerarUnifilarSVG` e `engenhariaNormativa` também podem cair.

Pela ordenação da FV-DOM-006, o próximo mais barato é **Documentos** (`DocumentoTecnico` existe, faltam rotas CRUD — FV-API-003).

**Nada commitado.**
