# EV_CATALOG_VIEW_RUNTIME_RCA.md

**Sprint:** P0-EV-CATALOG-ENGINEERING-VIEW-01 — **RCA de reprovação de runtime (READ-ONLY, nada corrigido)**
**Modelo:** Claude Opus 4.8 · **Data:** 2026-06-25

## RESUMO
O runtime reprovou com razão. **Os commits são reais e corretos no código-fonte**, MAS:
1. **A View não aparece** porque **a produção (Vercel) está servindo um build ANTIGO**, anterior ao commit `3e60aee`.
2. **O BelEnergy voltou a trifásico** porque o registro foi **REIMPORTADO às 19:40 de hoje** (id novo), e o
   **OCR recaiu no bug de fase** — minha correção anterior foi num registro que **deixou de existir**.
Minha verificação foi a nível de **código + dados da API**, não de **render no navegador em produção**
(eu havia declarado "NÃO TESTADO: render no navegador"). A reprovação de runtime é legítima.

---

## 1. Qual componente React renderizou exatamente as imagens?
- **Arquivo:** `frontend/src/pages/CarregadoresEV.jsx`
- **Componente:** `CarregadoresEV` (default export) → sub-componente **`SpecGroup`** dentro do card expandido.
- **Linhas (versão ANTIGA, pré-`3e60aee`):** `SpecGroup` em **L47**; render do card expandido em **L292-296**:
  `Potência` (292), `Entrada AC` (293), `Saída DC` (294), `Protocolos e Carregamento` (295),
  `Performance e Instalação` (296). **Esses títulos batem exatamente** com a tela enviada.
- **Rota:** `App.jsx:77` → `equipamentos/carregadores-ev`.

## 2. Esse componente foi alterado no commit `3e60aee`?
**SIM.** Diff relevante (`git show 3e60aee`):
- L10-63: removidos `SPECS_POTENCIA/ENTRADA/SAIDA/PROTOCOLOS/EXTRAS` + `SpecGroup` → adicionados
  `BLOCOS_ENGENHARIA` (12 blocos) + `BlocoEngenharia` (mostra todos os campos, "Não informado").
- Card expandido: os 5 `<SpecGroup .../>` (L292-296) → `BLOCOS_ENGENHARIA.map(b => <BlocoEngenharia .../>)`.
- Card resumido: chaves corrigidas (`tensao_entrada`→`tensao_entrada_v`, `tipo_conector_saida`→`tipo_conector`).
Os títulos antigos ("Performance e Instalação" etc.) **não existem mais em nenhum lugar de `frontend/src`**
(confirmado por grep). O build local atual gera `index-1aUYlvkt.js`.

## 3. Existe outro componente que renderiza o card expandido do catálogo EV?
**NÃO.** O card de carregador do catálogo é renderizado **exclusivamente** por `CarregadoresEV.jsx`
(rota `equipamentos/carregadores-ev`).
- `Catalogo.jsx` é outro componente, mas para **FV** (módulo/inversor; ficha "Entrada CC/Saída CA") — não carregadores.
- `Inversores.jsx` tem um `SpecGroup` próprio, mas com títulos de inversor ("Saída CA/Entrada CC/MPPT").
- Os títulos da tela ("Potência/Entrada AC/Protocolos/Performance") só existiam no `CarregadoresEV.jsx` antigo.

## 4. A produção usa o build com `3e60aee`? COMPROVAR.
**NÃO. A produção serve um build ANTERIOR a `3e60aee`.**
- **Prova lógica (conclusiva):** os títulos "Performance e Instalação / Entrada AC / Saída DC /
  Protocolos e Carregamento" foram **DELETADOS do source em `3e60aee`** e não existem mais em
  `frontend/src`. Como a tela do usuário **ainda os exibe**, o bundle em execução é **anterior** ao commit.
- **Não consegui buscar o bundle Vercel diretamente:** o domínio do repositório, `fortesolar.com.br`,
  é o **site institucional em Wix** (HTTP 302 → `www.fortesolar.com.br/?lang=en`; `Server: Pepyaka`;
  cabeçalhos `x-wix-request-id`), **não** o app React. O `vercel.json` só define o rewrite de API
  (`/api/* → Railway`); a **URL Vercel do app não está no repositório**.
- **Conclusão:** o deploy do `3e60aee` **não chegou à produção** (auto-deploy do Vercel não disparou/
  falhou, ou cache de CDN/navegador). **Ação de verificação (do usuário):** conferir no painel do Vercel
  se há deploy do commit `3e60aee` e forçar redeploy/limpar cache. Informar a URL Vercel do app permitiria
  eu comprovar o hash do bundle.

## 5. BelEnergy — valor em cada camada (onde diverge)
**Linha do tempo:** corrigi o registro `id=6a3d636d…` (→ AC_Mono/1) mais cedo hoje; depois o BelEnergy foi
**reimportado às 2026-06-25T19:40** como **`id=6a3d84356cbcf447f31940e4`** (registro NOVO). A correção
antiga não se aplica ao registro novo.

| Camada | numero_fases | tipo_carregador | Evidência |
|---|---|---|---|
| **OCR** (no import de 19:40) | **3** | (deriva) AC_Tri | regex de fase false-positive (carregadorEVControllerGemini.js:150-172) |
| **CarregadorEV** (SSOT) | **3** | **AC_Tri** | `/api/carregadores-ev` id=6a3d8435, criado 19:40 |
| **Mapper** (carregadorParaEquipamento) | **3** | **AC_Tri** | pass-through (sem normalização) |
| **API JSON** (`/api/equipamentos?tipo=carregador-ev`) | **3** | **AC_Tri** | `_origem=CarregadorEV` |
| **Frontend** | Trifásico / 3 | AC_Tri | exibe fielmente o dado |

**Divergência entre camadas: NENHUMA — todas mostram 3, consistentes.** A divergência é **temporal**, não
entre camadas: meu data-fix anterior foi num registro **deletado/substituído** pela reimportação. A camada
que **(re)introduz** o valor errado é o **OCR** (a cada import). Um data-fix é **efêmero** contra reimport;
a correção durável exige o OCR (que estava fora do escopo desta sprint).

---

## CONCLUSÃO (duas causas independentes)
- **Bloco da View não aparece →** deploy de produção **desatualizado** (Vercel não publicou `3e60aee`).
  Código/commit corretos; produção stale. *(Eu deveria ter sinalizado a dependência de deploy, não só o build local.)*
- **BelEnergy trifásico →** **reimportação** (19:40) **re-disparou o bug de OCR**; minha correção foi num
  registro que não existe mais. Causa raiz durável = **OCR** (regex de fase), já identificada e proposta
  como `P1-EV-OCR-PHASE-DETECTION-FIX-01`.

## O que NÃO é a causa
- NÃO é outro componente (só `CarregadoresEV.jsx` renderiza o card).
- NÃO é Mapper/API/View do BelEnergy (todos fiéis ao dado=3).
- NÃO é o commit estar errado (o diff está correto no source).

## Próxima implementação (somente após autorização)
1. **Confirmar/forçar o deploy Vercel** do `3e60aee` (e fornecer a URL Vercel para eu comprovar o bundle).
2. **Corrigir o OCR de fases** (durável) — `P1-EV-OCR-PHASE-DETECTION-FIX-01` — em vez de data-fix efêmero.
