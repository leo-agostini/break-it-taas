# Arquitetura do Frontend

> Este documento define a arquitetura **alvo** para o frontend (`frontend/src`), a ser seguida a partir de agora. Parte do que está descrito aqui já existe no código (`features/login`, `features/signup`); o restante (mappers, hooks, containers) é a extensão planejada dessa mesma estrutura, não uma reescrita.

## Princípios

- **Feature-based / vertical slice**: cada funcionalidade é uma fatia vertical autocontida em `src/features/<feature>/`, com sua própria camada de dados, estado e apresentação. Não existe uma camada horizontal global de "services" ou "state" compartilhada entre features.
- **SSR para a primeira carga, SWR para o resto**: o React Router 7 roda em modo SSR (`react-router.config.ts` tem `ssr: true`, mantido de propósito — ver seção "Autenticação e proteção de rota"). O `loader` de uma rota faz a primeira busca de dados no servidor (Node); depois da hidratação, a camada `hooks/` de cada feature usa SWR, semeado com o dado do `loader` via `fallbackData`, para revalidação e mutações no cliente. Nenhum componente busca dado direto do `api/` — só via `hooks/`. Ver "Padrão loader → SWR" abaixo.
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

## Padrão loader → SWR

Quando uma rota precisa de dado real (não só um guard de autenticação), o `loader` busca no servidor e o hook da feature reidrata esse dado no cliente sem refazer o fetch na hidratação:

```ts
// routes/test-cases.tsx
export async function loader({ request }: { request: Request }) {
  await requireServerAuth(request);
  const testCases = await fetchTestCasesServerSide(request); // via createServerPrivateHttpClient + mapper
  return { testCases };
}

export default function TestCasesRoute({ loaderData }: Route.ComponentProps) {
  return <TestCasesContainer initialData={loaderData.testCases} />;
}
```

```ts
// features/test-cases/hooks/use-test-cases.ts
export function useTestCases(initialData?: TestCase[]) {
  return useSWR('test-cases', fetchTestCases, { fallbackData: initialData });
}
```

Isso evita o "flash" de loading na primeira renderização (o HTML já chega com o dado) e mantém o SWR como única fonte de revalidação/mutação depois disso.

## Autenticação e proteção de rota

O backend e o frontend são publicados em domínios públicos independentes (não há um hostname único compartilhado por um ingress). A sessão continua baseada em cookies `httpOnly` (`access_token`/`refresh_token`), sem que o frontend precise implementar lógica própria de refresh/proxy de token — a decisão completa e o tradeoff aceito estão em [ADR-004](../03-decisions/ADR-004-cross-domain-httponly-cookie-auth.md).

Na prática:

- `src/lib/httpClient.ts` já configura `withCredentials: true` em todas as instâncias axios (cliente e servidor) — é só isso que uma chamada cross-domain com cookie precisa do lado do frontend.
- `src/lib/server-auth.ts` expõe `requireServerAuth(request)` e `redirectIfAuthenticated(request)` — o **middleware server-side** de proteção de rota. Cada um encaminha o header `Cookie` recebido do navegador para o backend via uma chamada Node-a-Node (`createServerPrivateHttpClient`/`createServerPublicHttpClient`/`createServerCheckHttpClient`), o que não sofre nenhuma restrição de CORS/SameSite — essas regras só existem para chamadas feitas pelo navegador.
- Toda rota protegida chama `requireServerAuth` no `loader`, como em `routes/home.tsx`; toda rota só-para-anônimo (`login`, `signup`) chama `redirectIfAuthenticated`. Esse `loader` roda de novo a cada navegação — inclusive navegação client-side, que o React Router SSR resolve fazendo uma requisição ao servidor — então a proteção não é um check único na primeira carga.
- Novas rotas protegidas seguem o mesmo padrão: chamar `requireServerAuth` (ou uma variante que também valide papel/permissão, se isso vier a ser necessário) no início do `loader`, antes de buscar qualquer dado.

## Convenções

- Nomes de arquivo em `kebab-case`, como já é o padrão do repositório (`login-form.tsx`, `login-schema.ts`).
- Um arquivo por hook/mapper/container — evitar "barrel" `index.ts` que reexporta tudo de uma feature; importar direto do arquivo final.
- Toda nova feature nasce com no mínimo `types/`, `api/`, `hooks/`, `components/`; `mappers/`, `containers/`, `schemas/` são adicionados quando a feature de fato precisa (uma tela somente leitura sem transformação pode não precisar de `mappers/`).
