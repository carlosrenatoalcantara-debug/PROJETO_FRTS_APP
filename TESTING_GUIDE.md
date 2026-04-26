# Guia de Testes: Forte Solar com MongoDB Persistente

## 📋 Visão Geral

Este guia testa as 3 principais melhorias implementadas:
1. **CRM com Endereços Pré-cadastrados** (persistência em MongoDB)
2. **Diagrama Unifilar com Melhor Espaçamento** (responsivo)
3. **Leitura Aprimorada de Datasheets** (validação cruzada, qualidade)

---

## 🧪 Pré-requisitos

### Backend
```bash
cd backend
npm install
npm start
# Deve conectar ao MongoDB e exibir:
# ✅ MongoDB conectado com sucesso
# 📋 Inicializando dados padrão do CRM...
# ✓ Funis "Vendas" criado
# ✓ Coluna "Lead" criada
# ✓ Coluna "Qualificado" criada
# ✓ Coluna "Proposta" criada
# ✓ Coluna "Negociação" criada
# ✓ Coluna "Fechado" criado
# ✅ Forte Solar API rodando em http://localhost:5005
```

### Frontend
```bash
cd frontend
npm install
npm start
# Deve iniciar em http://localhost:3005
```

---

## ✅ TESTE 1: CRM com Endereços Persistentes

### 1.1 Criar Lead com Endereço

**Via API (curl)**:
```bash
curl -X POST http://localhost:5005/api/crm/leads \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "colunaId": "<coluna_id_lead>",
    "funilId": "<funil_id>",
    "valor": 50000,
    "endereco": "Rua Teste, 123",
    "cidade": "São Paulo",
    "estado": "SP",
    "email": "joao@example.com",
    "telefone": "(11) 98765-4321",
    "origem": "manual"
  }'
```

**Resultado esperado**: HTTP 201 com dados do lead incluindo ID do MongoDB

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "nome": "João Silva",
  "colunaId": "...",
  "funilId": "...",
  "endereco": "Rua Teste, 123",
  "cidade": "São Paulo",
  "estado": "SP",
  "latitude": null,
  "longitude": null,
  "createdAt": "2026-04-25T10:30:00Z",
  "updatedAt": "2026-04-25T10:30:00Z"
}
```

### 1.2 Listar Leads (Verificar Persistência)

**Via Frontend**:
1. Abrir http://localhost:3005
2. Ir para **CRM**
3. Verificar que o lead "João Silva" aparece no kanban
4. Verificar endereço exibido com ícone de mapa

**Via API**:
```bash
curl http://localhost:5005/api/crm/leads
```

Resultado deve incluir os leads criados com endereços.

### 1.3 Restart do Servidor (Verificar Persistência)

1. Parar backend (Ctrl+C)
2. Aguardar 2 segundos
3. Iniciar backend novamente:
   ```bash
   npm start
   ```
4. Verificar que o lead "João Silva" ainda existe:
   ```bash
   curl http://localhost:5005/api/crm/leads
   ```

**Resultado esperado**: Lead continua no banco de dados (não foi perdido)

### 1.4 Criar Proposta a partir do Lead

1. No CRM, clicar em **"Criar Proposta"** no card do lead
2. Verificar que a página abre com:
   - Nome pré-preenchido: "João Silva"
   - Endereço pré-preenchido: "Rua Teste, 123"
   - Cidade/Estado: "São Paulo - SP"
3. Completar a proposta normalmente

### 1.5 Mover Lead Entre Colunas

1. No CRM, arrastar lead de "Lead" para "Qualificado"
2. Verificar que:
   - Lead se move visualmente
   - Campo `data_atualizacao_coluna` é atualizado
   - Dados de endereço se mantêm

**Via API**:
```bash
curl -X PATCH http://localhost:5005/api/crm/leads/<lead_id>/mover \
  -H "Content-Type: application/json" \
  -d '{"colunaId": "<coluna_qualificado_id>"}'
```

---

## 📊 TESTE 2: Diagrama Unifilar com Melhor Espaçamento

### 2.1 Diagrama com 1 String

1. Criar nova proposta com 1 string (ex: 10 painéis)
2. Gerar diagrama unifilar
3. Verificar:
   - ✓ Canvas cabe completamente na tela
   - ✓ Sem overflow horizontal
   - ✓ Sem sobreposição de elementos
   - ✓ Legend visível na base
   - ✓ Espaço equilibrado

### 2.2 Diagrama com 4 Strings

1. Criar proposta com 4 strings (ex: 10 painéis cada)
2. Gerar diagrama unifilar
3. Verificar:
   - ✓ Altura aumenta dinamicamente (> 900px)
   - ✓ Strings espaçadas regularmente (120px)
   - ✓ Sem overflow vertical
   - ✓ Legend no final sem ser cortada
   - ✓ Separação visual DC/AC clara

### 2.3 Diagrama com 68 Painéis

1. Criar proposta com muitos painéis (4 strings x 17 painéis = 68 total)
2. Gerar diagrama
3. Verificar:
   - ✓ Painéis não saem das margens
   - ✓ Posicionamento x não ultrapassa 1400px
   - ✓ Box de informação do cabo dentro dos limites
   - ✓ Todos os 68 painéis visíveis

### 2.4 Verificar Cores e Contraste

1. Abrir diagrama em diferentes zooms (50%, 100%, 150%)
2. Verificar:
   - ✓ Box de informação (cor #fff3cd) com bom contraste
   - ✓ Texto legível
   - ✓ Cores dos componentes bem distintas
   - ✓ Sem borrões ou distorções

### 2.5 Download e Visualização

1. Clicar em **"Download SVG"**
2. Abrir arquivo em navegador
3. Verificar renderização correta
4. Imprimir e verificar se cabe em A3/A4

---

## 📄 TESTE 3: Leitura Aprimorada de Datasheets

### 3.1 Extrair Dados de Painel Fotovoltaico

**Upload de PDF real**:
1. No sistema, ir para **Equipamentos → Novo Módulo**
2. Fazer upload de um PDF de datasheet real
3. Verificar extração:

**Campos esperados**:
- ✓ Potência (Wp): 350-600W
- ✓ Vmp (V): 30-50V
- ✓ Imp (A): 8-12A
- ✓ Voc (V): 35-60V
- ✓ Isc (A): 9-13A
- ✓ Eficiência (%): 15-22%
- ✓ Coeficiente Temperatura: -0.3 a -0.5 (%/°C)

### 3.2 Validação Cruzada (Pmpp = Vmp × Imp)

1. Após extrair dados, verificar avisos:

**Exemplo de cálculo**:
- Vmp: 40V
- Imp: 10A
- Pmpp calculado: 40 × 10 = 400W
- Pmpp informado no PDF: 405W
- Diferença: 1.25% (dentro de tolerância 15%)
- ✓ Sem aviso

Se houver inconsistência > 15%:
- ⚠️ Aviso exibido: "Inconsistência entre Pmpp calculado e informado"

### 3.3 Quality Score

1. Após extrair, verificar score:

```
Quality Score: 92/100

Campos encontrados:
✓ Potência (Wp)
✓ Vmp (V)
✓ Imp (A)
✓ Voc (V)
✓ Isc (A)
✓ Eficiência (%)
✓ Coeficiente Temp
⚠️ NOPCT (não encontrado)
```

**Score > 80%**: Verde (confiável)
**Score 60-80%**: Amarelo (revisar alguns campos)
**Score < 60%**: Vermelho (revisar todos os campos)

### 3.4 Testar com Diferentes Fabricantes

**Canadian Solar**:
- Padrão: "MODULE POWER" ou "RATED POWER"
- ✓ Deve extrair corretamente

**Jinko/JA Solar**:
- Padrão: "Maximum Power"
- ✓ Deve extrair corretamente

**Poly/Perc**:
- Padrão: "Rated Power / Maximum Power"
- ✓ Deve extrair corretamente

### 3.5 Extrair Dados de Inversor

1. Upload de datasheet de inversor
2. Verificar campos:

**Campos esperados**:
- ✓ Potência (W): 3000-10000W
- ✓ Tensão entrada (V): 300-500V DC
- ✓ Corrente máxima AC (A): 10-25A
- ✓ Eficiência: 95-97%
- ✓ Tipo: String/Híbrido/Micro

### 3.6 Validação de Consistência

**Verificar avisos**:
- Se VOC < VMP: ⚠️ "VOC deve ser maior que VMP"
- Se ISC < IMP: ⚠️ "ISC deve ser maior que IMP"
- Se Pmpp calculado ≠ Pmpp real (>15%): ⚠️ "Inconsistência de potência"

---

## 🔄 TESTE 4: Persistência em Produção (MongoDB Atlas)

### 4.1 Configurar MongoDB Atlas

1. Seguir **DEPLOYMENT_MONGODB_ATLAS.md**
2. Criar cluster gratuito
3. Copiar connection string
4. Atualizar `.env`:
   ```
   MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/forte_solar
   ```

### 4.2 Testar Conexão Cloud

```bash
npm start
```

Deve exibir:
```
✅ MongoDB conectado com sucesso
📋 Inicializando dados padrão do CRM...
...
✅ Forte Solar API rodando em http://localhost:5005
```

### 4.3 Criar Dados e Verificar no Atlas

1. Criar novo lead via API ou UI
2. Acessar MongoDB Atlas Dashboard
3. Ir para **Collections**
4. Expandir **forte_solar → crmleads**
5. Verificar que o lead aparece na nuvem

### 4.4 Teste de Failover

1. Desligar internet (ou usar VPN)
2. Criar novo lead (deve falhar)
3. Reconnectar internet
4. Criar novo lead (deve funcionar)
5. Verificar que dados antigos continuam lá

---

## 📊 TESTE 5: Arquivamento e Manutenção

### 5.1 Testar Arquivamento Manual

**Via API**:
```bash
# Executar manutenção completa manualmente
curl -X POST http://localhost:5005/api/admin/manutencao \
  -H "Authorization: Bearer <ADMIN_API_KEY>"
```

**Via Node.js REPL**:
```javascript
import { executarManutencaoCompleta } from './src/utils/arquivamentoPolicy.js'
await executarManutencaoCompleta()
```

**Resultado esperado**:
```
🔧 Executando manutenção completa do sistema...
📦 Arquivamento: 0 leads arquivados (inatividade > 6 meses)
💾 Compactação: 0 leads compactados
📊 Relatório Trimestral:
  - Leads fechados: 5
  - Valor total: R$ 150.000,00
  - Valor médio: R$ 30.000,00
✅ Manutenção completa finalizada
```

### 5.2 Verificar Agendamento (Logs)

Ao iniciar o servidor, deve exibir:
```
✅ Tarefas de manutenção agendadas com sucesso

⏰ [Cron] Próximas execuções:
  - Arquivamento: próxima segunda às 02:00
  - Limpeza: próximo dia 1º do mês às 03:00
  - Relatório: próxima sexta às 09:00
  - Compactação: próximo dia 15 às 04:00
```

### 5.3 Simular Passage de Tempo (Teste Local)

Para testar sem aguardar 6 meses:

1. Editar `src/utils/arquivamentoPolicy.js`
2. Mudar a função `arquivarLeadsAntigos()`:
   ```javascript
   // De:
   seisMemesAtras.setMonth(seisMemesAtras.getMonth() - 6)
   
   // Para (teste):
   seisMemesAtras.setMinutes(seisMemesAtras.getMinutes() - 5) // 5 minutos atrás
   ```
3. Criar um lead e aguardar 6 minutos
4. Verificar se foi arquivado

---

## 🐛 TESTE 6: Verificar Regressions

### 6.1 CRM Antigo (Se Existia)

Se havia leads em-memória antes:
- [ ] Dados antigos foram migrados? (se houve script de import)
- [ ] Funis/Colunas existem?
- [ ] Funcionalidade de Kanban ainda funciona?

### 6.2 Endereços (Teste Geocoding)

1. Criar lead com endereço: "Rua Praia de Baía Formosa, 9172, Ponta Negra"
2. Sistema deve:
   - ✓ Reconhecer "Praia" como logradouro válido
   - ✓ Tentar geocodificar via Nominatim
   - ✓ Retornar latitude/longitude ou null (sem erro)

### 6.3 Propostas Existentes

- [ ] Propostas antigos carregam corretamente?
- [ ] Diagrama unifilar funciona em propostas antigas?
- [ ] Pode criar nova proposta com novo sistema CRM?

### 6.4 Equipamentos

- [ ] Datasheets antigos ainda funcionam?
- [ ] Novo sistema de validação não quebra formulários?
- [ ] Quality score exibido corretamente?

---

## 📋 Checklist Final de Validação

### CRM Persistente
- [ ] Leads criados no UI
- [ ] Leads aparecem na API
- [ ] Leads persistem após restart
- [ ] Leads criáveis via API
- [ ] Endereços pré-preenchidos
- [ ] Movimentação entre colunas funciona
- [ ] Soft delete funciona (arquivar leads)

### Diagrama Unifilar
- [ ] Renders com 1 string
- [ ] Renders com 4+ strings
- [ ] Sem overflow
- [ ] Legend visível
- [ ] DC/AC separados visualmente
- [ ] Cores com bom contraste
- [ ] Download SVG funciona

### Datasheets
- [ ] Extração de painéis
- [ ] Extração de inversores
- [ ] Quality score calculado
- [ ] Avisos de inconsistência mostrados
- [ ] Validação Pmpp funciona
- [ ] Múltiplos fabricantes reconhecidos

### MongoDB
- [ ] Conecta ao local (localhost:27017)
- [ ] Conecta ao Atlas (cloud)
- [ ] Dados salvam corretamente
- [ ] Arquivamento agenda
- [ ] Performance aceitável
- [ ] Backups automáticos (Atlas)

---

## 📞 Se Algo Falhar

### Erro: "MongooseError: Cannot connect to database"
```bash
# Verificar se MongoDB local está rodando
mongod
# Ou se usando Atlas, verificar string de conexão no .env
```

### Erro: "Lead não encontrado ao mover"
```bash
# Verificar IDs no banco
db.crmleads.find({})
db.crmcolunas.find({})
```

### Diagrama não renderiza
```bash
# Verificar browser console para erros de SVG
# Tentar com Firefox se tiver problema no Chrome
```

### Datasheet não extrai dados
```bash
# Verificar se PDF é nativo (texto) ou scaneado (imagem)
# PDFs scaneados precisam de OCR (não implementado por padrão)
```

---

## ✅ Sucesso!

Se todos os testes passaram:

- ✅ CRM com dados persistentes em MongoDB
- ✅ Endereços pré-cadastrados funcionando
- ✅ Diagrama com melhor espaçamento
- ✅ Datasheets com validação cruzada
- ✅ Sistema pronto para produção

Próximos passos:
1. Deploy para MongoDB Atlas
2. Deploy do Backend (Heroku/Railway/AWS)
3. Deploy do Frontend (Vercel/Netlify)
4. Configurar domínio e SSL
5. Monitorar performance em produção

---

**Versão**: 1.0  
**Data**: Abril 2026  
**Atualizado por**: Forte Solar Dev Team
