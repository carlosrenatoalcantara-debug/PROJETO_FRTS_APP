# Rotação pendente — credencial de banco exposta no repositório

**Status: AÇÃO MANUAL PENDENTE NO MONGODB ATLAS.**

## O que foi encontrado

A auditoria PRODUCTION-FINISH-01 encontrou, em arquivos versionados deste
repositório, a URI completa de conexão do MongoDB — com usuário e senha em texto
claro — apontando para **`cluster0.iva0pph.mongodb.net`**, que é o cluster que a
aplicação usa hoje (o mesmo host configurado em `MONGODB_URI`).

Usuário exposto: `renato_db_user`. O usuário em uso pela aplicação é outro
(`forte-solar`), mas ambos pertencem ao mesmo cluster: se `renato_db_user` ainda
existir no Atlas, a credencial publicada continua dando acesso aos dados de
produção.

Uma segunda credencial, de um cluster anterior (`cluster0.e3d0pph`), também
estava exposta.

## O que já foi feito (P0-02, sprint de fechamento)

As ocorrências foram substituídas por `SENHA_REMOVIDA_ROTACIONE_NO_ATLAS` nos
arquivos abaixo, que continuam servindo como documentação:

- `CONSOLIDATED_PROJECT_SUMMARY.md`
- `GEMINI_PARECER_IMPLEMENTATION.md`
- `MONGODB_FINAL_STATUS.md`
- `MONGODB_PRONTO_PARA_WHITELIST.md`
- `MONGODB_STATUS.md`
- `backend/scripts/legacy/test-mongodb-direct.js`

## O que isso NÃO resolve

Remover do arquivo **não invalida a credencial** e **não a remove do histórico
do git**. Qualquer clone existente, fork ou cópia do histórico ainda contém o
valor. Enquanto o usuário não for rotacionado no Atlas, a exposição permanece
ativa na prática.

## O que precisa ser feito, nesta ordem

1. **Rotacionar no Atlas** (Database Access): excluir ou trocar a senha de
   `renato_db_user`; conferir se `forte-solar` também precisa de rotação, já que
   a URI dele aparecia em documentos com senha mascarada.
2. **Atualizar `MONGODB_URI`** onde a aplicação roda (Railway) e no `.env` local.
3. **Confirmar que a aplicação sobe** com a credencial nova.
4. **Só então** decidir sobre a purga do histórico (`git filter-repo` /
   BFG). A purga reescreve hashes e exige coordenação com quem tiver clones —
   por isso não foi executada nesta sprint, conforme instrução explícita.

Até o passo 1 estar concluído, considere a credencial antiga como comprometida.

## Verificação

Nenhum dos dois segredos aparece mais em arquivo versionado:

```bash
git grep -lI "<valor rotacionado>" -- .   # deve retornar vazio
```

A varredura que encontrou a exposição (sem imprimir valores) é:

```bash
git grep -InE "mongodb\+srv://[A-Za-z0-9_.-]+:[A-Za-z0-9]{8,}@" -- .
```
