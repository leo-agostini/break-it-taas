# Documentação do Projeto

Esta pasta organiza a base documental do trabalho final:

- `00-context/` — problema e contexto
- `01-product/` — requisitos funcionais e não funcionais
- `02-architecture/` — fronteiras, visão arquitetural e arquitetura de frontend/backend
- `03-decisions/` — ADRs e tradeoffs
- `04-quality/` — rastreabilidade e qualidade
- `05-operations/` — operação local, cluster kind e guias de Kubernetes/k6
- `ai/prompts/` — prompts reutilizáveis para ferramentas de IA (diagramas, geração de UI)

Arquivo-base de requisitos fornecido pelo autor: `01-product/requirements-catalog.md`.

Os documentos foram iniciados apenas com conhecimento já consolidado no projeto atual.

## Documentos de arquitetura

- [`02-architecture/domain-boundaries.md`](02-architecture/domain-boundaries.md) — fronteira entre domínio e HTTP
- [`02-architecture/backend-architecture.md`](02-architecture/backend-architecture.md) — Clean Architecture do backend (domain/application/infra)
- [`02-architecture/frontend-architecture.md`](02-architecture/frontend-architecture.md) — arquitetura feature-based/vertical slice do frontend
- [`02-architecture/hmac-explained.md`](02-architecture/hmac-explained.md) — HMAC aplicado ao callback do runner

## Decisões (ADRs)

- [`03-decisions/ADR-001-transactional-outbox.md`](03-decisions/ADR-001-transactional-outbox.md) — outbox transacional para despacho de `TestRun`
- [`03-decisions/ADR-002-domain-model-independent-from-k6.md`](03-decisions/ADR-002-domain-model-independent-from-k6.md) — modelo de domínio independente de k6
- [`03-decisions/ADR-003-error-boundary-and-http-mapping.md`](03-decisions/ADR-003-error-boundary-and-http-mapping.md) — fronteira de erros entre domínio e HTTP
- [`03-decisions/ADR-004-cross-domain-httponly-cookie-auth.md`](03-decisions/ADR-004-cross-domain-httponly-cookie-auth.md) — autenticação com cookies httpOnly entre domínios públicos independentes
- [`03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md`](03-decisions/ADR-005-kind-over-k3d-for-local-cluster.md) — kind em vez de k3d para o cluster local
- [`03-decisions/ADR-006-compose-first-local-environment.md`](03-decisions/ADR-006-compose-first-local-environment.md) — ambiente local via Docker Compose, cluster só para Jobs

## Documentação específica de módulo

Documentos que ficam colocados junto ao código a que se referem (não duplicados aqui):

- [`backend/docs/outbox-worker-spec.md`](../backend/docs/outbox-worker-spec.md) — spec do worker do outbox

## Recursos de IA

Instruções para agentes de IA (Claude Code, etc.) estão no [`CLAUDE.md`](../CLAUDE.md) da raiz do repositório, que referencia as skills em [`.claude/skills/`](../.claude/skills/).
