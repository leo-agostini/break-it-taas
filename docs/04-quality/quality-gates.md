# Quality Gates (atual)

## Repositório local (Husky)

- `pre-commit`
  - `bun run lint`
  - `bun run typecheck`
- `commit-msg`
  - `commitlint`

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

Jobs:

1. `lint-and-typecheck`
   - install dependencies
   - lint
   - typecheck
   - build
2. `commitlint`
   - valida mensagens de commit no intervalo do PR

## Observação importante

Neste momento, o gate de testes automatizados não está habilitado por decisão do autor, pois a etapa de modelagem de domínio ainda está em evolução.
