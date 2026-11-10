# Observabilidade local

A pilha de observabilidade é opcional e sobe junto com o ambiente:

```bash
OBSERVABILITY=1 ./ops/dev-up.sh   # ou: make up-obs
```

Além do que `dev-up.sh` já faz, a flag:

1. dá ao Compose acesso somente leitura ao cluster kind
   (`ops/observability/write-kubeconfig.sh`);
2. sobe o perfil `observability` do Compose: Alloy, Prometheus, Loki, Tempo,
   Grafana, kube-state-metrics e postgres-exporter;
3. liga o OpenTelemetry da API (`OTEL_SDK_DISABLED=false`);
4. reconstrói o frontend com o coletor do Faro
   (`VITE_FARO_URL=http://localhost:12347/collect`).

Grafana: <http://localhost:3002> (usuário e senha `admin`/`admin`, ou
`GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`). Os dashboards ficam na pasta
**Break It TaaS**.

A decisão por trás desse desenho está no
[ADR-009](../03-decisions/ADR-009-observability-collected-outside-cluster.md).

## De onde vem cada dado

| Fonte | Como chega | Destino |
| --- | --- | --- |
| API: requisições, latência, erros | `@adonisjs/otel` → OTLP/HTTP → Alloy | Prometheus (`http_server_request_duration_seconds_*`) |
| API: traces | `@adonisjs/otel` → OTLP/HTTP → Alloy | Tempo |
| Logs dos contêineres do Compose | Alloy lê o socket do Docker | Loki (`job="docker"`) |
| CPU, memória, disco e rede dos contêineres | cAdvisor embutido no Alloy | Prometheus (`container_*{name=~"breakit-.*"}`) |
| PostgreSQL | postgres-exporter | Prometheus (`pg_*`) |
| Estado dos Jobs e pods de runner | kube-state-metrics, pela API do cluster | Prometheus (`kube_job_*`, `kube_pod_*`) |
| CPU, memória e rede dos pods de runner | cAdvisor dos kubelets, pelo proxy do API server | Prometheus (`container_*{namespace="app"}`) |
| Logs dos pods de runner | `loki.source.kubernetes` no Alloy | Loki (`source="kubernetes"`) |
| Navegador: exceções, console, sessões, Web Vitals | Faro → `faro.receiver` no Alloy | Loki (`source="faro"`) |
| Outbox worker: despachos, ciclos, runtime do Node | `@adonisjs/otel` → OTLP/HTTP → Alloy | Prometheus (`breakit_outbox_*`, `nodejs_*`, `v8js_*`, `job="breakit-worker"`) |
| Outbox worker: traces | `@adonisjs/otel` → OTLP/HTTP → Alloy | Tempo (`service.name=breakit-worker`) |
| Outbox worker: logs | transport OTLP do pino → Alloy → endpoint OTLP do Loki | Loki (`service_name="breakit-worker"`) |
| Fila do outbox (eventos por status, idade do mais antigo) | consulta própria no postgres-exporter | Prometheus (`breakit_outbox_events`, `breakit_outbox_oldest_age_seconds`) |

## Dashboards

### Services Overview

- **Tráfego da API:** requisições no último minuto, req/s, 5xx no último
  minuto, taxa de erro (5xx), respostas 4xx e latência p95. Também traz séries
  por rota, por classe de status e percentis de latência.
- **Recursos dos contêineres:** CPU, memória (working set), disco (leitura e
  escrita) e rede de cada contêiner `breakit-*`.
- **PostgreSQL:** conexões por estado, transações por segundo e tamanho do
  banco.
- **Logs:** volume por nível, erros por serviço, linhas de erro e todos os logs.
  Uma linha da API com `trace_id` leva direto ao trace no Tempo.

### Test Runners

- **Contêineres de runner:** ativos e pendentes agora, e Jobs com sucesso ou
  falha no intervalo selecionado. Inclui pods por fase ao longo do tempo e a
  tabela dos Jobs ainda presentes no cluster.
- **Recursos:** CPU (com o limite somado), memória e rede por pod. Um runner
  preso no limite de CPU gera menos carga do que o configurado.
- **Logs:** volume por pod, erros e thresholds do k6 ultrapassados, e a saída
  completa dos runners.

Jobs são apagados 10 minutos depois de terminar. Por isso os totais de sucesso e
falha são calculados por Job ao longo do intervalo, e não a partir do estado
atual.

### Frontend

- **Uso e erros:** sessões, page views, exceções, porcentagem de sessões com
  erro, erros de console e erros de API (5xx ou sem resposta).
- **Core Web Vitals (p75):** LCP, INP, CLS, FCP e TTFB.
- **Tendências:** erros, sessões e Web Vitals ao longo do tempo, principais
  exceções, páginas com mais erros, sessões por navegador e páginas mais vistas.
- **Logs:** exceções com stack trace, erros de API, console e todos os eventos.

### Outbox Worker

- **Fila e atividade:** se o worker está no ar, eventos pendentes, idade do
  pendente mais antigo, eventos estacionados como `FAILED`, publicados e
  retentativas no intervalo. Também traz despachos por resultado, fila por
  status e duração do despacho (p50/p95).
- **Processo:** utilização do event loop (o mais perto de uso de CPU num
  processo Node), heap usado contra o limite e atraso do event loop.
- **Logs:** volume por nível, erros e avisos (retentativas e eventos
  estacionados, com o id e o tipo do evento) e todos os logs. O `trace_id` de
  cada linha leva ao span do despacho no Tempo.

A fila vem do PostgreSQL, então esses painéis continuam corretos com o worker
parado. A atividade vem do próprio worker.

### Logs Explorer

Todas as fontes de log (Compose, runners, navegador e worker) com filtro por
serviço e busca textual.

## Alertas

As regras do Prometheus ficam em `ops/observability/prometheus/rules/breakit.yml`.
`OutboxBacklogAging` usa a idade lida da tabela, e por isso dispara também com
o worker parado. `OutboxEventsFailing` usa os resultados reportados pelo
worker.

## Problemas comuns

- **Painéis de runner vazios:** confira se `ops/observability/.kube/config`
  existe (é gerado pelo `dev-up.sh` com a flag) e se os componentes
  `discovery.kubernetes` e `loki.source.kubernetes` aparecem saudáveis na UI do
  Alloy, em <http://localhost:12345>. Recriar o cluster gera um token novo, então
  rode `bash ops/observability/write-kubeconfig.sh` e reinicie o Alloy e o
  kube-state-metrics.
- **Frontend sem dados:** a URL do Faro é embutida no build. Reconstrua com
  `VITE_FARO_URL=http://localhost:12347/collect docker compose up -d --build frontend`.
- **Worker sem dados:** ele só exporta quando sobe com `OBSERVABILITY=1` (o
  `dev-up.sh` passa `OTEL_SDK_DISABLED=false` e
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`). Rodando à mão, exporte
  essas duas variáveis antes de `npm --workspace backend run worker:dev`.
- **Alloy reiniciando:** o limite de memória é 400M. O cAdvisor sozinho já
  estourava os 200M anteriores.
