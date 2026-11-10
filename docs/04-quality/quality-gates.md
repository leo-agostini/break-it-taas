# Quality Gates (atual)

## Repositório local (Husky)

- `pre-commit`
  - `npm run lint`
  - `npm run typecheck`
- `commit-msg`
  - `commitlint`

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

Jobs:

1. `lint-and-typecheck`
   - Node 24 (`.nvmrc`)
   - install dependencies (`npm ci`)
   - lint
   - typecheck
   - build
2. `commitlint`
   - valida mensagens de commit no intervalo do PR

## Observação importante

Neste momento, o gate de testes automatizados não está habilitado no CI por decisão do autor, pois a etapa de modelagem de domínio ainda está em evolução. Localmente, `npm --workspace backend run test` executa as suítes `unit` (sem banco) e `functional` (Postgres do Compose, banco `app_test`).
