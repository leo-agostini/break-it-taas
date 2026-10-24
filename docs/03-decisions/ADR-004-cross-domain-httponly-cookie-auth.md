# ADR-004: Autenticação com cookies httpOnly entre domínios públicos independentes

## Status
Superseded by [ADR-008](ADR-008-session-auth.md) — o mecanismo (JWT + refresh) foi substituído pela sessão do AdonisJS; a postura de cookie cross-site e as limitações de navegador registradas aqui continuam valendo.

## Contexto

O backend e o frontend devem ser publicados em hostnames públicos totalmente independentes (não atrás de um ingress/hostname compartilhado que unifique as duas origens). O backend já emite `access_token` (15 min) e `refresh_token` (7 dias) como JWTs em cookies `httpOnly` (`backend/src/application/services/jwt-auth.ts`, `backend/src/infra/http/cookies.ts`), e `authenticateRequest` (`backend/src/infra/http/middlewares/authenticator.ts`) já aceita tanto o cookie quanto um header `Authorization: Bearer`.

Havia duas alternativas para lidar com a quebra de "mesmo domínio" que essa configuração hoje assume implicitamente (`COOKIE_SAMESITE=Lax`, `COOKIE_SECURE=false`, `CORS_ORIGIN=*` refletido por `backend/src/index.ts`):

1. Um padrão BFF (Backend-for-Frontend), em que o servidor SSR do frontend passa a possuir sua própria sessão, faz o proxy de login/refresh para o backend e nunca expõe cookies do backend ao navegador.
2. Manter os cookies `httpOnly` do backend como estão, só ajustando os atributos do cookie e o CORS para permitir que o navegador os envie diretamente ao backend em requisições cross-site.

## Decisão

Adotar a opção 2: cookies `httpOnly` diretos, cross-site, sem BFF/proxy de token no frontend.

- `COOKIE_SAMESITE=None` e `COOKIE_SECURE=true` em produção (a combinação é obrigatória — `SameSite=None` só é honrado pelo navegador com `Secure`).
- `COOKIE_DOMAIN` permanece **não definido**: frontend e backend são domínios não relacionados; o atributo `Domain` só ajuda a compartilhar um cookie entre subdomínios de um mesmo domínio pai, o que não é o caso aqui.
- `CORS_ORIGIN` fixado na origem real do frontend (nunca `*`) — obrigatório porque o navegador rejeita `Access-Control-Allow-Origin: *` combinado com `Access-Control-Allow-Credentials: true`.
- Nenhuma mudança de código é necessária no backend: `env.ts`, `cookies.ts` e `authenticator.ts` já são inteiramente orientados por variável de ambiente.
- No frontend, `src/lib/httpClient.ts` já usa `withCredentials: true` em todas as instâncias; `src/lib/server-auth.ts` já encaminha o header `Cookie` do navegador para o backend via chamada servidor-a-servidor (não sujeita a CORS/SameSite). Nenhuma lógica nova de refresh/sessão precisa ser escrita no frontend.

## Tradeoffs

- **Safari bloqueia cookies de terceiros por padrão desde a versão 13.1 (2020)**, tanto no desktop quanto no iOS, sem contorno silencioso viável para um fluxo simples de fetch/XHR como este. **Login não vai funcionar no Safari sob este desenho** — essa limitação é aceita conscientemente, não é um bug a ser corrigido depois.
- Firefox usa "Total Cookie Protection" (particionamento por site de topo, não bloqueio) — como é sempre o mesmo frontend chamando o mesmo backend, o fluxo deve continuar funcionando lá.
- Chrome atualmente ainda permite cookies de terceiros por padrão (recuou do plano de descontinuação total em 2024), mas é um alvo instável que pode mudar.
- A alternativa rejeitada (BFF) teria compatibilidade total com todos os navegadores, ao custo de o frontend precisar implementar e manter sua própria lógica de sessão/refresh/proxy de token. Foi descartada porque o objetivo explícito era manter o backend como única fonte de verdade da sessão, sem lógica de autenticação duplicada no frontend.
- Se o suporte a Safari se tornar um requisito depois, a mitigação é migrar para o padrão BFF (opção 1), não tentar contornar o bloqueio de cookies de terceiros — não existe workaround estável para isso.
