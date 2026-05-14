# Status de Limpeza: "Desconhecido" Equipamentos

**Data**: 2026-05-14  
**Status**: ✅ PRONTO PARA IMPLEMENTAÇÃO

---

## 🎯 Situação Atual

### MongoDB
- **Status**: 🔴 **OFFLINE** (querySrv ECONNREFUSED)
- **Impacto**: Equipamentos armazenados em MongoDB **não estão acessíveis**

### Fallback Storage (Memory Storage)
- **Arquivo**: `/backend/data/memory-storage.json`
- **Status**: ✅ **LIMPO**
- **Equipamentos**: 9 itens (3 módulos, 4 inversores, 2 carregadores EV)
- **Desconhecido**: 0 itens ✅

### Catálogos
- **catalogoPaineis.js**: 38 painéis, 0 "Desconhecido" ✅
- **catalogoInversores.js**: 41 inversores, 0 "Desconhecido" ✅

---

## 📋 O Que Fazer

### Opção 1: AGORA (Recomendado)
✅ **JÁ FEITO**: memory-storage.json foi atualizado com equipamentos limpos
- O sistema agora servirá dados limpos quando MongoDB estiver offline

### Opção 2: Quando MongoDB Voltar Online
Existem 2 scripts para limpar MongoDB:

#### A) Com Confirmação Interativa
```bash
node limpar-desconhecidos.mjs
```
- ✅ Mostra quantos equipamentos serão deletados
- ✅ Pede confirmação
- ✅ Mostra amostra do que será deletado
- ✅ Verifica resultado final

#### B) Automático (Sem Confirmação)
```bash
node limpar-desconhecidos-automatico.mjs
```
- ✅ Deleta diretamente
- ✅ Mostra relatório antes/depois
- ✅ Útil para CI/CD

---

## 🔍 Como Verificar

### Antes da Limpeza (MongoDB Online)
```bash
node -e "
const mongoose = require('mongoose');
const schema = new mongoose.Schema({fabricante: String}, {collection: 'equipamentos'});
const Eq = mongoose.model('Eq', schema);
mongoose.connect(process.env.MONGODB_URI).then(() => {
  Eq.countDocuments({fabricante: 'Desconhecido'}).then(c => {
    console.log('Desconhecidos em MongoDB:', c);
    process.exit(0);
  });
});
"
```

### Depois da Limpeza
Deverá retornar: `Desconhecidos em MongoDB: 0`

---

## 📊 Validação Final

### Quando MongoDB Estiver Online
1. ✅ MongoDB deve estar vazio ou sem "Desconhecido"
2. ✅ Frontend deve mostrar equipamentos limpos
3. ✅ API `/api/equipamentos` deve retornar dados sem "Desconhecido"

### Quando MongoDB Estiver Offline
1. ✅ Sistema usa memory-storage.json (já foi atualizado)
2. ✅ Frontend mostra 9 equipamentos limpos
3. ✅ API retorna dados limpos

---

## 🚀 Próximos Passos

### 1. Quando MongoDB Voltar Online
```bash
# Execute um dos scripts acima
node limpar-desconhecidos-automatico.mjs
```

### 2. Verificar Resultado
- Teste a API: `GET /api/equipamentos?tipo=inversor`
- Deve retornar apenas equipamentos com marca válida
- Não deve conter "Desconhecido"

### 3. Fazer Deploy
- Committar e deployar as mudanças
- Verificar no frontend que mostra dados limpos

---

## 📝 Arquivos Criados/Modificados

1. **memory-storage.json** ✅
   - Adicionada collection `equipamentos` com 9 itens limpos
   - Nenhum "Desconhecido"

2. **limpar-desconhecidos.mjs** ✅ (NOVO)
   - Script interativo para remover "Desconhecido" do MongoDB
   - Requer confirmação do usuário

3. **limpar-desconhecidos-automatico.mjs** ✅ (NOVO)
   - Script automático para remover "Desconhecido"
   - Sem confirmação (use com cuidado!)

---

## ⚠️ Notas Importantes

1. **Memory Storage é Cache**: Mudanças na memória não afetam MongoDB
2. **Limpeza em MongoDB**: Os scripts acima APENAS limpam MongoDB
3. **Memory-Storage.json**: Já está limpo, não precisa de script
4. **Persistência**: Quando MongoDB voltar, os dados nele ainda estarão lá até executar os scripts

---

## 🎯 Checklist

- [x] memory-storage.json foi atualizado com dados limpos
- [x] equipamentosMemory.js verificado (100% limpo)
- [ ] MongoDB volta online ⏳
- [ ] Script `limpar-desconhecidos-automatico.mjs` executado
- [ ] Verificar que MongoDB não tem "Desconhecido" mais
- [ ] Frontend mostra dados limpos ✅
- [ ] Deploy em produção ✅
