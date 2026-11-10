# CLAUDE.md

This file guides Claude Code (and other AI agents reading this repo) when working in **Break It TaaS**.

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
- `./ops/dev-up.sh` (or `make up`) — start the whole environment and run the worker; `OBSERVABILITY=1` (or `make up-obs`) adds Grafana on :3002 plus API/browser telemetry (see [ADR-009](docs/03-decisions/ADR-009-observability-collected-outside-cluster.md))
- `./ops/dev-down.sh` (or `make down`) — stop it; `--cluster` also deletes the cluster
- `npm run smoke` — end-to-end check, requires `dev-up.sh` running
- `npm run dev` — run backend + frontend in parallel (turbo)
- `npm run lint` / `npm run format` / `npm run typecheck` — across all workspaces (biome + tsc)
- `npm --workspace backend run test` — backend `unit` (no DB) and `functional` (Postgres `app_test`) Japa suites; `test:unit` runs only the former
- `npm --workspace backend run worker:dev` — run the outbox worker (`node ace outbox:work`); the backend needs Node 24 (`nvm use`)
- `npm --workspace backend run migrate:latest` — run DB migrations
- `npm --workspace frontend run typecheck` — includes `react-router typegen`

## Skills

This repo ships project skills in [.claude/skills/](.claude/skills/) (one directory per skill, each with a `SKILL.md`) and mirrors them for Codex in [.agents/skills/](.agents/skills/) — keep both copies in sync. Claude Code auto-discovers `.claude/skills/*/SKILL.md` — invoke the matching skill via the `Skill` tool instead of improvising a workflow when a task matches one of these:

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

Defined in [.claude/agents/](.claude/agents/), mirrored for Codex in [.codex/agents/](.codex/agents/):

- `code-reviewer` — correctness, readability, architecture, security, performance review before merge.
- `security-auditor` — vulnerability detection, threat modeling, hardening.
- `test-engineer` — test strategy, test writing, coverage analysis.

These are personas invoked by the user or by a slash command; they don't invoke each other. The one multi-agent pattern in this repo is parallel fan-out with a merge step (e.g. running the three agents above concurrently and synthesizing their reports) — don't build a "router" persona that decides which other persona to call.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
rtk uv run <cmd>        # Compact uv project command output
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->