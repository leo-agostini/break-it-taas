# K3D + Rancher Lab (Fases 1 a 5)

Este guia implementa o plano ate a fase 5:

1. Conectividade estavel Rancher <-> cluster importado
2. Bootstrap repetivel dos clusters
3. Namespaces e limites base
4. Postgres em StatefulSet
5. Backup e restore drill

## Pre-requisitos

- Docker
- kubectl
- helm
- k3d

## Fase 1 e 2: bootstrap de management + workload

1) Tornar scripts executaveis:

```bash
chmod +x ops/k3d/bootstrap-mgmt.sh ops/k3d/bootstrap-workload.sh ops/k8s/apply-phase-3-5.sh
```

2) Subir cluster de management com Rancher:

```bash
./ops/k3d/bootstrap-mgmt.sh
```

3) Abrir Rancher no URL exibido pelo script e fazer login com `admin`.

4) Em Rancher, criar `Import Existing` e copiar o manifest URL.

5) Exportar URL e importar cluster workload:

```bash
export RANCHER_IMPORT_URL='https://rancher.<ip>.sslip.io/v3/import/<token>.yaml'
./ops/k3d/bootstrap-workload.sh
```

Validacao:

```bash
kubectl --context k3d-workload -n cattle-system get pods
kubectl --context k3d-workload -n cattle-system logs deploy/cattle-cluster-agent --tail=60
```

## Fase 3 a 5: base, Postgres, backup e restore

Executar:

```bash
./ops/k8s/apply-phase-3-5.sh
```

Esse script aplica:

- `ops/k8s/base/00-namespaces.yaml`
- `ops/k8s/base/01-limits.yaml`
- `ops/k8s/data/postgres.yaml`
- `ops/k8s/data/postgres-backup.yaml`
- `ops/k8s/data/postgres-restore-check.yaml`

## Subir aplicacao com 2 replicas + load balancing

1) Build, import da imagem e deploy:

```bash
./ops/k8s/deploy-app-local.sh
```

2) Verificar replicas e endpoints:

```bash
kubectl --context k3d-workload -n app get deploy,pods,svc,endpoints,ingress
```

3) Testar health endpoint pelo ingress:

```bash
curl http://api.127.0.0.1.sslip.io:8080/api/health
```

4) Rodar teste de integracao end-to-end (signup -> signin -> test case -> run -> pod -> callback):

```bash
bun --cwd backend run test:integration:k3s
```

Observacao: o Deployment `backend` roda com `replicas: 2` e o Service `backend` distribui trafego entre os pods saudaveis.

## Operacao diaria

Forcar backup manual:

```bash
kubectl --context k3d-workload create job --from=cronjob/postgres-backup postgres-backup-manual -n data
kubectl --context k3d-workload logs -f job/postgres-backup-manual -n data
```

Rodar restore drill manual:

```bash
kubectl --context k3d-workload delete job postgres-restore-check -n data --ignore-not-found
kubectl --context k3d-workload apply -f ops/k8s/data/postgres-restore-check.yaml
kubectl --context k3d-workload logs -f job/postgres-restore-check -n data
```

## Observacoes importantes

- O `postgres-auth` em `ops/k8s/data/postgres.yaml` vem com credenciais padrao para ambiente local. Troque antes de usar em ambiente remoto.
- O banco local padrao configurado neste lab e `taas`.
- O backup atual grava em PVC (`postgres-backups`). Para maior paridade com producao, migrar para MinIO/S3 na proxima iteracao.
- O hostname do Rancher usa `sslip.io` com gateway Docker para evitar workaround com `hostAliases`.
