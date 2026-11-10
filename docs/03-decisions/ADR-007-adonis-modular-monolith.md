# ADR-007: Backend como monólito modular MVC em AdonisJS, com núcleo de domínio isolado

## Status
Accepted

## Data
2026-10-24

## Contexto

O backend era uma aplicação Bun + Elysia organizada em Clean Architecture
estrita (`domain/` → `application/` → `infra/`): 12 casos de uso com um único
`execute()`, 6 interfaces de repositório com implementações Knex, uma porta
`UnitOfWork`, repositórios in-memory para teste e um container de DI escrito à
mão (`infra/http/container.ts`).

Essa estrutura cobrava um custo alto para o tamanho do sistema: cada operação
atravessava controller → caso de uso → interface de repositório → implementação
Knex → mapeamento linha↔entidade, e quase tudo que um framework web resolve
(validação, autenticação, sessão, CORS, migrations, comandos de CLI, runner de
testes) era código próprio. O objetivo da mudança é um backend com convenções
de framework (MVC), organizado por módulo de negócio, **sem perder** as regras
de domínio que de fato importam e que hoje são testáveis sem banco.

## Decisão

1. **Framework: AdonisJS v7 sobre Node.js 24.** Adonis oferece, de forma
   integrada, o que antes era código próprio: Lucid (ORM sobre Knex),
   VineJS (validação), `@adonisjs/auth` + `@adonisjs/session`, CORS, Ace
   (comandos) e Japa (testes). Adonis só suporta Node oficialmente, então o
   backend sai do Bun; a v7 exige Node ≥ 24 (`.nvmrc` na raiz).

2. **Monólito modular.** O código vive em `backend/app/modules/<módulo>/`, cada
   módulo com seus próprios `controllers/`, `models/`, `services/`,
   `validators/`, `presenters/`, `routes.ts` e `domain/`:

   | Módulo         | Responsabilidade                                                                  |
   |----------------|-----------------------------------------------------------------------------------|
   | `shared`       | erros de domínio, tipos comuns, mapeamento erro→HTTP, health                       |
   | `identity`     | usuários, organizações, login/sessão                                              |
   | `load_testing` | test cases, test runs, resultados, métricas e callback do runner                  |
   | `runner`       | adaptador Kubernetes (Job, scheduling, assinatura HMAC); expõe a porta `TestRunQueue` |
   | `outbox`       | outbox transacional: enfileirar, reivindicar, reprocessar com backoff             |

   Grafo de dependências (sem ciclos): `identity → shared`,
   `load_testing → outbox, runner, shared`, `outbox → shared`,
   `runner → shared`. O comando `outbox:work` é a raiz de composição que liga o
   tipo de evento `test-run.requested` ao serviço de `load_testing` — assim o
   `outbox` não depende de quem consome seus eventos.

3. **Test cases e test runs no mesmo módulo.** Foram planejados como módulos
   separados, mas um dependeria do outro nos dois sentidos: listar test cases
   exige a contagem de runs, criar um test case já enfileira o primeiro run na
   mesma transação, e criar um run exige verificar a posse do test case. São um
   único contexto delimitado (`load_testing`).

4. **Lucid no lugar dos repositórios.** As interfaces de repositório, a porta
   `UnitOfWork` e os repositórios in-memory foram removidos. Serviços usam os
   models Lucid diretamente e transações via `db.transaction()`; o outbox
   continua sendo gravado na mesma transação da mudança de estado (ADR-001).

5. **Núcleo de domínio puro preservado.** Cada `modules/*/domain/` é TypeScript
   sem `@adonisjs/*`, sem models e sem I/O:
   - value objects e políticas de carga (`LoadProfile`, presets, compatibilidade
     tipo↔modo, BREAKPOINT, timeout × duração) — ADR-002 continua valendo;
   - `buildTestCaseDefinition`, que concentra as regras entre campos que antes
     estavam no caso de uso de criação;
   - o ciclo de vida do `TestRun` como transições puras
     (`queueTransition`/`startTransition`/`completeTransition`), aplicadas pelos
     métodos do model;
   - a política de retry/backoff do outbox e a projeção de métricas do k6;
   - a política de senha e as invariantes de perfil de usuário.

   Esses arquivos continuam com testes unitários que rodam sem banco
   (`tests/unit`).

6. **Validação em duas camadas.** VineJS valida a estrutura da requisição
   (tipos, faixas, variantes de união); regras que envolvem vários campos ficam
   no domínio. O contrato HTTP (rotas e corpos de resposta) foi mantido; os
   `presenters/` montam as respostas campo a campo para não depender da
   estratégia de serialização do Lucid.

## Alternativas consideradas

### Manter repositórios sobre Lucid
- Prós: preserva a inversão de dependência e os testes in-memory.
- Contras: mantém exatamente a cerimônia que motivou a mudança, agora sobre um
  ORM que já resolve persistência.
- Rejeitada: o valor testável está nas regras de domínio, que continuam puras.

### Mover as regras de domínio para models e services
- Prós: o MVC "clássico" mais simples.
- Contras: regras como compatibilidade de carga e ciclo de vida do run passam a
  exigir banco para serem testadas e se misturam com persistência.
- Rejeitada: perderia o isolamento que o ADR-002 protege.

### AdonisJS sobre Bun
- Rejeitada: não suportado; Ace, o assembler/HMR e o Japa têm problemas
  conhecidos fora do Node.

## Consequências

- Os testes funcionais (`tests/functional`) usam o Postgres real num banco
  `*_test` separado (`.env.test`); os unitários não precisam de banco.
- O worker de outbox passa a ser o comando `node ace outbox:work`; continua
  rodando no host pelos motivos do ADR-006.
- O schema do banco não mudou: as migrations Lucid são portas 1:1 das Knex
  (verificado com `pg_dump --schema-only`). Bancos já migrados pelo Knex são
  adotados por `node ace db:adopt-knex`, executado automaticamente pelo serviço
  `migrate` do Compose. Esse comando foi removido depois: um banco migrado só
  pelo Knex e nunca adotado precisa ser recriado.
- `GET /docs` (Swagger do Elysia) deixou de existir; Adonis não tem gerador
  OpenAPI oficial. Reintroduzir documentação OpenAPI é trabalho futuro.
- A regra `useImportType` do Biome está desligada no backend: converter imports
  de classes injetadas em `import type` apaga os metadados de decorator que a DI
  do Adonis usa.
