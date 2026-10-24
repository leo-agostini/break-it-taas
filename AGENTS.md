# AGENTS.md

This file guides Codex (and other AI agents reading this repo) when working in **Break It TaaS**.

## Repository overview

Break It TaaS is a test-as-a-service application for defining load test cases, dispatching Kubernetes runner jobs, hitting a target API, and collecting signed runner callbacks/results. It's an npm workspace:

- `backend/` — AdonisJS v7 (Node 24) API and outbox worker, a modular monolith in MVC style: `app/modules/<module>/` with controllers, Lucid models, services, Vine validators, and a framework-free `domain/` core. See [docs/02-architecture/backend-architecture.md](docs/02-architecture/backend-architecture.md) and [ADR-007](docs/03-decisions/ADR-007-adonis-modular-monolith.md).
- `frontend/` — React 19 + React Router 7 + Vite, feature-based/vertical-slice architecture, SWR + Jotai, client-side only. See [docs/02-architecture/frontend-architecture.md](docs/02-architecture/frontend-architecture.md).
- `ops/` — local environment scripts. `./ops/dev-up.sh` (or `make up`) is the single entrypoint: it creates the kind cluster `taas-dev` (context `kind-taas-dev`), builds and loads the k6 runner image, brings up the Docker Compose stack, and runs the outbox worker on the host.
- `docs/` — formal documentation trail (context, product, architecture, decisions, quality, operations). See [docs/README.md](docs/README.md) for the index. Most docs are written in Portuguese (this is an academic project deliverable) — keep new entries in `docs/00-context` through `docs/05-operations` in Portuguese to stay consistent.

Read the two architecture documents above before making non-trivial changes to either app — they describe the module boundaries and the dependency-direction rules (no cycles; backend `domain/` folders never import the framework) that both codebases must follow.

## Where things run

The cluster runs **only** k6 runner Jobs. Everything else is outside it:

- Docker Compose — API, frontend, PostgreSQL, and the load target (the API under test)
- your host — the outbox worker, because it dispatches Kubernetes Jobs and needs a kubeconfig
- kind cluster `taas-dev` — runner Jobs, namespace `app`

Runner pods reach the host through the kind network gateway (usually `172.18.0.1`),
never `localhost`. See [ADR-006](docs/03-decisions/ADR-006-compose-first-local-environment.md).

## Commands

Run from the repo root unless noted:

- `npm install` — install all workspaces
- `./ops/dev-up.sh` (or `make up`) — start the whole environment and run the worker
- `./ops/dev-down.sh` (or `make down`) — stop it; `--cluster` also deletes the cluster
- `npm run smoke` — end-to-end check, requires `dev-up.sh` running
- `npm run dev` — run backend + frontend in parallel (turbo)
- `npm run lint` / `npm run format` / `npm run typecheck` — across all workspaces (biome + tsc)
- `npm --workspace backend run test` — backend `unit` (no DB) and `functional` (Postgres `app_test`) Japa suites; `test:unit` runs only the former
- `npm --workspace backend run worker:dev` — run the outbox worker (`node ace outbox:work`); the backend needs Node 24 (`nvm use`)
- `npm --workspace backend run migrate:latest` — run DB migrations
- `npm --workspace frontend run typecheck` — includes `react-router typegen`

## Skills

This repo ships project skills in [.Codex/skills/](.Codex/skills/) (one directory per skill, each with a `SKILL.md`) and mirrors them for OpenCode in `.opencode/skills/`. Codex auto-discovers `.Codex/skills/*/SKILL.md` — invoke the matching skill via the `Skill` tool instead of improvising a workflow when a task matches one of these:

| Situation | Skill |
|---|---|
| New feature or significant change, requirements unclear | `spec-driven-development` |
| Have a spec, need to break it into tasks | `planning-and-task-breakdown` |
| Implementing logic, fixing a bug, changing behavior | `test-driven-development` |
| Touching more than one file, or a change feels too big for one step | `incremental-implementation` |
| Building with a framework/library where correctness matters | `source-driven-development` |
| Bug, failed test, build break, unexpected behavior | `debugging-and-error-recovery` |
| Designing a REST endpoint, module boundary, or FE/BE contract | `api-and-interface-design` |
| Building or modifying UI | `frontend-ui-engineering` |
| Anything running in a browser that needs live inspection | `browser-testing-with-devtools` |
| Handling user input, auth, storage, or external integrations | `security-and-hardening` |
| Before merging any change | `code-review-and-quality` |
| Refactoring for clarity without changing behavior | `code-simplification` |
| Removing old code/APIs or migrating between implementations | `deprecation-and-migration` |
| Architectural decisions, public API changes, shipping a feature | `documentation-and-adrs` |
| Committing, branching, resolving conflicts, parallel work streams | `git-workflow-and-versioning` |
| Setting up or changing CI/CD pipelines | `ci-cd-and-automation` |
| Performance requirements or regressions | `performance-optimization` |
| Preparing a production deploy | `shipping-and-launch` |
| Starting a session, or unsure which skill applies | `using-agent-skills` |
| Divergent/convergent idea refinement | `idea-refine` |
| Configuring context/rules files for a project | `context-engineering` |

Do not partially apply a skill's workflow — follow it through, or skip it if it genuinely doesn't fit (don't invoke one just because a task is small).

## Subagents

Defined in [.Codex/agents/](.Codex/agents/), mirrored for OpenCode in `.opencode/agents/`:

- `code-reviewer` — correctness, readability, architecture, security, performance review before merge.
- `security-auditor` — vulnerability detection, threat modeling, hardening.
- `test-engineer` — test strategy, test writing, coverage analysis.

These are personas invoked by the user or by a slash command; they don't invoke each other. The one multi-agent pattern in this repo is parallel fan-out with a merge step (e.g. running the three agents above concurrently and synthesizing their reports) — don't build a "router" persona that decides which other persona to call.

## AI-facing resources

- [docs/ai/prompts/](docs/ai/prompts/) — reusable prompts for external AI tools (architecture/sequence diagram generation, v0 frontend scaffolding). These are inputs to *other* tools, not instructions for Codex.
