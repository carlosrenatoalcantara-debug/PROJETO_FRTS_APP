# 🧹 Guia de Limpeza: Equipamentos "Desconhecido"

## 📍 Estado Atual (2026-05-14)

```
✅ MEMORY STORAGE: LIMPO
   → 9 equipamentos válidos (3 módulos, 4 inversores, 2 carregadores EV)
   → 0 "Desconhecido"

🔴 MONGODB: OFFLINE
   → Sistema usando fallback (memory storage)
   → Status de MongoDB desconhecido
```

---

## 🎯 O Que Foi Feito

### 1. ✅ Limpeza de Memory Storage
- Arquivo: `data/memory-storage.json`
- Adicionada collection `equipamentos` com dados limpos de `equipamentosMemory.js`
- Verificado: 0 itens "Desconhecido"

### 2. ✅ Scripts de Limpeza Criados
Três scripts para diferentes cenários:

| Script | Uso | Quando Usar |
|--------|-----|-----------|
| `verificar-e-limpar.mjs` | Verifica status | Sempre |
| `limpar-desconhecidos.mjs` | Limpeza interativa | Manual com confirmação |
| `limpar-desconhecidos-automatico.mjs` | Limpeza automática | CI/CD ou batch |

### 3. ✅ Verificação de Catálogos
- `catalogoPaineis.js`: 38 painéis, 0 "Desconhecido" ✅
- `catalogoInversores.js`: 41 inversores, 0 "Desconhecido" ✅
- `equipamentosMemory.js`: 9 equipamentos, 0 "Desconhecido" ✅

---

## 🚀 Como Usar

### Verificar Status (AGORA)
```bash
node verificar-e-limpar.mjs
```

Saída esperada:
```
✅ Memory Storage está LIMPO
❌ MongoDB está OFFLINE
```

### Quando MongoDB Voltar Online

#### Opção 1: Limpeza Automática (Recomendado)
```bash
node limpar-desconhecidos-automatico.mjs
```

Saída esperada:
```
✅ X equipamentos removidos
✅ Desconhecidos restantes: 0
✅ MongoDB está 100% limpo!
```

#### Opção 2: Limpeza com Confirmação
```bash
node limpar-desconhecidos.mjs
```

Processo:
1. Mostra quantos itens serão deletados
2. Pede confirmação (digitando "SIM")
3. Deleta itens
4. Mostra resultado final

#### Opção 3: Limpeza Automática Integrada
```bash
node verificar-e-limpar.mjs auto
```

Este comando:
- ✅ Verifica status
- ✅ Se MongoDB estiver online, limpa automaticamente
- ✅ Mostra relatório final

---

## 🔍 Verificação Manual

### Para Visualizar Memory Storage
```bash
node -e "const d=require('./data/memory-storage.json'); console.log('Equipamentos em memory:', d.collections.equipamentos.length);"
```

### Para Contar "Desconhecido" em MongoDB (quando online)
```bash
node -e "
const mongoose = require('mongoose');
const schema = new mongoose.Schema({fabricante:String}, {collection:'equipamentos'});
const M = mongoose.model('M', schema);
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const count = await M.countDocuments({fabricante:'Desconhecido'});
  console.log('Desconhecidos em MongoDB:', count);
  process.exit(0);
});
"
```

---

## 📊 Situação das Equipamentos

### Memory Storage (Fallback - ONLINE)
✅ 9 equipamentos válidos:

**Módulos Solares (3)**
- Neosolar NS400W (400W)
- Neosolar NS550W (550W)
- Canadian Solar CS3K-400MS (400W)

**Inversores (4)**
- Growatt MIC 5000TL-X (5 kW)
- Growatt MIC 10000TL-X (10 kW)
- Solis RHI-5K-48ES-5G (5 kW)
- Deye SUN-8K-G04 (8 kW)

**Carregadores EV (2)**
- Wallbox Pulsar Plus (11 kW)
- Tesla Supercharger V3 (250 kW)

### MongoDB (OFFLINE)
⏳ Status desconhecido - Será limpado quando voltar online

---

## ⚠️ Notas Importantes

1. **Memory Storage é Prioridade**: Se MongoDB está offline, o sistema usa dados de `memory-storage.json`
2. **Limpeza Não Retroativa**: Remover "Desconhecido" de memory-storage.json não afeta o que está em MongoDB
3. **MongoDB Precisa Limpeza Separada**: Use os scripts quando MongoDB voltar online
4. **Frontend Usa API**: O frontend obtém dados via API `/api/equipamentos`, que falha over para memory se MongoDB offline

---

## 🎯 Checklist de Implementação

- [x] Memory Storage foi atualizado e está limpo
- [x] Scripts de limpeza foram criados
- [x] Verificação de catálogos confirmou dados limpos
- [ ] MongoDB volta online ⏳
- [ ] Executar script de limpeza quando MongoDB estiver online
- [ ] Verificar que MongoDB está 100% limpo
- [ ] Testar API `/api/equipamentos?tipo=inversor`
- [ ] Confirmar frontend mostra dados limpos
- [ ] Deploy em produção

---

## 🔧 Troubleshooting

### "MongoDB está OFFLINE"
→ Aguarde MongoDB voltar online, depois execute limpeza

### "Node: command not found"
→ Use `npm run` ao invés de `node` se configurado em package.json

### Erro de Permissão
→ Verifique se `.env` tem MONGODB_URI válida
→ Verifique se tem acesso à rede MongoDB Atlas

### Erro "ECONNREFUSED"
→ MongoDB não está respondendo
→ Verifique status em mongodb.com

---

## 📞 Referência Rápida

| Tarefa | Comando |
|--------|---------|
| Ver status | `node verificar-e-limpar.mjs` |
| Limpar se online | `node verificar-e-limpar.mjs auto` |
| Limpar com confirmação | `node limpar-desconhecidos.mjs` |
| Limpar automaticamente | `node limpar-desconhecidos-automatico.mjs` |
| Contar memory | `node -e "const d=require('./data/memory-storage.json'); console.log(d.collections.equipamentos.length);"` |

---

## 📝 Histórico

| Data | Ação | Status |
|------|------|--------|
| 2026-05-14 | Atualizar memory-storage.json | ✅ Completo |
| 2026-05-14 | Criar scripts de limpeza | ✅ Completo |
| 2026-05-14 | Verificar catálogos | ✅ Completo |
| TBD | MongoDB volta online | ⏳ Aguardando |
| TBD | Executar limpeza MongoDB | ⏳ Próximo |
| TBD | Deploy em produção | ⏳ Final |

---

**Última atualização**: 2026-05-14  
**Responsável**: Claude Agent  
**Próximo passo**: Executar limpeza quando MongoDB estiver online
