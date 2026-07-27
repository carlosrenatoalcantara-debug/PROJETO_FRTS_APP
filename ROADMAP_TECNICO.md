# Roadmap Técnico — Forte Solar
> Backlog de observações arquiteturais futuras. Não implementar sem sprint planejado.

---

## Sprint S2.7–S2.12 — Convergência Incremental dos Fluxos FV
> Documentado em: 2026-05-20

Ver plano completo na sessão Claude de 2026-05-20.

Resumo executivo:
- **Sobrevive:** `NovaPropostaV2` + `ProjetoFVContext` + `projetoFVFunilController` (entrada)
- **Absorve:** F1Conta → Wizard v2 (S2.8)
- **Aposenta:** `NovaProposta`, `calcAutoMatico`, etapas inline, `@react-google-maps/api`
- **Sequência:** Schema v3 → API → Context → Entrada → Equipamentos → Mapas → Financeiro → Limpeza
- **Gate:** Critérios de remoção são checklist — nunca por data, sempre por evidência

---

## IA Usage Monitor
> Observação arquitetural futura — NÃO implementar ainda
> Registrado em: 2026-05-20 (investigação quota Free Tier Gemini durante S2.6.2)

### Problema observado
Durante a sessão S2.6.2, o limite diário do Gemini Free Tier (1.500 RPD) foi atingido sem aviso,
bloqueando o pipeline de enriquecimento de datasheets. Não há visibilidade do consumo em tempo real.

### Objetivo futuro
Monitorar consumo do Free Tier Gemini de forma leve e operacional, sem infraestrutura adicional.

### Ideias para implementação futura

**Contadores de quota:**
- Estimativa de quota restante por dia (baseada em chamadas locais registradas)
- Reset automático à meia-noite horário Pacific (07:00 UTC)
- Alerta quando restar < 200 chamadas no dia

**Categorias de uso a rastrear:**
- OCR de contas de energia (alta prioridade — fluxo crítico de usuário)
- OCR/análise de datasheets (média prioridade — pipeline de backoffice)
- Histórico diário de uso por categoria

**Inteligência de fila:**
- Priorização: contas de energia > datasheets (usuário aguarda em tempo real vs. batch)
- Fila inteligente quando quota baixa: segura datasheets, libera contas de energia
- Detecção de erro 429 com extração do `quotaId` violado e `retryDelay`

**Cache de processamento:**
- Cache de resultados por hash do arquivo (evita reprocessar mesmo PDF)
- TTL configurável por tipo de documento
- Persistência no MongoDB (coleção `ia_cache` ou campo em `CatalogoEquipamento`)

### Referências de implementação
- Scripts de diagnóstico (removidos em 2026-05-20): lógica de extração de quotaId em `_test-gemini-lite-quota.mjs`
- Padrão de erro 429: `"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"`
- Biblioteca: `@google/generative-ai` — sem SDK nativo de quota; precisa ser implementado na camada de serviço

### Sprint sugerido
- Avaliar após S2.9 (quando enriquecimento de datasheets estiver em uso regular)
- Sprint S2.13 ou posterior
- Prerequisito: S2.6.2 em produção com `--apply`

---

## Pendências de infraestrutura (2026-05-20)

### S2.6.2 — Enriquecimento de datasheets
- Status: **aguardando quota Gemini** (reset diário ~07:00 UTC)
- Próximo passo: `cd backend && npm run catalogo:enriquecer-datasheets -- --limit=1 --verbose`
- **NÃO executar com `--apply` ainda** — validar dry-run primeiro
- 80 PDFs mapeados em ~/OneDrive/Área de Trabalho/datasheets (4 pastas)

### Google Maps — validação produção
- Status: `VITE_GOOGLE_MAPS_API_KEY` adicionada ao Vercel + redeploy feito
- Próximo passo: confirmar visualmente que mapa renderiza em produção
- URL: https://projetofrtsapp-production.up.railway.app

### Feature flags Railway prontas para S2.8
Quando S2.8 começar, adicionar nas Variables do serviço `PROJETO_FRTS_APP`:
```
FUNIL_REDIRECT_V3=false
SCHEMA_V3_STRICT=false
WIZARD_LOAD_PROJETO=false
```

---

## Integração AE ⇄ Forte Solar — pendências pós-entrega
> Registrado em: 2026-07-27 (homologação da Auditoria Rápida, fases F1–F8)
> Não bloqueantes: a funcionalidade está entregue e homologada.

### 1. Política organizacional persistida no backend
Hoje a preferência "Atualizações AE" (sempre perguntar / automático / apenas
relatório) vive em `localStorage` (`frontend/src/services/aeConfig.js`), seguindo
o padrão da tela de Configurações. Consequência: é por navegador, não por
organização. Migrar para persistência no backend quando houver infraestrutura de
settings — o contrato de `aeConfig.js` (`obterPolitica`/`definirPolitica`) já
isola os consumidores, então a troca não deve tocar componentes.

### 2. Histórico/versionamento múltiplo por equipamento
`auditoriaAplicacaoService.reverter()` restaura o **último** evento de origem
`auditoria_rapida_ae` a partir de `validacao.historico`. Evoluir para permitir
restaurar qualquer versão anterior (o histórico já guarda `antes` completo de
cada aplicação; falta expor seleção de ponto de restauração e limitar o
`$slice: -50` de forma consciente).

### 3. Campo `bifacial`
`normalizarModulo()` em `catalogoDatasheetEnriquecimento.js` deriva `bifacial`
por regex sobre `tipo_celula`/`notas`. Um `"bifacial": true` explícito no
`product.json` do AE é ignorado. Rever quando o modelo canônico do AE estiver
consolidado — evitar alterar o normalizador antes disso para não impactar o
fluxo Gemini existente.

### Estado da integração
- Fases F1–F8 implementadas e homologadas; 197 testes (`npm run test:ae`).
- Provider real ainda não conectado: `AE_LIBRARY_DIR` (disco) ou `AE_URL` (HTTP).
- Endpoints `/library/index` e `/library/datasheet` do AE ainda não existem;
  o adaptador HTTP está pronto e testado contra `fetch` injetado.
