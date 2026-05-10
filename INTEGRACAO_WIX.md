# Integração da Calculadora Solar ao Site Wix

## ✅ O que foi concluído

### 1. Calculadora Solar Desenvolvida
- **Localização**: `/calculadora` no frontend React
- **Funcionalidades**:
  - Formulário em 2 etapas (coleta de dados e resultados)
  - Validação de inputs (nome, email, telefone, consumo)
  - Seleção de cidade com irradiância solar brasileira
  - Cálculo automático de:
    - Tamanho do sistema necessário (kWp)
    - Economia mensal em R$
    - Economia anual em R$
    - Economia em 25 anos
    - Período de payback
    - Estimativa de painéis solares
  - Design profissional com gradiente azul-laranja
  - Envio de dados para o backend

### 2. Backend Configurado
- **Endpoint**: `POST /api/calculadora`
- **Função**: Recebe dados da calculadora e armazena como Lead
- **Dados capturados**: 
  - Nome, email, telefone, cidade
  - Consumo mensal
  - Sistema necessário (kWp)
  - Projeções financeiras

### 3. Rotas Configuradas
- Frontend: `/calculadora` (acessível publicamente)
- Backend: `/api/calculadora` (recebe POST)
- Arquivo: `backend/src/routes/calculadora.js`

## 🔗 Como Integrar à Página Wix

### Opção 1: Adicionar Link no Menu (RECOMENDADO)
1. Acesse o editor do Wix
2. Vá para Menu/Navegação
3. Adicione novo item de menu: "Calculadora Solar"
4. Configure o URL como: `https://projeto-frts-app.vercel.app/calculadora`
5. Salve as alterações

### Opção 2: Adicionar Botão Flutuante (CTA)
1. No editor Wix, vá para a página inicial
2. Adicione um botão com texto: "Calcule sua Economia ☀️"
3. Configure a ação como "Link Externo"
4. URL: `https://projeto-frts-app.vercel.app/calculadora`
5. Posicione como flutuante ou no hero section

### Opção 3: Inserir iframe Embutido
Se quiser embutir a calculadora diretamente no Wix:
1. Edite a página desejada
2. Adicione um elemento "Embed HTML/Custom Code"
3. Cole o seguinte código:

```html
<iframe 
  src="https://projeto-frts-app.vercel.app/calculadora"
  width="100%"
  height="1200px"
  style="border: none; border-radius: 8px;"
  title="Calculadora Solar Forte Solar">
</iframe>
```

## 📊 URLs de Acesso

| Recurso | URL |
|---------|-----|
| Calculadora | https://projeto-frts-app.vercel.app/calculadora |
| API Backend | https://seu-backend.vercel.app/api/calculadora |
| Portal Privado | https://projeto-frts-app.vercel.app/login |

## 🔐 Credenciais Demo (Portal Privado)
- Email: `demo@fortesolar.com.br`
- Senha: `demo123`

## 📝 Próximos Passos Recomendados

### Modernização do Site Wix
1. **Hero Section**: Atualize a imagem de fundo com visual mais moderno
2. **CTA Principal**: Adicione chamada para ação para a calculadora
3. **Copy/Texto**: Atualize descrições para focar em:
   - Economia garantida
   - Tecnologia de ponta
   - Atendimento personalizado
4. **Seção de Benefícios**: Adicione cards mostrando:
   - ☀️ Economia de até R$ XXXXX/ano
   - 🏠 Sistema dimensionado para sua casa
   - 📊 Análise customizada
   - 💰 Financiamento disponível

### Integração de Dados
- Leads capturam automaticamente dados da calculadora
- Aparecem no CRM para follow-up
- Análise de interesse por cidade disponível

## 🔧 Configuração Técnica

### Variáveis de Ambiente Necessárias
```
VITE_API_URL=https://seu-backend.vercel.app (frontend)
JWT_SECRET=sua-chave-secreta (backend)
MONGODB_URI=sua-conexao-mongodb (backend)
```

### Teste da Integração
1. Acesse `/calculadora` no navegador
2. Preencha formulário com dados de teste
3. Clique em "Calcular Economia"
4. Verifique se dados aparecem no CRM dentro de alguns segundos

## 📧 Suporte

Para dúvidas ou problemas na integração:
- Verifique se a URL está acessível (sem bloqueios de CORS)
- Confirme que o backend está rodando
- Verifique MongoDB Atlas connectivity
