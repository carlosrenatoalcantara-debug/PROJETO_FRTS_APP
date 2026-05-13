# 🔍 Diagnóstico - Tela Branca em Clientes

## Passo a Passo para Resolver

### 1️⃣ **Limpar Cache do Navegador**

**Opção A - Windows:**
```
Ctrl + Shift + Delete
```

**Opção B - Force Refresh:**
```
Ctrl + F5 (ou Ctrl + Shift + R)
```

**Opção C - Chrome DevTools:**
1. Abra DevTools (F12)
2. Clique direito no botão de Refresh
3. Selecione "Empty cache and hard refresh"

---

### 2️⃣ **Se Ainda Não Funcionar - Abra o Console**

1. Pressione **F12** ou **Ctrl+Shift+I**
2. Vá para a aba **"Console"**
3. Procure por erros (texto vermelho)
4. Screenshot dos erros e envie

---

### 3️⃣ **Verifique a Conexão com Backend**

No Console, execute:
```javascript
fetch('http://localhost:5005/api/clientes')
  .then(r => r.json())
  .then(d => console.log('✅ Backend respondendo:', d))
  .catch(e => console.log('❌ Erro:', e.message))
```

**Esperado:**
- Se aparecer `✅ Backend respondendo:` → Backend está OK
- Se aparecer `❌ Erro: Failed to fetch` → Backend não está rodando

---

### 4️⃣ **Verifique se o Servidor de Frontend Está Rodando**

**Se estiver usando Vite (desenvolvimento):**
```bash
# No terminal, verifique se há um processo rodando na porta 5173 ou 3000
# Ou procure por "npm run dev"
```

**Se estiver usando build estática (produção):**
```bash
# Verifique se há um servidor HTTP servindo a pasta dist/
# Tente acessar: http://localhost:3000 ou http://localhost:8080
```

---

## 🔧 Possíveis Causas e Soluções

| Sintoma | Causa | Solução |
|---------|-------|---------|
| Tela branca ao carregar | Cache do navegador | Ctrl+Shift+Delete ou Ctrl+F5 |
| Erro "Cannot GET /clientes" | Rota não existe | Backend não está rodando |
| Console: "Failed to fetch" | Backend não responde | Inicie backend em localhost:5005 |
| Console: CORS error | URL incorreta | Verifique VITE_API_URL |
| Carregando infinito | Requisição pendente | F12 → Network → veja timeout |

---

## 📍 Verificações Rápidas

### Backend Está Rodando?
```bash
curl http://localhost:5005/api/clientes
```
**Esperado:** JSON array ou erro (não timeout)

### Frontend Está Carregando?
```bash
curl http://localhost:3000  # ou outra porta
```
**Esperado:** HTML completo, não vazio

### URLs Estão Corretas?
No Console do navegador:
```javascript
console.log(import.meta.env.VITE_API_URL)
```
**Esperado:** `http://localhost:5005`

---

## 🆘 Se Nada Funcionar

1. **Feche tudo:**
   ```bash
   # Feche navegador
   # Feche terminal/cmd
   # Feche IDE
   ```

2. **Reinicie o backend:**
   ```bash
   cd backend
   npm start
   # Espere mensagem: "🚀 Servidor rodando na porta 5005"
   ```

3. **Reinicie o frontend (se em desenvolvimento):**
   ```bash
   cd frontend
   npm run dev
   # Espere mensagem: "Local: http://localhost:5173"
   ```

4. **Abra o navegador:**
   ```
   http://localhost:5173 (ou a porta que aparecer)
   ```

5. **Clique em "Clientes"**

---

## 📋 Checklist de Diagnóstico

- [ ] Backend rodando em localhost:5005?
- [ ] Frontend rodando ou servindo build?
- [ ] Navegador aceita cookies/localStorage?
- [ ] Console sem erros de CORS?
- [ ] API_URL correto no ambiente?
- [ ] Cache do navegador limpo?
- [ ] Requisição não está em timeout (Network tab)?

---

## 🔗 Informações Técnicas

**Arquivo:**
- `frontend/src/pages/Clientes.jsx` linha 707
- Endpoint: `GET /api/clientes`
- Backend: `backend/src/controllers/clientesController.js`

**URLs Esperadas:**
- Frontend: `http://localhost:5173` ou `http://localhost:3000`
- Backend: `http://localhost:5005`
- API: `http://localhost:5005/api/clientes`

---

**Se o console mostrar erros específicos, compartilhe comigo para diagnosticar melhor!**
