# ADR-008: Autenticação por sessão do AdonisJS (substitui ADR-004)

## Status
Accepted — substitui o [ADR-004](ADR-004-cross-domain-httponly-cookie-auth.md)

## Data
2026-10-24

## Contexto

Com a migração do backend para AdonisJS (ADR-007), a autenticação própria —
JWT de acesso (15 min) e de refresh (7 dias) em cookies `httpOnly`, assinados e
verificados por `JwtAuthService`, mais um endpoint `/auth/refresh` e um
interceptor de retry no frontend — passou a ser código que o framework já
resolve com `@adonisjs/auth` + `@adonisjs/session`.

O ADR-004 continua relevante em um ponto: frontend e backend são publicados em
domínios públicos independentes, então o cookie de autenticação precisa ser
enviado cross-site pelo navegador.

## Decisão

- Usar o **session guard** do `@adonisjs/auth` (`config/auth.ts`) com o
  **cookie store** do `@adonisjs/session` (`config/session.ts`). O cookie
  `breakit-session` guarda o id da sessão e um segundo cookie, criptografado com
  `APP_KEY`, guarda os dados da sessão. Não há estado de sessão no banco.
- `POST /api/login` chama `auth.use('web').login(user)` (regenera o id da
  sessão, evitando fixation); `POST /api/auth/logout` encerra a sessão;
  `GET /api/auth/check` exige sessão válida. **`POST /api/auth/refresh` foi
  removido** — a sessão é renovada a cada requisição autenticada e expira após
  7 dias sem uso.
- Rotas protegidas usam `middleware.auth()`; os controllers convertem
  `auth.user` em `ActorContext` (`#modules/shared/http/actor`) antes de chamar os
  serviços, que não conhecem HTTP nem sessão.
- O cabeçalho `Authorization: Bearer` deixou de ser aceito. O único consumidor
  além do navegador, o teste de integração do cluster, faz login e reenvia os
  cookies da sessão.
- Atributos do cookie vêm do ambiente, mantendo a postura cross-site do ADR-004:
  - produção: `SESSION_SAMESITE=none` (a config força `Secure` sempre que
    `SameSite=None`, exigência do navegador);
  - local (mesmo host): `SESSION_SAMESITE=lax`, `SESSION_SECURE=false`.
- CORS por `@adonisjs/cors` com `credentials: true` e `CORS_ORIGIN` como lista
  explícita de origens; `*` só reflete a origem da requisição em
  desenvolvimento local.
- Hash de senha via `@adonisjs/hash` com argon2id e **os mesmos parâmetros** do
  backend anterior, de modo que os hashes já gravados continuam válidos
  (coberto por teste unitário).
- No frontend, o interceptor de refresh e o fallback de refresh dos loaders
  foram removidos: um 401 em `/auth/check` redireciona direto para `/login`.

## Proteção contra CSRF

O CSRF do `@adonisjs/shield` permanece desligado, como no desenho anterior: o
frontend está em outro domínio e não consegue ler um cookie `XSRF-TOKEN` do
backend. A mitigação é a mesma de antes — `CORS_ORIGIN` restrito à origem real do
frontend e corpos JSON (`Content-Type: application/json` força preflight, que o
CORS bloqueia para origens não autorizadas). Se o frontend passar a compartilhar
domínio com o backend, ligar o CSRF do Shield é o próximo passo.

## Tradeoffs

- **Safari continua sem login** sob este desenho: ele bloqueia cookies de
  terceiros por padrão, exatamente como registrado no ADR-004. A mitigação
  continua sendo um BFF, não um contorno do bloqueio.
- Sessões em cookie não podem ser revogadas no servidor antes de expirarem
  (logout apaga o cookie do navegador que o chamou). Se revogação centralizada
  virar requisito, trocar o store para `database` ou Redis é uma mudança de
  configuração.
- Menos código próprio de segurança para manter (JWT, cookies, refresh,
  interceptor), ao custo de uma mudança de contrato com o frontend (fim do
  `/auth/refresh`).
