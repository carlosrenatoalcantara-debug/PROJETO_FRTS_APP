# 🔑 CONFIGURAR GOOGLE GEMINI (GRATUITO)

## ✅ PASSO 1: Obter chave da API (2 minutos)

1. Acesse: **https://aistudio.google.com/app/apikey**
2. Clique em **"Create API key in new project"**
3. Copie a chave gerada (começa com `AIza...`)
4. Pronto! É **GRATUITO** e **SEM CARTÃO DE CRÉDITO** necessário

## ✅ PASSO 2: Configurar no projeto

Edite `backend/.env` e adicione:

```env
GOOGLE_API_KEY=AIza_sua_chave_aqui
```

## ✅ PASSO 3: Usar Gemini em vez de Claude

As rotas já estão configuradas para usar Gemini automaticamente.

## 📊 Limite Gratuito

- **60 requisições por minuto** (mais que suficiente)
- **Permanente** (não expira)
- **Sem cartão de crédito**

## 🚀 Pronto!

Teste com:
```bash
npm run test-ev
```

Ou rode o servidor:
```bash
npm start
```

## ⚡ Comparação

| IA | Custo | Qualidade | Setup |
|----|----|---------|-------|
| Gemini (atual) | 🟢 GRÁTIS | 8/10 | 2 min |
| Claude | 💰 $5/mês | 10/10 | 5 min |
| GPT-4 | 💰 $20/mês | 9/10 | 5 min |

