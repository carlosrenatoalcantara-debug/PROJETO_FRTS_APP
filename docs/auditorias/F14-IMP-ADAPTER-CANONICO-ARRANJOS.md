# F14-IMP — Adapter canônico por arranjo

**Data:** 2026-09-14 · **Base:** `8e25bb0` (F14) · **Escopo:** etapas 1–3 do plano F14.
**Nenhum consumidor migrado. Nenhuma alteração de produção. Nenhum dado alterado.**
**`MULTIPLOS_INVERSORES` intacto. Fonte canônica de topologia inalterada.**

---

## 1. O que foi construído

Três coisas, todas sem consumidor ligado:

| Arquivo | Papel |
|---|---|
| `backend/src/dominio/topologia/arranjosCanonicos.js` | adapter: contrato canônico por arranjo |
| `backend/src/dominio/topologia/preservacaoArranjos.js` | comparador: preservação de informação (F14-2) |
| `backend/src/dominio/__checks__/equivalenciaArranjosF14.check.js` | executor do comparador + casos adversariais |
| `frontend/src/fv/__tests__/arranjosCanonicosF14.test.jsx` | cenários A–G + invariantes |

O adapter é **infraestrutura de migração**. A troca da fonte canônica é etapa
separada, e este guard é o pré-requisito dela.

---

## 2. Por que um adapter, e não a correção direta dos consumidores

A F14 mediu o dano: `homologacaoController` descarta até **354 de 565 módulos (63%)**
do documento da distribuidora; `unifilar/adaptarProjeto` produz `inversor: AUSENTE` em
**5 de 5** projetos multiarranjo.

Os dois fazem a mesma coisa — `find(principal) ?? arranjos[0]` — e a causa não é falta
de dado: `arranjos[]` tem tudo. É que **cada consumidor resolve compatibilidade legada
por conta própria**, e a forma mais curta de fazer isso é pegar o primeiro. Enquanto a
regra viver espalhada em seis lugares, cada novo consumidor a reinventa errado.

O adapter faz a regra existir **uma vez**. Corrigir os seis consumidores sem ele apenas
distribuiria a nova regra pelos mesmos seis lugares.

---

## 3. Não é um padrão novo

Constrói **sobre** `obterTopologiaProjeto`, a camada de acesso oficial que já existe e
que já proíbe ler `projeto.arranjos` fora dela. Normalização e totais continuam vindo de
`normalizarArranjos` / `calcularTotaisProjeto`, byte a byte.

O que o adapter acrescenta é o que faltava: **topologia e equipamento resolvidos por
arranjo, com procedência declarada**.

O formato espelha o caminho de **microinversor** — `configuracao_eletrica.micros[]` já é
por arranjo, já é canônico, e o domínio inteiro o consome sem passar por
`engenharia_eletrica`. String segue o mesmo desenho em vez de inventar outro.

---

## 4. Contrato

```js
{
  estado: 'sem_arranjos' | 'arranjo_unico' | 'multiarranjo',
  origem: 'arranjo' | 'instalacao',        // de obterTopologiaProjeto
  multiarranjo: boolean,
  arranjos: [{
    id,                                    // F13 — identidade
    ordem,                                 // POSIÇÃO, informativa; nunca identidade
    rotulo, tipo, principal, somente_leitura,
    modulos:   { estado, fonte, itens[], total },
    inversor:  { estado, fonte, itens[] },
    topologia: { estado, fonte, tipo, mppts[], micros[] },
    potencia:  { cc_kwp, ca_kw },          // null quando incompleta (F12)
  }],
  totais,                                  // DERIVADO — nunca segunda fonte
  fontes: { topologia: [...], inversor: [...] },
  avisos: ['MAIS_DE_UM_PRINCIPAL' | 'TOPOLOGIA_DE_PROJETO_NAO_ATRIBUIVEL'],
}
```

**Estados de dado:** `disponivel` · `ausente` · `ambiguo`.

`ambiguo` é o estado que não existia antes e que faz a diferença: o dado existe no
documento, mas dizer a qual arranjo ele pertence seria inventar a atribuição.

---

## 5. Fontes e precedência

| Dado | 1ª escolha | Fallback legado | Quando o fallback NÃO se aplica |
|---|---|---|---|
| Inversor | `arranjos[].inversores[]` → `fonte: arranjos` | `equipamentos.inversor` → `fonte: legacy_equipamentos_inversor` | multiarranjo → `ambiguo` |
| Topologia | `configuracao_eletrica.micros[]` ou `.mppts[]` → `fonte: arranjos` | `engenharia_eletrica.arranjo.mppts` → `fonte: legacy_engenharia_eletrica_arranjo` | multiarranjo → `ambiguo` |
| Módulos | `arranjos[].paineis[]` | — | — |
| Totais | `calcularTotaisProjeto` (derivado) | — | — |

**O fallback nunca é silencioso.** Todo dado presente carrega `fonte`, e o guard reprova
dado disponível sem fonte declarada.

**A regra do multiarranjo é o ponto central:** num projeto de dois arranjos, o inversor
da raiz e a topologia do projeto não pertencem a nenhum deles em particular. Atribuí-los
a um seria exatamente o `[0]` implícito que este módulo existe para remover. O adapter
devolve `ambiguo` e deixa a decisão para quem consome.

---

## 6. Invariantes

```
identidade > posição    `arranjo.id` (F13) identifica; `ordem` só ordena a exibição
ausência ≠ inferência   falta de dado vira estado nomeado, nunca um default
agregado = derivação    totais vêm dos arranjos, nunca de segunda fonte
fallback é explícito    toda leitura legada declara `fonte`
```

`arranjoPorId(canonico, id)` e `arranjoPrincipalUnico(canonico)` substituem
`find(principal) ?? arranjos[0]`. O segundo devolve **`null` quando há zero ou mais de
um principal**, em vez de escolher — `find()` devolvia o primeiro e escondia o problema.

---

## 7. Evidência — os 5 projetos reais

| Projeto | Arranjos preservados | Módulos (soma = totais) | Inversores por arranjo | Fonte |
|---|---|---|---|---|
| Mercado Avelino | **2 de 2** | 225 + 174 = **399** ✔ | Huawei 60K · Solplanet 50K | `arranjos` |
| Sistema FV 131.29 kWp | **2 de 2** | 225 + 160 = **385** ✔ | Huawei 60K · Huawei 50K | `arranjos` |
| Sistema FV novo kWp | **3 de 3** | 211 + 180 + 174 = **565** ✔ | Huawei 60K · 60K · 50K | `arranjos` |
| Ampliação | **2 de 2** | 8 + 0 = **8** ✔ | Solis 7K · *ambíguo* | `arranjos` + legado |
| Wagner Hoymiles + tcl | **2 de 2** | 4 + 12 = **16** ✔ | Hoymiles ×1 · ×3 | `arranjos` |

Nenhum arranjo descartado. Nenhuma soma divergente. A topologia aparece como `ausente`
em todos — é o estado real: `engenharia_eletrica` está ausente nos cinco.

O caso da Ampliação exercita `ambiguo`: o arranjo vazio não recebe o inversor da raiz.

---

## 8. Limitações declaradas

1. **Topologia por arranjo ainda não tem escritor.** O adapter lê
   `configuracao_eletrica.mppts` quando existe, mas ele está em 0/589 — na prática só o
   fallback legado e o caminho micro produzem topologia hoje.
2. **`ambiguo` não é resolvível sem decisão de produto.** Num projeto multiarranjo
   legado com topologia de projeto, não há regra que diga a quem ela pertence. O adapter
   nomeia; não decide.
3. **Caminho `instalacao` não exercitado.** `obterTopologiaProjeto` o suporta, mas
   segue dormente em produção; o adapter o repassa sem tratamento especial.
4. **Compatibilidade por arranjo não representada.** Fora do escopo desta etapa;
   `arranjos[].configuracao_eletrica.compatibilidade` continua sem escritor.
5. **Nenhum consumidor usa o adapter.** Verificado por guard: 607 arquivos varridos,
   zero importações fora do próprio módulo.

---

## 8-bis. Guard de preservação — revisão F14-2

### Preservação, não equivalência

O arquivo executor manteve o nome `equivalencia` por continuidade com o commit
`c238542`, mas o contrato **não é** `legado === adapter`. A lógica mora em
`preservacaoArranjos.js`, e é isso que ela verifica:

| | significado | veredito |
|---|---|---|
| **PERDA** | o adapter deixou de representar algo que o documento tem | **FALHA** |
| **GANHO** | o adapter representa algo que o legado descarta | esperado |

**Assimetria intencional:** em arranjo único, ganho é zero e os dois modelos
coincidem. Em multiarranjo, ganho **zero** significa que o adapter está
descartando igual ao legado — e isso reprova. *Empate, ali, é o defeito; não a
aprovação.*

### Definição de perda de informação

Comparada **por identidade** (`arranjo.id`), nunca por posição:

| Dimensão | Critério |
|---|---|
| Quantidade | `adapter.length ≠ doc.length` |
| Identidade | id do documento ausente no adapter, **ou** id inventado pelo adapter |
| Módulos | **por arranjo** e no total — a soma sozinha não basta |
| Potência | por arranjo; `null` é resposta válida (F12) |
| Inversor | por **assinatura** (fabricante, modelo, potência, quantidade), não por contagem |
| Topologia | estado, contagem de itens e tipo, contra o que o documento oferece |
| Origem | todo dado `disponivel` declara `fonte` |

### Os quatro buracos corrigidos

A primeira versão do guard estava verde e, ainda assim, insuficiente:

1. **O comparador nunca foi provado falhar.** `compararModelos` chamava
   `arranjosCanonicos` por dentro, então todos os cenários rodavam contra a
   implementação correta. Se ele sempre devolvesse `{ perdas: [] }`, o guard
   inteiro continuaria verde. *Um guard que nunca falhou não é um guard — é uma
   afirmação.* O adapter passou a ser injetável.
2. **Módulos só pela soma** — trocar 225 ↔ 174 entre dois arranjos mantém 399.
3. **Inversor só pela contagem** — trocar Solplanet 50K por Huawei 60K mantém "1".
4. **Topologia só por consistência interna** — nunca contra o documento.

Um quinto apareceu ao escrever os testes adversariais: **`ganhos` media o
documento, não o adapter**. Com isso, um adapter que descartasse tudo ainda
"ganharia", e a checagem de *multiarranjo sem ganho* nunca dispararia. Corrigido
para medir o que o adapter acrescenta.

### Exemplos adversariais (todos REPROVAM)

```
segundo arranjo perdido              → adapter tem 1 arranjo, o documento tem 2
três arranjos, só o primeiro         → adapter tem 1 arranjo, o documento tem 3
inversor secundário sumiu            → inversores de `B`: adapter [—], documento [SOLPLANET|ASW50K-LT-G2|50|1]
módulos do segundo zerados           → módulos de `B`: adapter 0, documento 174
potência secundária perdida          → potência de `B`: adapter null, documento 77.43
identidade trocada (B → C)           → `B` sumiu  +  adapter inventou `C`
inversor trocado por outro modelo    → assinatura diverge
topologia inventada onde não há      → adapter diz `disponivel`, esperado `ausente`
módulos trocados entre arranjos      → módulos de `A`: adapter 174, documento 225   (soma intacta!)
adapter vazio                        → reprova
```

### Tratamento de arranjo vazio e de ausência

`Ampliação` — o arranjo vazio **aparece** (identidade existe), declara módulos
`ausente`, e o inversor da raiz fica `ambiguo` em vez de ser atribuído a ele.
Ambiguidade **declarada não é perda**; atribuição silenciosa é — e reprova.

Ausência real em ambos os modelos não vira equivalência positiva: a topologia
permanece `ausente`, sem `fonte`. *Ausente ≠ compatível.*

### Falsos positivos verificados

Arranjo único passa sem ganho · reordenação não gera divergência (comparação é
por id) · `rotulo`, `ordem` e metadados não entram na comparação · ausência real
não é contada como perda · `null` de potência é resposta válida, não lacuna.

### Limitações conhecidas

- O comparador confere `modulos.total` contra `dimensionamento.n_modulos` do
  arranjo normalizado; não confere item a item dentro de `paineis[]`.
- Topologia é comparada por **contagem de itens e tipo**, não pelo conteúdo de
  cada MPPT/string.
- O guard roda sobre fixtures que espelham os 5 projetos reais, não contra o
  banco — por decisão de escopo (auditoria não toca produção).

**Status: `GUARD SEGURO PARA PRÉ-MIGRAÇÃO`.**

---

## 9. Próximos consumidores a migrar

Ordem sugerida — do menor risco ao maior, cada um com sua própria prova de equivalência:

| # | Consumidor | Por quê agora | Risco |
|---|---|---|---|
| 1 | `frontend/fv/composicao.js:151` | só exibição; erro é visível | baixo |
| 2 | `projetosFVController:2308` | deriva topologia do primeiro | médio |
| 3 | `EnvioPropostaService:81` | idem, na proposta | médio |
| 4 | `unifilar/adaptarProjeto:73,130,168` | exige view-model com N inversores | alto |
| 5 | `homologacaoController:86,117` | **P1 documental** — antecipar se algum projeto sair de `proposta` | alto |

O item 5 é o de maior consequência externa e o que deve ser antecipado se o risco se
materializar, mesmo fora de ordem.

---

## 10. O que deliberadamente NÃO foi feito

- troca da fonte canônica de topologia;
- remoção de `MULTIPLOS_INVERSORES`;
- migração de qualquer um dos 6 consumidores posicionais;
- backfill ou migração dos 589 projetos;
- escrita em `arranjos[].configuracao_eletrica.mppts`;
- alteração do caminho de microinversores;
- `arranjo_agregado` persistido — agregado permanece derivação.
