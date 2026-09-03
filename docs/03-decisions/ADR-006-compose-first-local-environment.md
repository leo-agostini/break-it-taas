# ADR-006: Ambiente local via Docker Compose, cluster só para Jobs

## Status
Accepted

## Contexto

O ambiente local exigia implantar a aplicação inteira no cluster: API, worker,
banco, frontend e alvo de carga, com Ingress, RBAC, Secrets e manifests
próprios. Isso pedia dois modos de execução (`hybrid` e `full cluster`), um
controlador de Ingress instalado só para expor a API ao host, e um ciclo de
`build → load → apply → rollout` a cada alteração de código.

Nada disso é exigido pelo produto. A única parte que precisa de Kubernetes é o
despacho de Jobs de runner: `KubernetesTestRunQueue` cria objetos `batch/v1`, e
não existe implementação alternativa de fila. Todo o resto roda igualmente bem
em contêineres comuns.

## Decisão

O cluster local roda **apenas Jobs de runner**. Todo o resto sai dele:

- **Docker Compose** — API, frontend, PostgreSQL e o alvo de carga (a API sob
  teste).
- **Host** — o outbox worker, porque ele despacha Jobs e precisa do kubeconfig.
- **kind** — os Jobs de runner do k6, e nada mais.

`ops/dev-up.sh` é o ponto de entrada único: cria o cluster se necessário,
constrói e carrega a imagem do runner, sobe o Compose, espera a API responder e
então executa o worker em foreground.

Consequências diretas:

- Sem Ingress: nada é servido do cluster para o host, então o controlador
  ingress-nginx e os `extraPortMappings` foram removidos.
- Sem manifests de aplicação: `Deployment`/`Service`/`Ingress` do backend,
  `Deployment` do worker, RBAC do worker, ConfigMap e Secret de aplicação foram
  excluídos. Restam apenas namespaces e limites padrão.
- Pods de runner alcançam o host pelo gateway da rede `kind` (normalmente
  `172.18.0.1`), tanto para o callback quanto para o alvo de carga.
- Um único modo de execução, portanto um único comando de teste de integração.

## Tradeoffs

### Prós
- Um comando sobe tudo; o ciclo de alteração de código deixa de exigir
  `build → load → apply → rollout`.
- Muito menos superfície operacional: `ops/` caiu de 26 para 15 arquivos.
- O worker roda no host, onde é trivial anexar um debugger.

### Contras
- Não é mais possível validar a aplicação rodando dentro do cluster localmente.
  Manifests de implantação passam a ser responsabilidade do componente de
  infraestrutura separado, e divergências só aparecem lá.
- O tráfego do runner para o alvo de carga atravessa o gateway do Docker em vez
  de ser pod-a-pod. Isso adiciona um salto de NAT ao caminho medido: números de
  latência e vazão locais servem para detectar regressões grosseiras, não para
  medida absoluta.
- A verificação de saturação do alvo passou de `kubectl top pod` para
  `docker stats`, que amostra com menos granularidade.

## Referências

- [ADR-005](ADR-005-kind-over-k3d-for-local-cluster.md) — kind em vez de k3d para o cluster local
