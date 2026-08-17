# Arquitetura do Frontend

> Este documento define a arquitetura **alvo** para o frontend (`frontend/src`), a ser seguida a partir de agora. Parte do que está descrito aqui já existe no código (`features/login`, `features/signup`); o restante (mappers, hooks, containers) é a extensão planejada dessa mesma estrutura, não uma reescrita.

## Princípios

- **Feature-based / vertical slice**: cada funcionalidade é uma fatia vertical autocontida em `src/features/<feature>/`, com sua própria camada de dados, estado e apresentação. Não existe uma camada horizontal global de "services" ou "state" compartilhada entre features.
- **Client-side only (SPA)**: não há renderização no servidor. Toda busca de dados acontece no navegador via SWR, contra a API do backend. Rotas do React Router funcionam apenas como composition root (URL → container), sem `loader`/`action` server-side.

  > **Ação pendente**: `frontend/react-router.config.ts` está hoje com `ssr: true` e existe `src/entry.server.tsx`. Para alinhar com esta decisão, o projeto deve migrar para `ssr: false` (modo SPA do React Router 7) e remover `entry.server.tsx`. Isso não foi alterado neste documento — é um item de ação separado.
- **Dependência sempre de cima para baixo, nunca circular**: dentro de uma feature, cada camada só pode importar da camada imediatamente abaixo dela. Uma camada nunca importa de quem a chama. Ver seção "Regra de dependência".
- **Componentes específicos de uma feature moram dentro da feature.** Só sobe para `src/components/` o que é genuinamente compartilhado por 2+ features (primitivos de UI, ex. `components/ui/*` no padrão shadcn).

## Stack de dados

- **HTTP**: Axios (`src/lib/httpClient.ts`), client instance compartilhada.
- **Data fetching**: SWR, um hook por operação de leitura. Nenhum componente chama `api/` diretamente.
- **Formulários**: `react-hook-form` + `zod` (`schemas/`), como já usado em `features/login` e `features/signup`.
- **Estado global de cliente**: Recoil, para estado que precisa ser compartilhado entre features ou sobreviver a navegação (ex. sessão do usuário autenticado, preferências de UI). Estado remoto (dados vindos da API) **não** é duplicado em átomos Recoil — a fonte de verdade dos dados remotos é o cache do SWR; Recoil guarda apenas estado de cliente genuíno.
- **Estado local/efêmero de UI** (campo aberto, tab ativa, etc.): `useState` dentro do container ou do componente de apresentação, sem subir para Recoil.

## Estrutura de uma feature

```
src/features/<feature>/
  types/          # tipos de domínio da feature (o que o resto da feature consome)
  api/            # chamadas HTTP cruas (axios); tipos de request/response remotos (DTOs)
  mappers/        # tradução DTO remoto -> tipo de domínio da feature
  hooks/          # hooks SWR: chamam api/ + mappers/, expõem dados já em formato de domínio
  containers/     # orquestram hooks + estado (Recoil/local) + handlers; sem JSX de apresentação "burro"
  components/     # componentes de apresentação (presentational/"burros"): recebem props, sem fetch
  schemas/        # validação de formulário (zod), quando a feature tem forms
```

Exemplo com a feature `login` (parte já existe, mappers/hooks/containers são a extensão):

```
features/login/
  types/login.ts            # LoginRequest, LoginResponse (domínio) — já existe
  api/login.ts               # login(payload) via axios — já existe, hoje retorna o shape remoto direto
  mappers/login-mapper.ts    # toLoginResult(remote: LoginResponseDTO): LoginResult
  hooks/use-login.ts         # hook (mutation via SWR) que chama api + mapper
  containers/login-container.tsx  # usa use-login, decide navegação/toast, injeta props no form
  components/login-form.tsx  # já existe — puramente apresentacional
  components/login-page.tsx  # já existe — layout/composição visual
  schemas/login-schema.ts    # já existe — validação do formulário
```

### Papel de cada camada

- **`types/`** — tipos de domínio, moldados para o que a UI precisa, independentes do formato exato que o backend devolve.
- **`api/`** — só I/O: chama o backend com Axios e retorna o dado **no shape remoto** (DTO), sem transformação. Não conhece Recoil, SWR ou React.
- **`mappers/`** — funções puras `remote -> domain`. É o único lugar onde um DTO remoto é conhecido fora de `api/`. Se o backend mudar um nome de campo, o conserto fica isolado aqui.
- **`hooks/`** — usam SWR (`useSWR`/`useSWRMutation`) chamando `api/` e passando o resultado pelo `mapper` antes de retornar. Expõem `{ data, error, isLoading }` já tipados como domínio. É a única camada que conhece SWR.
- **`containers/`** — componentes React "inteligentes": consomem `hooks/` e, quando necessário, átomos/seletores Recoil; concentram handlers de evento e decisões (navegar, mostrar toast, abrir modal); passam dados prontos como props para `components/`. Não têm HTML/estilo de apresentação além de composição estrutural mínima.
- **`components/`** — componentes de apresentação: recebem props, renderizam UI, disparam callbacks recebidos por prop. Não fazem fetch, não importam hooks de dados, não conhecem Recoil.

## Regra de dependência

Dentro de uma feature, o fluxo de import é estritamente de cima para baixo:

```
types  →  api  →  mappers  →  hooks  →  containers  →  components (presentation)
```

- `api/` pode importar de `types/`, nunca de `mappers/`, `hooks/`, `containers/` ou `components/`.
- `mappers/` pode importar de `types/` e `api/` (para tipar o DTO de entrada), nunca de cima.
- `hooks/` pode importar de `mappers/` e `api/`, nunca de `containers/`/`components/`.
- `components/` (presentation) **não importa nada de dado** — só props, `components/ui/*` compartilhado e `lib/utils`.

Entre camadas do app (fora da feature):

```
lib/  →  components/ui (shared)  →  features/*  →  routes/
```

- `lib/` (httpClient, utils) não depende de nada do app — é a base.
- `components/ui/*` (primitivos compartilhados, estilo shadcn) pode depender de `lib/`, nunca de `features/*`.
- `features/*` pode depender de `lib/` e `components/ui/*`, nunca o contrário.
- `routes/` importa `containers/` das features e monta a página; features nunca importam de `routes/`.
- **Uma feature nunca importa de outra feature diretamente.** Se duas features precisam compartilhar algo, esse algo sobe para `lib/` ou `components/ui/`, nunca vira um import cruzado `features/a` → `features/b`.

Essa regra existe para impedir dependência circular: como cada seta aponta em uma única direção, é estruturalmente impossível ter um ciclo entre `lib/`, `components/ui/`, `features/*` e `routes/`, e o mesmo vale para as camadas dentro de uma feature.

## Autenticação e estado de sessão

Hoje o cookie de sessão é lido no servidor (`src/lib/server-auth.ts`), o que só faz sentido em SSR. Ao migrar para SPA (`ssr: false`), a verificação de sessão passa a ser client-side: um hook (`hooks/use-session.ts`, sugerido em uma feature `auth` ou `session`) chama `GET /api/auth/check` via SWR e expõe o resultado por um átomo Recoil, para que rotas protegidas possam redirecionar no cliente.

## Convenções

- Nomes de arquivo em `kebab-case`, como já é o padrão do repositório (`login-form.tsx`, `login-schema.ts`).
- Um arquivo por hook/mapper/container — evitar "barrel" `index.ts` que reexporta tudo de uma feature; importar direto do arquivo final.
- Toda nova feature nasce com no mínimo `types/`, `api/`, `hooks/`, `components/`; `mappers/`, `containers/`, `schemas/` são adicionados quando a feature de fato precisa (uma tela somente leitura sem transformação pode não precisar de `mappers/`).
