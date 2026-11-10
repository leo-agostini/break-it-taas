# Arquitetura do Backend

> Este documento descreve a arquitetura **já implementada** em `backend/`, extraída a partir do código-fonte (não é uma proposta). Serve como referência para agentes de IA e novos contribuidores. A decisão e as alternativas estão no [ADR-007](../03-decisions/ADR-007-adonis-modular-monolith.md).

## Visão geral

O backend é um **monólito modular MVC em AdonisJS v7** (Node.js 24). O código é dividido por **módulo de negócio**, não por camada técnica; dentro de cada módulo há controllers, models, services e validators no estilo Adonis, e uma pasta `domain/` com as regras de negócio em TypeScript puro.

```
backend/
  adonisrc.ts            providers, preloads, suites de teste
  start/env.ts           schema validado de variáveis de ambiente (fonte única de configuração)
  start/kernel.ts        pilhas de middleware (cors, bodyparser, sessão, auth)
  start/routes.ts        apenas importa o routes.ts de cada módulo
  config/                app, database (pg), session, auth, cors, hash (argon2), bodyparser
  providers/app_provider.ts   liga portas a implementações (TestRunQueue → Kubernetes)
  commands/              comandos Ace: outbox:work (worker), db:adopt-knex
  database/migrations/   migrations Lucid
  app/
    exceptions/handler.ts     converte qualquer exceção em resposta HTTP
    middleware/               auth, force JSON, bindings do container
    modules/
      shared/        domain/ (erros, tipos, ids), http/ (mapeamento de erros, actor, serialização), health
      identity/      usuários, organizações, sessão
      load_testing/  test cases, test runs, resultados, métricas, callback do runner
      runner/        adaptador Kubernetes + porta TestRunQueue + assinatura HMAC
      outbox/        outbox transacional
  tests/{unit,functional,integration}/
```

Banco: **PostgreSQL** via **Lucid**. Fila de execução: **Kubernetes Jobs** via client oficial. Autenticação: **sessão do Adonis** em cookie `httpOnly` ([ADR-008](../03-decisions/ADR-008-session-auth.md)). Testes: **Japa**.

Há dois processos de entrada, ambos sobre o mesmo código:

- `node bin/server.js` (dev: `node ace serve --hmr`) — servidor HTTP.
- `node ace outbox:work` — worker que despacha eventos do outbox em polling (5 s, lotes de 50), sem depender do processo HTTP. Roda no host porque cria Jobs e precisa de kubeconfig ([ADR-006](../03-decisions/ADR-006-compose-first-local-environment.md)).

## Anatomia de um módulo

```
modules/load_testing/
  domain/        regras puras: value objects, políticas, ciclo de vida, projeções
  models/        models Lucid (persistência + métodos que aplicam o domínio)
  services/      operações do módulo; abrem transações, orquestram models e domínio
  validators/    schemas VineJS (estrutura da requisição)
  controllers/   finos: validam, chamam um serviço, devolvem um presenter
  presenters/    montam o corpo de resposta campo a campo
  routes.ts      as únicas URLs que o módulo conhece
```

Um fluxo típico (`POST /api/test-cases`):

```ts
// controllers/test_cases_controller.ts
async store(ctx: HttpContext) {
  const payload = await ctx.request.validateUsing(createTestCaseValidator); // Vine: estrutura
  const { testCase, run } = await this.testCases.create(payload, actorOf(ctx));
  ctx.response.status(201);
  return { testCaseId: testCase.id, testRunId: run.id };
}

// services/test_case_service.ts
async create(draft, actor) {
  assertActorMayOwn(draft, actor);                       // domínio
  const definition = buildTestCaseDefinition(draft);     // domínio: regras entre campos
  return db.transaction(async (trx) => {
    const testCase = TestCase.fromDefinition(definition);
    testCase.useTransaction(trx);
    await testCase.save();
    const run = await this.runs.request(testCase.id, trx); // run QUEUED + evento no outbox, mesma transação
    return { testCase, run };
  });
}
```

Serviços recebem dependências por **injeção de construtor** (`@inject()`), resolvidas pelo container do Adonis.

## O núcleo de domínio (`modules/*/domain/`)

O que ficou isolado do framework, e por quê:

- **`load_testing/domain/vos/`** — `LoadProfile`, `Stage`, `Step`, `ThresholdPolicy`, `ExecutionPolicy`, `AuthStrategy`, `TargetSystem`. Modelam o teste de carga de forma **agnóstica de engine** ([ADR-002](../03-decisions/ADR-002-domain-model-independent-from-k6.md)); o mapeamento para k6 acontece só no runner.
- **`load_testing/domain/test_case_definition.ts`** — `buildTestCaseDefinition` aplica as regras que envolvem vários campos: preset × perfil explícito, compatibilidade tipo de teste ↔ modo de carga, exigências do BREAKPOINT, timeout suficiente para a duração do perfil. `assertActorMayOwn` define quem pode ser dono de um test case.
- **`load_testing/domain/test_run_status.ts`** — o ciclo de vida do `TestRun` como transições puras; o model `TestRun` só aplica o resultado e carimba timestamps.
- **`load_testing/domain/k6_result_metrics.ts`** — normaliza o resumo cru do k6 em métricas de relatório.
- **`outbox/domain/`** — catálogo de eventos e política de retry com backoff exponencial.
- **`identity/domain/`** — política de senha e invariantes de perfil.
- **`shared/domain/`** — `BaseError` e erros customizados (`NotFoundError`, `ValidationError`, ...), que carregam só `code`, `message`, `description`, `help` — **sem status HTTP** ([ADR-003](../03-decisions/ADR-003-error-boundary-and-http-mapping.md)).

Regra prática: um arquivo em `domain/` não importa `@adonisjs/*`, models, services nem nada que faça I/O. Ele pode importar o `domain/` de outro módulo.

## Fronteiras entre módulos

- Grafo de dependências, sem ciclos: `identity → shared`; `load_testing → outbox, runner, shared`; `outbox → shared`; `runner → shared`.
- Um módulo usa outro **apenas** pelos seus `services/` ou `domain/` (e o `runner` pela porta `TestRunQueue`). Nunca importa models ou controllers de outro módulo.
- `runner` define seus próprios tipos de entrada (`RunnerJob`), estruturais e em formato JSON, para não depender do domínio de `load_testing`.
- `outbox` não sabe o que um evento significa: o comando `outbox:work` registra, para cada tipo, o handler do módulo consumidor (`test-run.requested` → `RunDispatchService` de `load_testing`).

## Erros e HTTP

`app/exceptions/handler.ts` delega para `#modules/shared/http/error_mapper`, **o único ponto** que transforma um erro em status HTTP. Erros de framework são dobrados no mesmo corpo `{ error: { code, message, description?, help? } }`:

| Origem                                        | Status | `code`                  |
|-----------------------------------------------|--------|-------------------------|
| `ValidationError` / falha do VineJS           | 422    | `VALIDATION_ERROR`      |
| `AuthenticationError` / sem sessão / login inválido | 401 | `AUTHENTICATION_ERROR` |
| `AuthorizationError`                          | 403    | `AUTHORIZATION_ERROR`   |
| `NotFoundError`                               | 404    | `NOT_FOUND`             |
| `InvariantViolationError`                     | 409    | `INVARIANT_VIOLATION`   |
| rota inexistente                              | 404    | corpo `{ status: 'not_found' }` |
| qualquer outro                                | 500    | `INTERNAL_SERVER_ERROR` |

Só respostas 5xx são registradas como erro no log.

## Autenticação e o callback do runner

- Rotas sob `/api/test-cases` e `/api/test-runs` usam `middleware.auth()` (session guard). `actorOf(ctx)` converte o usuário da sessão em `ActorContext` antes de chamar qualquer serviço.
- `POST /api/internal/test-runs/callback` não usa sessão: é autenticado por **HMAC sobre os bytes exatos da requisição** (`request.raw()`, mantido pelo bodyparser), verificado antes de o corpo ser usado para qualquer coisa ([hmac-explained.md](hmac-explained.md)).

## Fluxo ponta a ponta: criação e execução de um `TestRun`

1. Cliente autenticado chama `POST /api/test-runs/:testCaseId` (ou cria um test case, que já gera o primeiro run).
2. `TestRunService` verifica a posse do test case, cria o `TestRun` (`QUEUED`) e grava um evento `test-run.requested` no outbox **na mesma transação** ([ADR-001](../03-decisions/ADR-001-transactional-outbox.md)).
3. `outbox:work` reivindica eventos pendentes com `for update skip locked` e chama `RunDispatchService`, que publica o run via `TestRunQueue` (implementação `KubernetesTestRunQueue`) e marca o run como `RUNNING`. Falhas voltam para `PENDING` com backoff; após 8 tentativas o evento fica `FAILED`.
4. O runner k6, ao terminar, chama o callback interno assinado.
5. `RunCompletionService` conclui o run (callbacks repetidos são aceitos sem efeito), grava o resultado bruto e a projeção normalizada de métricas.
6. O cliente consulta `GET /api/test-runs/:testRunId/report`.

## Testes (`backend/tests/`)

- `unit/` — o núcleo de domínio e o adaptador `runner` (manifesto do Job, scheduling, HMAC, client k8s). Não usa banco.
- `functional/` — requisições HTTP reais contra o servidor de teste e o Postgres num banco **`app_test`** separado (`.env.test`), criado e migrado automaticamente; tabelas truncadas entre testes. O dispatcher do outbox é testado com um `TestRunQueue` falso via `container.swap`.
- `integration/` — fluxo completo contra o ambiente de `ops/dev-up.sh` (API → outbox → worker → Job no kind → callback). Só roda com `RUN_CLUSTER_INTEGRATION=1` (`npm run smoke`).

## Regras para novo código

- Código novo entra no módulo dono do conceito. Se não há dono claro, discuta antes de criar um módulo.
- Uma regra de negócio que pode ser expressa sem banco vai para `domain/`, com teste unitário; o model ou serviço a chama.
- Controllers não contêm regras de negócio nem acessam models diretamente: validam, chamam um serviço e devolvem um presenter.
- Erros de negócio são subclasses de `BaseError` em `shared/domain/errors.ts`; o mapeamento para HTTP é responsabilidade exclusiva do `error_mapper` — nunca `response.status()` para sinalizar erro dentro de um serviço.
- Toda mudança de estado que precisa disparar um efeito assíncrono usa o outbox: `OutboxService.enqueue(evento, trx)` na transação da mudança, nunca side-effects "fire-and-forget".
- Novas implementações de portas (ex.: outra fila de execução) são registradas em `providers/app_provider.ts`.
