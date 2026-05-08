# 🔍 Configuração da Visão Claude para Datasheets

## O que foi implementado

### ✅ Novas funcionalidades no `equipamentosController.js`:

1. **Extração de Imagens do PDF**
   - Função: `extrairImagensDoPDF()`
   - Extrai informações de metadados do PDF

2. **Análise com Claude Vision**
   - Função: `analisarImagemComClaude()`
   - Usa `claude-3-5-sonnet-20241022` para visão de imagem
   - Extrai: garantias, certificações, eficiência, badges

3. **Integração no Endpoint**
   - Endpoint: `POST /api/equipamentos/extrair-datasheet`
   - Se garantia não encontrada por regex, tenta Claude Vision
   - Mescla resultados de texto + imagem

### 📊 Fluxo de Extração

```
1. Upload PDF
    ↓
2. Extração de texto com regex (existente)
    ↓
3. Se garantia não encontrada:
    ↓
4. Análise com Claude Vision
    ↓
5. Mescla resultados
    ↓
6. Retorna especificações completas
```

---

## ⚙️ Configuração Necessária

### 1. Obter Chave de API Claude

1. Acesse: https://console.anthropic.com/
2. Crie uma conta ou faça login
3. Vá para "API Keys"
4. Clique em "Create Key"
5. Copie a chave (começa com `sk-ant-`)

### 2. Configurar no Railway

#### Opção A: Via Dashboard Railway
1. Acesse: https://railway.app/dashboard
2. Selecione seu projeto "projetofrtsapp-production"
3. Abra a variável "Variables"
4. Clique em "Add Variable"
5. Nome: `ANTHROPIC_API_KEY`
6. Valor: `sk-ant-...` (sua chave)
7. Clique em Deploy

#### Opção B: Via CLI Railway
```bash
railway login
railway link
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway up
```

### 3. Configuração Local (Desenvolvimento)

Crie/atualize `.env`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
MONGODB_URI=mongodb://localhost:27017/forte_solar
ADMIN_API_KEY=dev-key-123
```

---

## 🧪 Testando a Integração

### 1. Local
```bash
cd backend
npm install  # se necessário
npm run dev
```

### 2. Upload de Datasheet
```bash
# Com arquivo que tenha garantia em imagem
curl -X POST http://localhost:5000/api/equipamentos/extrair-datasheet \
  -F "file=@datasheet-com-selo-garantia.pdf"
```

### 3. Resposta Esperada
```json
{
  "modelo": "XXX",
  "fabricante": "YYY",
  "potencia_wp": 400,
  "garantia_anos": 25,
  "garantia_performance": "80% ao final de 25 anos",
  "certificacoes": ["IEC 61215", "IEC 61730"],
  "qualityScore": 85,
  "analiseVisao": {
    "garantia_produto": 25,
    "garantia_performance": "80% ao final de 25 anos",
    "certificacoes": ["IEC 61215", "IEC 61730"],
    "confianca": "alta"
  },
  "_debug": {
    "analiseVisaoUsada": true
  }
}
```

---

## 📝 Notas Importantes

### Limites da API Claude
- **Limite de imagem**: Até 5 imagens por request
- **Tamanho máximo**: 20MB por imagem
- **Taxa**: Veja documentação oficial

### Melhorias Futuras
- [ ] Suportar extração de múltiplas imagens do PDF
- [ ] Caching de análises já realizadas
- [ ] Suporte para outros tipos de documento (datasheet HTML, etc)
- [ ] Dashboard de confiança de extração

### Troubleshooting

#### ❌ "ANTHROPIC_API_KEY não definida"
- Verificar variável de ambiente
- No Railway: `railway variables` deve mostrar a chave
- Localmente: `.env` deve ter `ANTHROPIC_API_KEY=sk-ant-...`

#### ❌ "Erro ao analisar imagem"
- Verificar se a chave da API é válida
- Confirmar que a conta Claude tem créditos
- Verificar formato do PDF (alguns PDFs criptografados não funcionam)

#### ✅ "analiseVisaoUsada: false"
- Garantia foi encontrada por regex
- Visão não foi necessária
- Sistema funcionando normalmente

---

## 🚀 Status de Deploy

### Production (Railway)
- [ ] Variável `ANTHROPIC_API_KEY` configurada
- [ ] Backend deployado após mudanças
- [ ] Testado com PDF contendo garantia em imagem

### Próximos Passos
1. Configure a chave Claude no Railway
2. Push as mudanças: `git push`
3. Railway fará rebuild automático
4. Teste com um datasheet que tenha garantia como imagem

---

**Última atualização**: 2026-05-08
**Modelo Claude usado**: claude-3-5-sonnet-20241022
