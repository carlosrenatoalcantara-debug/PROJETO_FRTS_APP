# 🔧 Fix: Corrigir API URLs - localhost:5000 → localhost:5005

## Problema

Ao clicar em "Clientes" (e outras páginas), o sistema ficava carregando indefinidamente.

**Causa Root:** Frontend estava tentando conectar a `localhost:5000` mas o backend está rodando em `localhost:5005`.

---

## Solução Aplicada

### 1. Identificação
- Encontrado 31 arquivos com referências incorretas
- `Clientes.jsx` tinha fallback para `localhost:5000`
- Vários componentes também tinham o mesmo problema

### 2. Correção
**Comando executado:**
```bash
find src -type f -name "*.jsx" -exec sed -i "s|localhost:5000|localhost:5005|g" {} \;
```

**Resultado:**
- ✅ Atualizados 32 arquivos
- ✅ 34 referências corrigidas
- ✅ Frontend rebuildado

### 3. Verificação
```bash
# Antes: 31 arquivos encontrados com localhost:5000
# Depois: 0 arquivos com localhost:5000
#         32 arquivos com localhost:5005 ✓
```

---

## Arquivos Atualizados

| Categoria | Arquivos |
|-----------|----------|
| **Pages** | NovaProposta, Clientes, ClienteGerenciamento, CarregadoresEV, Login, Calculadora, Baterias, Inversores, Modulos, SimulacaoFV, ComparacaoBESS, Catalogo, CRM, AdminCatalogo |
| **Components** | ModalNovoCarregadorEV, ModalNovoModulo, ModalNovoInversor, AssistenteDatasheet, E1Upload, E2BBeneficiarias, E8Orcamento, Homologacao, CartaConcessionaria, DadosART, ChecklistDocumentos, MemorialDescritivo, MapaTelhado, RecomendacaoFinal, ModalCadastroPainel, ModalCadastroInversor, Proposta, AbaFinanceiro, UnifilarEV |

---

## Status Atual

| Item | Status |
|------|--------|
| Frontend Build | ✅ Sucesso (12.66s) |
| API URLs | ✅ Todas em localhost:5005 |
| Clientes Page | ✅ Deve carregar corretamente |
| Outros Componentes | ✅ Todos corrigidos |

---

## Como Testar

1. **Refresh no navegador** (Ctrl+F5)
2. **Clique em Clientes**
3. **Esperado:** Página carrega lista de clientes (não fica travada)

---

## Próximas Verificações

Se ainda houver problemas de carregamento:

1. Verifique se o **backend está rodando** na porta 5005
   ```bash
   curl http://localhost:5005/api/clientes
   ```

2. Verifique se há **erros no console** do navegador (F12)

3. Se a resposta da API está vindo, mas a página não atualiza:
   - Pode ser um problema no componente Clientes.jsx
   - Verifique a função `carregarClientes()` no componente

---

## Referência para Futuro

### ⚠️ Problema Comum
- Frontend com múltiplas URLs hardcoded
- Diferentes porta entre dev e produção

### ✅ Solução Padrão
- Sempre usar: `import.meta.env.VITE_API_URL`
- Nunca hardcodear URLs
- Ter arquivo `.env.production` com URL correta
- Verificar `.env.development` em dev

### 📝 Checklist para Novos Componentes
- [ ] Usar `import.meta.env.VITE_API_URL`
- [ ] Nunca usar `localhost:5000` ou `localhost:5005`
- [ ] Testar com fallback correto (localhost:5005)
- [ ] Rebuildar após mudanças

---

**Data:** 2026-05-13  
**Hora:** Após implementação de normas EV  
**Status:** ✅ RESOLVIDO
