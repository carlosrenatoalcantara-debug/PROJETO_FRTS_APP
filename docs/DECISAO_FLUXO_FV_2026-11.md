# Decisão — fluxo padrão de projeto FV (2026-11)

Branch: `fix/fv-fluxo-2026-11`. Lido pelos passos 2 a 7 da sequência de correção do FV.

## Decisão

**Fluxo padrão: canônico (`/fv/projetos/:id`, `frontend/src/fv/`).**
A ficha do cliente (`ClienteGerenciamento.jsx`) cria o projeto no canônico, com o
cliente fixo, e abre `/fv/projetos/:id`. Abrir um projeto existente também vai para o canônico.

O wizard legado (`/projetos-fv`, `ProjetosFVNovo` + `components/fv/etapas/E1–E8`) continua
acessível pelo menu como **"Fotovoltaico (legado)"**. Nenhuma rota foi removida.

## Motivo

Regra aplicada: se o canônico cria o projeto a partir do cliente e chega a equipamentos e
micros, ele é o padrão. Ele chega:

- Criação: `POST /api/projetos-fv` com `clienteId` + `nome` (`FormNovoProjeto`).
- Equipamentos: marca → modelo → quantidade (`EtapaEquipamentos`).
- Micros: quantidade informada pelo operador (`EtapaMicroinversores`, renderizada dentro de `EtapaMppt`).

O legado não tem nenhuma das duas últimas: módulos aparecem em chips de marca, e a quantidade de
micros é derivada (`dimMicro`). Quando o dado elétrico falta no catálogo, o legado bloqueia o avanço.

### Por que o `bf03005` existia

Antes dele, o "Novo" da ficha ia para a **lista** `/fv/projetos` sem o `clienteId`, e o
operador escolhia o cliente de novo. O commit trocou o destino pelo wizard legado, que
pré-preenche os dados. Isso resolveu o atalho, mas trouxe a UI antiga de volta. A correção agora
é passar o cliente para o canônico (`FormNovoProjeto` com `clienteIdInicial`). O `bf03005` também
quebrou `clienteAbreProjeto.test.jsx`, que já esperava `/fv/projetos/:id` e voltou a passar.

## Comparação (projeto novo a partir do cliente)

| Capacidade | Legado | Canônico |
|---|---|---|
| Criar com `clienteId` | sim (`?clienteId=`) | sim (cliente fixo a partir desta decisão) |
| Hidratar consumo/distribuidora/ligação do cliente | sim (`ProjetosFVNovo` ~285-304), sem tensão | **não** (ver lacuna 1) |
| Irradiância | E4: NASA/INPE, com defeitos conhecidos | NASA, com origem declarada pelo servidor |
| Equipamentos marca → modelo → quantidade | não (chips) | sim |
| Quantidade de micros | não | sim (dentro da etapa MPPT) |
| Estrutura | sim | sim |

## Lacunas do canônico (abertas)

1. **Dados do cliente não chegam ao projeto.** `criarProjetoFV`
   (`backend/src/controllers/projetosFVController.js`) grava só nome e localização.
   `EtapaProjeto`/`EtapaDimensionamento` leem de `fatura_extracao`, que nasce vazio. O operador
   redigita consumo, tipo de ligação, tensão e concessionária. **Prioridade alta**: é o mesmo
   retrabalho que o operador já reclamou ("COSERN não foi para a segunda página"). Encaixar no
   passo 3 (tensão), copiando do `Cliente` na criação, sem inventar o que estiver ausente.
2. **Tensão**: o canônico tem `tensao_v` em `fatura_extracao`, mas nada o deriva de
   trifásico + concessionária (passo 3).
3. **Micros sem rota própria**: `EtapaMicroinversores` só aparece dentro de `EtapaMppt`. É preciso
   confirmar no navegador que o operador encontra o campo (passo 2).
4. **`irradiancia_local: 131.44` gravado fixo** em `criarProjetoFV`, um valor sem fonte.
   Investigar se algo lê esse campo antes de removê-lo (fora deste passo).
5. Projetos criados no legado abrem no canônico com etapas vazias onde o legado guardava em
   outros campos. É o mesmo `ProjetoFV` e nada se perde, mas a tela mostra lacunas.

## Lacunas do legado (motivo de não ser o padrão)

- Sem quantidade de micros; bloqueio mudo quando o catálogo não tem dado elétrico.
- Duas fontes da quantidade de módulos (digitado × `totalModulosArranjo`).
- Tensão padrão `'220'` fixa; eficiência fixa em 0,80; rádio de irradiância só troca o rótulo.

## Validação no navegador

Não foi feita neste passo. O `.claude/launch.json` só sobe o frontend do clone vizinho, sem backend
QA. A validação fica para o passo 7, em ambiente QA isolado, nunca em produção.
