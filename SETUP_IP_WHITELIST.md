# Configurar IP Whitelist - MongoDB Atlas

**Tempo:** 1-2 minutos  
**Ação:** Manual (interface web)

---

## 🎯 PASSO A PASSO

### Passo 1: Acessar MongoDB Atlas
```
https://cloud.mongodb.com/
```

### Passo 2: Login
- Email do MongoDB Atlas
- Sua senha

### Passo 3: Selecionar Cluster
- Clique em seu cluster (Cluster0)
- Ou vá direto para: **Network Access**

### Passo 4: Network Access
**No menu esquerdo, clique em:**
```
SECURITY
  └─ Network Access
```

### Passo 5: Add IP Address
1. Clique no botão **"Add IP Address"** (canto superior direito)
2. Uma caixa de diálogo abrirá

### Passo 6: Inserir IP
**Na caixa "IP Address", cole:**
```
0.0.0.0/0
```

⚠️ **NOTA:** `0.0.0.0/0` permite QUALQUER IP (apenas para desenvolvimento!)

### Passo 7: Confirmar
1. Clique em **"Confirm"**
2. Você verá: "IP whitelist entry added successfully"

### Passo 8: Aguardar
```
⏳ Aguarde 1-2 minutos para as mudanças serem aplicadas
```

---

## ✅ VERIFICAR SE FOI CONFIGURADO

Depois de aguardar, você verá na lista:
```
IP Address      Access Type    Created
0.0.0.0/0       Any            [data/hora]
```

---

## 🚀 PRÓXIMOS PASSOS

Após ver na lista, volte ao terminal e execute:

```bash
node test-mongodb-srv.js
```

**Saída esperada:**
```
✅ Conectado com sucesso!
📚 Collections encontradas: 0
✨ Tudo funcionando!
```

---

## 📸 SCREENSHOTS (Descrição)

### Tela 1: Network Access
```
SECURITY (menu esquerdo)
  └─ Network Access (clique aqui)
```

### Tela 2: IP Whitelist
```
[Add IP Address] (botão no canto superior direito)
```

### Tela 3: Diálogo
```
ADD IP WHITELIST ENTRY

IP Address: [0.0.0.0/0]  ← Cole aqui

[Confirm] (botão)
```

### Tela 4: Confirmação
```
✓ IP whitelist entry added successfully

IP Address      Access Type    Created
0.0.0.0/0       Any            2026-04-24 14:30
```

---

## ❓ DÚVIDAS

**P: Preciso de um IP específico?**  
R: Não, use `0.0.0.0/0` para desenvolvimento. Em produção, use seu IP real.

**P: Quanto tempo leva?**  
R: 1-2 minutos para aplicar.

**P: E se não funcionar após 2 min?**  
R: Tente novamente. Às vezes leva mais tempo.

**P: Posso remover depois?**  
R: Sim, clique no ícone de lixeira ao lado de `0.0.0.0/0`

---

## 🎯 CHECKLIST

- [ ] Ir para https://cloud.mongodb.com/
- [ ] Clicar em Network Access (menu esquerdo)
- [ ] Clicar em "Add IP Address"
- [ ] Colar: `0.0.0.0/0`
- [ ] Clicar em "Confirm"
- [ ] Aguardar 1-2 minutos
- [ ] Ver na lista: `0.0.0.0/0` com "Any"
- [ ] Voltar ao terminal
- [ ] Executar: `node test-mongodb-srv.js`
- [ ] Ver: `✅ Conectado com sucesso!`

---

**Estimado:** 3-5 minutos total
