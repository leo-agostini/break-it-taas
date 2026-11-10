# ADR-009: Observabilidade coletada de fora do cluster, Faro no frontend

## Status
Accepted

## Contexto

A pilha de observabilidade (Alloy, Prometheus, Loki, Tempo e Grafana, no perfil
`observability` do Compose) já existia, mas a maior parte dos painéis ficava
vazia:

- A API não emitia telemetria. A reescrita em AdonisJS removeu a
  instrumentação, e a regra `ApiHighErrorRate` consultava uma métrica que
  ninguém produzia.
- Nada do cluster kind era coletado. Não havia kube-state-metrics, nem leitura
  do cAdvisor dos kubelets, nem logs dos pods. Os painéis de Jobs de runner nunca
  mostraram dados.
- O frontend não tinha telemetria nenhuma.

O caminho usual no Kubernetes é instalar um agente dentro do cluster (DaemonSet
do Alloy, kube-state-metrics como Deployment) e empurrar os dados para fora.
Isso contraria o [ADR-006](ADR-006-compose-first-local-environment.md): o
cluster roda **apenas Jobs de runner**.

## Decisão

**Cluster: leitura de fora, pela API do Kubernetes.** O Alloy e o
kube-state-metrics rodam no Compose, entram na rede Docker `kind` e falam com o
API server em `<cluster>-control-plane:6443`. Eles se autenticam com o token de
uma ServiceAccount somente leitura (`telemetry-reader`, em
`ops/k8s/observability/telemetry-reader.yaml`).
`ops/observability/write-kubeconfig.sh` aplica a ServiceAccount e exporta o
token, a CA e um kubeconfig para `ops/observability/.kube/`, que é ignorado pelo
git. A partir disso:

- o kube-state-metrics observa Jobs e pods do namespace `app`, e daí saem os
  estados ativo, pendente, sucesso e falha;
- o Alloy lê o cAdvisor de cada nó pelo proxy do API server
  (`/api/v1/nodes/<nó>/proxy/metrics/cadvisor`) e guarda só as séries do
  namespace `app`;
- o Alloy acompanha os logs dos pods de runner pela API (`loki.source.kubernetes`).

No cluster entram apenas objetos RBAC. Nenhum processo novo roda lá.

**API: `@adonisjs/otel`.** Traces e métricas vão por OTLP/HTTP para o Alloy, que
envia os traces ao Tempo e as métricas ao Prometheus. As convenções semânticas
estáveis de HTTP (`http.server.request.duration`) são fixadas em
`backend/config/otel.ts`. Logs não são exportados por OTLP, porque o Alloy já lê o
stdout do contêiner. Em vez disso, a instrumentação do pino grava
`trace_id`/`span_id` em cada linha, e isso permite ir de um log ao seu trace no
Grafana.

**Outbox worker: o mesmo SDK, iniciado só para `outbox:work`.** O worker roda
no host, então ninguém lê o stdout dele. Ele exporta traces, métricas e também
logs:

- **Traces:** um span por evento despachado, com as queries e a chamada à API
  do Kubernetes como filhos.
- **Métricas:** resultado de cada despacho (`published`, `retried`, `failed`),
  duração e ciclos de polling.
- **Logs:** via o transport OTLP do pino, com `trace_id` no registro. Eles
  chegam ao Loki pelo endpoint OTLP nativo, com `service_name="breakit-worker"`.

O SDK é iniciado em `bin/console.ts` por `OtelManager`, sem o hook ESM do
import-in-the-middle. Qualquer registro desse hook esvazia os exports dos
módulos TypeScript servidos pelo ts-exec, e o ace deixa de carregar os
comandos.

O tamanho e a idade da fila **não** vêm do worker. O postgres-exporter lê esses
números direto da tabela `outbox_events`
(`ops/observability/postgres-exporter/queries.yaml`). Assim o alerta
`OutboxBacklogAging` dispara justamente quando o worker está parado.

**Frontend: Grafana Faro.** O SDK `@grafana/faro-react` envia exceções, console,
sessões, navegações e Core Web Vitals ao `faro.receiver` do Alloy, que grava
tudo no Loki. O dashboard calcula seus números com LogQL. Os erros que o React
Router captura (no `ErrorBoundary` da raiz) e as chamadas de API com 5xx ou sem
resposta são reportados à mão.

**Opt-in.** Tudo isso só liga com `OBSERVABILITY=1 ./ops/dev-up.sh` (ou
`make up-obs`). Sem a flag, o SDK da API fica desligado
(`OTEL_SDK_DISABLED=true`) e o frontend é construído sem URL do Faro.

## Tradeoffs

### Prós
- O ADR-006 continua valendo: o cluster segue rodando só Jobs de runner.
- Um único coletor (Alloy) para tudo, com uma única configuração versionada.
- A ServiceAccount só lê. O token não acessa Secrets nem altera nada.
- O Faro já traz sessões, Web Vitals e navegação prontos. Com o SDK de
  OpenTelemetry para browser, tudo isso teria de ser construído à mão.

### Contras
- Logs de runner dependem de o Alloy estar rodando enquanto o pod existe. Os
  pods são apagados 10 minutos depois do fim do Job
  (`ttlSecondsAfterFinished`), e o que não foi lido até lá se perde.
- Contagens de Jobs com sucesso ou falha vêm do kube-state-metrics, que só
  enxerga Jobs ainda presentes. O dashboard conta por Job ao longo do intervalo
  (`max_over_time`), e isso só funciona se a coleta estava ativa quando o Job
  existia.
- O worker não tem métricas de CPU e memória do processo, só as do runtime do
  Node (utilização do event loop e heap do V8). Ele não é um contêiner, então o
  cAdvisor não o enxerga.
- A fila é lida com `--extend.query-path` do postgres-exporter, que o projeto
  marca como obsoleto, embora ainda o suporte na v0.20.
- Ler o cAdvisor pelo proxy do API server põe carga no API server. Isso é
  aceitável num kind local, mas em produção seria preciso ler os kubelets
  diretamente.
- O endereço `<cluster>-control-plane:6443` é específico do kind. Um cluster
  gerenciado exigiria outro kubeconfig e provavelmente um agente dentro do
  cluster.

## Referências

- [ADR-006](ADR-006-compose-first-local-environment.md): ambiente local via
  Docker Compose, cluster só para Jobs
- [`docs/05-operations/observability.md`](../05-operations/observability.md):
  como ligar e o que cada dashboard mostra
