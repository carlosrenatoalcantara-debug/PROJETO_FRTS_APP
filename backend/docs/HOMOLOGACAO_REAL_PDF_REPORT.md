# P2-HOMOLOGACAO-REAL-PDF-01 — Relatório

**Sprint:** P2-HOMOLOGACAO-REAL-PDF-01 · **Modelo:** Sonnet
**Branch:** `sprint/p1-bug-art-01`
**Data:** 2026-06-18
**Revisão Gemini:** Opcional

---

## 1. Arquivos alterados

| Arquivo | Tipo de mudança |
|---|---|
| `frontend/src/components/fv/homologacao/MemorialDescritivo.jsx` | `baixarDocx()` → `baixarPDF()` via `gerarPdfHomologacao` |
| `frontend/src/components/fv/homologacao/CartaConcessionaria.jsx` | `baixarDocumento()` → `baixarPDF()` via `gerarPdfHomologacao` |
| `frontend/src/components/fv/homologacao/DadosART.jsx` | Adicionado `baixarPDF()` + botão "Baixar PDF" |
| `backend/docs/HOMOLOGACAO_REAL_PDF_REPORT.md` | Este relatório |
| `backend/docs/HOMOLOGACAO_REAL_PDF_DIFF.json` | Diff estruturado |
| `backend/docs/HOMOLOGACAO_REAL_PDF_METRICS.json` | Métricas |

**Não alterados:** ProjetoEV, Ativos, QR, Comissionamento, Segurança, Snapshot, Catálogo,
Engenharia, regras regulatórias, lógica de homologação, endpoints, schemas.

---

## 2. TXT eliminados

| Componente | Arquivo de saída anterior | Eliminado |
|---|---|---|
| Memorial Descritivo | `memorial-{id}.txt` | ✅ |
| Carta à Concessionária | `carta-concessionaria-{id}.txt` | ✅ |

Total: **2 downloads TXT removidos**.

---

## 3. PDFs criados

| Componente | Arquivo de saída | Tipo PDf |
|---|---|---|
| Memorial Descritivo | `memorial-descritivo-{projetoId}.pdf` | gerarPdfHomologacao tipo=memorial |
| Carta à Concessionária | `carta-concessionaria-{projetoId}.pdf` | gerarPdfHomologacao tipo=carta |
| Dados ART | `dados-art-{projetoId}.pdf` | gerarPdfHomologacao tipo=art |

Total: **3 PDFs** (2 substituições + 1 novo para ART que não tinha download).

---

## 4. Layout

Utiliza `gerarPdfHomologacao.js` já existente no projeto (`frontend/src/utils/`),
sem nenhuma instalação de dependência nova.

Padrão Forte Solar aplicado:
- **Cabeçalho duplo:** faixa escura (`#0f172a`) com nome/logo da empresa + faixa laranja
  (`#f97316`) com título do documento em branco
- **Logo:** fallback texto "Forte Solar" em fundo laranja quando `empresa.logo` não está
  configurado
- **Conteúdo:** Courier 8.5pt, quebra de linha automática, detecção de seções em negrito,
  separadores `━━━` renderizados como linha horizontal
- **Rodapé:** `Forte Solar · Documento gerado em DD/MM/AAAA · Pág. X/Y` em todas as páginas
- **Paginação automática:** nova página quando `y > 282mm`

---

## 5. Snapshot

`gerarPdfHomologacao` recebe o `texto` já processado pelos componentes — o conteúdo
foi gerado pela chamada `POST /homologacao/memorial` ou `POST /homologacao/carta` que
internamente usa `obterEquipamentosEngenharia(projeto)`. A lógica snapshot vs. vivo
já está no backend/controller e não foi alterada.

Estados validados por leitura de código:
- **RASCUNHO:** gera com dados ao vivo do catálogo
- **CONGELADO / HOMOLOGADO:** gera com snapshot — determinado pela chamada existente ao
  backend que responde com os dados corretos para cada estado

A camada de PDF recebe o `texto` final e não interfere na seleção de dados.

---

## 6. Regressões encontradas

Nenhuma. Verificações:
- Conteúdo do `memorial` / `carta` / `dados ART` inalterado — o PDF recebe a string
  exatamente como estava sendo exibida no `<pre>` e copiada para clipboard
- Botão "Copiar Texto" preservado em todos os componentes
- DadosART: botões "Copiar Dados" e "CREA {estado}" preservados; "Baixar PDF" adicionado
  entre eles
- Build: `✓ built in 7.67s`, 0 erros

---

## 7. Compatibilidade mobile

`jsPDF.save()` usa `URL.createObjectURL` + `<a download>` internamente:
- **Desktop Chrome/Firefox/Edge:** download direto ✅ (por leitura de código)
- **Desktop Safari:** idem ✅ (por leitura de código)
- **Android Chrome:** download direto ✅ (por leitura de código)
- **iOS Safari:** iOS bloca `<a download>` para blobs — o PDF abre em nova aba/visualizador
  e o usuário pode compartilhar/salvar. Comportamento padrão do jsPDF em iOS.

Nenhum teste em device físico foi executado (ver seção Honestidade).

---

## 8. Honestidade

- **Build executado:** ✅ `✓ built in 7.67s`, 0 erros, 2329 módulos
- **Device físico utilizado:** ❌ não
- **Ambiente real (Railway/Atlas/Vercel):** ❌ não testado
- **Download real de PDF:** ❌ não verificado em browser (mudança é frontend-only, sem servidor
  necessário para o download em si — o PDF é gerado client-side)
- **Conteúdo do PDF:** ❌ não verificado visualmente (sem tela disponível)
- **Método de validação:** leitura de código + build de produção

A correção é estrutural: substitui `data:text/plain` por chamada ao `gerarPdfHomologacao`
já utilizado em outros módulos do projeto com o mesmo padrão.
