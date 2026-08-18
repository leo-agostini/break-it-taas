# Arquitetura do Backend

> Este documento descreve a arquitetura **já implementada** em `backend/src`, extraída a partir do código-fonte (não é uma proposta). Serve como referência para agentes de IA e novos contribuidores.

## Visão geral

O backend segue **Clean Architecture / Ports & Adapters**, com três camadas e uma regra de dependência estrita: `infra` depende de `application`, `application` depende de `domain`, e **`domain` não depende de nada**. Nenhuma camada interna conhece uma camada externa.

```
backend/src/
  domain/        # regras de negócio puras, sem I/O, sem HTTP, sem framework
  application/   # casos de uso, orquestração, portas (interfaces)
  infra/         # adaptadores concretos: HTTP (Elysia), DB (Knex), fila (k8s), config
  tests/         # espelha a estrutura acima
```

Runtime: **Bun**. Framework HTTP: **Elysia**. Banco: **PostgreSQL** via **Knex** (query builder + migrations, sem ORM). Fila de execução: **Kubernetes Jobs** via client oficial. Autenticação: **JWT** (access + refresh) com cookies httpOnly.

Há dois processos de entrada, ambos lendo do mesmo `domain`/`application`:

- `src/index.ts` — servidor HTTP Elysia (API pública, protegida e interna).
- `src/worker.ts` — worker standalone que despacha eventos do outbox em polling (`OutboxDispatcherWorker`, intervalo de 5s), sem depender do processo HTTP.

## Camada `domain/`

Contém apenas regras de negócio, sem dependência de protocolo, framework ou infraestrutura.

- `entities/` — `User`, `Organization`, `TestCase`, `TestRun`, `OutboxEvent`. Entidades expõem métodos de transição de estado (ex.: `TestRun.create()`, `run.queue()`).
- `vos/` (value objects) — `LoadProfile`, `Stage`, `Step`, `ThresholdPolicy`, `ExecutionPolicy`, `AuthStrategy`, `TargetSystem`. Modelam o teste de carga de forma **agnóstica de engine** (ver [ADR-002](../03-decisions/ADR-002-domain-model-independent-from-k6.md)): o mapeamento para k6 acontece só na borda de infraestrutura.
- `errors/` — `BaseError` e erros customizados (`NotFoundError`, `AuthorizationError`, `ValidationError`, etc.) carregam apenas `code`, `message`, `description`, `help` — **sem `httpStatus`** (ver [ADR-003](../03-decisions/ADR-003-error-boundary-and-http-mapping.md)).
- `events/` — payloads de domínio (`TestRunEvents`, `outbox-event-map.ts`) publicados via outbox.
- `services/` — regras de domínio que não pertencem a uma única entidade (ex.: `load-profile-compatibility-policy.ts`, `password-hasher.ts`).

Regra prática: se um arquivo em `domain/` precisar importar algo de `infra/` ou de uma lib HTTP, é sinal de vazamento de camada.

## Camada `application/`

Orquestra casos de uso combinando entidades de domínio com **portas** (interfaces) que a infraestrutura implementa.

- `use-cases/` — um arquivo por caso de uso (`CreateNewTestRunUseCase`, `CompleteTestRunFromCallbackUseCase`, `LoginUserUseCase`, etc.), cada um com um único método público `execute()`. Um caso de uso recebe repositórios/portas por **injeção de construtor** e não conhece Elysia, Knex ou Kubernetes — apenas as interfaces em `ports/` e `repositories/`.
- `ports/` — interfaces que a infraestrutura implementa: `UnitOfWork` (transação), `TestRunQueue` (publicação de execução), `ActorContext` (identidade do usuário autenticado).
- `repositories/` — interfaces de persistência (`TestCaseRepository`, `TestRunRepository`, `OutboxRepository`, `UserRepository`, `ResultRepository`, `TestRunMetricsRepository`). A implementação concreta (Knex) vive em `infra/db/repositories/`.
- `services/` — serviços de aplicação que cruzam casos de uso, ex. `JwtAuthService`.
- `validators/` — validação de entrada específica de caso de uso.
- `projections/` — transformação de dados para leitura (ex.: `normalize-k6-result-metrics.ts` normaliza métricas cruas do k6 para o formato de relatório).
- `errors/http-error-mapper.ts` — único ponto que traduz um erro de domínio para status HTTP. Ver `domain-boundaries.md`.
- `workers/outbox-dispatcher-worker.ts` — lógica do worker (independente do loop de polling, que fica em `src/worker.ts`).

Um caso de uso típico segue este formato (`create-new-test-run.ts`):

```ts
export class CreateNewTestRunUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private outboxRepository: OutboxRepository,
  ) {}

  async execute(testCaseId: UUID, actor: ActorContext): Promise<TestRun> {
    // 1. carrega e valida regras de domínio/autorização
    // 2. abre uma transação via UnitOfWork
    // 3. persiste a entidade + enfileira um OutboxEvent na MESMA transação
    // 4. retorna a entidade de domínio (não um DTO HTTP)
  }
}
```

O padrão **Transactional Outbox** (ver [ADR-001](../03-decisions/ADR-001-transactional-outbox.md)) garante que a mudança de estado e a publicação do evento nunca fiquem inconsistentes: ambas acontecem na mesma transação de banco; o `worker.ts` despacha os eventos pendentes de forma assíncrona.

## Camada `infra/`

Implementações concretas das portas/interfaces definidas em `application/`.

- `http/` — adaptador Elysia:
  - `container.ts` — **composition root**: instancia repositórios, serviços e casos de uso e monta o `AppContainer` (DI manual via construtor, sem framework de DI).
  - `routes/` — `public-routes.ts`, `protected-routes.ts` (autenticação obrigatória via `authenticator.ts`), `internal-routes.ts` (callback do runner, autenticado por assinatura HMAC).
  - `controllers/` — funções finas que recebem `AppContainer` e delegam para `execute()` do caso de uso; não contêm lógica de negócio.
  - `middlewares/authenticator.ts` — extrai e valida JWT de header/cookie, produz `ActorContext`.
  - `security/runner-callback-signature.ts` — valida HMAC do callback do runner k6 (ver [hmac-explained.md](hmac-explained.md)).
- `db/` — adaptador Knex: `knex.ts` (conexão), `knex-unit-of-work.ts` (implementa `UnitOfWork`), `repositories/knex-*.ts` (implementam as interfaces de `application/repositories`), `migrations/`.
- `k8s/kubernetes-job-client.ts` — cria/observa Jobs Kubernetes que executam o runner k6.
- `queue/k3s-test-run-queue.ts` — implementa `TestRunQueue`, traduzindo uma `TestRun` de domínio em um Job Kubernetes.
- `config/env.ts` — leitura e validação de variáveis de ambiente (fonte única de configuração).

### Autenticação entre domínios independentes

`JwtAuthService` emite `access_token` (15 min) e `refresh_token` (7 dias) como cookies `httpOnly` (`infra/http/cookies.ts`); `authenticateRequest` (`infra/http/middlewares/authenticator.ts`) aceita tanto o cookie quanto um header `Authorization: Bearer`. Como o frontend é publicado num domínio público diferente do backend (sem ingress compartilhado unificando as duas origens), esses cookies precisam ser configurados para cross-site: `COOKIE_SAMESITE=None`, `COOKIE_SECURE=true` e `CORS_ORIGIN` fixado na origem real do frontend (nunca `*`, que só existe como conveniência de dev local — `index.ts` reflete o `Origin` da requisição apenas quando `CORS_ORIGIN` é deixado em `*`). `COOKIE_DOMAIN` permanece não definido, já que frontend e backend não compartilham um domínio pai. A decisão completa e o tradeoff aceito (Safari bloqueia cookies de terceiros por padrão) estão em [ADR-004](../03-decisions/ADR-004-cross-domain-httponly-cookie-auth.md).

## Fluxo ponta a ponta: criação e execução de um `TestRun`

1. Cliente autenticado chama `POST /api/test-runs/:testCaseId` (`protected-routes.ts`).
2. `createTestRunController` delega para `CreateNewTestRunUseCase.execute()`.
3. O caso de uso valida posse do `TestCase`, cria a entidade `TestRun` (`status: queued`) e um `OutboxEvent`, e persiste ambos na mesma transação (`UnitOfWork`).
4. `OutboxDispatcherWorker` (processo `worker.ts`) faz polling do outbox, encontra o evento pendente e usa `K3sTestRunQueue.publish()` para criar um Job Kubernetes via `KubernetesJobClient`.
5. O runner k6, ao terminar, chama o callback interno (`internal-routes.ts`), autenticado por HMAC.
6. `CompleteTestRunFromCallbackUseCase` persiste o resultado, normaliza métricas (`normalize-k6-result-metrics.ts`) e atualiza o status do `TestRun`.
7. O cliente consulta `GET /api/test-runs/:testRunId/report`, atendido por `GetTestRunReportUseCase`.

## Testes (`src/tests/`)

A árvore de testes espelha `domain/`, `application/` (via `use-cases/`) e `infra/`. Casos de uso são testados com **repositórios in-memory** (`tests/mocks/in-memory-*-repository.ts`), o que só é possível porque os casos de uso dependem de interfaces, nunca de implementações Knex. Há um teste de integração (`tests/integration/test-run-k3s-flow.spec.ts`) que exercita o fluxo outbox → Kubernetes Job.

## Regras para novo código

- Um caso de uso novo vai em `application/use-cases/`, recebe dependências por construtor (nunca instancia um repositório Knex diretamente) e não referencia Elysia.
- Uma nova forma de persistência ou fila é uma nova implementação de uma interface existente em `application/ports/` ou `application/repositories/`, colocada em `infra/`.
- Erros de negócio são lançados como subclasses de `BaseError` em `domain/errors/`; o mapeamento para HTTP é responsabilidade exclusiva de `application/errors/http-error-mapper.ts` — nunca `set.status` direto num caso de uso.
- Toda mudança de estado que precisa disparar um efeito assíncrono (fila, notificação) usa o padrão outbox: persistir estado + evento na mesma transação, nunca side-effects "fire-and-forget" dentro do caso de uso.
