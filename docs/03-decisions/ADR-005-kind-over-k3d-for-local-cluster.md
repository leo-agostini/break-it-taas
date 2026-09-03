# ADR-005: kind em vez de k3d para o cluster local

## Status
Accepted — parcialmente superado por
[ADR-006](ADR-006-compose-first-local-environment.md), que tirou a aplicação do
cluster. A escolha de kind sobre k3d continua válida; o controlador de Ingress
descrito abaixo foi removido junto com os manifests de aplicação.

## Contexto

O laboratório local usava k3d (k3s dentro do Docker). O k3s é uma distribuição
enxuta: troca etcd por SQLite, remove cloud providers in-tree e recursos alpha,
e já embute Traefik, um load balancer simulado e storage local-path.

Isso torna o k3d rápido de subir, mas o comportamento diverge do Kubernetes
upstream justamente nos pontos que o Break It TaaS exercita: agendamento de
Jobs de runner, Ingress e admissão. Um Job que agenda no k3d não é evidência
forte de que agendará em um cluster gerenciado.

O kind executa Kubernetes upstream via kubeadm — os mesmos componentes de um
cluster gerenciado — e é o que o próprio projeto Kubernetes usa em testes de
conformidade.

## Decisão

Adotar kind como o cluster local padrão, com nome fixo `taas-dev` e contexto
`kind-taas-dev`, criados por `ops/kind/bootstrap-workload.sh` (`make cluster-up`).

Consequências diretas da troca:

- O kind **não** embute controlador de Ingress nem load balancer. Isso exigiu
  instalar ingress-nginx no bootstrap enquanto a API rodava no cluster; com o
  ADR-006 nada mais é servido do cluster para o host e a instalação foi
  removida.
- Imagens locais entram no cluster com `kind load docker-image`, não
  `k3d image import`.
- O endereço de callback do runner muda: o kind cria a própria rede Docker
  (`kind`, normalmente `172.18.0.0/16`), então o gateway da bridge padrão
  (`172.17.0.1`) não vale mais. Use `ops/kind/probe-callback.sh` para validar.
- O laboratório Rancher foi removido: dependia de importar clusters k3d.

## Tradeoffs

### Prós
- Fidelidade ao Kubernetes upstream: o que agenda localmente agenda em cluster
  gerenciado, incluindo `runtimeClassName` e `nodeSelector`.
- Mesmo template de Job para local e gerenciado, trocando apenas configuração
  de ambiente (`RUNNER_RUNTIME_CLASS`, `RUNNER_NODE_SELECTOR`).
- Contexto de kubectl explícito e verificado, em vez do current-context ambiente.

### Contras
- Bootstrap mais lento e com mais passos: o Ingress deixa de ser automático.
- O k3d continua sendo mais rápido para iteração diária; quem não precisa de
  fidelidade de agendamento perde um pouco de velocidade.
- **NetworkPolicy não é aplicada localmente.** O CNI padrão do kind (kindnetd)
  aceita objetos `NetworkPolicy` mas não os impõe. Isolamento de rede não pode
  ser validado neste cluster; exigiria trocar o CNI por Calico
  (`disableDefaultCNI: true`), o que não foi feito por não haver hoje nenhuma
  `NetworkPolicy` no repositório.

## Referências

- kind — Ingress ([kind.sigs.k8s.io/docs/user/ingress](https://kind.sigs.k8s.io/docs/user/ingress/))
- kind — Loading an Image Into Your Cluster
- k3s — What's the difference between k3s and Kubernetes
