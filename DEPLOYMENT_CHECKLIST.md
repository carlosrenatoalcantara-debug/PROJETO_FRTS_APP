# 📋 Checklist de Deploy - Calculadora Solar

## ✅ Desenvolvimento Completo

### Código
- [x] Componente Calculadora criado e testado
- [x] Backend endpoint criado (/api/calculadora)
- [x] Rotas configuradas (App.jsx, server.js)
- [x] Dependências instaladas (jsonwebtoken)
- [x] Validações implementadas (frontend + backend)
- [x] Tratamento de erros configurado

### Testes Locais
- [x] Frontend rodando em http://localhost:3005
- [x] Backend rodando em http://localhost:5000
- [x] Calculadora acessível em /calculadora
- [x] Formulário valida inputs corretamente
- [x] Cálculos matemáticos funcionam

## 🚀 Antes do Deploy para Produção

### Frontend (Vercel)
- [ ] Fazer push do código para GitHub
- [ ] Vercel detecta e faz deploy automático
- [ ] Acessar https://projeto-frts-app.vercel.app/calculadora
- [ ] Testar calculadora em produção
- [ ] Conferir CORS headers

### Backend (Railway)
- [ ] Fazer push do código para GitHub
- [ ] Railway faz deploy automático
- [ ] Conferir variáveis de ambiente:
  - [ ] MONGODB_URI (Atlas connection)
  - [ ] JWT_SECRET (seguro e aleatório)
  - [ ] NODE_ENV=production
- [ ] Testar endpoint POST /api/calculadora
- [ ] Validar MongoDB connectivity

### Wix Integration
- [ ] Acessar editor Wix
- [ ] Adicionar link para calculadora no menu
  - URL: https://projeto-frts-app.vercel.app/calculadora
- [ ] Testar acesso da calculadora via Wix
- [ ] Conferir que formulários preenchem corretamente

## 📊 Pós-Deploy

### Validação
- [ ] Submeter teste via calculadora
- [ ] Conferir que dado aparece no MongoDB
- [ ] Verificar se Lead foi criado corretamente
- [ ] Testar fluxo completo: preenchimento → envio → verificação

### Monitoramento
- [ ] Configurar alertas para erros no backend
- [ ] Monitorar performance (tempo de resposta)
- [ ] Rastrear número de submissões/dia
- [ ] Acompanhar taxa de erro

## 🔧 Troubleshooting Comum

### Erro: "Failed to fetch"
- [ ] Verificar se backend está rodando
- [ ] Conferir CORS em server.js (frontendOrigin)
- [ ] Testar conexão API com Postman/curl

### Erro: "MongoDB Connection Failed"
- [ ] Verificar MONGODB_URI em .env
- [ ] Confirmar IP whitelist no MongoDB Atlas
- [ ] Testar conexão direta ao DB

### Erro: "Token Invalid"
- [ ] Regenerar JWT_SECRET
- [ ] Limpar localStorage do navegador
- [ ] Re-login no portal privado

### Calculadora não submete dados
- [ ] Verificar console do navegador (F12)
- [ ] Conferir resposta do servidor em Network tab
- [ ] Validar que todos campos obrigatórios foram preenchidos

## 📈 Métricas para Acompanhar

**Após 1 semana**:
- Quantas calculadoras foram acessadas?
- Qual taxa de conclusão do formulário?
- Quantos leads foram gerados?
- Qual cidade com maior interesse?

**Após 1 mês**:
- ROI da calculadora?
- Taxa de conversão (calculadora → cliente)?
- Tempo médio para responder leads?
- Padrões de uso (dias/horários)?

## 🎯 Próximas Melhorias

### Curto Prazo (1-2 semanas)
- [ ] Adicionar gráfico visual da economia
- [ ] PDF de resultado para download
- [ ] Integração com WhatsApp Bot

### Médio Prazo (1 mês)
- [ ] Dark mode na calculadora
- [ ] Integração com Google Ads tracking
- [ ] Múltiplos cenários de simulação
- [ ] Comparativo com outras fontes de energia

### Longo Prazo (3+ meses)
- [ ] IA para otimizar recomendações
- [ ] Integração com ferramentas de design solar
- [ ] App mobile nativa
- [ ] WebGIS para visualização no mapa

## 📞 Contatos Importantes

| Serviço | Link/Contato |
|---------|-------------|
| Vercel | [Dashboard Vercel] |
| Railway | [Dashboard Railway] |
| MongoDB Atlas | [Dashboard Atlas] |
| Wix Editor | [fortesolar.com.br/admin] |
| GitHub | [Seu repo] |

## ✨ Dicas para Sucesso

1. **Backup Regular**: Faça backups do MongoDB diariamente
2. **Monitoramento**: Configure alertas para erros e downtime
3. **Documentação**: Mantenha documentação atualizada
4. **Versionamento**: Use tags Git para releases importantes
5. **Testing**: Sempre teste em staging antes de produção

---

**Status**: ✅ Pronto para Deploy  
**Data**: 2026-05-10  
**Versão**: 1.0.0
