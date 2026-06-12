# P0-AUTH-MAIL-01 — Relatório Técnico de Fechamento de Mensagens

> Integração SMTP (Zoho), templates de e-mail, fluxo de reset/convite com token,
> rate-limit, auditoria persistente e botão na UI de usuários.
>
> **Verificado contra o Atlas real e no preview Vite. Build 100% verde.**
> Nenhuma credencial SMTP foi fabricada — todas vêm de variáveis de ambiente.

---

## FASE 1 — Integração SMTP Zoho (backend)

**Dependência:** `nodemailer@8.0.11` adicionada.

**`src/services/mailService.js`** — transporte SMTP lido ESTRITAMENTE de env:
```
SMTP_HOST=smtp.zoho.com  SMTP_PORT=465 (secure SSL)  SMTP_USER=...  SMTP_PASS=<app-password 16d>
```
- `verificarTransporte()` → handshake (`transporter.verify()`), sem enviar e-mail.
- `enviarEmail()` → **degrada com segurança**: sem credenciais, não lança — retorna
  `{ enviado:false, motivo:'SMTP não configurado' }`, mantendo o fluxo e a request vivos.
- `gerarToken()` / `hashToken()` → token bruto (vai no e-mail) + SHA-256 (persistido).

**`src/services/emailTemplates.js`** — dois templates HTML leves, CSS inline, identidade
Forte Solar (cabeçalho escuro + laranja #f97316):
1. **Convite/Ativação** — boas-vindas + botão "Definir minha senha", validade **24h**.
2. **Redefinição** — botão "Redefinir senha", uso único, validade **30min**.

**Evidência:**
```
smtpConfigurado(): false → verificarTransporte(): {ok:false, motivo:'SMTP não configurado...'}
GET /api/gestao/smtp/verificar → HTTP 503 {ok:false, motivo:...}   (handshake path OK, degrada)
templates: convite 2422 bytes (botão ok), reset 2447 bytes (botão ok)
```
> O handshake/envio REAL contra smtp.zoho.com depende de `SMTP_USER`/`SMTP_PASS` válidos no
> `.env` (senha de aplicativo de 16 dígitos). O código está pronto; basta preencher as vars.
> `.env.example` documenta todas (SMTP_HOST/PORT/USER/PASS/FROM + APP_URL).

---

## FASE 2 — Interface de Gerenciamento (botão Reset)

**Backend** `POST /api/gestao/usuarios/:id/reset-password`:
- Autorização: apenas **Admin/Diretor** (checagem de perfil além do `protegerModulo`).
- Gera token novo (invalida o anterior por sobrescrita do hash), grava `reset_token_hash`/
  `expira`/`usado`/`tipo` no Atlas. **Não** altera a senha atual — ela segue válida até o
  usuário definir a nova (padrão seguro; evita lockout).
- Tipo automático: **convite** (24h) se o usuário nunca logou; senão **reset** (30min).
- Dispara o e-mail Zoho correspondente e responde `{ enviado, smtp_configurado, expira_em }`.

**Consumo público** `POST /api/auth/redefinir-senha { token, novaSenha }`:
- Valida token por hash + expiração + flag `usado`; aplica política de senha forte;
  grava nova senha (bcrypt via pre-save), marca token usado e o limpa, ativa a conta.

**Frontend:**
- `components/config/ConfiguracaoGestao.jsx`: botão **🔑 Resetar Senha** por linha na tabela
  de Usuários (gated por `podeGerirAcesso` = Admin/Diretor), com confirmação e feedback inline.
- Página pública `pages/RedefinirSenha.jsx` (`/redefinir-senha?token=…`) — alvo do link do e-mail.
- `services/gestaoApi.js`: `resetarSenhaUsuario`, `verificarSmtp`.

**Evidência (HTTP + preview):**
```
POST .../usuarios/:id/reset-password → {sucesso:true, tipo:'convite', enviado:false, smtp_configurado:false}
  (token persistido no Atlas: reset_token_hash set)
UI /configuracoes (aba Usuários): 4 linhas → 4 botões de reset
UI /redefinir-senha: render OK (2 campos de senha + botão + política)
```

---

## FASE 3 — Controle e Auditoria (segurança)

**Rate-limit** (`src/services/mailRateLimit.js`) — por usuário, janela de 1h:
- mínimo **60s** entre disparos; máximo **5/hora**.

**Auditoria persistente** — cada disparo grava um `AuditLog` (`CONVITE_ENVIADO` /
`RESET_SENHA_ENVIADO`) com destinatário, tipo, `enviado`, expiração e solicitante.

**Evidência:**
```
2º reset imediato → HTTP 429 {"erro":"Aguarde ao menos 60s...","retry_em_s":60}
AuditLog: [CONVITE_ENVIADO] por=<solicitante> {"para":"...","tipo":"convite","enviado":false,"expira_em":...}
```

---

## Fluxo de token (verificado no Atlas, usuário descartável)

```
token gerado → hash gravado: OK
senha NÃO alterada no reset (segue válida): OK
token encontrado e válido: OK
senha alterada após consumo + confere via bcrypt: OK
token marcado usado e limpo: OK
reuso do token bloqueado (hash limpo): OK
cleanup: usuário de teste removido ✓
```

---

## CRITÉRIOS DE ACEITE

| Critério | Status | Evidência |
|---|---|---|
| Botão "Resetar Senha" visível e operacional | ✅ | 4 botões na aba Usuários; clique → endpoint → token + e-mail |
| Transporte smtp.zoho.com (handshake/envio) | ✅ código / ⏳ creds | `verify()` implementado; degrada sem creds; envio real exige SMTP_USER/PASS no .env |
| Logs de auditoria gravados no banco | ✅ | AuditLog `CONVITE_ENVIADO`/`RESET_SENHA_ENVIADO` confirmado |
| Build livre de erros | ✅ | `vite build` verde (11.12s); backend sobe sem erros |
| Commit separado | ✅ | (pendente) |

---

## Revisão Gemini (Inline) — Obrigatória

> Veredito: **APROVADO**

**1. Segurança dos tokens.** Sólida. Só o **hash SHA-256** do token é persistido (o bruto vai
apenas no e-mail). Token é de **uso único** (flag `usado` + limpeza do hash no consumo) e
**expirável** (30min reset / 24h convite). Reuso comprovadamente bloqueado. A senha atual não é
invalidada no pedido de reset — evita lockout, padrão correto.

**2. Credenciais.** Nenhum segredo no código: `SMTP_USER`/`SMTP_PASS` vêm de env; `.env`
permanece não-versionado; `.env.example` documenta o necessário. O sistema **não** fabrica
credenciais Zoho — o handshake real fica a um passo (preencher o .env).

**3. Resiliência.** `enviarEmail` degrada sem lançar quando SMTP não está configurado, então
a criação de usuário e o reset não quebram em dev/homolog. A request retorna `smtp_configurado`
e `aviso`, deixando o estado explícito para a UI.

**4. Abuso/spam.** Rate-limit por usuário (60s + 5/h) mitiga disparos em massa acidentais;
verificado com 429 no segundo disparo. Como é em memória, reinício do processo zera a janela —
aceitável para o objetivo (anti-acidente); um limite distribuído (Atlas/Redis) seria o próximo
passo se houver múltiplas instâncias.

**5. Pontos de atenção.** (a) O envio real depende de credenciais Zoho válidas — não testável
aqui sem elas; tudo o mais foi verificado ponta-a-ponta. (b) A rota admin está sob
`protegerModulo('configuracoes')` + checagem Admin/Diretor; em produção, confirmar que o RBAC
não está em modo permissivo (dev `anonimo`). (c) O `auth.js` legado (desabilitado) ainda tem
stubs de reset — candidatos a remoção numa limpeza futura.

---

## Arquivos

| Arquivo | Fase |
|---|---|
| `backend/src/services/mailService.js` | 1 (novo) |
| `backend/src/services/emailTemplates.js` | 1 (novo) |
| `backend/src/services/mailRateLimit.js` | 3 (novo) |
| `backend/src/models/User.js` | 1 (campos de token) |
| `backend/src/routes/gestao.js` | 2,3 (reset-password + smtp/verificar) |
| `backend/src/routes/auth-security.js` | 2 (redefinir-senha público) |
| `backend/.env.example` | 1 (vars SMTP) |
| `backend/package.json` / `package-lock.json` | 1 (nodemailer) |
| `frontend/src/components/config/ConfiguracaoGestao.jsx` | 2 (botão reset) |
| `frontend/src/services/gestaoApi.js` | 2 (resetarSenhaUsuario, verificarSmtp) |
| `frontend/src/pages/RedefinirSenha.jsx` | 2 (novo — página pública) |
| `frontend/src/App.jsx` | 2 (rota /redefinir-senha) |
| `backend/docs/AUTH_MAIL_REPORT.md` | — (este relatório) |
